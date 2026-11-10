// Pruebas de la cuenta de ahorro: el robot (scripts/savings-sync.mjs) con Enable Banking y Supabase simulados, la
// clasificación de movimientos y cómo junta Inversiones los apuntes a mano con los automáticos (savSnaps).
// Datos de prueba inventados.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { savKind } from '../scripts/eb.mjs';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' });

async function run({ status = [{ session_id: 'sesion', last_sync: null, fail_count: 0 }], txErr = false, noAcc = false } = {}) {
  const calls = [];
  const srv = createServer((q, r) => {
    let b = ''; q.on('data', c => b += c); q.on('end', () => {
      calls.push({ m: q.method, u: decodeURIComponent(q.url), body: b ? JSON.parse(b) : null });
      const json = (code, v) => { r.writeHead(code, { 'content-type': 'application/json' }); r.end(v === undefined ? '' : JSON.stringify(v)); };
      const u = q.url;
      if (u.startsWith('/sessions/')) return json(200, { status: 'AUTHORIZED', accounts: noAcc ? [] : ['cuenta-ahorro'], access: { valid_until: '2027-02-01T00:00:00Z' } });
      if (u.includes('/transactions')) {
        if (txErr) return json(400, { error: 'WRONG_REQUEST_PARAMETERS' });
        return json(200, { transactions: [
          { status: 'BOOK', entry_reference: 'i1', booking_date: '2026-11-01', transaction_amount: { amount: '5.00', currency: 'EUR' }, credit_debit_indicator: 'CRDT', remittance_information: ['Interest payment'] },
          { status: 'BOOK', entry_reference: 'i2', booking_date: '2026-11-01', transaction_amount: { amount: '1.00', currency: 'EUR' }, credit_debit_indicator: 'DBIT', remittance_information: ['Tax withholding'] },
          { status: 'BOOK', entry_reference: 'a1', booking_date: '2026-11-03', transaction_amount: { amount: '100.00', currency: 'EUR' }, credit_debit_indicator: 'CRDT', remittance_information: ['Ingreso de prueba'] },
          { status: 'BOOK', entry_reference: 'r1', booking_date: '2026-11-05', transaction_amount: { amount: '20.00', currency: 'EUR' }, credit_debit_indicator: 'DBIT', remittance_information: ['Salida de prueba'] },
          { status: 'PDNG', booking_date: '2026-11-06', transaction_amount: { amount: '9.00', currency: 'EUR' }, credit_debit_indicator: 'CRDT', remittance_information: ['Sin confirmar'] }] });
      }
      if (u.includes('/balances')) return json(200, { balances: [{ balance_type: 'CLAV', balance_amount: { amount: '1234.56', currency: 'EUR' } }] });
      if (q.method === 'GET' && u.startsWith('/rest/v1/bank_connections')) return json(200, status);
      json(q.method === 'POST' ? 201 : 204);
    });
  });
  await new Promise(r => srv.listen(0, r));
  const url = `http://localhost:${srv.address().port}`, sum = join(mkdtempSync(join(tmpdir(), 'ldb-')), 'resumen.md');
  const code = await new Promise(res => spawn(process.execPath, ['scripts/savings-sync.mjs'], { env: { ...process.env,
    EB_API: url, EB_APP_ID: 'app', EB_PRIVATE_KEY: PEM, SUPABASE_URL: url, SUPABASE_SERVICE_KEY: 'clave-de-prueba',
    LDB_USER_ID: '00000000-0000-0000-0000-000000000000', GITHUB_STEP_SUMMARY: sum, SAV_CONN: 'trade-republic' } }).on('exit', res));
  srv.close();
  return { code, calls, sum: readFileSync(sum, 'utf8') };
}

