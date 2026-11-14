'use strict';
/* Sección «Coche», sencilla: km del coche, lo próximo (mantenimientos, pagos de Facturas y documentos que vencen),
   lo gastado (de los movimientos con categoría Coche), historial del taller por año y ficha en texto.
   Datos en S.car: info (ficha), km (lecturas de km), mt (mantenimientos: cada cuánto y la última vez), vis (visitas al taller).
   Los gastos no se apuntan aquí: salen de Finanzas, así no se cuentan dos veces. */
let carTab = 'res',
  carOff = 0, // mes de Gastos: 0 = el actual, -1 = el anterior…
  carYr = ''; // año del historial ('' = todos)
const CARC = '#f5a524';
/* Mantenimientos de partida (con id fijo: si dos dispositivos los crean a la vez, se juntan en uno). */
const CAR_MT0 = [
  { id: 'itv', n: 'ITV', m: 24 },
  { id: 'rev', n: 'Revisión y aceite', km: 15000, m: 12 },
  { id: 'neu', n: 'Neumáticos', km: 40000 }
];
/* Para leer (no cambia S). */
const carR = () => {
  const c = S.car && typeof S.car === 'object' ? S.car : {};
  return { info: c.info || {}, km: c.km || [], mt: Array.isArray(c.mt) ? c.mt : CAR_MT0, vis: c.vis || [] };
};
/* Para guardar: crea S.car con sus listas (y los mantenimientos de partida) la primera vez. */
const carS = () => {
  const c = (S.car = S.car && typeof S.car === 'object' && !Array.isArray(S.car) ? S.car : {});
  if (!c.info || typeof c.info !== 'object') c.info = {};
  ['km', 'vis'].forEach(k => {
    if (!Array.isArray(c[k])) c[k] = [];
  });
  if (!Array.isArray(c.mt)) c.mt = CAR_MT0.map(x => ({ ...x }));
  return c;
};
const kmf = n => new Intl.NumberFormat('es-ES', { useGrouping: 'always', maximumFractionDigits: 0 }).format(n || 0);
const hasN = v => v !== undefined && v !== null && v !== '' && !isNaN(+v);

/* Km actuales (la lectura más alta: a mano, visitas o mantenimientos hechos) y km al día (para estimar cuándo toca algo por km). */
function carKm(c = carR()) {
  const P = [...c.km, ...c.vis.filter(v => hasN(v.km)), ...c.mt.filter(x => hasN(x.lk) && x.ld).map(x => ({ d: x.ld, km: x.lk }))]
    .filter(p => p.d && hasN(p.km))
    .map(p => ({ d: p.d, km: +p.km }))
    .sort((a, b) => a.d.localeCompare(b.d) || a.km - b.km);
  if (!P.length) return { cur: null, d: '', rate: null };
  const last = P.reduce((a, p) => (p.km >= a.km ? p : a), P[0]);
  // Ritmo: desde la lectura más antigua de los últimos 6 meses que tenga al menos 14 días de margen.
  const from = P.find(p => dd(last.d, p.d) >= 14 && dd(TD(), p.d) <= 183) || (dd(last.d, P[0].d) >= 14 ? P[0] : null);
  return { cur: last.km, d: last.d, rate: from && last.km > from.km ? (last.km - from.km) / dd(last.d, from.d) : null };
}

