// Service worker minimo: salva solo la "scocca" dell'app (HTML/CSS/JS) per aprirla subito.
// Le chiamate /api e il login Microsoft non vengono mai messe in cache.
const CACHE = 'nota-spese-v1';
const SHELL = ['/', '/style.css', '/app.js', '/vendor/msal-browser.js', '/manifest.webmanifest', '/icon-192.png'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api')) return;
  // rete prima (così gli aggiornamenti arrivano subito), cache se offline
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request).then(m => m || caches.match('/'))));
});
