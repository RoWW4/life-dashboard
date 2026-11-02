'use strict';
/* Piezas comunes de la interfaz: avisos, ventanas, dictado, iconos, filas, gráfico de gasto, festivos y calendario. */
/* ---------- interfaz: piezas comunes ---------- */
function toast(t){ const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove('on'), 2800); }
function modal(html){
  document.querySelectorAll('.ov').forEach(o => o.remove());
  const o = document.createElement('div'); o.className = 'ov';
  o.innerHTML = `<div class="dlg" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(o);
  // En móvil un toque puede generar un segundo click justo después: lo ignoramos para no cerrar el modal recién abierto.
  const t0 = Date.now(); let downOnBg = false;
  o.addEventListener('pointerdown', e => { downOnBg = e.target===o; });
  o.addEventListener('click', e => { if (Date.now()-t0 < 400) return; if ((e.target===o && downOnBg) || e.target.closest('[data-close]')) o.remove(); });
  o.addEventListener('keydown', e => { if (e.key==='Escape') o.remove(); if (e.key==='Enter' && e.target.tagName==='INPUT') { const b = o.querySelector('#ok'); if (b) { e.preventDefault(); b.click(); } } });
  return o;
}
/* Confirmación / entrada propia (la versión artifact no podía usar confirm() ni prompt()). */
function CF(msg, fn, inp, info){
  const o = modal(`<p style="color:var(--tx)">${esc(msg)}</p>${inp!==undefined?`<input id="cfi" class="in" style="width:100%;margin-bottom:16px" value="${esc(inp)}">`:''}<div class="acts"><span class="sp"></span>${info?'':'<button class="btn ghost" data-close>Cancelar</button>'}<button class="btn" id="ok">${info?'Entendido':'Aceptar'}</button></div>`);
  o.querySelector('#ok').onclick = () => { const v = inp!==undefined ? o.querySelector('#cfi').value : null; o.remove(); fn(v); };
  const i = o.querySelector('#cfi'); (i || o.querySelector('#ok')).focus(); if (i) i.select();
}
/* Ventana de dictado: escucha con el reconocimiento de voz del navegador mostrando el texto en vivo,
   y siempre deja corregirlo o escribirlo (o usar el micrófono del teclado) antes de añadir. */
const SRE = {
  'no-speech':'No he oído nada. Toca el micrófono y habla justo después.',
  'audio-capture':'No puedo usar el micrófono: puede que otra app lo esté usando.',
  'not-allowed':'El micrófono está bloqueado para el panel. Actívalo en los permisos del sitio, o usa el micrófono del teclado.',
  'service-not-allowed':'El dictado del navegador no está disponible aquí. Usa el micrófono del teclado.',
  'network':'El dictado necesita conexión a internet. Usa el micrófono del teclado.',
  'language-not-supported':'El dictado en español no está disponible. Usa el micrófono del teclado.'
};
function listen(cb, hint, pv){
  const o = modal(`<h3>Dictar</h3><p>${hint}</p><div class="vz"><button class="vbtn" id="vb" aria-label="Escuchar">${I('mic')}</button><div id="vs">Preparando el micrófono…</div></div><input id="vt" class="in" style="width:100%;margin-bottom:10px" placeholder="Aquí aparece lo que digas (puedes corregirlo)"><div class="vprev" id="vp" aria-live="polite"></div><div class="acts"><span class="sp"></span><button class="btn ghost" data-close>Cancelar</button><button class="btn" id="ok">Añadir</button></div>`);
  const vt = o.querySelector('#vt'), vs = o.querySelector('#vs'), vb = o.querySelector('#vb'), R = window.SpeechRecognition || window.webkitSpeechRecognition;
  let r = null, on = false, want = false, heard = 0;
  const upd = () => { if (pv) o.querySelector('#vp').innerHTML = pv(vt.value); };
  vt.addEventListener('input', upd);
  // El móvil corta el dictado tras una pausa corta: mientras no se pare a mano, se vuelve a escuchar solo,
  // hasta 2 s seguidos sin oír nada (o 2 minutos en total).
  const QUIET = 2000, MAXT = 120000;
  let t0 = 0;
  const stop = () => { want = false; if (r) try { r.stop(); } catch(x) {} };
  const done = () => { on = false; vb.classList.remove('on'); vs.className = '';
    vs.textContent = vt.value.trim() ? 'Revisa el texto y pulsa «Añadir» (o toca el micrófono para seguir).' : 'No he oído nada. Toca el micrófono para volver a intentarlo.';
    if (vt.value.trim()) o.querySelector('#ok').focus(); };
  const run = () => {
    r = new R(); r.lang = 'es-ES'; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
    const base = vt.value.trim();
    r.onstart = () => { on = true; vb.classList.add('on'); vs.className = ''; vs.textContent = 'Escuchando… habla ahora (toca para parar)'; };
    r.onresult = e => { heard = Date.now(); vt.value = cap(fixText((base ? base+' ' : '') + [...e.results].map(x => x[0].transcript).join('').trim())); upd(); };
    r.onerror = e => { if (e.error === 'no-speech' || e.error === 'aborted') return;   // silencio: lo decide onend
      want = false; if (/network|service-not-allowed|language/.test(e.error)) vt.focus();
      // En el ordenador, el dictado de Windows (Win + H) escribe en la casilla aunque el del navegador no funcione.
      if (/network|service-not-allowed/.test(e.error) && /Windows/.test(navigator.userAgent) && !matchMedia('(hover:none)').matches) { vs.textContent = 'El dictado del navegador no responde aquí. Pulsa Windows + H para dictar con Windows en la casilla y luego «Añadir».'; vs.className = 'er'; return; }
      vs.textContent = SRE[e.error] ||'No se pudo dictar ('+e.error+'). Toca el micrófono para reintentar o escribe.'; vs.className = 'er'; };
    r.onend = () => { const t = Date.now();
      if (want && o.isConnected && t - heard < QUIET && t - t0 < MAXT) { try { run(); return; } catch(x) {} }
      const er = vs.className === 'er'; want = false; if (!er) done(); else { on = false; vb.classList.remove('on'); } };
    try { r.start(); } catch(x) { want = false; on = false; vb.classList.remove('on'); vs.textContent = 'No se pudo activar el micrófono. Escribe o usa el del teclado.'; }
  };
  const start = () => {
    if (!R) { vb.hidden = true; vs.textContent = 'Este navegador no permite dictar aquí: toca la casilla y usa el micrófono del teclado.'; vt.focus(); return; }
    if (on || want) return stop();
    want = true; t0 = heard = Date.now(); vs.className = ''; run();
  };
  vb.onclick = start;
  o.querySelector('#ok').onclick = () => { const t = vt.value.trim(); if (!t) return toast('Di o escribe algo'); stop(); o.remove(); cb(t); };
  // Si se cierra la ventana, se deja de escuchar
  new MutationObserver((_, mo) => { if (!o.isConnected) { stop(); mo.disconnect(); } }).observe(document.body, {childList:true});
  start();
}
const I = (n, c='') => `<svg class="i ${c}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]||ICONS.package}</svg>`;
const tile = (n, c) => `<span class="ic" style="--c:${c||'var(--mu)'}">${I(n)}</span>`;
const ico = t => (KW.find(([r]) => r.test(t.title)) || [0, AI[t.area]||'pin'])[1];
const empty = t => `<div class="empty">${t}</div>`;
const prChip = p => p==='Alta' ? '<span class="chip wa">Alta</span>' : '';
/* Gasto que cuenta en totales y comparaciones: fuera traspasos, gastos extraordinarios (x.ex, p. ej. cancelar un préstamo)
   y encargos (x.enc: compras para otra persona que devuelve el dinero en mano). */
const cntG = x => x.t==='g' && x.cat!==NOCNT && !x.ex && !x.enc;
/* Devolución: ingreso con categoría de gasto (p. ej. Bizum de lo que te deben de una cena): resta del gasto de esa categoría. */
const isDev = x => x.t==='i' && !['Nómina','Otros',NOCNT].includes(x.cat);
/* Importe con signo para el gasto: + gasto que cuenta, − devolución, 0 lo demás. */
const gAmt = x => cntG(x) ? x.amt : isDev(x) ? -x.amt : 0;
const spent = m => Math.max(0, S.tx.filter(x => mon(x.date)===m).reduce((a,x) => a+gAmt(x), 0));
/* Mes al que cuenta un ingreso: la nómina que llega a partir del día 25 es la del mes siguiente. */
const incMon = x => x.cat==='Nómina' && +x.date.slice(8) >= 25 ? MN(new Date(+x.date.slice(0,4), +x.date.slice(5,7), 1)) : mon(x.date);
const income = m => S.tx.filter(x => x.t==='i' && x.cat!==NOCNT && !isDev(x) && incMon(x)===m);
const byCat = m => { const o = {}; S.tx.filter(x => gAmt(x) && mon(x.date)===m).forEach(x => o[x.cat] = (o[x.cat]||0) + gAmt(x)); return Object.entries(o).filter(e => e[1] > 0.005).sort((a,b) => b[1]-a[1]); };
const col = c => PAL[c] || '#94a3b8';
const nextDue = (d,r) => r==='Anual' ? addM(d,12) : r==='Mensual' ? addM(d,1) : addD(d, r==='Semanal' ? 7 : 1);
const ord = (v,keys) => { const o = S.order[v]||[]; return [...keys].sort((a,b) => { const x = o.indexOf(a), y = o.indexOf(b); return (x<0?1e3+keys.indexOf(a):x) - (y<0?1e3+keys.indexOf(b):y); }); };
const pend = () => ({t:S.tasks.filter(t => !t.done && t.due && dayDiff(t.due)<=0).length, s:S.shop.filter(s => !s.done).length, b:fxDue(7).length});

/* Fondo (se elige en cada dispositivo): ninguno, estrellas (hecho con CSS), el planeta (img/fondo-planeta.jpg, el de serie) o una imagen propia.
   La imagen propia no se sube a ningún sitio.
   Se ve en la portada de Mi día o, si se elige, detrás de toda la app. La imagen se guarda reducida en este navegador. */
const BG = (() => { try { return JSON.parse(localStorage.getItem('ldb-bg')) || {k:'planet', all:false}; } catch(e) { return {k:'planet', all:false}; } })();
const bgSave = () => { try { localStorage.setItem('ldb-bg', JSON.stringify(BG)); } catch(e) {} };
const bgImg = () => { try { return localStorage.getItem('ldb-bgimg') || ''; } catch(e) { return ''; } };
function bgApply(){
  const b = document.body, r = document.documentElement, img = BG.k==='img' ? bgImg() : BG.k==='planet' ? 'img/fondo-planeta.jpg' : '', on = BG.k==='stars' || !!img;
  b.classList.toggle('bg-on', on); b.classList.toggle('bg-all', on && !!BG.all); b.classList.toggle('bg-stars', on && BG.k==='stars');
  if (img) r.style.setProperty('--bgimg', `url("${img}")`); else r.style.removeProperty('--bgimg');
}
/* Imagen propia: se reduce a 1920 px de ancho como mucho y se guarda en JPEG (unos cientos de KB) para que quepa en el navegador. */
function bgFile(f){
  const u = URL.createObjectURL(f), im = new Image();
  im.onload = () => { const s = Math.min(1, 1920/im.width), c = document.createElement('canvas'); c.width = Math.round(im.width*s); c.height = Math.round(im.height*s);
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u);
    try { localStorage.setItem('ldb-bgimg', c.toDataURL('image/jpeg', .82)); BG.k = 'img'; bgSave(); render(); toast('Fondo cambiado'); }
    catch(e) { toast('La imagen es demasiado grande para guardarla aquí: prueba con otra'); } };
  im.onerror = () => { URL.revokeObjectURL(u); toast('No se pudo abrir la imagen'); };
  im.src = u;
}
/* Ancho de cada panel en el ordenador (1/3, 1/2, 2/3 o completo): se elige con el botón del título y se recuerda en este dispositivo.
   Sin elegir, cada sección usa su ancho por defecto (ver «Rejilla de paneles» en styles.css). En el móvil todos ocupan el ancho completo. */