/* Estado de un mantenimiento: próxima fecha (por tiempo o fija), km que faltan, fecha estimada por km, avance y nivel. */
function carMt(x, K) {
  const nd = x.nd || (x.ld && +x.m ? addM(x.ld, +x.m) : ''),
    nk = hasN(x.lk) && +x.km ? +x.lk + +x.km : null,
    dL = nd ? dayDiff(nd) : null,
    kL = nk !== null && K.cur !== null ? nk - K.cur : null,
    kd = kL !== null && K.rate ? addD(TD(), Math.round(kL / K.rate)) : '',
    due = [nd, kd].filter(Boolean).sort()[0] || '';
  if (dL === null && kL === null) return { lvl: 'no', due: '', p: 0, pill: 'Falta la última vez' };
  const pD = nd && x.ld ? 1 - dL / Math.max(1, dd(nd, x.ld)) : 0,
    pK = kL !== null ? 1 - kL / +x.km : 0,
    p = Math.max(0, Math.min(1, Math.max(pD, pK)));
  const lvl =
    (dL !== null && dL <= 30) || (kL !== null && kL <= 1000)
      ? 'er'
      : (dL !== null && dL <= 90) || (kL !== null && kL <= 3000)
        ? 'wa'
        : 'ok';
  // Se enseña lo que llega antes: los km (si se sabe cuándo se llegará, o si no hay fecha) o la fecha.
  const byKm = kL !== null && (dL === null || (kd ? kd < nd : kL <= 3000));
  const pill = byKm
    ? kL < 0
      ? 'Pasado ' + kmf(-kL) + ' km'
      : kmf(kL) + ' km'
    : dL < 0
      ? 'Vencido'
      : dL === 0
        ? 'Hoy'
        : dL <= 90
          ? dL + (dL === 1 ? ' día' : ' días')
          : dL < 365
            ? Math.round(dL / 30.4) + ' meses'
            : fdc(nd);
  return { lvl, due: due || TD(), p, pill, nd, nk, kL, dL, kd };
}
/* Lo próximo: mantenimientos con datos, pagos de Facturas con categoría Coche (seguro, impuesto…) y documentos de la carpeta Coche que vencen. */
function carNext(c = carR(), K = carKm(c)) {
  const LV = { er: 0, wa: 1, ok: 2 };
  // Un documento que vence y un pago de Facturas de lo mismo (p. ej. la póliza y el cargo del seguro, con menos de un mes
  // de diferencia y una palabra en común) salen en una sola línea: la del pago, con la fecha en que vence el documento.
  const words = t =>
      nt(t)
        .trim()
        .split(' ')
        .filter(w => w.length >= 5 && w !== 'coche'),
    FX = S.fixed
      .filter(f => f.cat === 'Coche' && f.t === 'g' && fxLive(f) && !f.var)
      .map(f => ({ f, d: fxState(f).due || fxState(f).next }))
      .filter(o => o.d),
    twin = d => FX.find(o => Math.abs(dd(o.d, d.exp)) <= 31 && words(o.f.name).some(w => words(d.name).includes(w)));
  const L = [
    ...c.mt
      .map(x => ({ k: 'mt', x, s: carMt(x, K) }))
      .filter(o => o.s.lvl !== 'no')
      .map(o => ({ ...o, n: o.x.n, d: o.s.due, lvl: o.s.lvl, pill: o.s.pill })),
    ...FX.map(o => {
      const doc = S.docs.find(d => d.cat === 'Coche' && d.exp && twin(d) === o),
        d = doc && doc.exp < o.d ? doc.exp : o.d;
      return {
        k: 'fx',
        f: o.f,
        n: o.f.name,
        d,
        lvl: dayDiff(d) <= 7 ? 'wa' : 'ok',
        pill: cap(rel(d)),
        sub: doc ? 'Vence el ' + fdc(doc.exp) + ' · Cargo de ' + eur(o.f.amt) + ' hacia el ' + fdc(o.d) : 'Pago · ' + eur(o.f.amt)
      };
    }),
    ...S.docs
      .filter(d => d.cat === 'Coche' && d.exp && !twin(d))
      .map(d => {
        const n = dayDiff(d.exp);
        return {
          k: 'doc',
          doc: d,
          n: d.name,
          d: d.exp,
          lvl: n <= 30 ? 'er' : n <= 90 ? 'wa' : 'ok',
          pill: n < 0 ? 'Caducado' : cap(rel(d.exp)),
          sub: 'Vence el ' + fdc(d.exp)
        };
      })
  ];
  return L.sort((a, b) => LV[a.lvl] - LV[b.lvl] || a.d.localeCompare(b.d));
}
/* Avisos para Mi día y el menú: solo los mantenimientos en rojo, cuando ya se usa la sección. */
const carWarn = () => (S.car ? carNext().filter(o => o.k === 'mt' && o.lvl === 'er') : []);
/* Gastos: los movimientos con categoría Coche (también las partes de un gasto dividido; las devoluciones restan). */
const carTx = () => TXP().filter(x => x.cat === 'Coche' && gAmt(x));

