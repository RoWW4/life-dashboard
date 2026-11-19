'use strict';
/* Arranque de la app. */
/* ---------- arranque ---------- */
function afterLoad() {
  $('.fabs').hidden = false;
  const changed = seed();
  if (changed) save();
  render();
  // Vuelta desde el banco (Enable Banking redirige aquí con ?code=…)
  const q = new URLSearchParams(location.search);
  if (q.get('compartir')) {
    history.replaceState(null, '', location.pathname);
    shareOpen();
  } else if (q.get('code')) {
    const code = q.get('code');
    history.replaceState(null, '', location.pathname);
    const o = modal(
      `<h3>🏦 Banco autorizado</h3><p>Copia este código y pégalo en GitHub al ejecutar «Conectar banco» por segunda vez. Caduca en unos minutos.</p><div class="code">${esc(code)}</div><div class="acts"><span class="sp"></span><button class="btn ghost" data-close>Cerrar</button><a class="btn ghost" href="https://github.com/RoWW4/life-dashboard/actions/workflows/bank-link.yml" target="_blank" rel="noopener noreferrer">Abrir «Conectar banco»</a><button class="btn" id="ok">Copiar código</button></div>`
    );
    o.querySelector('#ok').onclick = () => {
      navigator.clipboard
        .writeText(code)
        .then(() => toast('Código copiado'))
        .catch(() => toast('Selecciónalo y cópialo a mano'));
    };
  } else if (q.get('error')) {
    history.replaceState(null, '', location.pathname);
    toast('El banco no autorizó la conexión: ' + q.get('error'));
  }
}
(async function boot() {
  theme();
  $('#fabAdd').innerHTML = I('plus');
  $('#fabMic').innerHTML = I('mic');
  if ('serviceWorker' in navigator && location.protocol.startsWith('http'))
    navigator.serviceWorker.register('sw.js').catch(e => logErr('sw', e));
  // Si la nube tarda (mala cobertura, o la sesión se queda colgada al volver a la app), no se espera más de 5 s:
  // se abre con lo guardado en este dispositivo y, cuando la nube contesta, se juntan los cambios y se repinta.
  const ini = cloudInit().catch(() => {
    setSync('⚠️ Sin sincronizar');
    return 'local';
  });
  const hayLocal = !!localStorage.getItem(K);
  const r = await (hayLocal ? Promise.race([ini, new Promise(ok => setTimeout(() => ok('tarde'), 5000))]) : ini);
  const login = () => {
    $('#nav').innerHTML = '';
    $('.fabs').hidden = true;
    $('#m').innerHTML = vLogin();
    $('#le').focus();
  };
  if (r === 'login') return login();
  afterLoad();
  if (r !== 'tarde') return;
  setSync('⏳ Conectando…');
  const r2 = await ini;
  if (r2 === 'login') login();
  else if (r2 === 'ok') render();
})();
