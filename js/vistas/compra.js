'use strict';
/* Sección «Compra». */
/* Icono y color de cada producto según su nombre (palabras clave, sin tildes). El primero que encaja gana; si ninguno, la cesta. */
const SHOP_IC = [
  [
    /\b(gel\b|champu|jabon|desodorante|pasta de dientes|dentifrico|cepillo|higiene|papel higienico|compresa|tampon|cuchilla|crema (?!de)|crema$|colonia|algodon|bastoncillo|clinex|kleenex|panuelo)/,
    'bath',
    '#f472b6'
  ],
  [/\b(palomita|snack|patatas fritas|nachos|aperitivo)/, 'popcorn', '#f5d33d'],
  [/\b(sopa|caldo|crema de|pure)/, 'soup', '#f0a83a'],
  [/\b(lech|yogur|nata|mantequill|queso|kefir)/, 'milk', '#7aa7ff'],
  [/\bhuevo/, 'egg', '#f5d33d'],
  [/\b(pan|barra|baguette)\b|\b(bolleri|croissant|magdalena|tostad|bizcocho)/, 'croissant', '#f0a83a'],
  [/\b(galleta|cookie)/, 'cookie', '#c08457'],
  [/\b(harina|pasta|macarron|espaguet|fideo|cereal|avena|arroz|cuscus|quinoa)/, 'wheat', '#e5b85c'],
  [/\b(garbanzo|lenteja|judia|alubia|legumbre|guisante)/, 'bean', '#b08968'],
  [/\b(manzana|pera|fruta|melocoton|kiwi|melon|sandia|pina)/, 'apple', '#34c77b'],
  [/\b(platano|banana)/, 'banana', '#f5d33d'],
  [/\b(naranja|limon|mandarina|lima|pomelo)/, 'citrus', '#fb923c'],
  [/\b(fresa|cereza|frambuesa|arandano)/, 'cherry', '#f43f5e'],
  [/\buva/, 'grape', '#a78bfa'],
  [/\b(lechuga|espinaca|acelga|brocoli|rucula|canonigo|col\b|coliflor|repollo|puerro|pepino|calabacin)/, 'leafy-green', '#34c77b'],
  [/\bensalada/, 'salad', '#34c77b'],
  [/\b(zanahoria|patata|cebolla|tomate|pimiento|ajo|verdura|berenjena|calabaza|champinon|seta)/, 'carrot', '#fb923c'],
  [/\b(pollo|pavo|alita|muslo|pechuga)/, 'drumstick', '#f97362'],
  [/\b(panceta|jamon|embutido|chorizo|salchichon|fiambre|bacon|beicon|salchicha|lomo|mortadela)/, 'ham', '#f472b6'],
  [/\b(carne|ternera|cerdo|filete|hamburguesa|chuleta|cordero|picada)/, 'beef', '#ef4444'],
  [/\b(pescado|atun|salmon|merluza|gamba|marisco|sardina|bacalao|langostino|calamar|mejillon|boqueron|surimi)/, 'fish', '#38bdf8'],
  [/\b(cafe|te|infusion|cacao|colacao|manzanilla)\b/, 'coffee', '#c08457'],
  [/\bagua\b/, 'glass-water', '#38bdf8'],
  [/\b(refresco|coca|cola|fanta|zumo|nestea|aquarius|tonica|gaseosa)/, 'cup-soda', '#f43f5e'],
  [/\b(vino|cava|champan)/, 'wine', '#be185d'],
  [/\b(cerveza|birra)/, 'beer', '#f0a83a'],
  [/\b(chocolate|dulce|chuche|caramelo|bombon|nocilla|nutella|turron)/, 'candy', '#ec84f7'],
  [/\bhelado/, 'ice-cream-cone', '#f9a8d4'],
  [/\bpizza/, 'pizza', '#fb923c'],
  [/\b(sandwich|bocadillo|wrap)/, 'sandwich', '#e5b85c'],
  [/\b(fruto seco|frutos seco|almendra|nuez|nueces|cacahuete|pistacho|anacardo)/, 'nut', '#b08968'],
  [/\bcongelad/, 'snowflake', '#7dd3fc'],
  [
    /\b(limpieza|lejia|fregasuelo|friegasuelo|detergente|suavizante|lavavajilla|limpiador|amoniaco|bayeta|estropajo|basura|ambientador|quitagrasa)/,
    'spray-can',
    '#2dd4bf'
  ],
  [/\b(medicina|ibuprofeno|paracetamol|farmacia|vitamina|pastilla|tirita)/, 'pill', '#f97362'],
  [/\b(panal|toallita|bebe|potito)/, 'baby', '#7aa7ff'],
  [/\b(pienso|perro|gato|arena|mascota|chuche perro)/, 'paw-print', '#c08457']
];
const shopIco = n => pickIco(SHOP_IC, n, [0, 'shopping-basket', '#34c77b']);
let shopQEdit = false; // «Quitar» en las más usadas: tocar una la borra de la lista de sugerencias (no se guarda)
/* Tiendas: pestaña abierta ('' = todas; no se guarda) y color de cada una (las conocidas, el suyo; las demás, de una paleta). */
let shopTab = '';
/* Pestañas de Compra: «Lista de la compra» o «Deseos» (se recuerda en este dispositivo). */
let shopSec = (() => {
  try {
    return localStorage.getItem('ldb-shopsec') === 'deseos' ? 'deseos' : 'lista';
  } catch (e) {
    return 'lista';
  }
})();
const STC = {
    mercadona: '#e5392f',
    lidl: '#f5c400',
    aldi: '#3b82f6',
    carrefour: '#3b82f6',
    dia: '#e11d48',
    eroski: '#dc2626',
    alcampo: '#16a34a',
    consum: '#f97316'
  },
  STP = ['#a78bfa', '#2dd4bf', '#f472b6', '#facc15', '#38bdf8', '#fb7185'];
