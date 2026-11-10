// Prueba de la sincronización (js/nube.js) con DOS dispositivos a la vez, como pide CLAUDE.md, y con la nube caída.
// No toca la nube real: la app se abre en Chromium con un Supabase de mentira (tests/harness.mjs), en memoria y
// compartido por los dos dispositivos. Datos de prueba inventados. Necesita Playwright.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pw, cloud, startApp } from './harness.mjs';

test('dos dispositivos: los cambios de cada uno se juntan y nada se pierde, también con la nube caída', { skip: !pw && 'Playwright no está instalado', timeout: 90000 }, async () => {
  const st = cloud(), app = await startApp(st), { open, errs } = app;
  const ids = () => st.db.ldb_state[0].data.tasks.map(t => t.id).sort().join(',');
  const add = (pg, id) => pg.evaluate(id => { S.tasks.push({ id, title: 'Prueba ' + id, done: false }); save(); }, id);
  const idle = pg => pg.waitForFunction(() => !pushT && !pushing && /Sincronizado/.test(syncTxt), null, { timeout: 20000 });
  try {
    const A = await open(), B = await open();
    await idle(A); await idle(B); // que los dos terminen de abrir (y de guardar lo inicial) antes de empezar
    // 1) Cada dispositivo añade una tarea: la nube acaba con las dos.
    await add(A, 'x1'); await idle(A);
    await add(B, 'x2'); await idle(B);
    assert.equal(ids(), 'a,b,x1,x2');
    // 2) El primero recoge lo del segundo al volver a la app.
    await A.evaluate(() => pull()); await idle(A);
    assert.equal(await A.evaluate(() => S.tasks.map(t => t.id).sort().join(',')), 'a,b,x1,x2');

    // 3) Nube caída: el cambio se queda en el dispositivo, se avisa, queda en el registro y se reintenta solo.
    st.down = true;
    await add(A, 'x3');
    await A.waitForFunction(() => /Cambios sin subir/.test(syncTxt), null, { timeout: 10000 });
    assert.ok((await A.evaluate(() => syncErr)).includes('Failed to fetch'));
    assert.ok((await A.evaluate(() => errLog().some(e => e.w === 'nube/push'))), 'el fallo queda en el registro del dispositivo');
    // Mientras tanto, el otro dispositivo también cambia algo (se subirá cuando vuelva la nube).
    await add(B, 'x4');
    st.down = false;
    await idle(A); await B.evaluate(() => pull()); await idle(B);
    assert.equal(ids(), 'a,b,x1,x2,x3,x4', 'al volver la nube se suben los cambios de los dos, sin perder ninguno');
    assert.equal(await A.evaluate(() => syncErr), '', 'el error se borra al recuperarse');

    // 4) Si falla al abrir la app (pull), se reintenta solo y los cambios hechos sin nube se suben después.
    st.down = true;
    await A.evaluate(() => pull());
    assert.equal(await A.evaluate(() => cloudOK), false);
    await A.evaluate(() => { S.tasks.push({ id: 'x5', title: 'Prueba x5', done: false }); save(); });
    st.down = false;
    await A.waitForFunction(() => cloudOK === true && !pushT && !pushing && /Sincronizado/.test(syncTxt), null, { timeout: 20000 });
    assert.equal(ids(), 'a,b,x1,x2,x3,x4,x5');

    // 5) Los dos guardan en el mismo instante: ninguno pisa al otro (la nube rechaza el segundo y este vuelve a juntar).
    st.barrier = 2; const c0 = st.conflicts;
    // Los dos suben a la vez y la nube hace que los dos lean la misma versión antes de que ninguno guarde: justo el caso
    // en que antes uno pisaba al otro.
    const now = (pg, id) => pg.evaluate(id => { S.tasks.push({ id, title: 'Prueba ' + id, done: false }); S._ts = Date.now(); return push(); }, id);
    await Promise.all([now(A, 'y1'), now(B, 'y2')]);
    await idle(A); await idle(B);
    assert.ok(st.conflicts > c0, 'la nube detecta el choque');
    assert.equal(ids(), 'a,b,x1,x2,x3,x4,x5,y1,y2', 'se guardan los cambios de los dos');

    // 6) Un error no controlado (un botón que falla) queda registrado con su origen.
    await A.evaluate(() => setTimeout(() => { throw new Error('fallo de prueba'); }, 0));
    await A.waitForFunction(() => errLog().some(e => e.w === 'global' && /fallo de prueba/.test(e.m)), null, { timeout: 5000 });
    assert.deepEqual(errs.filter(m => !/fallo de prueba/.test(m)), [], 'la app no da otros errores');

    // 7) Cerrar sesión: con cambios sin subir (nube caída) no se cierra ni se borra nada; con la nube bien, se sube
    //    lo pendiente y se borra la copia del dispositivo.
    const out = async () => { await A.evaluate(() => { A.logout(); }); await A.click('.modal #ok, #ok'); };
    st.down = true;
    await add(A, 'z1');
    await out();
    await A.waitForFunction(() => /no se ha cerrado la sesión/.test(document.body.innerText), null, { timeout: 15000 });
    assert.equal(st.out, undefined, 'la sesión sigue abierta');
    assert.ok(await A.evaluate(() => localStorage.getItem('ldb-v1') !== null), 'los datos siguen en el dispositivo');
    await A.click('#ok');
    st.down = false;
    await out();
    await A.waitForFunction(() => document.getElementById('le') !== null, null, { timeout: 20000 }); // pantalla de entrar
    assert.equal(st.out, true);
    assert.ok(ids().includes('z1'), 'lo pendiente se subió antes de cerrar');
    assert.deepEqual(await A.evaluate(() => Object.keys(localStorage).filter(k => /^ldb-(v1|base|errlog|wx|bg)/.test(k))), [], 'no queda nada tuyo en el dispositivo');
  } finally { await app.close(); }
});
