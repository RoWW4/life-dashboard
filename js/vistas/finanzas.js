'use strict';
/* Secciones «Finanzas» e «Inversiones»: banco, ahorro, reglas, movimientos y bandeja «Sin clasificar». */
function bankCard(v){
  let st;
  if (!cloudCfg()) st = '<div class="mu">Para que los movimientos lleguen solos cada día, conecta la nube (Supabase) y el banco siguiendo la guía <b>LEEME.md</b>. Mientras tanto, puedes importar el archivo de Openbank.</div>';
  else if (!user) st = '<div class="mu">Modo local: inicia sesión para recibir los movimientos del banco.</div>';
  else if (!BANK || !BANK.session_id) st = '<div class="mu">Banco aún no conectado. Sigue la guía (paso 6) para activar la sincronización diaria.</div>';
  else { const vu = BANK.valid_until ? BANK.valid_until.slice(0,10) : '', n = vu ? dayDiff(vu) : 999;
    st = `<div class="row"><span class="g">Última sincronización</span><span class="mu">${ago(BANK.last_sync)}</span></div><div class="row"><span class="g">Permiso del banco</span><span class="chip ${n<0?'er':n<=14?'wa':'ok'}">${vu?(n<0?'caducado':'hasta '+fd(vu)):'—'}</span></div>${BANK.last_error?`<div class="mu er" style="margin-top:6px">Último error: ${esc(BANK.last_error)}</div>`:''}<div class="mu" style="margin-top:6px">Los movimientos llegan a través de Wallet, que se conecta con el banco. El panel los recoge 5 veces al día (≈ 6:15, 10:15, 14:15, 18:15 y 22:15; GitHub a veces se retrasa). «Recargar» trae lo último que haya llegado; para traerlos ya, usa «Sincronizar ahora en GitHub» → <i>Run workflow</i>.</div>`; }
  return panel(v,'bank',`${I('landmark')} Banco (Openbank)`,`${st}<div class="f" style="margin:12px 0 0"><label class="btn ghost" style="flex:none">${I('upload')} Importar movimientos de cuenta o prepago (.xls)<input type="file" id="bankfile" accept=".xls,.xlsx,.csv,.html,.htm,.txt" hidden></label>${user?`<button class="btn ghost" style="flex:none" data-a="bsync">${I('refresh-cw')} Recargar</button><a class="btn ghost" style="flex:none" href="https://github.com/RoWW4/life-dashboard/actions/workflows/wallet-sync.yml" target="_blank" rel="noopener noreferrer">${I('external-link')} Sincronizar ahora en GitHub</a>`:''}</div>`);
}
/* Cuenta de ahorro (p. ej. una cuenta remunerada): aparte de los gastos, solo para consultar.
   S.sav = {name, rate (% anual bruto), tax (% de impuestos sobre intereses), snaps:[{id, d, bal, dep}]}
   Cada apunte es el saldo en una fecha; dep = dinero que metiste (+) o sacaste (−) ese día.
   Lo ganado es el saldo menos lo aportado, así que los intereses netos salen solos. */
const SAV_TAX = 19;
let savShow = false;   // los importes de ahorro salen difuminados hasta pulsar el ojo (no se guarda)
const pct = n => n.toFixed(2).replace('.',',').replace(/,?0+$/,'') + ' %';
const money = v => `<span class="money">${v}</span>`;
/* Estimación: interés compuesto mensual (la cuenta paga cada mes) sobre el último saldo apuntado. */
function savStats(){
  const s = S.sav, L = [...(s.snaps||[])].sort((a,b) => a.d.localeCompare(b.d));
  if (!L.length) return null;
  const last = L[L.length-1], dep = L.reduce((a,x) => a+(x.dep||0), 0), td = TD();
  // La cuenta abona los intereses del mes anterior el día 1: el saldo solo sube en cada día 1 posterior al último apunte
  const net = (s.rate||0)/100 * (1-(s.tax??SAV_TAX)/100), m1 = d => d.slice(0,8)+'01',
    pays = d => { let n = 0; for (let m = addM(m1(last.d),1); m <= d; m = addM(m,1)) n++; return n; },
    at = d => last.bal * Math.pow(1+net/12, pays(d));
  const now = at(td), est = pays(td) > 0, days = dd(td, L[0].d), next = addM(m1(td),1);
  // Interés que se va generando este mes y se cobrará el día 1 del siguiente
  const acc = now * net/12 * (dd(td, m1(td)) + 1) / dd(next, m1(td));
  // Proyección: abono de cada uno de los próximos 12 días 1
  const proj = []; let prev = now;
  for (let k = 1; k <= 12; k++) { const d = addM(m1(td),k), b = at(d); proj.push({d, bal:b, int:b-prev}); prev = b; }
  const y1 = at(addM(td,12));
  return {L, last, dep, now, est, acc, next, gain: now-dep, net, proj, y1, real: days>=28 && dep>0 ? (now-dep)/dep*365/days*100 : null};
}
/* Barras de intereses netos por el mes en que se ganan (se cobran el día 1 del mes siguiente):
   cobrado (según los saldos apuntados), generado este mes aún sin cobrar y previsto. */
