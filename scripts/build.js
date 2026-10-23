'use strict';
// Збирає статичні сторінки у dist/ з content/*.json та src/assets/*.
// Запуск: npm run build
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const CONTENT = path.join(ROOT, 'content');
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');
// Позначки «Потребує перевірки юристом» — лише для власника: на сайті приховані, збираються в docs/LAWYER_REVIEW.md (SHOW_NOTES=1 покаже їх на сторінках)
const SHOW_NOTES = process.env.SHOW_NOTES === '1';
const LAWYER_NOTES = [];
let curPage = '';

const sources = JSON.parse(fs.readFileSync(path.join(CONTENT, 'sources.json'), 'utf8'));
const faq = JSON.parse(fs.readFileSync(path.join(CONTENT, 'faq.json'), 'utf8'));
const vdata = JSON.parse(fs.readFileSync(path.join(CONTENT, 'vidstrochka-data.json'), 'utf8'));
const situations = JSON.parse(fs.readFileSync(path.join(CONTENT, 'situations.json'), 'utf8'));
const pages = fs
  .readdirSync(path.join(CONTENT, 'pages'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(CONTENT, 'pages', f), 'utf8')));

const SITE = '%%SITE_URL%%'; // підставляється сервером з process.env.SITE_URL
const VERIFIED = sources.verified;
const VERIFIED_ISO = VERIFIED.split('.').reverse().join('-');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Мінімальний inline-markdown: **жирний**, [текст](url) або [текст](url "sponsored")
function inline(s) {
  let t = esc(s);
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/0 800 213 103(?![^<]*<\/a>)/g, '<a href="tel:0800213103">0 800 213 103</a>');
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;sponsored&quot;)?\)/g, (m, text, url) => {
    const sponsored = /&quot;sponsored&quot;\)$/.test(m);
    const ext = /^https?:/.test(url);
    const rel = [sponsored ? 'sponsored' : '', ext ? 'noopener noreferrer' : ''].filter(Boolean).join(' ');
    return `<a href="${url}"${ext ? ' target="_blank"' : ''}${rel ? ` rel="${rel}"` : ''}>${text}</a>`;
  });
  return t;
}
const plain = (s) => String(s).replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');

const ICON = {
  sos: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 3 6v6c0 5 3.8 9.3 9 10 5.2-.7 9-5 9-10V6l-9-4zm-1 5h2v6h-2V7zm0 8h2v2h-2v-2z"/></svg>',
  doc: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h8l6 6v14H6V2zm7 1.5V9h5.5L13 3.5zM8 13h8v1.6H8V13zm0 3.4h8V18H8v-1.6z"/></svg>',
  clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 5v5.2l4 2.4-.8 1.3L11 13V7h2z"/></svg>',
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17.3V21h3.7L17.8 9.9l-3.7-3.7L3 17.3zM20.7 7a1 1 0 0 0 0-1.4l-2.3-2.3a1 1 0 0 0-1.4 0l-1.8 1.8 3.7 3.7L20.7 7z"/></svg>',
  more: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v2.2H4V6zm0 5h16v2.2H4V11zm0 5h16v2.2H4V16z"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 2a8 8 0 1 0 4.9 14.3l5.4 5.4 1.4-1.4-5.4-5.4A8 8 0 0 0 10 2zm0 2a6 6 0 1 1 0 12 6 6 0 0 1 0-12z"/></svg>',
  folder: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z"/></svg>',
  book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h12a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3V4zm3 2v9.3c.3-.2.6-.3 1-.3h9V7a1 1 0 0 0-1-1H7z"/></svg>',
  phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.100.4 2.300.6 3.600.6.600 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.500c.6 0 1 .4 1 1 0 1.300.2 2.500.6 3.600.1.300 0 .7-.2 1l-2.300 2.200z"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.2 4.800 12l-1.400 1.400L9 19 21 7l-1.400-1.400z"/></svg>',
  family: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3zM8 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3zm0 2c-2.300 0-7 1.200-7 3.500V19h14v-2.500C15 14.200 10.300 13 8 13zm8 0c-.3 0-.6 0-1 .1 1.200.8 2 1.900 2 3.400V19h6v-2.500c0-2.300-4.700-3.500-7-3.500z"/></svg>',
  scale: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a1.500 1.500 0 0 1 1.400 1H20v2h-1.600l2.600 6a4 4 0 0 1-8 0l2.500-6H13v14h4v2H7v-2h4V5H8.600L11.100 11a4 4 0 0 1-8 0l2.600-6H4V3h6.600A1.500 1.500 0 0 1 12 2z"/></svg>',
  theme: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9c0-.5 0-.9-.1-1.4A5.5 5.5 0 0 1 12.4 3.1 9 9 0 0 0 12 3z"/></svg>',
};

