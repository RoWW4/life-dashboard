'use strict';
/* Acciones de los botones (data-a) de toda la app. */
/* ---------- acciones ---------- */
const V = i => { const e = document.getElementById(i); return e ? e.value.trim() : ''; };
const A = {
  go: i => { view = i; render(); },
  more: () => { const c = pend(), n = {tareas:c.t, compra:c.s, fact:c.b};
    modal(`<h3>Más secciones</h3><div class="pick">${secs().filter(x => !bar().includes(x[0])).map(([k,e,l]) => `<button data-a="go" data-i="${k}" data-close class="${view===k?'on':''}">${tile(e, view===k?'var(--ac)':'')}${l}${n[k]?` <i class="badge">${n[k]}</i>`:''}</button>`).join('')}</div>`); },
  sd: i => { selD = i; render(); },
  pm: i => { cm = new Date(cm.getFullYear(), cm.getMonth() + +i, 1); render(); },
  fm: i => { finOff = Math.min(0, finOff + +i); render(); },
  mv: i => { const [v,k,d] = i.split('|'), keys = [...(VIS[v]||[])], j = keys.indexOf(k), n = j + +d; if (j<0||n<0||n>=keys.length) return; keys.splice(j,1); keys.splice(n,0,k); S.order[v] = keys; ch(); },
  gp: i => { grp = i; render(); }, fl: i => { flt = i; render(); },
  xp: i => { exp[i] = !exp[i]; if (i==='tx') txRefresh(); else render(); },
  pl: i => { if (PLG[i]) delete PLG[i]; else PLG[i] = 1; try { localStorage.setItem('ldb-fold', JSON.stringify(PLG)); } catch(e) {} render(); },
  cust: () => { cust = !cust; render(); },
  txm: () => { txN += matchMedia('(max-width:760px)').matches ? 10 : 40; txRefresh(); },
  cd: i => { if (view!=='fin') { view = 'fin'; finOff = 0; render(); } catDetail(i); },
  txfc: (i,el) => { txf.cat = el.value; txRefresh(); },
  txfp: (i,el) => { txf.per = el.value; txRefresh(); },
  txft: i => { txf.t = i; render(); },
  txr: () => { txf = {q:'', cat:'', per:'mes', t:''}; render(); },
  add: () => addPicker(), nt: () => taskForm(), nx: () => txForm(),
  et: i => taskForm(S.tasks.find(x => x.id===i)),
  tt: i => { const t = S.tasks.find(x => x.id===i); t.done = !t.done;
    if (t.done && t.rep && t.due) { const nd = nextDue(t.due, t.rep); if (!S.tasks.some(x => !x.done && x.title===t.title && x.due===nd)) { S.tasks.push({id:id(), title:t.title, due:nd, pr:t.pr, area:t.area, rep:t.rep, tm:t.tm||'', done:false}); toast('🔁 Próxima: '+fd(nd)); } }
    ch(); },
  dt: i => CF('¿Eliminar esta tarea definitivamente?', () => { S.tasks = S.tasks.filter(x => x.id!==i); ch(); }),
  as: () => { if (!V('s1')) return toast('Escribe un producto'); S.shop.push({id:id(), name:cap(V('s1')), qty:Math.max(1, +V('s2')||1), price:pnum(V('s3'))||0, done:false}); ch(); $('#s1') && $('#s1').focus(); },
  ts: i => { const s = S.shop.find(x => x.id===i); s.done = !s.done; ch(); },
  es: i => shopEdit(S.shop.find(x => x.id===i)),
  ds: i => { S.shop = S.shop.filter(x => x.id!==i); ch(); },
  cs: () => CF('¿Quitar los productos comprados?', () => { S.shop = S.shop.filter(x => !x.done); ch(); }),
  hs: () => { const n = addShop(V('hs')); if (!n) return toast('Escribe un producto nuevo'); ch(); $('#hs') && $('#hs').focus(); },
  vs: () => listen(t => { const n = addShop(t.replace(/^(?:a la compra|compra)[:,]?\s*/i,'')); ch(); toast('🛒 '+n+' producto(s) añadidos'); }, 'Di los productos, por ejemplo: «leche, dos de pan y tomates».'),
  vm: () => listen(voice, 'Por ejemplo: «compra leche y pan», «gasto 12 en farmacia», «recuérdame llamar al taller el viernes a las 10 en la categoría coche» o «vacaciones del 22 al 26 de diciembre».', preview),
  dx: i => { CF('¿Eliminar este movimiento?', () => { S.tx = S.tx.filter(y => y.id!==i); ch(); }); },
  txc: (i,el) => { const x = S.tx.find(y => y.id===i); x.cat = el.value; ch();
    if (fromBank(x)) { const w = nt(x.desc).trim().split(' ').filter(s => s.length>=3 && !/^(compra|pago|tarjeta|recibo|transferencia|bizum|con|del|las|los)$/.test(s))[0] || '';
      CF(`¿Clasificar siempre como «${x.cat}» los movimientos que contengan esta palabra?`, k => { k = (k||'').trim(); if (!k) return; S.rules = S.rules.filter(r => nt(r.k)!==nt(k)); S.rules.push({k, cat:x.cat}); let c = 0; S.tx.forEach(y => { if (fromBank(y) && y.cat==='Otros' && y.t===x.t && nt(y.desc).includes(nt(k).trim())) { y.cat = x.cat; c++; } }); ch(); toast('🏷️ Regla guardada' + (c ? ' · '+c+' movimientos reclasificados' : '')); }, w); } },
  ar: () => { const k = V('r1'); if (!k) return toast('Escribe una palabra'); S.rules.push({k, cat:V('r2')}); ch(); },
  dr: i => { S.rules.splice(+i,1); ch(); },
  afx: () => { const a = V('fx_a'), b = V('fx_b'); if (!a || !b) return toast('Escribe la palabra mal entendida y la correcta'); S.fixes = S.fixes.filter(f => nt(f.from)!==nt(a)); S.fixes.push({from:a, to:b}); ch(); toast('Corrección guardada'); },
  dfx: i => { S.fixes.splice(+i,1); ch(); },
  rg: (i,el) => { S.region = el.value; ch(); },
  alh: () => { const n = V('lh1'), d = V('lh2'); if (!n || !d) return toast('Indica el nombre y la fecha'); S.localHol = S.localHol.filter(h => h.d!==d); S.localHol.push({d, n}); ch(); },
  dlh: i => { S.localHol = S.localHol.filter(h => h.d!==i); ch(); },
  ape: () => { const n = V('pe1'), a = V('pe2'), b = V('pe3'); if (!n || !a || !b) return toast('Indica nombre, desde y hasta'); if (b < a) return toast('La fecha final es anterior a la inicial'); S.periods.push({id:id(), name:n, from:a, to:b}); ch(); },
  sai: () => { const d = V('sa1') || TD(); if (d > TD()) return toast('La fecha no puede ser futura'); const s = S.salud = S.salud || {ini:[], len:SAL_LEN}; if (s.ini.includes(d)) return toast('Ese día ya está apuntado'); s.ini.push(d); s.ini.sort(); ch(); toast('Apuntado'); },
  sad: i => CF('¿Quitar esta fecha?', () => { S.salud.ini = S.salud.ini.filter(d => d!==i); ch(); }),
  sah: () => { const R = salStats().L.slice().reverse(); modal(`<h3>Histórico · ${R.length}</h3><div class="shist">${R.map((d,i) => `<span>${fd(d)}${R[i+1] ? ` <i>${dd(d, R[i+1])} d</i>` : ''}</span>`).join('')}</div><div class="acts"><span class="sp"></span><button class="btn ghost" data-close>Cerrar</button></div>`); },
  sal: () => { const n = Math.round(+V('sa2')), m = Math.round(+V('sa3')); if (!(n >= 15 && n <= 60)) return toast('Pon un número de días entre 15 y 60'); if (!(m >= 1 && m <= 10)) return toast('Los días marcados van de 1 a 10'); S.salud = {ini:[], ...(S.salud||{}), len:n, dur:m}; ch(); toast('Guardado'); },
  dpe: i => CF('¿Eliminar este periodo?', () => { S.periods = S.periods.filter(p => p.id!==i); ch(); }),
  eb2: () => CF('Tope de gasto mensual (€)', v => { const a = pnum(v); if (!(a>=0)) return toast('Importe no válido'); S.budget = a; ch(); }, String(S.budget||'')),
  ef: i => fixedForm(S.fixed.find(x => x.id===i)),
  savcfg: () => { const s = S.sav || {name:'Cuenta de ahorro', rate:3, tax:SAV_TAX, snaps:[]};
    const o = modal(`<h3>Cuenta de ahorro</h3><div class="fs"><label>Nombre<input id="sc1" value="${esc(s.name)}"></label><div class="two"><label>Interés anual (%)<input id="sc2" inputmode="decimal" value="${String(s.rate).replace('.',',')}"></label><label>Impuestos sobre intereses (%)<input id="sc3" inputmode="decimal" value="${s.tax??SAV_TAX}"></label></div><div class="mu">En España los intereses tributan al 19 % (hasta 6.000 € al año).</div></div><div class="acts">${S.sav?'<button class="btn ghost danger" id="fdel">Quitar</button>':''}<span class="sp"></span><button class="btn ghost" data-close>Cancelar</button><button class="btn" id="ok">Guardar</button></div>`);
    o.querySelector('#ok').onclick = () => { const n = o.querySelector('#sc1').value.trim(), r = pnum(o.querySelector('#sc2').value), t = pnum(o.querySelector('#sc3').value); if (!n || !(r>=0) || !(t>=0)) return toast('Revisa nombre, interés e impuestos'); S.sav = {...s, name:n, rate:r, tax:t}; o.remove(); ch(); };
    const del = o.querySelector('#fdel'); if (del) del.onclick = () => { o.remove(); CF('¿Quitar la tarjeta de ahorros y sus apuntes?', () => { S.sav = null; ch(); }); }; },
  savadd: () => { const d = V('sv1'), b = pnum(V('sv2')), dep = V('sv3') ? pnum(V('sv3')) : 0; if (!d || !(b>=0) || isNaN(dep)) return toast('Indica la fecha y el saldo');
    S.sav.snaps = (S.sav.snaps||[]).filter(x => x.d!==d); S.sav.snaps.push({id:id(), d, bal:b, dep}); ch(); toast('🐷 Saldo actualizado'); },
  saveye: () => { savShow = !savShow; render(); },
  savdel: i => CF('¿Eliminar este apunte?', () => { S.sav.snaps = S.sav.snaps.filter(x => x.id!==i); ch(); }),
  mkf: i => { const x = S.tx.find(y => y.id===i); const f = x.fid && S.fixed.find(y => y.id===x.fid); if (!f) { delete x.fid; return makeFixed(x); }
    CF(`«${f.name}» está en Facturas. ¿Quitarlo de la lista? Los movimientos se conservan.`, () => { S.fixed = S.fixed.filter(y => y.id!==f.id); S.tx.forEach(y => { if (y.fid===f.id) delete y.fid; }); ch(); }); },
  df: i => { const f = S.fixed.find(x => x.id===i); CF(`¿Quitar «${f.name}» de Facturas? Los movimientos se conservan.`, () => { S.fixed = S.fixed.filter(x => x.id!==i); S.tx.forEach(x => { if (x.fid===i) delete x.fid; }); ch(); }); },
  fxn: () => fixedForm({id:'fx-'+id(), name:'', t:'g', amt:0, cat:'Otros', day:+TD().slice(8)}, true),
  fxa: k => { const o = fxDetect().find(y => y.k===k); if (!o) return; const x = o.x;
    const f = {id:'fx-'+id(), name:concept(x), t:'g', amt:x.amt, cat:x.cat, day:+x.date.slice(8), k, from:o.L.reduce((m,y) => mon(y.date) < m ? mon(y.date) : m, mon(x.date))};
    o.L.forEach(y => y.fid = f.id); S.fixed.push(f); ch(); toast('Añadido a Facturas'); },
  fxi: k => { S.fxIgn.push(k); ch(); },
  nd: () => docForm(),
  ed: i => docForm(S.docs.find(x => x.id===i)),
  pd: i => { const d = S.docs.find(x => x.id===i); d.pin = !d.pin; ch(); },
  dd: i => CF('¿Quitar este documento de la lista? (No se borra ningún archivo)', () => { S.docs = S.docs.filter(x => x.id!==i); ch(); }),
  th: i => { S.theme = i; ch(); },
  gac: () => CF('Email de la cuenta de Google con la que abrir los documentos de Drive (déjalo vacío para que Google pregunte)', v => { v = (v||'').trim(); if (v && !/^\S+@\S+\.\S+$/.test(v)) return toast('Email no válido'); S.gacct = v; ch(); }, S.gacct||''),
  nm: () => CF('¿Cómo quieres que te salude el panel?', v => { S.name = (v||'').trim().slice(0,30); ch(); }, S.name||''),
  cu: (i,el) => { S.cur = el.value; ch(); },
  // «No es duplicado»: quita el aviso a todo el grupo (mismo día, importe y tipo).
  etx: i => { const x = S.tx.find(y => y.id===i); if (x) txEdit(x); },
  txk: i => { const x = S.tx.find(y => y.id===i); if (!x) return; x.keep = true; ch(); toast('Se queda en «Otros»'); },
  txen: i => { const x = S.tx.find(y => y.id===i); if (!x) return; x.enc = !x.enc; if (!x.enc) delete x.enc; ch(); toast(x.enc ? 'Marcado como encargo: no cuenta como gasto tuyo' : 'Vuelve a contar en el gasto del mes'); },
  txex: i => { const x = S.tx.find(y => y.id===i); if (!x) return; x.ex = !x.ex; if (!x.ex) delete x.ex; ch(); toast(x.ex ? 'Marcado como extraordinario: ya no cuenta en el gasto del mes' : 'Vuelve a contar en el gasto del mes'); },
  nodup: i => { const x = S.tx.find(y => y.id===i); if (!x) return; S.tx.forEach(y => { if (y.date===x.date && y.amt===x.amt && y.t===x.t) y.notDup = true; }); ch(); toast('Aviso quitado: no es un duplicado'); },
  bar: i => { const b = bar().slice(), k = b.indexOf(i);
    if (k >= 0) { if (b.length === 1) return toast('Deja al menos una pestaña en la barra'); b.splice(k,1); }
    else { if (b.length >= BARMAX) return toast(`Máximo ${BARMAX} pestañas: quita una antes`); b.push(i); }
    S.bar = secs().map(x => x[0]).filter(x => b.includes(x)); ch(); },
  ex: () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(S,null,1)],{type:'application/json'})); a.download = 'life-dashboard-'+TD()+'.json'; a.click(); },
  rs: () => CF('¿Borrar TODOS los datos? No se puede deshacer.', () => { S = def(); ch(); }),
  bsync: async () => { setSync('Comprobando…'); const c = await pull(); render(); toast(c ? 'Actualizado' : 'No hay movimientos nuevos'); },
  login: async () => { const email = V('le'), password = $('#lp').value; if (!email || !password) return toast('Escribe email y contraseña');
    const { data, error } = await sb.auth.signInWithPassword({email, password}); if (error) return toast('Email o contraseña incorrectos');
    user = data.user; $('#m').innerHTML = '<div class="loading">Sincronizando…</div>'; await pull(); afterLoad(); },
  local: () => { try { localStorage.setItem('ldb-local','1'); } catch(e) {} setSync('📱 Solo este dispositivo'); afterLoad(); },
  cloud: () => { try { localStorage.removeItem('ldb-local'); } catch(e) {} location.reload(); },
  logout: () => CF('¿Cerrar sesión? Los datos seguirán guardados en la nube.', async () => { await sb.auth.signOut(); location.reload(); })
};

