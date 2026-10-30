'use strict';
/* Secciones «Documentos» y «Ajustes», y pantalla de inicio de sesión. */
function vDocs(){
  const g = {}; S.docs.forEach(d => (g[d.cat] = g[d.cat]||[]).push(d));
  return `<div class="hdr"><div><h2>Documentos</h2><div class="sub help">Enlaces a tus archivos de Drive: se abren con tu cuenta de Google. La estrella los pone a mano en Mi día.</div></div><div class="hact"><a class="btn ghost" href="${esc(gurl('https://drive.google.com/drive/my-drive'))}" target="_blank" rel="noopener noreferrer">${I('hard-drive')} Abrir Drive</a><button class="btn" data-a="nd">${I('plus')} Documento</button></div></div>
  ${S.docs.length?`<div class="grid2">${(VIS.docs = ord('docs', DC.filter(c => g[c]))).map(c => panel('docs',c,`<span style="color:${DCOL[c]}">${I(DI[c])}</span> ${c} <span class="cnt">· ${g[c].length}</span>`,g[c].map(docRow).join(''))).join('')}</div>`:`<div class="card">${empty('Sin documentos todavía.')}</div>`}
  <div class="mu">No guardes aquí números de DNI, contraseñas ni certificados digitales: solo el enlace al archivo.</div>`;
}

