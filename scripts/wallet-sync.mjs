// Trae los movimientos de las cuentas conectadas al banco en Wallet (BudgetBakers) y los guarda en Supabase
// (bank_tx), igual que hacía la sincronización de Enable Banking: el panel los recoge al abrirse.
// Wallet hace la conexión con el banco por su cuenta; aquí solo se lee su API REST (requiere Premium).
import crypto from 'node:crypto';
import { env, sb, uid, getStatus, setStatus, summary } from './eb.mjs';

const API = 'https://rest.budgetbakers.com/wallet/v1/api';
const DAYS = +(process.env.DAYS_BACK || 14);
const FAILMAX = 3; // fallos pasajeros seguidos antes de dar la ejecución por fallida (y que GitHub mande correo)
const day = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

let lastChange = null; // cabecera X-Last-Data-Change-At de la API: último cambio de datos en Wallet
async function wallet(path, params = {}) {
  let r, t;
  try {
    r = await fetch(`${API}/${path}?${new URLSearchParams(params)}`, { headers: { Authorization: 'Bearer ' + env('WALLET_TOKEN') } });
    t = await r.text();
    const ch = r.headers.get('x-last-data-change-at'); if (ch) lastChange = ch;
  } catch (e) { r = { ok: false, status: 0 }; t = 'Fallo de red: ' + e.message; }
  if (!r.ok) {
    const err = new Error(`Wallet GET /${path} → ${r.status}: ${t.slice(0, 300)}`);
    err.status = r.status;
    throw err;
  }
  return JSON.parse(t);
}
/* Aviso por Telegram (opcional): solo si están los secretos TELEGRAM_TOKEN y TELEGRAM_CHAT_ID. */
async function telegram(text) {
  const tk = process.env.TELEGRAM_TOKEN, chat = process.env.TELEGRAM_CHAT_ID;
  if (!tk || !chat) return;
  await fetch(`https://api.telegram.org/bot${tk.trim()}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat.trim(), text, disable_web_page_preview: true })
  }).catch(() => {});
}
const eur = n => (+n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const fd = s => s.split('-').reverse().join('/');

// 409 = Wallet aún está preparando los datos tras crear la clave; 429 = demasiadas consultas; 5xx = caída.
const transient = e => e.status === 0 || e.status === 409 || e.status === 429 || e.status >= 500;

async function all(path, key, params) {
  const out = [];
  let offset = 0;
  do {
    const r = await wallet(path, { ...params, limit: 200, offset });
    out.push(...(r[key] || []));
    offset = r.nextOffset;
  } while (offset);
  return out;
}

if (!process.env.WALLET_TOKEN) { summary('Falta el secreto WALLET_TOKEN: crea la clave en Wallet (Ajustes → REST API) y guárdala en GitHub.'); process.exit(0); }
const st = await getStatus().catch(() => null);
try {
  const accs = (await all('accounts', 'accounts', {})).filter(a => a.isBankSync && !a.archived);
  if (!accs.length) throw Object.assign(new Error('En Wallet no hay ninguna cuenta conectada al banco.'), { status: -1 });
  const from = day(DAYS), rows = new Map(), pend = new Map(), seen = [];
  const recs = await all('records', 'records', { accountId: accs.map(a => a.id).join(','), recordDate: 'gte.' + from, sortBy: '+recordDate' });

  for (const x of recs) {
    const amount = +(x.amount && x.amount.value);
    if (!amount) continue;
    const date = String(x.recordDate || '').slice(0, 10);
    // Para saber cuándo trae Wallet los movimientos del banco: solo fechas y horas, sin importes ni conceptos.
    seen.push({ id: 'r' + crypto.createHash('sha1').update(String(x.id)).digest('hex').slice(0, 24), user_id: uid(), kind: 'rec', booking_date: date || null, wallet_created_at: x.createdAt || null });
    const desc = [x.counterParty, x.note].filter(Boolean).join(' · ').replace(/\s+/g, ' ').trim();
    const acc = String(x.accountId || '').slice(-6);
    // Wallet deja como «uncleared» (No liquidado) casi todo lo de Openbank, aunque el banco ya lo haya cobrado. Solo lo
    // de hoy y ayer va a bank_pending (puede ser una retención que aún cambie); lo más antiguo se guarda como movimiento.
    // Cuando Wallet lo liquida es el mismo registro (mismo id), así que no se duplica.
    if (x.recordState === 'uncleared' && date >= day(1)) {
      const pid = 'pw' + crypto.createHash('sha1').update(x.id).digest('hex').slice(0, 22);
      pend.set(pid, { id: pid, user_id: uid(), booking_date: date, amount: amount.toFixed(2), description: desc.slice(0, 300) });
      continue;
    }
    const id = 'w' + crypto.createHash('sha1').update(x.id).digest('hex').slice(0, 24);
    rows.set(id, { id, user_id: uid(), account: acc, booking_date: date, amount: amount.toFixed(2), currency: (x.amount && x.amount.currencyCode) || 'EUR', description: desc.slice(0, 300) });
  }

  // Lo que ya entró por Enable Banking trae otro id y a veces otra fecha (Wallet usa el día de la compra y el
  // banco el del cargo). Se da por repetido si coincide el importe, la fecha difiere 5 días como mucho y el
  // concepto empieza igual (o es el mismo día). Cada movimiento guardado solo «tapa» a uno de Wallet.
  const DD = (a, b) => Math.abs(new Date(a) - new Date(b)) / 864e5, head = s => String(s || '').toLowerCase().replace(/[^a-z]/g, '').slice(0, 14);
  const same = (r, o) => (+r.amount).toFixed(2) === (+o.amount).toFixed(2) && DD(r.booking_date, o.booking_date) <= 5 &&
    (r.booking_date === o.booking_date || head(r.description) === head(o.description));
  const total = rows.size, old = [];
  for (const r of await sb(`bank_tx?user_id=eq.${uid()}&booking_date=gte.${day(DAYS + 7)}&select=id,booking_date,amount,description`)) {
    if (rows.has(r.id)) rows.delete(r.id); // ya guardado
    else if (!r.id.startsWith('w')) old.push(r);
  }
  const oldAll = [...old];
  for (const [id, r] of rows) { const i = old.findIndex(o => same(r, o)); if (i >= 0) { old.splice(i, 1); rows.delete(id); } }
  // Un pendiente que ya aparece como cargo (guardado antes o traído ahora) no se muestra como pendiente.
  const booked = [...oldAll, ...rows.values()];
  for (const [id, p] of pend) { const i = booked.findIndex(o => same(p, o)); if (i >= 0) { booked.splice(i, 1); pend.delete(id); } }
  if (rows.size) await sb('bank_tx?on_conflict=id', { method: 'POST', body: [...rows.values()], prefer: 'resolution=ignore-duplicates,return=minimal' });
  await sb(`bank_pending?user_id=eq.${uid()}`, { method: 'DELETE', prefer: 'return=minimal' });
  if (pend.size) await sb('bank_pending', { method: 'POST', body: [...pend.values()], prefer: 'return=minimal' });
  // Registro de horas (tabla wallet_log). Si la tabla no existe o falla, no afecta a la sincronización.
  try {
    if (seen.length) await sb('wallet_log?on_conflict=id', { method: 'POST', body: seen, prefer: 'resolution=ignore-duplicates,return=minimal' });
    await sb('wallet_log', { method: 'POST', body: { id: 'run' + Date.now(), user_id: uid(), kind: 'run', wallet_change_at: lastChange }, prefer: 'return=minimal' });
    // Qué datos da Wallet de cada cuenta conectada al banco: solo los nombres de los campos y los que son fechas
    // (p. ej. una posible «última sincronización con el banco»). Nunca saldos, números ni nombres. Solo lee: no fuerza nada.
    const t0 = Date.now(), paths = [], dates = [];
    const walk = (o, pre, depth) => { for (const [k, v] of Object.entries(o || {})) { const pth = pre ? pre + '.' + k : k;
      if (v && typeof v === 'object' && !Array.isArray(v) && depth < 2) walk(v, pth, depth + 1);
      else { paths.push(pth); if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) dates.push([pth, v]); } } };
    accs.forEach((a, i) => walk(a, 'c' + i, 0));
    const meta = [{ id: `keys|${t0}|${paths.join(',')}`.slice(0, 4000), user_id: uid(), kind: 'keys' },
      ...dates.map(([pth, v]) => ({ id: `acct|${t0}|${pth}`, user_id: uid(), kind: 'acct', wallet_change_at: v }))];
    await sb('wallet_log', { method: 'POST', body: meta, prefer: 'return=minimal' });
  } catch (e) { console.log('wallet_log: ' + e.message.slice(0, 120)); }
  if (st && (st.fail_count || 0) >= FAILMAX) await telegram('✅ Banco: la sincronización con Wallet vuelve a funcionar.');
  await setStatus({ last_sync: new Date().toISOString(), last_error: null, fail_count: 0 });
  if (rows.size) {
    const L = [...rows.values()].sort((a, b) => a.booking_date.localeCompare(b.booking_date));
    await telegram(`🏦 ${L.length} movimiento${L.length > 1 ? 's' : ''} nuevo${L.length > 1 ? 's' : ''} del banco:\n` +
      L.slice(0, 15).map(r => `${+r.amount > 0 ? '🟢 +' : '🔴 '}${eur(r.amount)} · ${r.description.slice(0, 45) || 'sin concepto'} (${fd(r.booking_date)})`).join('\n') +
      (L.length > 15 ? `\n… y ${L.length - 15} más` : ''));
  } else if (process.env.MANUAL === 'true') await telegram('✅ Banco sincronizado con Wallet: no hay movimientos nuevos.');
  summary(`## ✅ Sincronizado con Wallet\n\n${total} movimientos revisados desde ${from} (${rows.size} nuevos) y ${pend.size} pendientes en ${accs.length} cuenta(s).`); // registro público: sin nombres de cuentas
} catch (e) {
  const soft = transient(e), fc = soft ? ((st && st.fail_count) || 0) + 1 : FAILMAX, quiet = soft && fc < FAILMAX;
  await setStatus({ last_error: String(e.message).slice(0, 1200), fail_count: fc }).catch(() => {});
  // Un solo aviso al llegar al límite de fallos seguidos (no uno por cada intento).
  if (!quiet && ((st && st.fail_count) || 0) < FAILMAX) await telegram(`⚠️ Banco: la sincronización con Wallet está fallando.\n${String(e.message).slice(0, 200)}\nRevisa en Wallet si hay que reconectar Openbank.`);
  summary(`## ${quiet ? `⚠️ Wallet no respondió (fallo ${fc} de ${FAILMAX} antes de avisar)` : '❌ Error al sincronizar con Wallet'}\n\n\`\`\`\n${e.message}\n\`\`\``);
  process.exit(quiet ? 0 : 1);
}
