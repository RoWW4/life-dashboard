'use strict';
/* Panel de Rocío (Life Dashboard) · lógica de la app
   Datos: objeto S (mismo modelo que la versión artifact, clave localStorage 'ldb-v1').
   Nube opcional: Supabase (tabla ldb_state con el JSON completo + bank_tx con movimientos del banco). */

const CFG = window.LDB_CONFIG || {};
const K = 'ldb-v1';
const APP = 'Panel de Rocío';
const VER = ((document.currentScript && document.currentScript.src.match(/[?&]v=(\d+)/)) || [])[1] || '';

/* ---------- registro de errores de este dispositivo ----------
   Los últimos 50 errores (hora, dónde, mensaje, pila, sección y versión) se guardan en el dispositivo y se ven y copian
   en Ajustes → Estado de los robots. Así un fallo de un botón o de la sincronización no desaparece sin dejar rastro. */
const KERR = 'ldb-errlog';
const errLog = () => {
  try {
    return JSON.parse(localStorage.getItem(KERR) || '[]') || [];
  } catch (e) {
    return [];
  }
};
function logErr(where, e, extra) {
  const m = String((e && (e.message || e.error_description)) || e || 'error desconocido').slice(0, 300);
  try {
    console.error('[panel] ' + where + ': ' + m, e);
  } catch (x) {}
  try {
    const L = errLog(),
      v = typeof view === 'string' ? view : '',
      t = new Date().toISOString();
    // El mismo error repetido (p. ej. un reintento de sincronización) no llena la lista: se cuenta en el último.
    if (L[0] && L[0].w === where && L[0].m === m) {
      L[0].n = (L[0].n || 1) + 1;
      L[0].t = t;
    } else
      L.unshift({
        t,
        w: where,
        m,
        s: String((e && e.stack) || '')
          .split('\n')
          .slice(0, 6)
          .join('\n')
          .slice(0, 800),
        x: String(extra || '').slice(0, 200),
        v: VER,
        view: v
      });
    localStorage.setItem(KERR, JSON.stringify(L.slice(0, 50)));
  } catch (x) {} // sin espacio en el dispositivo: ya ha quedado en la consola
}
/* Errores que nadie captura (un botón que falla, una promesa sin catch): se apuntan y se avisa, como mucho uno cada 10 s. */
function errToast() {
  const n = Date.now();
  if (n - (errToast.t || 0) < 1e4) return;
  errToast.t = n;
  try {
    toast('⚠️ Algo ha fallado. El detalle está en Ajustes → Estado de los robots');
  } catch (x) {}
}
window.addEventListener('error', e => {
  if (!e.error && !e.message) return;
  logErr(
    'global',
    e.error || e.message,
    `${String(e.filename || '')
      .split('/')
      .pop()}:${e.lineno || 0}:${e.colno || 0}`
  );
  errToast();
});
window.addEventListener('unhandledrejection', e => {
  logErr('promesa', e.reason);
  errToast();
});
// Algo bloqueado por la protección CSP de index.html (p. ej. un servicio nuevo que falta añadir): queda apuntado.
document.addEventListener('securitypolicyviolation', e =>
  logErr('seguridad', `Bloqueado ${e.blockedURI || 'contenido en línea'} (${e.effectiveDirective || e.violatedDirective})`)
);
/* Los iconos son nombres de Lucide (ver icons.js) */
const CATS = [
  'Hogar',
  'Supermercado',
  'Coche',
  'Personal',
  'Restaurantes',
  'Ocio',
  'Suscripciones',
  'Salud',
  'Mascotas',
  'Compras',
  'Viajes',
  'Préstamos',
  'Otros',
  'Traspasos',
  'Nómina'
].sort((a, b) => a.localeCompare(b, 'es')); // en orden alfabético en todos los desplegables
/* Traspasos: dinero que mueves entre tus propias cuentas. Se ve en la lista pero no cuenta como gasto ni ingreso. */
const NOCNT = 'Traspasos',
  EXMIN = 300,
  DUPD = 3; // EXMIN: desde este importe un gasto ofrece marcarse como extraordinario · DUPD: días entre un gasto a mano y el del banco para avisar de duplicado