const SZ = (() => { try { return JSON.parse(localStorage.getItem('ldb-size')) || {}; } catch(e) { return {}; } })();
const SZN = {4:'1/3', 6:'1/2', 8:'2/3', 12:'completo'};
/* Panel movible: título a la izquierda; a la derecha, el botón del ancho y el asa para arrastrarlo. */
const panel = (v,k,title,inner,cls='') => { const z = SZ[v+':'+k];
  return `<div class="card ${cls}${z?' sz'+z:''}" data-v="${v}" data-k="${esc(k)}"><h3><span class="t">${title}</span><span class="pa"><button class="ib szb" data-a="sz" data-i="${esc(v+':'+k)}" title="Ancho del panel${z?': '+SZN[z]:''} (toca para cambiarlo)" aria-label="Cambiar el ancho del panel">${I('move-horizontal')}</button><span class="hd" draggable="true" title="Arrastra para mover">${I('grip-vertical')}</span></span></h3>${inner}</div>`; };
/* Muestra las n primeras filas y un botón para desplegar el resto (estado por panel, no se guarda). */
const fold = (k, rows, n) => { const open = exp[k], sh = open ? rows : rows.slice(0,n), more = rows.length - n;
  return sh.join('') + (more > 0 ? `<button class="morebtn" data-a="xp" data-i="${esc(k)}">${open ? I('chevron-up')+'Ver menos' : I('chevron-down')+'Ver '+more+' más'}</button>` : ''); };

