'use strict';
/* Pintar la sección actual, el menú y el tema. */
/* ---------- render ---------- */
const V_ = {dia:vDia, tareas:vTareas, compra:vCompra, fin:vFin, fact:vFact, docs:vDocs, inv:vInv, salud:vSalud, ajus:vAjus};
function theme(){ const r = document.documentElement; S.theme==='light' || S.theme==='blue' ? r.setAttribute('data-theme',S.theme) : r.removeAttribute('data-theme'); const mc = document.querySelector('meta[name=theme-color]'); if (mc) mc.content = {light:'#eceff4', blue:'#091629'}[S.theme] || '#0f141a'; }
function nav(){
  const c = pend(), n = {tareas:c.t, compra:c.s, fact:c.b}, MAIN = bar();
  $('#nav').innerHTML = `<div class="brand"><span class="logo"><i><b></b><b></b><b></b><b></b></i></span>${APP}</div>` +
    secs().map(([k,e,l,s]) => `<button class="nv ${view===k?'on':''} ${MAIN.includes(k)?'':'sec2'}" data-a="go" data-i="${k}" title="Arrastra para cambiar el orden" ${view===k?'aria-current="page"':''}><span class="e">${I(e)}</span><span class="l">${l}</span><span class="s">${s}</span>${n[k]?`<i class="badge">${n[k]}</i>`:''}</button>`).join('') +
    (() => { const m = secs().filter(x => !MAIN.includes(x[0])), b = m.reduce((a,x) => a+(n[x[0]]||0), 0), on = m.some(x => x[0]===view);
      return `<button class="nv more ${on?'on':''}" data-a="more"><span class="e">${I('menu')}</span><span class="s">${on ? SEC.find(x => x[0]===view)[3] : 'Más'}</span>${b?`<i class="badge">${b}</i>`:''}</button>`; })() +
    `<div class="navfoot"><span id="syncst">${syncTxt}</span>${user?`<span>${esc(user.email)}</span>`:''}</div>`;
}
function render(){
  theme(); nav();
  const y = window.scrollY, same = render.last === view;
  if (!same) cust = false;
  $('#m').innerHTML = V_[view]();
  render.last = view;
  // «Personalizar»: las flechas y el asa para mover tarjetas solo se ven mientras está activo.
  document.body.classList.toggle('cust', cust);
  const hd = $('#m .hdr');
  // Botón pequeño junto al título (icono); activo, muestra «Listo».
  const h2 = hd && hd.querySelector('h2');
  if (h2 && (VIS[view]||[]).length > 1)
    h2.insertAdjacentHTML('beforeend', `<button class="ib custb ${cust?'on':''}" data-a="cust" aria-pressed="${cust}" aria-label="${cust?'Listo':'Personalizar: mover tarjetas'}" title="${cust?'Listo':'Personalizar: mover tarjetas'}">${I(cust?'check':'grip-vertical')}</button>`);
  masonry();
  if (!same) window.scrollTo(0,0); else window.scrollTo(0,y);
}
/* Ordenador: paneles tipo mosaico. La rejilla tiene filas de 8 px y cada tarjeta ocupa las filas que mide, así las
   cortas se encajan bajo otras sin dejar huecos. Un ResizeObserver lo recalcula al abrir, plegar o cargar más. */
const MQD = matchMedia('(min-width:761px)');
const masoRO = 'ResizeObserver' in window ? new ResizeObserver(es => es.forEach(e => masoFit(e.target))) : null;
function masoFit(c){
  if (!MQD.matches || !c.parentElement || !c.parentElement.classList.contains('maso')) { c.style.gridRowEnd = ''; return; }
  const n = Math.ceil((c.getBoundingClientRect().height + 16) / 8);
  if (c.style.gridRowEnd !== 'span ' + n) c.style.gridRowEnd = 'span ' + n;
}
function masonry(){
  document.querySelectorAll('#m .grid, #m .grid2').forEach(g => {
    g.classList.toggle('maso', MQD.matches);
    [...g.children].forEach(c => { masoFit(c); if (masoRO) masoRO.observe(c); });
  });
}
MQD.addEventListener && MQD.addEventListener('change', masonry);
const ch = () => { save(); render(); };


/* Móvil: los botones + y micrófono se esconden al bajar (para no tapar contenido) y vuelven al subir o al llegar arriba. */
(() => { let ly = window.scrollY;
  window.addEventListener('scroll', () => { const f = document.querySelector('.fabs'); if (!f) return; const y = window.scrollY;
    if (!matchMedia('(max-width:760px)').matches || y < 80) f.classList.remove('off');
    else if (Math.abs(y - ly) > 6) f.classList.toggle('off', y > ly);
    ly = y; }, {passive:true}); })();