/* Categorías de un ingreso: Nómina, Otros, Traspasos o una de gasto (= devolución: te devuelven parte de ese gasto, p. ej. un Bizum por una cena; resta de esa categoría y no cuenta como ingreso). */
/* Categorías de gasto: todas menos Nómina (Traspasos sí: un traspaso a otra cuenta tuya sale como gasto que no cuenta). */
const GCATS = CATS.filter(c => c !== 'Nómina');
const ICATS = ['Nómina', 'Otros', 'Traspasos', ...CATS.filter(c => !['Nómina', 'Otros', 'Traspasos'].includes(c))];
const CI = {
  Traspasos: 'arrow-left-right',
  Hogar: 'house',
  Supermercado: 'shopping-basket',
  Coche: 'car',
  Personal: 'user',
  Restaurantes: 'utensils',
  Ocio: 'clapperboard',
  Suscripciones: 'tv',
  Salud: 'heart-pulse',
  Mascotas: 'paw-print',
  Compras: 'shopping-bag',
  Viajes: 'plane',
  Préstamos: 'hand-coins',
  Otros: 'package',
  Nómina: 'briefcase'
};
const PAL = {
  Traspasos: '#64748b',
  Hogar: '#0099ff',
  Supermercado: '#2fcf7a',
  Coche: '#f5a524',
  Personal: '#14b8a6',
  Restaurantes: '#ff6b6b',
  Ocio: '#a78bfa',
  Suscripciones: '#22d3ee',
  Salud: '#f472b6',
  Mascotas: '#c08457',
  Compras: '#d946ef',
  Viajes: '#84cc16',
  Préstamos: '#facc15',
  Otros: '#94a3b8',
  Nómina: '#2fcf7a'
};
const AREAS = [
  'Coche',
  'Mascotas',
  'Salud y bienestar',
  'Ocio',
  'Personal',
  'Hogar',
  'Trabajo',
  'Finanzas',
  'Familia y amigos',
  'Otros',
  'Cumpleaños'
];
const AI = {
  Personal: 'user',
  Hogar: 'house',
  Trabajo: 'briefcase',
  'Salud y bienestar': 'dumbbell',
  Finanzas: 'piggy-bank',
  'Familia y amigos': 'users',
  Cumpleaños: 'cake',
  Coche: 'car',
  Mascotas: 'paw-print',
  Ocio: 'gamepad-2',
  Otros: 'pin'
};
const AC = {
  Personal: '#0099ff',
  Hogar: '#38bdf8',
  Trabajo: '#94a3b8',
  'Salud y bienestar': '#2fcf7a',
  Finanzas: '#facc15',
  'Familia y amigos': '#f472b6',
  Cumpleaños: '#e879f9',
  Coche: '#f5a524',
  Mascotas: '#c08457',
  Ocio: '#a78bfa',
  Otros: '#94a3b8'
};
const PR = ['Normal', 'Alta'],
  REP = ['Diaria', 'Semanal', 'Mensual', 'Anual'];
const FQ = { Única: 0, Mensual: 1, Trimestral: 3, Semestral: 6, Anual: 12 };
const DC = ['Personal', 'Coche', 'Hogar', 'Salud', 'Finanzas', 'Mascotas', 'Trabajo', 'Otros'];
const DI = {
  Personal: 'id-card',
  Coche: 'car',
  Hogar: 'house',
  Salud: 'stethoscope',
  Finanzas: 'landmark',
  Mascotas: 'paw-print',
  Trabajo: 'briefcase',
  Otros: 'file-text'
};
const DCOL = {
  Personal: '#0099ff',
  Coche: '#f5a524',
  Hogar: '#38bdf8',
  Salud: '#f472b6',
  Finanzas: '#facc15',
  Mascotas: '#c08457',
  Trabajo: '#94a3b8',
  Otros: '#94a3b8'
};
const DIA = ['imp', 'cal'];
/* Orden inicial de los paneles movibles de cada sección (cada uno se puede reordenar y se guarda en S.order). */
const FIN = ['gasto', 'sinc', 'metas', 'mov', 'reglas'];
const AJ = [
  ['Personalizar', ['midia', 'apar', 'menu', 'fest', 'dict']],
  ['Dinero', ['dinero', 'bank']],
  ['Cuenta y datos', ['cuenta', 'robots', 'copias', 'avz']]
];
/* Grupo de cada panel de Ajustes: el de serie, o al que se haya arrastrado (S.order.ajusg, «panel:Grupo»). */
const ajGrp = k => {
  const m = ((S.order || {}).ajusg || []).find(x => x.split(':')[0] === k);
  const g = m && m.slice(k.length + 1);
  return g && AJ.some(([n]) => n === g) ? g : (AJ.find(([, ks]) => ks.includes(k)) || [])[0];
};
const SEC = [
  ['dia', 'house', 'Mi día', 'Hoy'],
  ['tareas', 'list-checks', 'Tareas', 'Tareas'],
  ['compra', 'shopping-cart', 'Compra', 'Compra'],
  ['fin', 'wallet', 'Finanzas', 'Finanzas'],
  ['fact', 'receipt', 'Facturas', 'Facturas'],
  ['docs', 'folder-open', 'Documentos', 'Docs'],
  ['inv', 'trending-up', 'Inversiones', 'Inversión'],
  ['salud', 'heart-pulse', 'Salud', 'Salud'],
  ['coche', 'car', 'Coche', 'Coche'],
  ['ajus', 'settings', 'Ajustes', 'Ajustes']
];
const FAILMAX = 3; // fallos seguidos del banco antes de avisar (y de que GitHub mande correo)
const secs = () =>
  ord(
    'nav',
    SEC.map(x => x[0])
  ).map(k => SEC.find(x => x[0] === k)); // secciones en el orden elegido (en el ordenador se arrastran en el menú)
