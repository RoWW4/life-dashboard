'use strict';
/* Estado del panel (objeto S), semillas y migraciones de datos. */
/* ---------- estado ---------- */
const def = () => ({
  name: '',
  tasks: [],
  shop: [],
  tx: [],
  fixed: [],
  fxIgn: [],
  docs: [],
  order: {},
  fxDone: [],
  fxFrom: '',
  budget: 0,
  theme: 'dark',
  cur: 'EUR',
  seeded: [],
  rules: [],
  fixes: [],
  region: '',
  localHol: [],
  periods: [],
  bankSeen: [],
  bankLast: '',
  gacct: '',
  sav: null,
  goals: [],
  bar: null,
  _ts: 0
});
function normalize(o) {
  const s = { ...def(), ...(o || {}) };
  for (const k of [
    'tasks',
    'shop',
    'tx',
    'fixed',
    'fxIgn',
    'docs',
    'fxDone',
    'seeded',
    'rules',
    'fixes',
    'localHol',
    'periods',
    'bankSeen',
    'goals'
  ])
    if (!Array.isArray(s[k])) s[k] = [];
  if (!s.order || typeof s.order !== 'object') s.order = {};
  return s;
}
let S = normalize(
  (() => {
    try {
      return JSON.parse(localStorage.getItem(K));
    } catch (e) {
      return null;
    }
  })()
);
/* Al recargar (p. ej. tirando hacia abajo en el móvil) se vuelve a la misma sección; al abrir la app de cero, Mi día. */
const VIEW0 = (() => {
  try {
    return sessionStorage.getItem('ldb-view');
  } catch (e) {
    return null;
  }
})();
let view = VIEW0 || 'dia',
  flt = 'pend',
  grp = 'area',
  selD = '',
  cm = new Date(),
  finOff = 0,
  VIS = {},
  exp = {},
  cust = false;

/* Migraciones y limpieza. Devuelve true si cambió algo.
   El repositorio es público: aquí no van datos personales (ni semillas con nombres, importes o documentos); sus datos viven en Supabase. */
function seed() {
  let c = 0;
  const once = (k, fn) => {
    if (!S.seeded.includes(k)) {
      S.seeded.push(k);
      fn();
      c++;
    }
  };
  once('clean-desc-v1', () =>
    S.tx.forEach(x => {
      if (x.bank || x.xls) x.desc = cleanDesc(x.desc);
    })
  );
  // Compras con Google Pay (y similares) que habían caído en Suscripciones: se limpia el concepto y se reclasifican.
  once('gpay-v1', () =>
    S.tx.forEach(x => {
      if (!PAYP.test(x.desc || '')) return;
      x.desc = cleanDesc(x.desc);
      if (x.cat === 'Suscripciones') x.cat = classify(x.desc, x.t);
    })
  );
  // Categorías renombradas: Vivienda → Hogar y Alimentación → Supermercado (movimientos, partes de un gasto dividido,
  // reglas y facturas). Siempre, no solo una vez: así se corrige también lo que guarde otro dispositivo con la versión anterior.
  const REN = { Vivienda: 'Hogar', Alimentación: 'Supermercado' },
    ren = o => {
      if (Array.isArray(o)) o.forEach(ren);
      else if (o && typeof o === 'object')
        for (const k in o)
          if (k === 'cat' && REN[o[k]]) {
            o[k] = REN[o[k]];
            c++;
          } else if (o[k] && typeof o[k] === 'object') ren(o[k]);
    };
  ren([S.tx, S.rules, S.fixed]);
  // La carpeta de documentos «Identidad» pasa a llamarse «Personal» (como en Drive y en el bot).
  once('doc-personal-v1', () =>
    S.docs.forEach(d => {
      if (d.cat === 'Identidad') d.cat = 'Personal';
    })
  );
  // Prioridad de las tareas: solo Normal o Alta (Baja y Media pasan a Normal; Urgente, a Alta).
  once('pr-2-v1', () =>
    S.tasks.forEach(t => {
      t.pr = t.pr === 'Alta' || t.pr === 'Urgente' ? 'Alta' : 'Normal';
    })
  );
  // Migraciones de versiones anteriores
  if (Array.isArray(S.events) && S.events.length)
    S.events.forEach(e =>
      S.tasks.push({ id: id(), title: e.title, due: e.date, tm: e.start || '', pr: 'Normal', area: 'Personal', rep: '', done: false })
    );
  S.tasks.forEach(t => {
    if (t.rep === undefined) {
      t.rep = t.area === 'Cumpleaños' ? 'Anual' : '';
      c++;
    }
    if (t.tm === undefined) t.tm = '';
  });
  // Fijos y facturas pasan a ser una sola lista (S.fixed, sección Facturas). La app deja de apuntar gastos sola:
  // cada pago se da por hecho cuando llega su movimiento del banco (o se marca a mano).
  once('unify-v1', () => {
    (S.bills || [])
      .filter(b => !b.paid)
      .forEach(b => {
        const f = {
          id: 'fx-' + b.id,
          name: b.name,
          t: 'g',
          amt: b.amount || 0,
          cat: b.cat || classify(b.name),
          day: +b.due.slice(8),
          from: mon(b.due)
        };
        if (b.freq === 'Única') {
          f.once = b.due;
          delete f.day;
        } else if (b.freq === 'Anual') f.month = +b.due.slice(5, 7);
        else if (FQ[b.freq] > 1) f.every = FQ[b.freq];
        S.fixed.push(f);
        S.tx.forEach(x => {
          if (x.billId === b.id) {
            x.fid = f.id;
            delete x.billId;
          }
        });
      });
    S.fixed.forEach(f => {
      const x = S.tx.find(y => y.fid === f.id && fromBank(y));
      if (x && !f.k) f.k = nt(concept(x)).trim();
    });
    S.tx.filter(x => fromBank(x) && x.date >= addD(TD(), -90)).forEach(fxMatch);
  });
  // «events» (agenda antigua) y «bills» (facturas antiguas) ya pasaron a Tareas y Facturas: se quitan de los datos.
  for (const k of ['events', 'bills'])
    if (k in S) {
      delete S[k];
      c++;
    }
  c += fxLearn();
  if (S.theme === 'auto') S.theme = 'dark';
  return c > 0;
}
