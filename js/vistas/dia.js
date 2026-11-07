'use strict';
/* Sección «Mi día»: versión mínima. Portada (fecha, saludo, una frase y tres cifras), «Lo más importante», el calendario
   con los próximos días y una fila de accesos (compra y documentos a mano). Facturas y gasto se ven en su sección. */
/* ---------- vistas ---------- */
let gOff = 0;   // meses hacia atrás en «Gasto del mes» (acción 'gm'; no se guarda)
/* Tiempo de la portada (Open-Meteo, gratis y sin clave) de la ciudad elegida en Ajustes (S.wx = {n, lat, lon}, va con tus datos).
   Se guarda 30 minutos en este dispositivo; al llegar uno nuevo se cambia solo ese trozo, sin repintar la sección. */
const WX = 'ldb-wx', WXMIN = 30*60*1000;
const wxCache = () => { try { const c = JSON.parse(localStorage.getItem(WX)); return c && S.wx && c.k===S.wx.lat+','+S.wx.lon ? c : null; } catch(e) { return null; } };
/* Código del tiempo (WMO) → texto e icono; de noche, luna en lugar de sol. */
const wxTxt = (c, day) => c>=95 ? ['Tormenta','cloud-lightning'] : c>=85 ? ['Chubascos de nieve','cloud-snow'] : c>=80 ? ['Chubascos','cloud-rain'] : c>=71 ? ['Nieve','cloud-snow']
  : c>=61 ? ['Lluvia','cloud-rain'] : c>=51 ? ['Llovizna','cloud-drizzle'] : c>=45 ? ['Niebla','cloud-fog'] : c===3 ? ['Nublado','cloud']
  : c===2 ? ['Algo nuboso', day ? 'cloud-sun' : 'cloud-moon'] : [c===1 ? 'Casi despejado' : 'Despejado', day ? 'sun' : 'moon'];
