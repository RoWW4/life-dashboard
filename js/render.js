'use strict';
/* Pintar la sección actual, el menú y el tema. */
/* ---------- render ---------- */
const V_ = { dia: vDia, tareas: vTareas, compra: vCompra, fin: vFin, fact: vFact, docs: vDocs, inv: vInv, salud: vSalud, ajus: vAjus };
function theme() {
  const r = document.documentElement;
  S.theme === 'light' || S.theme === 'blue' ? r.setAttribute('data-theme', S.theme) : r.removeAttribute('data-theme');
  const mc = document.querySelector('meta[name=theme-color]');
  if (mc) mc.content = { light: '#efefeb', blue: '#08101d' }[S.theme] || '#0c0d0f';
}
function nav() {
  const c = pend(),
    n = { tareas: c.t, compra: c.s, fact: c.b };
  $('#nav').innerHTML =
    `<div class="brand"><span class="logo"><i><b></b><b></b><b></b><b></b></i></span>${APP}</div>` +
    secs()
      .map(
        ([k, e, l, s]) =>
          `<button class="nv ${view === k ? 'on' : ''}" data-a="go" data-i="${k}" title="Arrastra para cambiar el orden" aria-label="${l}" ${view === k ? 'aria-current="page"' : ''}><span class="e">${I(e)}</span><span class="l">${l}</span><span class="s">${s}</span>${n[k] ? `<i class="badge">${n[k]}</i>` : ''}</button>`
      )
      .join('') +
    `<div class="navfoot"><span id="syncst">${syncTxt}</span>${user ? `<span>${esc(user.email)}</span>` : ''}</div>`;
  // Móvil: Ajustes sale de la barra y queda como botón redondo arriba a la derecha.
  const a = $('#ajb');
  a.innerHTML = I('settings');
  a.classList.toggle('on', view === 'ajus');
}
function render() {
  theme();
  bgApply();
  nav();
  const y = window.scrollY,
    same = render.last === view;
  if (!same) cust = false;
  if (!V_[view]) view = 'dia';
  $('#m').innerHTML = V_[view]();
  render.last = view;
  try {
    sessionStorage.setItem('ldb-view', view);
  } catch (e) {
    logErr('almacenamiento', e, 'sección');
  }
  // Cada tarjeta lleva siempre su asa (arrastrar) y sus flechas ↑↓; si la sección solo tiene una, no se enseñan.
  // «cust» queda solo para ordenar los documentos a mano de Mi día.
  document.body.classList.toggle('cust', cust);
  document.body.classList.toggle('solo', (VIS[view] || []).length < 2);
  masonry();
  if (!same) window.scrollTo(0, 0);
  else window.scrollTo(0, y);
}
/* Ordenador: paneles tipo mosaico. La rejilla tiene filas de 8 px y cada tarjeta ocupa las filas que mide, así las
   cortas se encajan bajo otras sin dejar huecos. Un ResizeObserver lo recalcula al abrir, plegar o cargar más. */
const MQD = matchMedia('(min-width:761px)');
const masoRO = 'ResizeObserver' in window ? new ResizeObserver(es => es.forEach(e => masoFit(e.target))) : null;
function masoFit(c) {
  if (!MQD.matches || !c.parentElement || !c.parentElement.classList.contains('maso')) {
    c.style.gridRowEnd = '';
    return;
  }
  const n = Math.ceil((c.getBoundingClientRect().height + 16) / 8);
  if (c.style.gridRowEnd !== 'span ' + n) c.style.gridRowEnd = 'span ' + n;
}
function masonry() {
  document.querySelectorAll('#m .grid, #m .grid2').forEach(g => {
    g.classList.toggle('maso', MQD.matches);
    [...g.children].forEach(c => {
      masoFit(c);
      if (masoRO) masoRO.observe(c);
    });
  });
}
MQD.addEventListener && MQD.addEventListener('change', masonry);
const ch = () => {
  save();
  render();
};

/* Móvil: al bajar, los botones + y micrófono se esconden y la barra se encoge (para no tapar contenido);
   al subir o al llegar arriba vuelven a su tamaño. */
(() => {
  let ly = window.scrollY;
  window.addEventListener(
    'scroll',
    () => {
      const f = document.querySelector('.fabs'),
        nv = $('#nav'),
        y = window.scrollY;
      let off = null;
      if (!matchMedia('(max-width:760px)').matches || y < 80) off = false;
      else if (Math.abs(y - ly) > 6) off = y > ly;
      if (off !== null) {
        if (f) f.classList.toggle('off', off);
        nv.classList.toggle('mini', off);
      }
      ly = y;
    },
    { passive: true }
  );
})();
