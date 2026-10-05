/* Zoh OS service worker.
   App files are network-first: online you always get the latest version,
   offline you get the last cached copy. Your data lives in localStorage
   and is never touched here. */
const CACHE = 'zoh-os-v4-1';
const CORE = [
  './', './index.html', './manifest.webmanifest', './css/app.css?v=4.1',
  './js/store.js?v=4.1', './js/belt.js?v=4.1', './js/model.js?v=4.1', './js/ui.js?v=4.1',
  './js/screens.js?v=4.1', './js/sheets.js?v=4.1', './js/main.js?v=4.1',
  './icons/icon-192.png', './icons/apple-touch-icon.png', './icons/icon.svg',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req.mode === 'navigate' ? './index.html' : req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req.mode === 'navigate' ? './index.html' : req, { ignoreSearch: req.mode === 'navigate' }))
  );
});
