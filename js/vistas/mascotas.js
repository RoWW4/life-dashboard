'use strict';
/* Sección «Mascotas»: una ficha por animal con su foto, la edad, vacunas y desparasitaciones (con la próxima fecha),
   historial del veterinario y lo gastado (de los movimientos con categoría Mascotas).
   Datos en S.pets (lista): id, n (nombre), sp (grupo: su id en S.petGrp), sex (m/h), born (nacimiento), raza, col (color),
   chip, ster (esterilizado), kg, vet (veterinario), notes, photo (foto pequeña en JPEG),
   vac: [{id, n, d (puesta), nx (próxima)}] y med: [{id, d, what, det, vet, imp (se destaca en la ficha)}].
   Grupos (pestañas) en S.petGrp: [{id, n (nombre en plural), one (en singular), ic (icono)}]; sin guardar, los de partida.
   El repositorio es público: aquí no van nombres ni datos de las mascotas; viven en Supabase. */
let petSel = '',
  petTab = '', // grupo abierto (pestaña)
  petOff = 0; // mes de Gastos: 0 = el actual, -1 = el anterior…
const PETC = '#c08457';
const PET_SP = {
  gato: ['cat', 'Gato', 'Gatos'],
  perro: ['dog', 'Perro', 'Perros'],
  ave: ['bird', 'Agapornis', 'Agapornis'],
  otro: ['paw-print', 'Otro', 'Otros']
};
const PET_IC = [
  ['cat', 'Gato'],
  ['dog', 'Perro'],
  ['bird', 'Pájaro'],
  ['paw-print', 'Huella']
];
const PET_G0 = [
  { id: 'gato', n: 'Gatos', one: 'Gato', ic: 'cat' },
  { id: 'ave', n: 'Agapornis', one: 'Agapornis', ic: 'bird' }
];
const petSp = p => p.sp || 'otro';
/* Grupos: los guardados (o los de partida) y, por si acaso, uno para cada mascota cuyo grupo ya no existe. */
const petGrps = () => {
  const G = (Array.isArray(S.petGrp) ? S.petGrp : PET_G0).filter(g => g && g.id);
  petsR().forEach(p => {
    const k = petSp(p);
    if (!G.some(g => g.id === k)) {
      const d = PET_SP[k] || PET_SP.otro;
      G.push({ id: k, n: d[2], one: d[1], ic: d[0] });
    }
  });
  return G;
};
const petGrp = k => petGrps().find(g => g.id === k) || { id: k, n: 'Otros', one: '', ic: 'paw-print' };
const PET_VAC = ['Trivalente felina', 'Rabia', 'Leucemia felina', 'Desparasitación interna', 'Desparasitación externa', 'Revisión anual'];
/* Para leer (no cambia S). */
const petsR = () => (Array.isArray(S.pets) ? S.pets.filter(p => p && p.id) : []);
/* Para guardar: crea S.pets y las listas de la mascota la primera vez. */
const petsS = () => (S.pets = Array.isArray(S.pets) ? S.pets : []);
const petFix = p => {
  ['vac', 'med'].forEach(k => {
    if (!Array.isArray(p[k])) p[k] = [];
  });
  return p;
};
const petTabs = () => petGrps().map(g => g.id);
const petCur = () => {
  const T = petTabs(),
    all = petsR(),
    sel = all.find(p => p.id === petSel);
  if (sel) petTab = petSp(sel);
  if (!T.includes(petTab)) petTab = T[0] || '';
  const L = all.filter(p => petSp(p) === petTab);
  return L.find(p => p.id === petSel) || L[0] || null;
};
const petIc = p => petGrp(petSp(p)).ic || 'paw-print';
const petAv = (p, cls = '') =>
  p.photo ? `<span class="pav ${cls}"><img src="${esc(p.photo)}" alt=""></span>` : `<span class="pav ${cls}">${I(petIc(p))}</span>`;

