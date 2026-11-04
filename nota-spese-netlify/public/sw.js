// Service worker minimo: salva solo la "scocca" (HTML/CSS/JS). Graph, funzione di scansione e login non vengono mai messi in cache.
const CACHE = 'nota-spese-nl-v1';
const SHELL = ['./', 'style.css', 'app.js', 'config.js', 'vendor/msal-browser.min.js', 'vendor/exceljs.min.js', 'manifest.webmanifest', 'icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.includes('/.netlify/')) return;
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; })
    .catch(() => caches.match(e.request).then(m => m || caches.match('./'))));
});
