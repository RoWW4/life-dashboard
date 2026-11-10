'use strict';
/* Secciones «Documentos» y «Ajustes», y pantalla de inicio de sesión. */
function vDocs() {
  const g = {};
  S.docs.forEach(d => (g[d.cat] = g[d.cat] || []).push(d));
  return `<div class="hdr"><div><h2>Documentos</h2><div class="sub help">Enlaces a tus archivos de Drive: se abren con tu cuenta de Google. La estrella los pone a mano en Mi día.</div></div><div class="hact"><a class="btn ghost" href="${'https://drive.google.com/drive/my-drive'}" target="_blank" rel="noopener noreferrer">${I('hard-drive')} Abrir Drive</a><button class="btn" data-a="nd">${I('plus')} Documento</button></div></div>
  ${
    S.docs.length
      ? `<div class="grid">${(VIS.docs = ord(
          'docs',
          DC.filter(c => g[c])
        ))
          .map(c =>
            panel(
              'docs',
              c,
              `<span style="color:${DCOL[c]}">${I(DI[c])}</span> ${c} <span class="cnt">· ${g[c].length}</span>`,
              g[c].map(docRow).join('')
            )
          )
          .join('')}</div>`
      : `<div class="card">${empty('Sin documentos todavía.')}</div>`
  }
  <div class="mu">No guardes aquí números de DNI, contraseñas ni certificados digitales: solo el enlace al archivo.</div>`;
}