/* Edad: «7 años y 6 meses», «5 meses»… (y solo los años, en corto). */
function petAge(b, short) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b || '')) return '';
  const a = new Date(b + 'T00:00'),
    n = new Date();
  const mm = (n.getFullYear() - a.getFullYear()) * 12 + n.getMonth() - a.getMonth() - (n.getDate() < a.getDate() ? 1 : 0);
  if (mm < 0) return '';
  const y = Math.floor(mm / 12),
    m = mm % 12,
    Y = y + (y === 1 ? ' año' : ' años'),
    M = m + (m === 1 ? ' mes' : ' meses');
  if (!y) return m ? M : 'Menos de un mes';
  return short || !m ? Y : Y + ' y ' + M;
}
/* Próximo cumpleaños: fecha, días que faltan y los años que cumple. */
function petBday(b) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b || '')) return null;
  const t = TD(),
    md = b.slice(5) === '02-29' ? '02-28' : b.slice(5);
  let y = +t.slice(0, 4);
  if (y + '-' + md < t) y++;
  const d = y + '-' + md;
  return { d, n: dayDiff(d), age: y - +b.slice(0, 4) };
}
/* Vacunas: la última dosis de cada tipo manda (la próxima fecha y el aviso). */
function petVac(p) {
  const G = {};
  (p.vac || []).forEach(v => {
    const k = nt(v.n || '').trim();
    if (!G[k] || (v.d || '') > (G[k].d || '')) G[k] = v;
  });
  return Object.values(G)
    .map(v => {
      const n = v.nx ? dayDiff(v.nx) : null,
        lvl = n === null ? 'no' : n < 0 ? 'er' : n <= 30 ? 'wa' : 'ok',
        pill = n === null ? 'Puesta' : n < 0 ? 'Vencida' : n === 0 ? 'Hoy' : n <= 30 ? cap(rel(v.nx)) : n < 365 ? 'Al día' : 'Al día';
      return { v, n, lvl, pill };
    })
    .sort((a, b) => (a.v.nx || '9999').localeCompare(b.v.nx || '9999'));
}
/* Para Mi día: vacunas que tocan en 30 días (o vencidas) y cumpleaños de hoy o mañana. */
const petWarn = () =>
  petsR().flatMap(p => [
    ...petVac(p)
      .filter(o => o.lvl === 'er' || o.lvl === 'wa')
      .map(o => ({ d: o.v.nx, ic: 'syringe', t: o.v.n + ' · ' + (p.n || 'Mascota') })),
    ...(() => {
      const b = petBday(p.born);
      return b && b.n <= 1 ? [{ d: b.d, ic: 'cake', t: 'Cumple ' + (p.n || 'tu mascota') + ' (' + b.age + ')' }] : [];
    })()
  ]);
