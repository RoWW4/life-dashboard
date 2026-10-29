'use strict';
/* Ventanas para añadir y editar: tareas, movimientos, compra, Facturas, vacaciones y documentos. */
/* ---------- formularios en modal ---------- */
function taskForm(t){
  const n = !t; t = t || {title:'',due:'',tm:'',pr:'Media',area:'Personal',rep:''};
  const o = modal(`<h3>${n?'Nueva tarea':'Editar tarea'}</h3><div class="fs"><label>Título<input id="ft1" value="${esc(t.title)}" placeholder="¿Qué hay que hacer?"></label><div class="two"><label>Fecha<input id="ft2" type="date" value="${t.due||''}"></label><label>Hora<input id="ft3" type="time" value="${t.tm||''}"></label></div><div class="two"><label>Prioridad<select id="ft4">${opts(PR,t.pr)}</select></label><label>Área<select id="ft5">${opts(AREAS,t.area)}</select></label></div><label>Repetir<select id="ft6"><option value="">No se repite</option>${opts(REP,t.rep)}</select></label></div><div class="acts">${n?'':'<button class="btn ghost danger" id="fdel">Eliminar</button>'}<span class="sp"></span><button class="btn ghost" data-close>Cancelar</button><button class="btn" id="ok">${n?'Añadir':'Guardar'}</button></div>`);
  const v = i => o.querySelector(i).value.trim();
  o.querySelector('#ok').onclick = () => {
    const d = {title:v('#ft1'), due:v('#ft2'), tm:v('#ft3'), pr:v('#ft4'), area:v('#ft5'), rep:v('#ft6')};
    if (!d.title) return toast('Escribe un título');
    if (n) { if (S.tasks.some(x => !x.done && x.title.toLowerCase()===d.title.toLowerCase() && x.due===d.due)) return toast('Ya existe esa tarea'); S.tasks.push({id:id(), ...d, done:false}); }
    else Object.assign(t, d);
    o.remove(); ch(); toast(n ? '✅ Tarea añadida' : 'Guardado');
  };
  const del = o.querySelector('#fdel'); if (del) del.onclick = () => { o.remove(); A.dt(t.id); };
  o.querySelector('#ft1').focus();
}
function txForm(){
  const o = modal(`<h3>Nuevo movimiento</h3><div class="fs"><div class="seg" id="ftt"><button class="on" data-t="g">${I('arrow-down-left','sm')} Gasto</button><button data-t="i">${I('arrow-up-right','sm')} Ingreso</button></div><div class="two"><label>Importe (€)<input id="fx2" inputmode="decimal" placeholder="0,00"></label><label>Fecha<input id="fx4" type="date" value="${TD()}"></label></div><label>Descripción<input id="fx5" placeholder="Ej. Mercadona"></label><label>Categoría<select id="fx3">${opts(CATS,'Otros')}</select></label></div><div class="acts"><span class="sp"></span><button class="btn ghost" data-close>Cancelar</button><button class="btn" id="ok">Añadir</button></div>`);
  let t = 'g', touched = false;
  o.querySelectorAll('#ftt button').forEach(b => b.onclick = () => { t = b.dataset.t; o.querySelectorAll('#ftt button').forEach(x => x.classList.toggle('on', x===b)); if (!touched) o.querySelector('#fx3').value = t==='i' ? 'Nómina' : classify(o.querySelector('#fx5').value); });
  o.querySelector('#fx3').onchange = () => touched = true;
  o.querySelector('#fx5').oninput = e => { if (!touched) o.querySelector('#fx3').value = classify(e.target.value, t); };
  o.querySelector('#ok').onclick = () => {
    const a = pnum(o.querySelector('#fx2').value), dt = o.querySelector('#fx4').value;
    if (!(a > 0) || !dt) return toast('Introduce un importe válido y una fecha');
    S.tx.push({id:id(), t, amt:a, cat:o.querySelector('#fx3').value, date:dt, desc:o.querySelector('#fx5').value.trim()});
    o.remove(); ch(); toast('💶 Movimiento añadido');
  };
  o.querySelector('#fx2').focus();
}
/* Ficha de un movimiento: descripción, categoría, nota y «extraordinario». Los del banco no dejan cambiar importe ni fecha. */
function txEdit(x){
  const bk = fromBank(x), cats = x.t==='i' ? ['Nómina','Otros','Traspasos'] : CATS.filter(c => c!=='Nómina');
  const o = modal(`<h3>Editar ${x.t==='i'?'ingreso':'gasto'}</h3><div class="fs"><label>Descripción<input id="ex1" value="${esc(x.desc||'')}"></label><div class="two"><label>Importe (€)<input id="ex2" inputmode="decimal" value="${(+x.amt).toFixed(2).replace('.',',')}" ${bk?'disabled':''}></label><label>Fecha<input id="ex3" type="date" value="${x.date}" ${bk?'disabled':''}></label></div>${bk?`<div class="mu" style="margin-top:-4px">${I('landmark','sm')} Viene del banco: el importe y la fecha no se pueden cambiar.</div>`:''}<label>Categoría<select id="ex4">${opts(cats, x.cat)}</select></label><label>Nota<input id="ex5" value="${esc(x.note||'')}" placeholder="Opcional"></label>${x.t==='g'?`<label class="chk"><input type="checkbox" id="ex6" ${x.ex?'checked':''}> Gasto extraordinario <span class="mu">(se ve, pero no cuenta en el gasto del mes)</span></label>`:''}</div><div class="acts"><button class="btn ghost danger" id="fdel">Eliminar</button><span class="sp"></span><button class="btn ghost" data-close>Cancelar</button><button class="btn" id="ok">Guardar</button></div>`);
  const v = i => o.querySelector(i).value.trim();
  o.querySelector('#ok').onclick = () => {
    const a = pnum(v('#ex2')), dt = v('#ex3'), cat = v('#ex4');
    if (!bk && (!(a > 0) || !dt)) return toast('Introduce un importe válido y una fecha');
    x.desc = v('#ex1'); if (!bk) { x.amt = a; x.date = dt; }
    const nt0 = v('#ex5'); if (nt0) x.note = nt0; else delete x.note;
    const ex = o.querySelector('#ex6'); if (ex && ex.checked) x.ex = true; else delete x.ex;
    o.remove();
    if (cat !== x.cat) A.txc(x.id, {value:cat}); else ch();
    toast('Guardado');
  };
  o.querySelector('#fdel').onclick = () => { o.remove(); A.dx(x.id); };
  o.querySelector('#ex1').focus();
}
function shopForm(){
  const o = modal(`<h3>Añadir a la compra</h3><div class="fs"><label>Productos (separa con comas)<input id="sh1" placeholder="leche, 2 pan, tomates"></label></div><div class="acts"><span class="sp"></span><button class="btn ghost" data-close>Cancelar</button><button class="btn" id="ok">Añadir</button></div>`);
  o.querySelector('#ok').onclick = () => { const n = addShop(o.querySelector('#sh1').value); o.remove(); ch(); toast('🛒 '+n+' producto(s) añadidos'); };
  o.querySelector('#sh1').focus();
}
function shopEdit(s){
  const o = modal(`<h3>Editar producto</h3><div class="fs"><label>Nombre<input id="se1" value="${esc(s.name)}"></label><div class="two"><label>Cantidad<input id="se2" type="number" min="1" value="${s.qty||1}"></label><label>Precio/ud (€)<input id="se3" inputmode="decimal" value="${s.price||''}" placeholder="Opcional"></label></div></div><div class="acts"><button class="btn ghost danger" id="fdel">Eliminar</button><span class="sp"></span><button class="btn ghost" data-close>Cancelar</button><button class="btn" id="ok">Guardar</button></div>`);
  o.querySelector('#ok').onclick = () => { const n = o.querySelector('#se1').value.trim(); if (!n) return toast('Escribe el nombre'); Object.assign(s, {name:cap(n), qty:Math.max(1, +o.querySelector('#se2').value||1), price:pnum(o.querySelector('#se3').value)||0}); o.remove(); ch(); };
  o.querySelector('#fdel').onclick = () => { o.remove(); A.ds(s.id); };
  o.querySelector('#se1').focus();
}
/* Alta y edición de un pago o ingreso de Facturas. */
function fixedForm(f, isNew){
  const fq = fxFq(f), opt = (L, v) => L.map(([k,n]) => `<option value="${k}" ${String(k)===String(v)?'selected':''}>${n}</option>`).join('');
  const o = modal(`<h3>${isNew?'Nueva factura o pago':'Editar'}</h3><div class="fs"><label>Nombre<input id="ff1" value="${esc(f.name)}" placeholder="Ej. Gimnasio, Seguro coche…"></label>
    <div class="two"><label>Importe (€)<input id="ff2" inputmode="decimal" value="${f.amt||''}"></label><label>Tipo<select id="ff0">${opt([['g','Gasto'],['i','Ingreso']], f.t)}</select></label></div>
    <div class="two"><label>Se repite<select id="ff6">${opts(['Mensual','Trimestral','Semestral','Anual','Única','Variable'], fq)}</select></label><label>Categoría<select id="ff4">${opts(CATS, f.cat)}</select></label></div>
    <div class="two"><label class="r-d">Día del mes<input id="ff3" value="${f.days ? f.days.join(', ') : f.day||1}"></label><label class="r-m">Mes<select id="ff7">${opt(MS.slice(1).map((n,i) => [i+1, n]), f.month||+TD().slice(5,7))}</select></label><label class="r-o">Fecha<input id="ff8" type="date" value="${f.once||''}"></label></div>
    <div class="mu r-v">Variable: varios cargos al mes sin día fijo (p. ej. gasolina). Pon en Importe lo que sueles gastar al mes; se juntan todos los cargos del banco con este nombre.</div>
    <label class="r-f">Empieza en<input id="ff5" type="month" value="${f.from||''}"></label>
    <div class="mu">Mientras no llegue el mes de inicio sale como previsto y no cuenta como gasto. Vacío = ya se está cobrando. Cuando llega el cargo del banco se marca como pagado solo.</div></div><div class="acts">${isNew?'':`<button class="btn ghost" data-a="df" data-i="${f.id}">${I('trash-2')} Quitar</button>`}<span class="sp"></span><button class="btn ghost" data-close>Cancelar</button><button class="btn" id="ok">Guardar</button></div>`);
  const v = s => o.querySelector(s).value.trim(), sh = () => { const q = v('#ff6'); o.querySelector('.r-d').hidden = q==='Única' || q==='Variable'; o.querySelector('.r-m').hidden = q!=='Anual'; o.querySelector('.r-o').hidden = q!=='Única'; o.querySelector('.r-f').hidden = q==='Única'; o.querySelector('.r-v').hidden = q!=='Variable'; };
  o.querySelector('#ff6').onchange = sh; sh();
  o.querySelectorAll('[data-a="df"]').forEach(b => b.addEventListener('click', () => o.remove()));
  o.querySelector('#ok').onclick = () => {
    const q = v('#ff6'), n = v('#ff1'), a = pnum(v('#ff2')), ds = v('#ff3').split(/[^\d]+/).map(Number).filter(d => d>=1 && d<=31), fr = q==='Única' ? '' : v('#ff5');
    if (!n || !(a>0)) return toast('Indica nombre e importe');
    if (q!=='Variable' && (q==='Única' ? !v('#ff8') : !ds.length)) return toast(q==='Única' ? 'Indica la fecha' : 'Indica el día del mes');
    // Movimientos apuntados a mano antes del nuevo inicio (los del banco no se tocan).
    const old = fr && !isNew ? S.tx.filter(x => x.fid===f.id && !fromBank(x) && mon(x.date) < fr) : [];
    const done = () => {
      ['day','days','month','every','once','from','var'].forEach(k => delete f[k]);
      Object.assign(f, {name:n, amt:a, t:v('#ff0'), cat:v('#ff4')});
      if (q==='Variable') { f.var = true; if (fr) f.from = fr; if (!f.k) f.k = nt(n).trim();
        // Los cargos del banco de los últimos meses con ese concepto quedan enlazados.
        S.tx.forEach(x => { if (!x.fid && fromBank(x) && x.t===f.t && x.date >= mAdd(MN(new Date()),-5)+'-01' && nt(concept(x)).includes(' '+f.k+' ')) x.fid = f.id; }); }
      else if (q==='Única') { f.once = v('#ff8'); f.from = mon(f.once); }
      else { if (ds.length > 1) f.days = ds; else f.day = ds[0];
        if (q==='Anual') f.month = +v('#ff7');
        if (FQ[q]===3 || FQ[q]===6) f.every = FQ[q];
        const st = fr || (f.every ? MN(new Date()) : ''); if (st) f.from = st; }
      if (old.length) { const ids = new Set(old.map(x => x.id)); S.tx = S.tx.filter(x => !ids.has(x.id)); }
      if (isNew) S.fixed.push(f);
      o.remove(); ch(); };
    if (old.length) CF(`Se quitarán ${old.length} pago${old.length>1?'s':''} de «${f.name}» anterior${old.length>1?'es':''} a ${MS[+fr.slice(5)]} ${fr.slice(0,4)} que marcaste a mano (${eur(old.reduce((q,x) => q+x.amt, 0))}). ¿Seguir?`, done);
    else done();
  };
  o.querySelector('#ff1').focus();
}
/* Lleva un movimiento a Facturas: los anteriores con el mismo concepto quedan enlazados y los siguientes
   del banco se enlazarán solos. */
