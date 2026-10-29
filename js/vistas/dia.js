'use strict';
/* Sección «Mi día». */
/* ---------- vistas ---------- */
function vDia(){
  const now = new Date(), h = now.getHours(), g = h<6?'Buenas noches':h<13?'Buenos días':h<21?'Buenas tardes':'Buenas noches', td = TD(), open = S.tasks.filter(t => !t.done);
  const tt = open.filter(t => t.due && t.due<=td).sort((a,b) => (a.due+(a.tm||'')).localeCompare(b.due+(b.tm||''))), late = tt.filter(t => t.due<td).length, inbox = open.filter(t => !t.due).length;
  // Móvil: «Mi día» más corta. En Próximos no se repite lo que ya sale en «Lo más importante» (mañana y facturas).
  const mob = matchMedia('(max-width:760px)').matches;
  const up = [...open.filter(t => t.due && dayDiff(t.due)>(mob?1:0) && dayDiff(t.due)<=14).map(t => [t.due+(t.tm||''), taskRow(t)]), ...(mob ? [] : fxDue(14).filter(o => dayDiff(o.d)>0).map(o => [o.d, fxRow(o)])),
    ...[...new Set([td.slice(0,4), addD(td,14).slice(0,4)])].flatMap(y => holidays(+y)).filter(h => dayDiff(h.d)>=0 && dayDiff(h.d)<=14).map(h => [h.d, holRow(h)]),
    ...S.periods.filter(p => dayDiff(p.to)>=0 && dayDiff(p.from)<=14).map(p => [p.from, perRow(p)])].sort((a,b) => a[0].localeCompare(b[0]));
  const imp = [...open.filter(t => t.due && dayDiff(t.due)<=1).map(t => [t.due, ico(t), t.title, AC[t.area], t.id]), ...fxDue(7).map(o => [o.d, 'receipt', o.f.name+' · '+eur(o.f.amt), col(o.f.cat)]), ...S.docs.filter(d => d.exp && dayDiff(d.exp)<=30).map(d => [d.exp, DI[d.cat]||'file-text', 'Vence: '+d.name, DCOL[d.cat]]), ...bankAlerts()].sort((a,b) => a[0].localeCompare(b[0]));
  const bills = fxDue(30), btot = bills.reduce((a,o) => a+o.f.amt, 0), b7 = bills.filter(o => dayDiff(o.d)<=7);
  const m = MN(now), sp = spent(m), fl = fxLeft(), rem = (S.budget||0) - sp - fl, left = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate() - now.getDate() + 1;
  const P = S.shop.filter(s => !s.done), D = S.shop.length - P.length, pins = S.docs.filter(d => d.pin);
  // Todas las tarjetas se pliegan tocando el título (abiertas por defecto).
  const mp = (k, title, inner, cls) => pfold('dia', k, title, inner, cls), ic = PLG['dia:imp'];
  const C = {
    shop: mp('shop',`${I('shopping-cart')} Lista de la compra <span class="cnt">· ${P.length}</span>`,`<div class="f inl" style="margin-bottom:6px"><input id="hs" placeholder="Añadir… (ej. leche, 2 pan)" aria-label="Añadir a la compra"><button class="btn ico" data-a="hs" aria-label="Añadir">${I('plus')}</button><button class="btn ghost ico" data-a="vs" aria-label="Dictar">${I('mic')}</button></div>${P.length?fold('d-shop', P.map(s => `<div class="row"><input type="checkbox" class="ck" data-a="ts" data-i="${s.id}" aria-label="Comprado"><button class="link g" data-a="es" data-i="${s.id}" title="Editar">${esc(s.name)} ${s.qty>1?`<span class="mu">×${s.qty}</span>`:''}</button></div>`), 8):empty('Lista vacía')}<div class="more mu">${D?D+' comprados · ':''}<a href="#" data-a="go" data-i="compra">Ver lista completa</a></div>`),
    prox: mp('prox',`${I('calendar-clock')} Próximos 14 días`,up.length?fold('d-prox', up.map(x => x[1]), 6):empty('Nada en las próximas dos semanas.')),
    cal: mp('cal',`${I('calendar-days')} Calendario`,calHTML()),
    fact: mp('fact',`${I('receipt')} Facturas próximos 30 días${btot?` <span class="cnt">· ${eur(btot)}</span>`:''}`,(bills.length?bills.slice(0,5).map(fxRow).join(''):empty('Nada en los próximos 30 días.'))+'<div class="more mu"><a href="#" data-a="go" data-i="fact">Gestionar facturas</a></div>'),
    gasto: mp('gasto',`${I('wallet')} Gasto del mes`,gastoHTML(m,true)+'<div class="more mu"><a href="#" data-a="go" data-i="fin">Ver detalle</a></div>','wide'),
    docs: mp('docs',`${I('folder-open')} Documentos a mano`,(pins.length?`<div class="dtiles">${pins.map(docTile).join('')}</div>`:empty('Marca con la estrella los documentos que quieras tener a mano.'))+'<div class="more mu"><a href="#" data-a="go" data-i="docs">Ver todos los documentos</a></div>')
  };
  VIS.dia = ord('dia', DIA);
  return `<div class="hdr"><div><h2>${g}${S.name?', '+esc(S.name):''}</h2><div class="sub">${cap(new Intl.DateTimeFormat('es-ES',{weekday:'long',day:'numeric',month:'long'}).format(now))}</div></div></div>
  <div class="kpis">
    <button class="kpi" data-a="go" data-i="tareas"><span class="k">${I('list-checks')} Para hoy</span><span class="v">${tt.length}</span><span class="d ${late?'er':''}">${late?late+' atrasada'+(late>1?'s':''):'todo en orden'}</span></button>
    <button class="kpi" data-a="go" data-i="fin"><span class="k">${I('wallet')} Disponible</span><span class="v ${rem<0?'er':''}">${eur(rem)}</span><span class="d">≈ ${eur(Math.max(0,rem)/left)}/día${fl?` · tras ${eur(fl)} de facturas`:''}</span></button>
    <button class="kpi" data-a="go" data-i="fact"><span class="k">${I('receipt')} Facturas 7 días</span><span class="v ${b7.length?'wa':''}">${b7.length}</span><span class="d">${b7.length?eur(b7.reduce((a,o) => a+o.f.amt,0)):'nada a la vista'}</span></button>
    <button class="kpi" data-a="go" data-i="compra"><span class="k">${I('shopping-cart')} Compra</span><span class="v">${P.length}</span><span class="d">${P.length===1?'producto':'productos'} pendientes</span></button>
  </div>
  ${imp.length?`<div class="card hl ${ic?'mc':''}"><h3>${foldBtn('dia:imp', `${I('sparkles')} Lo más importante`)}</h3>${ic?'':imp.map(([d,n,t,c,ti]) => `<div class="row">${ti?`<input type="checkbox" class="ck" data-a="tt" data-i="${ti}" aria-label="Completar «${esc(t)}»">`:''}${tile(n,c)}<span class="g">${esc(t)}</span><span class="chip ${dayDiff(d)<0?'er':'wa'}">${rel(d)}</span></div>`).join('')}</div>`:''}
  <div class="grid">${VIS.dia.map(k => C[k]).join('')}</div>`;
}

