'use strict';
/* Sección «Salud»: seguimiento por fechas de inicio y previsión del siguiente.
   Datos en S.salud = {ini:['AAAA-MM-DD',…], len:días habituales}; solo en Supabase (privado). Avisos por Telegram en scripts/task-reminders.mjs. */
const SAL_LEN = 28, SAL_DUR = 5;
/* Media de los últimos 6 intervalos razonables (15–60 días); con menos de dos fechas, la duración habitual. */
function salStats(){
  const s = S.salud || {ini:[], len:SAL_LEN}, L = [...new Set(s.ini)].sort();
  const gaps = L.slice(1).map((d,i) => dd(d, L[i])).filter(g => g >= 15 && g <= 60).slice(-6);
  const avg = gaps.length ? Math.round(gaps.reduce((a,g) => a+g, 0) / gaps.length) : (s.len || SAL_LEN);
  const last = L[L.length-1] || '', next = last ? addD(last, avg) : '';
  return {L, gaps, avg, last, next, day: last ? dd(TD(), last) + 1 : 0, len: s.len || SAL_LEN, dur: s.dur || SAL_DUR};
}
/* Días a marcar en el calendario: los apuntados y los 3 siguientes previstos, cada uno con su duración. */
function salDays(){
  const st = salStats(), M = new Map();
  if (!st.last) return M;
  const mark = (d, prev) => { for (let i=0; i<st.dur; i++) { const k = addD(d, i); if (!M.has(k) || !prev) M.set(k, prev); } };
  st.L.forEach(d => mark(d, false));
  for (let i=1; i<=3; i++) mark(addD(st.last, st.avg*i), true);
  return M;
}
/* Anillo: la parte llena es lo que ya ha pasado del ciclo; en el centro, lo que falta para el siguiente. */
function salRing(st, n){
  const R = 54, C = 2*Math.PI*R, late = n < 0, p = late ? 1 : Math.min(1, (st.day-1) / st.avg);
  const col = 'var(--er)';
  return `<div class="sring"><svg viewBox="0 0 128 128" role="img" aria-label="Días que faltan para el próximo inicio"><g transform="rotate(-90 64 64)"><circle r="${R}" cx="64" cy="64" fill="none" stroke="var(--bd)" stroke-width="12"/><circle r="${R}" cx="64" cy="64" fill="none" stroke="${col}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${(C*p).toFixed(1)} ${C.toFixed(1)}"/></g></svg>
    <div class="c">${late ? `<b class="wa">+${-n}</b><span>${-n===1 ? 'día de retraso' : 'días de retraso'}</span>` : n===0 ? `<b>Hoy</b><span>próximo previsto</span>` : `<b>${n}</b><span>${n===1 ? 'día para el próximo' : 'días para el próximo'}</span>`}</div></div>`;
}
function vSalud(){
  const st = salStats(), n = st.next ? dayDiff(st.next) : null;
  const add = `<div class="f inl" style="margin-top:12px"><input id="sa1" type="date" value="${TD()}" max="${TD()}" aria-label="Fecha de inicio"><button class="btn" data-a="sai">${I('plus')} Apuntar inicio</button></div>`;
  const C = {
    seg: panel('salud','seg',`${I('heart-pulse')} Seguimiento`, st.last
      ? `<div class="gx">${salRing(st, n)}<div class="sinf">
          <div class="mu">Próximo previsto</div><div class="big">${fd(st.next)}</div>
          <div class="mu">Día ${st.day} · empezó el ${fd(st.last)}</div>
          <div class="mu">Ciclo de ${st.avg} días · ${st.gaps.length ? 'media de los últimos '+st.gaps.length : 'duración habitual'}</div>
          <div class="mu">${I('clock','sm')} Aviso por Telegram 3 días antes.</div></div></div>
        ${add}<div class="sact"><button class="btn ghost" data-a="sah">${I('calendar-days')} Ver histórico</button><button class="link txl mu" data-a="sad" data-i="${st.last}">Quitar la última fecha (${fd(st.last)})</button></div>`
      : empty('Apunta el día de inicio para empezar a calcular el siguiente.') + add, 'wide'),
    conf: panel('salud','conf',`${I('settings')} Duración habitual`, `<div class="fs"><label>Días entre un inicio y el siguiente<input id="sa2" type="number" min="15" max="60" value="${st.len}"></label><div class="mu">Se usa mientras no haya al menos dos fechas apuntadas.</div><label>Días que se marcan en el calendario<input id="sa3" type="number" min="1" max="10" value="${st.dur}"></label></div><div class="acts"><span class="sp"></span><button class="btn ghost" data-a="sal">Guardar</button></div>`)
  };
  VIS.salud = ord('salud', ['seg','conf']);
  return `<div class="hdr"><div><h2>Salud</h2><div class="sub help">Privado: las fechas solo se guardan en tu cuenta.</div></div></div>
  <div class="grid2">${VIS.salud.map(k => C[k]).join('')}</div>`;
}
