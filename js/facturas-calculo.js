'use strict';
/* Cálculos de Facturas: fechas de cobro, estado de cada pago y enlace con los movimientos del banco. */
/* ---------- Facturas: pagos e ingresos que se repiten (S.fixed) ----------
   {id, name, t:'g'|'i', amt, cat, day|days, month (anual), every (cada N meses desde from), once (fecha única),
    from 'AAAA-MM' (desde cuándo), until, k (concepto con el que llega al banco)}.
   var: true = pago variable sin día fijo (amt es lo previsto al mes; se enlazan todos los cargos con su concepto k).
   La app no apunta gastos sola: un pago está hecho cuando hay un movimiento con su fid (del banco o marcado a mano). */
const mIdx = m => +m.slice(0,4)*12 + +m.slice(5,7);
const fxFq = f => f.var ? 'Variable' : f.once ? 'Única' : f.every===3 ? 'Trimestral' : f.every===6 ? 'Semestral' : f.month ? 'Anual' : 'Mensual';
/* Solo la frecuencia, sin día ni categoría (para las filas de Facturas). */
const fxFreq = f => f.var ? 'sin día fijo' : f.once ? 'una vez' : f.month ? 'anual' : f.every ? 'cada '+f.every+' meses' : 'mensual';
const fxWhen = f => { if (f.var) return 'sin día fijo · cada mes'; const d = f.days ? 'días '+f.days.join(', ') : 'día '+(f.day||1); return f.once ? 'una vez · '+fd(f.once) : f.month ? 'anual · '+(f.day||1)+' de '+MS[f.month] : f.every ? 'cada '+f.every+' meses · '+d : 'mensual · '+d; };
/* Fechas de cobro previstas entre a y b (AAAA-MM-DD). */
function fxOcc(f, a, b){
  if (f.var) return [];   // variable: varios cargos al mes sin día fijo (ver fxVar)
  if (f.once) return f.once>=a && f.once<=b ? [f.once] : [];
  const out = [], st = f.from || '2000-01';
  for (let m = a.slice(0,7); m <= b.slice(0,7); m = mAdd(m,1)) {
    if (m < st || (f.month && +m.slice(5) !== f.month) || (f.every && (mIdx(m) - mIdx(st)) % f.every)) continue;
    const last = new Date(+m.slice(0,4), +m.slice(5,7), 0).getDate();
    (f.days||[f.day||1]).forEach(d => { const dt = m+'-'+p2(Math.min(d,last)); if (dt>=a && dt<=b && (!f.until || dt<=f.until)) out.push(dt); });
  }
  return out;
}
/* prev: último cobro previsto (hasta hoy) · paid: su movimiento, si llegó · next: el siguiente · due: la fecha que importa ahora. */
function fxState(f){
  const td = TD(), near = d => d ? S.tx.find(x => x.fid===f.id && Math.abs(dd(x.date, d)) <= 10) : null;
  const prev = fxOcc(f, addD(td, f.month||f.every||f.once ? -400 : -40), td).pop() || '', next = fxOcc(f, addD(td,1), addD(td,800))[0] || '';
  // Un pago adelantado (p. ej. marcado a mano unos días antes) cuenta para el siguiente cobro.
  const pp = near(prev), pn = next && dayDiff(next) <= 10 ? near(next) : null, early = pn && pn !== pp;
  return {prev, next, paid: early ? pn : pp, due: prev && !pp && dd(td,prev) <= 31 ? prev : early ? '' : next};
}
/* Pago variable (f.var: p. ej. gasolina, varios cargos al mes sin día fijo): lo cobrado en el mes m y cuántos cargos. */
const fxVar = (f, m) => { const L = S.tx.filter(x => x.fid===f.id && mon(x.date)===m); return {n:L.length, s:L.reduce((a,x) => a+x.amt, 0)}; };
const fxLive = f => !f.until || f.until >= TD();
const fxStarted = f => !f.once && !(f.from && f.from > MN(new Date()));
/* Pagos que piden atención en los próximos n días (o atrasados en el último mes). */
const fxDue = n => S.fixed.filter(f => f.t==='g' && fxLive(f)).map(f => ({f, d:fxState(f).due})).filter(o => o.d && dayDiff(o.d) <= n).sort((a,b) => a.d.localeCompare(b.d));
/* Palabras con las que un pago reconoce sus cargos: la principal (f.k) y, en los variables, las extra (f.kx). */
const fxWords = f => [f.k, ...(f.kx||[])].filter(Boolean);
const fxHas = (f, c) => fxWords(f).some(w => c.includes(' '+w+' '));
/* Un movimiento nuevo del banco: si es un pago de la lista, se enlaza con él (y aprende su concepto). */
function fxMatch(x){
  if (x.fid || x.cat===NOCNT) return;
  const c = nt(concept(x));
  const f = S.fixed.find(f => f.t===x.t && f.k && fxHas(f, c))
    || S.fixed.find(f => f.t===x.t && !f.k && f.cat===x.cat && Math.abs(f.amt-x.amt) <= f.amt*0.1 && fxOcc(f, addD(x.date,-6), addD(x.date,6)).length)
    || S.fixed.find(f => f.t===x.t && !f.k && Math.abs(f.amt-x.amt) < 0.01 && fxOcc(f, addD(x.date,-3), addD(x.date,3)).length);  // mismo importe exacto aunque el banco le ponga otra categoría
  if (!f || (!f.var && S.tx.some(y => y!==x && y.fid===f.id && Math.abs(dd(y.date,x.date)) <= 10))) return;
  x.fid = f.id; if (!f.k) f.k = c.trim();
}
/* Cargos del banco que se repiten (mismo concepto en 3 meses o más, importe parecido) y aún no están en la lista. */
function fxDetect(){
  const from = mAdd(MN(new Date()),-5)+'-01', g = {};
  S.tx.filter(x => fromBank(x) && x.t==='g' && !x.fid && x.cat!==NOCNT && x.cat!=='Traspasos' && x.date>=from).forEach(x => { const k = nt(concept(x)).trim(); if (k) (g[k] = g[k] || []).push(x); });
  return Object.entries(g).flatMap(([k,L]) => {
    const ms = new Set(L.map(x => mon(x.date))), a = L.map(x => x.amt).sort((p,q) => p-q), med = a[a.length>>1];
    if (ms.size < 3 || L.length > ms.size*1.2 || S.fxIgn.includes(k) || S.fixed.some(f => f.k===k) || a.some(v => Math.abs(v-med) > med*0.2)) return [];
    // ¿Es un pago que ya está en la lista con otro nombre? (mismo importe ±10 % y cobrado en sus días)
    const f = S.fixed.find(f => f.t==='g' && fxLive(f) && Math.abs(f.amt-med) <= f.amt*0.1 && L.filter(y => fxOcc(f, addD(y.date,-6), addD(y.date,6)).length).length >= L.length*0.7);
    return [{k, L, f, x:L.reduce((p,x) => x.date>p.date ? x : p), n:ms.size}];
  }).sort((a,b) => b.x.amt-a.x.amt);
}
/* Cargos repetidos que son un pago de la lista: se enlazan con él y se aprende el nombre con el que llegan del banco
   (si solo tenía el suyo propio, de cuando la app apuntaba el gasto sola). */
function fxLearn(){
  let n = 0;
  fxDetect().filter(o => o.f).forEach(({k, L, f}) => {
    L.forEach(y => { if (!S.tx.some(z => z!==y && z.fid===f.id && Math.abs(dd(z.date,y.date)) <= 10)) { y.fid = f.id; n++; } });
    if (!f.k || f.k === nt(f.name).trim()) { f.k = k; n++; }
  });
  return n;
}

