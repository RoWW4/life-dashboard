'use strict';
/* Sección «Coche»: kilómetros, mantenimiento (por fecha o por km, lo que llegue antes), gastos, repostajes y ficha.
   Datos en S.car: info (ficha), km (lecturas de km), mt (mantenimientos), vis (visitas al taller), fuel (repostajes).
   Los gastos no se apuntan aquí: salen de los movimientos con categoría Coche (Finanzas), así no se cuentan dos veces. */
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
  return {
    info: c.info || {},
    km: c.km || [],
    mt: Array.isArray(c.mt) ? c.mt : CAR_MT0,
    vis: c.vis || [],
    fuel: c.fuel || [],
    on: !!S.car
  };
};
/* Para guardar: crea S.car con sus listas (y los mantenimientos de partida) la primera vez. */
const carS = () => {
  const c = (S.car = S.car && typeof S.car === 'object' && !Array.isArray(S.car) ? S.car : {});
  if (!c.info || typeof c.info !== 'object') c.info = {};
  ['km', 'vis', 'fuel'].forEach(k => {
    if (!Array.isArray(c[k])) c[k] = [];
  });
  if (!Array.isArray(c.mt)) c.mt = CAR_MT0.map(x => ({ ...x }));
  return c;
};
const kmf = n => new Intl.NumberFormat('es-ES', { useGrouping: 'always', maximumFractionDigits: 0 }).format(n || 0);
const num1 = n => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(n || 0);
const hasN = v => v !== undefined && v !== null && v !== '' && !isNaN(+v);

/* Kilómetros: todas las lecturas (a mano, repostajes, visitas y mantenimientos hechos). Km actuales, km al día y km del año. */
function carKm(c = carR()) {
  const P = [
    ...c.km,
    ...c.fuel.filter(f => hasN(f.km)),
    ...c.vis.filter(v => hasN(v.km)),
    ...c.mt.filter(x => hasN(x.lk) && x.ld).map(x => ({ d: x.ld, km: x.lk }))
  ]
    .filter(p => p.d && hasN(p.km))
    .map(p => ({ d: p.d, km: +p.km }))
    .sort((a, b) => a.d.localeCompare(b.d) || a.km - b.km);
  if (!P.length) return { cur: null, d: '', rate: null, year: null, P };
  const last = P.reduce((a, p) => (p.km >= a.km ? p : a), P[0]);
  // Ritmo: desde la lectura más antigua de los últimos 6 meses que tenga al menos 14 días de margen.
  const from = P.find(p => dd(last.d, p.d) >= 14 && dd(TD(), p.d) <= 183) || (dd(last.d, P[0].d) >= 14 ? P[0] : null);
  const rate = from && last.km > from.km ? (last.km - from.km) / dd(last.d, from.d) : null;
  const y0 = TD().slice(0, 4) + '-01-01',
    before = P.filter(p => p.d < y0).pop(),
    first = before || P.find(p => p.d >= y0),
    year = first && first !== last ? last.km - first.km : null;
  return { cur: last.km, d: last.d, rate, year, P };
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
/* Lo que hay que mirar: mantenimientos, facturas con categoría Coche (seguro, impuesto…) y documentos de la carpeta Coche que vencen. */
function carNext(c = carR(), K = carKm(c)) {
  const LV = { er: 0, wa: 1, ok: 2, no: 3 };
  const L = [
    ...c.mt.map(x => ({ k: 'mt', x, s: carMt(x, K) })).map(o => ({ ...o, n: o.x.n, d: o.s.due, lvl: o.s.lvl, pill: o.s.pill })),
    ...S.fixed
      .filter(f => f.cat === 'Coche' && f.t === 'g' && fxLive(f) && !f.var)
      .map(f => ({ f, d: fxState(f).due || fxState(f).next }))
      .filter(o => o.d)
      .map(o => {
        const n = dayDiff(o.d);
        return {
          k: 'fx',
          f: o.f,
          n: o.f.name,
          d: o.d,
          lvl: n <= 7 ? 'wa' : 'ok',
          pill: cap(rel(o.d)),
          sub: 'Pago de Facturas · ' + eur(o.f.amt)
        };
      }),
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
          sub: 'Documento · vence ' + fdc(d.exp)
        };
      })
  ];
  return L.sort((a, b) => LV[a.lvl] - LV[b.lvl] || (a.d || '9').localeCompare(b.d || '9'));
}
/* Avisos para Mi día y el menú: solo lo urgente del coche (mantenimientos en rojo) cuando ya se usa la sección. */
const carWarn = () => (S.car ? carNext().filter(o => o.k === 'mt' && o.lvl === 'er') : []);

