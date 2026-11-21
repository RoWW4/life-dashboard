// Al empezar una sesión: `node scripts/empezar.mjs` desde la carpeta del proyecto. Trae lo último de GitHub.
// · En el ordenador (rama main): git pull --rebase --autostash.
// · En la nube, cada sesión empieza en una rama propia (claude/… o ccr-…). Si se quedara en ella, al traer lo nuevo
//   o al subir con subir.mjs esa rama quedaría «sin subir» y acabaría como una rama más en GitHub, aunque solo se
//   consultara algo. Por eso pasa a main (si la rama no tiene nada propio), y subir.mjs sube directamente a main.
import { execFileSync } from 'node:child_process';

const git = (...a) => execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const rama = git('branch', '--show-current');
try { git('fetch', '-q', 'origin', 'main'); } catch (e) { console.log('✘ No se pudo traer lo de GitHub.\n' + (e.stderr || '')); process.exit(1); }

if (rama === 'main') {
  try { git('pull', '-q', '--rebase', '--autostash', 'origin', 'main'); } catch (e) { console.log('✘ Al traer lo de GitHub hay cambios que chocan: resolverlos a mano.\n' + (e.stderr || '')); process.exit(1); }
  console.log('✔ Al día con GitHub (' + git('log', '-1', '--format=%h %s') + ')');
  process.exit(0);
}

const propios = +git('rev-list', '--count', 'origin/main..HEAD');
if (propios) {
  console.log(`⚠ La rama «${rama}» tiene ${propios} cambio(s) que no están en main. Se queda en esta rama: súbelos con subir.mjs.`);
  process.exit(0);
}
try {
  git('checkout', '-q', '-B', 'main', 'origin/main');
  git('branch', '-q', '--set-upstream-to=origin/main', 'main');
} catch (e) { console.log('✘ No se pudo pasar a main.\n' + (e.stderr || '')); process.exit(1); }
console.log(`✔ Al día con GitHub y en main (la rama «${rama}» de esta sesión no se sube) · ` + git('log', '-1', '--format=%h %s'));
