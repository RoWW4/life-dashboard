// Prueba de la sincronización (js/nube.js) con DOS dispositivos a la vez, como pide CLAUDE.md, y con la nube caída.
// No toca la nube real: la app se abre en Chromium con un Supabase de mentira (en memoria, compartido por los dos
// dispositivos) que sustituye a la librería de supabase-js. Datos de prueba inventados. Necesita Playwright.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { createRequire } from 'node:module';

let pw = null; try { pw = createRequire(import.meta.url)('playwright'); } catch (e) {}

/* supabase-js de mentira: cada consulta se manda a window.__db (la nube en memoria, del lado de Node). */
const FAKE = `window.supabase = { createClient: () => {
  const call = q => window.__db(JSON.stringify(q)).then(r => JSON.parse(r));
  const from = table => { const q = { table, op: 'select', filters: [], order: [], limit: null, single: false, body: null };
    const b = { select(){ return b; }, eq(c, v){ q.filters.push(['eq', c, v]); return b; }, gt(c, v){ q.filters.push(['gt', c, v]); return b; },
      or(x){ q.filters.push(['or', x]); return b; }, order(c, o){ q.order.push([c, !o || o.ascending !== false]); return b; }, limit(n){ q.limit = n; return b; },
      maybeSingle(){ q.single = true; return b; }, upsert(body){ q.op = 'upsert'; q.body = body; return b; },
      then(ok, ko){ return call(q).then(ok, ko); } };
    return b; };
  const rpc = (name, args) => ({ then(ok, ko){ return call({ op: 'rpc', name, args }).then(ok, ko); } });
  return { from, rpc, auth: { getSession: async () => ({ data: { session: { user: { id: 'u1', email: 'prueba@example.com' } } } }),
    signInWithPassword: async () => ({}), signOut: async () => ({}) } };
} };`;

function cloud() {
  const db = { ldb_state: [{ user_id: 'u1', data: { tasks: [{ id: 'a', title: 'Prueba A', done: false }, { id: 'b', title: 'Prueba B', done: false }], _ts: 1 } }],
    bank_tx: [], bank_status: [], bank_pending: [], job_health: [], ops_alerts: [], health_status: [], health_daily: [] };
  const st = { db, down: false, calls: 0, delay: 0, saves: 0, conflicts: 0 };
  st.handle = async (raw, who) => {
    const q = JSON.parse(raw); st.calls++;
    if (st.delay && q.table === 'ldb_state') await new Promise(r => setTimeout(r, st.delay)); // lectura lenta: los dos leen antes de que nadie guarde
    if (st.down) return JSON.stringify({ data: null, error: { message: 'TypeError: Failed to fetch' } });
    if (q.op === 'rpc' && q.name === 'ldb_save') { // como en Supabase: solo guarda si la nube sigue en la versión leída
      const row = db.ldb_state.find(r => r.user_id === 'u1'), data = { ...q.args.p_data }; delete data._force;
      if (row ? (row.data._ts || 0) === q.args.p_base : q.args.p_base === null) { row ? (row.data = data) : db.ldb_state.push({ user_id: 'u1', data }); st.saves++; return JSON.stringify({ data: { ok: true }, error: null }); }
      st.conflicts++; return JSON.stringify({ data: { ok: false }, error: null });
    }
    const t = db[q.table] || [];
    if (q.op === 'upsert') {
      const i = t.findIndex(r => r.user_id === q.body.user_id), row = { ...q.body, data: { ...q.body.data } };
      if (row.data._force) delete row.data._force;
      i < 0 ? t.push(row) : (t[i] = row);
      return JSON.stringify({ data: null, error: null });
    }
    let rows = t.filter(r => q.filters.every(([k, c, v]) => k === 'eq' ? String(r[c]) === String(v) : k === 'gt' ? String(r[c]) > String(v) : true));
    rows = JSON.parse(JSON.stringify(rows));
    return JSON.stringify({ data: q.single ? rows[0] || null : rows, error: null });
  };
  return st;
}

test('dos dispositivos: los cambios de cada uno se juntan y nada se pierde, también con la nube caída', { skip: !pw && 'Playwright no está instalado', timeout: 90000 }, async () => {
  const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
  const srv = createServer((q, r) => { try { const p = decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html'; r.writeHead(200, { 'content-type': tipos[extname(p)] || 'application/octet-stream' });
    // Sin la comprobación de integridad del script de supabase-js, para poder poner el de mentira.
    r.end(p === 'index.html' ? readFileSync(p, 'utf8').replace(/ integrity="[^"]*"/g, '') : readFileSync(p)); } catch (e) { r.writeHead(404); r.end(); } });
  await new Promise(r => srv.listen(0, r));
  const st = cloud(), b = await pw.chromium.launch(), errs = [];
  let nDev = 0;
  const open = async () => {
    const who = 'D' + (++nDev);
    const ctx = await b.newContext(); // cada contexto = un dispositivo (su propio localStorage)
    await ctx.exposeFunction('__db', raw => st.handle(raw, who));
    // La ruta registrada la última gana: primero «nada de internet» y después la librería de mentira.
    await ctx.route(/^https:\/\//, r => r.abort()); // sin salir a internet (tiempo, festivos…)
    await ctx.route(/supabase-js@.*\/supabase\.js/, r => r.fulfill({ contentType: 'text/javascript', body: FAKE }));
    await ctx.addInitScript(() => { window.LDB_CONFIG = { supabaseUrl: 'https://prueba.invalid', supabaseAnonKey: 'clave-de-prueba' }; });
    const pg = await ctx.newPage();
    pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(`http://localhost:${srv.address().port}/index.html`);
    await pg.waitForFunction(() => typeof S !== 'undefined' && typeof cloudOK !== 'undefined' && cloudOK === true, null, { timeout: 15000 });
    return pg;
  };
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
    st.delay = 300; const c0 = st.conflicts;
    // Los dos suben a la vez (sin esperar el retraso normal de guardar) y la lectura de la nube tarda: los dos leen la
    // misma versión antes de que ninguno guarde, que es justo el caso en que antes uno pisaba al otro.
    const now = (pg, id) => pg.evaluate(id => { S.tasks.push({ id, title: 'Prueba ' + id, done: false }); S._ts = Date.now(); return push(); }, id);
    await Promise.all([now(A, 'y1'), now(B, 'y2')]);
    await idle(A); await idle(B); st.delay = 0;
    assert.ok(st.conflicts > c0, 'la nube detecta el choque');
    assert.equal(ids(), 'a,b,x1,x2,x3,x4,x5,y1,y2', 'se guardan los cambios de los dos');

    // 6) Un error no controlado (un botón que falla) queda registrado con su origen.
    await A.evaluate(() => setTimeout(() => { throw new Error('fallo de prueba'); }, 0));
    await A.waitForFunction(() => errLog().some(e => e.w === 'global' && /fallo de prueba/.test(e.m)), null, { timeout: 5000 });
    assert.deepEqual(errs.filter(m => !/fallo de prueba/.test(m)), [], 'la app no da otros errores');
  } finally { await b.close(); srv.close(); }
});