/* Texto de una nota con los enlaces convertidos en enlaces que se abren (se ve el dominio). */
const linkify = s => esc(s).replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"]/g, u => { let h = u; try { h = new URL(u.replace(/&amp;/g,'&')).hostname.replace(/^www\./,''); } catch(e){}
  return `<a class="dl" href="${u}" target="_blank" rel="noopener noreferrer">${esc(h)}${I('external-link','sm')}</a>`; });
const taskRow = t => { const n = t.due ? dayDiff(t.due) : null, late = !t.done && n!==null && n<0;
  return `<div class="row ${t.done?'is-done':''}"><input type="checkbox" class="ck" data-a="tt" data-i="${t.id}" ${t.done?'checked':''} aria-label="Completar «${esc(t.title)}»">${tile(ico(t), AC[t.area])}<button class="link" data-a="et" data-i="${t.id}"><span class="tt">${esc(t.title)}</span>${t.rep?`<span class="mu" title="Se repite ${t.rep.toLowerCase()}">${I('repeat','sm')}</span>`:''}${prChip(t.pr)}${t.notes&&t.notes.length?`<span class="mu nc" title="${t.notes.length} nota${t.notes.length>1?'s':''}">${I('message-square','sm')}${t.notes.length}</span>`:''}</button><span class="when ${late?'er':n===0&&!t.done?'ac':''}">${rel(t.due)}${t.tm?' · '+t.tm:''}</span><button class="ib" data-a="dt" data-i="${t.id}" aria-label="Eliminar">${I('trash-2')}</button></div>`; };
