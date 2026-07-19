/* SAS Survey App service worker — offline support.
   IMPORTANT: bump CACHE (the version) on EVERY release so clients pick up the new build.
   Strategy: network-first for the app page (fresh when online, cached when offline);
   cache-first for static assets. App is a single self-contained index.html. */
const CACHE = 'sas-survey-v2.8.4';
const ASSETS = ['./', './index.html', './manifest.json', './icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // allSettled so one missing asset can't abort the whole install
      .then((cache) => Promise.allSettled(ASSETS.map((a) => cache.add(a))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // let cross-origin requests pass through

  // App page: network-first, refresh cache when online, fall back to cache offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('./index.html').then((c) => c || caches.match('./')))
    );
    return;
  }

  // Static assets: cache-first, fall back to network.
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      if (res && res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      }
      return res;
    }))
  );
});
