// Restaurar una copia (Ajustes → Copias de seguridad): la copia diaria de Google Drive (scripts/copia-drive.gs) y la
// exportada desde el panel se leen bien y acaban en la nube; un archivo que no es una copia no cambia nada.
// No toca la nube real: Supabase de mentira (tests/harness.mjs) y datos de prueba inventados. Necesita Playwright.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pw, cloud, startApp } from './harness.mjs';

const panel = { tasks: [{ id: 'c1', title: 'Prueba copia 1', done: false }, { id: 'c2', title: 'Prueba copia 2', done: true }, { id: 'c3', title: 'Prueba copia 3', done: false }],
  shop: [{ id: 's1', name: 'Producto de prueba', qty: 2, done: false }], _ts: 5 };
// Mismo formato que guarda copia-drive.gs: el panel va dentro de ldb_state[0].data, con las tablas de apoyo al lado.
const drive = { copia: '2026-11-21T02:41:58.000Z', ldb_state: [{ updated_at: '2026-11-21T02:41:00Z', data: panel }], errores: {}, bank_tx: [] };

test('restaurar copia: la de Drive y la exportada se restauran; un archivo que no vale no cambia nada', { skip: !pw && 'Playwright no está instalado', timeout: 90000 }, async () => {
  const st = cloud(), app = await startApp(st), { open, errs } = app;
  const ids = () => st.db.ldb_state[0].data.tasks.map(t => t.id).sort().join(',');
  const idle = pg => pg.waitForFunction(() => !pushT && !pushing && /Sincronizado/.test(syncTxt), null, { timeout: 20000 });
  const pick = async (pg, name, obj) => {
    await pg.evaluate(() => A.go('ajus'));
    await pg.setInputFiles('#im', { name, mimeType: 'application/json', buffer: Buffer.from(typeof obj === 'string' ? obj : JSON.stringify(obj)) });
  };
  try {
    const A = await open();
    await idle(A);
    assert.equal(ids(), 'a,b');

    // 1) Copia de Drive: el panel pasa a ser el de la copia, en el dispositivo y en la nube.
    await pick(A, 'panel-2026-11-21.json', drive);
    await A.waitForFunction(() => S.tasks.length === 3, null, { timeout: 10000 });
    await idle(A);
    assert.equal(ids(), 'c1,c2,c3');
    assert.equal(st.db.ldb_state[0].data.shop.length, 1);

    // 2) Un archivo que no es una copia: aviso y nada cambia.
    await pick(A, 'otro.json', { hola: 1 });
    await A.waitForFunction(() => /Archivo no válido/.test(document.body.innerText), null, { timeout: 5000 });
    await pick(A, 'roto.json', '{esto no es json');
    await A.waitForTimeout(500);
    assert.equal(await A.evaluate(() => S.tasks.length), 3);
    assert.equal(ids(), 'c1,c2,c3');

    // 3) Copia exportada desde el panel (el panel tal cual, sin envoltorio).
    await pick(A, 'exportada.json', { ...panel, tasks: panel.tasks.slice(0, 2) });
    await A.waitForFunction(() => S.tasks.length === 2, null, { timeout: 10000 });
    await idle(A);
    assert.equal(ids(), 'c1,c2');

    // 4) Otro dispositivo recoge lo restaurado al abrir.
    const B = await open();
    await idle(B);
    assert.equal(await B.evaluate(() => S.tasks.map(t => t.id).sort().join(',')), 'c1,c2');
    assert.deepEqual(errs, []);
  } finally {
    await app.close();
  }
});
