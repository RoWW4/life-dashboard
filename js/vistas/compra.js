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
function vCompra() {
  const P = S.shop.filter(s => !s.done),
    D = S.shop.filter(s => s.done),
    est = P.reduce((a, s) => a + (s.price || 0) * s.qty, 0),
    real = D.reduce((a, s) => a + (s.price || 0) * s.qty, 0);
  const row = s =>
    `<div class="row ${s.done ? 'is-done' : ''}"><input type="checkbox" class="ck" data-a="ts" data-i="${s.id}" ${s.done ? 'checked' : ''} aria-label="Comprado">${(([, ic, c]) => tile(ic, c))(shopIco(s.name))}<button class="link g" data-a="es" data-i="${s.id}" title="Editar"><span class="tt">${esc(s.name)}</span> ${s.qty > 1 ? `<span class="mu">×${s.qty}</span>` : ''}</button><span class="amt mu">${s.price ? eur(s.price * s.qty) : ''}</span><button class="ib" data-a="ds" data-i="${s.id}" aria-label="Eliminar">${I('x')}</button></div>`;
  return `<div class="hdr"><div><h2>Lista de la compra</h2><div class="sub">Estimado pendiente ${eur(est)} · Comprado ${eur(real)}</div></div></div>
  <div class="card"><div class="f shf"><span class="shin"><input id="s1" placeholder="Producto…" aria-label="Producto"><button class="inb" data-a="vs" aria-label="Dictar" title="Dictar">${I('mic')}</button></span><input id="s2" type="number" min="1" value="1" aria-label="Cantidad"><input id="s3" type="number" step="0.01" min="0" placeholder="Precio/ud (opcional)" aria-label="Precio por unidad"><button class="btn" data-a="as">Añadir</button></div>${SCAN_OK ? `<button class="btn shscan" data-a="scan">${I('scan-barcode')} Escanear productos</button>` : ''}${(() => {
    // Más usadas: las 10 que más veces se han añadido (y que no están ya pendientes).
    const pend = new Set(P.map(x => shopKey(x.name))),
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
        P.length ? P.map(row).join('') : empty('Lista vacía')
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
/* '' si no lo conoce; lanza error si no hay conexión. */
async function offLook(code) {
  const r = await fetch(OFF_API + encodeURIComponent(code) + '.json?fields=product_name,product_name_es,generic_name_es,brands');
  if (r.status === 404) return '';
  if (!r.ok) throw new Error('Open Food Facts: HTTP ' + r.status);
  const j = await r.json();
  return j.status === 1 && j.product ? offName(j.product) : '';
}
/* Añade lo escaneado (o suma 1 si ya está pendiente). Devuelve el texto del aviso y cómo deshacerlo. */
function scanAdd(code, name) {
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
  shopAdd(name, 1, 0);
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
        off = false;
      if (!name) {
        msg.textContent = 'Buscando ' + code + '…';
        try {
          name = await offLook(code);
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
      done(scanAdd(code, name));
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
        const c = (await det.detect(v)).find(b => /^\d{6,14}$/.test(b.rawValue));
        if (c && alive) {
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