const NAV = [
  { id: 'povistka', href: '/perevirka-povistky/', label: 'Повістка', icon: 'doc' },
  { id: 'vidstrochka', href: '/vidstrochka/', label: 'Відстрочка', icon: 'clock' },
  { id: 'skarha', href: '/skarha/', label: 'Скарга', icon: 'edit' },
  { id: 'more', href: '/dopomoha/', label: 'Ще', icon: 'more' },
];

function renderVerification() {
  const v = fs.existsSync(path.join(CONTENT, 'verification.json')) ? JSON.parse(fs.readFileSync(path.join(CONTENT, 'verification.json'), 'utf8')) : null;
  const cl = JSON.parse(fs.readFileSync(path.join(CONTENT, 'claims.json'), 'utf8'));
  const srcs = v ? v.sources : Object.fromEntries(Object.entries(cl.sources).map(([k, s]) => [k, { title: s.title, url: s.url, edition: s.edition }]));
  const claims = v ? v.claims : cl.claims.map((c) => ({ ...c, ok: true }));
  let h = v ? `<p class="callout info"><strong>Остання автоматична перевірка: ${esc(v.date)}.</strong> Підтверджено цитат: <strong>${v.ok} з ${v.total}</strong>. Змінених редакцій джерел: <strong>${v.editionChanged}</strong>.${v.coverage ? ` Посилань «п./ст.» у текстах сайту, для яких є перевірена цитата: <strong>${v.coverage.covered} з ${v.coverage.total} (${v.coverage.pct}%)</strong>; решта потребує ручної звірки.` : ''}</p>` : '';
  h += '<h2>Джерела й редакції</h2><ul>' + Object.values(srcs).map((s) => `<li><a href="${s.url}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a>${s.edition ? ` — редакція від ${esc(s.edition)}` : ''}</li>`).join('') + '</ul>';
  h += '<h2>Перелік перевірених тверджень</h2><p class="muted">Кожне твердження супроводжується дослівною цитатою з норми. Скрипт повторює перевірку на актуальних текстах.</p>';
  const by = {};
  for (const c of claims) (by[c.src] = by[c.src] || []).push(c);
  for (const [id, list] of Object.entries(by)) {
    h += `<details class="ground"><summary>${esc(srcs[id].title)} <span class="ref">${list.length} тверджень</span></summary><ul class="claims">` +
      list.map((c) => `<li><strong>${esc(c.ref)}.</strong> ${esc(c.claim)}<blockquote>«${esc(c.quote)}»</blockquote></li>`).join('') + '</ul></details>';
  }
  return h;
}

