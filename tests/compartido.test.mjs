// Piezas compartidas entre la app y los robots: que calculen lo mismo que antes y lo mismo entre ellos.
// Datos de prueba inventados (fechas al azar con semilla fija).
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { FAILMAX } from '../scripts/eb.mjs';

const { salPrevision } = vm.runInNewContext(readFileSync('js/salud-calculo.js', 'utf8') + '\n;({ salPrevision });');

// Las dos versiones antiguas, tal como estaban (la de la app usaba fechas locales; la del robot, UTC).
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addD = (s, n) => { const [y, m, d] = s.split('-').map(Number); return iso(new Date(y, m - 1, d + n)); };
const ddL = (a, b) => Math.round((new Date(a + 'T00:00') - new Date(b + 'T00:00')) / 864e5);
function antiguaApp(ini, len) {
  const L = [...new Set(ini)].sort(), gaps = L.slice(1).map((d, i) => ddL(d, L[i])).filter(g => g >= 15 && g <= 60).slice(-6);
  const avg = gaps.length ? Math.round(gaps.reduce((a, g) => a + g, 0) / gaps.length) : (len || 28);
  const last = L[L.length - 1] || ''; return { avg, last, next: last ? addD(last, avg) : '' };
}
function antiguoRobot(ini, len) {
  const DAY = 864e5, L = [...new Set(ini)].sort(), dd = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / DAY);
  const gaps = L.slice(1).map((d, i) => dd(d, L[i])).filter(g => g >= 15 && g <= 60).slice(-6);
  const avg = gaps.length ? Math.round(gaps.reduce((a, g) => a + g, 0) / gaps.length) : (len || 28);
  return { avg, next: new Date(Date.parse(L[L.length - 1]) + avg * DAY).toISOString().slice(0, 10) };
}

test('la previsión de Salud compartida da lo mismo que las dos versiones antiguas (también con cambios de hora)', () => {
  process.env.TZ = 'Europe/Madrid';
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 400; k++) {
    // Fechas alrededor de finales de marzo y octubre (cambios de hora) y del año nuevo.
    const base = Date.UTC(2024 + Math.floor(rnd() * 3), [2, 9, 11][k % 3], 10 + Math.floor(rnd() * 20));
    const n = Math.floor(rnd() * 8), ini = [];
    let t = base; for (let i = 0; i < n; i++) { ini.push(new Date(t).toISOString().slice(0, 10)); t -= (10 + Math.floor(rnd() * 50)) * 864e5; }
    if (rnd() < 0.2 && ini.length) ini.push(ini[0]); // fecha repetida
    const len = rnd() < 0.3 ? undefined : 20 + Math.floor(rnd() * 15);
    const nueva = salPrevision(ini, len), app = antiguaApp(ini, len);
    assert.deepEqual({ avg: nueva.avg, last: nueva.last, next: nueva.next }, app, JSON.stringify({ ini, len }));
    if (ini.length) assert.deepEqual({ avg: nueva.avg, next: nueva.next }, antiguoRobot(ini, len), JSON.stringify({ ini, len }));
  }
});

test('la app y los robots usan el mismo límite de fallos seguidos del banco', () => {
  const m = readFileSync('js/base.js', 'utf8').match(/const FAILMAX = (\d+)/);
  assert.ok(m, 'FAILMAX está en js/base.js');
  assert.equal(+m[1], FAILMAX);
});
