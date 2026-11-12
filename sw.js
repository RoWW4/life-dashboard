// Service worker: permite abrir el panel sin conexión (red primero, caché si falla).
const C = 'ldb-shell-v114';
const SHELL = ['./', 'index.html', 'styles.css', 'icons.js', 'config.js', 'js/base.js', 'js/estado.js', 'js/facturas-calculo.js', 'js/salud-calculo.js', 'js/nube.js', 'js/banco.js', 'js/interfaz.js', 'js/vistas/dia.js', 'js/vistas/tareas.js', 'js/vistas/compra.js', 'js/vistas/finanzas.js', 'js/vistas/facturas.js', 'js/vistas/salud.js', 'js/vistas/ajustes.js', 'js/render.js', 'js/formularios.js', 'js/voz.js', 'js/acciones.js', 'js/eventos.js', 'js/arranque.js', 'img/fondo-planeta.jpg', 'manifest.webmanifest', 'icons/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(C).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C && k !== SH).map(k => caches.delete(k)))));
  self.clients.claim();
});

/* Compartir al panel (share_target del manifest): el móvil manda aquí lo compartido (título, texto y enlace).
   Se guarda un momento en la caché SH y se abre el panel con ?compartir=1, que pregunta qué es (shareOpen en formularios.js). */
const SH = 'ldb-share';
async function recibir(req) {
  const f = await req.formData(),
    c = await caches.open(SH);
  const meta = { title: f.get('title') || '', text: f.get('text') || '', url: f.get('url') || '' };
  await c.put('share/meta', new Response(JSON.stringify(meta), { headers: { 'content-type': 'application/json' } }));
  return Response.redirect('./?compartir=1', 303);
}

self.addEventListener('fetch', e => {
  if (e.request.method === 'POST' && new URL(e.request.url).pathname.endsWith('/compartir')) return e.respondWith(recibir(e.request));
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  // Solo cacheamos la propia app y librerías/fuentes; nunca las llamadas a Supabase.
  if (u.origin !== location.origin && !/jsdelivr|fonts\.(googleapis|gstatic)/.test(u.hostname)) return;
  e.respondWith(
    fetch(e.request)
      .then(r => { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)); return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