test('el robot de ahorro guarda saldo del día y movimientos clasificados, nunca en los gastos', async () => {
  const { code, calls, sum } = await run();
  assert.equal(code, 0);
  assert.ok(calls.some(c => c.u.includes('/transactions') && c.u.includes('date_from=')), 'pide movimientos');
  const tx = calls.find(c => c.m === 'POST' && c.u.startsWith('/rest/v1/savings_tx'));
  assert.deepEqual(tx.body.map(r => [r.booking_date, r.amount, r.kind]), [
    ['2026-11-01', '5.00', 'interes'], ['2026-11-01', '-1.00', 'interes'], ['2026-11-03', '100.00', 'aporte'], ['2026-11-05', '-20.00', 'retirada']]);
  assert.ok(tx.body.every(r => r.conn === 'trade-republic'));
  const d = calls.find(c => c.m === 'POST' && c.u.startsWith('/rest/v1/savings_daily'));
  assert.equal(d.body.balance, '1234.56');
  assert.match(d.body.day, /^\d{4}-\d{2}-\d{2}$/);
  const st = calls.find(c => c.m === 'POST' && c.u.startsWith('/rest/v1/bank_connections'));
  assert.equal(st.body.id, 'trade-republic');
  assert.equal(st.body.purpose, 'ahorro');
  assert.ok(st.body.last_sync && st.body.fail_count === 0);
  assert.ok(!calls.some(c => /\/rest\/v1\/bank_(tx|pending)/.test(c.u)), 'no toca los movimientos de Finanzas');
  assert.deepEqual(calls.filter(c => c.u === '/rest/v1/rpc/ldb_job').map(c => c.body.p_event), ['start', 'ok']);
  assert.doesNotMatch(sum, /1234|100\.00|prueba/i, 'el resumen público no lleva importes ni conceptos');
});

test('si el banco falla, el robot apunta el error y termina bien (avisa el vigilante)', async () => {
  const { code, calls } = await run({ status: [{ session_id: 'sesion', last_sync: '2026-11-09T00:00:00Z', fail_count: 1 }], txErr: true });
  assert.equal(code, 0);
  const st = calls.find(c => c.m === 'POST' && c.u.startsWith('/rest/v1/bank_connections'));
  assert.equal(st.body.fail_count, 2);
  assert.ok(st.body.last_error);
  assert.deepEqual(calls.filter(c => c.u === '/rest/v1/rpc/ldb_job').map(c => c.body.p_event), ['start', 'fail']);
});

test('si el permiso no trae ninguna cuenta, es un fallo con diagnóstico (sin datos sensibles)', async () => {
  const { code, calls, sum } = await run({ noAcc: true });
  assert.equal(code, 0);
  const st = calls.find(c => c.m === 'POST' && c.u.startsWith('/rest/v1/bank_connections'));
  assert.match(st.body.last_error, /ninguna cuenta/);
  assert.deepEqual(calls.filter(c => c.u === '/rest/v1/rpc/ldb_job').map(c => c.body.p_event), ['start', 'fail']);
  assert.ok(sum.includes('accounts[0]'), 'el resumen dice qué devolvió el banco');
});

test('sin conexión de ahorro no hace nada y termina bien', async () => {
  const { code, calls } = await run({ status: [] });
  assert.equal(code, 0);
  assert.ok(!calls.some(c => c.u.startsWith('/sessions') || c.u.startsWith('/rest/v1/savings')));
});