const fxRow = ({f, d}) => `<div class="row">${tile(CI[f.cat]||'receipt', col(f.cat))}<span class="g">${esc(f.name)}</span><span class="when ${dayDiff(d)<0?'er':dayDiff(d)<=7?'wa':''}">${rel(d)}</span><span class="amt">${eur(f.amt)}</span></div>`;
const expChip = d => d.exp ? `<span class="chip ${dayDiff(d.exp)<0?'er':dayDiff(d.exp)<=60?'wa':''}">${dayDiff(d.exp)<0?'Caducó':'Vence'} ${fd(d.exp)}</span>` : '';
const docRow = d => `<div class="row">${tile(DI[d.cat]||'file-text', DCOL[d.cat])}<span class="g">${d.url?`<a class="dl" href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">${esc(d.name)}${I('external-link','sm')}</a>`:`<span>${esc(d.name)}</span> <button class="btn sm ghost" data-a="ed" data-i="${d.id}">${I('link','sm')} Añadir enlace</button>`}${d.notes||d.exp?`<span class="meta">${expChip(d)}${d.notes?`<span class="mu">${esc(d.notes)}</span>`:''}</span>`:''}</span><button class="ib ${d.pin?'pin':''}" data-a="pd" data-i="${d.id}" aria-label="${d.pin?'Quitar de acceso rápido':'Añadir a acceso rápido'}" title="Acceso rápido en Mi día">${I('star', d.pin?'fill':'')}</button><button class="ib" data-a="ed" data-i="${d.id}" aria-label="Editar">${I('pencil')}</button><button class="ib" data-a="dd" data-i="${d.id}" aria-label="Quitar">${I('x')}</button></div>`;
/* Acceso rápido de Mi día: hasta PINMAX documentos con estrella, en el orden elegido (S.order.pins, flechas en «Personalizar»). */
const PINMAX = 4;
const pinDocs = () => { const p = S.docs.filter(d => d.pin), o = ord('pins', p.map(d => d.id)); VIS.pins = o; return o.map(k => p.find(d => d.id===k)); };
/* Una pastilla por documento que abre el archivo directamente. */
const docTile = d => d.url
  ? `<a class="dtile" href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">${tile(DI[d.cat]||'file-text', DCOL[d.cat])}<span>${esc(d.name)}${d.exp&&dayDiff(d.exp)<=60?`<em class="${dayDiff(d.exp)<0?'er':'wa'}">${dayDiff(d.exp)<0?'Caducó':'Vence'} ${fd(d.exp)}</em>`:''}</span></a>`
  : `<button class="dtile off" data-a="ed" data-i="${d.id}">${tile(DI[d.cat]||'file-text', DCOL[d.cat])}<span>${esc(d.name)}<em>Añadir enlace</em></span></button>`;

