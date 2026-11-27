// Service worker: abre el panel rápido y también sin conexión.
// - Archivos con versión (?v=N), librerías y fuentes: de la copia guardada al momento (no cambian; cada versión nueva
//   lleva otro ?v= y se descarga aparte).
// - La página: red primero (para coger siempre la versión nueva) y copia guardada si la red no contesta en 4 s.
// - El resto de archivos propios (config, imágenes, manifiesto): copia guardada al momento y se actualiza por detrás.
const C = 'ldb-shell-v269';
const SHELL = [
  './',
  'index.html',
  'styles.css',
  'icons.js',
  'config.js',
  'js/base.js',
  'js/estado.js',
  'js/facturas-calculo.js',
  'js/salud-calculo.js',
  'js/nube.js',
  'js/banco.js',
  'js/interfaz.js',
  'js/vistas/dia.js',
  'js/vistas/tareas.js',
  'js/vistas/compra.js',
  'js/vistas/finanzas.js',
  'js/vistas/inversiones.js',
  'js/vistas/facturas.js',
  'js/vistas/salud.js',
  'js/vistas/coche.js',
  'js/vistas/mascotas.js',
  'js/vistas/ajustes.js',
  'js/render.js',
  'js/formularios.js',
  'js/formularios-facturas.js',
  'js/formularios-coche.js',
  'js/formularios-mascotas.js',
  'js/voz.js',
  'js/acciones.js',
  'js/acciones-coche.js',
  'js/acciones-mascotas.js',
  'js/acciones-salud.js',
  'js/eventos.js',
  'js/arranque.js',
  'img/fondo-planeta.jpg',
  'manifest.webmanifest',
  'icons/icon-192.png'
];

self.addEventListener('install', e => {
  // Se guardan con el mismo ?v= con el que los pide index.html, para que la primera recarga ya los encuentre.
  const v = C.match(/\d+$/)[0];
  e.waitUntil(caches.open(C).then(c => c.addAll(SHELL.map(f => (/\.(js|css)$/.test(f) && f !== 'config.js' ? f + '?v=' + v : f)))));
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
  const guarda = r => {
    if (r.ok || r.type === 'opaque') {
      const cp = r.clone();
      caches.open(C).then(c => c.put(e.request, cp));
    }
    return r;
  };
  if (e.request.mode !== 'navigate') {
    const fijo = u.searchParams.has('v') || u.origin !== location.origin;
    return e.respondWith(
      caches.match(e.request).then(c => {
        if (c && fijo) return c;
        const red = fetch(e.request).then(guarda);
        if (c) return (red.catch(() => {}), c); // se usa la copia y se actualiza por detrás para la próxima vez
        return red.catch(() => caches.match(e.request, { ignoreSearch: true }));
      })
    );
  }
  // La página se pide sin la copia del navegador (GitHub Pages deja guardarla 10 minutos y el móvil abría la versión
  // anterior tras publicar). Si la red no contesta en 4 s (mala cobertura), se usa la copia guardada.
  const red = fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }).then(guarda);
  const lenta = new Promise(ok => setTimeout(ok, 4000)).then(() => caches.match(e.request, { ignoreSearch: true })).then(c => c || red);
  e.respondWith(Promise.race([red, lenta]).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