/* Colores para elegir al añadir o cambiar una tienda (S.stCol: tienda → color elegido). */
const STPAL = ['#e5392f', '#f97316', '#f5c400', '#16a34a', '#2dd4bf', '#38bdf8', '#3b82f6', '#a78bfa', '#f472b6', '#9ca3af'];
const stCol = n => S.stCol[shopKey(n)] || STC[shopKey(n)] || STP[[...shopKey(n)].reduce((a, c) => a + c.charCodeAt(0), 0) % STP.length];
const stPal = (sel, x) =>
  `<div class="stpal" role="radiogroup" aria-label="Color">${STPAL.map(c => `<button role="radio" aria-checked="${c === sel}" aria-label="Color ${c}" style="--c:${c}" data-pc="${c}"${x != null ? ` data-px="${x}"` : ''}></button>`).join('')}</div>`;
/* --c: color de la tienda · --ct: texto encima de ese color (oscuro si el color es claro, como el amarillo). */
const stVar = n =>
  (c =>
    `--c:${c};--ct:${(([r, g, b]) => (r * 299 + g * 587 + b * 114) / 1000 > 165)([1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16))) ? '#1a1300' : '#fff'}`)(
    stCol(n)
  );
const stChip = n => `<span class="chip stc" style="${stVar(n)}">${esc(n)}</span>`;
function vCompra() {
  if (shopTab && !S.stores.includes(shopTab)) shopTab = '';
  const P0 = S.shop.filter(s => !s.done),
    P = shopTab ? P0.filter(s => !s.st || s.st === shopTab) : P0,
    D = S.shop.filter(s => s.done),
    est = P.reduce((a, s) => a + (s.price || 0) * s.qty, 0),
    real = D.reduce((a, s) => a + (s.price || 0) * s.qty, 0);
  // Pendientes: − unidades + a la derecha (con 1, el − es una papelera). Comprados: unidades en pequeño y la X.
  const row = s =>
    `<div class="row ${s.done ? 'is-done' : ''}"><input type="checkbox" class="ck" data-a="ts" data-i="${s.id}" ${s.done ? 'checked' : ''} aria-label="Comprado">${(([, ic, c]) => tile(ic, c))(shopIco(s.name))}<button class="link g" data-a="es" data-i="${s.id}" title="Editar"><span class="tt">${esc(s.name)}</span>${s.done && s.qty > 1 ? ` <span class="mu">×${s.qty}</span>` : ''}${s.price ? `<em class="mu">${eur(s.price * s.qty)}${s.qty > 1 ? ` · ${eur(s.price)}/ud` : ''}</em>` : ''}</button>${s.done ? `<button class="ib" data-a="ds" data-i="${s.id}" aria-label="Eliminar">${I('x')}</button>` : `<span class="shstp"><button data-a="sqm" data-i="${s.id}" aria-label="${s.qty > 1 ? 'Una menos' : 'Eliminar'}">${I(s.qty > 1 ? 'minus' : 'trash-2', 'sm')}</button><b>${s.qty}</b><button data-a="sqp" data-i="${s.id}" aria-label="Una más">${I('plus', 'sm')}</button></span>`}</div>`;
  // Pendientes agrupados por tienda (en el orden de las pestañas) y al final lo que vale cualquier tienda.
  const grupos = () => {
    if (!S.stores.length) return P.map(row).join('');
    const G = [
      ...(shopTab ? [shopTab] : S.stores).map(n => [n, P.filter(x => x.st === n)]),
      ['', P.filter(x => !x.st || !S.stores.includes(x.st))]
    ];
    return G.filter(([, L]) => L.length)
      .map(
        ([n, L]) =>
          `<div class="shgh" style="${n ? stVar(n) : ''}">${n ? `<i></i>${esc(n)}` : 'Cualquier tienda'} <span>· ${L.length}</span></div>${L.map(row).join('')}`
      )
      .join('');
  };
  const tabs = `<div class="stbar"><div class="sttabs" role="tablist" aria-label="Tienda"><button class="sttab${shopTab ? '' : ' on'}" role="tab" aria-selected="${!shopTab}" data-a="stt" data-i="">Todas</button>${S.stores.map(n => `<button class="sttab${shopTab === n ? ' on' : ''}" role="tab" aria-selected="${shopTab === n}" style="${stVar(n)}" data-a="stt" data-i="${esc(n)}">${esc(n)}${(c => (c ? ` <b>${c}</b>` : ''))(P0.filter(x => x.st === n).length)}</button>`).join('')}</div><button class="sttab ed" data-a="stm" aria-label="Añadir o quitar tiendas" title="Añadir o quitar tiendas">${I('settings', 'sm')}</button></div>`;
  const nW = S.wish.filter(w => !w.done).length,
    secTabs = `<div class="seg dtabs" role="tablist" aria-label="Compra">${[
      ['lista', 'Lista de la compra', P0.length],
      ['deseos', 'Lista de deseados', nW]
    ]
      .map(
        ([k, l, n]) =>
          `<button role="tab" class="${shopSec === k ? 'on' : ''}" aria-selected="${shopSec === k}" data-a="shs" data-i="${k}">${l}${n ? ` <span class="cnt">${n}</span>` : ''}</button>`
      )
      .join('')}</div>`;
  if (shopSec === 'deseos') {
    VIS.compra = ['deseos'];
    return `<div class="hdr dinh"><div><h2>Compra</h2></div></div>${secTabs}<div class="grid2">${wishCard().replace('class="card ', 'class="card wide ')}</div>`;
  }
  return `<div class="hdr dinh"><div><h2>Compra</h2></div></div>${secTabs}<div class="sub shsub">Estimado pendiente ${eur(est)} · Comprado ${eur(real)}</div>
  <div class="card"><div class="f shf"><span class="shin"><input id="s1" placeholder="Producto…" aria-label="Producto"><button class="inb" data-a="vs" aria-label="Dictar" title="Dictar">${I('mic')}</button></span><input id="s2" type="number" min="1" value="1" aria-label="Cantidad"><input id="s3" type="number" step="0.01" min="0" placeholder="Precio/ud (opcional)" aria-label="Precio por unidad"><button class="btn" data-a="as">Añadir</button></div>${SCAN_OK ? `<button class="btn shscan" data-a="scan">${I('scan-barcode')} Escanear productos</button>` : ''}${(() => {
    // Más usadas: las 10 que más veces se han añadido (y que no están ya pendientes).
    const pend = new Set(P0.map(x => shopKey(x.name))),
      Q = Object.entries(S.shopN)
        .filter(([k]) => !pend.has(k))
        .sort(([, a], [, b]) => b.c - a.c || (b.t || '').localeCompare(a.t || ''))
        .slice(0, 10);
    return Q.length
      ? `<div class="shq"><div class="shqh"><span>${I('star', 'sm')} Más usadas</span><button class="link" data-a="sqe">${shopQEdit ? 'Hecho' : 'Quitar'}</button></div><div class="shqc">${Q.map(([k, o]) => `<button class="chip${shopQEdit ? ' del' : ''}" data-a="sq" data-i="${esc(k)}">${shopQEdit ? I('x', 'sm') : (([, ic, c]) => `<span style="color:${c}">${I(ic, 'sm')}</span>`)(shopIco(o.n))} ${esc(o.n)}</button>`).join('')}</div></div>`
      : '';
  })()}</div>
  ${(() => {
    const C = {
      pend: panel(
        'compra',
        'pend',
        `${I('shopping-cart')} Pendientes <span class="cnt">· ${P.length}</span>`,
        tabs + (P.length ? grupos() : empty(shopTab ? 'Nada pendiente para ' + esc(shopTab) + '.' : 'Lista vacía'))
      ),
      hecho: panel(
        'compra',
        'hecho',
        `${I('circle-check')} Comprados <span class="cnt">· ${D.length}</span>`,
        D.length
          ? D.map(row).join('') + '<div class="more"><button class="btn sm ghost" data-a="cs">Vaciar comprados</button></div>'
          : empty('Nada comprado aún.')
      )
    };
    VIS.compra = ord('compra', ['pend', 'hecho']);
    return `<div class="grid2">${VIS.compra.map(k => C[k]).join('')}</div>`;
  })()}`;
}

