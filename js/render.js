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
  if (hd && (VIS[view]||[]).length > 1) {
    let a = hd.querySelector('.hact'); if (!a) { a = document.createElement('div'); a.className = 'hact'; hd.appendChild(a); }
    a.insertAdjacentHTML('afterbegin', `<button class="btn ${cust?'':'ghost'}" data-a="cust" aria-pressed="${cust}">${I(cust?'check':'grip-vertical')} ${cust?'Listo':'Personalizar'}</button>`);
  }
  if (!same) window.scrollTo(0,0); else window.scrollTo(0,y);
}
const ch = () => { save(); render(); };

