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
  const col = 'var(--rose)';
  return `<div class="sring"><svg viewBox="0 0 128 128" role="img" aria-label="Días que faltan para el próximo inicio"><g transform="rotate(-90 64 64)"><circle r="${R}" cx="64" cy="64" fill="none" stroke="var(--roses)" stroke-width="12"/><circle r="${R}" cx="64" cy="64" fill="none" stroke="${col}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${(C*p).toFixed(1)} ${C.toFixed(1)}"/></g></svg>
    <div class="c">${late ? `<b class="wa">+${-n}</b><span>${-n===1 ? 'Día de retraso' : 'Días de retraso'}</span>` : n===0 ? `<b>Hoy</b><span>Próximo previsto</span>` : `<b>${n}</b><span>${n===1 ? 'Día para el próximo' : 'Días para el próximo'}</span>`}</div></div>`;
}
/* ---------- Actividad (Google Health) ----------
   Un Google Apps Script de la cuenta de Google (scripts/google-health.gs) deja cada hora en Supabase los pasos, kcal,
   sueño y pulso en reposo de los últimos días (tabla health_daily) y su estado y dirección de «sincronizar ahora» (health_status).
   Aquí solo se leen; no se guardan en S. */
let HL = null, HLS = null, hlT = 0;
const HL_OLD = 30*60*1000;
async function hlLoad(){
  if (!sb || !user) return;
  const [a, b] = await Promise.all([
    sb.from('health_daily').select('day,steps,kcal,sleep_min,rhr,awake_min,light_min,deep_min,rem_min,bed_at,wake_at').gte('day', addD(TD(), -13)).order('day'),
    sb.from('health_status').select('last_sync,last_error,sync_url').eq('user_id', user.id).maybeSingle()]);
  HL = a.error ? (HL || []) : (a.data || []);
  if (!b.error) HLS = b.data || null;
  hlT = Date.now();
}
const hlPaint = () => { const e = document.getElementById('hlbox'); if (e) e.innerHTML = hlHTML(); };
/* Al abrir Salud: trae los datos (como mucho una vez por minuto) y, si la última sincronización es vieja, pide otra. */
function hlOpen(){
  if (!sb || !user || Date.now() - hlT < 60000) return;
  hlT = Date.now();
  hlLoad().then(() => { hlPaint(); if (HLS && HLS.sync_url && (!HLS.last_sync || Date.now() - new Date(HLS.last_sync) > HL_OLD)) hlSync(false); }).catch(() => {});
}
/* Avisa al script de Google para que sincronice ya y espera (hasta ~1 min) a que cambie la hora de la última sincronización. */
async function hlSync(manual){
  if (hlSync.on) return;
  if (!HLS || !HLS.sync_url) { if (manual) toast('Falta instalar el programa de Google Health'); return; }
  hlSync.on = 1; hlPaint();
  const antes = HLS.last_sync;
  try {
    await fetch(HLS.sync_url, {mode:'no-cors'}).catch(() => {});
    for (let i = 0; i < 12; i++) { await new Promise(r => setTimeout(r, 5000)); await hlLoad(); if (HLS && HLS.last_sync !== antes) break; }
    if (manual) toast(HLS && HLS.last_sync !== antes ? (HLS.last_error ? 'Sincronizado con avisos' : 'Datos de salud al día') : 'Google Health no ha respondido; prueba más tarde');
  } finally { hlSync.on = 0; hlPaint(); }
}
const hlH = m => m == null ? '—' : Math.floor(m/60) + ' h ' + String(m%60).padStart(2,'0');
const hlN = n => n == null ? '—' : Math.round(n).toLocaleString('es-ES');
const hlHM = t => t ? new Date(t).toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'}) : '';
/* Última noche: hora de dormirse → despertar y barra con el reparto de fases (despierta, REM, ligero, profundo). */
function hlNoche(r){
  if (!r) return '';
  const F = [['awake_min','Despierta','aw'],['rem_min','REM','rem'],['light_min','Ligero','li'],['deep_min','Profundo','de']].filter(([k]) => r[k] != null);
  const tot = F.reduce((a,[k]) => a + r[k], 0), hrs = r.bed_at && r.wake_at ? `${I('moon','sm')} ${hlHM(r.bed_at)} → ${hlHM(r.wake_at)}` : '';
  if (!tot && !hrs) return '';
  return `<div class="hln"><div class="hlnh"><b>Última noche</b><span class="mu">${hrs}</span></div>`
    + (tot ? `<div class="hlst" role="img" aria-label="Fases del sueño">${F.map(([k,n,c]) => r[k] ? `<i class="${c}" style="flex:${r[k]}" title="${n}: ${hlH(r[k])}"></i>` : '').join('')}</div>
      <div class="hlleg">${F.map(([k,n,c]) => `<span><i class="${c}"></i>${n} <b>${hlH(r[k])}</b> <small>${Math.round(r[k]/tot*100)} %</small></span>`).join('')}</div>` : '')
    + `</div>`;
}
function hlHTML(){
  if (!sb || !user) return empty('Inicia sesión para ver los datos de Google Health.');
  if (HL === null) return `<div class="mu">Cargando…</div>`;
  const by = Object.fromEntries(HL.map(r => [r.day, r])), td = TD(), hoy = by[td] || {};
  const sleepDay = by[td] && by[td].sleep_min != null ? td : addD(td, -1), sl = (by[sleepDay] || {}).sleep_min;
  const rhrRow = [...HL].reverse().find(r => r.rhr != null);
  const kpi = (ic, k, v, s) => `<div class="hlk"><span class="k">${I(ic,'sm')}${k}</span><b>${v}</b>${s ? `<small>${s}</small>` : ''}</div>`;
  // Barras de los últimos 7 días: altura según los pasos; debajo, horas de sueño.
  const days = [...Array(7)].map((_,i) => addD(td, i-6)), mx = Math.max(1, ...days.map(d => (by[d]||{}).steps || 0));
  const wd = new Intl.DateTimeFormat('es-ES', {weekday:'short'});
  const bars = days.map(d => { const r = by[d] || {}, h = r.steps ? Math.max(4, Math.round(r.steps/mx*100)) : 0;
    return `<div class="hlb${d===td?' on':''}" title="${fd(d)} · ${hlN(r.steps)} pasos · ${hlN(r.kcal)} kcal · sueño ${hlH(r.sleep_min)}"><small>${r.steps ? (r.steps >= 1000 ? (r.steps/1000).toFixed(1).replace('.',',') + 'k' : r.steps) : ''}</small><div class="tr"><i style="height:${h}%"></i></div><em>${d===td ? 'hoy' : wd.format(new Date(d+'T12:00')).replace('.','')}</em><span>${r.sleep_min != null ? (r.sleep_min/60).toFixed(1).replace('.',',') + ' h' : '·'}</span></div>`; }).join('');
  const st = HLS ? (hlSync.on ? 'Sincronizando…' : 'Actualizado ' + ago(HLS.last_sync)) : 'Aún no se ha sincronizado nunca';
  return (HL.length ? `<div class="hlg">${kpi('footprints','Pasos hoy',hlN(hoy.steps))}${kpi('flame','Kcal hoy',hlN(hoy.kcal))}${kpi('moon','Sueño',hlH(sl), sleepDay===td ? 'Anoche' : 'Noche anterior')}${kpi('heart-pulse','Pulso en reposo', rhrRow ? rhrRow.rhr + ' ppm' : '—', rhrRow && rhrRow.day !== td ? fd(rhrRow.day) : '')}</div>
    ${hlNoche(by[sleepDay])}
    <div class="hlbars" role="img" aria-label="Pasos y horas de sueño de los últimos 7 días">${bars}</div>`
    : empty(HLS ? 'Google Health todavía no ha mandado datos.' : 'Cuando el programa de Google Health esté instalado, aquí saldrán tus pasos, kcal y sueño.'))
    + (HLS && HLS.last_error ? `<div class="mu wa" style="margin-top:8px">${I('triangle-alert','sm')} ${esc(HLS.last_error)}</div>` : '')
    + `<div class="sact"><span class="mu">${I('clock','sm')} ${st}</span><button class="btn ghost" data-a="hls" ${hlSync.on ? 'disabled' : ''}>${I('refresh-cw')} Sincronizar ahora</button></div>`;
}
function vSalud(){
  setTimeout(hlOpen);
  const st = salStats(), n = st.next ? dayDiff(st.next) : null;
  const add = `<div class="f inl" style="margin-top:12px"><input id="sa1" type="date" value="${TD()}" max="${TD()}" aria-label="Fecha de inicio"><button class="btn" data-a="sai">${I('plus')} Apuntar inicio</button></div>`;
  const C = {
    act: panel('salud','act',`${I('footprints')} Actividad y sueño`, `<div id="hlbox">${hlHTML()}</div>`, 'wide'),
    seg: panel('salud','seg',`${I('heart-pulse')} Seguimiento`, st.last
      ? `<div class="gx">${salRing(st, n)}<div class="sinf">
          <div class="mu">Próximo previsto</div><div class="big">${fd(st.next)}</div>
          <div class="mu">Día ${st.day} · Empezó el ${fd(st.last)}</div>
          <div class="mu">Ciclo de ${st.avg} días · ${st.gaps.length ? 'Media de los últimos '+st.gaps.length : 'duración habitual'}</div>
          <div class="mu">${I('clock','sm')} Aviso por Telegram 3 días antes.</div></div></div>
        ${add}<div class="sact"><button class="btn ghost" data-a="sah">${I('calendar-days')} Ver histórico</button><button class="link txl mu" data-a="sad" data-i="${st.last}">Quitar la última fecha (${fd(st.last)})</button></div>`
      : empty('Apunta el día de inicio para empezar a calcular el siguiente.') + add, 'wide'),
    conf: panel('salud','conf',`${I('settings')} Duración habitual`, `<div class="fs"><label>Días entre un inicio y el siguiente<input id="sa2" type="number" min="15" max="60" value="${st.len}"></label><div class="mu">Se usa mientras no haya al menos dos fechas apuntadas.</div><label>Días que se marcan en el calendario<input id="sa3" type="number" min="1" max="10" value="${st.dur}"></label></div><div class="acts"><span class="sp"></span><button class="btn ghost" data-a="sal">Guardar</button></div>`, 'wide')
  };
  VIS.salud = ord('salud', ['act','seg','conf']);
  return `<div class="hdr"><div><h2>Salud</h2><div class="sub help">Privado: los datos solo se guardan en tu cuenta.</div></div></div>
  <div class="grid2">${VIS.salud.map(k => C[k]).join('')}</div>`;
}
