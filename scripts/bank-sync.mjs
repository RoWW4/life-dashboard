// Descarga los movimientos recientes de Enable Banking y los guarda en Supabase (bank_tx).
// El panel los recoge al abrirse, los clasifica y evita duplicados con fijos y facturas.
import crypto from 'node:crypto';
import { eb, sb, uid, getStatus, setStatus, summary, transient } from './eb.mjs';

const DAYS = +(process.env.DAYS_BACK || 14);
const FAILMAX = 3; // fallos pasajeros seguidos antes de dar la ejecución por fallida (y que GitHub mande correo)
const day = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

const st = await getStatus().catch(e => { summary('## ❌ ' + e.message); process.exit(1); });
if (!st || !st.session_id) { summary('Banco aún no conectado: ejecuta antes «Conectar banco».'); process.exit(0); }

const diag = [];
const accUrl = acc => `/accounts/${encodeURIComponent(acc)}`;

async function fetchTx(acc, params) {
  const out = [];
  let ck;
  do {
    const q = new URLSearchParams(params);
    if (ck) q.set('continuation_key', ck);
    const r = await eb(`${accUrl(acc)}/transactions?${q}`);
    out.push(...(r.transactions || []));
    ck = r.continuation_key;
  } while (ck);
  return out;
}

/* Si Openbank rechaza la consulta normal, se prueban otras más pequeñas (sin reintentos, para no gastar
   consultas) y se apunta qué acepta y qué no: sirve para el soporte de Enable Banking. */
async function diagnose(acc) {
  const one = async (label, fn) => {
    try { const v = await fn(); diag.push(`✅ ${label}`); return v; }
    catch (e) { diag.push(`❌ ${label}: ${e.status ?? ''} ${(e.body || e.message).slice(0, 160)}${e.rid ? ' · id ' + e.rid : ''}`); return null; }
  };
  await one('Saldo (/balances)', () => eb(`${accUrl(acc)}/balances`, {}, 1));
  const r = await one(`Movimientos de 3 días (${day(3)} → ${day(0)})`,
    () => eb(`${accUrl(acc)}/transactions?${new URLSearchParams({ date_from: day(3), date_to: day(0) })}`, {}, 1));
  return r ? r.transactions || [] : null;
}

