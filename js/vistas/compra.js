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
const shopIco = n => {
  const k = String(n).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return SHOP_IC.find(([r]) => r.test(k)) || [0, 'shopping-basket', '#34c77b'];
};
let shopQEdit = false; // «Quitar» en las más usadas: tocar una la borra de la lista de sugerencias (no se guarda)
function vCompra() {
  const P = S.shop.filter(s => !s.done),
    D = S.shop.filter(s => s.done),
    est = P.reduce((a, s) => a + (s.price || 0) * s.qty, 0),
    real = D.reduce((a, s) => a + (s.price || 0) * s.qty, 0);
  const row = s =>
    `<div class="row ${s.done ? 'is-done' : ''}"><input type="checkbox" class="ck" data-a="ts" data-i="${s.id}" ${s.done ? 'checked' : ''} aria-label="Comprado">${(([, ic, c]) => tile(ic, c))(shopIco(s.name))}<button class="link g" data-a="es" data-i="${s.id}" title="Editar"><span class="tt">${esc(s.name)}</span> ${s.qty > 1 ? `<span class="mu">×${s.qty}</span>` : ''}</button><span class="amt mu">${s.price ? eur(s.price * s.qty) : ''}</span><button class="ib" data-a="ds" data-i="${s.id}" aria-label="Eliminar">${I('x')}</button></div>`;
  return `<div class="hdr"><div><h2>Lista de la compra</h2><div class="sub">Estimado pendiente ${eur(est)} · Comprado ${eur(real)}</div></div></div>
  <div class="card"><div class="f" style="margin:0"><input id="s1" placeholder="Producto…" aria-label="Producto"><input id="s2" type="number" min="1" value="1" aria-label="Cantidad"><input id="s3" type="number" step="0.01" min="0" placeholder="Precio/ud (opcional)" aria-label="Precio por unidad"><button class="btn" data-a="as">Añadir</button><button class="btn ghost ico" data-a="vs" aria-label="Dictar">${I('mic')}</button></div>${(() => {
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
