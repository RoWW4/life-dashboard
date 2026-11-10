'use strict';
/* Previsión de la sección Salud. La usan la app (js/vistas/salud.js) y el robot de avisos (scripts/task-reminders.mjs),
   para que los dos calculen siempre lo mismo. Sin dependencias: fechas 'AAAA-MM-DD' contadas en días UTC (los cambios
   de hora no afectan). Media de los últimos 6 intervalos razonables (15–60 días); con menos de dos fechas, la duración habitual. */
const SAL_LEN = 28,
  SAL_DUR = 5;
function salPrevision(ini, len) {
  const day = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 864e5;
  const L = [...new Set(ini || [])].sort();
  const gaps = L.slice(1)
    .map((d, i) => Math.round(day(d) - day(L[i])))
    .filter(g => g >= 15 && g <= 60)
    .slice(-6);
  const avg = gaps.length ? Math.round(gaps.reduce((a, g) => a + g, 0) / gaps.length) : len || SAL_LEN;
  const last = L[L.length - 1] || '',
    next = last ? new Date((day(last) + avg) * 864e5).toISOString().slice(0, 10) : '';
  return { L, gaps, avg, last, next };
}