/* ---------- Escáner de códigos de barras ----------
   Usa la cámara y el lector de códigos del propio navegador (Chrome en Android); si no lo hay, el botón no sale.
   El nombre sale de lo ya aprendido (S.shopBC: código → nombre) o de Open Food Facts (base pública y gratuita, sin clave).
   La cámara sigue abierta para escanear varios seguidos; el mismo código no se vuelve a añadir hasta que sale de la imagen. */
const SCAN_OK = 'BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia;
const OFF_API = 'https://world.openfoodfacts.org/api/v2/product/';
/* El último dígito del código es de control: si no cuadra, la cámara lo ha leído mal. */
function bcValid(c) {
  if (!/^(\d{8}|\d{12,14})$/.test(c)) return false;
  const d = c.split('').map(Number),
    k = d.pop();
  const s = d.reverse().reduce((a, x, i) => a + x * (i % 2 ? 1 : 3), 0);
  return (10 - (s % 10)) % 10 === k;
}
/* Nombre corto para la lista: sin la marca ni la cantidad («Leche semidesnatada»). */
function offName(p) {
  const full = String(p.product_name_es || p.product_name || p.generic_name_es || '')
    .replace(/\s+/g, ' ')
    .trim();
  let n = full;
  String(p.brands || '')
    .split(',')
    .map(b => b.trim())
    .filter(b => b.length > 1)
    .forEach(b => (n = n.replace(new RegExp('(^|\\s)' + reEsc(b) + '(?=\\s|$)', 'ig'), ' ')));
  n = n
    .replace(/\s+\d+(?:[.,]\d+)?\s*(?:x\s*\d+(?:[.,]\d+)?\s*)?(?:kg|g|gr|l|ml|cl|uds?|unidades|x)\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,\-–]+|[\s,\-–]+$/g, '');
  if (!n) n = full;
  return n.length > 42 ? n.slice(0, 42).replace(/\s+\S*$/, '') : n;
}
/* Tienda por el código: las marcas propias llevan el prefijo de la cadena (Hacendado 8480000, Lidl 4056489, Aldi 4061458/4047247). */
const BCST = [
  [/^8480000/, 'Mercadona'],
  [/^4056489/, 'Lidl'],
  [/^(4061458|4047247)/, 'Aldi']
];
const bcStore = (code, offSt = '') =>
  (BCST.find(([r]) => r.test(code)) || [])[1] ||
  S.stores.find(n =>
    String(offSt)
      .split(',')
      .some(x => shopKey(x).replace(/^\w+:/, '') === shopKey(n))
  ) ||
  '';