/* Icono y color de cada cosa del historial médico, según lo que fue. */
const PET_MT = [
  [/fractur|hueso|pata|golpe|caida|herida/, 'triangle-alert', '#ff6b6b'],
  [/orin|urin|estruvit|calculo|ri[nñ]on|vejiga|sonda/, 'droplet', '#5aa9ff'],
  [/operac|cirug|esteriliz|castra/, 'heart-pulse', '#ff7a59'],
  [/analit|revision|chequeo|ecograf|radiograf/, 'stethoscope', '#22c3b4'],
  [/pastilla|medic|tratamiento|antibiot/, 'pill', '#9b87f5'],
  [/.?/, 'stethoscope', '#8d9099']
];
const petMT = v => PET_MT.find(t => t[0].test(nt([v.what, v.det].join(' '))));
const petMedRow = (p, v) => {
  const k = 'pm:' + v.id,
    open = exp[k],
    det = String(v.det || '')
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean),
    t = petMT(v);
  return `<div class="cvis${open ? ' on' : ''}" style="--c:${t[2]}"><button class="cvh" data-a="xp" data-i="${esc(k)}" aria-expanded="${!!open}">${tile(t[1], t[2])}<span class="g"><span class="tt">${esc(v.what || 'Visita al veterinario')}</span>${v.imp ? ` <span class="chip er">Importante</span>` : ''}<br><span class="mu">${[fdc(v.d), v.vet].filter(Boolean).map(esc).join(' · ')}</span></span>${I(open ? 'chevron-up' : 'chevron-down', 'sm')}</button>${
    open
      ? `<div class="cvd">${det.length ? `<ul>${det.map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : '<div class="mu">Sin detalle.</div>'}<button class="btn sm ghost" data-a="pmed" data-i="${esc(v.id)}">${I('pencil', 'sm')} Editar</button></div>`
      : ''
  }</div>`;
};
const petVacRow = o =>
  `<div class="row"><span class="cdot ${o.lvl}"></span><button class="link" data-a="pvac" data-i="${esc(o.v.id)}"><span class="g"><span class="tt">${esc(o.v.n)}</span><br><span class="mu">${[o.v.d ? 'Puesta el ' + fdc(o.v.d) : '', o.v.nx ? (o.n < 0 ? 'Tocaba el ' : 'Próxima: ') + fdc(o.v.nx) : ''].filter(Boolean).join(' · ')}</span></span></button><span class="chip ${o.lvl === 'no' ? '' : o.lvl}">${esc(o.pill)}</span></div>`;

function vMascotas() {
  const p = petCur(),
    L = petsR().filter(x => petSp(x) === petTab),
    TB = petGrps(),
    g = petGrp(petTab);
  if (p) petSel = p.id;
  const hdr = `<div class="hdr"><div><h2>Mascotas</h2><div class="sub help">Su edad, las vacunas (con aviso cuando toca la siguiente) y lo que les ha pasado en el veterinario.</div></div></div>`;
  // Pestañas de los grupos (Gatos, Agapornis…) y, al lado, el lápiz para añadir, cambiar o quitar grupos.
  const tabs = `<div class="ptabw"><div class="seg ctabs ptabs" role="tablist" aria-label="Grupos">${TB.map(
    x =>
      `<button role="tab" aria-selected="${petTab === x.id}" class="${petTab === x.id ? 'on' : ''}" data-a="ptab" data-i="${esc(x.id)}">${I(x.ic || 'paw-print', 'sm')} ${esc(x.n)}</button>`
  ).join(
    ''
  )}</div><button class="ib" data-a="pgrp" aria-label="Cambiar los grupos" title="Añadir, cambiar o quitar grupos">${I('pencil')}</button></div>`;
  const sel = `<div class="petsel" role="tablist" aria-label="Mascotas">${L.map(
    x =>
      `<button role="tab" class="${x.id === (p && p.id) ? 'on' : ''}" aria-selected="${x.id === (p && p.id)}" data-a="psel" data-i="${esc(x.id)}">${petAv(x, 'sm')}<span><b>${esc(x.n || 'Sin nombre')}</b><small>${esc(petAge(x.born, 1) || g.one || '')}</small></span></button>`
  ).join('')}<button class="padd" data-a="padd" data-i="${esc(petTab)}" aria-label="Añadir">${I('plus')}<span>Añadir</span></button></div>`;
  if (!p) {
    VIS.mascotas = [];
    return (
      hdr +
      (TB.length ? tabs : '') +
      `<div class="card pet0">${tile(g.ic || 'paw-print', PETC)}<div><b>${TB.length ? 'Aún no hay ninguno en ' + esc(g.n) : 'Aún no hay ninguna mascota'}</b><div class="mu">Añade cada una con su foto y su fecha de nacimiento; luego puedes apuntar las vacunas de la cartilla y su historial.</div></div><button class="btn" data-a="padd" data-i="${esc(petTab)}">${I('plus')} Añadir</button></div>`
    );
  }
  const age = petAge(p.born),
    bd = petBday(p.born),
    sx = p.sex === 'm' ? 'Macho' : p.sex === 'h' ? 'Hembra' : '';
  // Cabecera centrada: foto, nombre, edad, lo básico (sexo, raza, color) y la fecha de nacimiento.
  const top = `<section class="peth" aria-label="${esc(p.n || 'Mascota')}"><button class="carhb" data-a="pinf" data-i="${esc(p.id)}" aria-label="Editar la ficha" title="Editar la ficha">${I('pencil')}</button><label class="pphoto" title="Cambiar la foto">${petAv(p, 'lg')}<span class="pcam">${I('upload', 'sm')}</span><input type="file" id="petfile" data-i="${esc(p.id)}" accept="image/*" hidden></label><b class="petn">${esc(p.n || 'Sin nombre')}</b><span class="petage">${age ? esc(age) : 'Sin fecha de nacimiento'}</span><span class="eyb">${I(petIc(p), 'sm')} ${[g.one, sx, p.raza, p.col].filter(Boolean).map(esc).join(' · ')}</span>${
    bd ? `<span class="carhs">${I('cake', 'sm')} ${bd.n === 0 ? `¡Hoy cumple ${bd.age}!` : fd(p.born)}</span>` : ''
  }</section>`;
  const VV = petVac(p),
    all = [...(p.vac || [])].sort((a, b) => (b.d || '').localeCompare(a.d || '')),
    MD = [...(p.med || [])].sort((a, b) => (b.d || '').localeCompare(a.d || '')),
    R = (k, v) => (v ? `<dt>${k}</dt><dd>${esc(v)}</dd>` : ''),
    y = TD().slice(0, 4),
    T = TXP().filter(x => x.cat === 'Mascotas' && gAmt(x)),
    sum = A => A.reduce((a, x) => a + gAmt(x), 0),
    md = new Date(new Date().getFullYear(), new Date().getMonth() + petOff, 1),
    gm = MN(md),
    gy = gm.slice(0, 4),
    mes = cap(new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(md)) + (gy === y ? '' : ' ' + gy),
    TM = T.filter(x => mon(x.date) === gm).sort((a, b) => b.date.localeCompare(a.date));
  const C = {
    vac: panel(
      'mascotas',
      'vac',
      `${I('syringe')} Vacunas y desparasitación`,
      (VV.length ? VV.map(petVacRow).join('') : empty('Nada apuntado. Copia aquí lo que pone la cartilla.')) +
        (all.length > VV.length
          ? `<button class="morebtn" data-a="xp" data-i="pv-all">${exp['pv-all'] ? I('chevron-up') + 'Ocultar las anteriores' : I('chevron-down') + 'Ver todas las dosis (' + all.length + ')'}</button>` +
            (exp['pv-all']
              ? `<div class="pvall">${all.map(v => `<button class="link" data-a="pvac" data-i="${esc(v.id)}"><span>${esc(v.n)}</span><span class="mu">${fdc(v.d)}</span></button>`).join('')}</div>`
              : '')
          : '') +
        `<button class="morebtn" data-a="pvacn">${I('plus')} Apuntar vacuna o desparasitación</button>`,
      'hl'
    ),
    med: panel(
      'mascotas',
      'med',
      `${I('stethoscope')} Historial médico`,
      (MD.length
        ? fold(
            'pet-med',
            MD.map(v => petMedRow(p, v)),
            6
          )
        : empty('Aún no hay nada. Apunta visitas, problemas, operaciones o tratamientos.')) +
        `<button class="morebtn" data-a="pmedn">${I('plus')} Apuntar en el historial</button>`
    ),
    fic: panel(
      'mascotas',
      'fic',
      `${I('id-card')} Ficha`,
      (x => (x ? `<dl class="ckv">${x}</dl>` : `<div class="mu">Toca «Editar» para añadir el chip, el veterinario…</div>`))(
        [
          R('Nacimiento', p.born ? fd(p.born) : ''),
          R('Raza', p.raza),
          R('Color', p.col),
          R('Microchip', p.chip),
          R('Esterilizado', p.ster),
          R('Peso', p.kg ? String(p.kg).replace('.', ',') + ' kg' : ''),
          R('Veterinario', p.vet)
        ].join('')
      ) +
        (p.notes ? `<div class="mu" style="margin-top:8px">${esc(p.notes)}</div>` : '') +
        `<button class="morebtn" data-a="pinf" data-i="${esc(p.id)}">${I('pencil')} Editar</button>`
    ),
    gasto: panel(
      'mascotas',
      'gasto',
      `${I('wallet')} Gastos`,
      `<div class="cgnav"><button class="ib" data-a="pgm" data-i="-1" aria-label="Mes anterior">${I('chevron-left')}</button><b>${mes}</b><button class="ib" data-a="pgm" data-i="1" aria-label="Mes siguiente" ${petOff ? '' : 'disabled'}>${I('chevron-right')}</button></div><div class="cgm"><b class="big">${eur(sum(TM))}</b><span class="mu">En ${gy}: ${eur(sum(T.filter(x => x.date.slice(0, 4) === gy)))}</span></div>` +
        (TM.length
          ? fold(
              'pet-mov',
              TM.map(
                x =>
                  `<div class="row">${tile('paw-print', PETC)}<button class="link" data-a="etx" data-i="${x.id}"><span class="g"><span class="tt">${esc(x.desc || x.cat)}</span><br><span class="mu">${fdc(x.date)}</span></span></button><span class="amt">${eur(Math.abs(gAmt(x)))}</span></div>`
              ),
              5
            )
          : empty('Sin gastos de mascotas en ' + mes.toLowerCase() + '.')) +
        `<div class="mu" style="margin-top:8px">De todas las mascotas. Salen solos de los movimientos con categoría Mascotas.</div>`
    )
  };
  VIS.mascotas = ord('mascotas', Object.keys(C));
  return `${hdr}${tabs}${sel}${top}<div class="grid">${VIS.mascotas.map(k => C[k]).join('')}</div>`;
}

/* Foto: al elegirla se abre una ventana para encuadrarla (arrastrar para mover; la barra, la rueda o dos dedos para
   acercar). Se guarda lo que queda dentro del círculo, a 360 px (JPEG, unos 20-30 KB), con los datos.
   Va en su propia capa para no cerrar la ficha que esté abierta debajo. */
function petPhoto(f, cb) {
  const u = URL.createObjectURL(f),
    im = new Image();
  im.onerror = () => {
    URL.revokeObjectURL(u);
    toast('No se pudo leer la imagen');
  };
  im.onload = () => {
    const o = document.createElement('div');
    o.className = 'ov pcrop';
    o.innerHTML = `<div class="dlg" role="dialog" aria-modal="true" aria-label="Encuadrar la foto"><h3>Encuadrar la foto</h3><div class="pcv"><img alt="" draggable="false"></div><label class="pcz">${I('minus', 'sm')}<input type="range" min="1" max="5" step="0.01" value="1" aria-label="Acercar">${I('plus', 'sm')}</label><div class="mu" style="text-align:center">Arrastra para mover y acerca con la barra (o con dos dedos).</div><div class="acts"><span class="sp"></span><button class="btn ghost" data-x>Cancelar</button><button class="btn" data-ok>Usar foto</button></div></div>`;
    document.body.appendChild(o);
    const box = o.querySelector('.pcv'),
      img = o.querySelector('img'),
      rg = o.querySelector('input'),
      W = im.width,
      H = im.height;
    img.src = u;
    let V = box.clientWidth,
      base = V / Math.min(W, H),
      z = 1,
      x = (V - W * base) / 2,
      y = (V - H * base) / 2;
    const draw = () => {
      const s = base * z;
      x = Math.min(0, Math.max(V - W * s, x));
      y = Math.min(0, Math.max(V - H * s, y));
      img.style.transform = `translate(${x}px,${y}px) scale(${s})`;
    };
    // Acercar o alejar manteniendo fijo el punto (cx, cy) del recuadro.
    const zoom = (nz, cx = V / 2, cy = V / 2) => {
      nz = Math.min(5, Math.max(1, nz));
      const k = nz / z;
      x = cx - (cx - x) * k;
      y = cy - (cy - y) * k;
      z = nz;
      rg.value = z;
      draw();
    };
    draw();
    const P = new Map();
    let pd = 0;
    box.addEventListener('pointerdown', e => {
      box.setPointerCapture(e.pointerId);
      P.set(e.pointerId, [e.clientX, e.clientY]);
    });
    box.addEventListener('pointermove', e => {
      if (!P.has(e.pointerId)) return;
      const [px, py] = P.get(e.pointerId);
      P.set(e.pointerId, [e.clientX, e.clientY]);
      if (P.size === 1) {
        x += e.clientX - px;
        y += e.clientY - py;
        draw();
      } else if (P.size === 2) {
        const [a, b] = [...P.values()],
          d = Math.hypot(a[0] - b[0], a[1] - b[1]),
          r = box.getBoundingClientRect();
        if (pd) zoom((z * d) / pd, (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top);
        pd = d;
      }
    });
    const up = e => {
      P.delete(e.pointerId);
      pd = 0;
    };
    box.addEventListener('pointerup', up);
    box.addEventListener('pointercancel', up);
    box.addEventListener(
      'wheel',
      e => {
        e.preventDefault();
        const r = box.getBoundingClientRect();
        zoom(z * (e.deltaY < 0 ? 1.1 : 1 / 1.1), e.clientX - r.left, e.clientY - r.top);
      },
      { passive: false }
    );
    rg.oninput = () => zoom(+rg.value);
    const close = () => {
      o.remove();
      URL.revokeObjectURL(u);
    };
    o.querySelector('[data-x]').onclick = close;
    o.addEventListener('keydown', e => e.key === 'Escape' && (e.stopPropagation(), close()));
    o.querySelector('[data-ok]').onclick = () => {
      const s = base * z,
        n = Math.min(360, Math.round(V / s)) || 360,
        c = document.createElement('canvas');
      c.width = c.height = Math.max(n, 160);
      c.getContext('2d').drawImage(im, -x / s, -y / s, V / s, V / s, 0, 0, c.width, c.height);
      close();
      cb(c.toDataURL('image/jpeg', 0.82));
    };
    o.querySelector('[data-ok]').focus();
  };
  im.src = u;
}
function petPhotoSet(pid, f) {
  petPhoto(f, src => {
    const p = petsS().find(x => x.id === pid);
    if (!p) return;
    p.photo = src;
    ch();
    toast('Foto cambiada');
  });
}
