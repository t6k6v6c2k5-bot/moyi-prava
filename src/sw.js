'use strict';
const VERSION = 'moyi-prava-%%BUILD%%';
const PRECACHE = %%PRECACHE%%;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // HTML: мережа з таймаутом 3 с (свіжі тексти законів); на слабкому сигналі або без мережі — кеш
  if (req.mode === 'navigate') {
    e.respondWith(
      (async () => {
        const cached = await caches.match(req, { ignoreSearch: true });
        const net = fetch(req).then((res) => {
          if (!res.ok && cached) return cached;
          const copy = res.clone();
          if (res.ok && !new URL(req.url).search) caches.open(VERSION).then((c) => c.put(req, copy));
          return res;
        });
        if (!cached) return net.catch(() => caches.match('/offline/'));
        return Promise.race([net.catch(() => cached), new Promise((r) => setTimeout(() => r(cached), 3000))]);
      })()
    );
    return;
  }
  // ресурси: кеш, потім мережа
  e.respondWith(
    caches.match(req).then(
      (r) =>
        r ||
        fetch(req).then((res) => {
          const copy = res.clone();
          if (res.ok) caches.open(VERSION).then((c) => c.put(req, copy));
          return res;
        })
    )
  );
});