function vAjus(){
  const acc = !cloudCfg() ? `<div class="mu">La nube no está configurada: los datos viven solo en este dispositivo. Sigue la guía <b>LEEME.md</b> (pasos 1–4) para verlos también en el móvil.</div>`
    : user ? `<div class="row"><span class="g">Sesión iniciada</span><span class="mu">${esc(user.email)}</span></div><div class="row"><span class="g">Estado</span><span class="mu" id="syncst">${syncTxt}</span></div><div class="f" style="margin:12px 0 0"><button class="btn ghost" style="flex:none" data-a="logout">Cerrar sesión</button></div>`
    : `<div class="mu">Estás usando el panel sin cuenta en este dispositivo.</div><div class="f" style="margin:12px 0 0"><button class="btn" style="flex:none" data-a="cloud">Iniciar sesión y sincronizar</button></div>`;
  return `<div class="hdr"><div><h2>Ajustes</h2><div class="sub help">Apariencia, cuenta, banco y copias de seguridad</div></div></div>
  ${(() => { const C = {
  cuenta: panel('ajus','cuenta',`${I('cloud')} Cuenta y sincronización`,acc),
  apar: panel('ajus','apar',`${I('palette')} Apariencia y dinero`,`<div class="row"><span class="g">Tu nombre (para el saludo)</span><button class="btn sm ghost" data-a="nm">${esc(S.name||'—')} ${I('pencil','sm')}</button></div><div class="row"><span class="g">Tema</span><div class="seg">${[['dark','moon','Oscuro'],['light','sun','Claro'],['blue','droplet','Azul']].map(([k,ic,n]) => `<button class="${S.theme===k?'on':''}" data-a="th" data-i="${k}">${I(ic,'sm')} ${n}</button>`).join('')}</div></div><div class="row barcfg"><span class="g">Barra inferior del móvil<em class="mu">Hasta ${BARMAX}; el resto, en «Más»</em></span><div class="seg">${SEC.map(([k,ic,,s]) => `<button class="${bar().includes(k)?'on':''}" data-a="bar" data-i="${k}" aria-pressed="${bar().includes(k)}">${I(ic,'sm')} ${s}</button>`).join('')}</div></div><div class="row"><span class="g">Moneda</span><select class="in" data-a="cu" aria-label="Moneda">${[['EUR','Euro (€)'],['USD','Dólar ($)'],['GBP','Libra (£)']].map(([k,n]) => `<option value="${k}" ${S.cur===k?'selected':''}>${n}</option>`).join('')}</select></div><div class="row"><span class="g">Tope de gasto mensual</span><button class="btn sm ghost" data-a="eb2">${eur(S.budget)} ${I('pencil','sm')}</button></div><div class="row"><span class="g">Cuenta de Google para abrir documentos</span><button class="btn sm ghost" data-a="gac">${esc(S.gacct||'Preguntar')} ${I('pencil','sm')}</button></div>`),
  bank: bankCard('ajus'),
  copias: panel('ajus','copias',`${I('hard-drive')} Copias de seguridad`,`<div class="mu" style="margin-bottom:10px">Para pasar los datos del artifact antiguo: allí, Ajustes → «Exportar copia (JSON)»; aquí, «Restaurar copia».</div><div class="f" style="margin:0"><button class="btn ghost" style="flex:none" data-a="ex">${I('download')} Exportar copia (JSON)</button><label class="btn ghost" style="flex:none">${I('upload')} Restaurar copia<input type="file" id="im" accept=".json" hidden></label></div>`),
  fest: panel('ajus','fest',`${I('calendar-days')} Festivos y vacaciones`,`
  <div class="row"><span class="g">Festivos de tu comunidad</span><select class="in" data-a="rg" aria-label="Comunidad autónoma">${REGIONS.map(([k,n]) => `<option value="${k}" ${S.region===k?'selected':''}>${n}</option>`).join('')}</select></div>
  <div class="dh">Festivos locales y traslados</div>${S.localHol.slice().sort((a,b) => a.d.localeCompare(b.d)).map(h => `<div class="row"><span class="g">${esc(h.n)} <span class="mu">· ${fd(h.d)}</span></span><button class="ib" data-a="dlh" data-i="${esc(h.d)}" aria-label="Eliminar festivo">${I('x')}</button></div>`).join('') || '<div class="mu">Aún no hay ninguno.</div>'}
  <div class="f" style="margin:8px 0 0"><input id="lh1" placeholder="Nombre (ej. Feria)"><input id="lh2" type="date" aria-label="Fecha del festivo"><button class="btn" data-a="alh">Añadir</button></div>
  <div class="dh">Vacaciones y días libres</div>${S.periods.slice().sort((a,b) => a.from.localeCompare(b.from)).map(p => `<div class="row"><span class="g">${esc(p.name)} <span class="mu">· ${fd(p.from)} → ${fd(p.to)}</span></span><button class="ib" data-a="dpe" data-i="${p.id}" aria-label="Eliminar periodo">${I('x')}</button></div>`).join('') || '<div class="mu">Aún no hay ninguno.</div>'}
  <div class="f" style="margin:8px 0 0"><input id="pe1" placeholder="Nombre (ej. Vacaciones de verano)"><input id="pe2" type="date" aria-label="Desde"><input id="pe3" type="date" aria-label="Hasta"><button class="btn" data-a="ape">Añadir</button></div>`),
  dict: panel('ajus','dict',`${I('mic')} Correcciones del dictado <span class="cnt">· ${S.fixes.length}</span>`,`<div class="mu" style="margin-bottom:8px">Si el dictado entiende mal una palabra (un nombre, una marca…), el panel la cambia sola por la correcta.</div>${S.fixes.map((f,i) => `<div class="row"><span class="g">«${esc(f.from)}» → <b>${esc(f.to)}</b></span><button class="ib" data-a="dfx" data-i="${i}" aria-label="Eliminar corrección">${I('x')}</button></div>`).join('')}
  <div class="f" style="margin:10px 0 0"><input id="fx_a" placeholder="Lo que entiende (ej. mercado na)"><input id="fx_b" placeholder="Lo correcto (ej. Mercadona)"><button class="btn" data-a="afx">Añadir</button></div>`),
  avz: panel('ajus','avz',`${I('eraser')} Avanzado`,`<div class="f" style="margin:0"><button class="btn ghost danger" style="flex:none" data-a="rs">Borrar todo</button></div><div class="mu" style="margin-top:10px">Avisos: internos (resumen de Mi día). Próximamente: hábitos, proyectos y notas.</div>`) };
  VIS.ajus = ord('ajus', AJ);
  return `<div class="grid2">${VIS.ajus.map(k => C[k]).join('')}</div>`; })()}`;
}

function vLogin(){
  return `<div class="login card"><div class="logo"><i><b></b><b></b><b></b><b></b></i></div><h2 style="font-size:22px">${APP}</h2><div class="sub" style="margin-bottom:18px">Inicia sesión para ver tus datos en todos tus dispositivos</div>
  <div class="fs"><label>Email<input id="le" type="email" autocomplete="username" inputmode="email"></label><label>Contraseña<input id="lp" type="password" autocomplete="current-password"></label></div>
  <button class="btn" style="width:100%" data-a="login" id="ok">Entrar</button><button class="btn ghost" style="width:100%;margin-top:8px" data-a="local">Usar sin cuenta en este dispositivo</button></div>`;
}

