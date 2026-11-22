// Dinero retenido por el banco sin detalle (heldUpd en js/nube.js), con DOS dispositivos a la vez y un Supabase de
// mentira (tests/harness.mjs). Datos de prueba inventados. Necesita Playwright.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pw, cloud, startApp } from './harness.mjs';

test('retenido: aparece cuando el saldo baja sin movimiento y se va cuando el banco lo cobra', { skip: !pw && 'Playwright no está instalado', timeout: 90000 }, async () => {
  const st = cloud();
  const conn = { user_id: 'u1', id: 'openbank', purpose: 'gastos', session_id: 's', balance: '500.00', last_sync: '2026-11-20T10:00:05Z', balance_at: '2026-11-20T10:00:00Z' };
  st.db.bank_connections.push(conn);
  const app = await startApp(st), { open, errs } = app;
  const idle = pg => pg.waitForFunction(() => !pushT && !pushing && /Sincronizado/.test(syncTxt), null, { timeout: 20000 });
  const held = pg => pg.evaluate(async () => { await pullBank(); return { h: HELD, p: pendList().filter(p => p.id === 'held').map(p => p.amount) }; });
  try {
    const A = await open(), B = await open();
    await idle(A); await idle(B);
    // 1) Primera vez: el saldo de ahora es la referencia y no hay nada retenido.
    assert.deepEqual(await held(A), { h: 0, p: [] });
    await idle(A);
    assert.deepEqual(st.db.ldb_state[0].data.held, { b: 500, at: '2026-11-20T10:00:05Z' });
    // 2) El saldo baja 30 sin que llegue ningún movimiento: 30 retenidos, en los dos dispositivos.
    Object.assign(conn, { balance: '470.00', last_sync: '2026-11-21T10:00:05Z' });
    await B.evaluate(() => pull()); await idle(B);
    assert.deepEqual(await held(B), { h: -30, p: [-30] });
    assert.deepEqual(await held(A), { h: -30, p: [-30] });
    // 3) Llega otro gasto ya cobrado (−20) y el saldo baja lo mismo: sigue habiendo solo 30 retenidos.
    st.db.bank_tx.push({ user_id: 'u1', conn: 'openbank', id: 'g1', booking_date: '2026-11-22', amount: '-20.00', description: 'Tienda', created_at: '2026-11-22T10:00:01Z' });
    Object.assign(conn, { balance: '450.00', last_sync: '2026-11-22T10:00:05Z' });
    assert.deepEqual(await held(A), { h: -30, p: [-30] });
    // 4) El banco cobra la retención: llega el movimiento (−30) y el saldo no cambia. Ya no hay nada retenido y la
    //    referencia pasa al saldo de ahora.
    st.db.bank_tx.push({ user_id: 'u1', conn: 'openbank', id: 'g2', booking_date: '2026-11-23', amount: '-30.00', description: 'Compra', created_at: '2026-11-23T10:00:01Z' });
    Object.assign(conn, { last_sync: '2026-11-23T10:00:05Z' });
    assert.deepEqual(await held(A), { h: 0, p: [] });
    await idle(A);
    assert.deepEqual(st.db.ldb_state[0].data.held, { b: 450, at: '2026-11-23T10:00:05Z' });
    await B.evaluate(() => pull()); await idle(B);
    assert.deepEqual(await held(B), { h: 0, p: [] });
    assert.deepEqual(await B.evaluate(() => S.held), { b: 450, at: '2026-11-23T10:00:05Z' });
    // 5) Un ingreso que el banco ya suma al saldo pero aún no manda (+100): no se enseña nada y la referencia no se mueve;
    //    cuando llega el movimiento, cuadra otra vez.
    Object.assign(conn, { balance: '550.00', last_sync: '2026-11-24T10:00:05Z' });
    assert.deepEqual(await held(A), { h: 0, p: [] });
    assert.deepEqual(await A.evaluate(() => S.held), { b: 450, at: '2026-11-23T10:00:05Z' });
    st.db.bank_tx.push({ user_id: 'u1', conn: 'openbank', id: 'i1', booking_date: '2026-11-25', amount: '100.00', description: 'Ingreso', created_at: '2026-11-25T10:00:01Z' });
    Object.assign(conn, { last_sync: '2026-11-25T10:00:05Z' });
    assert.deepEqual(await held(A), { h: 0, p: [] });
    assert.deepEqual(await A.evaluate(() => S.held), { b: 550, at: '2026-11-25T10:00:05Z' });
    assert.deepEqual(errs, []);
  } finally { await app.close(); }
});