/* {n: nombre, st: tiendas según Open Food Facts}; n = '' si no lo conoce; lanza error si no hay conexión. */
async function offLook(code) {
  const r = await fetch(OFF_API + encodeURIComponent(code) + '.json?fields=product_name,product_name_es,generic_name_es,brands,stores');
  if (r.status === 404) return { n: '' };
  if (!r.ok) throw new Error('Open Food Facts: HTTP ' + r.status);
  const j = await r.json();
  return j.status === 1 && j.product ? { n: offName(j.product), st: j.product.stores || '' } : { n: '' };
}
/* Añade lo escaneado (o suma 1 si ya está pendiente). Devuelve el texto del aviso y cómo deshacerlo. */
function scanAdd(code, name, offSt) {
  name = cap(String(name).trim());
  S.shopBC[code] = name;
  const p = S.shop.find(x => !x.done && (x.bc === code || shopKey(x.name) === shopKey(name)));
  if (p) {
    p.qty = (p.qty || 1) + 1;
    p.bc = p.bc || code;
    ch();
    const i = p.id;
    return {
      t: `${name} · ya estaba, ahora ×${p.qty}`,
      undo: () => {
        const q = S.shop.find(x => x.id === i);
        if (q) q.qty = Math.max(1, (q.qty || 1) - 1);
        ch();
      }
    };
  }
  shopAdd(name, 1, 0, bcStore(code, offSt));
  const it = S.shop[S.shop.length - 1];
  it.bc = code;
  ch();
  return {
    t: name,
    undo: () => {
      S.shop = S.shop.filter(x => x.id !== it.id);
      ch();
    }
  };
}
async function scanOpen() {
  const o = document.createElement('div');
  o.className = 'scan';
  o.setAttribute('role', 'dialog');
  o.setAttribute('aria-label', 'Escanear productos');
  o.innerHTML = `<video playsinline muted autoplay></video><div class="scfr" aria-hidden="true"><i></i></div>
    
    <div class="scbot"><div class="scmsg" aria-live="polite">Abriendo la cámara…</div>
    <form class="scask" hidden><label for="scn"></label><input id="scn" placeholder="Nombre del producto" autocomplete="off"><div class="acts"><button type="button" class="btn ghost" data-x="skip">Saltar</button><button class="btn">Añadir</button></div></form>
    <div class="scok" hidden><span class="tt"></span><button class="link" data-x="undo">Deshacer</button></div>
    <div class="scend"><button class="scb" data-x="torch" hidden aria-label="Linterna" title="Linterna">${I('flashlight')}</button><button class="btn" data-x="end">Listo</button></div></div>`;
  document.body.appendChild(o);
  document.body.classList.add('scanning');
  const v = o.querySelector('video'),
    msg = o.querySelector('.scmsg'),
    ask = o.querySelector('.scask'),
    okEl = o.querySelector('.scok'),
    endEl = o.querySelector('.scend');
  let stream = null,
    alive = true,
    busy = false,
    last = '',
    seen = 0,
    cand = '',
    n = 0,
    undo = null,
    torch = false;
  const close = () => {
    if (!alive) return;
    alive = false;
    stream && stream.getTracks().forEach(t => t.stop());
    o.remove();
    document.body.classList.remove('scanning');
    document.removeEventListener('visibilitychange', onHide);
    if (n) toast(`🛒 ${n} producto${n > 1 ? 's' : ''} escaneado${n > 1 ? 's' : ''}`);
  };
  const onHide = () => document.hidden && close();
  document.addEventListener('visibilitychange', onHide);
  const done = r => {
    n++;
    undo = r.undo;
    okEl.hidden = false;
    okEl.querySelector('.tt').textContent = '✔ ' + r.t;
    msg.textContent = 'Apunta al siguiente, o pulsa «Listo»';
    navigator.vibrate && navigator.vibrate(60);
  };
  /* No lo conoce (o no hay conexión): se pide el nombre y se recuerda para la próxima. */
  const askName = (code, off) =>
    new Promise(res => {
      ask.hidden = false;
      endEl.hidden = true;
      okEl.hidden = true;
      msg.textContent = '';
      ask.querySelector('label').textContent = off
        ? 'Sin conexión para buscarlo. ¿Qué producto es?'
        : 'No conozco este producto. ¿Qué es? Lo recordaré la próxima vez.';
      const inp = ask.querySelector('input');
      inp.value = '';
      inp.focus();
      const fin = name => {
        ask.hidden = true;
        endEl.hidden = false;
        ask.onsubmit = null;
        ask.querySelector('[data-x=skip]').onclick = null;
        res(name);
      };
      ask.onsubmit = e => {
        e.preventDefault();
        const t = inp.value.trim();
        if (t) fin(t);
        else inp.focus();
      };
      ask.querySelector('[data-x=skip]').onclick = () => fin('');
    });
  const got = async code => {
    busy = true;
    try {
      let name = S.shopBC[code],
        offSt = '',
        off = false;
      if (!name) {
        msg.textContent = 'Buscando ' + code + '…';
        try {
          ({ n: name, st: offSt } = await offLook(code));
        } catch (e) {
          off = true;
          name = '';
        }
        if (!alive) return;
        if (!name) {
          name = await askName(code, off);
          if (!alive) return;
          if (!name) {
            msg.textContent = 'Apunta al código de barras';
            return;
          }
        }
      }
      done(scanAdd(code, name, offSt));
    } finally {
      busy = false;
      seen = Date.now();
    }
  };
  o.addEventListener('click', e => {
    const x = e.target.closest('[data-x]')?.dataset.x;
    if (x === 'end') close();
    if (x === 'undo' && undo) {
      undo();
      undo = null;
      n = Math.max(0, n - 1);
      okEl.hidden = true;
      msg.textContent = 'Quitado. Apunta al código de barras';
    }
    if (x === 'torch') {
      torch = !torch;
      stream
        .getVideoTracks()[0]
        .applyConstraints({ advanced: [{ torch }] })
        .catch(() => {});
      e.target.closest('[data-x]').classList.toggle('on', torch);
    }
  });
  o.addEventListener('keydown', e => e.key === 'Escape' && close());
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
  } catch (e) {
    close();
    return CF(
      e && e.name === 'NotAllowedError'
        ? 'La cámara está bloqueada para el panel. Actívala en los permisos del sitio (el candado junto a la dirección).'
        : 'No se ha podido abrir la cámara.',
      () => {},
      undefined,
      true
    );
  }
  if (!alive) return stream.getTracks().forEach(t => t.stop());
  v.srcObject = stream;
  v.play().catch(() => {});
  try {
    const caps = stream.getVideoTracks()[0].getCapabilities?.() || {};
    if (caps.torch) o.querySelector('[data-x=torch]').hidden = false;
  } catch (e) {}
  let det;
  try {
    const want = ['ean_13', 'ean_8', 'upc_a', 'upc_e'],
      sup = await BarcodeDetector.getSupportedFormats();
    det = new BarcodeDetector({ formats: want.filter(f => sup.includes(f)).length ? want.filter(f => sup.includes(f)) : sup });
  } catch (e) {
    close();
    return CF('Este navegador no sabe leer códigos de barras.', () => {}, undefined, true);
  }
  msg.textContent = 'Apunta al código de barras';
  const tick = async () => {
    if (!alive) return;
    if (!busy && v.readyState >= 2) {
      try {
        const c = (await det.detect(v)).find(b => bcValid(b.rawValue));
        /* Solo vale si sale igual en dos lecturas seguidas (evita números mal leídos). */
        const ok = c && c.rawValue === cand;
        cand = c ? c.rawValue : '';
        if (ok && alive) {
          const now = Date.now();
          if (c.rawValue === last && now - seen < 1500)
            seen = now; // sigue delante: no repetir
          else {
            last = c.rawValue;
            seen = now;
            await got(c.rawValue);
          }
        }
      } catch (e) {}
    }
    setTimeout(tick, 180);
  };
  tick();
}

