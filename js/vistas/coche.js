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
/* Lo que manda el coche por Kia Connect (robot kia-km, cada 3 h de 7 a 22 h y con «Actualizar»): S.car.live = estado (at: hora del dato, fuel %, low,
   range km, warn: avisos, locked, open: lo que está abierto, loc: {lat, lon}) y S.car.trips = {days: {fecha: {km, min}},
   months: {AAAA-MM: {km, min, spd}}}. Lo escribe la base de datos (ldb_car_live); la app solo lo lee. */
const CAR_AV = {
  oil: 'Nivel de aceite',
  brake: 'Líquido de frenos',
  key: 'Pila de la llave',
  tire: 'Presión de las ruedas'
};
/* % del depósito. Este coche no lo manda (Kia Connect da 0 aunque haya autonomía): con 0 % y autonomía de más de 30 km se toma como «sin dato»
   y se calcula con la autonomía: litros que quedan = km × consumo medio / 100, sobre la capacidad del depósito (ficha técnica del modelo). */
const CAR_TANK = 45, // litros
  CAR_L100 = 7; // l/100 km: el que usa el coche para su autonomía (ajustado comparando con la aguja del depósito, 19/11/2026)
const carFuelReal = lv => (!hasN(lv.fuel) || (+lv.fuel === 0 && hasN(lv.range) && +lv.range > 30) ? null : +lv.fuel);
const carFuel = lv => carFuelReal(lv) ?? (hasN(lv.range) ? Math.min(100, ((+lv.range * CAR_L100) / 100 / CAR_TANK) * 100) : null);
/* Color de la barra: verde por encima de la mitad, naranja hasta 1/4 y rojo en 1/4 o menos. */
const carFuelLvl = p => (p > 50 ? 'ok' : p > 25 ? 'wa' : 'er');
const CAR_AB = { doors: 'puertas', windows: 'ventanillas', trunk: 'maletero', hood: 'capó' };
const carLive = () => (S.car && S.car.live && typeof S.car.live === 'object' ? S.car.live : null);
/* «Actualizar»: pide a Supabase que lance el robot del coche (ldb_car_refresh, como mucho cada 5 min) y espera
   (hasta ~3 min) a que termine según su latido (job_health «kia-km»); luego trae los datos. Solo al pulsarlo (al abrir Coche
   no se lanza). El robot lee lo último que mandó el coche: no lo despierta. */
const carJob = () => (OPS && OPS.jobs ? OPS.jobs.find(j => j.job === 'kia-km') : null);
const carRepaint = () => {
  if (view === 'coche') render();
};
async function carSync(manual) {
  if (carSync.on) return;
  if (!sb || !user) return manual && toast('Inicia sesión para actualizar el coche');
  carSync.on = 1;
  carRepaint();
  let msg = '';
  try {
    const { data, error } = await sb.rpc('ldb_car_refresh');
    if (error) throw error;
    if (data.st === 'sin-token') msg = 'Falta el permiso de GitHub en Supabase';
    else {
      const desde = new Date(data.at).getTime() - 2000;
      msg = 'Kia Connect no ha respondido aún; prueba en un rato';
      for (let i = 0; i < 24; i++) {
        await new Promise(r => setTimeout(r, i < 3 ? 15000 : 8000));
        const { data: j } = await sb.from('job_health').select('last_ok,last_error,last_error_at').eq('job', 'kia-km').maybeSingle();
        if (j && j.last_ok && new Date(j.last_ok) >= desde) {
          msg = 'Coche al día';
          break;
        }
        if (j && j.last_error_at && new Date(j.last_error_at) >= desde) {
          msg = 'No se pudo leer el coche: ' + String(j.last_error || '').slice(0, 100);
          break;
        }
      }
    }
    await pull();
  } catch (e) {
    logErr('coche', e);
    msg = 'No se pudo actualizar: ' + ((e && e.message) || e);
  } finally {
    carSync.on = 0;
  }
  carRepaint();
  if (manual) toast(msg);
}
const carTrips = () => {
  const t = (S.car && S.car.trips) || {};
  return { days: t.days || {}, months: t.months || {} };
};
const carHm = m => (m >= 60 ? Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : '') : Math.round(m || 0) + ' min');
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
    .map(p => ({ d: p.d, km: +p.km, src: p.src }))
    .sort((a, b) => a.d.localeCompare(b.d) || a.km - b.km);
  if (!P.length) return { cur: null, d: '', rate: null, src: '' };
  const last = P.reduce((a, p) => (p.km >= a.km ? p : a), P[0]);
  // Ritmo: desde la lectura más antigua de los últimos 6 meses que tenga al menos 14 días de margen.
  const from = P.find(p => dd(last.d, p.d) >= 14 && dd(TD(), p.d) <= 183) || (dd(last.d, P[0].d) >= 14 ? P[0] : null);
  return {
    cur: last.km,
    d: last.d,
    src: last.src || '',
    rate: from && last.km > from.km ? (last.km - from.km) / dd(last.d, from.d) : null
  };
}