function savChart(st){
  const M = {}, add = (m,k,v) => { (M[m] = M[m] || {r:0, g:0, p:0})[k] += v; }, cm = MN(new Date());
  st.L.forEach((x,i) => { if (!i) return; const a = st.L[i-1], ms = [];
    // la subida entre dos apuntes viene de los abonos de los días 1 entre ellos; cada uno es el interés del mes anterior
    for (let m = mAdd(mon(a.d),1); m <= mon(x.d); m = mAdd(m,1)) ms.push(mAdd(m,-1));
    const v = x.bal - a.bal - (x.dep||0); ms.forEach(m => add(m, 'r', v/ms.length)); });
  st.proj.forEach(p => { const m = mAdd(mon(p.d),-1);
    if (m === cm) { add(m, 'g', Math.min(st.acc, p.int)); add(m, 'p', Math.max(0, p.int - st.acc)); } else add(m, 'p', p.int); });
  const keys = []; for (let m = mon(st.L[0].d), end = st.proj.length ? mAdd(mon(st.proj[st.proj.length-1].d),-1) : cm; m <= end; m = mAdd(m,1)) keys.push(m);
  const K = keys.slice(-13), mx = Math.max(1, ...K.map(k => M[k] ? M[k].r + M[k].g + M[k].p : 0));
  return `<div class="savbars" role="img" aria-label="Intereses netos por mes">${K.map(k => { const v = M[k] || {r:0,g:0,p:0}, t = Math.max(0, v.r + v.g + v.p),
      tip = [v.r && eur(v.r)+' cobrado', v.g && eur(v.g)+' generado hasta hoy', v.p && eur(v.p)+' previsto'].filter(Boolean).join(' + ');
    return `<div class="${k===cm?'now':''}" title="${mLabel(k)}: ${tip||eur(0)}"><em>${t?t.toFixed(2).replace('.',',')+' €':''}</em><i style="height:${t/mx*100}%">${v.g?`<b class="g" style="height:${v.g/t*100}%"></b>`:''}<b style="height:${t ? Math.max(0,v.r)/t*100 : 0}%"></b></i><span>${MS[+k.slice(5)]}</span></div>`; }).join('')}</div>
    <div class="savlg"><span><i></i>Cobrado</span><span><i class="g"></i>Generado este mes</span><span><i class="p"></i>Previsto</span><span class="mu">interés neto de cada mes; se cobra el día 1 del siguiente</span></div>`;
}
function savCard(){
  const s = S.sav;
  if (!s) return panel('inv','ahorro',`${I('piggy-bank')} Ahorros`,`<div class="mu" style="margin-bottom:10px">Sigue aquí tu cuenta de ahorro (por ejemplo una cuenta remunerada): saldo, intereses y evolución, sin mezclarlo con tus gastos.</div><button class="btn" data-a="savcfg">${I('plus')} Configurar cuenta de ahorro</button>`,'wide');
  const st = savStats(), tax = s.tax??SAV_TAX;
  const body = st ? `<div class="savk">
      <div class="bal"><span>Saldo hoy${st.est?' (estimado)':''}</span><b>${money(eur(st.now))}</b><em>último saldo real apuntado: ${fd(st.last.d)}</em></div>
      <div class="up"><span>Ganado este mes</span><b>${money('+'+eur(st.acc))}</b><em>se abona el ${fd(st.next)}</em><em>total cobrado desde ${fd(st.L[0].d)}: ${money('+'+eur(st.gain))}</em></div>
      <div class="hi"><span>Rentabilidad anual</span><b>${pct(st.net*100)}</b><em>${pct(s.rate)} bruto − ${tax} % impuestos</em></div>
      <div class="up"><span>En 12 meses</span><b>${money('+'+eur(st.y1-st.now))}</b><em class="fin">saldo final ≈ ${money(eur(st.y1))}</em></div>
    </div>
    ${savChart(st)}
    <h4 class="savh">Previsión mes a mes</h4>
    ${fold('savp', st.proj.map(p => `<div class="row"><span class="g">Abono ${fd(p.d)}</span><span class="amt ok">${money('+'+eur(p.int))}</span><b class="amt">${money(eur(p.bal))}</b></div>`), 3)}
    ${st.real!==null?`<div class="mu" style="margin:8px 0">Rentabilidad real con lo apuntado hasta hoy: ≈ ${pct(st.real)} anual. La previsión se recalcula cada vez que apuntas el saldo real.</div>`:''}
    <h4 class="savh">Apuntes</h4>
    ${fold('sav', [...st.L].reverse().map(x => `<div class="row"><span class="g">${fd(x.d)}${x.dep?` <span class="chip">${x.dep>0?'aportación +':'retirada −'}${money(eur(Math.abs(x.dep)))}</span>`:''}</span><b class="amt">${money(eur(x.bal))}</b><button class="ib" data-a="savdel" data-i="${x.id}" aria-label="Eliminar apunte">${I('x')}</button></div>`), 2)}` : empty('Aún no hay apuntes.');
  return panel('inv','ahorro',`${I('piggy-bank')} ${esc(s.name)} <span class="cnt">· ahorro</span> <button class="ib" data-a="saveye" aria-label="${savShow?'Ocultar importes':'Mostrar importes'}" title="${savShow?'Ocultar importes':'Mostrar importes'}">${I(savShow?'eye-off':'eye')}</button><button class="ib" data-a="savcfg" aria-label="Editar cuenta">${I('pencil')}</button>`, `<div class="${savShow?'':'priv'}">${body}</div>` +
    `<div class="f" style="margin:10px 0 0"><input id="sv1" type="date" value="${TD()}" aria-label="Fecha"><input id="sv2" inputmode="decimal" placeholder="Saldo real (€)"><input id="sv3" inputmode="decimal" placeholder="Metido (+) o sacado (−)" title="Opcional: dinero que metiste o sacaste ese día"><button class="btn" data-a="savadd">Apuntar saldo real</button></div>`, 'wide');
}
function rulesCard(){
  return panel('fin','reglas',`${I('tags')} Reglas de clasificación <span class="cnt">· ${S.rules.length}</span>`,`<div class="mu" style="margin-bottom:8px">Si el concepto del banco contiene la palabra, se asigna esa categoría. Se crean solas al cambiar la categoría de un movimiento del banco.</div>${S.rules.map((r,i) => `<div class="row"><span class="g">«${esc(r.k)}»</span><span class="chip" style="color:${col(r.cat)}">${I(CI[r.cat]||'package','sm')} ${r.cat}</span><button class="ib" data-a="dr" data-i="${i}" aria-label="Eliminar regla">${I('x')}</button></div>`).join('')}
  <div class="f" style="margin:10px 0 0"><input id="r1" placeholder="Palabra (ej. mercadona)"><select id="r2">${opts(CATS,'Alimentación')}</select><button class="btn" data-a="ar">Añadir</button></div>`);
}
/* Mes que se está viendo en Finanzas y utilidades del desglose */
const finMonth = () => { const n = new Date(); return MN(new Date(n.getFullYear(), n.getMonth()+finOff, 1)); };
const mAdd = (m,n) => MN(new Date(+m.slice(0,4), +m.slice(5,7)-1+n, 1));
const mLabel = m => cap(new Intl.DateTimeFormat('es-ES',{month:'long',year:'numeric'}).format(new Date(m+'-01T00:00')));
const concept = x => String(x.desc||x.cat).split(' · ')[0].trim();
const yearly = f => f.once ? 0 : f.amt * (f.month ? 1 : f.every ? 12/f.every : 12*(f.days ? f.days.length : 1));
let txf = {q:'', cat:'', per:'mes', t:''};
/* Movimientos: 5 al principio; «Ver más» añade una tanda (10 en el móvil, 40 en el ordenador). Se vuelve a empezar al cambiar filtros o mes. */
let txN = 0, txK = '';
function txMore(rows){
  const step = matchMedia('(max-width:760px)').matches ? 10 : 40, k = JSON.stringify(txf) + finMonth();
  if (k !== txK || !txN) { txK = k; txN = 5; }
  const more = rows.length - txN;
  return rows.slice(0, txN).join('') + (more > 0 ? `<button class="morebtn" data-a="txm">${I('chevron-down')}Ver ${Math.min(step, more)} más${more > step ? ` <span class="mu">· quedan ${more}</span>` : ''}</button>` : '');
}