/* Gastos: los movimientos con categoría Coche (también las partes de un gasto dividido; las devoluciones restan). */
const CAR_G = [
  [
    'Combustible',
    'fuel',
    '#f5a524',
    /gasolin|carburant|combustib|diesel|gasoil|repsol|cepsa|galp| bp |shell|plenoil|ballenoil|petroprix|esso|avia|petronor|campsa| disa |estacion de servicio| e s | ees /
  ],
  [
    'Seguro',
    'shield-check',
    '#7aa7ff',
    /seguro|poliza|mapfre|mutua|allianz|axa|linea directa|generali|reale|zurich|verti|direct seguros|regal|pelayo|qualitas/
  ],
  ['ITV', 'circle-check', '#22c3b4', / itv /],
  [
    'Taller',
    'wrench',
    '#3ccf82',
    /taller|neumat|norauto|midas|feu vert|euromaster|confortauto|recambio|mecanic|chapa|revision|aceite|bateria/
  ],
  ['Impuestos y multas', 'landmark', '#ee8fb6', /impuesto|ivtm|vehiculo|ayuntamiento|ayto|tributo|dgt|multa|sancion|trafico/],
  [
    'Parking y peajes',
    'map-pin',
    '#9b87f5',
    /parking|aparcamiento|peaje|autopista|telpark|empark|saba|via t|zona azul| ora |elparking|bip drive|lavado/
  ],
  ['Otros', 'car', '#8d9099', /.?/]
];
const carType = x => {
  const f = x.fid ? S.fixed.find(f => f.id === x.fid) : null,
    t = nt([x.desc, x.note, f && f.name].filter(Boolean).join(' '));
  return CAR_G.find(g => g[3].test(t));
};
const carTx = () => TXP().filter(x => x.cat === 'Coche' && gAmt(x));
/* Consumo con los repostajes que tienen km y litros: litros desde el segundo repostaje entre los km recorridos. */
function carCons(c = carR()) {
  const F = c.fuel.filter(f => hasN(f.km) && +f.l > 0).sort((a, b) => +a.km - +b.km);
  const out = { n: c.fuel.length, l100: null, pl: null };
  if (F.length >= 2) {
    const km = +F[F.length - 1].km - +F[0].km,
      l = F.slice(1).reduce((a, f) => a + +f.l, 0);
    if (km > 0) out.l100 = (l / km) * 100;
  }
  const P = c.fuel.filter(f => +f.amt > 0 && +f.l > 0);
  if (P.length) out.pl = P.reduce((a, f) => a + +f.amt, 0) / P.reduce((a, f) => a + +f.l, 0);
  return out;
}