/* ---------- Tiendas: añadir, quitar y elegir color ----------
   Tocar una tienda abre sus colores debajo; al añadir una nueva, se elige el color (sale marcado uno que no use otra). */
function storesEdit() {
  let abierta = -1,
    nueva = '';
  const libre = () => STPAL.find(c => !S.stores.some(n => stCol(n) === c)) || STPAL[0];
  const body = () =>
    `<h3>Tiendas</h3><div class="mu" style="margin-bottom:10px">Salen como pestañas en Pendientes. Lo que no tiene tienda se ve en todas. Toca una para cambiar su color.</div><div class="stlist">${S.stores.map((n, i) => `<div class="row"><button class="stcb" data-o="${i}" aria-expanded="${abierta === i}" aria-label="Color de ${esc(n)}">${stChip(n)}</button><span class="g"></span><button class="ib" data-x="${i}" aria-label="Quitar ${esc(n)}">${I('x')}</button></div>${abierta === i ? stPal(stCol(n), i) : ''}`).join('') || empty('Sin tiendas.')}</div><div class="stadd"><input id="stn" class="in" placeholder="Nueva tienda (p. ej. Carrefour)" aria-label="Nueva tienda"><button class="btn" id="stadd">Añadir</button></div><div class="sthl mu">Color de la nueva</div>${stPal(nueva)}<div class="acts"><span class="sp"></span><button class="btn" data-close>Hecho</button></div>`;
  nueva = libre();
  const o = modal(body()),
    redo = () => {
      const v = o.querySelector('#stn').value;
      o.querySelector('.dlg').innerHTML = body();
      wire();
      o.querySelector('#stn').value = v;
    },
    wire = () => {
      const inp = o.querySelector('#stn');
      o.querySelector('#stadd').onclick = () => {
        const n = cap(inp.value.trim().slice(0, 30));
        if (!n) return inp.focus();
        if (S.stores.some(x => shopKey(x) === shopKey(n))) return toast('Ya está');
        S.stores.push(n);
        S.stCol[shopKey(n)] = nueva;
        ch();
        abierta = -1;
        nueva = libre();
        o.querySelector('.dlg').innerHTML = body();
        wire();
        o.querySelector('#stn').focus();
      };
      o.querySelectorAll('[data-o]').forEach(
        b =>
          (b.onclick = () => {
            abierta = abierta === +b.dataset.o ? -1 : +b.dataset.o;
            redo();
          })
      );
      o.querySelectorAll('[data-pc]').forEach(
        b =>
          (b.onclick = () => {
            if (b.dataset.px == null) nueva = b.dataset.pc;
            else {
              S.stCol[shopKey(S.stores[+b.dataset.px])] = b.dataset.pc;
              ch();
            }
            redo();
          })
      );
      o.querySelectorAll('[data-x]').forEach(
        b =>
          (b.onclick = () => {
            const n = S.stores[+b.dataset.x],
              c = S.shop.filter(x => x.st === n).length;
            CF(`¿Quitar «${n}»?${c ? ` Sus ${c} producto(s) se quedan en la lista, sin tienda.` : ''}`, () => {
              S.stores = S.stores.filter(x => x !== n);
              delete S.stCol[shopKey(n)];
              S.shop.forEach(x => x.st === n && delete x.st);
              Object.values(S.shopN).forEach(x => x.st === n && delete x.st);
              ch();
              storesEdit();
            });
          })
      );
    };
  wire();
}