/* Desglose de una categoría: por concepto, evolución de 6 meses y gastos recurrentes (para revisar bajas). */
function catDetail(c){
  const m = finMonth(), L = S.tx.filter(x => x.t==='g' && x.cat===c && mon(x.date)===m), tot = L.reduce((a,x) => a+x.amt, 0), all = spent(m);
  const g = {}; L.forEach(x => { const k = nt(concept(x)); const e = g[k] = g[k] || {n:concept(x), s:0, c:0, last:'', fx:false, bank:false}; e.s += x.amt; e.c++; if (x.date > e.last) e.last = x.date; if (x.fid) e.fx = true; if (fromBank(x)) e.bank = true; });
  const rows = Object.values(g).sort((a,b) => b.s-a.s);
  const ms = [-5,-4,-3,-2,-1,0].map(i => mAdd(m,i)), hv = ms.map(k => S.tx.filter(x => cntG(x) && x.cat===c && mon(x.date)===k).reduce((a,x) => a+x.amt, 0)), hmax = Math.max(1, ...hv);
  const rec = S.fixed.filter(f => f.t==='g' && f.cat===c && fxLive(f) && !f.once).map(f => ({n:f.name, y:yearly(f), d:fxWhen(f)})).sort((a,b) => b.y-a.y);
  const ry = rec.reduce((a,r) => a+r.y, 0);
  const o = modal(`<h3 class="cdh">${tile(CI[c]||'package', col(c))}<span>${esc(c)}<span class="mu">${mLabel(m)}</span></span></h3>
    <div class="cdk"><div><b>${eur(tot)}</b><span>este mes</span></div><div><b>${all ? Math.round(tot/all*100) : 0}%</b><span>de tu gasto</span></div><div><b>${L.length}</b><span>movimientos</span></div></div>
    <div class="hist">${ms.map((k,i) => `<div title="${mLabel(k)}: ${eur(hv[i])}"><i style="height:${Math.max(3, hv[i]/hmax*100)}%;background:${k===m ? col(c) : 'var(--bd2)'}"></i><span>${MS[+k.slice(5)]}</span></div>`).join('')}</div>
    <h4>Por concepto</h4>${rows.length ? rows.map(r => `<div class="row"><span class="g">${esc(r.n)}<span class="meta">${r.c>1 ? `<span class="mu">${r.c} veces</span>` : ''}<span class="mu">${fd(r.last)}</span>${r.fx ? `<span class="chip">${I('repeat','sm')} fijo</span>` : ''}${r.bank ? `<span class="chip">${I('landmark','sm')} banco</span>` : ''}</span></span><b class="amt">${eur(r.s)}</b></div>`).join('') : empty('Sin gastos este mes.')}
    ${rec.length ? `<h4>Recurrentes · ${eur(ry)}/año <span class="mu">(≈ ${eur(ry/12)}/mes)</span></h4><div class="mu" style="margin-bottom:4px">¿Sigues usando todas? Dar de baja una te ahorra su coste anual.</div>${rec.map(r => `<div class="row"><span class="g">${esc(r.n)}<span class="meta"><span class="mu">${r.d}</span></span></span><span class="amt">${eur(r.y)}<span class="mu">/año</span></span></div>`).join('')}` : ''}
    <div class="acts" style="margin-top:14px"><span class="sp"></span><button class="btn ghost" data-close>Cerrar</button><button class="btn" id="ok">${I('list-checks')} Ver movimientos</button></div>`);
  o.querySelector('#ok').onclick = () => { txf = {...txf, cat:c, t:'g', q:''}; o.remove(); render(); const e = $('#txcard'); if (e) e.scrollIntoView({behavior:'smooth'}); };
}

