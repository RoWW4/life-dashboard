'use strict';
/* Sección «Mi día»: versión mínima. Portada (fecha, saludo y tiempo), «Lo más importante», el calendario
   con los próximos días y accesos a las secciones. Facturas y gasto se ven en su sección. */
/* ---------- vistas ---------- */
let gOff = 0; // meses hacia atrás en «Gasto del mes» (acción 'gm'; no se guarda)
/* Tiempo de la portada (Open-Meteo, gratis y sin clave) de la ciudad elegida en Ajustes (S.wx = {n, lat, lon}, va con tus datos).
   Se guarda 30 minutos en este dispositivo; al llegar uno nuevo se cambia solo ese trozo, sin repintar la sección. */
const WX = 'ldb-wx',
  WXMIN = 30 * 60 * 1000;
const wxCache = () => {
  try {
    const c = JSON.parse(localStorage.getItem(WX));
    return c && S.wx && c.k === S.wx.lat + ',' + S.wx.lon ? c : null;
  } catch (e) {
    return null;
  }
};
/* Código del tiempo (WMO) → texto e icono; de noche, luna en lugar de sol. */
const wxTxt = (c, day) =>
  c >= 95
    ? ['Tormenta', 'cloud-lightning']
    : c >= 85
      ? ['Chubascos de nieve', 'cloud-snow']
      : c >= 80
        ? ['Chubascos', 'cloud-rain']
        : c >= 71
          ? ['Nieve', 'cloud-snow']
          : c >= 61
            ? ['Lluvia', 'cloud-rain']
            : c >= 51
              ? ['Llovizna', 'cloud-drizzle']
              : c >= 45
                ? ['Niebla', 'cloud-fog']
                : c === 3
                  ? ['Nublado', 'cloud']
                  : c === 2
                    ? ['Algo nuboso', day ? 'cloud-sun' : 'cloud-moon']
                    : [c === 1 ? 'Casi despejado' : 'Despejado', day ? 'sun' : 'moon'];
