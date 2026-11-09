// Comprobación antes de subir una versión: `node scripts/comprobar.mjs` desde la carpeta del proyecto.
// 1) sintaxis de todos los .js · 2) mismo número de versión en index.html y sw.js · 3) cada archivo cargado está en SHELL de sw.js
// 4) la app abre en Chromium sin errores y la parte de juntar cambios (merge3) responde bien.
// Sale con código 1 si algo falla. No toca datos: no inicia sesión ni sube nada.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { join, extname } from 'node:path';
import { createRequire } from 'node:module';

const fallos = [], ok = m => console.log('✔ ' + m), mal = m => { fallos.push(m); console.log('✘ ' + m); };
const js = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? js(p) : p.endsWith('.js') ? [p] : []; });

// 1) Sintaxis
const archivos = ['icons.js', 'config.js', 'sw.js', ...js('js')];
for (const f of archivos) { try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); } catch (e) { mal('Sintaxis: ' + f + '\n' + e.stderr); } }
if (!fallos.length) ok(`Sintaxis correcta en ${archivos.length} archivos`);

// 2) Versión
const html = readFileSync('index.html', 'utf8'), sw = readFileSync('sw.js', 'utf8');
const vs = [...new Set([...html.matchAll(/\?v=(\d+)/g)].map(m => m[1]))], vsw = (sw.match(/ldb-shell-v(\d+)/) || [])[1];
if (vs.length !== 1) mal('index.html mezcla versiones: ' + vs.join(', '));
else if (vs[0] !== vsw) mal(`Versión distinta: index.html v${vs[0]} y sw.js v${vsw}`);
else ok('Versión v' + vsw + ' igual en index.html y sw.js');

// 3) SHELL
const cargados = [...html.matchAll(/src="(?!https?:)([^"?]+)/g)].map(m => m[1]), shell = sw.match(/SHELL\s*=\s*\[([^\]]*)\]/)[1];
const faltan = cargados.filter(f => !shell.includes(`'${f}'`));
faltan.length ? mal('Faltan en SHELL de sw.js: ' + faltan.join(', ')) : ok('Todos los archivos cargados están en SHELL');

// 3b) Pruebas de los robots (tests/*.test.mjs, sin conexión)
const pruebas = readdirSync('tests').filter(f => f.endsWith('.test.mjs')).map(f => join('tests', f));
if (pruebas.length) { try { execFileSync(process.execPath, ['--test', ...pruebas], { stdio: 'pipe' }); ok(`Pruebas de los robots correctas (${pruebas.length} archivo/s)`); } catch (e) { mal('Pruebas de los robots:\n' + String(e.stdout || '').split('\n').filter(l => /^not ok|^# fail|Error/.test(l)).join('\n')); } }

// 4) La app abre sin errores
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const srv = createServer((q, r) => { try { const p = decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html'; r.writeHead(200, { 'content-type': tipos[extname(p)] || 'application/octet-stream' }); r.end(readFileSync(p)); } catch (e) { r.writeHead(404); r.end(); } });
await new Promise(r => srv.listen(0, r));
try {
  let pw; try { pw = createRequire(import.meta.url)('playwright'); } catch (e) { pw = null; }
  if (!pw) throw Object.assign(new Error('Playwright no está instalado en este equipo'), { aviso: true });
  const { chromium } = pw;
  const b = await chromium.launch(), pg = await b.newPage(), errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(`http://localhost:${srv.address().port}/index.html`); await pg.waitForTimeout(1500);
  const r = await pg.evaluate(() => {
    const base = { tasks: [{ id: 'a', t: 1 }, { id: 'b', t: 1 }] }, mine = { tasks: [{ id: 'a', t: 2 }, { id: 'b', t: 1 }, { id: 'c', t: 1 }] }, theirs = { tasks: [{ id: 'a', t: 1 }, { id: 'b', t: 3 }] };
    const m = merge3(base, mine, theirs).tasks.map(x => x.id + x.t).join(',');
    return { m, render: typeof render, merge: typeof merge3 };
  });
  await b.close();
  errs.length ? mal('Errores al abrir la app: ' + errs.join(' | ')) : ok('La app abre sin errores');
  r.m === 'a2,b3,c1' ? ok('Juntar cambios de dos dispositivos funciona') : mal('merge3 da ' + r.m + ' (esperado a2,b3,c1)');
} catch (e) { e.aviso ? console.log('⚠ ' + e.message + ': abrir la app a mano y mirar que carga bien antes de subir') : mal('No se pudo abrir la app en Chromium: ' + e.message); }
srv.close();

console.log(fallos.length ? `\n${fallos.length} fallo(s): NO subir.` : '\nTodo bien: se puede subir.');
process.exit(fallos.length ? 1 : 0);
