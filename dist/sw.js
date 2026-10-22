'use strict';
const VERSION = 'moyi-prava-256bca66';
const PRECACHE = ["/","/offline/","/mene-zupynyly/","/blokpost/","/povistka/","/perevirka-povistky/","/skarha/","/vidstrochka/","/zabraly/","/dopomoha/","/faq/","/poshuk/","/pryvatnist/","/shtraf/","/terminovo/","/sytuatsiyi/politsiya-pdr/","/sytuatsiyi/politsiya-viiskovyi-dokument/","/sytuatsiyi/politsiya-rezerv/","/sytuatsiyi/politsiya-szch/","/sytuatsiyi/politsiya-povistka/","/sytuatsiyi/politsiya-zatrymannia/","/sytuatsiyi/tck-perevirka/","/sytuatsiyi/tck-ne-predstavylys/","/sytuatsiyi/tck-vidstrochka/","/sytuatsiyi/tck-syla/","/sytuatsiyi/tck-vlk/","/sytuatsiyi/blokpost-viiskovi/","/sytuatsiyi/blokpost-ne-propuskaiut/","/sytuatsiyi/vtratyv-dokument/","/assets/style.css?v=256bca66","/assets/app.js?v=256bca66","/assets/generator.js?v=256bca66","/assets/vnav.js?v=256bca66","/assets/search.js?v=256bca66","/assets/urgent.js?v=256bca66","/assets/search-index.json","/assets/icon.svg","/assets/icon-192.png","/manifest.webmanifest"];

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

  // HTML: спершу мережа (свіжі тексти законів), без мережі — кеш
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          if (res.ok) caches.open(VERSION).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('/offline/')))
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