/* Lista de movimientos con filtros (texto, categoría, periodo y tipo) */
function txListHTML(){
  const m = finMonth(), from = {mes:m+'-01', '3m':mAdd(m,-2)+'-01', anio:m.slice(0,4)+'-01-01', todo:''}[txf.per], to = txf.per==='todo' || txf.per==='anio' ? '9999' : m+'-31', q = nt(txf.q).trim();
  const L = S.tx.filter(x => x.date>=from && x.date<=to && (!txf.cat || x.cat===txf.cat) && (!txf.t || x.t===txf.t) && (!q || nt(x.desc||x.cat).includes(q)))
    .sort((a,b) => b.date.localeCompare(a.date) || (b.id>a.id?1:-1));
  // Posible duplicado: mismo día, importe y tipo, y además uno apuntado a mano junto a otro del banco, o dos a mano con el mismo concepto.
  // Dos movimientos que vienen los dos del banco son filas distintas del banco (p. ej. dos Bizums de 8 €): no se avisan.
  const dupG = {}; S.tx.forEach(x => { const k = x.date+'|'+x.amt+'|'+x.t; (dupG[k] = dupG[k] || []).push(x); });
  const isDup = x => !x.notDup && (dupG[x.date+'|'+x.amt+'|'+x.t] || []).some(y => y !== x && !y.notDup &&
    (fromBank(x) !== fromBank(y) || (!fromBank(x) && nt(x.desc||'') === nt(y.desc||''))));
  const g = L.filter(x => x.t==='g' && x.cat!==NOCNT).reduce((a,x) => a+x.amt, 0), i = L.filter(x => x.t==='i' && x.cat!==NOCNT).reduce((a,x) => a+x.amt, 0);
  const on = txf.q || txf.cat || txf.t || txf.per!=='mes';
  let lastD = '';
  const rows = L.map(x => { const h = x.date!==lastD ? `<div class="dh">${x.date===TD()?'Hoy':fd(x.date)}</div>` : ''; lastD = x.date;
    return h + `<div class="row">${tile(CI[x.cat]||'package', col(x.cat))}<span class="g"><button class="link txl" data-a="etx" data-i="${x.id}" title="Editar movimiento">${esc(x.desc||x.cat)}</button><span class="meta">${x.note?`<span class="mu">${I('file-text','sm')} ${esc(x.note)}</span>`:''}<select class="sel" data-a="txc" data-i="${x.id}" aria-label="Categoría">${opts(x.t==='i'?['Nómina','Otros','Traspasos']:CATS.filter(c => c!=='Nómina'),x.cat)}</select>${x.card?`<span class="chip">${I('credit-card','sm')} prepago</span>`:x.bank||x.xls?`<span class="chip">${I('landmark','sm')} banco</span>`:''}${x.billId?'<span class="chip">factura</span>':x.fid?`<span class="chip">${I('repeat','sm')} fijo</span>`:''}${x.t!=='g'?'':x.enc?`<button class="chip ok" data-a="txen" data-i="${x.id}" title="Encargo para otra persona: no cuenta como gasto tuyo · toca para que cuente">${I('hand-coins','sm')} encargo</button>`:x.ex?`<button class="chip wa" data-a="txex" data-i="${x.id}" title="Se ve, pero no cuenta en el gasto del mes ni en las comparaciones · toca para que cuente">${I('sparkles','sm')} extraordinario</button>`:x.amt>=EXMIN?`<button class="chip" data-a="txex" data-i="${x.id}" title="Marcar como gasto extraordinario: se verá, pero no contará en el gasto del mes ni en las comparaciones">¿extraordinario?</button>`:''}${isDup(x)?`<button class="chip wa" data-a="nodup" data-i="${x.id}" title="Toca si no es un duplicado para quitar el aviso">${I('triangle-alert','sm')} ¿duplicado?</button>`:''}</span></span><span class="amt ${x.t==='i'?'ok':'neg'}">${x.t==='i'?'+':'−'}${eur(x.amt)}</span>${x.billId?'':`<button class="ib ${x.fid?'pin':''}" data-a="mkf" data-i="${x.id}" aria-label="${x.fid?'Quitar de Facturas':'Añadir a Facturas'}" title="${x.fid?'Está en Facturas · toca para quitarlo':'Añadir a Facturas (se repite cada mes)'}">${I('repeat')}</button>`}<button class="ib" data-a="dx" data-i="${x.id}" aria-label="Eliminar">${I('x')}</button></div>`; });
  const pl = finOff || on ? [] : pendList();
  const prow = pl.map(p => `<div class="row is-pend">${tile('clock','var(--mu)')}<span class="g">${esc(cleanDesc(p.description))}<span class="meta"><span class="mu">${fd(p.booking_date)}</span><span class="chip wa">${I('clock','sm')} pendiente en el banco</span></span></span><span class="amt ${p.amount>0?'ok':'neg'}">${p.amount>0?'+':'−'}${eur(Math.abs(p.amount))}</span></div>`).join('');
  return `<div class="txsum"><span>${L.length} movimiento${L.length===1?'':'s'}</span>${g?`<b class="neg">−${eur(g)}</b>`:''}${i?`<b class="ok">+${eur(i)}</b>`:''}${on?`<a href="#" data-a="txr">Quitar filtros</a>`:''}</div>`
    + (prow ? `<div class="dh">Pendientes de confirmar · se añadirán solos cuando el banco los cierre</div>${prow}` : '')
    + (rows.length ? txMore(rows) : empty('No hay movimientos con estos filtros.'));
}
/* Pendientes del banco que no estén ya apuntados a mano o como fijo (mismo importe, ±4 días). */
const pendList = () => PEND.filter(p => !S.tx.some(x => !fromBank(x) && x.t===(p.amount<0?'g':'i') && Math.abs(x.amt-Math.abs(p.amount))<0.01 && Math.abs(dd(x.date,p.booking_date))<=4));
const txRefresh = () => { const e = $('#txlist'); if (e) e.innerHTML = txListHTML(); };