/* Secciones que no salen en el menú (Ajustes → Menú). De serie, Compra (se entra desde Mi día). La que está abierta sale siempre. */
const navOff = k => k !== view && (S.navOff || ['compra']).includes(k);
const tabs = () => secs().filter(x => x[0] !== 'ajus' && !navOff(x[0])); // barra del móvil: todas menos Ajustes, que va en el botón de arriba
const MS = ['', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const KW = [
  [/cumplea/i, 'cake'],
  [/vacun/i, 'syringe'],
  [/comida|arena/i, 'shopping-basket'],
  [/itv|revisi/i, 'wrench'],
  [/seguro|p[oó]liza/i, 'shield-check'],
  [/document/i, 'file-text'],
  [/gym|gimnas/i, 'dumbbell'],
  [/bici|carrera/i, 'bike'],
  [/cine|pel[ií]cula/i, 'clapperboard'],
  [/black friday|oferta/i, 'tag'],
  [/llamar|tel[eé]fono/i, 'phone'],
  [/m[eé]dico|cita/i, 'stethoscope']
];
const NW = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6 };

/* Palabras clave para clasificar movimientos del banco (las reglas propias tienen prioridad). */
const KWC = [
  ['Nómina', [' nomina']],
  ['Préstamos', [' prestamo', ' financiacion']],
  ['Mascotas', [' veterinari', ' kiwoko', ' tiendanimal', ' zooplus', ' mascota', ' piensos', ' animalia']],
  [
    'Hogar',
    [
      ' alquiler',
      ' comunidad de prop',
      ' ibi ',
      ' endesa',
      ' iberdrola',
      ' naturgy',
      ' holaluz',
      ' totalenergies',
      ' aguas ',
      ' canal de isabel',
      ' emasesa',
      ' seguro hogar',
      ' butano'
    ]
  ],
  [
    'Suscripciones',
    [
      ' netflix',
      ' spotify',
      ' hbo',
      ' disney',
      ' prime video',
      ' amazon prime',
      ' google ',
      ' apple com',
      ' icloud',
      ' youtube',
      ' lastpass',
      ' openai',
      ' chatgpt',
      ' anthropic',
      ' claude',
      ' movistar',
      ' vodafone',
      ' orange ',
      ' digi ',
      ' pepephone',
      ' masmovil',
      ' lowi',
      ' o2 ',
      ' simyo'
    ]
  ],
  [
    'Supermercado',
    [
      ' mercadona',
      ' carrefour',
      ' lidl',
      ' aldi',
      ' alcampo',
      ' eroski',
      ' consum',
      ' hipercor',
      ' ahorramas',
      ' supermerc',
      ' dia ',
      ' supersol',
      ' coviran',
      ' spar ',
      ' panaderia',
      ' fruteria',
      ' carniceria',
      ' mas y mas'
    ]
  ],
  [
    'Restaurantes',
    [
      ' restaurante',
      ' bar ',
      ' ramen',
      ' cafe',
      ' burger',
      ' mcdonald',
      ' kfc',
      ' telepizza',
      ' domino',
      ' just eat',
      ' glovo',
      ' uber eats',
      ' pita',
      ' sushi',
      ' pizz',
      ' tapas',
      ' cerveceria',
      ' taberna',
      ' starbucks',
      ' foster',
      ' vips',
      ' montaditos',
      ' goiko',
      ' tgb '
    ]
  ],
  [
    'Coche',
    [
      ' repsol',
      ' e s ',
      ' cepsa',
      ' galp',
      ' bp ',
      ' shell',
      ' gasolinera',
      ' petronor',
      ' ballenoil',
      ' plenoil',
      ' petroprix',
      ' parking',
      ' aparcamiento',
      ' renfe',
      ' metro ',
      ' emt ',
      ' taxi',
      ' cabify',
      ' uber ',
      ' bolt ',
      ' autopista',
      ' peaje',
      ' itv',
      ' taller',
      ' neumatic',
      ' mapfre',
      ' linea directa',
      ' mutua madrilena'
    ]
  ],
  [
    'Salud',
    [
      ' farmacia',
      ' gimnasio',
      ' gym',
      ' basic fit',
      ' altafit',
      ' clinica',
      ' dentist',
      ' dental',
      ' hospital',
      ' optica',
      ' fisio',
      ' sanitas',
      ' adeslas',
      ' dkv '
    ]
  ],
  [
    'Ocio',
    [
      ' cine',
      ' yelmo',
      ' cinesa',
      ' kinepolis',
      ' teatro',
      ' concierto',
      ' entradas',
      ' ticketmaster',
      ' steam',
      ' playstation',
      ' nintendo',
      ' museo'
    ]
  ],
  [
    'Personal',
    [' peluquer', ' barberia', ' estetica', ' perfumeria', ' druni', ' primor', ' sephora', ' douglas', ' manicura', ' depilacion']
  ],
  ['Viajes', [' hotel', ' booking', ' airbnb', ' ryanair', ' vueling', ' iberia', ' easyjet', ' aena', ' alsa ', ' blablacar', ' expedia']],
  [
    'Compras',
    [
      ' amazon',
      ' amzn',
      ' aliexpress',
      ' zara',
      ' primark',
      ' decathlon',
      ' ikea',
      ' corte ingles',
      ' mediamarkt',
      ' fnac',
      ' shein',
      ' leroy merlin',
      ' pccomponentes',
      ' action '
    ]
  ]
];

