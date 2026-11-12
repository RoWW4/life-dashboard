'use strict';
/* Eventos: clics, cambios, arrastrar tarjetas y ordenar el menú. */
/* ---------- eventos ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-a]');
  if (!b || b.tagName === 'SELECT' || !A[b.dataset.a]) return;
  if (b.tagName === 'A') e.preventDefault();
  A[b.dataset.a](b.dataset.i, b);
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.tagName === 'SELECT' && t.dataset.a && A[t.dataset.a]) A[t.dataset.a](t.dataset.i, t);
  if (t.id === 'im' && t.files[0]) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        if (!Array.isArray(d.tasks)) throw 0;
        S = normalize(d);
        seed();
        ch();
        toast('Copia restaurada');
      } catch (x) {
        toast('Archivo no válido');
      }
    };
    r.readAsText(t.files[0]);
  }
  if (t.id === 'bgfile' && t.files[0]) bgFile(t.files[0]);
  if (t.id === 'bankfile' && t.files[0]) importFile(t.files[0]).catch(() => toast('No se pudo leer el archivo'));
});
document.addEventListener('input', e => {
  if (e.target.id === 'txq') {
    txf.q = e.target.value;
    txRefresh();
  }
});
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role=button][data-a]')) {
    e.preventDefault();
    e.target.click();
    return;
  }
  if (e.key === 'Enter' && e.target.tagName === 'INPUT' && !e.target.closest('.ov')) {
    const b = e.target.closest('.f,.quick,.login')?.querySelector('button[data-a]');
    if (b) {
      e.preventDefault();
      b.click();
    }
  }
  if (e.key === 'n' && !/INPUT|SELECT|TEXTAREA/.test(e.target.tagName) && !document.querySelector('.ov') && user !== undefined) {
    e.preventDefault();
    addPicker();
  }
});
let drag = null;
// Menú lateral: con el ratón, mantener pulsada una sección y soltarla sobre otra la coloca en su sitio (S.order.nav).
// Se hace con el puntero y no con el arrastre nativo porque algunos navegadores no dejan arrastrar botones.
let navDrag = null,
  navEat = false;
addEventListener(
  'click',
  e => {
    if (navEat) {
      e.stopPropagation();
      e.preventDefault();
    }
  },
  true
);
const navAt = (x, y) => {
  const el = document.elementFromPoint(x, y);
  return el && el.closest('#nav .nv[data-i]');
};
document.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'mouse' || e.button) return;
  const b = e.target.closest && e.target.closest('#nav .nv[data-i]');
  if (b) navDrag = { k: b.dataset.i, x: e.clientX, y: e.clientY, on: false };
});
document.addEventListener('pointermove', e => {
  if (!navDrag) return;
  if (!navDrag.on && Math.abs(e.clientY - navDrag.y) + Math.abs(e.clientX - navDrag.x) < 6) return;
  navDrag.on = true;
  document.body.classList.add('navdrag');
  document.querySelectorAll('#nav .nv[data-i]').forEach(b => {
    b.classList.toggle('dragging', b.dataset.i === navDrag.k);
    b.classList.remove('dropt');
  });
  const t = navAt(e.clientX, e.clientY);
  if (t && t.dataset.i !== navDrag.k) t.classList.add('dropt');
});
document.addEventListener('pointerup', e => {
  const d = navDrag;
  navDrag = null;
  if (!d || !d.on) return;
  document.body.classList.remove('navdrag');
  document.querySelectorAll('#nav .dragging,#nav .dropt').forEach(b => b.classList.remove('dragging', 'dropt'));
  // que soltar no cuente como clic en la sección
  navEat = true;
  setTimeout(() => {
    navEat = false;
  }, 0);
  const t = navAt(e.clientX, e.clientY);
  if (!t || t.dataset.i === d.k) return nav();
  const keys = secs().map(x => x[0]),
    fi = keys.indexOf(d.k),
    ti = keys.indexOf(t.dataset.i);
  keys.splice(fi, 1);
  keys.splice(fi < ti ? keys.indexOf(t.dataset.i) + 1 : keys.indexOf(t.dataset.i), 0, d.k);
  S.order.nav = keys;
  ch();
  toast('Orden del menú guardado');
});
document.addEventListener('dragstart', e => {
  const h = e.target.closest && e.target.closest('.hd');
  if (!h) return;
  const c = h.closest('.card');
  drag = { v: c.dataset.v, k: c.dataset.k };
  c.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', drag.k);
  try {
    e.dataTransfer.setDragImage(c, 20, 20);
  } catch (x) {}
});
document.addEventListener('dragover', e => {
  if (drag && e.target.closest && e.target.closest('.card[data-k]')) e.preventDefault();
});
// Soltar la tarjeta arrastrada sobre otra de la misma sección: se coloca en su sitio y se guarda el orden.
const dropOn = c => {
  if (!drag) return false;
  if (!c || c.dataset.v !== drag.v || c.dataset.k === drag.k) {
    drag = null;
    return false;
  }
  const keys = [...(VIS[drag.v] || [])],
    fi = keys.indexOf(drag.k),
    ti = keys.indexOf(c.dataset.k);
  if (fi < 0 || ti < 0) {
    drag = null;
    return false;
  }
  keys.splice(fi, 1);
  const nt2 = keys.indexOf(c.dataset.k);
  keys.splice(fi < ti ? nt2 + 1 : nt2, 0, drag.k);
  S.order[drag.v] = keys;
  if (drag.v === 'ajus') {
    const g = ajGrp(c.dataset.k);
    if (g !== ajGrp(drag.k)) S.order.ajusg = [...(S.order.ajusg || []).filter(x => x.split(':')[0] !== drag.k), drag.k + ':' + g];
  }
  drag = null;
  ch();
  return true;
};
document.addEventListener('drop', e => {
  if (!drag) return;
  const c = e.target.closest && e.target.closest('.card[data-k]');
  if (dropOn(c)) e.preventDefault();
});
const dragEnd = () => {
  drag = null;
  document.querySelectorAll('.dragging,.dropto').forEach(x => x.classList.remove('dragging', 'dropto'));
};
document.addEventListener('dragend', dragEnd);
// Móvil: el arrastre normal no funciona con el dedo; se arrastra desde el asa (⋮⋮) de cada tarjeta.
const cardAt = (x, y) => {
  const el = document.elementFromPoint(x, y);
  return el && el.closest && el.closest('.card[data-k]');
};
// Hay que mantener pulsada el asa un segundo (vibra un poco) para mover: así deslizar para hacer scroll no mueve paneles sin querer.
let lp = null,
  dragY = null;
// Mientras se arrastra con el dedo cerca del borde de arriba o de abajo, la página se desplaza sola (aunque el dedo no se mueva).
const autoScroll = () => {
  if (!drag || dragY === null) return;
  const e = 90;
  if (dragY < e) window.scrollBy(0, -Math.ceil((e - dragY) / 6));
  else if (dragY > innerHeight - e) window.scrollBy(0, Math.ceil((dragY - innerHeight + e) / 6));
  requestAnimationFrame(autoScroll);
};
const reordOff = () => {
  dragY = null;
  document.body.classList.remove('reord');
};
const lpOff = () => {
  if (lp) clearTimeout(lp.t);
  lp = null;
};
document.addEventListener(
  'touchstart',
  e => {
    lpOff();
    const h = e.target.closest && e.target.closest('.hd');
    if (!h || e.touches.length > 1) return;
    const c = h.closest('.card'),
      t = e.touches[0];
    lp = {
      x: t.clientX,
      y: t.clientY,
      t: setTimeout(() => {
        lp = null;
        drag = { v: c.dataset.v, k: c.dataset.k };
        c.classList.add('dragging');
        // Las tarjetas se encogen a solo su título mientras se arrastra, así caben todas en la pantalla
        // (si no, para llegar a una lejana había que pasar por encima de las largas, como Movimientos).
        document.body.classList.add('reord');
        const r = c.getBoundingClientRect();
        window.scrollBy(0, r.top + r.height / 2 - t.clientY);
        dragY = t.clientY;
        autoScroll();
        try {
          navigator.vibrate && navigator.vibrate(20);
        } catch (x) {}
      }, 1000)
    };
  },
  { passive: true }
);
document.addEventListener(
  'touchmove',
  e => {
    if (lp) {
      const t = e.touches[0];
      if (Math.abs(t.clientX - lp.x) + Math.abs(t.clientY - lp.y) > 10) lpOff();
    }
  },
  { passive: true }
);
document.addEventListener('contextmenu', e => {
  if (e.target.closest && e.target.closest('.hd')) e.preventDefault();
});
document.addEventListener(
  'touchmove',
  e => {
    if (!drag) return;
    e.preventDefault();
    const t = e.touches[0],
      c = cardAt(t.clientX, t.clientY);
    document.querySelectorAll('.dropto').forEach(x => x !== c && x.classList.remove('dropto'));
    if (c && c.dataset.v === drag.v && c.dataset.k !== drag.k) c.classList.add('dropto');
    dragY = t.clientY;
  },
  { passive: false }
);
document.addEventListener('touchend', e => {
  lpOff();
  if (!drag) return;
  const t = e.changedTouches[0],
    c = cardAt(t.clientX, t.clientY);
  document.querySelectorAll('.dragging,.dropto').forEach(x => x.classList.remove('dragging', 'dropto'));
  reordOff();
  if (!dropOn(c)) drag = null;
});
document.addEventListener('touchcancel', () => {
  lpOff();
  reordOff();
  dragEnd();
});
// Al volver a la app se sincroniza, también si la última vez falló (antes solo si la nube iba bien).
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && user && (await pull())) render();
});
window.addEventListener('online', async () => {
  if (user && (await pull())) render();
});

/* Móvil: deslizar el contenido a izquierda o derecha pasa a la sección siguiente o anterior de la barra.
   No salta si el dedo empieza en algo que se desliza de lado, en un campo, en una ventana o en el asa de una tarjeta. */