function renderBlocks(blocks) {
  // h2 з "fold": true і всі блоки до наступного h2 згортаються в <details>
  const folded = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.t === 'h2' && b.fold) {
      const inner = [];
      while (i + 1 < blocks.length && blocks[i + 1].t !== 'h2') inner.push(blocks[++i]);
      folded.push({ t: '_fold', title: b.x, inner });
    } else folded.push(b);
  }
  return folded
    .map((b) => {
      switch (b.t) {
        case '_fold': return `<details class="fold"><summary>${inline(b.title)}</summary>${renderBlocks(b.inner)}</details>`;
        case 'h2': return `<h2>${inline(b.x)}</h2>`;
        case 'p': return `<p>${inline(b.x)}</p>`;
        case 'ul': return `<ul>${b.items.map((i) => `<li>${inline(i)}</li>`).join('')}</ul>`;
        case 'ol': return `<ol class="steps">${b.items.map((i) => `<li>${inline(i)}</li>`).join('')}</ol>`;
        case 'check':
          return `<ul class="check">${b.items.map((i) => `<li>${inline(i)}</li>`).join('')}</ul>`;
        case 'callout': {
          const kind = b.kind || 'info';
          if (kind === 'lawyer') { LAWYER_NOTES.push({ page: curPage, title: b.title || '', x: b.x }); if (!SHOW_NOTES) return ''; }
          const title = b.title || (kind === 'lawyer' ? 'Потребує перевірки юристом' : '');
          return `<aside class="callout ${kind}" role="note">${title ? `<strong class="ct">${esc(title)}</strong>` : ''}<p>${inline(b.x)}</p></aside>`;
        }
        case 'links':
          return `<ul class="linklist">${b.items.map((i) => `<li><a class="btn secondary" href="${i.u}">${esc(i.t)}</a></li>`).join('')}</ul>`;
        case 'lawyer':
          return `<p><a class="btn big" id="lawyer-btn" href="%%LAWYER_URL%%" target="_blank" rel="%%LAWYER_REL%%">Написати адвокату в Telegram</a></p><p class="muted" data-disc>%%LAWYER_DISCLOSURE%%</p><p class="muted" id="bpd">Безкоштовна лінія: <a href="tel:0800213103">0 800 213 103</a></p>`;
        case 'vnav':
          return `<div id="vnav" class="vnav"><noscript><p class="callout warn">Для навігатора потрібен JavaScript. Нижче — повний перелік підстав.</p></noscript></div><script type="application/json" id="vdata">${JSON.stringify(vdata).replace(/</g, '\\u003c')}</script>`;
        case 'vall':
          return (
            '<h2>Усі підстави (повний перелік у цьому навігаторі)</h2>' +
            Object.values(vdata.grounds)
              .map(
                (g) =>
                  `<details class="ground"><summary>${esc(g.t)} <span class="ref">${esc(g.ref)}</span></summary><ul>${[...g.docs, ...(g.notes || [])].map((d) => `<li>${inline(d)}</li>`).join('')}</ul></details>`
              )
              .join('')
          );
        case 'situations':
          return (
            '<h2>Що сталося?</h2>' +
            situations.groups
              .map(
                (g) =>
                  `<h3 class="grp">${esc(g.title)}</h3><ul class="linklist">${g.items
                    .map((id) => `<li><a class="btn secondary" href="/sytuatsiyi/${id}/">${esc(situations.situations[id].label)}</a></li>`)
                    .join('')}</ul>`
              )
              .join('') +
            '<h3 class="grp">Рідну людину забрали</h3><ul class="linklist"><li><a class="btn secondary" href="/zabraly/">Рідну людину забрали — що робити</a></li></ul>'
          );
        case 'urgent_cta':
          return '<p><a class="btn big sos" href="/terminovo/">Терміново: передати справу юристу</a></p><p class="muted">Коротка форма: що сталося → готове повідомлення для адвоката в Telegram. Навіть якщо людину вже забрали в ТЦК.</p>';
        case 'urgent':
          return fs.readFileSync(path.join(SRC, 'urgent.html'), 'utf8');
        case 'zaiava':
          return fs
            .readFileSync(path.join(SRC, 'zaiava.html'), 'utf8')
            .replace('%%ZDATA%%', JSON.stringify(Object.fromEntries(Object.entries(vdata.grounds).map(([k, g]) => [k, { t: g.t, ref: g.ref, docs: g.docs, notes: g.notes || [], zaiava: g.zaiava !== false, s581: g.s581 || '' }]))).replace(/</g, '\\u003c'));
        case 'verification':
          return renderVerification();
        case 'generator':
          return fs.readFileSync(path.join(SRC, 'generator.html'), 'utf8');
        default:
          throw new Error('Невідомий блок: ' + b.t);
      }
    })
    .join('\n');
}

function badge(ids) {
  if (!ids || !ids.length) return '';
  return `<p class="verified">${ICON.check}<span>Ключові норми звірено з офіційним текстом · <time datetime="${VERIFIED_ISO}">${VERIFIED}</time> · <a href="/pro-sait/">як ми перевіряємо</a></span></p>`;
}

