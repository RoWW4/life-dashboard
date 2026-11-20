'use strict';
/* Pintar la sección actual, el menú y el tema. */
/* ---------- render ---------- */
const V_ = {
  dia: vDia,
  tareas: vTareas,
  compra: vCompra,
  fin: vFin,
  fact: vFact,
  docs: vDocs,
  inv: vInv,
  res: vRes,
  salud: vSalud,
  coche: vCoche,
  mascotas: vMascotas,
  ajus: vAjus
};
function theme() {
  const r = document.documentElement;
  S.theme === 'light' || S.theme === 'blue' ? r.setAttribute('data-theme', S.theme) : r.removeAttribute('data-theme');
  const mc = document.querySelector('meta[name=theme-color]');
  if (mc) mc.content = { light: '#efefeb', blue: '#08101d' }[S.theme] || '#0c0d0f';
}
function nav() {
  const c = pend(),
    n = { tareas: c.t, compra: c.s, fin: c.b },
    nt = { tareas: badgeTxt('t', c.t), compra: badgeTxt('s', c.s), fin: badgeTxt('b', c.b) },
    sv = secOf(view),
    bar = ['dia', 'ajus', ...barKeys()];
  $('#nav').classList.toggle('all', !!S.navAll);
  $('#nav').innerHTML =
    `<div class="brand"><span class="logo"><i><b></b><b></b><b></b><b></b></i></span><span class="bn">${APP}</span>${eyeBtn('ib eyeg')}</div>` +
    secs()
      .filter(([k]) => !navOff(k) || !navOffPc(k))
      .map(
        ([k, e, l, s]) =>
          `<button class="nv ${sv === k ? 'on' : ''}${bar.includes(k) ? '' : ' xb'}${navOff(k) ? ' moff' : ''}${navOffPc(k) ? ' pcoff' : ''}" data-a="go" data-i="${k}" title="${n[k] ? nt[k] + ' · ' : ''}Arrastra para cambiar el orden" aria-label="${l}${n[k] ? ': ' + nt[k] : ''}" ${sv === k ? 'aria-current="page"' : ''}><span class="e">${I(e)}</span><span class="l">${l}</span><span class="s">${s}</span>${n[k] ? `<i class="badge" title="${nt[k]}">${n[k]}</i>` : ''}</button>`
      )
      .join('') +
    // Móvil: «Más» abre las secciones que no van en la barra (en el ordenador no se ve).
    (S.navAll
      ? ''
      : `<button class="nv more ${bar.includes(sv) ? '' : 'on'}" data-a="nmas" aria-label="Más secciones" style="--c:var(--ac)"><span class="e">${I('menu')}</span><span class="l">Más</span><span class="s">Más</span></button>`) +
    `<div class="navfoot"><span id="syncst">${syncTxt}</span>${user ? `<span>${esc(user.email)}</span>` : ''}</div>`;
  // Móvil: Ajustes sale de la barra y queda como botón redondo arriba a la derecha.
  const a = $('#ajb');
  a.innerHTML = I('settings');
  a.classList.toggle('on', view === 'ajus');
  // Móvil: el ojo de los importes, a la izquierda de Ajustes.
  $('#eyeb').outerHTML = eyeBtn('ajb eyeb').replace('<button ', '<button id="eyeb" ');
  document.body.classList.toggle('priv', !showMoney);
}
function render() {
  theme();
  bgApply();
  nav();
  const y = window.scrollY,
    same = render.last === view;
  if (!V_[view]) view = 'dia';
  ord.last = null;
  let h = V_[view]();
  // Al final de la sección: elegir qué paneles se ven (si tiene más de uno).
  const pv = ord.last,
    pk = pv ? (ALLK[pv] || []).filter(k => PT[pv + ':' + k]) : [],
    nh = pv ? ((S.hidP || {})[pv] || []).filter(k => pk.includes(k)).length : 0;
  if (pk.length > 1)
    h += `<div class="pnlb"><button class="btn ghost sm" data-a="pnl" data-i="${esc(pv)}">${I('eye', 'sm')} Mostrar u ocultar paneles${nh ? ` <span class="mu">· ${nh} oculto${nh === 1 ? '' : 's'}</span>` : ''}</button></div>`;
  // Finanzas: título común y pestañas; cada vista conserva su cabecera (subtítulo y botones) sin su título.
  if (DIN.some(x => x[0] === view)) {
    dinLast = view;
    h =
      `<div class="hdr dinh"><div><h2>Finanzas</h2></div></div><div class="seg dtabs" role="tablist" aria-label="Finanzas">${DIN.map(
        ([k, l]) => {
          const b = k === 'fact' ? pend().b : 0;
          return `<button role="tab" class="${view === k ? 'on' : ''}" aria-selected="${view === k}" data-a="go" data-i="${k}"${b ? ` title="${badgeTxt('b', b)}"` : ''}>${l}${b ? `<i class="badge" aria-label="${badgeTxt('b', b)}">${b}</i>` : ''}</button>`;
        }
      ).join('')}</div>` + h.replace(/<h2>[^<]*<\/h2>/, '');
  }
  $('#m').innerHTML = h;
  // Al cambiar de sección, las tarjetas entran en cascada y las barras crecen desde cero (clase .enter, solo un momento).
  if (!same) {
    const m = $('#m');
    m.querySelectorAll('.card, .kpi, .hs, .acct').forEach((c, i) => c.style.setProperty('--i', Math.min(i, 10)));
    m.classList.add('enter');
    clearTimeout(render.ent);
    render.ent = setTimeout(() => m.classList.remove('enter'), 1100);
  }
  render.last = view;
  try {
    sessionStorage.setItem('ldb-view', view);
  } catch (e) {
    logErr('almacenamiento', e, 'sección');
  }
  // Cada tarjeta lleva siempre su asa (arrastrar) y sus flechas ↑↓; si la sección solo tiene una, no se enseñan.
  document.body.classList.toggle('solo', (VIS[view] || []).length < 2);
  masonry();
  if (view === 'coche') carMapMount(); // mapa de dónde está aparcado (si está abierto)
  if (!same && (view === 'fin' || view === 'inv')) requestAnimationFrame(countUp); // después de envolver las cifras (wrapMoney)
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