let sw = null;
const hScroll = el => {
  for (; el && el !== document.body; el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth + 2 && /auto|scroll/.test(getComputedStyle(el).overflowX)) return true;
  }
  return false;
};
document.addEventListener(
  'touchstart',
  e => {
    sw = null;
    if (e.touches.length !== 1 || !matchMedia('(max-width:760px)').matches || !$('#nav').innerHTML) return;
    const t = e.target;
    if (!t.closest || !t.closest('#m') || t.closest('.hd,input,textarea,select,[contenteditable],.ov') || hScroll(t)) return;
    sw = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
  },
  { passive: true }
);
document.addEventListener(
  'touchend',
  e => {
    const s = sw;
    sw = null;
    if (!s || drag) return;
    const p = e.changedTouches[0],
      dx = p.clientX - s.x,
      dy = p.clientY - s.y;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2 || Date.now() - s.t > 700 || String(getSelection())) return;
    const k = tabs().map(x => x[0]),
      i = k.indexOf(view);
    if (i < 0) return;
    const j = i + (dx < 0 ? 1 : -1);
    if (j < 0 || j >= k.length) return;
    view = k[j];
    render();
    const m = $('#m');
    if (m.animate && !matchMedia('(prefers-reduced-motion: reduce)').matches)
      m.animate(
        [
          { transform: `translateX(${dx < 0 ? 40 : -40}px)`, opacity: 0 },
          { transform: 'none', opacity: 1 }
        ],
        { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' }
      );
  },
  { passive: true }
);
