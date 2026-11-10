// Pruebas del registro común (scripts/log.mjs). Sin conexión: Supabase se simula con un servidor local.
// Ejecutar: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url'; // en Windows, «D:/…» no vale como import: hace falta file:///D:/…
import { redact } from '../scripts/log.mjs';

test('redact quita tokens, ids, IBAN, tarjetas, importes y correos', () => {
  const s = redact('bot123456:AAH_abcdefghijklmnopqrstuvwxyz Bearer abcdefghijklmnop12345 ' +
    '/accounts/3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90 ES91 2100 0418 4502 0005 1332 4111 1111 1111 1111 ' +
    '-45,90 € 12.50 EUR prueba@example.com ?code=xyz123&state=abc eyJhbGciOiJIUzI1.eyJzdWIiOiIxMjM0.abcdefghijk');
  for (const bad of ['AAH_abc', 'abcdefghijklmnop12345', '3f2a9c1e', 'ES91', '4111', '45,90', '12.50', 'prueba@', 'xyz123', 'eyJhbGci'])
    assert.ok(!s.includes(bad), `sigue apareciendo «${bad}» en: ${s}`);
  assert.equal(redact('Error interacting with ASPSP'), 'Error interacting with ASPSP');
});

/* Un script que falla con un error no controlado debe dejar: un CRITICAL en ops_log, el latido «fail» y salir con 1. */
test('guard registra el error no controlado, marca el latido y sale con 1', async () => {
  const got = [];
  const srv = createServer((q, r) => { let b = ''; q.on('data', c => b += c); q.on('end', () => { got.push({ path: q.url, body: JSON.parse(b || 'null') }); r.writeHead(201); r.end(); }); });
  await new Promise(r => srv.listen(0, r));
  const dir = mkdtempSync(join(tmpdir(), 'ldb-log-')), f = join(dir, 'falla.mjs');
  writeFileSync(f, `import { guard, job } from '${pathToFileURL(resolve('scripts/log.mjs')).href}';\nguard('prueba');\nawait job('prueba', 'start');\nthrow new Error('fallo de prueba con token=abcdefghijklmnop1234');\n`);
  const code = await new Promise(res => spawn(process.execPath, [f], { env: { ...process.env,
    SUPABASE_URL: `http://localhost:${srv.address().port}`, SUPABASE_SERVICE_KEY: 'clave-de-prueba', LDB_USER_ID: '', GITHUB_RUN_ID: '42', GITHUB_REPOSITORY: 'x/y' } }).on('exit', res));
  srv.close();
  assert.equal(code, 1);
  const logs = got.filter(g => g.path.startsWith('/rest/v1/ops_log')), jobs = got.filter(g => g.path === '/rest/v1/rpc/ldb_job');
  assert.equal(logs.length, 1);
  assert.equal(logs[0].body.level, 'CRITICAL');
  assert.equal(logs[0].body.run_id, '42');
  assert.match(logs[0].body.run_url, /actions\/runs\/42$/);
  assert.ok(!JSON.stringify(logs[0].body).includes('abcdefghijklmnop1234'), 'el token no debe quedar registrado');
  assert.deepEqual(jobs.map(j => j.body.p_event), ['start', 'fail']);
});

/* Si Supabase no responde, el registro no rompe el robot. */
test('log no lanza aunque Supabase no responda', async () => {
  process.env.SUPABASE_URL = 'http://localhost:9'; process.env.SUPABASE_SERVICE_KEY = 'x';
  const { log, job } = await import('../scripts/log.mjs');
  await log('ERROR', 'prueba', 'evento');
  await job('prueba', 'ok');
});
