// Pruebas del robot del banco (scripts/bank-sync.mjs) sin conexión: Enable Banking y Supabase se simulan con un
// servidor local. Datos de prueba inventados.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' });

async function run({ supa503 = 0 } = {}) {
  const calls = []; let fails = supa503;
  const srv = createServer((q, r) => {
    let b = ''; q.on('data', c => b += c); q.on('end', () => {
      calls.push({ m: q.method, u: decodeURIComponent(q.url), body: b ? JSON.parse(b) : null });
      const json = (code, v) => { r.writeHead(code, { 'content-type': 'application/json' }); r.end(v === undefined ? '' : JSON.stringify(v)); };
      const u = q.url;
      if (u.startsWith('/sessions/')) return json(200, { status: 'AUTHORIZED', accounts: ['cuenta-prueba'], access: { valid_until: '2027-01-01T00:00:00Z' } });
      if (u.includes('/transactions')) return json(200, { transactions: [
        { status: 'BOOK', entry_reference: 'r1', booking_date: '2026-11-08', transaction_amount: { amount: '10.00', currency: 'EUR' }, credit_debit_indicator: 'DBIT', remittance_information: ['Prueba'] },
        { status: 'PDNG', transaction_date: '2026-11-09', transaction_amount: { amount: '3.00', currency: 'EUR' }, credit_debit_indicator: 'DBIT', remittance_information: ['Pendiente'] }] });
      if (u.includes('/balances')) return json(200, { balances: [] });
      if (q.method === 'GET' && u.startsWith('/rest/v1/bank_status')) return json(200, [{ session_id: 'sesion', last_sync: '2026-11-01T00:00:00Z', fail_count: 0 }]);
      if (q.method === 'GET' && u.startsWith('/rest/v1/bank_tx')) { if (fails-- > 0) return json(503, { message: 'unavailable' }); return json(200, []); }
      json(q.method === 'POST' ? 201 : 204);
    });
  });
  await new Promise(r => srv.listen(0, r));
  const url = `http://localhost:${srv.address().port}`;
  const code = await new Promise(res => spawn(process.execPath, ['scripts/bank-sync.mjs'], { env: { ...process.env,
    EB_API: url, EB_APP_ID: 'app', EB_PRIVATE_KEY: PEM, SUPABASE_URL: url, SUPABASE_SERVICE_KEY: 'clave-de-prueba',
    LDB_USER_ID: '00000000-0000-0000-0000-000000000000', GITHUB_STEP_SUMMARY: '', SIN_CORREO: '1' } }).on('exit', res));
  srv.close();
  return { code, calls };
}

test('las retenciones pendientes se guardan antes de quitar las viejas (la lista nunca queda vacía)', async () => {
  const { code, calls } = await run();
  assert.equal(code, 0);
  const ins = calls.findIndex(c => c.m === 'POST' && c.u.startsWith('/rest/v1/bank_pending'));
  const del = calls.findIndex(c => c.m === 'DELETE' && c.u.startsWith('/rest/v1/bank_pending'));
  assert.ok(ins >= 0 && del > ins, 'primero se insertan, después se borran');
  assert.match(calls[del].u, /id=not\.in\.\(p[0-9a-f]+\)/, 'solo se borran las que ya no están');
  assert.ok(calls.some(c => c.m === 'POST' && c.u.startsWith('/rest/v1/bank_tx')), 'el movimiento confirmado se guarda');
  const jobs = calls.filter(c => c.u === '/rest/v1/rpc/ldb_job').map(c => c.body.p_event);
  assert.deepEqual(jobs, ['start', 'ok']);
});

test('un fallo momentáneo de Supabase (503) se reintenta y la sincronización termina bien', async () => {
  const { code, calls } = await run({ supa503: 1 });
  assert.equal(code, 0);
  assert.equal(calls.filter(c => c.m === 'GET' && c.u.startsWith('/rest/v1/bank_tx')).length, 2);
  assert.deepEqual(calls.filter(c => c.u === '/rest/v1/rpc/ldb_job').map(c => c.body.p_event), ['start', 'ok']);
});
