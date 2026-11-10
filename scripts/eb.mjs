// Utilidades compartidas: firma JWT para Enable Banking y llamadas REST a Supabase.
// Solo se ejecuta en GitHub Actions (Node 20, sin dependencias).
import crypto from 'node:crypto';
import fs from 'node:fs';

const API = process.env.EB_API || 'https://api.enablebanking.com'; // EB_API solo en las pruebas

export function env(k) {
  const v = process.env[k];
  if (!v) throw new Error(`Falta el secreto ${k} (GitHub → Settings → Secrets and variables → Actions)`);
  return v.trim();
}

const b64u = s => Buffer.from(s).toString('base64url');
function jwt() {
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'RS256', kid: env('EB_APP_ID') }));
  const body = b64u(JSON.stringify({ iss: 'enablebanking.com', aud: 'api.enablebanking.com', iat: now, exp: now + 3600 }));
  const key = env('EB_PRIVATE_KEY').replace(/\\n/g, '\n');
  const sig = crypto.sign('RSA-SHA256', Buffer.from(head + '.' + body), key).toString('base64url');
  return head + '.' + body + '.' + sig;
}

/* Fallos pasajeros seguidos antes de dar una sincronización por fallida. La app usa el mismo número (FAILMAX en js/base.js). */
export const FAILMAX = 3;

/* Errores del banco que suelen ser momentáneos: no merecen correo de GitHub a la primera. */
export const transient = e => e.status === 0 || e.status === 429 || e.status >= 500 || /ASPSP_(ERROR|TIMEOUT|RATE_LIMIT)/.test(e.body || '');

export async function eb(path, { method = 'GET', body } = {}, tries = 2) {
  let r, t;
  try {
    r = await fetch(API + path, {
      method,
      headers: { Authorization: 'Bearer ' + jwt(), 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000) // una llamada colgada no bloquea la sincronización: a los 30 s cuenta como fallo de red
    });
    t = await r.text();
  } catch (e) { r = { ok: false, status: 0, headers: new Headers() }; t = 'Fallo de red: ' + e.message; }
  if (!r.ok) {
    const err = new Error(`Enable Banking ${method} ${path.split('?')[0]} → ${r.status}: ${t.slice(0, 300)}`);
    // Identificador de la petición: es lo que pide el soporte de Enable Banking para buscarla.
    err.status = r.status; err.body = t; err.service = 'enable-banking';
    err.rid = ['x-request-id', 'request-id', 'x-correlation-id', 'traceparent'].map(h => r.headers.get(h)).find(Boolean) || '';
    if (tries > 1 && transient(err)) {
      await new Promise(res => setTimeout(res, 45000));
      return eb(path, { method, body }, tries - 1);
    }
    throw err;
  }
  return t ? JSON.parse(t) : {};
}

/* Supabase: 20 s como máximo por llamada y un reintento si es un fallo de red o del servidor (5xx).
   El error lleva status y service, para no confundir un fallo de Supabase con uno del banco. */
export async function sb(path, { method = 'GET', body, prefer } = {}, tries = 2) {
  const url = env('SUPABASE_URL').replace(/\/$/, ''), key = env('SUPABASE_SERVICE_KEY');
  const headers = { apikey: key, 'Content-Type': 'application/json' };
  if (key.startsWith('eyJ')) headers.Authorization = 'Bearer ' + key; // clave service_role clásica (JWT)
  if (prefer) headers.Prefer = prefer;
  let r, t;
  try {
    r = await fetch(url + '/rest/v1/' + path, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) });
    t = await r.text();
  } catch (e) { r = { ok: false, status: 0 }; t = 'Fallo de red: ' + e.message; }
  if (!r.ok) {
    if (tries > 1 && (r.status === 0 || r.status >= 500)) { await new Promise(res => setTimeout(res, 3000)); return sb(path, { method, body, prefer }, tries - 1); }
    throw Object.assign(new Error(`Supabase ${method} ${path.split('?')[0]} → ${r.status}: ${t.slice(0, 300)}`), { status: r.status, service: 'supabase' });
  }
  return t ? JSON.parse(t) : null;
}

export const uid = () => env('LDB_USER_ID');

/* Conexiones con bancos (tabla bank_connections, una fila por conexión). purpose: gastos → Finanzas; ahorro → Inversiones.
   Los movimientos de cada tipo van a tablas distintas (bank_tx / savings_tx), así que nunca se mezclan. */
export const CONNECTIONS = {
  'openbank': { aspsp: 'Openbank', country: 'ES', purpose: 'gastos' },
  // Trade Republic con el permiso de «todas las cuentas» deja la sesión sin ninguna cuenta: se pide para una cuenta
  // concreta con su IBAN, que está en el secreto TR_IBAN de GitHub (nunca en el código).
  'trade-republic': { aspsp: 'Trade Republic', country: 'ES', purpose: 'ahorro', ibanEnv: 'TR_IBAN' }
};
function conn(id) {
  if (!CONNECTIONS[id]) throw new Error(`Conexión desconocida «${id}» (válidas: ${Object.keys(CONNECTIONS).join(', ')})`);
  return CONNECTIONS[id];
}

export async function getStatus(id = 'openbank') {
  conn(id);
  return (await sb(`bank_connections?user_id=eq.${uid()}&id=eq.${encodeURIComponent(id)}&select=*`))[0] || null;
}
export async function setStatus(fields, id = 'openbank') {
  const c = conn(id);
  await sb('bank_connections?on_conflict=user_id,id', {
    method: 'POST', body: { user_id: uid(), id, purpose: c.purpose, country: c.country, ...fields }, prefer: 'resolution=merge-duplicates,return=minimal'
  });
}

/* Saldo de una cuenta a partir de /balances: se prefiere el contable (el que enseña el banco) y, si no lo da, el disponible.
   Devuelve { amount, type } o null. */
export function pickBalance(balances = []) {
  const pref = ['ITBD', 'CLBD', 'ITAV', 'CLAV', 'XPCD'];
  const b = [...balances].sort((x, y) => (pref.indexOf(x.balance_type) + 1 || 99) - (pref.indexOf(y.balance_type) + 1 || 99))[0];
  const amt = b && +(b.balance_amount && b.balance_amount.amount) * (b.credit_debit_indicator === 'DBIT' ? -1 : 1);
  return b && Number.isFinite(amt) ? { amount: amt, type: b.balance_type || '' } : null;
}

/* Tipo de un movimiento de la cuenta de ahorro: los intereses (y la retención de impuestos sobre ellos) son «interes»;
   el resto, dinero que se mete («aporte») o se saca («retirada»). */
export function savKind(amount, desc = '') {
  if (!amount) return 'otro';
  if (amount > 0 && /inter[eé]s|interest|zins/i.test(desc)) return 'interes';
  if (amount < 0 && /impuesto|retenci[oó]n|\btax|steuer/i.test(desc)) return 'interes';
  return amount > 0 ? 'aporte' : 'retirada';
}

/* Escribe en el resumen visible de la ejecución de GitHub Actions. */
export function summary(md) {
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
  else console.log(md);
}