function sourcesBlock(ids) {
  if (!ids || !ids.length) return `<p class="muted">Перевірено: ${VERIFIED}</p>`;
  return `<section class="sources" aria-labelledby="src-h"><h2 id="src-h">Джерела</h2><ul>${ids
    .map((id) => {
      const s = sources.items[id];
      if (!s) throw new Error('Невідоме джерело: ' + id);
      return `<li><a href="${s.u}" target="_blank" rel="noopener noreferrer">${esc(s.t)}</a></li>`;
    })
    .join('')}</ul><p class="muted">Перевірено: <time datetime="${VERIFIED_ISO}">${VERIFIED}</time></p></section>`;
}

function layout({ title, description, urlPath, body, nav, scripts = [], jsonld = [], noSos = false, ogType = 'website', sourceIds = [], robots = 'index' }) {
  const canonical = `${SITE}${urlPath}`;
  const navHtml = NAV.map(
    (n) => `<a href="${n.href}" class="nav-i${n.id === nav ? ' on' : ''}"${n.id === nav ? ' aria-current="page"' : ''}>${ICON[n.icon]}<span>${n.label}</span></a>`
  );
  // SOS-кнопка в центрі нижньої навігації
  const sos = `<a href="/mene-zupynyly/" class="nav-sos${nav === 'stop' ? ' on' : ''}" aria-label="Мене зупинили — що робити">${ICON.sos}<span>Мене зупинили</span></a>`;
  const bottom = [navHtml[0], navHtml[1], sos, navHtml[2], navHtml[3]].join('');
  return `<!doctype html>
<html lang="uk" data-v="%%BUILD%%">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="${robots === 'index' ? '%%ROBOTS_INDEX%%' : 'noindex,follow'}">
<link rel="canonical" href="${canonical}">
<link rel="alternate" hreflang="uk" href="${canonical}">
<link rel="alternate" hreflang="x-default" href="${canonical}">
<meta name="application-name" content="Мої права">
<meta name="format-detection" content="telephone=no">
<meta name="theme-color" content="#14213d">
<meta name="color-scheme" content="light dark">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="/assets/icon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="preload" href="/assets/style.css?v=%%BUILD%%" as="style">
<link rel="apple-touch-icon" href="/assets/icon-192.png">
<meta property="og:site_name" content="Мої права">
<meta property="og:type" content="${ogType}">
<meta property="og:locale" content="uk_UA">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${SITE}/assets/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Мої права — навігатор для військовозобов’язаних та їхніх родин">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${SITE}/assets/og.png">
<script>try{var t=localStorage.getItem('theme');if(t)document.documentElement.dataset.theme=t}catch(e){}</script>
<link rel="stylesheet" href="/assets/style.css?v=%%BUILD%%">
${jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('\n')}
</head>
<body class="${noSos ? 'no-sos' : ''}">
<a class="skip" href="#main">Перейти до змісту</a>
<header class="top">
  <a class="brand" href="/" aria-label="Мої права — на головну"><span class="logo" aria-hidden="true">§</span> Мої права</a>
  <div class="top-act">
    <a class="icon-btn" href="/poshuk/" aria-label="Пошук по сайту">${ICON.search}</a>
    <button class="icon-btn" id="theme-btn" type="button" aria-label="Перемкнути світлу/темну тему">${ICON.theme}</button>
  </div>
</header>
<main id="main" tabindex="-1">
${body}
</main>
<footer class="foot">
  <p class="disclaimer"><strong>Це довідкова інформація, а не юридична консультація.</strong> Закони змінюються: перевіряйте актуальні редакції та за потреби звертайтесь до юриста.</p>
  ${sourcesBlock(sourceIds)}
  <p class="foot-links"><a href="/faq/">Часті запитання</a> · <a href="/pro-sait/">Як ми перевіряємо</a> · <a href="/pryvatnist/">Політика конфіденційності</a> · <a href="/poshuk/">Пошук</a></p>
  <!--donate--><p class="support"><a class="btn secondary" href="%%DONATE_URL%%" target="_blank" rel="noopener noreferrer">Підтримати проєкт</a> <span class="muted">Сайт безкоштовний, без реклами й трекерів.</span></p><!--/donate-->
  <p class="muted">Сайт не збирає ваших даних і не містить даних про місця й час роботи ТЦК, блокпостів чи поліції.</p>
</footer>
<nav class="bottom" aria-label="Основна навігація">${bottom}</nav>
<script src="/assets/app.js?v=%%BUILD%%" defer></script>
${scripts.map((s) => `<script src="/assets/${s}?v=%%BUILD%%" defer></script>`).join('\n')}
</body>
</html>
`;
}

