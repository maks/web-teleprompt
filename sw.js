const CACHE = 'teleprompter-v6';

// Everything the app needs to run offline.
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './js/app.js',
  './js/store.js',
  './js/markdown.js',
  './js/components/teleprompter-view.js',
  './js/components/teleprompter-view.css',
  './js/components/teleprompter-view.html',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first with cache fallback: new deploys are picked up on the next
// online load, and the cached copy keeps the app working offline.
self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() =>
        caches.match(request).then(
          (cached) => cached || (request.mode === 'navigate' ? caches.match('./') : undefined)
        )
      )
  );
});
