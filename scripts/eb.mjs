// Utilidades compartidas: firma JWT para Enable Banking y llamadas REST a Supabase.
// Solo se ejecuta en GitHub Actions (Node 20, sin dependencias).
import crypto from 'node:crypto';
import fs from 'node:fs';

const API = 'https://api.enablebanking.com';

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

/* Errores del banco que suelen ser momentáneos: no merecen correo de GitHub a la primera. */
export const transient = e => e.status === 0 || e.status === 429 || e.status >= 500 || /ASPSP_(ERROR|TIMEOUT|RATE_LIMIT)/.test(e.body || '');

export async function eb(path, { method = 'GET', body } = {}, tries = 2) {
  let r, t;
  try {
    r = await fetch(API + path, {
      method,
      headers: { Authorization: 'Bearer ' + jwt(), 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    t = await r.text();
  } catch (e) { r = { ok: false, status: 0, headers: new Headers() }; t = 'Fallo de red: ' + e.message; }
  if (!r.ok) {
    const err = new Error(`Enable Banking ${method} ${path.split('?')[0]} → ${r.status}: ${t.slice(0, 300)}`);
    // Identificador de la petición: es lo que pide el soporte de Enable Banking para buscarla.
    err.status = r.status; err.body = t;
    err.rid = ['x-request-id', 'request-id', 'x-correlation-id', 'traceparent'].map(h => r.headers.get(h)).find(Boolean) || '';
    if (tries > 1 && transient(err)) {
      await new Promise(res => setTimeout(res, 45000));
      return eb(path, { method, body }, tries - 1);
    }
    throw err;
  }
  return t ? JSON.parse(t) : {};
}

export async function sb(path, { method = 'GET', body, prefer } = {}) {
  const url = env('SUPABASE_URL').replace(/\/$/, ''), key = env('SUPABASE_SERVICE_KEY');
  const headers = { apikey: key, 'Content-Type': 'application/json' };
  if (key.startsWith('eyJ')) headers.Authorization = 'Bearer ' + key; // clave service_role clásica (JWT)
  if (prefer) headers.Prefer = prefer;
  const r = await fetch(url + '/rest/v1/' + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  if (!r.ok) throw new Error(`Supabase ${method} ${path.split('?')[0]} → ${r.status}: ${t.slice(0, 300)}`);
  return t ? JSON.parse(t) : null;
}

export const uid = () => env('LDB_USER_ID');

export async function getStatus() {
  return (await sb(`bank_status?user_id=eq.${uid()}&select=*`))[0] || null;
}
export async function setStatus(fields) {
  await sb('bank_status?on_conflict=user_id', {
    method: 'POST', body: { user_id: uid(), ...fields }, prefer: 'resolution=merge-duplicates,return=minimal'
  });
}

/* Escribe en el resumen visible de la ejecución de GitHub Actions. */
export function summary(md) {
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
  else console.log(md);
}
