'use strict';
/* Sección «Tareas». */
function vTareas(){
  const l = S.tasks.filter(t => (flt==='todas' && !oldDone(t)) || (flt==='pend' ? !t.done : flt==='hecha' ? t.done : (!t.done && t.pr===flt)));
  const so = a => a.sort((x,y) => ((x.due||'9')+(x.tm||'')).localeCompare((y.due||'9')+(y.tm||'')));
  let body = '';
  if (grp === 'area') {
    const g = {}; l.forEach(t => (g[t.area] = g[t.area]||[]).push(t));
    // Áreas ordenadas por su tarea más próxima (las que no tienen fecha y Cumpleaños, al final).
    const near = a => { const d = g[a].filter(t => !t.done && t.due).map(t => t.due).sort()[0]; return a==='Cumpleaños' ? 'z2' : d || 'z1'; };
    // Si se han movido a mano, manda ese orden (S.order.tareas); las áreas nuevas entran en su sitio según la tarea más próxima.
    const keys = VIS.tareas = ord('tareas', Object.keys(g).sort((a,b) => near(a).localeCompare(near(b)) || AREAS.indexOf(a) - AREAS.indexOf(b)));
    // Cada panel enseña sus 5 tareas más próximas (Cumpleaños, solo la siguiente) y se despliega con «Ver más».
    body = `<div class="grid">${keys.map(a => panel('tareas', a, `<span style="color:${AC[a]||'inherit'}">${I(AI[a]||'pin')}</span> ${esc(a)} <span class="cnt">· ${g[a].length}</span>`, fold('a-'+a, so(g[a]).map(taskRow), a==='Cumpleaños'?1:5))).join('')}</div>`;
  } else {
    const B = [['triangle-alert','Atrasadas',t => t.due && dayDiff(t.due)<0],['calendar-clock','Hoy y próximos 7 días',t => t.due && dayDiff(t.due)>=0 && dayDiff(t.due)<=7],['calendar-days','Este mes',t => t.due && dayDiff(t.due)>7 && dayDiff(t.due)<=31],['telescope','Más adelante',t => t.due && dayDiff(t.due)>31],['inbox','Sin fecha (bandeja)',t => !t.due]];
    const G = {}; B.forEach(([ic,n,f]) => { const x = so(l.filter(f)); if (x.length) G[n] = panel('tareasf', n, `${I(ic)} ${n} <span class="cnt">· ${x.length}</span>`, fold('f-'+n, x.map(taskRow), 5)); });
    // VIS.tareas también aquí, para saber si la sección tiene más de un panel (y enseñar el asa).
    VIS.tareas = VIS.tareasf = ord('tareasf', Object.keys(G));
    body = `<div class="grid">${VIS.tareasf.map(n => G[n]).join('')}</div>`;
  }
  const segF = [['pend','Pendientes'],['hecha','Completadas'],['todas','Todas'],['Alta','Alta']];
  return `<div class="hdr"><div><h2>Tareas</h2><div class="sub help">Marca el cuadrado para completar · Toca el título para editar · Las repetitivas generan la siguiente</div></div><button class="btn" data-a="nt">${I('plus')} Nueva tarea</button></div>
  <div class="toolbar one"><div class="seg">${[['area','Por área'],['fecha','Por fecha']].map(([k,n]) => `<button class="${grp===k?'on':''}" data-a="gp" data-i="${k}">${n}</button>`).join('')}</div><div class="seg">${segF.map(([k,n]) => `<button class="${flt===k?'on':''}" data-a="fl" data-i="${k}">${n}</button>`).join('')}</div></div>
  ${body || `<div class="card">${empty('No hay tareas aquí.')}</div>`}`;
}

