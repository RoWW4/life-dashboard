'use strict';
/* Sección «Tareas». */
function vTareas(){
  const l = S.tasks.filter(t => flt==='todas' || (flt==='pend' ? !t.done : flt==='hecha' ? t.done : (!t.done && t.pr===flt)));
  const so = a => a.sort((x,y) => ((x.due||'9')+(x.tm||'')).localeCompare((y.due||'9')+(y.tm||'')));
  let body = '';
  if (grp === 'area') {
    const g = {}; l.forEach(t => (g[t.area] = g[t.area]||[]).push(t));
    // Áreas ordenadas por su tarea más próxima (las que no tienen fecha y Cumpleaños, al final).
    const near = a => { const d = g[a].filter(t => !t.done && t.due).map(t => t.due).sort()[0]; return a==='Cumpleaños' ? 'z2' : d || 'z1'; };
    const keys = Object.keys(g).sort((a,b) => near(a).localeCompare(near(b)) || AREAS.indexOf(a) - AREAS.indexOf(b));
    // Cada panel enseña sus 5 tareas más próximas (Cumpleaños, solo la siguiente) y se despliega con «Ver más».
    body = `<div class="grid2">${keys.map(a => `<div class="card"><h3><span class="t"><span style="color:${AC[a]||'inherit'}">${I(AI[a]||'pin')}</span> ${esc(a)} <span class="cnt">· ${g[a].length}</span></span></h3>${fold('a-'+a, so(g[a]).map(taskRow), a==='Cumpleaños'?1:5)}</div>`).join('')}</div>`;
  } else {
    const B = [['triangle-alert','Atrasadas',t => t.due && dayDiff(t.due)<0],['calendar-clock','Hoy y próximos 7 días',t => t.due && dayDiff(t.due)>=0 && dayDiff(t.due)<=7],['calendar-days','Este mes',t => t.due && dayDiff(t.due)>7 && dayDiff(t.due)<=31],['telescope','Más adelante',t => t.due && dayDiff(t.due)>31],['inbox','Sin fecha (bandeja)',t => !t.due]];
    body = `<div class="grid2">${B.map(([ic,n,f]) => { const x = so(l.filter(f)); return x.length ? `<div class="card"><h3>${I(ic)} ${n} <span class="cnt">· ${x.length}</span></h3>${fold('f-'+n, x.map(taskRow), 5)}</div>` : ''; }).join('')}</div>`;
  }
  const segF = [['pend','Pendientes'],['hecha','Completadas'],['todas','Todas'],['Urgente','Urgentes'],['Alta','Alta']];
  return `<div class="hdr"><div><h2>Tareas</h2><div class="sub">Marca el cuadrado para completar · toca el título para editar · las repetitivas generan la siguiente</div></div><button class="btn" data-a="nt">${I('plus')} Nueva tarea</button></div>
  <div class="toolbar"><div class="seg">${[['area','Por área'],['fecha','Por fecha']].map(([k,n]) => `<button class="${grp===k?'on':''}" data-a="gp" data-i="${k}">${n}</button>`).join('')}</div><div class="seg">${segF.map(([k,n]) => `<button class="${flt===k?'on':''}" data-a="fl" data-i="${k}">${n}</button>`).join('')}</div></div>
  ${body || `<div class="card">${empty('No hay tareas aquí.')}</div>`}`;
}