/* ---------- pantalla ---------- */
const carPill = (lvl, t) => `<span class="chip ${lvl === 'no' ? '' : lvl}">${esc(t)}</span>`;
const carNextRow = o => {
  if (o.k === 'mt') {
    const s = carMt(o.x, carKm());
    return `<div class="row"><span class="cdot ${o.lvl}"></span><button class="link" data-a="cmt" data-i="${esc(o.x.id)}"><span class="g"><span class="tt">${esc(o.n)}</span><br><span class="mu">${carMtSub(o.x, s)}</span></span></button>${carPill(o.lvl, o.pill)}</div>`;
  }
  const act = o.k === 'fx' ? `data-a="ef" data-i="${o.f.id}"` : `data-a="ed" data-i="${o.doc.id}"`;
  return `<div class="row"><span class="cdot ${o.lvl}"></span><button class="link" ${act}><span class="g"><span class="tt">${esc(o.n)}</span><br><span class="mu">${esc(o.sub)}</span></span></button>${carPill(o.lvl, o.pill)}</div>`;
};
const carMtSub = (x, s) => {
  if (s.lvl === 'no') return esc(carRule(x)) + ' · toca para apuntar la última vez';
  const parts = [];
  if (s.nd) parts.push((s.dL < 0 ? 'Venció el ' : 'Toca el ') + fdc(s.nd));
  if (s.nk !== null) parts.push('a los ' + kmf(s.nk) + ' km' + (s.kd && !s.nd ? ' (≈ ' + fdc(s.kd) + ')' : ''));
  return esc(parts.join(' · ').replace(/^./, m => m.toUpperCase()));
};
const carMtRow = (x, K) => {
  const s = carMt(x, K),
    last = [x.ld ? fdc(x.ld) : '', hasN(x.lk) ? kmf(x.lk) + ' km' : ''].filter(Boolean).join(' a ');
  return `<button class="cmt" data-a="cmt" data-i="${esc(x.id)}"><span class="cmth"><b>${esc(x.n)}</b>${carPill(s.lvl, s.pill)}</span>${s.lvl === 'no' ? '' : `<span class="bar"><div style="width:${Math.round(s.p * 100)}%;background:var(--${s.lvl})"></div></span>`}<span class="mu">${esc(carRule(x))}${last ? ' · Última: ' + esc(last) : ''}${s.lvl !== 'no' ? ' · ' + carMtSub(x, s) : ' · Toca para apuntar la última vez'}</span></button>`;
};
const carKV = rows =>
  `<dl class="ckv">${rows
    .filter(r => r[1])
    .map(
      ([k, v, cp, tel]) =>
        `<dt>${k}</dt><dd>${tel ? `<a href="tel:${esc(String(v).replace(/[^\d+]/g, ''))}">${esc(v)}</a>` : esc(v)}${cp ? ` <button class="ib ccp" data-a="ccp" data-i="${esc(v)}" aria-label="Copiar ${k}" title="Copiar">${I('copy', 'sm')}</button>` : ''}</dd>`
    )
    .join('')}</dl>`;

