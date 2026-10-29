'use strict';
/* Movimientos del banco: clasificar, limpiar conceptos, evitar duplicados e importar archivos. */
/* ---------- banco: clasificar, deduplicar e importar ---------- */
/* Pagos con el móvil o el reloj: «Google pay: COMPRA EN BUGA RAMEN» → «BUGA RAMEN». Sin esto, «google» lo mandaba a Suscripciones. */
const PAYP = /^\s*(?:google|fitbit|apple|samsung|garmin)\s*pay\s*:?\s*(?:(?:compra|pago)\s+)?(?:en\s+)?/i;
function classify(desc, t){
  const d = nt(String(desc||'').replace(PAYP,''));
  for (const r of S.rules) { const k = nt(r.k).trim(); if (k && d.includes(k)) return r.cat; }
  if (t === 'i') return /nomina/.test(d) ? 'Nómina' : 'Otros';
  for (const [c,ks] of KWC) if (ks.some(k => d.includes(k))) return c;
  return 'Otros';
}
const tcase = s => s.toLowerCase().replace(/(^|[\s(])\S/g, c => c.toUpperCase());
function cleanDesc(s){
  s = String(s||'').replace(/\s+/g,' ').trim().replace(PAYP,'')
    .replace(/^(compra|pago)\s+(en\s+|con tarjeta en\s+)?/i,'')
    .replace(/,?\s*con la tarjeta.*$/i,'').replace(/,?\s*el \d{4}-\d{2}-\d{2}.*$/i,'')
    .replace(/^www\./i,'').replace(/\*.*$/,'')                 // "WWW.AMAZON* BT40X4DR4" → "AMAZON"
    .replace(/\s+\d{2}[a-z]{3}\s+\w+$/i,'')                     // "GLOVO 09OCT ELAT9KNEC" → "GLOVO"
    .replace(/^bizum (a favor de|de)\s+(.+?)\s+concepto:\s*(.*)$/i, (m,d,who,c) => `Bizum ${/favor/i.test(d)?'a':'de'} ${tcase(who)}${c?' · '+c:''}`)
    .trim();
  if (s && s === s.toUpperCase()) s = tcase(s);
  return cap(s.slice(0,90)) || 'Movimiento bancario';
}
/* items: [{id, date, amt (negativo = gasto), desc}]. fld: 'bank' (API), 'xls' (archivo de la cuenta) o 'card' (archivo de la tarjeta prepago).
   Si ya existe un movimiento equivalente (manual, fijo o factura) se enlaza en vez de duplicarlo.
   La cuenta y la prepago son flujos distintos: nunca se enlazan entre sí. */
const fromBank = x => !!(x.bank || x.xls || x.card);
function ingest(items, fld){
  let add = 0, link = 0, skip = 0;
  const free = fld==='card' ? (x => !fromBank(x)) : (x => !x[fld] && !x.card);
  for (const it of items) {
    if (!it.date || !it.amt || S.bankSeen.includes(it.id)) { skip++; continue; }
    const t = it.amt < 0 ? 'g' : 'i', amt = Math.round(Math.abs(it.amt)*100)/100, cat = classify(it.desc, t);
    let m = S.tx.find(x => free(x) && x.t===t && Math.abs(x.amt-amt) < 0.01 && Math.abs(dd(x.date,it.date)) <= 4);
    if (!m) m = S.tx.find(x => free(x) && x.fid && x.t===t && x.cat===cat && Math.abs(x.amt-amt) <= x.amt*0.25 && Math.abs(dd(x.date,it.date)) <= 5);
    // Un fijo enlazado conserva su fecha (y su mes contable); solo se ajusta al importe real.
    if (m) { m[fld] = it.id; if (m.fid) m.amt = amt; link++; }
    else { const x = {id:id(), t, amt, cat, date:it.date, desc:cleanDesc(it.desc), [fld]:it.id}; S.tx.push(x); fxMatch(x); add++; }
    S.bankSeen.push(it.id);
  }
  return {add, link, skip};
}
/* "Movimientos de Cuenta.xls" de Openbank es una tabla HTML; también vale un CSV. */
async function importFile(file){
  const buf = await file.arrayBuffer(), head = new Uint8Array(buf.slice(0,4));
  if (head[0]===0x50 && head[1]===0x4b) return toast('Es un .xlsx real: ábrelo en Excel y guárdalo como CSV');
  let txt = new TextDecoder('utf-8').decode(buf);
  if (txt.includes('�')) txt = new TextDecoder('windows-1252').decode(buf);
  let rows;
  if (/<table/i.test(txt)) rows = [...new DOMParser().parseFromString(txt,'text/html').querySelectorAll('tr')].map(tr => [...tr.cells].map(c => c.textContent.replace(/\s+/g,' ').trim()));
  else { const sep = (txt.split('\n')[0].match(/;/g)||[]).length ? ';' : (txt.includes('\t') ? '\t' : ','); rows = txt.split(/\r?\n/).map(l => l.split(sep).map(c => c.replace(/^"|"$/g,'').trim())); }
  // "Movimientos de Tarjeta.xls" (prepago): las cargas son la otra cara de la «Recarga» de la cuenta y se omiten.
  const card = /tarjetas\s*-\s*movimientos|tipo de tarjeta/i.test(txt);
  const hi = rows.findIndex(r => r.some(c => /importe/i.test(c)) && r.some(c => /fecha/i.test(c)));
  if (hi < 0) return toast('No encuentro las columnas «Fecha» e «Importe» en el archivo');
  const H = rows[hi].map(nt);
  let iF = H.findIndex(h => /fecha oper/.test(h)); if (iF < 0) iF = H.findIndex(h => h.includes(' fecha'));
  const iC = H.findIndex(h => /concepto|descrip|movimiento/.test(h)), iI = H.findIndex(h => h.includes(' importe')), iS = H.findIndex(h => /situaci/.test(h));
  const items = [], occ = {}, ds = [];
  for (const r of rows.slice(hi+1)) {
    const dm = (r[iF]||'').match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/); if (!dm) continue;
    const date = (dm[3].length===2 ? '20'+dm[3] : dm[3]) + '-' + p2(dm[2]) + '-' + p2(dm[1]);
    ds.push(date);
    const amt = pnum(r[iI]); if (!amt || isNaN(amt)) continue;
    const desc = iC >= 0 ? r[iC] : '', base = date+'|'+amt+'|'+nt(desc);
    if (card && (/carga tarjeta/i.test(desc) || /anulad|denegad|rechazad/i.test(r[iS]||''))) continue;
    occ[base] = (occ[base]||0) + 1;
    items.push({id:(card?'c':'x')+hash(base+'|'+occ[base]), date, amt, desc});
  }
  if (!items.length && !card) return toast('No he encontrado movimientos en el archivo');
  const r = ingest(items, card ? 'card' : 'xls');
  // Con las compras de la prepago ya dentro, sus recargas en la cuenta pasan a ser traspasos (si no, se contaría dos veces).
  let tr = 0;
  if (card && ds.length) { const a = ds.reduce((m,d) => d<m?d:m), b = ds.reduce((m,d) => d>m?d:m);
    S.tx.forEach(x => { if (x.t==='g' && x.cat!==NOCNT && x.date>=a && x.date<=b && /recarga tarjeta prepago/i.test(x.desc)) { x.cat = NOCNT; tr++; } }); }
  save(); render();
  CF(card ? `Tarjeta prepago importada: ${r.add} compras nuevas, ${r.link} enlazadas con gastos que ya tenías y ${r.skip} que ya estaban. ${tr} recargas desde la cuenta pasan a «${NOCNT}» para no contarlas dos veces.`
    : `Importación terminada: ${r.add} movimientos nuevos, ${r.link} enlazados con gastos que ya tenías y ${r.skip} que ya estaban. Revisa en Finanzas los que hayan quedado en «Otros».`, () => {}, undefined, true);
}