try {
  const sess = await eb('/sessions/' + st.session_id);
  if (sess.status && sess.status !== 'AUTHORIZED') throw new Error(`El permiso del banco no está activo (estado ${sess.status}). Renuévalo con «Conectar banco».`);
  const accounts = (sess.accounts || st.accounts || []).map(x => (typeof x === 'string' ? x : x.uid)).filter(Boolean);
  const from = st.last_sync ? day(DAYS) : new Date().toISOString().slice(0, 8) + '01';
  const rows = new Map(), pend = new Map();

  for (const acc of accounts) {
    let list;
    try { list = await fetchTx(acc, { date_from: from }); }
    catch (e) {
      if (!transient(e)) throw e;
      diag.push(`❌ Movimientos desde ${from}: ${e.status} ${(e.body || '').slice(0, 160)}${e.rid ? ' · id ' + e.rid : ''}`);
      list = await diagnose(acc);
      if (!list) throw e;
    }
    const seen = {};
    for (const t of list) {
      const raw = +(t.transaction_amount && t.transaction_amount.amount);
      if (!raw) continue;
      const amount = t.credit_debit_indicator ? Math.abs(raw) * (t.credit_debit_indicator === 'DBIT' ? -1 : 1) : raw;
      const date = t.booking_date || t.value_date || t.transaction_date;
      if (!date) continue;
      const party = amount < 0 ? t.creditor && t.creditor.name : t.debtor && t.debtor.name;
      const desc = [party, ...(t.remittance_information || [])].filter(Boolean).join(' · ').replace(/\s+/g, ' ').trim();
      // Retenciones de tarjeta y bizums sin cerrar: van a bank_pending, que se rehace en cada sincronización.
      if (t.status && t.status !== 'BOOK') {
        if (t.status !== 'PDNG') continue;
        const pid = 'p' + crypto.createHash('sha1').update(`${acc}|${t.transaction_date || date}|${amount}|${desc}|${pend.size}`).digest('hex').slice(0, 24);
        pend.set(pid, { id: pid, user_id: uid(), booking_date: t.transaction_date || date, amount: amount.toFixed(2), description: desc.slice(0, 300) });
        continue;
      }
      let ref = t.entry_reference || t.transaction_id;
      if (!ref) { const b = `${date}|${amount}|${desc}`; seen[b] = (seen[b] || 0) + 1; ref = b + '|' + seen[b]; }
      const id = 'a' + crypto.createHash('sha1').update(acc + '|' + ref).digest('hex').slice(0, 24);
      rows.set(id, { id, user_id: uid(), account: acc.slice(-6), booking_date: date, amount: amount.toFixed(2), currency: (t.transaction_amount && t.transaction_amount.currency) || 'EUR', description: desc.slice(0, 300) });
    }
  }

  // Al renovar el permiso el banco da otro identificador a la cuenta y los ids cambian: los movimientos
  // que ya estaban guardados con el id antiguo (misma fecha, importe y concepto) no se vuelven a guardar.
  const key = r => `${r.booking_date}|${(+r.amount).toFixed(2)}|${r.description}`;
  const old = {}, total = rows.size;
  for (const r of await sb(`bank_tx?user_id=eq.${uid()}&booking_date=gte.${from}&select=id,booking_date,amount,description`)) {
    if (!rows.has(r.id)) old[key(r)] = (old[key(r)] || 0) + 1;
    else rows.delete(r.id); // ya guardado con este mismo id
  }
  for (const [id, r] of rows) if (old[key(r)]) { old[key(r)]--; rows.delete(id); }
  if (rows.size) await sb('bank_tx?on_conflict=id', { method: 'POST', body: [...rows.values()], prefer: 'resolution=ignore-duplicates,return=minimal' });
  await sb(`bank_pending?user_id=eq.${uid()}`, { method: 'DELETE', prefer: 'return=minimal' });
  if (pend.size) await sb('bank_pending', { method: 'POST', body: [...pend.values()], prefer: 'return=minimal' });
  await setStatus({ last_sync: new Date().toISOString(), last_error: null, fail_count: 0, valid_until: (sess.access && sess.access.valid_until) || st.valid_until });
  summary(`## ✅ Sincronizado\n\n${total} movimientos revisados (${rows.size} nuevos) y ${pend.size} pendientes en ${accounts.length} cuenta(s). Los repetidos se ignoran.` +
    (diag.length ? `\n\n### ⚠️ La consulta normal falló y se usó una más corta\n${diag.map(d => '- ' + d).join('\n')}` : ''));
} catch (e) {
  // Fallo pasajero del banco: se apunta y la ejecución termina «bien» (sin correo) hasta que se repita FAILMAX veces.
  const soft = transient(e), fc = soft ? (st.fail_count || 0) + 1 : FAILMAX, quiet = soft && fc < FAILMAX;
  const msg = (String(e.message).slice(0, 300) + (e.rid ? ` · id ${e.rid}` : '') + (diag.length ? ' | ' + diag.join(' | ') : '')).slice(0, 1200);
  await setStatus({ last_error: msg, fail_count: fc }).catch(() => {});
  summary(`## ${quiet ? `⚠️ El banco no respondió (fallo ${fc} de ${FAILMAX} antes de avisar)` : '❌ Error al sincronizar'}\n\n\`\`\`\n${e.message}\n\`\`\`` +
    (e.rid ? `\nID de la petición: \`${e.rid}\`` : '') +
    (diag.length ? `\n\n### Diagnóstico\n${diag.map(d => '- ' + d).join('\n')}` : ''));
  process.exit(quiet ? 0 : 1);
}