/* Estado de un mantenimiento: próxima fecha (por tiempo o fija), km que faltan, fecha estimada por km, avance y nivel. */
/* ITV de un turismo particular (España): la primera a los 4 años de la matriculación (Ficha), luego cada 2 años y, desde
   los 10 años, cada año. carItvNext da la siguiente después de «after» (la última pasada; sin ella, la primera); una ITV
   pasada hasta 30 días antes de su fecha cuenta para esa fecha. La revisión pre-ITV va 30 días antes de la ITV que toca;
   hecha en los 3 meses antes de esa ITV, ya cuenta para ella. Con matrícula, estas fechas salen solas (no del periodo).
   El robot de avisos (scripts/task-reminders.mjs) hace la misma cuenta. */
const CAR_PRE = /pre-?\s?itv/i,
  CAR_ITV = /\bitv\b/i;
function carItvNext(reg, after) {
  const r = /^\d{4}-\d{2}$/.test(reg || '') ? reg + '-01' : reg;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r || '')) return '';
  let y = 4,
    d = addM(r, 48);
  while (after && d <= addD(after, 30)) {
    y += y >= 10 ? 1 : 2;
    d = addM(r, y * 12);
  }
  return d;
}
function carItvDate(x) {
  const c = S.car || {},
    reg = (c.info || {}).reg;
  if (!reg || !CAR_ITV.test(x.n || '')) return '';
  if (!CAR_PRE.test(x.n)) return carItvNext(reg, x.ld);
  const itv = (c.mt || []).find(m => m !== x && CAR_ITV.test(m.n || '') && !CAR_PRE.test(m.n)),
    n = carItvNext(reg, itv && itv.ld),
    pre = addD(n, -30);
  return x.ld && x.ld >= addD(n, -90) ? addD(carItvNext(reg, n), -30) : pre;
}
/* Nombre en la lista: «Primera ITV» pasa a «ITV» cuando ya se ha pasado la primera. */
const carMtName = x => (x.ld && /^primera itv$/i.test((x.n || '').trim()) ? 'ITV' : x.n);
function carMt(x, K) {
  const nd = carItvDate(x) || x.nd || (x.ld && +x.m ? addM(x.ld, +x.m) : ''),
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
  const lv = carLive(),
    kia = lv
      ? [
          ...(lv.warn || [])
            .filter(w => CAR_AV[w])
            .map(w => ({ k: 'kia', n: CAR_AV[w], d: TD(), lvl: 'er', pill: 'Aviso', sub: 'Aviso del coche (Kia Connect)' })),
          ...(lv.low
            ? [
                {
                  k: 'kia',
                  n: 'Depósito bajo',
                  d: TD(),
                  lvl: 'er',
                  pill: hasN(lv.range) ? kmf(lv.range) + ' km' : 'Repostar',
                  sub: 'Quedan ' + (carFuel(lv) != null ? Math.round(carFuel(lv)) + ' %' : 'pocos litros')
                }
              ]
            : [])
        ]
      : [];
  const L = [
    ...kia,
    ...c.mt
      .map(x => ({ k: 'mt', x, s: carMt(x, K) }))
      .filter(o => o.s.lvl !== 'no')
      .map(o => ({ ...o, n: carMtName(o.x), d: o.s.due, lvl: o.s.lvl, pill: o.s.pill })),
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
        sub: 'Cargo de ' + eur(o.f.amt) // la fecha ya va a la derecha
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
/* Avisos para Mi día: los mantenimientos en rojo y los avisos del coche (Kia; en la sección van en «Estado», no en Lo próximo). */
const carWarn = () => (S.car ? carNext().filter(o => (o.k === 'mt' || o.k === 'kia') && o.lvl === 'er') : []);
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
/* Dibujo del coche (SUV pequeño azul, de lado, genérico) para el panel de los km: a la derecha, difuminado hacia la izquierda. */
const carArt = () =>
  `<svg class="carart" viewBox="140 280 620 245" aria-hidden="true"><defs><linearGradient id="cab" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4d9be0"/><stop offset=".45" stop-color="#1f6aae"/><stop offset="1" stop-color="#0f3d70"/></linearGradient><linearGradient id="caw" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9fc6ee" stop-opacity=".45"/><stop offset=".5" stop-color="#0a1626" stop-opacity=".95"/><stop offset="1" stop-color="#0a1626"/></linearGradient></defs><g transform="translate(895 0) scale(-1 1)">` +
  `<ellipse cx="450" cy="514" rx="300" ry="9" fill="#000" opacity=".4"/>` +
  `<path d="M155 470 150 440 152 405Q158 386 175 378L210 372 325 352 420 305Q435 297 455 296L620 298Q650 300 662 314L722 356Q735 365 737 390L742 430 745 455Q745 472 730 472H708A56 56 0 0 0 596 472H316A58 58 0 0 0 200 472H165Q155 472 155 470Z" fill="url(#cab)"/>` +
  `<path d="M150 446H745V455Q745 472 730 472H708A56 56 0 0 0 596 472H316A58 58 0 0 0 200 472H165Q155 472 155 470Z" fill="#11161f"/><path d="M196 472A62 62 0 0 1 320 472M592 472A60 60 0 0 1 712 472" fill="none" stroke="#11161f" stroke-width="12"/><path d="M722 425 744 428 745 450 718 450Z" fill="#11161f"/>` +
  `<path d="M338 362 425 309Q435 302 450 302L615 304Q640 306 654 318L668 330 646 352Z" fill="url(#caw)"/><path d="M497 302V362M602 304 598 356" stroke="#1f6aae" stroke-width="5"/>` +
  `<path d="M432 296 636 293" stroke="#c9ced6" stroke-width="4" stroke-linecap="round"/>` +
  `<path d="M210 396 724 380" stroke="#8fc1f0" stroke-opacity=".35" stroke-width="2"/><path d="M497 362V448" stroke="#0d3561" stroke-width="1.5"/><rect x="452" y="376" width="24" height="5" rx="2.5" fill="#cfe0ff" opacity=".55"/><rect x="598" y="372" width="22" height="5" rx="2.5" fill="#cfe0ff" opacity=".55"/>` +
  `<path d="M336 350H362V368H342Z" fill="#164f88"/>` +
  `<path d="M160 392 212 386 206 401 162 406Z" fill="#eaf2ff"/><path d="M688 364 728 368 732 384 694 382Z" fill="#ff4d5e"/>` +
  `<circle cx="258" cy="467" r="47" fill="#0b0d12"/><circle cx="258" cy="467" r="34" fill="#cfd4dc"/><circle cx="258" cy="467" r="28" fill="none" stroke="#2a2f38" stroke-width="16" stroke-dasharray="5 6"/><circle cx="258" cy="467" r="9" fill="#8b929e"/><circle cx="652" cy="467" r="47" fill="#0b0d12"/><circle cx="652" cy="467" r="34" fill="#cfd4dc"/><circle cx="652" cy="467" r="28" fill="none" stroke="#2a2f38" stroke-width="16" stroke-dasharray="5 6"/><circle cx="652" cy="467" r="9" fill="#8b929e"/></g></svg>`;
/* Mapa de dónde está aparcado, dentro de la tarjeta: Leaflet (se carga solo al abrir el mapa) con el mapa de
   OpenStreetMap (sin clave; con el tema oscuro se oscurece con un filtro). Se mueve con el dedo y se acerca con dos dedos o + y −.
   «Llegar al coche» pide la ubicación del móvil, marca dónde estás y dibuja el camino andando (routing.openstreetmap.de;
   si no responde, línea recta); «Indicaciones» abre la navegación paso a paso en Google Maps. */
const LEAF = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/';
let carLeaf = null, // promesa de carga de Leaflet
  carMapV = null, // centro y zoom del mapa entre repintados
  carMe = null, // [lat, lon] del móvil
  carRt = null; // camino andando: {pts, m, s, aprox, to}
function carLeafLoad() {
  if (window.L) return Promise.resolve();
  return (carLeaf =
    carLeaf ||
    new Promise((ok, ko) => {
      const c = document.createElement('link');
      Object.assign(c, {
        rel: 'stylesheet',
        href: LEAF + 'leaflet.css',
        integrity: 'sha384-sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H',
        crossOrigin: 'anonymous'
      });
      const s = document.createElement('script');
      Object.assign(s, {
        src: LEAF + 'leaflet.js',
        integrity: 'sha384-cxOPjt7s7Iz04uaHJceBmS+qpjv2JkIHNVcuOrM+YHwZOmJGBXI00mdUXEq65HTH',
        crossOrigin: 'anonymous'
      });
      s.onload = ok;
      s.onerror = () => {
        carLeaf = null;
        ko(new Error('Leaflet'));
      };
      document.head.append(c, s);
    }));
}
const carDist = m => (m < 1000 ? Math.round(m / 10) * 10 + ' m' : (m / 1000).toFixed(1).replace('.', ',') + ' km');
function carMap(lat, lon) {
  const rt = carRt && carRt.to === lat + ',' + lon ? carRt : null,
    dir = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=walking`;
  return (
    `<div class="cmap" id="cmap" role="application" aria-label="Mapa de dónde está aparcado el coche"><div class="cmload">${I('map-pin', 'sm')} Cargando mapa…</div></div>` +
    `<div class="cmbar">${
      rt
        ? `<span class="g"><b>${Math.max(1, Math.round(rt.s / 60))} min andando</b><br><span class="mu">${carDist(rt.m)}${rt.aprox ? ' en línea recta' : ''}</span></span><button class="ib" data-a="cgx" aria-label="Quitar el camino" title="Quitar el camino">${I('x')}</button><a class="btn sm" href="${dir}" target="_blank" rel="noopener noreferrer">${I('navigation', 'sm')} Indicaciones</a>`
        : `<span class="g mu">Toca para ver dónde estás tú y el camino.</span><button class="btn sm" data-a="cgo">${I('navigation', 'sm')} Llegar al coche</button>`
    }</div>`
  );
}
/* Después de pintar: monta el mapa en #cmap (si está abierto). Guarda centro y zoom para el siguiente repintado. */
function carMapMount() {
  const el = document.getElementById('cmap'),
    lv = carLive();
  if (!el || !lv || !lv.loc) return;
  const car = [+lv.loc.lat, +lv.loc.lon];
  carLeafLoad()
    .then(() => {
      if (!el.isConnected) return;
      el.innerHTML = '';
      const m = L.map(el, { zoomControl: false, attributionControl: true }),
        dark = S.theme !== 'light';
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
      }).addTo(m);
      el.classList.toggle('dk', dark); // con el tema oscuro, el mapa se oscurece con un filtro (styles.css)
      m.attributionControl.setPrefix(false);
      L.control.zoom({ position: 'topright', zoomInTitle: 'Acercar', zoomOutTitle: 'Alejar' }).addTo(m);
      const rt = carRt && carRt.to === car.join(',') ? carRt : null;
      if (rt) L.polyline(rt.pts, { color: '#4d9bff', weight: 5, opacity: 0.9, dashArray: rt.aprox ? '6 8' : null }).addTo(m);
      L.marker(car, {
        icon: L.divIcon({ className: '', html: `<span class="cmpin">${I('car')}</span>`, iconSize: [40, 40], iconAnchor: [20, 20] }),
        title: 'Coche'
      }).addTo(m);
      if (carMe)
        L.marker(carMe, {
          icon: L.divIcon({ className: '', html: '<span class="cmme"><i></i><b>Tú</b></span>', iconSize: [18, 18], iconAnchor: [9, 9] }),
          title: 'Tú'
        }).addTo(m);
      if (carMapV) m.setView(carMapV.c, carMapV.z, { animate: false });
      else if (rt) m.fitBounds(L.latLngBounds(rt.pts.concat([car])), { padding: [44, 44], maxZoom: 18 });
      else m.setView(car, 16);
      m.on('moveend', () => (carMapV = { c: m.getCenter(), z: m.getZoom() }));
    })
    .catch(() => {
      if (el.isConnected)
        el.innerHTML = `<div class="cmload">No se pudo cargar el mapa. <a href="https://www.google.com/maps/search/?api=1&query=${car.join(',')}" target="_blank" rel="noopener noreferrer">Abrir en Google Maps</a></div>`;
    });
}
/* Tarjeta «Estado»: avisos, si está cerrado y dónde está aparcado. */
function carEstado(lv) {
  const W = (lv.warn || []).filter(w => CAR_AV[w]),
    O = (lv.open || []).filter(x => CAR_AB[x]),
    row = (ic, co, t, s, extra = '') =>
      `<div class="row">${tile(ic, co)}<span class="g"><span class="tt">${t}</span>${s ? `<br><span class="mu">${s}</span>` : ''}</span>${extra}</div>`;
  return (
    (W.length
      ? W.map(w => row('triangle-alert', 'var(--er)', esc(CAR_AV[w]), 'Aviso del coche', carPill('er', 'Revisar'))).join('')
      : row('circle-check', 'var(--ok)', 'Sin avisos', 'Aceite, frenos, ruedas y pila de la llave')) +
    (lv.locked === undefined && !O.length
      ? ''
      : O.length
        ? row('lock-open', 'var(--wa)', 'Abierto: ' + O.map(x => CAR_AB[x]).join(', '), lv.locked ? 'Con el cierre puesto' : 'Sin cerrar')
        : lv.locked
          ? row('lock', 'var(--ok)', 'Cerrado', 'Puertas, ventanillas y maletero')
          : row('lock-open', 'var(--wa)', 'Sin cerrar', 'Puertas, ventanillas y maletero cerrados, pero sin el cierre puesto')) +
    (lv.loc && hasN(lv.loc.lat) && hasN(lv.loc.lon)
      ? row(
          'map-pin',
          CARC,
          'Aparcado',
          cap(ago(lv.at)),
          `<button class="btn sm ghost" data-a="xp" data-i="carmap" aria-expanded="${!!exp.carmap}">${I(exp.carmap ? 'chevron-up' : 'map-pin', 'sm')} ${exp.carmap ? 'Ocultar' : 'Ver en el mapa'}</button>`
        ) + (exp.carmap ? carMap(+lv.loc.lat, +lv.loc.lon) : '')
      : '') +
    `<div class="mu carup"><span>${
      carSync.on
        ? 'Actualizando…'
        : `Datos del coche ${ago(lv.at)}${carJob() && carJob().last_ok ? ` · comprobado ${ago(carJob().last_ok)}` : ''}`
    }</span></div>`
  );
}
/* Tarjeta «Conducción»: cifras (semana, mes, día que más, entre semana), calendario del mes con los km de cada día
   (al tocar un día, su detalle: tiempo, viajes, velocidad media y máxima) y barras por meses.
   Los días sin viajes no se guardan: desde el primer día guardado, un día que falta cuenta como 0 km. */
let carCalM = 0, // mes del calendario: 0 = el actual, -1 = el anterior…
  carDay = ''; // día abierto en el calendario
function carCond(T) {
  const D = T.days,
    keys = Object.keys(D).sort(),
    first = keys[0] || TD(),
    km = d => (D[d] ? +D[d].km || 0 : 0),
    sum = (a, b) => {
      let t = 0;
      for (let d = a; d <= b; d = addD(d, 1)) t += km(d);
      return t;
    },
    td = TD(),
    wd = (new Date(td + 'T00:00').getDay() + 6) % 7, // 0 = lunes
    w0 = addD(td, -wd),
    tw = sum(w0, td),
    pw = sum(addD(w0, -7), addD(td, -7)), // la semana pasada hasta el mismo día
    mk = td.slice(0, 7),
    mT = T.months[mk] || {},
    mKm = mT.km != null ? +mT.km : sum(mk + '-01', td),
    // Día de la semana con más km de media (últimos 60 días con datos; si hay empate, el primero de lunes a domingo)
    // y media de lunes a viernes (últimos 30).
    from60 = [addD(td, -59), first].sort()[1],
    by = Array.from({ length: 7 }, () => [0, 0]);
  for (let d = from60; d <= td; d = addD(d, 1)) {
    const w = new Date(d + 'T00:00').getDay();
    by[w][0] += km(d);
    by[w][1]++;
  }
  const avgW = [1, 2, 3, 4, 5, 6, 0].map(w => (by[w][1] ? Math.round(by[w][0] / by[w][1]) : 0)), // de lunes a domingo
    top = avgW.indexOf(Math.max(...avgW));
  let lv = [0, 0];
  for (let d = [addD(td, -29), first].sort()[1]; d <= td; d = addD(d, 1)) {
    const w = new Date(d + 'T00:00').getDay();
    if (w > 0 && w < 6) lv = [lv[0] + km(d), lv[1] + 1];
  }
  const kpi = (t, v, s, cl = '') => `<div class="ckp"><span>${t}</span><b>${v}</b><em class="${cl}">${s}</em></div>`,
    pct = pw ? Math.round(((tw - pw) / pw) * 100) : null;
  // Calendario
  const base = new Date(+td.slice(0, 4), +td.slice(5, 7) - 1 + carCalM, 1),
    cm = MN(base),
    nd = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate(),
    off = (base.getDay() + 6) % 7,
    cmT = T.months[cm] || {},
    cmKm = cmT.km != null ? +cmT.km : sum(cm + '-01', [cm + '-' + String(nd).padStart(2, '0'), td].sort()[0]),
    lvl = k => (k <= 0 ? 'z' : k < 15 ? 'l1' : k < 35 ? 'l2' : k < 60 ? 'l3' : 'l4'),
    cells = [];
  for (let i = 0; i < off; i++) cells.push('<span class="e"></span>');
  for (let i = 1; i <= nd; i++) {
    const d = cm + '-' + String(i).padStart(2, '0'),
      sin = d > td || d < first,
      k = km(d);
    cells.push(
      sin
        ? `<span class="f">${i}</span>`
        : `<button class="${lvl(k)}${d === td ? ' hoy' : ''}${d === carDay ? ' on' : ''}" data-a="ccd" data-i="${d}" aria-label="${fdc(d)}: ${kmf(k)} km"><b>${i}</b>${k ? `<em>${kmf(k)} km</em>` : ''}</button>`
    );
  }
  const x = carDay && carDay.slice(0, 7) === cm ? D[carDay] || { km: 0 } : null,
    det = x
      ? `<div class="ccdet"><b>${cap(new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'short' }).format(new Date(carDay + 'T00:00')))}</b>${
          +x.km
            ? `<div class="ccdg">${[
                ['Km', kmf(x.km)],
                ['Al volante', carHm(+x.min || 0)],
                x.n ? ['Viajes', x.n] : null,
                x.spd ? ['Media', Math.round(x.spd) + ' km/h'] : null,
                x.max ? ['Máxima', Math.round(x.max) + ' km/h'] : null
              ]
                .filter(Boolean)
                .map(([a, b]) => `<span><em>${a}</em>${b}</span>`)
                .join('')}</div>`
            : '<div class="mu">No se usó el coche.</div>'
        }</div>`
      : '',
    ml = cap(new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(base)),
    canPrev = cm > first.slice(0, 7),
    M = Object.keys(T.months).sort().reverse().slice(0, 6),
    mMax = Math.max(1, ...M.map(m => +T.months[m].km || 0)),
    mes = m =>
      cap(
        new Intl.DateTimeFormat('es-ES', { month: 'long', year: m.slice(0, 4) === td.slice(0, 4) ? undefined : 'numeric' }).format(
          new Date(m + '-01T00:00')
        )
      );
  return (
    `<div class="ckps">${kpi('Esta semana', kmf(tw) + ' km', pct === null ? 'Desde el lunes' : (pct > 0 ? '+' : '') + pct + ' % que la pasada')}${kpi('Este mes', kmf(mKm) + ' km', mT.min ? carHm(+mT.min) + ' al volante' : 'Hasta hoy')}${
      avgW[top]
        ? kpi(
            'Día con más km',
            ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'][top],
            kmf(avgW[top]) + ' km de media'
          )
        : ''
    }${lv[1] ? kpi('Entre semana', kmf(lv[0] / lv[1]) + ' km/día', 'De lunes a viernes') : ''}</div>` +
    `<div class="cgnav"><button class="ib" data-a="ccm" data-i="-1" aria-label="Mes anterior" ${canPrev ? '' : 'disabled'}>${I('chevron-left')}</button><b>${ml}</b><button class="ib" data-a="ccm" data-i="1" aria-label="Mes siguiente" ${carCalM ? '' : 'disabled'}>${I('chevron-right')}</button></div>` +
    `<div class="mu ccsub">${kmf(cmKm)} km${cmT.min ? ' · ' + carHm(+cmT.min) + ' al volante' : ''}${cmT.spd ? ' · ' + Math.round(cmT.spd) + ' km/h de media' : ''}</div>` +
    `<div class="ccal">${['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => `<span class="h">${d}</span>`).join('')}${cells.join('')}</div>` +
    (det || `<div class="mu cchint">Toca un día para ver el detalle.</div>`) +
    (M.length
      ? `<div class="dh">Por meses</div><div class="cml">${M.map(m => {
          const k = +T.months[m].km || 0;
          return `<div><span>${mes(m)}</span><i><b style="width:${Math.round((k / mMax) * 100)}%"></b></i><em>${kmf(k)} km</em></div>`;
        }).join('')}</div>`
      : '')
  );
}
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
      lv = carLive(),
      TR = carTrips(),
      mes = cap(new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(md)) + (gy === y ? '' : ' ' + gy);
    top = `<section class="carh" aria-label="Kilómetros">${carArt()}<div class="carhm"><span class="eyb">${I('gauge', 'sm')} Kilómetros</span>${
      K.cur !== null
        ? `<b>${kmf(K.cur)} <small>km</small></b><span class="carhs">${K.src === 'kia' ? 'De Kia Connect' : 'Apuntado'} ${rel(K.d)}</span>${
            lv && carFuel(lv) != null
              ? `<span class="carfu ${lv.low ? 'er' : carFuelLvl(carFuel(lv))}" title="${carFuelReal(lv) == null ? `Calculado con la autonomía: depósito de ${CAR_TANK} l y consumo medio de ${String(CAR_L100).replace('.', ',')} l/100 km` : 'Dato del coche'}"><span class="carfb"><i style="width:${Math.max(3, carFuel(lv)).toFixed(0)}%"></i></span>${I('fuel', 'sm')} ${carFuelReal(lv) == null ? '≈ ' : ''}${Math.round(carFuel(lv))} %${hasN(lv.range) ? `<span class="carfa"><span class="carfr">${kmf(lv.range)} km</span> de autonomía</span>` : ''}</span>`
              : ''
          }`
        : `<b class="carh0">Sin apuntar</b><span class="carhs">Toca las flechas para leer los km del coche.</span>`
    }</div><button class="carhb${carSync.on ? ' gira' : ''}" data-a="carup" aria-label="Actualizar los datos del coche" title="${carSync.on ? 'Actualizando… (tarda un minuto)' : 'Actualizar los datos del coche'}" ${carSync.on ? 'disabled' : ''}>${I('refresh-cw')}</button></section>`;
    C = {
      prox: panel(
        'coche',
        'prox',
        `${I('calendar-clock')} Lo próximo`,
        (nx.some(o => o.k !== 'kia') ? fold('car-prox', nx.filter(o => o.k !== 'kia').map(carNextRow), 5) : empty('Nada a la vista.')) +
          `<button class="morebtn" data-a="cmt" data-i="">${I('plus')} Añadir fecha</button>`,
        'hl'
      ),
      ...(lv ? { estado: panel('coche', 'estado', `${I('shield-check')} Estado`, carEstado(lv)) } : {}),
      ...(Object.keys(TR.days).length || Object.keys(TR.months).length
        ? { cond: panel('coche', 'cond', `${I('route')} Conducción`, carCond(TR)) }
        : {}),
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