function donut(cats, budget, sp, rem){
  const R = 52, C = 2*Math.PI*R, den = Math.max(budget, sp, 1); let off = 0;
  const segs = cats.map(([c,v]) => { const len = v/den*C, g = len > 4 ? 1.5 : 0; const s = `<circle r="${R}" cx="64" cy="64" fill="none" stroke="${col(c)}" stroke-width="13" stroke-dasharray="${Math.max(len-g,0.5)} ${C}" stroke-dashoffset="${-off}"><title>${c}: ${eur(v)}</title></circle>`; off += len; return s; }).join('');
  return `<div class="donut"><svg viewBox="0 0 128 128" role="img" aria-label="Gasto del mes por categoría"><g transform="rotate(-90 64 64)"><circle r="${R}" cx="64" cy="64" fill="none" stroke="color-mix(in srgb,var(--ok) 30%,transparent)" stroke-width="13"/>${segs}</g></svg><div class="c"><b class="${rem<0?'er':''}">${eur(Math.abs(rem))}</b><span>${rem>=0?'disponible':'por encima'}</span></div></div>`;
}
/* Gasto del mes (igual en Mi día y en Finanzas): anillo con lo disponible (verde: tope − gastado; las facturas por pagar se ven debajo), total gastado con una sola línea de contexto
   y todas las categorías en barras (icono, % del gasto y total): a la derecha en el ordenador, debajo en el móvil.
   nav: acción de las flechas para ir a meses anteriores ('fm' en Finanzas, 'gm' en Mi día). */
