// Cuenta de ahorro (conexión de tipo «ahorro», p. ej. trade-republic): guarda el saldo del día en savings_daily y los
// movimientos recientes en savings_tx, clasificados (interes, aporte, retirada). Nunca escribe en bank_tx: los gastos
// de Finanzas no se mezclan con el ahorro. La app junta estos datos con los apuntes a mano al mostrar Inversiones.
// Termina siempre «bien»: el fallo queda en bank_connections y job_health, y es el vigilante quien avisa.
import crypto from 'node:crypto';
import { eb, sb, uid, getStatus, setStatus, summary, transient, FAILMAX, pickBalance, savKind } from './eb.mjs';
import { log, job, guard, redact } from './log.mjs';

guard('savings-sync');
const CONN = (process.env.SAV_CONN || 'trade-republic').trim();
await job('savings-sync', 'start');

const day = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date()); // AAAA-MM-DD en España

const st = await getStatus(CONN).catch(async e => {
  await log('ERROR', 'savings-sync', 'No se pudo leer el estado de la conexión en Supabase', { func: 'getStatus', err: e });
  await job('savings-sync', 'fail', e.message);
  summary('## ❌ ' + redact(e.message));
  process.exit(0);
});
if (!st || !st.session_id) { await job('savings-sync', 'ok'); summary(`Cuenta de ahorro (${CONN}) aún no conectada: ejecuta antes «Conectar banco».`); process.exit(0); }

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

try {
  const sess = await eb('/sessions/' + st.session_id);
  if (sess.status && sess.status !== 'AUTHORIZED') throw new Error(`El permiso no está activo (estado ${sess.status}). Renuévalo con «Conectar banco».`);
  const accounts = (sess.accounts || st.accounts || []).map(x => (typeof x === 'string' ? x : x.uid)).filter(Boolean);
  // La primera vez, todo lo que deja el banco (90 días); después, los últimos 10 (por si alguno llega con retraso).
  const from = st.last_sync ? day(+(process.env.DAYS_BACK || 10)) : day(89);
  const rows = new Map(), kinds = {};
  let total = null, btype = '';

  for (const acc of accounts) {
    const seen = {};
    for (const t of await fetchTx(acc, { date_from: from })) {
      if (t.status && t.status !== 'BOOK') continue; // solo lo ya confirmado
      const raw = +(t.transaction_amount && t.transaction_amount.amount);
      if (!raw) continue;
      const amount = t.credit_debit_indicator ? Math.abs(raw) * (t.credit_debit_indicator === 'DBIT' ? -1 : 1) : raw;
      const date = t.booking_date || t.value_date || t.transaction_date;
      if (!date) continue;
      const party = amount < 0 ? t.creditor && t.creditor.name : t.debtor && t.debtor.name;
      const desc = [party, ...(t.remittance_information || [])].filter(Boolean).join(' · ').replace(/\s+/g, ' ').trim();
      let ref = t.entry_reference || t.transaction_id;
      if (!ref) { const b = `${date}|${amount}|${desc}`; seen[b] = (seen[b] || 0) + 1; ref = b + '|' + seen[b]; }
      const id = 's' + crypto.createHash('sha1').update(CONN + '|' + acc + '|' + ref).digest('hex').slice(0, 24);
      const kind = savKind(amount, desc);
      kinds[kind] = (kinds[kind] || 0) + 1;
      rows.set(id, { id, user_id: uid(), conn: CONN, booking_date: date, amount: amount.toFixed(2), description: desc.slice(0, 300), kind });
    }
    const { balances = [] } = await eb(`${accUrl(acc)}/balances`);
    const b = pickBalance(balances);
    if (b) { total = (total || 0) + b.amount; btype = btype || b.type; }
  }

  // merge-duplicates: si se mejora la clasificación, los ya guardados se corrigen en la siguiente sincronización.
  if (rows.size) await sb('savings_tx?on_conflict=id', { method: 'POST', body: [...rows.values()], prefer: 'resolution=merge-duplicates,return=minimal' });
  const bal = total === null ? null : { balance: total.toFixed(2), balance_type: btype, balance_at: new Date().toISOString() };
  if (bal) await sb('savings_daily?on_conflict=user_id,conn,day', {
    method: 'POST', body: { user_id: uid(), conn: CONN, day: today, balance: bal.balance, balance_type: btype, updated_at: bal.balance_at },
    prefer: 'resolution=merge-duplicates,return=minimal'
  });
  await setStatus({ last_sync: new Date().toISOString(), last_error: null, fail_count: 0, valid_until: (sess.access && sess.access.valid_until) || st.valid_until, ...(bal || {}) }, CONN);
  const k = Object.entries(kinds).map(([a, n]) => `${n} ${a}`).join(', ') || 'ninguno';
  await log('INFO', 'savings-sync', 'Sincronización correcta', { func: 'main', detail: `${CONN}: ${rows.size} movimientos (${k})${bal ? '' : ', sin saldo'}` });
  await job('savings-sync', 'ok');
  // En el resumen de GitHub (público) solo cuentas y tipos, nunca importes ni conceptos.
  summary(`## ✅ Ahorro sincronizado (${CONN})\n\n${rows.size} movimientos revisados desde ${from}: ${k}.` +
    (bal ? `\n\nSaldo del día guardado (tipo ${btype}).` : '\n\nEl banco no dio el saldo: se mantiene el último.'));
} catch (e) {
  const fc = (st.fail_count || 0) + 1, soft = transient(e) && fc < FAILMAX;
  const msg = (String(e.message).slice(0, 300) + (e.rid ? ` · id ${e.rid}` : '')).slice(0, 1200);
  await setStatus({ last_error: msg, fail_count: fc }, CONN).catch(e2 => log('ERROR', 'savings-sync', 'No se pudo guardar el error en bank_connections', { func: 'setStatus', err: e2 }));
  await log(soft ? 'WARNING' : 'ERROR', 'savings-sync', soft ? `El banco no respondió (fallo ${fc} de ${FAILMAX})` : 'Error al sincronizar el ahorro', { func: 'main', err: e, detail: e.rid ? 'id petición ' + e.rid : '' });
  await job('savings-sync', 'fail', msg);
  summary(`## ${soft ? '⚠️ El banco no respondió' : '❌ Error al sincronizar el ahorro'}\n\n\`\`\`\n${redact(e.message)}\n\`\`\`` + (e.rid ? `\nID de la petición: \`${e.rid}\`` : ''));
  process.exit(0);
}