function makeFixed(x){
  const o = modal(`<h3>Añadir a Facturas</h3><div class="fs"><label>Nombre<input id="mf1" value="${esc(concept(x))}"></label><div class="two"><label>Importe (€)<input id="mf2" inputmode="decimal" value="${x.amt}"></label><label>Día del mes<input id="mf3" type="number" min="1" max="31" value="${+x.date.slice(8)}"></label></div><label>Se repite<select id="mf4"><option value="m">Cada mes</option><option value="a">Cada año (en ${MS[+x.date.slice(5,7)]})</option></select></label><div class="mu">Saldrá en Facturas. Cuando llegue el próximo cargo del banco se marcará como pagado solo.</div></div><div class="acts"><span class="sp"></span><button class="btn ghost" data-close>Cancelar</button><button class="btn" id="ok">Guardar</button></div>`);
  o.querySelector('#ok').onclick = () => {
    const n = o.querySelector('#mf1').value.trim(), a = pnum(o.querySelector('#mf2').value), d = Math.min(31, Math.max(1, +o.querySelector('#mf3').value||1)), an = o.querySelector('#mf4').value==='a';
    if (!n || !(a>0)) return toast('Indica nombre e importe');
    const k = nt(concept(x)).trim(), f = {id:'fx-'+id(), name:n, t:x.t, amt:a, cat:x.cat, day:d, from:mon(x.date), k, ...(an?{month:+x.date.slice(5,7)}:{})};
    S.tx.forEach(y => { if (y===x || (!y.fid && y.t===x.t && nt(concept(y)).trim()===k)) y.fid = f.id; });
    S.fixed.push(f); o.remove(); ch(); toast('🔁 Añadido a Facturas');
  };
  o.querySelector('#mf1').focus();
}
function addPicker(){
  const o = modal(`<h3>¿Qué quieres añadir?</h3><div class="pick"><button data-k="t">${tile('list-checks','#0099ff')}Tarea</button><button data-k="x">${tile('wallet','#2fcf7a')}Movimiento</button><button data-k="s">${tile('shopping-cart','#f5a524')}Compra</button><button data-k="d">${tile('file-text','#a78bfa')}Documento</button><button data-k="v">${tile('sun','#2fcf7a')}Vacaciones</button></div>`);
  o.querySelectorAll('.pick button').forEach(b => b.onclick = () => ({t:() => taskForm(), x:txForm, s:shopForm, d:() => docForm(), v:vacForm})[b.dataset.k]());
}
/* Vacaciones o días libres: se ven con fondo verde en el calendario (S.periods). */
function addVac(name, from, to){
  if (S.periods.some(p => p.from===from && p.to===to)) return toast('Ese periodo ya está apuntado');
  S.periods.push({id:id(), name, from, to}); ch();
  toast('🌴 ' + name + (from===to ? ' · ' + dlabel(from) : ' · ' + fd(from) + ' → ' + fd(to)));
}
function vacForm(){
  const o = modal(`<h3>Vacaciones o días libres</h3><div class="fs"><label>Nombre<input id="fv1" value="Vacaciones"></label><div class="two"><label>Desde<input id="fv2" type="date" value="${TD()}"></label><label>Hasta<input id="fv3" type="date" value="${TD()}"></label></div><div class="mu">Para un solo día, pon la misma fecha en los dos. Se marcarán en verde en el calendario.</div></div><div class="acts"><span class="sp"></span><button class="btn ghost" data-close>Cancelar</button><button class="btn" id="ok">Añadir</button></div>`);
  const v = i => o.querySelector(i).value.trim(), a = o.querySelector('#fv2'), b = o.querySelector('#fv3');
  a.onchange = () => { if (!b.value || b.value < a.value) b.value = a.value; };
  o.querySelector('#ok').onclick = () => {
    if (!v('#fv1') || !v('#fv2') || !v('#fv3')) return toast('Indica nombre, desde y hasta');
    if (v('#fv3') < v('#fv2')) return toast('La fecha final es anterior a la inicial');
    o.remove(); addVac(v('#fv1'), v('#fv2'), v('#fv3'));
  };
}
function docForm(d){
  const n = !d; d = d || {name:'',cat:'Otros',url:'',notes:'',exp:''};
  const o = modal(`<h3>${n?'Nuevo documento':'Editar documento'}</h3><div class="fs"><label>Nombre<input id="fd1" value="${esc(d.name)}" placeholder="Ej. Póliza seguro coche"></label><div class="two"><label>Carpeta<select id="fd2">${opts(DC,d.cat)}</select></label><label>Vence<input id="fd4" type="date" value="${d.exp||''}"></label></div><label>Enlace (Drive: Compartir → Copiar enlace)<input id="fd3" value="${esc(d.url)}" placeholder="https://drive.google.com/…" inputmode="url"></label><label>Notas<input id="fd5" value="${esc(d.notes)}" placeholder="Aseguradora, dónde está el original…"></label></div><div class="acts"><span class="sp"></span><button class="btn ghost" data-close>Cancelar</button><button class="btn" id="ok">${n?'Añadir':'Guardar'}</button></div>`);
  const v = i => o.querySelector(i).value.trim();
  o.querySelector('#ok').onclick = () => {
    let u = v('#fd3'); if (u && !/^https?:\/\//i.test(u)) u = 'https://'+u;
    const x = {name:v('#fd1'), cat:v('#fd2'), url:u, notes:v('#fd5'), exp:v('#fd4')};
    if (!x.name) return toast('Indica el nombre');
    if (n) S.docs.push({id:id(), ...x, pin:true}); else Object.assign(d, x);
    o.remove(); ch(); toast(n ? 'Documento añadido' : 'Guardado');
  };
  o.querySelector(!n && !d.url ? '#fd3' : '#fd1').focus();
}