const out = [];
function write(urlPath, html) {
  const dir = path.join(DIST, urlPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
}

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

// --- контентні сторінки
const searchIndex = [];
function strings(blocks) {
  const acc = [];
  for (const b of blocks) {
    if (b.x) acc.push(plain(b.x));
    if (b.items) acc.push(...b.items.map((i) => (typeof i === 'string' ? plain(i) : i.t)));
  }
  return acc.join(' ');
}

for (const p of pages) {
  const urlPath = `/${p.slug}/`;
  curPage = p.slug;
  const body = `<article class="page">
<h1>${esc(p.h1)}</h1>
<p class="lead">${esc(p.lead)}</p>
${p.slug === 'mene-zupynyly' ? '<p class="timer muted">Оберіть свою ситуацію у списку нижче. Загальні правила під списком читаються за 1–2 хвилини.</p>' : ''}
${renderBlocks(p.blocks)}
${badge(p.sources)}
</article>`;
  const scripts = [];
  if (p.slug === 'skarha') scripts.push('generator.js');
  if (p.slug === 'terminovo') scripts.push('urgent.js');
  if (p.slug === 'zaiava-vidstrochka') scripts.push('zaiava.js');
  if (p.slug === 'vidstrochka') scripts.push('vnav.js');
  const jsonld = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: p.h1,
      description: p.description,
      url: SITE + urlPath,
      inLanguage: 'uk',
      dateModified: VERIFIED_ISO,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Головна', item: SITE + '/' },
        { '@type': 'ListItem', position: 2, name: p.h1, item: SITE + urlPath },
      ],
    },
  ];
  write(urlPath, layout({ title: p.title, description: p.description, urlPath, body, nav: p.nav, scripts, jsonld, noSos: p.slug === 'mene-zupynyly', ogType: 'article', sourceIds: p.sources }));
  let text = strings(p.blocks);
  if (p.slug === 'vidstrochka') text += ' ' + Object.values(vdata.grounds).map((g) => g.t + ' ' + g.ref + ' ' + g.docs.map(plain).join(' ')).join(' ');
  searchIndex.push({ u: urlPath, t: p.h1, d: p.description, x: text });
  out.push({ u: urlPath, p: 0.8 });
}

// --- Ситуації
for (const [id, st] of Object.entries(situations.situations)) {
  const urlPath = `/sytuatsiyi/${id}/`;
  const body = `<article class="page">
<p class="crumb"><a href="/mene-zupynyly/">← Усі ситуації</a></p>
<h1>${esc(st.h1)}</h1>
<p class="lead">${esc(st.lead)}</p>
<aside class="callout info now" role="note"><strong class="ct">Прямо зараз</strong><p>${inline(st.now || 'Зберігайте спокій і не чиніть опір. Попросіть назвати прізвище, посаду та причину вимоги. Потрібна допомога — **0 800 213 103**. Кроки й норми — нижче.')}</p></aside>
<h2>Що робити</h2>
<ul class="check">${st.do.map((i) => `<li>${inline(i)}</li>`).join('')}</ul>
<h2>Чого не робити</h2>
<ul>${st.dont.map((i) => `<li>${inline(i)}</li>`).join('')}</ul>
<details class="fold"><summary>Чому так: норми й подробиці</summary>
<ul>${st.know.map((i) => `<li>${inline(i)}</li>`).join('')}</ul></details>
${st.lawyer && (LAWYER_NOTES.push({ page: 'sytuatsiyi/' + (st.slug || st.id || st.label), title: '', x: st.lawyer }), SHOW_NOTES) ? `<aside class="callout lawyer" role="note"><strong class="ct">Потребує перевірки юристом</strong><p>${inline(st.lawyer)}</p></aside>` : ''}
${badge(st.sources)}
${st.plain ? '' : `<aside class="callout warn" role="note"><strong class="ct">Дії здаються незаконними?</strong><p>Не чиніть опір. Зафіксуйте факти й передайте їх юристу — навіть якщо людину вже забрали до ТЦК, юрист може діяти одразу.</p></aside>`}
<p><a class="btn big sos" href="/terminovo/">Передати справу юристу</a></p>
<ul class="linklist"><li><a class="btn secondary" href="/skarha/">Скласти скаргу</a></li><li><a class="btn secondary" href="/vidstrochka/">Перевірити підстави відстрочки</a></li><li><a class="btn secondary" href="/mene-zupynyly/">Інші ситуації</a></li></ul>
</article>`;
  const jsonld = [
    { '@context': 'https://schema.org', '@type': 'WebPage', name: st.h1, description: st.description, url: SITE + urlPath, inLanguage: 'uk', dateModified: VERIFIED_ISO },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Головна', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: 'Мене зупинили', item: SITE + '/mene-zupynyly/' },
      { '@type': 'ListItem', position: 3, name: st.h1, item: SITE + urlPath } ] },
  ];
  write(urlPath, layout({ title: st.h1 + ' | Мої права', description: st.description, urlPath, body, nav: 'stop', jsonld, ogType: 'article', sourceIds: st.sources }));
  searchIndex.push({ u: urlPath, t: st.h1, d: st.description, x: [st.label, st.lead, ...st.do, ...st.dont, ...st.know].map(plain).join(' ') });
  out.push({ u: urlPath, p: 0.7 });
}