function wxHTML(){
  if (!S.wx) return `<button class="hwxadd" data-a="wxc">${I('cloud-sun','sm')} Elige tu ciudad para ver el tiempo</button>`;
  const c = wxCache(); if (!c) return `<div class="hwx"><span class="hwt">${esc(S.wx.n)}</span></div>`;
  // Temperatura grande, el cielo y la ciudad, y una curva fina con la máxima de hoy y de los 3 días siguientes, con la mínima justo debajo de cada bolita
  // (cada punto sube o baja según haga más o menos calor; --y va de 0, el día más caluroso, a 1, el más fresco).
  const d = c.d, [t, ic] = wxTxt(d.current.weather_code, d.current.is_day), wd = new Intl.DateTimeFormat('es-ES',{weekday:'short'}), r = Math.round;
  const mx = d.daily.temperature_2m_max.slice(0, 4).map(r), hi = Math.max(...mx), lo = Math.min(...mx), y = v => hi===lo ? .5 : (hi-v)/(hi-lo);
  const pts = mx.map((v,j) => `${j+.5},${y(v).toFixed(2)}`).join(' ');
  const cols = mx.map((v,j) => `<span style="--y:${y(v).toFixed(2)}" title="${wxTxt(d.daily.weather_code[j], 1)[0]}"><b>${v}°</b><i></i><small>${r(d.daily.temperature_2m_min[j])}°</small><em>${j ? wd.format(new Date(d.daily.time[j]+'T12:00')).replace('.','') : 'hoy'}</em></span>`).join('');
  return `<div class="hwx" title="Tiempo en ${esc(S.wx.n)} (Open-Meteo)"><div class="hwn"><b>${r(d.current.temperature_2m)}°</b><span class="hwt"><span>${I(ic,'sm')}${t}</span><small>${esc(S.wx.n)} · ${r(d.daily.temperature_2m_min[0])}° mín</small></span></div><div class="hwc"><svg viewBox="0 -.08 4 1.16" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" vector-effect="non-scaling-stroke"/></svg>${cols}</div></div>`;
}
// Modelo europeo ECMWF (forzado con models=).
function wxLoad(){
  const c = wxCache(); if (!S.wx || S.wxOff || (c && Date.now()-c.t < WXMIN) || wxLoad.on) return; wxLoad.on = 1;
  fetch(`https://api.open-meteo.com/v1/forecast?latitude=${S.wx.lat}&longitude=${S.wx.lon}&current=temperature_2m,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=4&models=ecmwf_ifs025`)
    .then(r => r.ok ? r.json() : Promise.reject()).then(d => { try { localStorage.setItem(WX, JSON.stringify({k:S.wx.lat+','+S.wx.lon, t:Date.now(), d})); } catch(e) {}
      const e = document.getElementById('hwx'); if (e) e.innerHTML = wxHTML(); }).catch(() => {}).finally(() => { wxLoad.on = 0; });
}
setInterval(() => { if (document.getElementById('hwx')) wxLoad(); }, 5*60*1000);
function vDia(){
  const now = new Date(), h = now.getHours(), g = h<6?'Buenas noches':h<13?'Buenos días':h<21?'Buenas tardes':'Buenas noches', td = TD(), open = S.tasks.filter(t => !t.done);
  const tt = open.filter(t => t.due && t.due<=td).sort((a,b) => (a.due+(a.tm||'')).localeCompare(b.due+(b.tm||''))), late = tt.filter(t => t.due<td).length;
  // Calendario: los próximos 7 días agrupados por día. Las tareas de mañana ya salen en «Lo más importante», así que aquí empiezan pasado mañana.
  const up = [...open.filter(t => t.due && dayDiff(t.due)>=2 && dayDiff(t.due)<=7).map(t => [t.due, t.tm||'', taskRow(t)]),
    ...[...new Set([td.slice(0,4), addD(td,7).slice(0,4)])].flatMap(y => holidays(+y)).filter(h => dayDiff(h.d)>=1 && dayDiff(h.d)<=7).map(h => [h.d, '', holRow(h)]),
    ...S.periods.filter(p => dayDiff(p.from)>=1 && dayDiff(p.from)<=7).map(p => [p.from, '', perRow(p)])].sort((a,b) => (a[0]+a[1]).localeCompare(b[0]+b[1]));
  // Cabecera de cada día con el día de la semana (también el séptimo, que rel() daría como «En 7 d»).
  const wday = d => dayDiff(d)===7 ? new Intl.DateTimeFormat('es-ES',{weekday:'long'}).format(new Date(d+'T00:00')) : rel(d);
  let lastU = ''; const upRows = up.map(([d,,r]) => { const hd = d!==lastU ? `<div class="dh">${cap(wday(d))} · ${fdc(d)}</div>` : ''; lastU = d; return hd + r; });
  const imp = [...open.filter(t => t.due && dayDiff(t.due)<=1).map(t => [t.due, ico(t), t.title, AC[t.area], t.id]), ...fxDue(7).map(o => [o.d, 'receipt', o.f.name+' · '+eur(o.f.amt), col(o.f.cat)]), ...S.docs.filter(d => d.exp && dayDiff(d.exp)<=30).map(d => [d.exp, DI[d.cat]||'file-text', 'Vence: '+d.name, DCOL[d.cat]]), ...bankAlerts()].sort((a,b) => a[0].localeCompare(b[0]));
  const b7 = fxDue(7), m = MN(now);
  const P = S.shop.filter(s => !s.done), pins = pinDocs().slice(0, PINMAX);
  // Con «Ordenar», los documentos a mano salen en lista con flechas para cambiar su orden.
  const pinOrd = () => pins.map((d,j) => `<div class="row">${tile(DI[d.cat]||'file-text', DCOL[d.cat])}<span class="g">${esc(d.name)}</span><button class="ib" data-a="mv" data-i="pins|${d.id}|-1" aria-label="Subir" ${j?'':'disabled'}>${I('chevron-up')}</button><button class="ib" data-a="mv" data-i="pins|${d.id}|1" aria-label="Bajar" ${j<pins.length-1?'':'disabled'}>${I('chevron-down')}</button></div>`).join('');
  // Etiqueta de cuándo: rojo si está atrasado, acento si es hoy y gris si es más adelante.
  const when = d => { const n = dayDiff(d); return `<span class="chip ${n<0?'er':n===0?'ac':''}">${cap(rel(d))}</span>`; };
  const C = {
    imp: panel('dia','imp',`${I('sparkles')} Lo más importante${imp.length?` <span class="cnt">· ${imp.length}</span>`:''}`, imp.length ? imp.map(([d,n,t,c,ti]) => `<div class="row">${ti?`<input type="checkbox" class="ck" data-a="tt" data-i="${ti}" aria-label="Completar «${esc(t)}»">`:''}${tile(n,c)}${ti?`<button class="link" data-a="et" data-i="${ti}"><span class="tt">${esc(t)}</span></button>`:`<span class="g">${esc(t)}</span>`}${when(d)}</div>`).join('') : empty('Nada urgente para hoy ni mañana.'), 'hl dimp'),
    cal: panel('dia','cal',`${I('calendar-days')} Calendario`,calHTML()+`<div class="cup"><div class="cuph">${I('calendar-clock','sm')} Próximos 7 días</div>${upRows.length?fold('d-prox', upRows, 4):empty('Nada en los próximos 7 días.')}</div>`)
  };
  VIS.dia = ord('dia', DIA);
  // «Lo más importante» va primero mientras no se haya movido a mano (en un orden guardado antes de existir quedaría al final).
  if (!(S.order.dia||[]).includes('imp')) VIS.dia = ['imp', ...VIS.dia.filter(k => k!=='imp')];
  // Portada: fecha, saludo, una frase con lo que hay hoy y tres cifras (tareas, facturas y gasto del mes) que llevan a su sección.
  const sp = spent(m), B = S.budget||0, pc = B ? Math.round(sp/B*100) : 0, b7t = b7.reduce((a,o) => a+o.f.amt, 0);
  const pl = (n, s, p) => n+' '+(n===1 ? s : p);
  const ring = p => { const R = 15, C = 2*Math.PI*R; return `<svg class="hring" viewBox="0 0 36 36" aria-hidden="true"><circle r="${R}" cx="18" cy="18"/><circle r="${R}" cx="18" cy="18" class="${p>=100?'over':p>=80?'near':''}" stroke-dasharray="${(C*Math.min(p,100)/100).toFixed(1)} ${C.toFixed(1)}"/></svg>`; };
  // Cada cifra lleva el icono y el color de su sección (--c).
  const hs = (go, ic, c, k, v, d, extra='') => `<button class="hs" style="--c:${c}" data-a="go" data-i="${go}"><span class="hk"><span class="hico">${I(ic)}</span>${k}</span><span class="hv">${v}${extra}</span><span class="hd2">${d}</span></button>`;
  // Fila de accesos: la compra (cuántos productos faltan) y los documentos a mano, que se abren directamente.
  const qd = d => d.url
    ? `<a class="qc" href="${esc(d.url)}" target="_blank" rel="noopener noreferrer"><span class="qi" style="--c:${DCOL[d.cat]}">${I(DI[d.cat]||'file-text')}</span>${esc(d.name)}${d.exp&&dayDiff(d.exp)<=60?`<em class="${dayDiff(d.exp)<0?'er':'wa'}">${dayDiff(d.exp)<0?'Caducó':'Vence '+fdc(d.exp)}</em>`:''}</a>`
    : `<button class="qc off" data-a="ed" data-i="${d.id}"><span class="qi" style="--c:${DCOL[d.cat]}">${I(DI[d.cat]||'file-text')}</span>${esc(d.name)}<em>Añadir enlace</em></button>`;
  const quick = `<div class="qrow" aria-label="Accesos rápidos">
    <button class="qc" data-a="go" data-i="compra"><span class="qi" style="--c:#34c77b">${I('shopping-cart')}</span>Compra${P.length?` <b>${P.length}</b>`:''}</button>
    ${pins.map(qd).join('')}
    ${pins.length>1?`<button class="qlk" data-a="cust">${cust?'Listo':'Ordenar'}</button>`:''}${pins.length?'':`<button class="qlk" data-a="go" data-i="docs">${I('star','sm')} Marca documentos con la estrella para tenerlos aquí</button>`}
  </div>${cust && pins.length>1 ? `<div class="card qord">${pinOrd()}</div>` : ''}`;
  setTimeout(wxLoad);
  return `<section class="hero" aria-label="Resumen de hoy">
    <div class="hmain"><div class="eyb">${cap(new Intl.DateTimeFormat('es-ES',{weekday:'long',day:'numeric',month:'long'}).format(now))}</div>
      <h2>${g}${S.name?', '+esc(S.name):''}</h2></div>
    ${S.wxOff ? '' : `<div id="hwx" class="haside">${wxHTML()}</div>`}
  </section>
  <div class="hst">
    ${hs('tareas', 'list-checks', '#9b87f5', 'Tareas hoy', tt.length, late ? `<span class="hwarn">${pl(late,'atrasada','atrasadas')}</span>` : tt.length ? 'Sin atrasos' : 'Nada pendiente')}
    ${hs('fact', 'receipt', '#f0a83a', 'Facturas 7 días', b7.length, b7.length ? eur(b7t) : 'Nada a la vista')}
    ${B ? hs('fin', 'wallet', '#22c3b4', 'Gasto del mes', pc+'<small>%</small>', 'De tu tope · '+eur(sp), ring(pc)) : hs('fin', 'wallet', '#22c3b4', 'Gasto del mes', `<span class="hsm">${eur(sp)}</span>`, 'Sin tope definido')}
  </div>
  <div class="grid dgrid">
  ${VIS.dia.map(k => C[k]).join('')}
  ${quick}</div>`;
}
