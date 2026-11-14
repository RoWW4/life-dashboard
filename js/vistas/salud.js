'use strict';
/* Sección «Salud»: seguimiento por fechas de inicio y previsión del siguiente.
   Datos en S.salud = {ini:['AAAA-MM-DD',…], len:días habituales}; solo en Supabase (privado). Avisos por Telegram en scripts/task-reminders.mjs. */
/* La previsión (salPrevision, SAL_LEN, SAL_DUR) está en js/salud-calculo.js, compartida con el robot de avisos. */
function salStats() {
  const s = S.salud || { ini: [], len: SAL_LEN },
    p = salPrevision(s.ini, s.len);
  return { ...p, day: p.last ? dd(TD(), p.last) + 1 : 0, len: s.len || SAL_LEN, dur: s.dur || SAL_DUR };
}
/* Días a marcar en el calendario: los apuntados y los 3 siguientes previstos, cada uno con su duración. */
function salDays() {
  const st = salStats(),
    M = new Map();
  if (!st.last) return M;
  const mark = (d, prev) => {
    for (let i = 0; i < st.dur; i++) {
      const k = addD(d, i);
      if (!M.has(k) || !prev) M.set(k, prev);
    }
  };
  st.L.forEach(d => mark(d, false));
  for (let i = 1; i <= 3; i++) mark(addD(st.last, st.avg * i), true);
  return M;
}
/* Anillo: la parte llena es lo que ya ha pasado del ciclo; en el centro, lo que falta para el siguiente. */
function salRing(st, n) {
  const R = 54,
    C = 2 * Math.PI * R,
    late = n < 0,
    p = late ? 1 : Math.min(1, (st.day - 1) / st.avg);
  const col = 'var(--rose)';
  return `<div class="sring"><svg viewBox="0 0 128 128" role="img" aria-label="Días que faltan para el próximo inicio"><g transform="rotate(-90 64 64)"><circle r="${R}" cx="64" cy="64" fill="none" stroke="var(--roses)" stroke-width="12"/><circle r="${R}" cx="64" cy="64" fill="none" stroke="${col}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${(C * p).toFixed(1)} ${C.toFixed(1)}"/></g></svg>
    <div class="c">${late ? `<b class="wa">+${-n}</b><span>${-n === 1 ? 'Día de retraso' : 'Días de retraso'}</span>` : n === 0 ? `<b>Hoy</b><span>Próximo previsto</span>` : `<b>${n}</b><span>${n === 1 ? 'Día para el próximo' : 'Días para el próximo'}</span>`}</div></div>`;
}
/* ---------- Actividad (Google Health) ----------
   Un Google Apps Script de la cuenta de Google (scripts/google-health.gs) deja cada hora en Supabase los pasos, kcal,
   sueño y pulso en reposo de los últimos días (tabla health_daily) y su estado y dirección de «sincronizar ahora» (health_status).
   Aquí solo se leen; no se guardan en S. */
let HL = null,
  HLS = null,
  hlT = 0;
