// Service worker: permite abrir el panel sin conexión (red primero, caché si falla).
const C = 'ldb-shell-v40';
const SHELL = ['./', 'index.html', 'styles.css', 'icons.js', 'config.js', 'js/base.js', 'js/estado.js', 'js/facturas-calculo.js', 'js/nube.js', 'js/banco.js', 'js/interfaz.js', 'js/vistas/dia.js', 'js/vistas/tareas.js', 'js/vistas/compra.js', 'js/vistas/finanzas.js', 'js/vistas/facturas.js', 'js/vistas/salud.js', 'js/vistas/ajustes.js', 'js/render.js', 'js/formularios.js', 'js/voz.js', 'js/acciones.js', 'js/eventos.js', 'js/arranque.js', 'manifest.webmanifest', 'icons/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(C).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
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