// --- FAQ
{
  const urlPath = '/faq/';
  const body = `<article class="page"><h1>${esc(faq.h1)}</h1><p class="lead">${esc(faq.lead)}</p>
${faq.items.map((i) => `<details class="faq"><summary>${esc(i.q)}</summary><p>${inline(i.a)}</p></details>`).join('\n')}
</article>`;
  const jsonld = [
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.items.map((i) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: plain(i.a) } })),
    },
  ];
  write(urlPath, layout({ title: faq.title, description: faq.description, urlPath, body, nav: 'more', jsonld, sourceIds: faq.sources }));
  searchIndex.push({ u: urlPath, t: faq.h1, d: faq.description, x: faq.items.map((i) => i.q + ' ' + plain(i.a)).join(' ') });
  out.push({ u: urlPath, p: 0.7 });
}

// --- Пошук
{
  const urlPath = '/poshuk/';
  const body = `<article class="page"><h1>Пошук по сайту</h1>
<form id="sf" role="search" class="search" action="/poshuk/" method="get"><label for="q" class="sr">Що шукаєте?</label>
<input id="q" name="q" type="search" placeholder="Напр.: повістка, відстрочка, блокпост" autocomplete="off" enterkeyhint="search">
<button class="btn" type="submit">Знайти</button></form>
<div id="results" aria-live="polite"></div>
<noscript><p class="callout warn">Для пошуку потрібен JavaScript. Скористайтесь <a href="/faq/">Частими запитаннями</a> або головною сторінкою.</p></noscript>
</article>`;
  write(urlPath, layout({ title: 'Пошук по сайту | Мої права', description: 'Пошук по сторінках сайту «Мої права»: повістка, відстрочка, блокпост, скарга.', urlPath, body, nav: 'more', scripts: ['search.js'], robots: 'noindex' }));
}

