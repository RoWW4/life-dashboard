'use strict';
/* Sección «Facturas»: pagos e ingresos que se repiten. */
/* Una fila de Facturas: estado del último cobro (pagado / pendiente / próximo) y acciones. */
const fxItem = f => { if (f.var) return fxVarItem(f); const s0 = fxState(f), late = s0.due && s0.due===s0.prev,
    // Cobro de este mes que aún no ha llegado: no se enseña el pago del mes anterior.
    pm = !late && s0.next && mon(s0.next)===MN(new Date()) && !(s0.paid && Math.abs(dd(s0.paid.date, s0.next)) <= 10), s = pm ? {...s0, paid:null} : s0, ag = late ? dd(TD(),s.prev) : 0;
  const chip = late ? `<span class="chip ${ag>5?'er':'wa'}">${ag>5?'no ha llegado':'pendiente'} · ${fd(s.prev)}</span>`
    : pm ? `<span class="chip">${f.t==='i'?'por cobrar':'pendiente'} · ${fd(s.next)}</span>`
    : s.paid ? `<span class="chip ok">${f.t==='i'?'cobrado':'pagado'} ${fd(s.paid.date)}</span>`
    : s.next ? `<span class="chip">${f.once?'vence':fxStarted(f)||f.month||f.every?'próximo':'empieza'} ${fd(s.next)}</span>` : '<span class="chip">terminado</span>';
  return `<div class="row brow">${tile(CI[f.cat]||'receipt', col(f.cat))}<span class="g"><span class="tt">${esc(f.name)}</span><br><span class="mu">${fxWhen(f)}${f.t==='g'?' · '+esc(f.cat):''}${s.paid?(fromBank(s.paid)?' · llegó del banco':' · apuntado en el panel, aún sin cargo del banco')+(s.next && Math.abs(dd(s.paid.date, s.next)) > 10 ? ' · próximo '+fd(s.next) : ''):''}</span></span>${chip}<span class="amt ${f.t==='i'?'ok':''}">${eur(f.amt)}</span><button class="ib" data-a="ef" data-i="${f.id}" aria-label="Editar">${I('pencil')}</button></div>`; };
/* Fila de un pago variable: lo que lleva este mes frente a lo previsto. */
const fxVarItem = f => { const v = fxVar(f, MN(new Date()));
  return `<div class="row brow">${tile(CI[f.cat]||'receipt', col(f.cat))}<span class="g"><span class="tt">${esc(f.name)}</span><br><span class="mu">${fxWhen(f)} · ${esc(f.cat)} · ${v.n} cargo${v.n===1?'':'s'} este mes</span></span><span class="chip ${v.s>=f.amt?'ok':''}">llevas ${eur(v.s)}</span><span class="amt">≈ ${eur(f.amt)}</span><button class="ib" data-a="ef" data-i="${f.id}" aria-label="Editar">${I('pencil')}</button></div>`; };
/* Pagos de Facturas de este mes: total previsto (lo real si ya llegó), lo pagado y la lista (incluye lo atrasado del mes anterior). */
function fxMonth(){
  const now = new Date(), m = MN(now), a = m+'-01', b = m+'-'+p2(new Date(now.getFullYear(), now.getMonth()+1, 0).getDate());
  let tot = 0, paid = 0;
  const cur = S.fixed.filter(f => f.t==='g' && fxLive(f)).filter(f => {
    // Variable: cuenta lo previsto o lo cobrado si ya se ha pasado; falta lo que quede hasta lo previsto.
    if (f.var) { if (f.from && f.from > m) return false; const v = fxVar(f, m); tot += Math.max(f.amt, v.s); paid += v.s; return true; }
    const oc = fxOcc(f, a, b), d = fxState(f).due;
    oc.forEach(d => { const x = S.tx.find(x => x.fid===f.id && Math.abs(dd(x.date, d)) <= 10); tot += x ? x.amt : f.amt; if (x) paid += x.amt; });
    return oc.length || (d && d < a); });
  return {tot, paid, cur};
}
/* Lo que aún falta por cobrarse de Facturas este mes: se descuenta del «Disponible». */
const fxLeft = () => { const o = fxMonth(); return Math.max(0, o.tot - o.paid); };
function vFact(){
  const act = S.fixed.filter(fxLive), now = new Date(), m = MN(now), a = m+'-01', b = m+'-'+p2(new Date(now.getFullYear(), now.getMonth()+1, 0).getDate());
  const by = (L, key) => L.map(f => [key(f)||'9999', f]).sort((p,q) => p[0].localeCompare(q[0])).map(x => fxItem(x[1])).join('');
  const pays = act.filter(f => f.t==='g'), ings = act.filter(f => f.t==='i'), det = fxDetect().filter(o => !o.f);
  // Este mes: lo que se cobra en el mes (pagado o no) y lo atrasado del mes anterior que no llegó.
  const {tot, paid, cur} = fxMonth();
  const rest = pays.filter(f => !cur.includes(f));
  const mes = new Intl.DateTimeFormat('es-ES',{month:'long'}).format(now), ingm = ings.reduce((q,f) => q + fxOcc(f, a, b).reduce((s,d) => { const x = S.tx.find(x => x.fid===f.id && Math.abs(dd(x.date, d)) <= 10); return s + (x ? x.amt : f.amt); }, 0), 0);
  const pag = `<div class="mu">Pagado ${eur(paid)} · falta ${eur(tot-paid)}</div>`
    + (cur.length ? `<div class="dh">Este mes</div>${by(cur, f => fxOcc(f, a, b)[0] || fxState(f).due)}` : '')
    + (rest.length ? `<div class="dh">Próximos</div>${by(rest, f => fxState(f).next)}` : '');
  const C = {
    det: det.length && panel('fact','det',`${I('sparkles')} Detectados en el banco <span class="cnt">· se repiten cada mes</span>`, det.map(o => `<div class="row brow">${tile(CI[o.x.cat]||'receipt', col(o.x.cat))}<span class="g"><span class="tt">${esc(concept(o.x))}</span><br><span class="mu">${o.n} meses seguidos · último ${fd(o.x.date)} · ${esc(o.x.cat)}</span></span><span class="amt">${eur(o.x.amt)}</span><button class="btn sm" data-a="fxa" data-i="${esc(o.k)}">Añadir</button><button class="btn sm ghost" data-a="fxi" data-i="${esc(o.k)}">Ignorar</button></div>`).join(''), 'wide'),
    ing: ings.length && panel('fact','ing',`${I('wallet')} Ingresos`, by(ings, f => fxState(f).due) + `<div class="mu" style="margin-top:8px">En ${mes} quedan libres <b class="ok">${eur(ingm-tot)}</b> (ingresos ${eur(ingm)} − pagos ${eur(tot)})</div>`, 'wide'),
    pag: panel('fact','pag',`${I('receipt')} Pagos <span class="cnt">· ${mes}: ${eur(tot)}</span>`, pays.length ? pag : empty('Sin pagos todavía.'), 'wide') };
  VIS.fact = ord('fact', ['det','ing','pag'].filter(k => C[k]));
  return `<div class="hdr"><div><h2>Facturas</h2><div class="sub">Pagos e ingresos que se repiten. Se marcan como pagados solos cuando llega el cargo del banco; la app ya no apunta gastos por su cuenta.</div></div><div class="hact"><button class="btn" data-a="fxn">${I('plus')} Añadir</button></div></div>
  <div class="grid">${VIS.fact.map(k => C[k]).join('')}</div>`;
}