function gastoHTML(m, nav){
  const top = nav ? `<div class="calh"><button class="ib" data-a="${nav}" data-i="-1" aria-label="Mes anterior">${I('chevron-left')}</button><b>${mLabel(m)}</b><button class="ib" data-a="${nav}" data-i="1" aria-label="Mes siguiente" ${m>=MN(new Date())?'disabled style="opacity:.4"':''}>${I('chevron-right')}</button></div>` : '';
  return top + gastoBody(m);
}
function gastoBody(m){
  const now = new Date(), cur = m===MN(now), sp = spent(m), cats = byCat(m), B = S.budget||0, fl = cur ? fxLeft() : 0, rem = B - sp, pc = B ? sp/B*100 : 0;
  const info = B ? `<b class="${pc>=100?'er':pc>=80?'wa':'ok'}">${Math.round(pc)} %</b> de tu tope` : 'Define un tope en Ajustes';
  const gx = `<div class="gx">${B?donut(cats,B,sp,rem):''}<div class="gxi"><div class="mu">Gastado ${cur?'este mes':'en '+MS[+m.slice(5)]}</div><div class="big">${eur(sp)}</div><div class="mu">${info}</div>${fl&&B?`<div class="mu">Facturas por pagar: ${eur(fl)} · te quedarán ${eur(rem-fl)}</div>`:fl?`<div class="mu">Facturas por pagar: ${eur(fl)}</div>`:''}</div></div>`;
  const txm = S.tx.filter(x => mon(x.date)===m), mx = Math.max(1, ...cats.map(c => c[1]));
  const bars = cats.map(([c,v]) => { const n = txm.filter(x => x.t==='g' && x.cat===c).length; return `<button class="catrow" data-a="cd" data-i="${esc(c)}">${tile(CI[c]||'package', col(c))}<span>${c}<span class="mu" style="display:block;font-size:12px;line-height:1.2">${n} mov. · ${Math.round(v/sp*100)}% del gasto</span></span><b class="amt">${eur(v)}</b>${I('chevron-right','cr')}<div class="bar"><div style="width:${v/mx*100}%;background:${col(c)}"></div></div></button>`; }).join('');
  return `<div class="gxf">${gx}<div class="gxc">${bars || '<div class="mu">Aún sin gastos este mes.</div>'}</div></div>`;
}
/* Festivos: nacionales y autonómicos de date.nager.at (se guardan en este dispositivo por año) + locales a mano. */
const REGIONS = [['','Solo nacionales'],['ES-AN','Andalucía'],['ES-AR','Aragón'],['ES-AS','Asturias'],['ES-IB','Baleares'],['ES-CN','Canarias'],['ES-CB','Cantabria'],['ES-CL','Castilla y León'],['ES-CM','Castilla-La Mancha'],['ES-CT','Cataluña'],['ES-VC','C. Valenciana'],['ES-EX','Extremadura'],['ES-GA','Galicia'],['ES-MD','Madrid'],['ES-MC','Murcia'],['ES-NC','Navarra'],['ES-PV','País Vasco'],['ES-RI','La Rioja'],['ES-CE','Ceuta'],['ES-ML','Melilla']];
const HOL = {};
function holLoad(y){
  if (HOL[y]) return; HOL[y] = [];
  try { const c = JSON.parse(localStorage.getItem('ldb-hol-'+y)); if (Array.isArray(c) && c.length) { HOL[y] = c; return; } } catch(e) {}
  fetch('https://date.nager.at/api/v3/PublicHolidays/'+y+'/ES').then(r => r.ok ? r.json() : []).then(a => {
    HOL[y] = a.filter(h => (h.types||[]).includes('Public')).map(h => ({d:h.date, n:h.localName, c:h.counties||null}));
    try { localStorage.setItem('ldb-hol-'+y, JSON.stringify(HOL[y])); } catch(e) {}
    if ($('#nav').innerHTML) render();   // no repintar encima de la pantalla de inicio de sesión
  }).catch(() => {});
}
/* Festivos que la comunidad pasa al lunes por caer en domingo (date.nager.at no los trae). Sale del decreto de cada año:
   añadir aquí los del año nuevo cuando se publiquen. */
const TRAS = {
  'ES-AN': {'2026-11-01':'2026-11-02', '2026-12-06':'2026-12-07', '2027-02-28':'2027-03-01', '2027-08-15':'2027-08-16'}  // BOJA 93/2025 y 84/2026
};
const holidays = y => { holLoad(y); const tr = TRAS[S.region] || {};
  return [...HOL[y].filter(h => !h.c || (S.region && h.c.includes(S.region))).map(h => tr[h.d] ? {d:tr[h.d], n:h.n+' (trasladado)'} : {d:h.d, n:h.n}), ...S.localHol.filter(h => h.d.startsWith(y+'-')).map(h => ({d:h.d, n:h.n}))]; };
const holOn = d => holidays(+d.slice(0,4)).filter(h => h.d===d);
const perOn = d => S.periods.filter(p => p.from<=d && d<=p.to);
const perRow = p => `<div class="row">${tile('sun','#2fcf7a')}<span class="g">${esc(p.name)}<span class="meta"><span class="mu">del ${fd(p.from)} al ${fd(p.to)} · ${dd(p.to,p.from)+1} días</span></span></span><span class="when ${dayDiff(p.from)<=0&&dayDiff(p.to)>=0?'ok':''}">${dayDiff(p.from)>0?rel(p.from):dayDiff(p.to)>=0?'ahora':'pasadas'}</span></div>`;
const holRow = h => `<div class="row">${tile('sparkles','#ff5d5d')}<span class="g">${esc(h.n)}<span class="meta"><span class="mu">Festivo</span></span></span><span class="when">${rel(h.d)}</span></div>`;