const HL_OLD = 30 * 60 * 1000;
async function hlLoad() {
  if (!sb || !user) return;
  const [a, b] = await Promise.all([
    sb
      .from('health_daily')
      .select('day,steps,kcal,sleep_min,rhr,awake_min,light_min,deep_min,rem_min,bed_at,wake_at')
      .gte('day', addD(TD(), -13))
      .order('day'),
    sb.from('health_status').select('last_sync,last_error,sync_url').eq('user_id', user.id).maybeSingle()
  ]);
  HL = a.error ? HL || [] : a.data || [];
  if (!b.error) HLS = b.data || null;
  hlT = Date.now();
}
const hlPaint = () => {
  const e = document.getElementById('hlbox');
  if (e) e.innerHTML = hlHTML();
};
/* Al abrir Salud: trae los datos (como mucho una vez por minuto) y, si la última sincronización es vieja, pide otra. */
function hlOpen() {
  if (!sb || !user || Date.now() - hlT < 60000) return;
  hlT = Date.now();
  hlLoad()
    .then(() => {
      hlPaint();
      if (HLS && HLS.sync_url && (!HLS.last_sync || Date.now() - new Date(HLS.last_sync) > HL_OLD)) hlSync(false);
    })
    .catch(e => logErr('salud', e));
}
/* Avisa al script de Google para que sincronice ya y espera (hasta ~1 min) a que cambie la hora de la última sincronización. */
async function hlSync(manual) {
  if (hlSync.on) return;
  if (!HLS || !HLS.sync_url) {
    if (manual) toast('Falta instalar el programa de Google Health');
    return;
  }
  hlSync.on = 1;
  hlPaint();
  const antes = HLS.last_sync,
    errAntes = HLS.last_error;
  try {
    // La llamada va sin CORS (no se puede leer la respuesta): el resultado se sabe por health_status (hora o error nuevos).
    let red = '';
    await fetch(HLS.sync_url, { mode: 'no-cors' }).catch(e => {
      red = e.message || 'sin conexión';
      logErr('salud', e);
    });
    for (let i = 0; i < 12 && !red; i++) {
      await new Promise(r => setTimeout(r, 5000));
      await hlLoad();
      if (HLS && (HLS.last_sync !== antes || HLS.last_error !== errAntes)) break;
    }
    if (manual)
      toast(
        red
          ? 'No se pudo llamar a Google Health: ' + red
          : HLS && HLS.last_sync !== antes
            ? HLS.last_error
              ? 'Sincronizado con avisos: ' + String(HLS.last_error).slice(0, 90)
              : 'Datos de salud al día'
            : HLS && HLS.last_error && HLS.last_error !== errAntes
              ? String(HLS.last_error).slice(0, 120)
              : 'Google Health no ha respondido; prueba más tarde'
      );
  } finally {
    hlSync.on = 0;
    hlPaint();
  }
}
const hlH = m => (m == null ? '—' : Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0'));
const hlN = n => (n == null ? '—' : Math.round(n).toLocaleString('es-ES', { useGrouping: 'always' }));
const hlD = m => (m == null ? '—' : `${Math.floor(m / 60)}<small>h</small> ${String(m % 60).padStart(2, '0')}<small>min</small>`);
const hlHM = t => (t ? new Date(t).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '');
/* Objetivos para las barras de progreso: los pone Rocío (se guardan en S.salud); si no, 10.000 pasos y 8 h. */
const hlMeta = () => ({ pasos: (S.salud || {}).pasos || 10000, sueno: (S.salud || {}).sueno || 8 * 60 });
const hlHm = m => (m % 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}` : `${m / 60} h`);
/* Colores: cada dato y cada fase del sueño tiene el suyo (se usan como --c en las piezas). */
const HLC = { pasos: '#34d399', kcal: '#fb923c', sueno: '#a78bfa', pulso: '#f472b6' };
const HLF = [
  ['awake_min', 'Despierta', '#fbbf24'],
  ['rem_min', 'REM', '#38bdf8'],
  ['light_min', 'Ligero', '#818cf8'],
  ['deep_min', 'Profundo', '#4f46e5']
];
/* Tarjeta de un dato: icono de color, valor grande y, si hay objetivo, barra de progreso. */
function hlKpi(c, ic, k, v, sub, pct) {
  return (
    `<div class="hlk" style="--c:${c}"><div class="hlkt"><span class="hico">${I(ic)}</span><span class="k">${k}</span></div><b>${v}</b>` +
    (pct != null
      ? `<div class="hlp" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${Math.min(100, Math.max(2, pct)).toFixed(0)}%"></i></div>`
      : '') +
    (sub ? `<small>${sub}</small>` : '') +
    `</div>`
  );
}
/* Última noche: hora de dormirse → despertar, barra con el reparto de fases y una ficha por fase. */
function hlNoche(r) {
  if (!r) return '';
  const F = HLF.filter(([k]) => r[k] != null),
    tot = F.reduce((a, [k]) => a + r[k], 0);
  const hrs =
    r.bed_at && r.wake_at
      ? `<span class="hlhr">${I('moon', 'sm')}${hlHM(r.bed_at)}<i>→</i>${I('sunrise', 'sm')}${hlHM(r.wake_at)}</span>`
      : '';
  if (!tot && !hrs) return '';
  return (
    `<div class="hln" style="--c:${HLC.sueno}"><div class="hlnh"><span class="hico">${I('bed')}</span><b>Última noche</b>${hrs}</div>` +
    (tot
      ? `<div class="hlst" role="img" aria-label="Fases del sueño">${F.map(([k, n, c]) => (r[k] ? `<i style="flex:${r[k]};--c:${c}" title="${n}: ${hlH(r[k])}"></i>` : '')).join('')}</div>
      <div class="hlleg">${F.map(([k, n, c]) => `<div style="--c:${c}"><span><i></i>${n}</span><b>${hlD(r[k])}</b><small>${Math.round((r[k] / tot) * 100)} %</small></div>`).join('')}</div>`
      : '') +
    `</div>`
  );
}
let hlSel = null; // día tocado en «Últimos 7 días»
function hlHTML() {
  if (!sb || !user) return empty('Inicia sesión para ver los datos de Google Health.');
  if (HL === null) return `<div class="mu">Cargando…</div>`;
  const by = Object.fromEntries(HL.map(r => [r.day, r])),
    td = TD(),
    hoy = by[td] || {};
  const sleepDay = by[td] && by[td].sleep_min != null ? td : addD(td, -1),
    sl = (by[sleepDay] || {}).sleep_min;
  const rhrRow = [...HL].reverse().find(r => r.rhr != null),
    M = hlMeta(),
    HL_PASOS = M.pasos,
    HL_SUENO = M.sueno;
  // Últimos 7 días: barras de pasos (con la línea del objetivo) y, debajo, las horas de sueño.
  const days = [...Array(7)].map((_, i) => addD(td, i - 6)),
    mx = Math.max(HL_PASOS, ...days.map(d => (by[d] || {}).steps || 0));
  const wd = new Intl.DateTimeFormat('es-ES', { weekday: 'short' });
  const bars = days
    .map(d => {
      const r = by[d] || {},
        h = r.steps ? Math.max(3, (r.steps / mx) * 100) : 0,
        ok = r.steps >= HL_PASOS;
      return `<div class="hlb${d === td ? ' on' : ''}${ok ? ' ok' : ''}${hlSel === d ? ' sel' : ''}" data-a="hlb" data-i="${d}" role="button" tabindex="0" aria-label="${fd(d)}: ${hlN(r.steps)} pasos" title="${fd(d)} · ${hlN(r.steps)} pasos · ${hlN(r.kcal)} kcal · sueño ${hlH(r.sleep_min)}"><small>${r.steps ? (r.steps >= 1000 ? (r.steps / 1000).toFixed(1).replace('.', ',') + 'k' : r.steps) : ''}</small><div class="tr"><i style="height:${h.toFixed(1)}%"></i></div><em>${d === td ? 'Hoy' : wd.format(new Date(d + 'T12:00')).replace('.', '')}</em><span class="hlz">${r.sleep_min != null ? hlHm(r.sleep_min) : '–'}</span></div>`;
    })
    .join('');
  // Dato del día tocado (como en el histórico).
  const sel = hlSel && days.includes(hlSel) ? hlSel : null,
    rs = by[sel] || {};
  const info = !sel
    ? `<div class="hlxi mu">${I('info', 'sm')} Toca una barra para ver su dato</div>`
    : `<div class="hlxi"><b>${rs.steps == null ? 'Sin datos' : hlN(rs.steps) + ' pasos'}</b><span>${cap(new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(sel + 'T12:00')))} · ${hlN(rs.kcal)} kcal · sueño ${hlH(rs.sleep_min)}</span>${rs.steps == null ? '' : rs.steps >= HL_PASOS ? `<span class="chip ok">Objetivo cumplido</span>` : `<span class="chip">Faltaron ${hlN(HL_PASOS - rs.steps)}</span>`}</div>`;
  const st = HLS ? (hlSync.on ? 'Sincronizando…' : 'Actualizado ' + ago(HLS.last_sync)) : 'Aún no se ha sincronizado nunca';
  return (
    (HL.length
      ? `<div class="hlg">${hlKpi(HLC.pasos, 'footprints', 'Pasos', hlN(hoy.steps), `<button class="hlmb" data-a="hlm" data-i="pasos" title="Cambiar el objetivo de pasos">${hoy.steps != null ? Math.round((hoy.steps / HL_PASOS) * 100) + ' % de ' : 'Objetivo '}${hlN(HL_PASOS)} ${I('pencil', 'sm')}</button>`, hoy.steps != null ? (hoy.steps / HL_PASOS) * 100 : null)}` +
        `${hlKpi(HLC.kcal, 'flame', 'Calorías', `${hlN(hoy.kcal)}<small>kcal</small>`, 'Quemadas hoy')}` +
        `${hlKpi(HLC.sueno, 'moon', 'Sueño', hlD(sl), `<button class="hlmb" data-a="hlm" data-i="sueno" title="Cambiar el objetivo de sueño">${sleepDay === td ? 'Anoche' : 'Noche anterior'} · meta ${hlHm(HL_SUENO)} ${I('pencil', 'sm')}</button>`, sl != null ? (sl / HL_SUENO) * 100 : null)}` +
        `${hlKpi(HLC.pulso, 'heart-pulse', 'Pulso', rhrRow ? `${rhrRow.rhr}<small>ppm</small>` : '—', 'En reposo' + (rhrRow && rhrRow.day !== td ? ' · ' + fd(rhrRow.day) : ''))}</div>
    ${hlNoche(by[sleepDay])}
    <div class="hlw"><div class="hlwh"><b>Últimos 7 días</b><button class="btn ghost sm hlxb" data-a="hlx">${I('calendar-days', 'sm')} Histórico</button><span><i style="--c:${HLC.pasos}"></i>Pasos</span><span><i style="--c:${HLC.sueno}"></i>Sueño</span><button class="hlmb hlmeta" data-a="hlm" data-i="pasos" title="Cambiar el objetivo de pasos"><i></i>Objetivo ${hlN(HL_PASOS)}</button></div>
    <div class="hlbars" role="group" aria-label="Pasos y horas de sueño de los últimos 7 días" style="--g:${((HL_PASOS / mx) * 100).toFixed(1)}%">${bars}<span class="hlgoal" aria-hidden="true"></span></div>${info}</div>`
      : empty(
          HLS
            ? 'Google Health todavía no ha mandado datos.'
            : 'Cuando el programa de Google Health esté instalado, aquí saldrán tus pasos, kcal y sueño.'
        )) +
    (HLS && HLS.last_error ? `<div class="mu wa" style="margin-top:8px">${I('triangle-alert', 'sm')} ${esc(HLS.last_error)}</div>` : '') +
    `<div class="sact"><span class="mu">${I('clock', 'sm')} ${st}</span><button class="btn ghost" data-a="hls" ${hlSync.on ? 'disabled' : ''}>${I('refresh-cw')} Sincronizar ahora</button></div>`
  );
}
/* ---------- Histórico (ventana) ----------
   Elige el dato (pasos, sueño, kcal, pulso) y el periodo (30 días, 3 meses, 1 año). Hasta 3 meses, una barra por día;
   el año, la media de cada mes. Se lee de health_daily una vez (último año) y se filtra aquí. */
