'use strict';
const VERSION = 'moyi-prava-04809e4c';
const PRECACHE = ["/","/offline/","/mene-zupynyly/","/povistka/","/skarha/","/vidstrochka/","/zabraly/","/dopomoha/","/faq/","/poshuk/","/pryvatnist/","/terminovo/","/zaiava-vidstrochka/","/dlia-rodyn/","/slovnyk/","/pro-sait/","/znyattia-vyklyuchennia/","/sos/","/statusy-rezerv/","/szch/","/assets/style.css?v=04809e4c","/assets/app.js?v=04809e4c","/assets/generator.js?v=04809e4c","/assets/vnav.js?v=04809e4c","/assets/search.js?v=04809e4c","/assets/urgent.js?v=04809e4c","/assets/zaiava.js?v=04809e4c","/assets/search-index.json","/assets/icon.svg","/assets/icon-192.png","/assets/favicon-48.png","/manifest.webmanifest"];

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
