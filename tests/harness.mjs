// Herramientas comunes de las pruebas de la app: abre el panel en Chromium con un Supabase de mentira (en memoria)
// que sustituye a supabase-js. No toca la nube real ni sale a internet. Datos de prueba inventados.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { createRequire } from 'node:module';

export let pw = null; try { pw = createRequire(import.meta.url)("playwright"); } catch (e) {}

/* supabase-js de mentira: cada consulta se manda a window.__db (la nube en memoria, del lado de Node). */
export const FAKE = `window.supabase = { createClient: () => {
  const call = q => window.__db(JSON.stringify(q)).then(r => JSON.parse(r));
  const from = table => { const q = { table, op: 'select', filters: [], order: [], limit: null, single: false, body: null };
    const b = { select(){ return b; }, eq(c, v){ q.filters.push(['eq', c, v]); return b; }, gt(c, v){ q.filters.push(['gt', c, v]); return b; },
      or(x){ q.filters.push(['or', x]); return b; }, order(c, o){ q.order.push([c, !o || o.ascending !== false]); return b; }, limit(n){ q.limit = n; return b; },
      maybeSingle(){ q.single = true; return b; }, upsert(body){ q.op = 'upsert'; q.body = body; return b; },
      then(ok, ko){ return call(q).then(ok, ko); } };
    return b; };
  const rpc = (name, args) => ({ then(ok, ko){ return call({ op: 'rpc', name, args }).then(ok, ko); } });
  return { from, rpc, auth: { getSession: () => call({ op: 'session' }), signInWithPassword: async () => ({}), signOut: () => call({ op: 'signout' }) } };
} };`;

export function cloud() {
  const db = { ldb_state: [{ user_id: 'u1', data: { tasks: [{ id: 'a', title: 'Prueba A', done: false }, { id: 'b', title: 'Prueba B', done: false }], _ts: 1 } }],
    bank_tx: [], bank_status: [], bank_pending: [], job_health: [], ops_alerts: [], health_status: [], health_daily: [] };
  const st = { db, down: false, calls: 0, barrier: 0, saves: 0, conflicts: 0 };
  st.handle = async (raw, who) => {
    const q = JSON.parse(raw); st.calls++;
    // Choque forzado: con st.barrier = n, las lecturas del panel esperan a que lleguen n (o 5 s), así todos leen la
    // misma versión antes de que nadie guarde.
    if (st.barrier && q.table === 'ldb_state' && q.op === 'select') await new Promise(r => {
      (st.waiting = st.waiting || []).push(r);
      if (st.waiting.length >= st.barrier) { st.waiting.forEach(f => f()); st.waiting = []; st.barrier = 0; }
      else setTimeout(r, 5000);
    });
    if (st.down) return JSON.stringify({ data: null, error: { message: 'TypeError: Failed to fetch' } });
    if (q.op === 'session') return JSON.stringify({ data: { session: st.out ? null : { user: { id: 'u1', email: 'prueba@example.com' } } } });
    if (q.op === 'signout') { st.out = true; return JSON.stringify({ error: null }); }
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


const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg' };

/* Sirve la app y abre «dispositivos» (cada uno con su propio almacenamiento). extra(ctx) permite añadir rutas de mentira. */
export async function startApp(st, { extra } = {}) {
  const srv = createServer((q, r) => { try { const p = decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html'; r.writeHead(200, { 'content-type': tipos[extname(p)] || 'application/octet-stream' });
    // Sin la comprobación de integridad del script de supabase-js, para poder poner el de mentira.
    r.end(p === 'index.html' ? readFileSync(p, 'utf8').replace(/ integrity="[^"]*"/g, '') : readFileSync(p)); } catch (e) { r.writeHead(404); r.end(); } });
  await new Promise(r => srv.listen(0, r));
  const b = await pw.chromium.launch(), errs = [];
  let nDev = 0;
  const open = async () => {
    const who = 'D' + (++nDev);
    const ctx = await b.newContext();
    await ctx.exposeFunction('__db', raw => st.handle(raw, who));
    // La ruta registrada la última gana: primero «nada de internet» y después las librerías de mentira.
    await ctx.route(/^https:\/\//, r => r.abort());
    await ctx.route(/supabase-js@.*\/supabase\.js/, r => r.fulfill({ contentType: 'text/javascript', body: FAKE }));
    if (extra) await extra(ctx);
    const pg = await ctx.newPage();
    pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(`http://localhost:${srv.address().port}/index.html`);
    await pg.waitForFunction(() => typeof S !== 'undefined' && typeof cloudOK !== 'undefined' && cloudOK === true, null, { timeout: 15000 });
    return pg;
  };
  return { open, errs, close: async () => { await b.close(); srv.close(); } };
}
