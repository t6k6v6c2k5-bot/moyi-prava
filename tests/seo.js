'use strict';
// SEO-перевірки. Запуск: BASE_ON=http://localhost:3111 BASE_OFF=http://localhost:3112 node tests/seo.js
// BASE_ON — сервер з INDEXING=on та SITE_URL=https://moyi-prava.example; BASE_OFF — сервер без INDEXING.
const ON = process.env.BASE_ON, OFF = process.env.BASE_OFF, SITE = process.env.SITE || 'https://moyi-prava.example';
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };
const get = async (b, p, o) => { const r = await fetch(b + p, { redirect: 'manual', ...o }); return { r, t: await r.text() }; };
const meta = (h, re) => (re.exec(h) || [])[1];
(async () => {
  const sm = await get(ON, '/sitemap.xml');
  const urls = [...sm.t.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  ok(urls.length >= 15, 'sitemap: ' + urls.length + ' URL');
  ok(urls.every((u) => u.startsWith(SITE + '/')), 'sitemap: усі URL з SITE_URL');
  ok(!urls.some((u) => /poshuk|offline/.test(u)), 'sitemap: без /poshuk/ та /offline/');
  ok(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/.test(sm.t), 'sitemap: lastmod');
  const rb = await get(ON, '/robots.txt');
  ok(/Allow: \//.test(rb.t) && rb.t.includes('Sitemap: ' + SITE + '/sitemap.xml'), 'robots.txt (on): Allow + Sitemap');
  const titles = new Set(), descs = new Set(), h1s = new Set();
  for (const u of urls) {
    const path = u.replace(SITE, '');
    const { r, t } = await get(ON, path);
    const title = meta(t, /<title>([^<]*)<\/title>/), desc = meta(t, /<meta name="description" content="([^"]*)"/);
    const canon = meta(t, /<link rel="canonical" href="([^"]*)"/), robots = meta(t, /<meta name="robots" content="([^"]*)"/);
    const h1 = meta(t, /<h1[^>]*>([\s\S]*?)<\/h1>/);
    ok(r.status === 200, path + ' 200');
    ok(title && title.length <= 80, path + ' title ≤ 80 (' + (title || '').length + ')');
    ok(desc && desc.length >= 60 && desc.length <= 200, path + ' description 60–200 (' + (desc || '').length + ')');
    ok(canon === u, path + ' canonical = URL');
    ok(/^index,follow/.test(robots || ''), path + ' robots index');
    ok(!/%%/.test(t), path + ' без плейсхолдерів');
    ok(!r.headers.get('x-robots-tag'), path + ' без X-Robots-Tag');
    ok(/application\/ld\+json/.test(t), path + ' JSON-LD');
    ok(/og:image" content="https:\/\/moyi-prava\.example\/assets\/og\.png"/.test(t), path + ' og:image абсолютний');
    ok(!titles.has(title) && !descs.has(desc), path + ' унікальні title/description');
    titles.add(title); descs.add(desc); h1s.add(h1);
  }
  const ps = await get(ON, '/poshuk/'); ok(/content="noindex,follow"/.test(ps.t), '/poshuk/ noindex');
  const fav = await get(ON, '/favicon.ico'); ok(fav.r.status === 200 && /image\/png/.test(fav.r.headers.get('content-type')), '/favicon.ico 200');
  // INDEXING вимкнено
  const r2 = await get(OFF, '/robots.txt'); ok(/Disallow: \//.test(r2.t) && !/Allow: \//.test(r2.t), 'robots.txt (off): Disallow /');
  const h2 = await get(OFF, '/'); ok(/noindex, nofollow/.test(h2.r.headers.get('x-robots-tag') || ''), 'off: X-Robots-Tag noindex');
  ok(/<meta name="robots" content="noindex,nofollow">/.test(h2.t), 'off: meta robots noindex');
  console.log(fail ? `\n${fail} FAILED` : '\nSEO ALL OK'); process.exit(fail ? 1 : 0);
})();