/* Bandeja «Sin clasificar»: gastos en «Otros» (de cualquier mes) para ponerles categoría de uno en uno.
   «Dejar en Otros» (x.keep) y «Encargo» (x.enc) los sacan de la bandeja. Sin pendientes, la tarjeta no se muestra. */
const sincL = () => S.tx.filter(x => x.t==='g' && x.cat==='Otros' && !x.keep && !x.enc).sort((a,b) => b.date.localeCompare(a.date));
function sincCard(){
  const L = sincL();
  if (!L.length) return '';
  return panel('fin','sinc',`${I('inbox')} Sin clasificar <span class="cnt">· ${L.length}</span>`,`<div class="mu" style="margin-bottom:8px">Gastos en «Otros». Elige su categoría (te propondrá crear una regla) o déjalos en «Otros».</div>`
    + fold('sinc', L.map(x => `<div class="row">${tile(CI.Otros||'package', col('Otros'))}<span class="g">${esc(x.desc||'Sin concepto')}<span class="meta"><span class="mu">${fd(x.date)}</span><select class="sel" data-a="txc" data-i="${x.id}" aria-label="Categoría">${opts(CATS.filter(c => c!=='Nómina'), x.cat)}</select><button class="chip" data-a="txk" data-i="${x.id}" title="Está bien en «Otros»: quitar de esta bandeja">Dejar en Otros</button><button class="chip" data-a="txen" data-i="${x.id}" title="Compra para otra persona que te paga en mano: no cuenta como gasto tuyo">${I('hand-coins','sm')} Encargo</button></span></span><span class="amt neg">−${eur(x.amt)}</span></div>`), 5));
}

