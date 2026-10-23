'use strict';
const VERSION = 'moyi-prava-37f38f8d';
const PRECACHE = ["/","/offline/","/mene-zupynyly/","/blokpost/","/povistka/","/perevirka-povistky/","/skarha/","/vidstrochka/","/zabraly/","/dopomoha/","/faq/","/poshuk/","/pryvatnist/","/shtraf/","/terminovo/","/zaiava-vidstrochka/","/sytuatsiyi/politsiya-pdr/","/sytuatsiyi/politsiya-viiskovyi-dokument/","/sytuatsiyi/politsiya-rezerv/","/sytuatsiyi/politsiya-szch/","/sytuatsiyi/politsiya-povistka/","/sytuatsiyi/politsiya-zatrymannia/","/sytuatsiyi/tck-perevirka/","/sytuatsiyi/tck-ne-predstavylys/","/sytuatsiyi/tck-vidstrochka/","/sytuatsiyi/tck-syla/","/sytuatsiyi/tck-vlk/","/sytuatsiyi/blokpost-viiskovi/","/sytuatsiyi/blokpost-ne-propuskaiut/","/sytuatsiyi/vtratyv-dokument/","/sytuatsiyi/povistka-poshtoiu/","/sytuatsiyi/ne-prybuv-u-strok/","/assets/style.css?v=37f38f8d","/assets/app.js?v=37f38f8d","/assets/generator.js?v=37f38f8d","/assets/vnav.js?v=37f38f8d","/assets/search.js?v=37f38f8d","/assets/urgent.js?v=37f38f8d","/assets/zaiava.js?v=37f38f8d","/assets/search-index.json","/assets/icon.svg","/assets/icon-192.png","/manifest.webmanifest"];

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
        .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('/offline/')))
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
