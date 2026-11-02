'use strict';
/* Eventos: clics, cambios, arrastrar tarjetas y ordenar el menú. */
/* ---------- eventos ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b || b.tagName==='SELECT' || !A[b.dataset.a]) return;
  if (b.tagName==='A') e.preventDefault();
  A[b.dataset.a](b.dataset.i, b);
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.tagName==='SELECT' && t.dataset.a && A[t.dataset.a]) A[t.dataset.a](t.dataset.i, t);
  if (t.id==='im' && t.files[0]) { const r = new FileReader(); r.onload = () => { try { const d = JSON.parse(r.result); if (!Array.isArray(d.tasks)) throw 0; S = normalize(d); seed(); ch(); toast('Copia restaurada'); } catch(x) { toast('Archivo no válido'); } }; r.readAsText(t.files[0]); }
  if (t.id==='bgfile' && t.files[0]) bgFile(t.files[0]);
  if (t.id==='bankfile' && t.files[0]) importFile(t.files[0]).catch(() => toast('No se pudo leer el archivo'));
});
document.addEventListener('input', e => { if (e.target.id==='txq') { txf.q = e.target.value; txRefresh(); } });
document.addEventListener('keydown', e => {
  if (e.key==='Enter' && e.target.tagName==='INPUT' && !e.target.closest('.ov')) { const b = e.target.closest('.f,.quick,.login')?.querySelector('button[data-a]'); if (b) { e.preventDefault(); b.click(); } }
  if (e.key==='n' && !/INPUT|SELECT|TEXTAREA/.test(e.target.tagName) && !document.querySelector('.ov') && user!==undefined) { e.preventDefault(); addPicker(); }
});
let drag = null;
// Menú lateral: con el ratón, mantener pulsada una sección y soltarla sobre otra la coloca en su sitio (S.order.nav).
// Se hace con el puntero y no con el arrastre nativo porque algunos navegadores no dejan arrastrar botones.
let navDrag = null, navEat = false;
addEventListener('click', e => { if (navEat) { e.stopPropagation(); e.preventDefault(); } }, true);
const navAt = (x,y) => { const el = document.elementFromPoint(x,y); return el && el.closest('#nav .nv[data-i]'); };
document.addEventListener('pointerdown', e => { if (e.pointerType!=='mouse' || e.button) return; const b = e.target.closest && e.target.closest('#nav .nv[data-i]'); if (b) navDrag = {k:b.dataset.i, x:e.clientX, y:e.clientY, on:false}; });
document.addEventListener('pointermove', e => { if (!navDrag) return;
  if (!navDrag.on && Math.abs(e.clientY-navDrag.y) + Math.abs(e.clientX-navDrag.x) < 6) return;
  navDrag.on = true; document.body.classList.add('navdrag');
  document.querySelectorAll('#nav .nv[data-i]').forEach(b => { b.classList.toggle('dragging', b.dataset.i===navDrag.k); b.classList.remove('dropt'); });
  const t = navAt(e.clientX, e.clientY); if (t && t.dataset.i!==navDrag.k) t.classList.add('dropt'); });
document.addEventListener('pointerup', e => { const d = navDrag; navDrag = null; if (!d || !d.on) return;
  document.body.classList.remove('navdrag'); document.querySelectorAll('#nav .dragging,#nav .dropt').forEach(b => b.classList.remove('dragging','dropt'));
  // que soltar no cuente como clic en la sección
  navEat = true; setTimeout(() => { navEat = false; }, 0);
  const t = navAt(e.clientX, e.clientY); if (!t || t.dataset.i===d.k) return nav();
  const keys = secs().map(x => x[0]), fi = keys.indexOf(d.k), ti = keys.indexOf(t.dataset.i); keys.splice(fi,1); keys.splice(fi<ti ? keys.indexOf(t.dataset.i)+1 : keys.indexOf(t.dataset.i), 0, d.k); S.order.nav = keys; ch(); toast('Orden del menú guardado'); });
document.addEventListener('dragstart', e => { const h = e.target.closest && e.target.closest('.hd'); if (!h) return; const c = h.closest('.card'); drag = {v:c.dataset.v, k:c.dataset.k}; c.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', drag.k); try { e.dataTransfer.setDragImage(c,20,20); } catch(x) {} });
document.addEventListener('dragover', e => { if (drag && e.target.closest && e.target.closest('.card[data-k]')) e.preventDefault(); });
// Soltar la tarjeta arrastrada sobre otra de la misma sección: se coloca en su sitio y se guarda el orden.
const dropOn = c => { if (!drag) return false; if (!c || c.dataset.v!==drag.v || c.dataset.k===drag.k) { drag = null; return false; } const keys = [...(VIS[drag.v]||[])], fi = keys.indexOf(drag.k), ti = keys.indexOf(c.dataset.k); if (fi<0||ti<0) { drag = null; return false; } keys.splice(fi,1); const nt2 = keys.indexOf(c.dataset.k); keys.splice(fi<ti?nt2+1:nt2, 0, drag.k); S.order[drag.v] = keys; drag = null; ch(); return true; };
document.addEventListener('drop', e => { if (!drag) return; const c = e.target.closest && e.target.closest('.card[data-k]'); if (dropOn(c)) e.preventDefault(); });
const dragEnd = () => { drag = null; document.querySelectorAll('.dragging,.dropto').forEach(x => x.classList.remove('dragging','dropto')); };
document.addEventListener('dragend', dragEnd);
// Móvil: el arrastre normal no funciona con el dedo; se arrastra desde el asa (⋮⋮) de cada tarjeta.
const cardAt = (x,y) => { const el = document.elementFromPoint(x,y); return el && el.closest && el.closest('.card[data-k]'); };
document.addEventListener('touchstart', e => { const h = e.target.closest && e.target.closest('.hd'); if (!h) return; const c = h.closest('.card'); drag = {v:c.dataset.v, k:c.dataset.k}; c.classList.add('dragging'); }, {passive:true});
document.addEventListener('touchmove', e => { if (!drag) return; e.preventDefault(); const t = e.touches[0], c = cardAt(t.clientX, t.clientY);
  document.querySelectorAll('.dropto').forEach(x => x !== c && x.classList.remove('dropto')); if (c && c.dataset.v===drag.v && c.dataset.k!==drag.k) c.classList.add('dropto');
  if (t.clientY < 60) window.scrollBy(0,-12); else if (t.clientY > innerHeight-60) window.scrollBy(0,12); }, {passive:false});
document.addEventListener('touchend', e => { if (!drag) return; const t = e.changedTouches[0], c = cardAt(t.clientX, t.clientY); document.querySelectorAll('.dragging,.dropto').forEach(x => x.classList.remove('dragging','dropto')); if (!dropOn(c)) drag = null; });
document.addEventListener('touchcancel', dragEnd);
document.addEventListener('visibilitychange', async () => { if (document.visibilityState==='visible' && cloudOK && await pull()) render(); });
window.addEventListener('online', async () => { if (user && await pull()) render(); });