function calHTML(){
  const y = cm.getFullYear(), mo = cm.getMonth(), off = (new Date(y,mo,1).getDay()+6)%7, n = new Date(y,mo+1,0).getDate(), sd = selD || TD();
  const sm = salDays(), sTip = k => sm.has(k) ? (sm.get(k) ? 'Salud (previsto)' : 'Salud') : '';
  let c = ['L','M','X','J','V','S','D'].map(d => `<div class="wd">${d}</div>`).join('') + '<div></div>'.repeat(off);
  for (let d=1; d<=n; d++) {
    const k = y+'-'+p2(mo+1)+'-'+p2(d), dt = S.tasks.filter(t => !t.done && t.due===k), cb = dt.filter(t => t.area==='Cumpleaños').length, q = dt.length - cb, h = holOn(k), v = perOn(k);
    const tip = [...dt.filter(t => t.area==='Cumpleaños').map(t => t.title), ...h.map(x => x.n), ...v.map(x => x.name), sTip(k)].filter(Boolean).join(' · ');
    c += `<button class="${k===TD()?'t':''} ${k===sd?'sel':''} ${h.length?'hol':''} ${v.length?'vac':''} ${cb?'bdy':''} ${sm.has(k)?(sm.get(k)?'sal salp':'sal'):''}" data-a="sd" data-i="${k}" aria-label="${fd(k)}${tip?' · '+esc(tip):''}" ${tip?`title="${esc(tip)}"`:''}>${d}<span class="dots">${cb ? I('cake','bd') : ''}${'<i></i>'.repeat(Math.min(q, cb ? 2 : 3))}</span></button>`;
  }
  const isT = sd===TD(), dl = isT ? [] : S.tasks.filter(t => t.due===sd && !oldDone(t)).sort((a,b) => (a.tm||'').localeCompare(b.tm||'')), hl = holOn(sd), vl = perOn(sd);
  const sl = sm.has(sd) ? `<div class="row">${tile('heart-pulse','var(--rose)')}<span class="g">${sTip(sd)}</span></div>` : '';
  const day = hl.map(holRow).join('') + sl + vl.map(perRow).join('') + dl.map(taskRow).join('');
  return `<div class="calh"><button class="ib" data-a="pm" data-i="-1" aria-label="Mes anterior">${I('chevron-left')}</button><b>${cap(new Intl.DateTimeFormat('es-ES',{month:'long',year:'numeric'}).format(cm))}</b><button class="ib" data-a="pm" data-i="1" aria-label="Mes siguiente">${I('chevron-right')}</button></div><div class="cal">${c}</div><div class="calk"><span><i class="kh"></i>Festivo</span><span><i class="kv"></i>Vacaciones</span>${sm.size?'<span><i class="ks"></i>Salud</span><span><i class="ksp"></i>Previsto</span>':''}<span><i class="kt"></i>Tareas</span><span><i class="kbd"></i>Cumpleaños</span></div>${isT && !day ? '' : `<div class="dh">${isT?'Hoy':rel(sd)} · ${fd(sd)}</div>${day || empty('Nada este día.')}`}`;
}
function bankAlerts(){
  const a = [];
  if (BANK && BANK.valid_until) { const n = dayDiff(BANK.valid_until.slice(0,10)); if (n <= 14) a.push([BANK.valid_until.slice(0,10), 'landmark', `${n<0?'Ha caducado':'Caduca'} el permiso del banco: renuévalo (guía, paso 6)`, '#ff5d5d']); }
  // Un fallo suelto de Openbank no se avisa; solo si se repite (o si es un error real, que deja fail_count alto).
  if (BANK && BANK.last_error && (BANK.fail_count||0) >= FAILMAX) a.push([TD(), 'landmark', 'La sincronización con el banco lleva varios fallos seguidos', '#ff5d5d']);
  return a;
}