function vAjus() {
  const acc = !cloudCfg()
    ? `<div class="mu">La nube no está configurada: los datos viven solo en este dispositivo. Sigue la guía <b>LEEME.md</b> (pasos 1–4) para verlos también en el móvil.</div>`
    : user
      ? `<div class="row"><span class="g">Sesión iniciada</span><span class="mu">${esc(user.email)}</span></div><div class="row"><span class="g">Estado</span><span class="mu" id="syncst">${syncTxt}</span></div><div class="f" style="margin:12px 0 0"><button class="btn ghost" style="flex:none" data-a="logout">Cerrar sesión</button></div>`
      : `<div class="mu">Estás usando el panel sin cuenta en este dispositivo.</div><div class="f" style="margin:12px 0 0"><button class="btn" style="flex:none" data-a="cloud">Iniciar sesión y sincronizar</button></div>`;
  return `<div class="hdr"><div><h2>Ajustes</h2><div class="sub help">Personalizar el panel, dinero, y tu cuenta y copias</div></div></div>
  ${(() => {
    const C = {
      cuenta: panel('ajus', 'cuenta', `${I('cloud')} Cuenta y sincronización`, acc),
      midia: panel(
        'ajus',
        'midia',
        `${I('house')} Mi día`,
        `<div class="row"><span class="g">Tu nombre (para el saludo)</span><button class="btn sm ghost" data-a="nm">${esc(S.name || '—')} ${I('pencil', 'sm')}</button></div><div class="row"><span class="g">Tiempo<em class="mu">De la ciudad que elijas (no usa tu ubicación)</em></span><div class="seg">${[
          [0, 'Sí'],
          [1, 'No']
        ]
          .map(([k, n]) => `<button class="${+!!S.wxOff === k ? 'on' : ''}" data-a="wxo" data-i="${k}">${n}</button>`)
          .join(
            ''
          )}</div></div>${S.wxOff ? '' : `<div class="row"><span class="g">Ciudad del tiempo</span><button class="btn sm ghost" data-a="wxc">${S.wx ? esc(S.wx.n) : 'Elegir ciudad'} ${I('pencil', 'sm')}</button></div>`}`
      ),
      apar: panel(
        'ajus',
        'apar',
        `${I('palette')} Apariencia`,
        `<div class="row"><span class="g">Tema</span><div class="seg">${[
          ['dark', 'moon', 'Oscuro'],
          ['light', 'sun', 'Claro'],
          ['blue', 'droplet', 'Azul']
        ]
          .map(([k, ic, n]) => `<button class="${S.theme === k ? 'on' : ''}" data-a="th" data-i="${k}">${I(ic, 'sm')} ${n}</button>`)
          .join(
            ''
          )}</div></div><div class="row bgcfg"><span class="g">Fondo<em class="mu">Se elige en cada dispositivo; tu imagen no se sube a ningún sitio</em></span><div class="seg">${[
          ['none', 'Ninguno'],
          ['stars', 'Estrellas'],
          ['planet', 'Planeta']
        ]
          .map(([k, n]) => `<button class="${BG.k === k ? 'on' : ''}" data-a="bg" data-i="${k}">${n}</button>`)
          .join(
            ''
          )}<label class="${BG.k === 'img' ? 'on' : ''}" tabindex="0">${I('upload', 'sm')} ${bgImg() ? 'Cambiar imagen' : 'Mi imagen'}<input type="file" id="bgfile" accept="image/*" hidden></label>${bgImg() && BG.k !== 'img' ? `<button data-a="bg" data-i="img">Usar mi imagen</button>` : ''}</div></div>${
          BG.k !== 'none'
            ? `<div class="row"><span class="g">Dónde se ve el fondo</span><div class="seg">${[
                [0, 'Portada de Mi día'],
                [1, 'Toda la app']
              ]
                .map(([k, n]) => `<button class="${+!!BG.all === k ? 'on' : ''}" data-a="bga" data-i="${k}">${n}</button>`)
                .join('')}</div></div>`
            : ''
        }`
      ),
      dinero: panel(
        'ajus',
        'dinero',
        `${I('wallet')} Moneda y tope de gasto`,
        `<div class="row"><span class="g">Moneda</span><select class="in" data-a="cu" aria-label="Moneda">${[
          ['EUR', 'Euro (€)'],
          ['USD', 'Dólar ($)'],
          ['GBP', 'Libra (£)']
        ]
          .map(([k, n]) => `<option value="${k}" ${S.cur === k ? 'selected' : ''}>${n}</option>`)
          .join(
            ''
          )}</select></div><div class="row"><span class="g">Tope de gasto mensual</span><button class="btn sm ghost" data-a="eb2">${eur(S.budget)} ${I('pencil', 'sm')}</button></div>`
      ),
      bank: bankCard('ajus'),
      robots: robotsCard(),
      copias: panel(
        'ajus',
        'copias',
        `${I('hard-drive')} Copias de seguridad`,
        `<div class="mu" style="margin-bottom:10px">Cada día se guarda sola una copia de todo el panel en tu Google Drive (carpeta «Copias del panel», 60 días). Aquí puedes descargar una copia ahora o restaurar una.</div><div class="f" style="margin:0"><button class="btn ghost" style="flex:none" data-a="ex">${I('download')} Exportar copia (JSON)</button><label class="btn ghost" style="flex:none">${I('upload')} Restaurar copia<input type="file" id="im" accept=".json" hidden></label></div>`
      ),
      fest: panel(
        'ajus',
        'fest',
        `${I('calendar-days')} Festivos y vacaciones`,
        `
  <div class="row"><span class="g">Festivos de tu comunidad</span><select class="in" data-a="rg" aria-label="Comunidad autónoma">${REGIONS.map(([k, n]) => `<option value="${k}" ${S.region === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
  <div class="dh">Festivos locales y traslados</div>${
    S.localHol
      .slice()
      .sort((a, b) => a.d.localeCompare(b.d))
      .map(
        h =>
          `<div class="row"><span class="g">${esc(h.n)} <span class="mu">· ${fd(h.d)}</span></span><button class="ib" data-a="dlh" data-i="${esc(h.d)}" aria-label="Eliminar festivo">${I('x')}</button></div>`
      )
      .join('') || '<div class="mu">Aún no hay ninguno.</div>'
  }
  <div class="f" style="margin:8px 0 0"><input id="lh1" placeholder="Nombre (ej. Feria)"><input id="lh2" type="date" aria-label="Fecha del festivo"><button class="btn" data-a="alh">Añadir</button></div>
  <div class="dh">Vacaciones y días libres</div>${
    S.periods
      .slice()
      .sort((a, b) => a.from.localeCompare(b.from))
      .map(
        p =>
          `<div class="row"><span class="g">${esc(p.name)} <span class="mu">· ${fd(p.from)} → ${fd(p.to)}</span></span><button class="ib" data-a="dpe" data-i="${p.id}" aria-label="Eliminar periodo">${I('x')}</button></div>`
      )
      .join('') || '<div class="mu">Aún no hay ninguno.</div>'
  }
  <div class="f" style="margin:8px 0 0"><input id="pe1" placeholder="Nombre (ej. Vacaciones de verano)"><input id="pe2" type="date" aria-label="Desde"><input id="pe3" type="date" aria-label="Hasta"><button class="btn" data-a="ape">Añadir</button></div>`
      ),
      dict: panel(
        'ajus',
        'dict',
        `${I('mic')} Correcciones del dictado <span class="cnt">· ${S.fixes.length}</span>`,
        `<div class="mu" style="margin-bottom:8px">Si el dictado entiende mal una palabra (un nombre, una marca…), el panel la cambia sola por la correcta.</div>${fold(
          'a-dict',
          S.fixes.map(
            (f, i) =>
              `<div class="row"><span class="g">«${esc(f.from)}» → <b>${esc(f.to)}</b></span><button class="ib" data-a="dfx" data-i="${i}" aria-label="Eliminar corrección">${I('x')}</button></div>`
          ),
          3
        )}
  <div class="f" style="margin:10px 0 0"><input id="fx_a" placeholder="Lo que entiende (ej. mercado na)"><input id="fx_b" placeholder="Lo correcto (ej. Mercadona)"><button class="btn" data-a="afx">Añadir</button></div>`
      ),
      avz: panel(
        'ajus',
        'avz',
        `${I('eraser')} Avanzado`,
        `<div class="f" style="margin:0"><button class="btn ghost danger" style="flex:none" data-a="rs">Borrar todo</button></div><div class="mu" style="margin-top:10px">Borra todos los datos del panel, también los de la nube. No se puede deshacer.</div>`
      )
    };
    VIS.ajus = ord(
      'ajus',
      AJ.flatMap(([, ks]) => ks)
    );
    const gs = AJ.map(([n]) => n).filter(n => VIS.ajus.some(k => ajGrp(k) === n));
    VIS.ajgrp = ord('ajgrp', gs);
    return VIS.ajgrp
      .map(
        (n, i) =>
          `<h3 class="agrp">${n}<span class="agmv">${i ? `<button class="ib" data-a="mv" data-i="${esc('ajgrp|' + n + '|-1')}" aria-label="Subir el grupo ${esc(n)}">${I('chevron-up', 'sm')}</button>` : ''}${i < gs.length - 1 ? `<button class="ib" data-a="mv" data-i="${esc('ajgrp|' + n + '|1')}" aria-label="Bajar el grupo ${esc(n)}">${I('chevron-down', 'sm')}</button>` : ''}</span></h3><div class="grid2">${VIS.ajus
            .filter(k => ajGrp(k) === n)
            .map(k => C[k])
            .join('')}</div>`
      )
      .join('');
  })()}`;
}

/* Estado de los robots: latido de cada uno (job_health), incidentes abiertos del vigilante y errores de esta app. */
const ROBOTS = {
  'task-reminders': 'Avisos de Telegram',
  'bank-sync': 'Sincronizar banco',
  'savings-sync': 'Sincronizar ahorro',
  'vigilante': 'Vigilante de errores',
  'docs-bot': 'Bot de documentos',
  'health': 'Salud (Google)'
};
function robotsCard() {
  if (!user)
    return panel(
      'ajus',
      'robots',
      `${I('shield-check')} Estado de los robots`,
      '<div class="mu">Inicia sesión para ver si los robots funcionan.</div>'
    );
  const jobs = ((OPS && OPS.jobs) || []).slice().sort((a, b) => (ROBOTS[a.job] || a.job).localeCompare(ROBOTS[b.job] || b.job));
  const inc = (OPS && OPS.alerts) || [];
  const row = j => {
    const bad =
      (j.fail_count || 0) > 0 ||
      inc.some(x => (x.key === 'avisos' && j.job === 'task-reminders') || (x.key === 'banco' && j.job === 'bank-sync') || (x.key.startsWith('banco:') && j.job === 'savings-sync'));
    return (
      `<div class="row"><span class="g">${esc(ROBOTS[j.job] || j.job)}<em class="mu">${j.last_ok ? 'Funcionó bien ' + ago(j.last_ok) : 'Todavía no ha funcionado bien'}${j.fail_count ? ` · ${j.fail_count} fallo${j.fail_count > 1 ? 's' : ''} seguido${j.fail_count > 1 ? 's' : ''}` : ''}</em></span><span class="chip ${bad ? 'er' : 'ok'}">${bad ? 'Con fallos' : 'Funciona'}</span></div>` +
      (j.last_error
        ? `<div class="mu er" style="margin:-2px 0 8px">${esc(String(j.last_error).slice(0, 240))}${j.run_url ? ` · <a href="${esc(j.run_url)}" target="_blank" rel="noopener noreferrer">ver ejecución</a>` : ''}</div>`
        : '')
    );
  };
  const body =
    (OPS && OPS.err ? `<div class="mu wa">${I('triangle-alert', 'sm')} No se ha podido leer el estado: ${esc(OPS.err)}</div>` : '') +
    (inc.length
      ? inc
          .map(
            x =>
              `<div class="mu er" style="margin-bottom:8px">${I('triangle-alert', 'sm')} <b>${esc(x.title)}</b> no funciona bien desde ${fd(String(x.opened_at).slice(0, 10))}.</div>`
          )
          .join('')
      : '') +
    (jobs.length ? jobs.map(row).join('') : '<div class="mu">Aún no hay datos de los robots.</div>') +
    `<div class="mu" style="margin-top:8px">El vigilante lo revisa cada hora y avisa por Telegram una sola vez cuando algo deja de funcionar, y otra cuando se arregla.</div>`;
  // Esta app, en este dispositivo: último fallo de sincronización y los errores guardados (los últimos 50).
  const L = errLog();
  const app =
    `<div class="dh">Esta app en este dispositivo</div>` +
    (syncErr ? `<div class="mu er" style="margin-bottom:6px">No se pudo sincronizar ${ago(syncErrAt)}: ${esc(syncErr)}</div>` : '') +
    (L.length
      ? L.slice(0, 5)
          .map(
            x =>
              `<div class="row"><span class="g">${esc(x.m)}<em class="mu">${ago(x.t)}${x.n > 1 ? ' · ' + x.n + ' veces' : ''} · ${esc(x.w)}${x.view ? ' · ' + esc(x.view) : ''}${x.x ? ' · ' + esc(x.x) : ''}</em></span></div>`
          )
          .join('') +
        `<div class="f" style="margin:8px 0 0"><button class="btn ghost sm" style="flex:none" data-a="errcp">${I('download', 'sm')} Copiar los ${L.length} errores</button><button class="btn ghost sm" style="flex:none" data-a="errdel">${I('eraser', 'sm')} Borrar la lista</button></div>`
      : '<div class="mu">Sin errores guardados.</div>');
  return panel('ajus', 'robots', `${I('shield-check')} Estado de los robots`, body + app);
}

function vLogin() {
  return `<div class="login card"><div class="logo"><i><b></b><b></b><b></b><b></b></i></div><h2 style="font-size:22px">${APP}</h2><div class="sub" style="margin-bottom:18px">Inicia sesión para ver tus datos en todos tus dispositivos</div>
  <div class="fs"><label>Email<input id="le" type="email" autocomplete="username" inputmode="email"></label><label>Contraseña<input id="lp" type="password" autocomplete="current-password"></label></div>
  <button class="btn" style="width:100%" data-a="login" id="ok">Entrar</button><button class="btn ghost" style="width:100%;margin-top:8px" data-a="local">Usar sin cuenta en este dispositivo</button></div>`;
}