// --- Головна
{
  const tiles = [
    { u: '/perevirka-povistky/', t: 'Перевірити повістку', d: 'QR-код, Резерв+, ознаки недійсної', i: 'doc', c: 'blue' },
    { u: '/vidstrochka/', t: 'Відстрочка', d: 'Які підстави мені підходять', i: 'clock', c: 'green' },
    { u: '/zaiava-vidstrochka/', t: 'Заява про відстрочку', d: 'Чернетка та перелік документів', i: 'edit', c: 'green' },
    { u: '/skarha/', t: 'Скласти скаргу', d: 'Омбудсман, поліція, прокуратура, штраф, ВЛК', i: 'edit', c: 'amber' },
    { u: '/rezerv-plus/', t: 'Резерв+: що передбачено', d: 'QR-код, електронний документ, автовідстрочка', i: 'phone', c: 'blue' },
    { u: '/slovnyk/', t: 'Словник термінів', d: 'Прості визначення з норм', i: 'book', c: 'blue' },
    { u: '/dlia-rodyn/', t: 'Папка документів', d: 'Що зібрати заздалегідь', i: 'folder', c: 'amber' },
    { u: '/zabraly/', t: 'Рідну людину забрали', d: 'Що робити в перші години', i: 'family', c: 'red' },
    { u: '/terminovo/', t: 'Передати справу юристу', d: 'Швидка заявка: людину зупинили чи забрали', i: 'sos', c: 'red' },
    { u: '/dopomoha/', t: 'Юридична допомога', d: '0 800 213 103 та заявка адвокату', i: 'scale', c: 'blue' },
    { u: '/pro-sait/', t: 'Як ми перевіряємо', d: 'Цитати з норм і автоперевірка', i: 'check', c: 'green' },
    { u: '/vidpyska-tck/', t: 'ТЦК відповіло «все законно»', d: 'Що робити після відписки', i: 'edit', c: 'amber' },
    { u: '/znyattia-vyklyuchennia/', t: 'Знятий чи виключений з обліку', d: 'У чому різниця за законом', i: 'doc', c: 'blue' },
    { u: '/sud/', t: 'Суд: як оскаржити дії ТЦК', d: 'Строки, куди подавати, що додати', i: 'scale', c: 'amber' },
    { u: '/faq/', t: 'Часті запитання', d: 'Короткі відповіді з джерелами', i: 'search', c: 'blue' },
  ];
  const body = `<section class="hero">
<h1>Мої права</h1>
<p class="lead">Навігатор для військовозобов’язаних та їхніх родин. Знай свої права й обов’язки. Дій за законом. Фіксуй порушення.</p>
<a class="btn sos big" href="/mene-zupynyly/">${ICON.sos}<span>Мене зупинили — що робити</span></a>
<p><a class="btn big amber" href="/terminovo/">Терміново: передати справу юристу</a></p>
<ul class="quick"><li><a class="btn secondary" href="/sytuatsiyi/politsiya-pokrokovo/">Зупинила поліція</a></li><li><a class="btn secondary" href="/sytuatsiyi/tck-perevirka/">ТЦК / вручають повістку</a></li><li><a class="btn secondary" href="/zabraly/">Рідну людину забрали</a></li><li><a class="btn secondary" href="/vidstrochka/">Потрібна відстрочка</a></li><li><a class="btn secondary" href="/vidpyska-tck/">ТЦК відповіло відпискою</a></li></ul>
<ul class="trust" aria-label="Чому сайту можна довіряти"><li>${ICON.check}Норми — з посиланням на джерело</li><li>${ICON.check}Працює офлайн</li><li>${ICON.check}Без трекерів і реєстрації</li></ul>
</section>
<ul class="tiles">${tiles.map((t) => `<li><a class="tile c-${t.c || 'blue'}" href="${t.u}">${ICON[t.i]}<span class="tt">${esc(t.t)}</span><span class="td">${esc(t.d)}</span></a></li>`).join('')}</ul>
<aside class="callout info"><p><strong>Принципи сайту.</strong> Нейтральний тон; кожне твердження спирається на офіційне джерело; жодних карт чи стрічок про ТЦК, блокпости й поліцію; жодних порад щодо ухилення чи підробок; усі дані залишаються на вашому пристрої. <a href="/pryvatnist/">Докладніше</a></p></aside>`;
  const jsonld = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Мої права',
      url: SITE + '/',
      inLanguage: 'uk',
      publisher: { '@type': 'Organization', name: 'Мої права', url: SITE + '/', logo: { '@type': 'ImageObject', url: SITE + '/assets/icon-512.png' } },
      potentialAction: { '@type': 'SearchAction', target: SITE + '/poshuk/?q={search_term_string}', 'query-input': 'required name=search_term_string' },
    },
  ];
  write('/', layout({ title: 'Мої права — навігатор для військовозобов’язаних та їхніх родин', description: 'Що робити, якщо зупинили, як перевірити повістку, оформити відстрочку й подати скаргу. Довідник за офіційними джерелами; працює офлайн.', urlPath: '/', body, nav: 'home', jsonld, sourceIds: ['law3543', 'pkmu560', 'pkmu1455', 'bpd'] }));
  searchIndex.push({ u: '/', t: 'Головна', d: 'Мої права: навігатор', x: tiles.map((t) => t.t + ' ' + t.d).join(' ') });
  out.push({ u: '/', p: 1.0 });
}