/* Edad del coche desde la matriculación (vale fecha o solo mes): «3 años y 10 meses». */
const carAge = r => {
  if (!r) return '';
  const a = new Date(r.length === 7 ? r + '-01T00:00' : r + 'T00:00'),
    n = new Date();
  let mm = (n.getFullYear() - a.getFullYear()) * 12 + n.getMonth() - a.getMonth() - (n.getDate() < a.getDate() ? 1 : 0);
  if (mm < 0) return '';
  const yy = Math.floor(mm / 12);
  mm %= 12;
  return (
    [yy ? yy + (yy === 1 ? ' año' : ' años') : '', mm ? mm + (mm === 1 ? ' mes' : ' meses') : ''].filter(Boolean).join(' y ') ||
    'menos de un mes'
  );
};
/* Dibujo de un coche (de lado, genérico) para el panel de los km: a la derecha, difuminado hacia la izquierda. */
const carArt = () =>
  `<svg class="carart" viewBox="0 0 400 170" aria-hidden="true"><defs><linearGradient id="cab" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6aa6ff"/><stop offset=".5" stop-color="#2b66d9"/><stop offset="1" stop-color="#173c8f"/></linearGradient><linearGradient id="caw" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a9cbff" stop-opacity=".5"/><stop offset=".45" stop-color="#0b1a33" stop-opacity=".92"/><stop offset="1" stop-color="#0b1a33"/></linearGradient></defs>` +
  `<ellipse cx="200" cy="160" rx="175" ry="7" fill="#000" opacity=".4"/>` +
  `<path d="M38 128 36 100Q36 80 44 72L68 42Q74 32 88 31L226 28Q242 28 252 37L292 66Q300 70 330 74L352 80Q366 84 366 98V124Q366 132 356 132H327A33 33 0 0 0 263 132H133A33 33 0 0 0 67 132H46Q38 132 38 128Z" fill="url(#cab)"/>` +
  `<path d="M36 112H366V124Q366 132 356 132H327A33 33 0 0 0 263 132H133A33 33 0 0 0 67 132H46Q38 132 38 128Z" fill="#0c1220"/>` +
  `<path d="M64 132A36 36 0 0 1 136 132M260 132A36 36 0 0 1 330 132" fill="none" stroke="#0c1220" stroke-width="9"/>` +
  `<path d="M68 42Q74 32 88 31L226 28Q242 28 252 37L246 37Q240 34 226 34L88 37Q80 38 74 44Z" fill="#0c1220"/><path d="M94 27L220 24" stroke="#0c1220" stroke-width="3.5" stroke-linecap="round"/>` +
  `<path d="M70 60L84 45Q88 40 96 40L168 38V63Z" fill="url(#caw)"/><path d="M176 38H230Q241 38 247 44L272 65H176Z" fill="url(#caw)"/>` +
  `<path d="M172 40V112M60 82H352" stroke="#0e2554" stroke-opacity=".6" stroke-width="1.5"/><rect x="146" y="76" width="14" height="3" rx="1.5" fill="#cfe0ff" opacity=".6"/><rect x="240" y="76" width="14" height="3" rx="1.5" fill="#cfe0ff" opacity=".6"/><path d="M262 62h12q4 0 4 4v4h-14z" fill="#0c1220"/>` +
  `<path d="M330 76 360 82 358 89 332 84Z" fill="#eaf2ff"/><path d="M40 72 54 70 52 83 39 85Z" fill="#ff4d5e"/>` +
  `<circle cx="100" cy="132" r="28" fill="#0b0d12"/><circle cx="100" cy="132" r="18" fill="#2d3340"/><circle cx="100" cy="132" r="18" fill="none" stroke="#7d879b" stroke-width="2.5" stroke-dasharray="6 5.3"/><circle cx="100" cy="132" r="5" fill="#9aa3b5"/><circle cx="295" cy="132" r="28" fill="#0b0d12"/><circle cx="295" cy="132" r="18" fill="#2d3340"/><circle cx="295" cy="132" r="18" fill="none" stroke="#7d879b" stroke-width="2.5" stroke-dasharray="6 5.3"/><circle cx="295" cy="132" r="5" fill="#9aa3b5"/></svg>`;
