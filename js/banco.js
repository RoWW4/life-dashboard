'use strict';
/* Movimientos del banco: clasificar, limpiar conceptos, evitar duplicados e importar archivos. */
/* ---------- banco: clasificar, deduplicar e importar ---------- */
/* Pagos con el móvil o el reloj: «Google pay: COMPRA EN BUGA RAMEN» → «BUGA RAMEN». Sin esto, «google» lo mandaba a Suscripciones. */
const PAYP = /^\s*(?:google|fitbit|apple|samsung|garmin)\s*pay\s*:?\s*(?:(?:compra|pago)\s+)?(?:en\s+)?/i;
function classify(desc, t) {
  const d = nt(String(desc || '').replace(PAYP, ''));
  // Recargar la tarjeta prepago o devolver su saldo a la cuenta es mover dinero entre tus cuentas (lo gastado con ella se apunta desde su extracto).
  if (/ (recarga|descarga) tarjeta prepago /.test(d)) return 'Traspasos';
  // A un ingreso solo le valen reglas de Nómina, Otros o Traspasos: las devoluciones (ingreso con categoría de gasto) se eligen a mano.
  for (const r of S.rules) {
    const k = nt(r.k).trim();
    if (k && d.includes(k) && (t !== 'i' || ['Nómina', 'Otros', 'Traspasos'].includes(r.cat))) return r.cat;
  }
  if (t === 'i') return /nomina/.test(d) ? 'Nómina' : 'Otros';
  for (const [c, ks] of KWC) if (ks.some(k => d.includes(k))) return c;
  return 'Otros';
}
const tcase = s => s.toLowerCase().replace(/(^|[\s(])\S/g, c => c.toUpperCase());
function cleanDesc(s) {
  s = String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(PAYP, '')
    .replace(/^(compra|pago)\s+(en\s+|con tarjeta en\s+)?/i, '')
    .replace(/,?\s*con la tarjeta.*$/i, '')
    .replace(/,?\s*el \d{4}-\d{2}-\d{2}.*$/i, '')
    .replace(/^www\./i, '')
    .replace(/\*.*$/, '') // "WWW.AMAZON* BT40X4DR4" → "AMAZON"
    .replace(/\s+\d{2}[a-z]{3}\s+\w+$/i, '') // "GLOVO 09OCT ELAT9KNEC" → "GLOVO"
    .replace(
      /^bizum (a favor de|de)\s+(.+?)\s+concepto:\s*(.*)$/i,
      (m, d, who, c) => `Bizum ${/favor/i.test(d) ? 'a' : 'de'} ${tcase(who)}${c ? ' · ' + c : ''}`
    )
    .trim();
  if (s && s === s.toUpperCase()) s = tcase(s);
  return cap(s.slice(0, 90)) || 'Movimiento bancario';
}
/* items: [{id, date, amt (negativo = gasto), desc}]. fld: 'bank' (API), 'xls' (archivo de la cuenta) o 'card' (archivo de la tarjeta prepago).
   Si ya existe un movimiento equivalente (manual, fijo o factura) se enlaza en vez de duplicarlo.
   La cuenta y la prepago son flujos distintos: nunca se enlazan entre sí. */
const fromBank = x => !!(x.bank || x.xls || x.card);
function ingest(items, fld) {
  let add = 0,
    link = 0,
    skip = 0;
  const free = fld === 'card' ? x => !fromBank(x) : x => !x[fld] && !x.card;
  for (const it of items) {
    if (!it.date || !it.amt || S.bankSeen.includes(it.id)) {
      skip++;
      continue;
    }
    const t = it.amt < 0 ? 'g' : 'i',
      amt = Math.round(Math.abs(it.amt) * 100) / 100,
      cat = classify(it.desc, t);
    let m = S.tx.find(x => free(x) && x.t === t && Math.abs(x.amt - amt) < 0.01 && Math.abs(dd(x.date, it.date)) <= 4);
    if (!m)
      m = S.tx.find(
        x => free(x) && x.fid && x.t === t && x.cat === cat && Math.abs(x.amt - amt) <= x.amt * 0.25 && Math.abs(dd(x.date, it.date)) <= 5
      );
    // Un fijo enlazado conserva su fecha (y su mes contable); solo se ajusta al importe real.
    if (m) {
      m[fld] = it.id;
      if (m.fid) m.amt = amt;
      link++;
    } else {
      const x = { id: id(), t, amt, cat, date: it.date, desc: cleanDesc(it.desc), [fld]: it.id };
      S.tx.push(x);
      fxMatch(x);
      add++;
    }
    S.bankSeen.push(it.id);
  }
  return { add, link, skip };
}
/* Los PDF de Openbank (el móvil solo deja descargar estos) se leen con pdf.js y se convierten en las mismas filas que el .xls.
   - Cuenta: «fecha operación · fecha valor · concepto · importe · saldo». Según la versión del banco, las fechas vienen
     como dd-mm-aaaa o aaaa-mm-dd y los importes con «EUR» (1.234,56 EUR) o sin él (1234.56): se aceptan las dos.
   - Tarjeta prepago: «fecha (dd-mm-aaaa) · hora · concepto · situación · localidad · importe (con punto decimal) · EUR».
   Se ignora el texto legal vertical del margen izquierdo: si coincide a la altura de un movimiento, lo tapaba.
   Si el concepto es largo, sigue en las líneas justo encima o debajo (a menos de 12 puntos), que se le juntan. */
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/';
async function pdfRows(buf) {
  const pdfjs = await import(PDFJS + 'pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.mjs';
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise,
    rows = [],
    DT = /^(\d{2}[\/-]\d{2}[\/-]\d{4}|\d{4}-\d{2}-\d{2})$/,
    dmy = f => f.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3-$2-$1'),
    dot = n => (n.includes(',') ? n : n.replace('.', ','));
  let card = null,
    cx = 0,
    acct = null; // tipo de PDF, dónde acaba la columna de concepto y saldo de la cabecera
  for (let p = 1; p <= doc.numPages; p++) {
    const its = (await (await doc.getPage(p)).getTextContent()).items
        .filter(i => i.str.trim() && !i.transform[1] && !i.transform[2] && i.transform[4] >= 40)
        .map(i => ({ x: i.transform[4], y: Math.round(i.transform[5]), s: i.str.trim() })),
      L = new Map();
    its.forEach(i => (L.get(i.y) || L.set(i.y, []).get(i.y)).push(i));
    const lines = [...L].map(([y, a]) => ({ y, a: a.sort((u, v) => u.x - v.x) }));
    // Cabecera de la cuenta: el valor va a la derecha de su etiqueta, casi a la misma altura (puede venir como otro trozo de texto).
    if (p === 1) {
      const val = re => {
          const lb = its.find(i => re.test(i.s));
          if (!lb) return '';
          const m = lb.s.replace(re, '').trim();
          if (m) return m;
          const r = its.filter(i => i !== lb && i.x > lb.x && Math.abs(i.y - lb.y) <= 4).sort((a, b) => a.x - b.x)[0];
          return r ? r.s : '';
        },
        sb = val(/^Saldo:/).match(/^(-?[\d.,]+)\s*(EUR)?$/),
        fdm = val(/^Fecha descarga:?/).match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (sb) acct = { bal: pnum(dot(sb[1])), d: fdm ? `${fdm[3]}-${fdm[2]}-${fdm[1]}` : '' };
    }
    if (card === null) {
      const h = lines.find(l => l.a.some(i => i.s === 'Concepto') && l.a.some(i => i.s === 'Importe'));
      if (!h) continue;
      const sit = h.a.find(i => /^Situaci/.test(i.s));
      card = !!sit;
      cx = card ? sit.x - 12 : h.a.find(i => i.s === 'Importe').x - 10;
    }
    const mv = lines
      .filter(l => l.a.length >= 3 && DT.test(l.a[0].s) && l.a[0].x < 110)
      .map(l => {
        const c = l.a
          .slice(2)
          .filter(i => i.x > 150 && i.x < cx)
          .map(i => i.s)
          .join(' ');
        if (card) {
          const im = l.a.filter(i => i.x >= cx && /^-?[\d.,]+$/.test(i.s)).pop(),
            st = l.a.find(i => i.x >= cx && /^[A-ZÁÉÍÓÚ]{5,}$/.test(i.s));
          return im && { y: l.y, f: dmy(l.a[0].s), st: st ? st.s : '', imp: im.s.replace(/,/g, '').replace('.', ','), c: [[l.y, c]] };
        }
        let eu = l.a.filter(i => /EUR$/.test(i.s)).map(i => i.s.replace(/\s*EUR$/, ''));
        if (eu.length < 2) eu = l.a.filter(i => i.x >= cx && /^-?[\d.,]+$/.test(i.s)).map(i => dot(i.s));
        return (
          DT.test(l.a[1].s) &&
          eu.length >= 2 && { y: l.y, f: dmy(l.a[0].s), v: dmy(l.a[1].s), imp: eu[0], sal: eu[eu.length - 1], c: [[l.y, c]] }
        );
      })
      .filter(Boolean);
    // Trozos de concepto sueltos (entre la columna de fechas y la de importes): al movimiento más cercano.
    for (const l of lines) {
      if (mv.some(m => m.y === l.y)) continue;
      const t = l.a
        .filter(i => i.x > 150 && i.x < cx)
        .map(i => i.s)
        .join(' ');
      if (!t) continue;
      const m = mv.reduce((b, m) => (!b || Math.abs(m.y - l.y) < Math.abs(b.y - l.y) ? m : b), null);
      if (m && Math.abs(m.y - l.y) < 12) m.c.push([l.y, t]);
    }
    const cc = m =>
      m.c
        .sort((a, b) => b[0] - a[0])
        .map(c => c[1])
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ');
    mv.sort((a, b) => b.y - a.y).forEach(m => rows.push(card ? [m.f, cc(m), m.st, m.imp] : [m.f, m.v, cc(m), m.imp, m.sal]));
  }
  if (!rows.length) return { rows: [], card: false };
  return {
    card,
    acct: card ? null : acct,
    rows: [
      card ? ['Fecha Operación', 'Concepto', 'Situación', 'Importe'] : ['Fecha Operación', 'Fecha Valor', 'Concepto', 'Importe', 'Saldo'],
      ...rows
    ]
  };
}
/* "Movimientos de Cuenta.xls" de Openbank es una tabla HTML; también vale un CSV o el PDF. */
async function importFile(file) {
  const buf = await file.arrayBuffer(),
    head = new Uint8Array(buf.slice(0, 4));
  if (head[0] === 0x50 && head[1] === 0x4b) return toast('Es un .xlsx real: ábrelo en Excel y guárdalo como CSV');
  const pdf = head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46; // %PDF
  let txt = pdf ? '' : new TextDecoder('utf-8').decode(buf);
  if (txt.includes('�')) txt = new TextDecoder('windows-1252').decode(buf);
  let rows,
    pc = false,
    acct = null;
  if (pdf) {
    toast('Leyendo el PDF…');
    ({ rows, card: pc, acct } = await pdfRows(buf));
  } else if (/<table/i.test(txt))
    rows = [...new DOMParser().parseFromString(txt, 'text/html').querySelectorAll('tr')].map(tr =>
      [...tr.cells].map(c => c.textContent.replace(/\s+/g, ' ').trim())
    );
  else {
    const sep = (txt.split('\n')[0].match(/;/g) || []).length ? ';' : txt.includes('\t') ? '\t' : ',';
    rows = txt.split(/\r?\n/).map(l => l.split(sep).map(c => c.replace(/^"|"$/g, '').trim()));
  }
  // "Movimientos de Tarjeta.xls" (prepago): las cargas son la otra cara de la «Recarga» de la cuenta y se omiten.
  const card = pc || /tarjetas\s*-\s*movimientos|tipo de tarjeta/i.test(txt);
  const hi = rows.findIndex(r => r.some(c => /importe/i.test(c)) && r.some(c => /fecha/i.test(c)));
  if (hi < 0) return toast('No encuentro las columnas «Fecha» e «Importe» en el archivo');
  const H = rows[hi].map(nt);
  let iF = H.findIndex(h => /fecha oper/.test(h));
  if (iF < 0) iF = H.findIndex(h => h.includes(' fecha'));
  const iC = H.findIndex(h => /concepto|descrip|movimiento/.test(h)),
    iI = H.findIndex(h => h.includes(' importe')),
    iS = H.findIndex(h => /situaci/.test(h)),
    iB = H.findIndex(h => /saldo/.test(h));
  const items = [],
    occ = {},
    ds = [];
  let nb = null; // saldo tras el movimiento más reciente (si el archivo no trae el saldo en la cabecera)
  for (const r of rows.slice(hi + 1)) {
    const dm = (r[iF] || '').match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
    if (!dm) continue;
    const date = (dm[3].length === 2 ? '20' + dm[3] : dm[3]) + '-' + p2(dm[2]) + '-' + p2(dm[1]);
    ds.push(date);
    if (!card && iB >= 0 && (!nb || date > nb.d)) {
      const b = pnum(r[iB]);
      if (!isNaN(b)) nb = { bal: b, d: date };
    }
    const amt = pnum(r[iI]);
    if (!amt || isNaN(amt)) continue;
    const desc = iC >= 0 ? r[iC] : '',
      base = date + '|' + amt + '|' + nt(desc);
    if (card && (/carga tarjeta/i.test(desc) || /anulad|denegad|rechazad/i.test(r[iS] || ''))) continue;
    occ[base] = (occ[base] || 0) + 1;
    items.push({ id: (card ? 'c' : 'x') + hash(base + '|' + occ[base]), date, amt, desc });
  }
  if (!items.length && !card) return toast('No he encontrado movimientos en el archivo');
  // El concepto del PDF puede no ser letra por letra el del .xls: lo ya importado de esa cuenta o tarjeta (mismo día, importe y tipo) no se repite.
  if (pdf) {
    const had = {},
      f = card ? 'card' : 'xls';
    S.tx.forEach(x => {
      if (x[f]) {
        const k = x.date + '|' + x.t + '|' + x.amt.toFixed(2);
        had[k] = (had[k] || 0) + 1;
      }
    });
    for (const it of items) {
      const k = it.date + '|' + (it.amt < 0 ? 'g' : 'i') + '|' + Math.abs(it.amt).toFixed(2);
      if (had[k] > 0) {
        had[k]--;
        it.dup = true;
      }
    }
  }
  // La fecha del saldo es la más tardía entre la descarga y el último movimiento del archivo: lo de después se le suma en Finanzas.
  const last = ds.length ? ds.reduce((m, d) => (d > m ? d : m)) : '',
    ac = acct && !isNaN(acct.bal) ? { bal: acct.bal, d: [acct.d || '', last].sort().pop() || TD() } : nb;
  const r = ingest(
    items.filter(it => !it.dup),
    card ? 'card' : 'xls'
  );
  // Saldo de la cuenta para Finanzas (no se pisa con un extracto más antiguo). «seen» marca qué movimientos ya están dentro de ese saldo:
  // solo los que lleguen después se le suman, aunque el banco les ponga una fecha anterior o posterior.
  if (ac && (!S.acct || ac.d >= S.acct.d)) S.acct = { ...ac, seen: S.bankSeen.length, t: Date.now() };
  r.skip += items.filter(it => it.dup).length;
  // Con las compras de la prepago ya dentro, sus recargas en la cuenta pasan a ser traspasos (si no, se contaría dos veces).
  let tr = 0;
  if (card && ds.length) {
    const a = ds.reduce((m, d) => (d < m ? d : m)),
      b = ds.reduce((m, d) => (d > m ? d : m));
    S.tx.forEach(x => {
      if (x.t === 'g' && x.cat !== NOCNT && x.date >= a && x.date <= b && /recarga tarjeta prepago/i.test(x.desc)) {
        x.cat = NOCNT;
        tr++;
      }
    });
  }
  save();
  render();
  CF(
    card
      ? `Tarjeta prepago importada: ${r.add} compras nuevas, ${r.link} enlazadas con gastos que ya tenías y ${r.skip} que ya estaban. ${tr} recargas desde la cuenta pasan a «${NOCNT}» para no contarlas dos veces.`
      : `Importación terminada: ${r.add} movimientos nuevos, ${r.link} enlazados con gastos que ya tenías y ${r.skip} que ya estaban. Revisa en Finanzas los que hayan quedado en «Otros».`,
    () => {},
    undefined,
    true
  );
}