// --- Офлайн-запасна сторінка
write('/offline/', layout({ title: 'Немає з’єднання | Мої права', description: 'Сторінка недоступна офлайн.', urlPath: '/offline/', nav: '', robots: 'noindex', body: `<article class="page"><h1>Немає з’єднання</h1><p class="lead">Цю сторінку ще не збережено на пристрої. Відкрийте <a href="/">головну</a>, <a href="/mene-zupynyly/">«Мене зупинили»</a> або <a href="/skarha/">генератор скарг</a> — вони працюють без інтернету.</p></article>` }));

// --- Ресурси
const assets = path.join(DIST, 'assets');
fs.mkdirSync(assets, { recursive: true });
for (const f of fs.readdirSync(path.join(SRC, 'assets'))) fs.copyFileSync(path.join(SRC, 'assets', f), path.join(assets, f));
fs.writeFileSync(path.join(assets, 'search-index.json'), JSON.stringify(searchIndex));
fs.copyFileSync(path.join(SRC, 'manifest.webmanifest'), path.join(DIST, 'manifest.webmanifest'));

// версія збірки (для кешу)
const hash = crypto.createHash('sha1');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : hash.update(fs.readFileSync(path.join(d, e.name)))));
walk(DIST);
const build = hash.digest('hex').slice(0, 8);

const precache = ['/', '/offline/', '/mene-zupynyly/', '/blokpost/', '/povistka/', '/perevirka-povistky/', '/skarha/', '/vidstrochka/', '/zabraly/', '/dopomoha/', '/faq/', '/poshuk/', '/pryvatnist/', '/shtraf/', '/terminovo/', '/zaiava-vidstrochka/', '/dlia-rodyn/', '/rezerv-plus/', '/slovnyk/', '/pro-sait/', '/vidpyska-tck/', '/znyattia-vyklyuchennia/', '/sud/', ...Object.keys(situations.situations).map((i) => `/sytuatsiyi/${i}/`), '/assets/style.css', '/assets/app.js', '/assets/generator.js', '/assets/vnav.js', '/assets/search.js', '/assets/urgent.js', '/assets/zaiava.js', '/assets/search-index.json', '/assets/icon.svg', '/assets/icon-192.png', '/assets/favicon-48.png', '/manifest.webmanifest'];
for (const u of precache) {
  const f = u.endsWith('/') ? path.join(DIST, u, 'index.html') : path.join(DIST, u);
  if (!fs.existsSync(f)) throw new Error('Немає файлу для precache: ' + u);
}
const sw = fs.readFileSync(path.join(SRC, 'sw.js'), 'utf8').replace('%%BUILD%%', build).replace('%%PRECACHE%%', JSON.stringify(precache.map((u) => u + (u.startsWith('/assets/') && /\.(css|js)$/.test(u) ? `?v=${build}` : ''))));
fs.writeFileSync(path.join(DIST, 'sw.js'), sw);

// підставляємо версію збірки у HTML
(function patch(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) patch(p);
    else if (e.name.endsWith('.html')) fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/%%BUILD%%/g, build));
  }
})(DIST);

fs.writeFileSync(path.join(DIST, 'pages.json'), JSON.stringify({ built: new Date().toISOString().slice(0, 10), pages: out }));
fs.writeFileSync(path.join(ROOT, 'docs', 'LAWYER_REVIEW.md'), '# Що звірити юристу (лише для власника, на сайті не показується)\n\nАвтоматично збирається `npm run build`. Показати на сторінках для себе: `SHOW_NOTES=1 npm run build` (не комітити).\n\n' + LAWYER_NOTES.map((n) => `## /${n.page}/\n${n.x.replace(/\n/g, ' ')}\n`).join('\n'));
console.log(`Зібрано ${out.length + 1} сторінок, версія ${build}`);