function vFin(){
  const now = new Date(), base = new Date(now.getFullYear(), now.getMonth()+finOff, 1), m = MN(base), pm = MN(new Date(base.getFullYear(), base.getMonth()-1, 1));
  const txm = S.tx.filter(x => mon(x.date)===m);
  const incL = income(m), inc = incL.reduce((a,x) => a+x.amt, 0), sp = spent(m), ps = spent(pm), cats = byCat(m), mx = Math.max(1, ...cats.map(c => c[1]));
  const ml = mLabel(m);
  return `<div class="hdr"><div><h2>Finanzas</h2><div class="sub">${user&&BANK&&BANK.session_id?`${I('landmark','sm')} Conectado al banco · ${ago(BANK.last_sync)}`:'Movimientos manuales, fijos e importados'}</div></div><div class="hact"><button class="btn ghost sm ico" data-a="fm" data-i="-1" aria-label="Mes anterior">${I('chevron-left')}</button><b style="min-width:130px;text-align:center">${ml}</b><button class="btn ghost sm ico" data-a="fm" data-i="1" aria-label="Mes siguiente" ${finOff>=0?'disabled style="opacity:.4"':''}>${I('chevron-right')}</button><button class="btn" data-a="nx">${I('plus')} Movimiento</button></div></div>
  <div class="kpis">
    <div class="kpi"><span class="k">${I('arrow-up-right')} Ingresos</span><span class="v ok">${eur(inc)}</span><span class="d">${incL.length} movimientos</span></div>
    <div class="kpi"><span class="k">${I('arrow-down-left')} Gastos</span><span class="v">${eur(sp)}</span><span class="d ${sp>ps?'wa':'ok'}">${I(sp>ps?'trending-up':'trending-down','sm')} ${eur(Math.abs(sp-ps))} vs mes anterior</span></div>
    <div class="kpi"><span class="k">${I('scale')} Balance</span><span class="v ${inc-sp<0?'er':'ok'}">${eur(inc-sp)}</span><span class="d">ingresos − gastos</span></div>
    <div class="kpi"><span class="k">${I('target')} Tope mensual</span><span class="v">${eur(S.budget)}</span><span class="d"><a href="#" data-a="eb2">cambiar</a></span></div>
  </div>
  ${(() => { const C = {
    gasto: panel('fin','gasto',`${I('wallet')} Gasto del mes`,gastoHTML(m,false),'wide'),
    cats: panel('fin','cats',`${I('tags')} Por categoría`,cats.map(([c,v]) => { const n = txm.filter(x => x.t==='g' && x.cat===c).length; return `<button class="catrow" data-a="cd" data-i="${esc(c)}">${tile(CI[c]||'package', col(c))}<span>${c}<span class="mu" style="display:block;font-size:12px;line-height:1.2">${n} mov. · ${Math.round(v/sp*100)}% del gasto</span></span><b class="amt">${eur(v)}</b>${I('chevron-right','cr')}<div class="bar"><div style="width:${v/mx*100}%;background:${col(c)}"></div></div></button>`; }).join('') || empty('Sin gastos este mes.')),
    mov: panel('fin','mov',`${I('list-checks')} Movimientos`,`<span id="txcard"></span>
    <div class="txf"><input id="txq" class="in" type="search" placeholder="Buscar concepto…" value="${esc(txf.q)}" aria-label="Buscar en movimientos"><select class="in" data-a="txfc" aria-label="Categoría"><option value="">Todas las categorías</option>${CATS.map(c => `<option ${txf.cat===c?'selected':''}>${c}</option>`).join('')}</select><select class="in" data-a="txfp" aria-label="Periodo">${[['mes',ml],['3m','Últimos 3 meses'],['anio','Año '+m.slice(0,4)],['todo','Todo']].map(([k,n]) => `<option value="${k}" ${txf.per===k?'selected':''}>${n}</option>`).join('')}</select><div class="seg">${[['','Todos'],['g','Gastos'],['i','Ingresos']].map(([k,n]) => `<button class="${txf.t===k?'on':''}" data-a="txft" data-i="${k}">${n}</button>`).join('')}</div></div>
    <div id="txlist">${txListHTML()}</div>`,'wide'),
    bank: bankCard('fin'), reglas: rulesCard(), sinc: sincCard() };
    // En el móvil la tarjeta del banco solo está en Ajustes.
    VIS.fin = ord('fin', FIN.filter(k => C[k] && !(k==='bank' && matchMedia('(max-width:760px)').matches)));
    return `<div class="grid">${VIS.fin.map(k => C[k]).join('')}</div>`; })()}`;
}

function vInv(){
  const C = {ahorro: savCard()};
  VIS.inv = ord('inv', ['ahorro']);
  return `<div class="hdr"><div><h2>Inversiones</h2><div class="sub">Tus ahorros y lo que rinden · los importes se muestran con el ojo</div></div></div>
  <div class="grid">${VIS.inv.map(k => C[k]).join('')}</div>`;
}