function wxHTML() {
  if (!S.wx) return `<button class="hwxadd" data-a="wxc">${I('cloud-sun', 'sm')} Elige tu ciudad para ver el tiempo</button>`;
  const c = wxCache();
  if (!c) return `<div class="hwx"><span class="hwt">${esc(S.wx.n)}</span></div>`;
  // Temperatura grande, el cielo y la ciudad, y una curva fina con la máxima de hoy y de los 3 días siguientes, con la mínima justo debajo de cada bolita
  // (cada punto sube o baja según haga más o menos calor; --y va de 0, el día más caluroso, a 1, el más fresco).
  const d = c.d,
    [t, ic] = wxTxt(d.current.weather_code, d.current.is_day),
    wd = new Intl.DateTimeFormat('es-ES', { weekday: 'short' }),
    r = Math.round;
  const mx = d.daily.temperature_2m_max.slice(0, 4).map(r),
    hi = Math.max(...mx),
    lo = Math.min(...mx),
    y = v => (hi === lo ? 0.5 : (hi - v) / (hi - lo));
  const pts = mx.map((v, j) => `${j + 0.5},${y(v).toFixed(2)}`).join(' ');
  // En el punto de cada día va el icono de su tiempo (sol, nube, lluvia…); al tocarlo, un aviso dice la lluvia prevista (wxDia).
  const cols = mx
    .map((v, j) => {
      const [dt, di] = wxTxt(d.daily.weather_code[j], 1);
      return `<span style="--y:${y(v).toFixed(2)}" title="${dt}"><b>${v}°</b><i role="button" tabindex="0" data-a="wxd" data-i="${j}" aria-label="${dt}: ver lluvia prevista">${I(di)}</i><small>${r(d.daily.temperature_2m_min[j])}°</small><em>${j ? wd.format(new Date(d.daily.time[j] + 'T12:00')).replace('.', '') : 'hoy'}</em></span>`;
    })
    .join('');
  return `<div class="hwx" title="Tiempo en ${esc(S.wx.n)} (Open-Meteo)"><div class="hwn"><b>${r(d.current.temperature_2m)}°</b><span class="hwt"><span>${I(ic, 'sm')}${t}</span><small>${esc(S.wx.n)} · ${r(d.daily.temperature_2m_min[0])}° mín</small></span></div><div class="hwc"><svg viewBox="0 -.08 4 1.16" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" vector-effect="non-scaling-stroke"/></svg>${cols}</div></div>`;
}
/* Texto del aviso al tocar el icono de un día: su tiempo y la probabilidad de lluvia o nieve (o los litros, si el modelo no da la probabilidad). */
function wxDia(j) {
  const c = wxCache();
  if (!c) return '';
  const dd = c.d.daily,
    p = (dd.precipitation_probability_max || [])[j],
    l = (dd.precipitation_sum || [])[j];
  const dia = +j ? new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(new Date(dd.time[j] + 'T12:00')) : 'hoy',
    mm = l ? ' (' + String(Math.round(l * 10) / 10).replace('.', ',') + ' mm)' : '';
  const ll =
    p != null
      ? Math.round(p) + ' % de probabilidad de lluvia' + mm
      : l == null
        ? 'sin datos de lluvia'
        : l >= 0.1
          ? 'se esperan' + mm.slice(1, -1)
          : 'sin lluvia prevista';
  return dia[0].toUpperCase() + dia.slice(1) + ': ' + wxTxt(dd.weather_code[j], 1)[0].toLowerCase() + ' · ' + cap(ll);
}
// Modelo europeo ECMWF (forzado con models=).
function wxLoad() {
  const c = wxCache();
  if (!S.wx || S.wxOff || (c && c.d.daily.precipitation_sum && Date.now() - c.t < WXMIN) || wxLoad.on) return;
  wxLoad.on = 1;
  fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${S.wx.lat}&longitude=${S.wx.lon}&current=temperature_2m,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum&timezone=auto&forecast_days=4&models=ecmwf_ifs025`
  )
    .then(r => (r.ok ? r.json() : Promise.reject(new Error('Open-Meteo → ' + r.status))))
    .then(d => {
      try {
        localStorage.setItem(WX, JSON.stringify({ k: S.wx.lat + ',' + S.wx.lon, t: Date.now(), d }));
      } catch (e) {
        logErr('almacenamiento', e, 'tiempo');
      }
      const e = document.getElementById('hwx');
      if (e) e.innerHTML = wxHTML();
    })
    .catch(e => logErr('tiempo', e))
    .finally(() => {
      wxLoad.on = 0;
    });
}
setInterval(
  () => {
    if (document.getElementById('hwx')) wxLoad();
  },
  5 * 60 * 1000
);
function vDia() {
  const now = new Date(),
    h = now.getHours(),
    g = h < 6 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches',
    td = TD(),
    open = S.tasks.filter(t => !t.done);
  // Calendario: los próximos 7 días agrupados por día. Las tareas de mañana (y los cumpleaños de las dos próximas semanas) ya salen en «Lo más importante», así que aquí empiezan pasado mañana.
  const up = [
    ...open
      .filter(t => t.due && t.area !== 'Cumpleaños' && dayDiff(t.due) >= 2 && dayDiff(t.due) <= 7)
      .map(t => [t.due, t.tm || '', taskRow(t)]),
    ...[...new Set([td.slice(0, 4), addD(td, 7).slice(0, 4)])]
      .flatMap(y => holidays(+y))
      .filter(h => dayDiff(h.d) >= 1 && dayDiff(h.d) <= 7)
      .map(h => [h.d, '', holRow(h)]),
    ...S.periods.filter(p => dayDiff(p.from) >= 1 && dayDiff(p.from) <= 7).map(p => [p.from, '', perRow(p)])
  ].sort((a, b) => (a[0] + a[1]).localeCompare(b[0] + b[1]));
  // Cabecera de cada día con el día de la semana (también el séptimo, que rel() daría como «En 7 d»).
  const wday = d => (dayDiff(d) === 7 ? new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(new Date(d + 'T00:00')) : rel(d));
  let lastU = '';
  const upRows = up.map(([d, , r]) => {
    const hd = d !== lastU ? `<div class="dh">${cap(wday(d))} · ${fdc(d)}</div>` : '';
    lastU = d;
    return hd + r;
  });
  // Cada aviso: [fecha, icono, título, color, id de tarea, sección, detalle]. El título va en negrita y el detalle (importe, tipo…) debajo, en gris.
  const cut = (x, sep) => {
    const i = x.indexOf(sep);
    return i < 0 ? [x, ''] : [x.slice(0, i), x.slice(i + sep.length)];
  };
  const imp = [
    // Los cumpleaños, con dos semanas de antelación (para el regalo); los años que cumple van en su icono.
    ...open.filter(t => t.due && dayDiff(t.due) <= (t.area === 'Cumpleaños' ? 14 : 1)).map(t => [t.due, ico(t), t.title, AC[t.area], t.id, '', [t.tm, t.area].filter(Boolean).join(' · ')]),
    // Lo que no es una tarea lleva a su sección al tocarlo (6.º dato).
    ...fxDue(7).map(o => [o.d, 'receipt', fxPzName(o.f, o.d), col(o.f.cat), '', 'fact', eur(o.f.amt) + (o.f.t === 'i' ? ' · Cobro' : ' · Factura')]),
    ...fxPausedHit().map(o => [
      o.x.date,
      'receipt',
      o.f.name,
      '#f2b13d',
      '',
      'fact',
      `En pausa, pero el banco lo cobró el ${fdc(o.x.date)} · ${eur(o.x.amt)}`
    ]),
    ...S.docs
      .filter(d => d.exp && dayDiff(d.exp) <= 30)
      .map(d => [d.exp, DI[d.cat] || 'file-text', d.name, DCOL[d.cat], '', 'docs', 'Caduca · Documentos']),
    ...carWarn().map(o => [o.d, 'car', o.n, CARC, '', 'coche', (/km/.test(o.pill) ? o.pill + ' · ' : '') + 'Coche']),
    ...petWarn().map(o => (([a, b]) => [o.d, o.ic, a, PETC, '', 'mascotas', (b ? b + ' · ' : '') + 'Mascotas'])(cut(o.t, ' · '))),
    ...bankAlerts().map(([d, n, t, c]) => (([a, b]) => [d, n, a, c, '', 'ajus', cap(b)])(t.includes(': ') ? cut(t, ': ') : cut(t, ' · ')))
  ].sort((a, b) => a[0].localeCompare(b[0]));
  const P = S.shop.filter(s => !s.done);
  // Etiqueta de cuándo: rojo si está atrasado, acento si es hoy y naranja si es más adelante.
  const when = d => {
    const n = dayDiff(d);
    return `<span class="chip ${n < 0 ? 'er' : n === 0 ? 'ac' : 'wa'}">${cap(rel(d))}</span>`;
  };
  const C = {
    imp: panel(
      'dia',
      'imp',
      `${I('sparkles')} Lo más importante${imp.length ? ` <span class="cnt">· ${imp.length}</span>` : ''}`,
      imp.length
        ? imp
            .map(
              ([d, n, t, c, ti, go, sb], _, __, dt = `<span class="tt">${esc(t)}</span>${sb ? `<span class="dsub">${esc(sb)}</span>` : ''}`) =>
                `<div class="row"${ti && NATIVE_DRAG ? ` draggable="true" data-tid="${ti}"` : ''}>${ti ? `<input type="checkbox" class="ck" data-a="tt" data-i="${ti}" aria-label="Completar «${esc(t)}»">` : ''}${(tk => (tk && tk.area === 'Cumpleaños' ? bdTile(tk) : tile(n, c)))(ti && S.tasks.find(x => x.id === ti))}${ti ? `<button class="link" data-a="et" data-i="${ti}">${dt}</button>` : go ? `<button class="link" data-a="go" data-i="${go}" title="Abrir su sección">${dt}</button>` : `<span class="g">${dt}</span>`}${when(d)}${ti ? tppBtn(S.tasks.find(x => x.id === ti)) : ''}</div>`
            )
            .join('')
        : empty('Nada urgente para hoy ni mañana.'),
      'hl dimp'
    ),
    cal: panel(
      'dia',
      'cal',
      `${I('calendar-days')} Calendario`,
      calHTML() +
        `<div class="cup"><div class="cuph">${I('calendar-clock', 'sm')} Próximos 7 días</div>${upRows.length ? fold('d-prox', upRows, 4) : empty('Nada en los próximos 7 días.')}</div>`
    )
  };
  VIS.dia = ord('dia', DIA);
  // «Lo más importante» va primero mientras no se haya movido a mano (en un orden guardado antes de existir quedaría al final).
  if (!(S.order.dia || []).includes('imp') && VIS.dia.includes('imp')) VIS.dia = ['imp', ...VIS.dia.filter(k => k !== 'imp')];
  // Accesos a todas las secciones (en el orden del menú): cuadrícula de iconos con su color; Compra lleva cuántos productos faltan.
  const QCOL = { tareas: '#9b87f5', compra: '#34c77b', fin: '#22c3b4', docs: '#e0b416', salud: 'var(--rose)', coche: CARC, mascotas: PETC };
  const quick = `<div class="qgrid" role="navigation" aria-label="Ir a una sección">${secs()
    .filter(([k]) => k !== 'dia' && k !== 'ajus')
    .map(
      ([k, ic, l, sh]) =>
        `<button class="qs" data-a="go" data-i="${k}" style="--c:${QCOL[k] || 'var(--ac)'}" aria-label="${l}"><span class="qsi">${I(ic)}${k === 'compra' && P.length ? `<b>${P.length}</b>` : ''}</span><span class="qsl">${k === 'docs' ? sh : l}</span></button>`
    )
    .join('')}</div>`;
  setTimeout(wxLoad);
  return `<section class="hero" aria-label="Resumen de hoy">${heroBg()}
    <div class="hmain"><div class="eyb">${cap(new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(now))}</div>
      <h2>${g}${S.name ? ', ' + esc(S.name) : ''}</h2></div>
    ${S.wxOff ? '' : `<div id="hwx" class="haside">${wxHTML()}</div>`}
  </section>
  <div class="grid dgrid">
  ${VIS.dia.map(k => C[k]).join('')}
  ${quick}</div>`;
}
