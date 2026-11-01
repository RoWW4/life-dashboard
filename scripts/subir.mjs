// Subir el panel en un solo paso: `node scripts/subir.mjs "qué se ha cambiado"` desde la carpeta del proyecto.
// 1) trae lo nuevo de GitHub (la otra sesión) · 2) si cambió CSS o JS, sube la versión en index.html y sw.js
// 3) pasa scripts/comprobar.mjs (si falla, no sube nada) · 4) un commit con el mensaje y push a main
// 5) si cambió la app, espera a que la web publicada sirva la versión nueva y avisa si no llega.
// Con --prueba hace los pasos 1 a 3 y deshace el cambio de versión, sin commit ni push.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2), prueba = args.includes('--prueba'), msg = args.filter(a => a !== '--prueba').join(' ').trim();
const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
const fin = m => { console.log('✘ ' + m + '\nNo se ha subido nada.'); process.exit(1); };
if (!msg && !prueba) fin('Falta el mensaje: node scripts/subir.mjs "qué se ha cambiado"');

// 1) Lo nuevo de la otra sesión
git('fetch', '-q');
const detras = +git('rev-list', '--count', 'HEAD..origin/main');
if (detras) {
  try { git('pull', '--rebase', '--autostash', '-q'); console.log(`✔ Traídos ${detras} cambio(s) de GitHub`); }
  catch (e) { fin('Al traer lo de GitHub hay cambios que chocan: resolverlos a mano.\n' + (e.stdout || '') + (e.stderr || '')); }
}

const cambios = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).split('\n').filter(Boolean).map(l => l.slice(3).replace(/^"|"$/g, ''));
const pend = +git('rev-list', '--count', 'origin/main..HEAD');
if (!cambios.length && !pend) { console.log('Nada que subir.'); process.exit(0); }
if (!cambios.length) { // commit de una vez anterior que no llegó a subirse
  if (prueba) { console.log('Hay un commit sin subir; sin --prueba se sube.'); process.exit(0); }
  try { git('push', '-q', 'origin', 'HEAD:main'); } catch (e) { fin('El push ha fallado.\n' + (e.stderr || '')); }
  console.log('✔ Subido: ' + git('log', '-1', '--format=%h %s')); process.exit(0);
}
console.log('Archivos:\n  ' + cambios.join('\n  '));

// 2) Versión (solo si cambió CSS o JS)
const html0 = readFileSync('index.html', 'utf8'), sw0 = readFileSync('sw.js', 'utf8');
let v = null;
if (cambios.some(f => /\.(js|css)$/.test(f) && !f.startsWith('scripts/'))) {
  v = +sw0.match(/ldb-shell-v(\d+)/)[1] + 1;
  writeFileSync('index.html', html0.replace(/\?v=\d+/g, '?v=' + v));
  writeFileSync('sw.js', sw0.replace(/ldb-shell-v\d+/, 'ldb-shell-v' + v));
  console.log('✔ Versión v' + v);
}
const deshacer = () => { if (v) { writeFileSync('index.html', html0); writeFileSync('sw.js', sw0); } };

// 3) Comprobación
try { execFileSync(process.execPath, ['scripts/comprobar.mjs'], { stdio: 'inherit' }); }
catch (e) { deshacer(); fin('La comprobación ha fallado.'); }
if (prueba) { deshacer(); console.log('\nPrueba terminada: no se ha hecho commit ni push.'); process.exit(0); }

// 4) Commit y push
git('add', '-A');
git('commit', '-q', '-m', msg + (v ? ` (v${v})` : ''), '-m', 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>');
try { git('push', '-q', 'origin', 'HEAD:main'); }
catch (e) { fin('El commit está hecho pero el push ha fallado (¿la otra sesión acaba de subir?): repetir la orden.\n' + (e.stderr || '')); }
console.log('\n✔ Subido: ' + git('log', '-1', '--format=%h %s'));

// 5) Si cambió la app, esperar a que GitHub Pages sirva la versión nueva (hasta 5 minutos)
if (v) {
  const url = 'https://roww4.github.io/life-dashboard/sw.js';
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 15000));
    try { if ((await (await fetch(url + '?x=' + Date.now(), { cache: 'no-store' })).text()).includes('ldb-shell-v' + v + "'")) { console.log('✔ La web ya sirve la v' + v); process.exit(0); } } catch (e) {}
  }
  console.log('⚠ Subido a GitHub, pero la web aún no sirve la v' + v + ' tras 5 minutos: mirar la publicación de GitHub Pages (Actions → «pages build and deployment»).');
}