/* ---------- pantalla ---------- */
const carPill = (lvl, t) => `<span class="chip ${lvl === 'no' ? '' : lvl}">${esc(t)}</span>`;
const carMtSub = (x, s) => {
  const parts = [];
  if (s.nd) parts.push((s.dL < 0 ? 'Venció el ' : 'Toca el ') + fdc(s.nd));
  if (s.nk !== null) parts.push('a los ' + kmf(s.nk) + ' km' + (s.kd && !s.nd ? ' (≈ ' + fdc(s.kd) + ')' : ''));
  return esc(parts.map(cap).join(' · '));
};
const carNextRow = o => {
  const act =
      o.k === 'mt'
        ? `data-a="cmt" data-i="${esc(o.x.id)}"`
        : o.k === 'fx'
          ? `data-a="ef" data-i="${o.f.id}"`
          : `data-a="ed" data-i="${o.doc.id}"`,
    sub = o.k === 'mt' ? carMtSub(o.x, o.s) : esc(o.sub);
  return `<div class="row"><span class="cdot ${o.lvl}"></span><button class="link" ${act}><span class="g"><span class="tt">${esc(o.n)}</span><br><span class="mu">${sub}</span></span></button>${carPill(o.lvl, o.pill)}</div>`;
};
/* Icono y color de cada cosa del historial, según lo que se hizo. */
const CAR_VT = [
  [/\bitv\b/, 'circle-check', '#22c3b4'],
  [/bateri/, 'battery', '#f2b13d'],
  [/neumat|rueda/, 'car', '#7aa7ff'],
  [/freno|pastilla|disco/, 'triangle-alert', '#ff6b6b'],
  [/aceite|filtro|mantenimiento|revision/, 'wrench', '#f5a524'],
  [/.?/, 'wrench', '#8d9099']
];
const carVT = v => CAR_VT.find(t => t[0].test(nt([v.what, v.det].join(' '))));
/* Visita del historial: una línea; al tocarla se abre el detalle (lo que se hizo, taller, importe). */
const carVisRow = v => {
  const k = 'cv:' + v.id,
    open = exp[k],
    det = String(v.det || '')
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);
  const t = carVT(v);
  return `<div class="cvis${open ? ' on' : ''}" style="--c:${t[2]}"><button class="cvh" data-a="xp" data-i="${esc(k)}" aria-expanded="${!!open}">${tile(t[1], t[2])}<span class="g"><span class="tt">${esc(v.what || 'Visita al taller')}</span><br><span class="mu">${[fdc(v.d), hasN(v.km) ? kmf(v.km) + ' km' : '', det.length > 2 ? det.length + ' trabajos' : ''].filter(Boolean).join(' · ')}</span></span>${+v.amt ? `<span class="amt">${eur(+v.amt)}</span>` : ''}${I(open ? 'chevron-up' : 'chevron-down', 'sm')}</button>${
    open
      ? `<div class="cvd">${det.length ? `<ul>${det.map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}${v.note ? `<div class="mu">${esc(v.note)}</div>` : ''}${v.where ? `<div class="mu">${I('map-pin', 'sm')} ${esc(v.where)}</div>` : ''}${!det.length && !v.note && !v.where ? '<div class="mu">Sin detalle.</div>' : ''}<button class="btn sm ghost" data-a="cvis" data-i="${v.id}">${I('pencil', 'sm')} Editar</button></div>`
      : ''
  }</div>`;
};

function vCoche() {
  const c = carR(),
    K = carKm(c),
    i = c.info,
    m = MN(new Date()),
    y = TD().slice(0, 4);
  const tabs = [
    ['res', 'Resumen'],
    ['tal', 'Mantenimiento'],
    ['fic', 'Ficha']
  ];
  if (!tabs.some(t => t[0] === carTab)) carTab = 'res';
  let C = {},
    top = '';
  if (carTab === 'res') {
    const T = carTx(),
      sum = L => L.reduce((a, x) => a + gAmt(x), 0),
      md = new Date(new Date().getFullYear(), new Date().getMonth() + carOff, 1),
      gm = MN(md),
      gy = gm.slice(0, 4),
      TM = T.filter(x => mon(x.date) === gm).sort((a, b) => b.date.localeCompare(a.date)),
      nx = carNext(c, K),
      mes = cap(new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(md)) + (gy === y ? '' : ' ' + gy);
    top = `<section class="carh" aria-label="Kilómetros">${carArt()}<div class="carhm"><span class="eyb">${I('gauge', 'sm')} Kilómetros</span>${
      K.cur !== null
        ? `<b>${kmf(K.cur)} <small>km</small></b><span class="carhs">Apuntado ${rel(K.d)}</span>`
        : `<b class="carh0">Sin apuntar</b><span class="carhs">Toca el lápiz para poner los km del coche.</span>`
    }</div><button class="carhb" data-a="ckm" aria-label="Actualizar los km" title="Actualizar los km">${I('pencil')}</button></section>`;
    C = {
      prox: panel(
        'coche',
        'prox',
        `${I('calendar-clock')} Lo próximo`,
        (nx.length ? fold('car-prox', nx.map(carNextRow), 5) : empty('Nada a la vista.')) +
          `<button class="morebtn" data-a="cmt" data-i="">${I('plus')} Añadir fecha</button>`,
        'hl'
      ),
      gasto: panel(
        'coche',
        'gasto',
        `${I('wallet')} Gastos`,
        `<div class="cgnav"><button class="ib" data-a="cgm" data-i="-1" aria-label="Mes anterior">${I('chevron-left')}</button><b>${mes}</b><button class="ib" data-a="cgm" data-i="1" aria-label="Mes siguiente" ${carOff ? '' : 'disabled'}>${I('chevron-right')}</button></div><div class="cgm"><b class="big">${eur(sum(TM))}</b><span class="mu">En ${gy}: ${eur(sum(T.filter(x => x.date.slice(0, 4) === gy)))}</span></div>` +
          (TM.length
            ? fold(
                'car-mov',
                TM.map(
                  x =>
                    `<div class="row">${tile('car', CARC)}<button class="link" data-a="etx" data-i="${x.id}"><span class="g"><span class="tt">${esc(x.desc || x.cat)}</span><br><span class="mu">${fdc(x.date)}${x.of ? ' · Parte de un gasto dividido' : ''}</span></span></button><span class="amt ${gAmt(x) < 0 ? 'ok' : ''}">${gAmt(x) < 0 ? '+' : ''}${eur(Math.abs(gAmt(x)))}</span></div>`
                ),
                6
              )
            : empty('Sin gastos del coche en ' + mes.toLowerCase() + '.')) +
          `<div class="mu" style="margin-top:8px">Salen solos de los movimientos con categoría Coche.</div>`
      )
    };
  } else if (carTab === 'tal') {
    const V = [...c.vis].sort((a, b) => b.d.localeCompare(a.d)),
      Y = [...new Set(V.map(v => v.d.slice(0, 4)))];
    if (carYr && !Y.includes(carYr)) carYr = '';
    C = {
      vis: panel(
        'coche',
        'vis',
        `${I('wrench')} Historial de mantenimiento`,
        (Y.length > 1
          ? `<div class="cyrs" role="tablist" aria-label="Año">${['', ...Y].map(yy => `<button role="tab" class="${carYr === yy ? 'on' : ''}" aria-selected="${carYr === yy}" data-a="cyr" data-i="${yy}">${yy || 'Todos'}</button>`).join('')}</div>`
          : '') +
          (V.length
            ? Y.filter(yy => !carYr || yy === carYr)
                .map(yy => {
                  const L = V.filter(v => v.d.slice(0, 4) === yy),
                    t = L.reduce((a, v) => a + (+v.amt || 0), 0);
                  return `<div class="dh cyh"><span>${yy}</span><span>${L.length} ${L.length === 1 ? 'vez' : 'veces'}${t ? ' · ' + eur(t) : ''}</span></div><div class="cvl">${L.map(carVisRow).join('')}</div>`;
                })
                .join('')
            : empty('Aún no hay nada. Cuando lleves el coche al taller, apunta qué se le hizo.')) +
          `<button class="morebtn" data-a="cvis">${I('plus')} Apuntar lo que se hizo</button>`
      )
    };
  } else {
    const D = S.docs.filter(d => d.cat === 'Coche'),
      seg = S.fixed.find(f => f.cat === 'Coche' && fxLive(f) && /seguro|p[oó]liza/i.test(f.name)),
      segD = seg ? fxState(seg).next : '',
      R = (k, v, tel) =>
        v ? `<dt>${k}</dt><dd>${tel ? `<a href="tel:${esc(String(v).replace(/[^\d+]/g, ''))}">${esc(v)}</a>` : esc(v)}</dd>` : '',
      // Cada grupo de la ficha en su cajita, con icono y color propios.
      grp = (t, ic, co, rows) =>
        rows.join('')
          ? `<section class="ckg" style="--c:${co}"><div class="ckh">${tile(ic, co)}${t}</div><dl class="ckv">${rows.join('')}</dl></section>`
          : '';
    const age = carAge(i.reg),
      body =
        grp('Vehículo', 'car', '#7aa7ff', [
          R('Marca y modelo', i.model),
          R('Versión', i.ver),
          R('Matrícula', i.plate),
          R('Bastidor (VIN)', i.vin),
          R('Matriculado', i.reg ? fd(i.reg) + (age ? ' · ' + age : '') : ''),
          R('Comprado', i.buy ? fd(i.buy) : '')
        ]) +
        grp('Motor', 'fuel', '#f5a524', [
          R('Combustible', i.fuelT),
          R('Motor', i.eng),
          R('Potencia', i.pw),
          R('Cambio', i.gear),
          R('Etiqueta DGT', i.dgt),
          R('Batería', i.bat),
          R('Neumáticos', i.tyr),
          R('Aceite', i.oil)
        ]) +
        grp('Seguro', 'shield-check', '#22c3b4', [
          R('Compañía', [i.ins, i.pol ? 'Póliza ' + i.pol : ''].filter(Boolean).join(' · ')),
          R('Renueva', segD ? fdc(segD) : ''),
          R('Asistencia', i.asis, 1),
          R('Agente', i.agent)
        ]) +
        (i.notes
          ? `<section class="ckg" style="--c:#8d9099"><div class="ckh">${tile('file-text', '#8d9099')}Notas</div><div class="mu">${esc(i.notes)}</div></section>`
          : '');
    C = {
      fic: panel(
        'coche',
        'fic',
        `${I('car')} ${esc([i.model, i.plate].filter(Boolean).join(' · ') || 'Mi coche')}`,
        (body ? `<div class="ckgs">${body}</div>` : `<div class="mu">Sin datos todavía. Toca «Editar» para rellenar la ficha.</div>`) +
          `<div class="dh">Documentos</div><div class="cdocs">${D.map(d =>
            d.url
              ? `<a class="qc" href="${esc(d.url)}" target="_blank" rel="noopener noreferrer"><span class="qi" style="--c:${CARC}">${I('file-text')}</span>${esc(d.name)}</a>`
              : `<button class="qc off" data-a="ed" data-i="${d.id}"><span class="qi" style="--c:${CARC}">${I('file-text')}</span>${esc(d.name)}<em>Añadir enlace</em></button>`
          ).join('')}<button class="qlk" data-a="ccdoc">${I('plus', 'sm')} Añadir</button></div>` +
          `<button class="morebtn" data-a="cinf">${I('pencil')} Editar</button>`,
        'wide'
      )
    };
  }
  VIS.coche = ord('coche', Object.keys(C));
  return `<div class="hdr"><div><h2>Coche</h2><div class="sub help">Lo próximo que toca, lo gastado y el historial del taller. Los gastos salen solos de los movimientos con categoría Coche.</div></div></div>
  <div class="seg ctabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" aria-selected="${carTab === k}" class="${carTab === k ? 'on' : ''}" data-a="ctab" data-i="${k}">${l}</button>`).join('')}</div>
  ${top}<div class="grid">${VIS.coche.map(k => C[k]).join('')}</div>`;
}