/* ---------- utilidades ---------- */
const $ = s => document.querySelector(s);
const id = () => Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 8);
const p2 = n => String(n).padStart(2, '0');
const iso = d => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
const TD = () => iso(new Date());
const MN = d => iso(d).slice(0, 7),
  mon = s => s.slice(0, 7);
const fd = s => (s ? s.split('-').reverse().join('/') : '');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const eur = n => new Intl.NumberFormat('es-ES', { style: 'currency', currency: S.cur || 'EUR', useGrouping: 'always' }).format(n || 0);
const pnum = v => {
  const s = String(v ?? '')
    .replace(/[\s€]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');
  return parseFloat(s);
};
const addM = (s, n) => {
  const [y, m, d] = s.split('-').map(Number),
    r = new Date(y, m - 1 + n, 1);
  r.setDate(Math.min(d, new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate()));
  return iso(r);
};
const addD = (s, n) => {
  const [y, m, d] = s.split('-').map(Number);
  return iso(new Date(y, m - 1, d + n));
};
const dd = (a, b) => Math.round((new Date(a + 'T00:00') - new Date(b + 'T00:00')) / 864e5);
const dayDiff = s => dd(s, TD());
/* Tarea completada hace más de 7 días (por la fecha en que se marcó; si no consta, por su fecha): deja de verse en
   «Todas» y en el calendario, pero sigue en «Completadas». */
const DONE_DAYS = 7,
  oldDone = t => t.done && (t.doneAt || t.due) && dayDiff(t.doneAt || t.due) < -DONE_DAYS;
const nt = s =>
  ' ' +
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim() +
  ' ';
const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
const opts = (arr, sel) => arr.map(x => `<option ${x === sel ? 'selected' : ''}>${esc(x)}</option>`).join('');
const hash = s => {
  let h1 = 0xdeadbeef,
    h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
};
/* Fecha corta: «22 dic» (con el año si no es el actual: «22 dic 2027»). */
const fdc = d => {
  if (!d) return '';
  const [y, m, dd] = d.split('-');
  return (
    +dd +
    ' ' +
    ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][+m - 1] +
    (y === TD().slice(0, 4) ? '' : ' ' + y)
  );
};
/* Cuándo, siempre igual en toda la app: hoy, mañana, el día de la semana, «en N d» / «hace N d» hasta un mes y, más lejos, «22 dic». */
const rel = d => {
  if (!d) return 'sin fecha';
  const n = dayDiff(d);
  return n < -30
    ? fdc(d)
    : n < -1
      ? 'hace ' + -n + ' d'
      : n === -1
        ? 'ayer'
        : n === 0
          ? 'hoy'
          : n === 1
            ? 'mañana'
            : n < 7
              ? new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(new Date(d + 'T00:00'))
              : n < 31
                ? 'en ' + n + ' d'
                : fdc(d);
};
const ago = t => {
  if (!t) return 'nunca';
  const m = Math.round((Date.now() - new Date(t)) / 6e4);
  return m < 2
    ? 'ahora mismo'
    : m < 60
      ? 'hace ' + m + ' min'
      : m < 1440
        ? 'hace ' + Math.round(m / 60) + ' h'
        : 'hace ' + Math.round(m / 1440) + ' d';
};
/* Icono según lo que se escribe: L = [[expresión, icono, color], …]; se compara sin tildes ni mayúsculas. El primero que encaja gana. */
const pickIco = (L, n, def) => {
  const k = String(n || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  return L.find(([r]) => r.test(k)) || def;
};