function vCoche() {
  const c = carR(),
    K = carKm(c),
    i = c.info,
    td = TD(),
    m = MN(new Date()),
    y = td.slice(0, 4);
  const tabs = [
    ['res', 'Resumen'],
    ['tal', 'Taller'],
    ['gas', 'Gastos'],
    ['fic', 'Ficha']
  ];
  const T = carTx(),
    sum = L => L.reduce((a, x) => a + gAmt(x), 0),
    gMes = sum(T.filter(x => mon(x.date) === m)),
    TY = T.filter(x => x.date.slice(0, 4) === y),
    gAno = sum(TY),
    eKm = K.year >= 300 ? gAno / K.year : null,
    co = carCons(c);
  const btn = {
    res: `<button class="btn" data-a="ckm">${I('plus')} Km</button>`,
    tal: `<button class="btn" data-a="cvis">${I('plus')} Visita</button>`,
    gas: `<button class="btn" data-a="cfu">${I('plus')} Repostaje</button>`,
    fic: `<button class="btn" data-a="cinf">${I('pencil')} Editar ficha</button>`
  }[carTab];
  let C = {};
  if (carTab === 'res') {
    const nx = carNext(c, K);
    C = {
      prox: panel(
        'coche',
        'prox',
        `${I('calendar-clock')} Lo próximo`,
        nx.length ? fold('car-prox', nx.map(carNextRow), 4) : empty('Nada a la vista.'),
        'hl'
      ),
      gasto: panel(
        'coche',
        'gasto',
        `${I('wallet')} Lo que cuesta`,
        `<div class="kpis two ckp"><div class="kpi"><span class="k">${cap(new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(new Date()))}</span><span class="v money">${eur(gMes)}</span></div><div class="kpi"><span class="k">En ${y}</span><span class="v money">${eur(gAno)}</span></div></div>
        <div class="mu">${eKm !== null ? `${eur(eKm)} por km este año · ` : ''}De los movimientos con categoría Coche. <button class="link inl" data-a="ctab" data-i="gas">Ver gastos</button></div>`
      ),
      acc: panel(
        'coche',
        'acc',
        `${I('plus')} Apuntar`,
        `<div class="cqk"><button data-a="cfu">${I('fuel')}Repostaje</button><button data-a="cvis">${I('wrench')}Taller</button><button data-a="ckm">${I('gauge')}Km</button><button data-a="cmt">${I('calendar-clock')}Mantenimiento</button></div>`
      )
    };
  } else if (carTab === 'tal') {
    const V = [...c.vis].sort((a, b) => b.d.localeCompare(a.d));
    C = {
      mt: panel(
        'coche',
        'mt',
        `${I('wrench')} Mantenimiento <span class="cnt">· ${c.mt.length}</span>`,
        (c.mt.length
          ? c.mt
              .map(x => [carMt(x, K), x])
              .sort(
                (a, b) =>
                  ({ er: 0, wa: 1, ok: 2, no: 3 })[a[0].lvl] - { er: 0, wa: 1, ok: 2, no: 3 }[b[0].lvl] || a[0].due.localeCompare(b[0].due)
              )
              .map(([, x]) => carMtRow(x, K))
              .join('')
          : empty('Sin mantenimientos.')) + `<button class="morebtn" data-a="cmt">${I('plus')} Añadir mantenimiento</button>`,
        'wide'
      ),
      vis: panel(
        'coche',
        'vis',
        `${I('clock')} Historial del taller${V.length ? ` <span class="cnt">· ${V.length}</span>` : ''}`,
        V.length
          ? fold(
              'car-vis',
              V.map(
                v =>
                  `<div class="row"><button class="link" data-a="cvis" data-i="${v.id}"><span class="g"><span class="tt">${esc(v.what || 'Visita')}</span><br><span class="mu">${[fdc(v.d), hasN(v.km) ? kmf(v.km) + ' km' : '', v.where].filter(Boolean).map(esc).join(' · ')}</span></span></button>${+v.amt ? `<span class="amt money">${eur(+v.amt)}</span>` : ''}</div>`
              ),
              5
            )
          : empty('Aún no hay visitas. Al apuntar una, marca qué se hizo y su fecha y km quedan como «última vez».')
      )
    };
  } else if (carTab === 'gas') {
    // Últimos 12 meses
    const M = [];
    for (let k = 11; k >= 0; k--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - k);
      const mm = MN(d);
      M.push([mm, sum(T.filter(x => mon(x.date) === mm))]);
    }
    const mx = Math.max(1, ...M.map(x => x[1])),
      mo = M.filter(x => x[0].slice(0, 4) === y).length,
      G = {};
    TY.forEach(x => {
      const g = carType(x);
      G[g[0]] = (G[g[0]] || 0) + gAmt(x);
    });
    const GL = CAR_G.filter(g => (G[g[0]] || 0) > 0.005).map(g => [g, G[g[0]]]),
      gt = GL.reduce((a, x) => a + x[1], 0);
    const F = [...c.fuel].sort((a, b) => b.d.localeCompare(a.d) || +b.km - +a.km);
    C = {
      tot: `<div class="kpis ckpis"><div class="kpi"><span class="k">${I('calendar')} En ${y}</span><span class="v money">${eur(gAno)}</span><span class="d">${TY.length} movimiento${TY.length === 1 ? '' : 's'}</span></div><div class="kpi"><span class="k">${I('wallet')} Media al mes</span><span class="v money">${eur(gAno / Math.max(1, mo))}</span><span class="d">Este mes ${eur(gMes)}</span></div><div class="kpi"><span class="k">${I('gauge')} Por km</span><span class="v">${eKm !== null ? `<span class="money">${eur(eKm)}</span>` : '—'}</span><span class="d">${K.year ? kmf(K.year) + ' km este año' : 'Faltan los km'}</span></div></div>`,
      mes: panel(
        'coche',
        'mes',
        `${I('calendar-days')} Por mes <span class="cnt">· últimos 12</span>`,
        `<div class="cmon" role="img" aria-label="Gasto del coche por mes">${M.map(
          ([mm, v]) =>
            `<div class="${mm === m ? 'on' : ''}" title="${MS[+mm.slice(5)]} ${mm.slice(0, 4)}: ${eur(v)}"><em class="money">${v >= 1 ? kmf(v) : ''}</em><i style="height:${Math.max(v > 0 ? 3 : 0, (v / mx) * 100)}%"></i><span>${MS[+mm.slice(5)][0].toUpperCase()}</span></div>`
        ).join('')}</div>`
      ),
      tipo: panel(
        'coche',
        'tipo',
        `${I('tags')} En qué se va <span class="cnt">· ${y}</span>`,
        GL.length
          ? `<div class="cstk">${GL.map(([g, v]) => `<i style="flex:${v};background:${g[2]}" title="${g[0]}"></i>`).join('')}</div>` +
              GL.sort((a, b) => b[1] - a[1])
                .map(
                  ([g, v]) =>
                    `<div class="row">${tile(g[1], g[2])}<span class="g">${g[0]}</span><span class="mu">${Math.round((v / gt) * 100)} %</span><span class="amt money">${eur(v)}</span></div>`
                )
                .join('')
          : empty('Sin gastos del coche este año. Los movimientos con categoría Coche salen aquí solos.')
      ),
      mov: panel(
        'coche',
        'mov',
        `${I('receipt')} Movimientos <span class="cnt">· ${y}</span>`,
        TY.length
          ? fold(
              'car-mov',
              [...TY]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map(x => {
                  const g = carType(x);
                  return `<div class="row">${tile(g[1], g[2])}<button class="link" data-a="etx" data-i="${x.id}"><span class="g"><span class="tt">${esc(x.desc || x.cat)}</span><br><span class="mu">${fdc(x.date)} · ${g[0]}${x.of ? ' · parte de un gasto dividido' : ''}</span></span></button><span class="amt money ${gAmt(x) < 0 ? 'ok' : ''}">${gAmt(x) < 0 ? '+' : ''}${eur(Math.abs(gAmt(x)))}</span></div>`;
                }),
              6
            )
          : empty('Sin movimientos con categoría Coche este año.'),
        'wide'
      ),
      fuel: panel(
        'coche',
        'fuel',
        `${I('fuel')} Repostajes${F.length ? ` <span class="cnt">· ${F.length}</span>` : ''}`,
        (co.l100 !== null || co.pl !== null
          ? `<div class="kpis two ckp">${co.l100 !== null ? `<div class="kpi"><span class="k">Consumo medio</span><span class="v">${num1(co.l100)} <small>l/100 km</small></span></div>` : ''}${co.pl !== null ? `<div class="kpi"><span class="k">Precio medio</span><span class="v money">${eur(co.pl)}<small>/l</small></span></div>` : ''}</div>`
          : '') +
          (F.length
            ? fold(
                'car-fuel',
                F.map(
                  f =>
                    `<div class="row"><button class="link" data-a="cfu" data-i="${f.id}"><span class="g"><span class="tt">${+f.l ? num1(+f.l).replace(/,0$/, '') + ' l' : 'Repostaje'}${+f.amt ? ' · <span class="money">' + eur(+f.amt) + '</span>' : ''}</span><br><span class="mu">${fdc(f.d)}${hasN(f.km) ? ' · ' + kmf(f.km) + ' km' : ''}</span></span></button></div>`
                ),
                4
              )
            : empty('Apunta km y litros al repostar: con dos repostajes ya sale el consumo real.')) +
          `<button class="morebtn" data-a="cfu">${I('plus')} Apuntar repostaje</button>`
      )
    };
  } else {
    const D = S.docs.filter(d => d.cat === 'Coche'),
      seg = S.fixed.find(f => f.cat === 'Coche' && fxLive(f) && /seguro|poliza|póliza/i.test(f.name)),
      segD = seg ? fxState(seg).next : '';
    const kv = (title, ic, k, rows, extra = '') =>
      panel(
        'coche',
        k,
        `${I(ic)} ${title}`,
        (rows.some(r => r[1]) ? carKV(rows) : `<div class="mu">Sin datos todavía.</div>`) +
          extra +
          `<button class="morebtn" data-a="cinf">${I('pencil')} Editar</button>`
      );
    C = {
      car: kv('El coche', 'car', 'car', [
        ['Modelo', i.model],
        ['Matrícula', i.plate, 1],
        ['Bastidor', i.vin, 1],
        ['Matriculado', i.reg ? MS[+i.reg.slice(5, 7)] + ' ' + i.reg.slice(0, 4) : ''],
        ['Combustible', i.fuelT],
        ['Etiqueta DGT', i.dgt]
      ]),
      seg: kv('Seguro y asistencia', 'shield-check', 'seg', [
        ['Compañía', i.ins],
        ['Póliza', i.pol, 1],
        ['Asistencia', i.asis, 1, 1],
        ['Renueva', segD ? fdc(segD) + ' (Facturas)' : '']
      ]),
      tal: kv('Para el taller', 'wrench', 'tal', [
        ['Neumáticos', i.tyr],
        ['Presión', i.pre],
        ['Aceite', i.oil],
        ['Notas', i.notes]
      ]),
      docs: panel(
        'coche',
        'docs',
        `${I('folder-open')} Documentos${D.length ? ` <span class="cnt">· ${D.length}</span>` : ''}`,
        (D.length ? D.map(docRow).join('') : empty('Sin documentos en la carpeta Coche.')) +
          `<button class="morebtn" data-a="ccdoc">${I('plus')} Añadir documento</button>`
      )
    };
  }
  const keys = Object.keys(C).filter(k => C[k] && k !== 'tot');
  VIS.coche = ord('coche', keys);
  const hero = `<section class="carh" aria-label="Kilómetros">
      <div class="carhm"><span class="eyb">${I('gauge', 'sm')} Kilómetros</span>${
        K.cur !== null
          ? `<b>${kmf(K.cur)} <small>km</small></b><span class="carhs">Apuntado ${rel(K.d)}${i.model ? ' · ' + esc(i.model) : ''}</span>`
          : `<b class="carh0">Sin apuntar</b><span class="carhs">Apunta los km que marca el coche para calcular la revisión y el coste por km.</span>`
      }</div>
      <div class="carht">
        <div><span>Km este año</span><b>${K.year !== null ? kmf(K.year) : '—'}</b></div>
        <div><span>Km al día</span><b>${K.rate ? '≈ ' + kmf(K.rate) : '—'}</b></div>
        <div><span>l/100 km</span><b>${co.l100 !== null ? num1(co.l100) : '—'}</b></div>
      </div>
    </section>`;
  return `<div class="hdr"><div><h2>Coche</h2><div class="sub help">Kilómetros, mantenimiento y lo que cuesta. Los gastos salen solos de los movimientos con categoría Coche; aquí solo se apuntan km, repostajes y visitas al taller.</div></div><div class="hact">${btn}</div></div>
  <div class="seg ctabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" aria-selected="${carTab === k}" class="${carTab === k ? 'on' : ''}" data-a="ctab" data-i="${k}">${l}</button>`).join('')}</div>
  ${carTab === 'res' ? hero : ''}${C.tot || ''}
  <div class="grid">${VIS.coche.map(k => C[k]).join('')}</div>`;
}
