/* Minimal offline shell: same-origin files are cached (network first, cache fallback). Supabase calls and map tiles are never cached here. */
const CACHE = 'mzk-v6';
const SHELL = ['./', 'index.html', 'app.css?v=1', 'app.js?v=1', 'api.js?v=1', 'i18n.js?v=1', 'config.js?v=1', 'places.js?v=1', 'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css', 'vendor/mc/leaflet.markercluster.js', 'vendor/mc/MarkerCluster.css', 'assets/logo-white.png', 'assets/logo-colored.png', 'manifest.webmanifest'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});