/* ---------- Lista de deseos ----------
   Cosas que te gustaría comprar (o no): S.wish = [{id, n, p (precio), url, note, need (lo necesito), cu (cuándo: 'ya', 'pronto', 'algun'),
   at (cuándo se apuntó), done (fecha en que se compró), goal (id de la meta de ahorro creada para él)}].
   Para no comprar por impulso, cada deseo «se piensa» unos días según lo que cuesta (como la regla de los 30 días):
   menos de 30 €, 2 días; hasta 100 €, 7; desde 100 €, 30. Pasado ese tiempo sale «Ya puedes decidir». */
let wSort = 'pri';
const WSORT = [
  ['pri', 'Prioridad'],
  ['precio', 'Precio'],
  ['ant', 'Antigüedad']
];
const WISH_IC0 = [
  [/\b(ropa|camiseta|camisa|vestido|pantalon|falda|abrigo|chaqueta|jersey|sudadera|bolso|mochila|zapat|bota|deportiva)/, 'shopping-bag'],
  [/\b(auricular|cascos|consola|playstation|switch|xbox|camara|altavoz|kindle)/, 'laptop'],
  [/\b(reloj|pendiente|collar|pulsera|anillo)/, 'gem'],
  [/\b(perfume|crema|maquillaje|serum)/, 'sparkles'],
  [/\b(planta|lampara|cojin|alfombra|cortina|vela)/, 'sofa'],
  [/\b(cafetera|freidora|robot|aspirador|thermomix)/, 'coffee']
];
const wishIc = () => [...WISH_IC0, ...GOAL_IC]; // GOAL_IC está en finanzas.js, que se carga después
/* Cuándo lo quieres: se cambia tocando la etiqueta (Ya → Pronto → Algún día). Los antiguos con corazones (lv) se traducen. */
const WCU = [
  ['ya', 'Ya', 'flame', '#fb923c'],
  ['pronto', 'Pronto', 'calendar-clock', '#38bdf8'],
  ['algun', 'Algún día', 'telescope', '#9ca3af']
];
const wCu = w => w.cu || (w.lv === 3 ? 'ya' : w.lv === 1 ? 'algun' : 'pronto');
const wCuI = w => WCU.findIndex(x => x[0] === wCu(w));
/* Meta de ahorro de cada deseo: se crea sola al apuntarlo con precio; lo apartado en Metas se ve en el deseo.
   Al comprarlo o quitarlo, su meta se quita (se guarda para poder deshacer). */