const HLX_M = {
  steps: ['Pasos', 'footprints', HLC.pasos],
  sleep_min: ['Sueño', 'moon', HLC.sueno],
  kcal: ['Calorías', 'flame', HLC.kcal],
  rhr: ['Pulso', 'heart-pulse', HLC.pulso]
};
let hlx = { m: 'steps', d: 30, s: null },
  HLX = null; // s: barra tocada (se muestra su dato)
const hlxF = (m, v) =>
  v == null
    ? '—'
    : m === 'sleep_min'
      ? hlHm(Math.round(v))
      : m === 'rhr'
        ? Math.round(v) + ' ppm'
        : m === 'kcal'
          ? hlN(v) + ' kcal'
          : hlN(v);
async function hlxOpen() {
  modal(`<div id="hlx">${hlxHTML()}</div>`);
  if (HLX === null && sb && user) {
    const r = await sb.from('health_daily').select('day,steps,kcal,sleep_min,rhr').gte('day', addD(TD(), -365)).order('day');
    HLX = r.error ? [] : r.data || [];
    const e = document.getElementById('hlx');
    if (e) e.innerHTML = hlxHTML();
  }
}
function hlxHTML() {
  const { m, d } = hlx,
    [nom, ic, c] = HLX_M[m],
    td = TD(),
    desde = addD(td, -(d - 1)),
    M = hlMeta();
  const meta = m === 'steps' ? M.pasos : m === 'sleep_min' ? M.sueno : null;
  const seg = (a, cur, L) =>
    `<div class="seg">${L.map(([k, n]) => `<button class="${String(cur) === String(k) ? 'on' : ''}" data-a="${a}" data-i="${k}">${n}</button>`).join('')}</div>`;
  const head = `<div class="hlxh"><span class="hico" style="--c:${c}">${I(ic)}</span><h3>Histórico de ${nom.toLowerCase()}</h3></div>
    <div class="hlxt">${seg(
      'hlxm',
      m,
      Object.entries(HLX_M).map(([k, [n]]) => [k, n])
    )}${seg('hlxd', d, [
      [30, '30 días'],
      [90, '3 meses'],
      [365, '1 año']
    ])}</div>`;
  const close = `<div class="acts"><span class="sp"></span><button class="btn ghost" data-close>Cerrar</button></div>`;
  if (HLX === null) return head + `<div class="mu" style="padding:24px 0">Cargando…</div>` + close;
  const R = HLX.filter(r => r.day >= desde && r.day <= td && r[m] != null);
  if (!R.length) return head + empty('Aún no hay datos de esos días.') + close;
  const vals = R.map(r => r[m]),
    avg = vals.reduce((a, v) => a + v, 0) / vals.length;
  const best = R.reduce((b, r) => ((m === 'rhr' ? r[m] < b[m] : r[m] > b[m]) ? r : b), R[0]);
  const ok = meta ? R.filter(r => r[m] >= meta).length : null;
  // Barras: por día (30 días y 3 meses) o media por mes (1 año).
  let B;
  if (d <= 90) {
    const by = Object.fromEntries(R.map(r => [r.day, r[m]]));
    B = [...Array(d)].map((_, i) => {
      const k = addD(desde, i),
        dt = new Date(k + 'T12:00');
      return {
        v: by[k],
        t: cap(new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(dt)),
        l: (d === 30 ? i % 6 === 0 || i === d - 1 : dt.getDate() === 1)
          ? dt.getDate() + ' ' + new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(dt).replace('.', '')
          : ''
      };
    });
  } else {
    const G = {};
    R.forEach(r => (G[r.day.slice(0, 7)] = G[r.day.slice(0, 7)] || []).push(r[m]));
    const meses = [...Array(12)].map((_, i) => {
      const x = new Date(td + 'T12:00');
      x.setDate(1);
      x.setMonth(x.getMonth() - 11 + i);
      return iso(x).slice(0, 7);
    });
    B = meses.map(k => {
      const a = G[k];
      return {
        v: a ? a.reduce((s, v) => s + v, 0) / a.length : null,
        t: mLabel(k) + ' · media diaria',
        l: new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(new Date(k + '-15T12:00')).replace('.', '')
      };
    });
  }
  const all = B.map(b => b.v).filter(v => v != null),
    lo = m === 'rhr' ? Math.min(...all) - 5 : 0,
    mx = Math.max(meta || 0, ...all);
  const h = v => (v == null ? 0 : Math.max(2, ((v - lo) / (mx - lo || 1)) * 100));
  const tile = (k, v, sub) => `<div class="hlxk"><span>${k}</span><b>${v}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
  return (
    head +
    `<div class="hlxs" style="--c:${c}">${tile(d > 90 ? 'Media diaria' : 'Media', hlxF(m, avg), R.length + (R.length === 1 ? ' día con datos' : ' días con datos'))}${tile(m === 'rhr' ? 'Más bajo' : 'Mejor día', hlxF(m, best[m]), fd(best.day))}${meta ? tile('Objetivo cumplido', ok + ' de ' + R.length, Math.round((ok / R.length) * 100) + ' % de los días') : tile(m === 'kcal' ? 'Total' : 'Más alto', m === 'kcal' ? hlN(vals.reduce((a, v) => a + v, 0)) + ' kcal' : hlxF(m, Math.max(...vals)), '')}</div>
    ${(() => {
      const b = hlx.s != null ? B[hlx.s] : null;
      if (!b) return `<div class="hlxi mu">${I('info', 'sm')} Toca una barra para ver su dato</div>`;
      const v = b.v,
        okm =
          meta && v != null
            ? m === 'rhr'
              ? ''
              : v >= meta
                ? `<span class="chip ok">Objetivo cumplido</span>`
                : `<span class="chip">Faltaron ${hlxF(m, meta - v)}</span>`
            : '';
      return `<div class="hlxi"><b>${v == null ? 'Sin datos' : hlxF(m, v)}</b><span>${b.t}</span>${okm}</div>`;
    })()}
    <div class="hlxc${d > 90 ? ' yr' : d > 30 ? ' dense' : ''}${hlx.s != null ? ' picked' : ''}" style="--c:${c}${meta ? ';--g:' + h(meta).toFixed(1) + '%' : ''}" role="group" aria-label="${nom}: ${d === 365 ? 'media de cada mes del último año' : 'cada día de los últimos ' + d + ' días'}">${B.map((b, j) => `<div class="${hlx.s === j ? 'on' : ''}" data-a="hlxs" data-i="${j}" title="${b.t}: ${hlxF(m, b.v)}" role="button" tabindex="0" aria-label="${b.t}: ${hlxF(m, b.v)}"><div class="tr"><i style="height:${h(b.v).toFixed(1)}%"></i></div><em>${b.l}</em></div>`).join('')}${meta ? '<span class="hlgoal" aria-hidden="true"></span>' : ''}</div>` +
    (meta ? `<div class="mu hlxl"><i></i>Objetivo: ${hlxF(m, meta)}</div>` : '') +
    close
  );
}
function vSalud() {
  setTimeout(hlOpen);
  const st = salStats(),
    n = st.next ? dayDiff(st.next) : null;
  const add = `<div class="f inl" style="margin-top:12px"><input id="sa1" type="date" value="${TD()}" max="${TD()}" aria-label="Fecha de inicio"><button class="btn" data-a="sai">${I('plus')} Apuntar inicio</button></div>`;
  const C = {
    act: panel('salud', 'act', `${I('footprints')} Actividad y sueño`, `<div id="hlbox">${hlHTML()}</div>`, 'wide'),
    seg: panel(
      'salud',
      'seg',
      `${I('heart-pulse')} Seguimiento`,
      st.last
        ? `<div class="gx">${salRing(st, n)}<div class="sinf">
          <div class="mu">Próximo previsto</div><div class="big">${fd(st.next)}</div>
          <div class="mu">Día ${st.day} · Empezó el ${fd(st.last)}</div>
          <div class="mu">Ciclo de ${st.avg} días · ${st.gaps.length ? 'Media de los últimos ' + st.gaps.length : 'duración habitual'}</div>
          <div class="mu">${I('clock', 'sm')} Aviso por Telegram 3 días antes.</div></div></div>
        ${add}<div class="sact"><button class="btn ghost" data-a="sah">${I('calendar-days')} Ver histórico</button><button class="link txl mu" data-a="sad" data-i="${st.last}">Quitar la última fecha (${fd(st.last)})</button></div>`
        : empty('Apunta el día de inicio para empezar a calcular el siguiente.') + add,
      'wide'
    ),
    conf: panel(
      'salud',
      'conf',
      `${I('settings')} Duración habitual`,
      `<div class="fs"><label>Días entre un inicio y el siguiente<input id="sa2" type="number" min="15" max="60" value="${st.len}"></label><div class="mu">Se usa mientras no haya al menos dos fechas apuntadas.</div><label>Días que se marcan en el calendario<input id="sa3" type="number" min="1" max="10" value="${st.dur}"></label></div><div class="acts"><span class="sp"></span><button class="btn ghost" data-a="sal">Guardar</button></div>`,
      'wide'
    )
  };
  VIS.salud = ord('salud', ['act', 'seg', 'conf']);
  return `<div class="hdr"><div><h2>Salud</h2><div class="sub help">Privado: los datos solo se guardan en tu cuenta.</div></div></div>
  <div class="grid2">${VIS.salud.map(k => C[k]).join('')}</div>`;
}
