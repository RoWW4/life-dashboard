'use strict';
/* Sección «Coche», sencilla: km del coche, lo próximo (mantenimientos, pagos de Facturas y documentos que vencen),
   lo gastado (de los movimientos con categoría Coche), historial del taller por año y ficha en texto.
   Datos en S.car: info (ficha), km (lecturas de km), mt (mantenimientos: cada cuánto y la última vez), vis (visitas al taller).
   Los gastos no se apuntan aquí: salen de Finanzas, así no se cuentan dos veces. */
let carTab = 'res';
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
const carRule = x =>
  [
    x.km ? 'Cada ' + kmf(x.km) + ' km' : '',
    x.m ? (x.km ? 'o ' : 'Cada ') + (+x.m % 12 ? x.m + ' meses' : +x.m / 12 + (+x.m === 12 ? ' año' : ' años')) : ''
  ]
    .filter(Boolean)
    .join(' ') || (x.nd ? 'Fecha fija' : 'Sin periodo');
/* Lo próximo: mantenimientos con datos, pagos de Facturas con categoría Coche (seguro, impuesto…) y documentos de la carpeta Coche que vencen. */
function carNext(c = carR(), K = carKm(c)) {
  const LV = { er: 0, wa: 1, ok: 2 };
  const L = [
    ...c.mt
      .map(x => ({ k: 'mt', x, s: carMt(x, K) }))
      .filter(o => o.s.lvl !== 'no')
      .map(o => ({ ...o, n: o.x.n, d: o.s.due, lvl: o.s.lvl, pill: o.s.pill })),
    ...S.fixed
      .filter(f => f.cat === 'Coche' && f.t === 'g' && fxLive(f) && !f.var)
      .map(f => ({ f, d: fxState(f).due || fxState(f).next }))
      .filter(o => o.d)
      .map(o => ({
        k: 'fx',
        f: o.f,
        n: o.f.name,
        d: o.d,
        lvl: dayDiff(o.d) <= 7 ? 'wa' : 'ok',
        pill: cap(rel(o.d)),
        sub: 'Pago · ' + eur(o.f.amt)
      })),
    ...S.docs
      .filter(d => d.cat === 'Coche' && d.exp)
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

/* ---------- pantalla ---------- */
const carPill = (lvl, t) => `<span class="chip ${lvl === 'no' ? '' : lvl}">${esc(t)}</span>`;
const carMtSub = (x, s) => {
  const parts = [];
  if (s.nd) parts.push((s.dL < 0 ? 'Venció el ' : 'Toca el ') + fdc(s.nd));
  if (s.nk !== null) parts.push('a los ' + kmf(s.nk) + ' km' + (s.kd && !s.nd ? ' (≈ ' + fdc(s.kd) + ')' : ''));
  return esc(cap(parts.join(' · ')));
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
const carMtRow = (x, K) => {
  const s = carMt(x, K),
    last = [x.ld ? fdc(x.ld) : '', hasN(x.lk) ? kmf(x.lk) + ' km' : ''].filter(Boolean).join(' a ');
  return `<button class="cmt" data-a="cmt" data-i="${esc(x.id)}"><span class="cmth"><b>${esc(x.n)}</b>${carPill(s.lvl, s.pill)}</span>${s.lvl === 'no' ? '' : `<span class="bar"><div style="width:${Math.round(s.p * 100)}%;background:var(--${s.lvl})"></div></span>`}<span class="mu">${esc(carRule(x))}${last ? ' · Última: ' + esc(last) : ''}${s.lvl === 'no' ? ' · Toca para apuntar la última vez' : ' · ' + carMtSub(x, s)}</span></button>`;
};
/* Visita del historial: una línea; al tocarla se abre el detalle (lo que se hizo, taller, importe). */
const carVisRow = v => {
  const k = 'cv:' + v.id,
    open = exp[k],
    det = String(v.det || '')
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);
  return `<div class="cvis${open ? ' on' : ''}"><button class="cvh" data-a="xp" data-i="${esc(k)}" aria-expanded="${!!open}"><span class="g"><span class="tt">${esc(v.what || 'Visita al taller')}</span><br><span class="mu">${[fdc(v.d), hasN(v.km) ? kmf(v.km) + ' km' : ''].filter(Boolean).join(' · ')}</span></span>${+v.amt ? `<span class="amt">${eur(+v.amt)}</span>` : ''}${I(open ? 'chevron-up' : 'chevron-down', 'sm')}</button>${
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
      TM = T.filter(x => mon(x.date) === m).sort((a, b) => b.date.localeCompare(a.date)),
      nx = carNext(c, K),
      mes = cap(new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(new Date()));
    top = `<section class="carh" aria-label="Kilómetros"><div class="carhm"><span class="eyb">${I('gauge', 'sm')} Kilómetros</span>${
      K.cur !== null
        ? `<b>${kmf(K.cur)} <small>km</small></b><span class="carhs">Apuntado ${rel(K.d)}</span>`
        : `<b class="carh0">Sin apuntar</b><span class="carhs">Toca el lápiz para poner los km del coche.</span>`
    }</div><button class="carhb" data-a="ckm" aria-label="Actualizar los km" title="Actualizar los km">${I('pencil')}</button></section>`;
    C = {
      prox: panel(
        'coche',
        'prox',
        `${I('calendar-clock')} Lo próximo`,
        nx.length ? fold('car-prox', nx.map(carNextRow), 5) : empty('Nada a la vista. Apunta la última ITV y revisión en Mantenimiento.'),
        'hl'
      ),
      gasto: panel(
        'coche',
        'gasto',
        `${I('wallet')} Gastos`,
        `<div class="cgm"><div><span class="mu">${mes}</span><b class="big">${eur(sum(TM))}</b></div><div class="mu">En ${y}: ${eur(sum(T.filter(x => x.date.slice(0, 4) === y)))}</div></div>` +
          (TM.length
            ? fold(
                'car-mov',
                TM.map(
                  x =>
                    `<div class="row">${tile('car', CARC)}<button class="link" data-a="etx" data-i="${x.id}"><span class="g"><span class="tt">${esc(x.desc || x.cat)}</span><br><span class="mu">${fdc(x.date)}${x.of ? ' · parte de un gasto dividido' : ''}</span></span></button><span class="amt ${gAmt(x) < 0 ? 'ok' : ''}">${gAmt(x) < 0 ? '+' : ''}${eur(Math.abs(gAmt(x)))}</span></div>`
                ),
                4
              )
            : empty('Sin gastos del coche este mes.')) +
          `<div class="mu" style="margin-top:8px">Salen solos de los movimientos con categoría Coche.</div>`
      )
    };
  } else if (carTab === 'tal') {
    const LV = { er: 0, wa: 1, ok: 2, no: 3 },
      V = [...c.vis].sort((a, b) => b.d.localeCompare(a.d)),
      Y = [...new Set(V.map(v => v.d.slice(0, 4)))];
    C = {
      mt: panel(
        'coche',
        'mt',
        `${I('calendar-clock')} Cuándo toca`,
        c.mt
          .map(x => [carMt(x, K), x])
          .sort((a, b) => LV[a[0].lvl] - LV[b[0].lvl] || a[0].due.localeCompare(b[0].due))
          .map(([, x]) => carMtRow(x, K))
          .join('') + `<button class="morebtn" data-a="cmt" data-i="">${I('plus')} Añadir otro</button>`
      ),
      vis: panel(
        'coche',
        'vis',
        `${I('wrench')} Historial`,
        (V.length
          ? Y.map(yy => {
              const L = V.filter(v => v.d.slice(0, 4) === yy),
                t = L.reduce((a, v) => a + (+v.amt || 0), 0);
              return `<div class="dh cyh"><span>${yy}</span>${t ? `<span>${eur(t)}</span>` : ''}</div>` + L.map(carVisRow).join('');
            }).join('')
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
      grp = (t, rows) => (rows.join('') ? `<div class="dh">${t}</div><dl class="ckv">${rows.join('')}</dl>` : '');
    const body =
      grp('Vehículo', [
        R('Modelo', i.model),
        R('Matrícula', i.plate),
        R('Bastidor', i.vin),
        R('Matriculado', i.reg ? MS[+i.reg.slice(5, 7)] + ' ' + i.reg.slice(0, 4) : ''),
        R('Combustible', i.fuelT),
        R('Etiqueta DGT', i.dgt)
      ]) +
      grp('Seguro', [R('Compañía', i.ins), R('Póliza', i.pol), R('Asistencia', i.asis, 1), R('Renueva', segD ? fdc(segD) : '')]) +
      grp('Para el taller', [R('Neumáticos', i.tyr), R('Presión', i.pre), R('Aceite', i.oil), R('Notas', i.notes)]);
    C = {
      fic: panel(
        'coche',
        'fic',
        `${I('car')} ${esc(i.model || 'Mi coche')}`,
        (body || `<div class="mu">Sin datos todavía. Toca «Editar» para rellenar la ficha.</div>`) +
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