test('clasificación de los movimientos de ahorro', () => {
  assert.equal(savKind(3, 'Intereses'), 'interes');
  assert.equal(savKind(3, 'Zinsen'), 'interes');
  assert.equal(savKind(-1, 'Retención IRPF'), 'interes');
  assert.equal(savKind(-1, 'Steuer'), 'interes');
  assert.equal(savKind(50, 'Transferencia'), 'aporte');
  assert.equal(savKind(-50, 'Transferencia'), 'retirada');
  assert.equal(savKind(-50, 'Intereses'), 'retirada', 'una salida no es interés aunque lo diga');
  assert.equal(savKind(0, ''), 'otro');
  // Sin texto (como Trade Republic): por fecha e importe frente al saldo.
  const ctx = date => ({ date, balance: 5000 });
  assert.equal(savKind(9.5, '', ctx('2026-12-01')), 'interes', 'abono pequeño el día 1');
  assert.equal(savKind(-0.4, '', ctx('2026-12-01')), 'interes', 'retención pequeña el día 1');
  assert.equal(savKind(9.5, '', ctx('2026-12-02')), 'interes', 'o el día 2');
  assert.equal(savKind(2000, '', ctx('2026-12-01')), 'aporte', 'una aportación grande el día 1 no es interés');
  assert.equal(savKind(-50, '', ctx('2026-12-01')), 'retirada', 'una retirada normal el día 1 tampoco');
  assert.equal(savKind(9.5, '', ctx('2026-12-07')), 'aporte', 'otro día no es interés');
  assert.equal(savKind(9.5, '', { date: '2026-12-01', balance: 0 }), 'aporte', 'sin saldo no se adivina');
});

// savSnaps tal cual está en la app (se extrae de js/vistas/finanzas.js).
const src = readFileSync('js/vistas/finanzas.js', 'utf8');
const fn = src.slice(src.indexOf('function savSnaps'), src.indexOf('\nfunction savStats'));
const { savSnaps } = vm.runInNewContext(`const S = { sav: null }, SAVD = [], SAVT = [];\n${fn}\n;({ savSnaps });`);
const strip = L => JSON.parse(JSON.stringify(L.map(({ d, bal, dep, auto }) => ({ d, bal, dep, auto: !!auto }))));

test('Inversiones: sin datos automáticos se usan solo los apuntes a mano', () => {
  const M = [{ id: 'b', d: '2026-10-01', bal: 110, dep: 0 }, { id: 'a', d: '2026-09-01', bal: 100, dep: 100 }];
  assert.deepEqual([...savSnaps(M, [], []).map(x => x.d)], ['2026-09-01', '2026-10-01']);
});

test('Inversiones: apuntes a mano anteriores + último saldo automático de cada mes, con aportaciones sumadas al siguiente', () => {
  const M = [{ id: 'a', d: '2026-08-01', bal: 100, dep: 100 }, { id: 'b', d: '2026-09-15', bal: 200, dep: 99 }, { id: 'c', d: '2026-10-20', bal: 999, dep: 0 }];
  const D = [{ d: '2026-10-10', bal: 210 }, { d: '2026-10-31', bal: 260 }, { d: '2026-11-02', bal: 261 }, { d: '2026-11-10', bal: 241 }];
  const T = [
    { d: '2026-09-10', amt: 99, kind: 'aporte' },   // anterior al último apunte a mano: ya contado
    { d: '2026-10-05', amt: 10, kind: 'aporte' },
    { d: '2026-10-20', amt: 50, kind: 'aporte' },
    { d: '2026-11-01', amt: 1, kind: 'interes' },   // los intereses no son aportaciones
    { d: '2026-11-05', amt: -20, kind: 'retirada' }];
  assert.deepEqual(strip(savSnaps(M, D, T)), [
    { d: '2026-08-01', bal: 100, dep: 100, auto: false },
    { d: '2026-09-15', bal: 200, dep: 99, auto: false },
    // el apunte a mano del 20/10 es posterior al primer automático: se ignora
    { d: '2026-10-31', bal: 260, dep: 60, auto: true },
    { d: '2026-11-10', bal: 241, dep: -20, auto: true }]);
});

test('Inversiones: sin apuntes a mano, el primer saldo automático cuenta como aportado', () => {
  const D = [{ d: '2026-11-01', bal: 500 }, { d: '2026-11-03', bal: 600 }, { d: '2026-12-01', bal: 602 }];
  const T = [{ d: '2026-11-03', amt: 100, kind: 'aporte' }];
  assert.deepEqual(strip(savSnaps([], D, T)), [
    { d: '2026-11-01', bal: 500, dep: 500, auto: true },
    { d: '2026-11-03', bal: 600, dep: 100, auto: true },
    { d: '2026-12-01', bal: 602, dep: 0, auto: true }]);
});