const wGoal = w => (w.goal && S.goals.find(g => g.id === w.goal)) || null;
function wGoalNew(w) {
  if (!(+w.p > 0) || wGoal(w)) return;
  const gid = id();
  S.goals.push({ id: gid, n: w.n, obj: +w.p, amt: 0, d: '', c: GCOL[S.goals.length % GCOL.length], c0: TD(), a0: 0 });
  w.goal = gid;
}
function wGoalDrop(w) {
  const g = wGoal(w);
  if (!g) return null;
  const k = S.goals.indexOf(g);
  S.goals.splice(k, 1);
  return () => S.goals.splice(Math.min(k, S.goals.length), 0, g);
}
const wWait = p => (p >= 100 ? 30 : p >= 30 ? 7 : 2);
const wHost = u => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch (e) {
    return '';
  }
};
const wUrl = u => (/^https?:\/\//i.test(u) ? u : '');
function wishCard() {
  const L = S.wish.filter(w => !w.done),
    D = S.wish.filter(w => w.done).sort((a, b) => b.done.localeCompare(a.done)),
    tot = L.reduce((a, w) => a + (+w.p || 0), 0),
    nec = L.filter(w => w.need).reduce((a, w) => a + (+w.p || 0), 0);
  const cmp = {
    pri: (a, b) => wCuI(a) - wCuI(b) || !!b.need - !!a.need || (+a.p || 0) - (+b.p || 0),
    precio: (a, b) => (+a.p || 0) - (+b.p || 0),
    ant: (a, b) => (a.at || '').localeCompare(b.at || '')
  }[wSort];
  const item = w => {
    const [, ic] = pickIco(wishIc(), w.n, [0, 'gift']),
      c = w.need ? 'var(--ac)' : '#e879a6',
      left = wWait(+w.p || 0) - Math.max(0, -dayDiff(w.at || TD())),
      g = w.goal && S.goals.find(x => x.id === w.goal),
      u = wUrl(w.url || ''),
      [, cuN, cuI, cuC] = WCU[wCuI(w)];
    return `<div class="wi" style="--wc:${c}">
      <div class="wit">${tile(ic, c)}<div class="wig"><button class="link wn" data-a="we" data-i="${w.id}" title="Editar">${esc(w.n)}</button><div class="wim">${u ? `<a class="wlk" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${I('external-link', 'sm')} ${esc(wHost(u) || 'Enlace')}</a>` : ''}${w.note ? `<span class="mu">${esc(w.note)}</span>` : ''}</div></div><b class="wip">${w.p ? eur(+w.p) : '<span class="mu">Sin precio</span>'}</b></div>${g ? `<div class="wsv"><div class="wsvb"><i style="width:${Math.min(100, (g.amt / (g.obj || 1)) * 100).toFixed(1)}%"></i></div><span>Ahorrado <b>${eur(g.amt)}</b> de ${eur(g.obj)}</span></div>` : ''}
      <div class="wib"><button class="chip wnd${w.need ? ' on' : ''}" data-a="wn" data-i="${w.id}" title="Toca para cambiar">${w.need ? 'Lo necesito' : 'Capricho'}</button><button class="chip wcu" data-a="wl" data-i="${w.id}" style="--cc:${cuC}" title="Cuándo lo quieres (toca para cambiar)" aria-label="Cuándo lo quieres: ${cuN} (toca para cambiar)">${I(cuI, 'sm')} ${cuN}</button>${left > 0 ? `<span class="chip wwt" title="Para no comprar por impulso: espera ${wWait(+w.p || 0)} días antes de decidir">${I('hourglass', 'sm')} Pensándolo · ${left} d</span>` : `<span class="chip ok wwt" title="Ya ha pasado el tiempo de pensarlo">${I('sparkles', 'sm')} Ya puedes decidir</span>`}<span class="wact">${g ? `<button class="btn sm ghost wap" data-a="goalmv" data-i="${g.id}" title="Apartar dinero para este deseo">${I('piggy-bank', 'sm')} Apartar</button>` : `<button class="btn sm ghost wap" data-a="wg" data-i="${w.id}" title="Crear una meta de ahorro para este deseo">${I('piggy-bank', 'sm')} Ahorrar</button>`}<button class="btn sm wbuy" data-a="wd" data-i="${w.id}">${I('check', 'sm')} Comprado</button></span></div>
    </div>`;
  };
  const done = D.map(
    w =>
      `<div class="row wdn"><span class="g"><span class="tt">${esc(w.n)}</span><span class="mu">Comprado el ${fd(w.done)}</span></span><span class="amt">${w.p ? eur(+w.p) : ''}</span><button class="ib" data-a="wu" data-i="${w.id}" title="Volver a la lista" aria-label="Volver a la lista">${I('refresh-cw')}</button></div>`
  );
  return panel(
    'compra',
    'deseos',
    `${I('heart')} Lista de deseos <span class="cnt">· ${L.length}</span>`,
    `<div class="f wadd"><input id="w1" placeholder="¿Qué te gustaría?" aria-label="Deseo"><input id="w2" inputmode="decimal" placeholder="Precio" aria-label="Precio"><button class="btn" data-a="wa">${I('plus', 'sm')} Añadir</button></div>` +
      (L.length
        ? `<div class="wsum"><div><span class="mu">Total</span><b>${eur(tot)}</b></div>${nec ? `<div><span class="mu">Lo necesario</span><b>${eur(nec)}</b></div>` : ''}<div class="seg wsrt" role="group" aria-label="Ordenar">${WSORT.map(([k, n]) => `<button class="${wSort === k ? 'on' : ''}" data-a="wsrt" data-i="${k}" aria-pressed="${wSort === k}">${n}</button>`).join('')}</div></div>
      <div class="wl">${[...L].sort(cmp).map(item).join('')}</div>`
        : empty('Apunta aquí lo que te gustaría tener. Cada deseo se «piensa» unos días antes de comprarlo.')) +
      (D.length
        ? `<details class="wdone"><summary>${I('circle-check', 'sm')} Comprados · ${D.length}${D.some(w => w.p) ? ' · ' + eur(D.reduce((a, w) => a + (+w.p || 0), 0)) : ''}</summary>${done.join('')}</details>`
        : '')
  );
}
