'use strict';
/* Sección «Compra». */
let shopQEdit = false; // «Quitar» en las más usadas: tocar una la borra de la lista de sugerencias (no se guarda)
function vCompra() {
  const P = S.shop.filter(s => !s.done),
    D = S.shop.filter(s => s.done),
    est = P.reduce((a, s) => a + (s.price || 0) * s.qty, 0),
    real = D.reduce((a, s) => a + (s.price || 0) * s.qty, 0);
  const row = s =>
    `<div class="row ${s.done ? 'is-done' : ''}"><input type="checkbox" class="ck" data-a="ts" data-i="${s.id}" ${s.done ? 'checked' : ''} aria-label="Comprado"><button class="link g" data-a="es" data-i="${s.id}" title="Editar"><span class="tt">${esc(s.name)}</span> ${s.qty > 1 ? `<span class="mu">×${s.qty}</span>` : ''}</button><span class="amt mu">${s.price ? eur(s.price * s.qty) : ''}</span><button class="ib" data-a="ds" data-i="${s.id}" aria-label="Eliminar">${I('x')}</button></div>`;
  return `<div class="hdr"><div><h2>Lista de la compra</h2><div class="sub">Estimado pendiente ${eur(est)} · Comprado ${eur(real)}</div></div></div>
  <div class="card"><div class="f" style="margin:0"><input id="s1" placeholder="Producto…" aria-label="Producto"><input id="s2" type="number" min="1" value="1" aria-label="Cantidad"><input id="s3" type="number" step="0.01" min="0" placeholder="Precio/ud (opcional)" aria-label="Precio por unidad"><button class="btn" data-a="as">Añadir</button><button class="btn ghost ico" data-a="vs" aria-label="Dictar">${I('mic')}</button></div>${(() => {
    // Más usadas: las 10 que más veces se han añadido (y que no están ya pendientes).
    const pend = new Set(P.map(x => shopKey(x.name))),
      Q = Object.entries(S.shopN)
        .filter(([k]) => !pend.has(k))
        .sort(([, a], [, b]) => b.c - a.c || (b.t || '').localeCompare(a.t || ''))
        .slice(0, 10);
    return Q.length
      ? `<div class="shq"><div class="shqh"><span>${I('star', 'sm')} Más usadas</span><button class="link" data-a="sqe">${shopQEdit ? 'Hecho' : 'Quitar'}</button></div><div class="shqc">${Q.map(([k, o]) => `<button class="chip${shopQEdit ? ' del' : ''}" data-a="sq" data-i="${esc(k)}">${I(shopQEdit ? 'x' : 'plus', 'sm')} ${esc(o.n)}</button>`).join('')}</div></div>`
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
