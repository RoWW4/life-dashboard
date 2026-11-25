'use strict';
/* Sección «Tareas». */
/* Los cumpleaños van aparte, en su pestaña (los próximos primero), para que no llenen las listas de tareas.
   Se añaden con «Añadir cumpleaños» (o como una tarea con el área Cumpleaños) y se repiten cada año solos. */
const CUMPLE = 'Cumpleaños';
function cumplePanel(v) {
  return cumplePanel0(v).replace(v === 'tareasf' ? /<span class="hd"[^>]*>.*?<\/span>/ : /^$/, '');
}
/* Panel de cumpleaños: el próximo, destacado arriba (con sus ideas de regalo; los años que cumple van en el icono) y el resto por meses,
   con cuántos días faltan (naranja las dos últimas semanas, color de hoy si es hoy). */
function bdChip(t) {
  const n = t.due ? dayDiff(t.due) : null;
  if (n === null) return '';
  return `<span class="chip ${n < 0 ? 'er' : n === 0 ? 'ac' : n <= 14 ? 'wa' : ''}">${n <= 1 ? cap(rel(t.due)) : 'Faltan ' + n + ' días'}</span>`;
}
function bdMeta(t) {
  const k = bdIdeas(t).length;
  return [t.due ? fdc(t.due) : 'Sin fecha', k ? `<span class="bdnx">${I('gift', 'sm')} ${k} idea${k > 1 ? 's' : ''}</span>` : '']
    .filter(Boolean)
    .join(' · ');
}
function cumplePanel0(v) {
  const c = S.tasks.filter(t => t.area === CUMPLE && !t.done).sort((a, b) => (a.due || '9').localeCompare(b.due || '9'));
  const ck = t =>
    `<input type="checkbox" class="ck" data-a="tt" data-i="${t.id}" aria-label="Ya ha pasado: llevar «${esc(t.title)}» al año que viene">`;
  const [p, ...r] = c;
  const yr = TD().slice(0, 4);
  // El próximo: tarjeta destacada con sus dos primeras ideas de regalo.
  const top = p
    ? `<div class="bdnext">${ck(p)}${bdTile(p)}<button class="link g" data-a="et" data-i="${p.id}"><small>Próximo cumpleaños</small><b>${esc(bdName(p))}</b><span class="mu">${bdMeta(p)}</span>${
        bdIdeas(p).length
          ? `<span class="bdids">${bdIdeas(p)
              .slice(0, 2)
              .map(x => `<span>${I('gift', 'sm')} ${esc(x.tx.replace(/https?:\/\/\S+/g, '').trim() || 'Enlace')}</span>`)
              .join('')}</span>`
          : ''
      }</button>${bdChip(p)}</div>`
    : '';
  let lastM = '';
  const rows = r.map(t => {
    const m = (t.due || '').slice(0, 7),
      hd =
        m !== lastM
          ? `<div class="dh">${m ? cap(new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(new Date(m + '-15T12:00'))) + (m.slice(0, 4) !== yr ? ' ' + m.slice(0, 4) : '') : 'Sin fecha'}</div>`
          : '';
    lastM = m;
    return `${hd}<div class="row bdrow${t.due && dayDiff(t.due) <= 14 ? ' soon' : ''}">${ck(t)}${bdTile(t)}<button class="link g" data-a="et" data-i="${t.id}"><span class="tt">${esc(bdName(t))}</span><span class="meta mu">${bdMeta(t)}</span></button>${bdChip(t)}</div>`;
  });
  return panel(
    v,
    CUMPLE,
    `<span style="color:${AC[CUMPLE]}">${I(AI[CUMPLE])}</span> Cumpleaños <span class="cnt">· ${c.length}</span>`,
    (c.length ? top + fold('a-' + CUMPLE, rows, 4) : empty('No hay cumpleaños apuntados.')) +
      `<div class="more"><button class="btn sm ghost" data-a="nc">${I('plus', 'sm')} Añadir cumpleaños</button></div>`
  );
}
/* Pestañas «Tareas | Cumpleaños»: los cumpleaños van en la suya para no mezclarse con las tareas (se abre en Tareas). */
let tTab = 'tar';
function vTareas() {
  const nC = S.tasks.filter(t => t.area === CUMPLE && !t.done).length,
    nT = S.tasks.filter(t => t.area !== CUMPLE && !t.done).length;
  const tabs = `<div class="seg ctabs" role="tablist" aria-label="Tareas o cumpleaños">${[
    ['tar', I('list-checks', 'sm') + ' Tareas', nT],
    ['cum', I(AI[CUMPLE], 'sm') + ' Cumpleaños', nC]
  ]
    .map(
      ([k, l, n]) =>
        `<button role="tab" aria-selected="${tTab === k}" class="${tTab === k ? 'on' : ''}" data-a="ttab" data-i="${k}">${l} <span class="cnt">· ${n}</span></button>`
    )
    .join('')}</div>`;
  if (tTab === 'cum')
    return `<div class="hdr"><div><h2>Tareas</h2><div class="sub help">Toca un cumpleaños para editarlo o apuntar ideas de regalo · Marca el cuadrado cuando haya pasado</div></div></div>
  ${tabs}<div class="grid">${cumplePanel('tareasf')}</div>`;
  const l = S.tasks.filter(
    t =>
      t.area !== CUMPLE &&
      ((flt === 'todas' && !oldDone(t)) || (flt === 'pend' ? !t.done : flt === 'hecha' ? t.done : !t.done && t.pr === flt))
  );
  const so = a => a.sort((x, y) => ((x.due || '9') + (x.tm || '')).localeCompare((y.due || '9') + (y.tm || '')));
  let body = '';
  if (grp === 'area') {
    const g = {};
    l.forEach(t => (g[t.area] = g[t.area] || []).push(t));
    // Áreas ordenadas por su tarea más próxima (las que no tienen fecha, al final).
    const near = a => {
      const d = g[a]
        .filter(t => !t.done && t.due)
        .map(t => t.due)
        .sort()[0];
      return d || 'z1';
    };
    // Si se han movido a mano, manda ese orden (S.order.tareas); las áreas nuevas entran en su sitio según la tarea más próxima.
    const keys = (VIS.tareas = ord(
      'tareas',
      Object.keys(g).sort((a, b) => near(a).localeCompare(near(b)) || AREAS.indexOf(a) - AREAS.indexOf(b))
    ));
    // Cada panel enseña sus 5 tareas más próximas y se despliega con «Ver más».
    body = `<div class="grid">${keys
      .map(a =>
        panel(
          'tareas',
          a,
          `<span style="color:${AC[a] || 'inherit'}">${I(AI[a] || 'pin')}</span> ${esc(a)} <span class="cnt">· ${g[a].length}</span>`,
          fold(
            'a-' + a,
            so(g[a]).map(t => taskRow(t)),
            5
          )
        )
      )
      .join('')}</div>`;
  } else {
    // Por fecha (la vista de inicio): una sola lista, de lo más cercano a lo más lejano, con separadores por tramos.
    // Cada tarea lleva una franja y una etiqueta con el color de su área (para verlas por área, el botón de la fila de filtros).
    const lf = l;
    const dd = t => dayDiff(t.due);
    // Las completadas con fecha pasada no son atrasadas: van en su propio tramo.
    const B = [
      ['Atrasadas', t => !t.done && t.due && dd(t) < 0],
      ['Hoy', t => t.due && dd(t) === 0],
      ['Mañana', t => t.due && dd(t) === 1],
      ['Esta semana', t => t.due && dd(t) > 1 && dd(t) <= 7],
      ['Este mes', t => t.due && dd(t) > 7 && dd(t) <= 30],
      ['Más adelante', t => t.due && dd(t) > 30],
      ['Sin fecha', t => !t.due],
      ['Completadas', t => t.done && t.due && dd(t) < 0]
    ];
    const lst = B.map(([n, f]) => {
      const x = so(lf.filter(f));
      return x.length
        ? `<div class="tsep${n === 'Atrasadas' ? ' er' : ''}">${n} <span>· ${x.length}</span></div>` + x.map(t => taskRow(t, 1)).join('')
        : '';
    }).join('');
    VIS.tareas = [];
    // La lista también es un panel (sin asa: aquí no se mueven) para poder elegir su ancho en el ordenador.
    const tl = lst
      ? panel('tareasf', 'lista', `${I('list-checks')} Tareas <span class="cnt">· ${lf.length}</span>`, lst, 'tlist').replace(
          /<span class="hd"[^>]*>.*?<\/span>/,
          ''
        )
      : '';
    if (lst) body = `<div class="grid">${tl}</div>`;
  }
  const segF = [
    ['pend', 'Pendientes'],
    ['hecha', 'Hechas'],
    ['todas', 'Todas'],
    ['Alta', 'Alta']
  ];
  // Una sola fila: el filtro y, al final, un botón que cambia entre lista por fecha y paneles por área.
  const gpB =
    grp === 'area'
      ? `<button class="ib on" data-a="gp" data-i="fecha" aria-label="Ver por fecha" title="Ahora: por área. Toca para ver por fecha">${I('tags')}</button>`
      : `<button class="ib" data-a="gp" data-i="area" aria-label="Ver por área" title="Ahora: por fecha. Toca para ver por área">${I('tags')}</button>`;
  return `<div class="hdr"><div><h2>Tareas</h2><div class="sub help">Marca el cuadrado para completar · Toca el título para editar · Las repetitivas generan la siguiente</div></div><button class="btn" data-a="nt">${I('plus')} Nueva tarea</button></div>
  ${tabs}<div class="toolbar one ttb"><div class="seg">${segF.map(([k, n]) => `<button class="${flt === k ? 'on' : ''}" data-a="fl" data-i="${k}">${n}</button>`).join('')}</div>${gpB}</div>
  ${body || `<div class="card">${empty('No hay tareas aquí.')}</div>`}`;
}
