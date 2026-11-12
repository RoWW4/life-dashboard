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
/* Gatitos pixelados (plantilla de index.html) para «Lo más importante» vacío en Mi día. */
const GATOS = (() => {
  const t = document.getElementById('tplGatos');
  return t ? t.innerHTML.replace('class="gatos"', 'class="gatos mini"') : '';
})();
(async function boot() {
  theme();
  $('#fabAdd').innerHTML = I('plus');
  $('#fabMic').innerHTML = I('mic');
  if ('serviceWorker' in navigator && location.protocol.startsWith('http'))
    navigator.serviceWorker.register('sw.js').catch(e => logErr('sw', e));
  let r = 'local';
  try {
    r = await cloudInit();
  } catch (e) {
    setSync('⚠️ Sin sincronizar');
  }
  if (r === 'login') {
    $('#nav').innerHTML = '';
    $('.fabs').hidden = true;
    $('#m').innerHTML = vLogin();
    $('#le').focus();
    return;
  }
  afterLoad();
})();
