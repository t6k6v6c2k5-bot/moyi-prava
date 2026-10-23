'use strict';
const express = require('express');
const compression = require('compression');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const DIST = path.join(__dirname, 'dist');
if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  const r = spawnSync(process.execPath, [path.join(__dirname, 'scripts', 'build.js')], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(1);
}

// Змінні оточення
const PORT = process.env.PORT || 3000;
const SITE_URL = (process.env.SITE_URL || '').replace(/\/+$/, '');
// Індексація пошуковими системами вмикається лише явно: INDEXING=on (разом із SITE_URL = фінальний домен).
const INDEXING = String(process.env.INDEXING || '').toLowerCase() === 'on';
const REDIRECT_TO_SITE_URL = process.env.REDIRECT_TO_SITE_URL === '1';
const ROBOTS_INDEX = INDEXING ? 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1' : 'noindex,nofollow';
// Монетизація (необов’язково): DONATE_URL — кнопка «Підтримати проєкт»; LAWYER_PARTNER=on — позначає кнопки адвоката як партнерські (rel=sponsored + розкриття).
const donateRaw = (process.env.DONATE_URL || '').trim();
const DONATE_URL = /^https:\/\/[^\s"'<>]+$/.test(donateRaw) ? donateRaw : '';
const LAWYER_PARTNER = String(process.env.LAWYER_PARTNER || '').toLowerCase() === 'on';
const LAWYER_REL = LAWYER_PARTNER ? 'sponsored noopener noreferrer' : 'noopener noreferrer';
const LAWYER_DISCLOSURE = LAWYER_PARTNER ? 'Партнерське посилання: сайт може отримувати винагороду від адвоката за звернення. Це не впливає на зміст інформації на сайті. Умови роботи адвоката ви узгоджуєте з ним самостійно.' : '';
const lawyerRaw = (process.env.LAWYER_TELEGRAM_URL || '').trim();
// приймаємо лише https://t.me/… або tg://…
const LAWYER_URL = /^(https:\/\/(t\.me|telegram\.me)\/|tg:\/\/)[^\s"'<>]+$/.test(lawyerRaw) ? lawyerRaw : 'tel:0800213103';

// HTML завантажуємо в пам'ять; SITE_URL підставляємо під час відповіді
const htmlCache = new Map();
(function load(dir, base) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) load(p, base + e.name + '/');
    else if (e.name === 'index.html') htmlCache.set(base, fs.readFileSync(p, 'utf8'));
  }
})(DIST, '/');
const pagesInfo = JSON.parse(fs.readFileSync(path.join(DIST, 'pages.json'), 'utf8'));
const pagesMeta = pagesInfo.pages;

// хеш inline-скрипта теми для CSP
const sample = htmlCache.get('/');
const inlineThemeScript = /<script>(try\{var t=[^<]+)<\/script>/.exec(sample);
const themeHash = inlineThemeScript ? crypto.createHash('sha256').update(inlineThemeScript[1]).digest('base64') : '';
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'sha256-${themeHash}'`,
  "style-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join('; ');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);
app.use(compression());
app.use((req, res, next) => {
  if (REDIRECT_TO_SITE_URL && SITE_URL && req.hostname !== new URL(SITE_URL).hostname) return res.redirect(301, SITE_URL + req.originalUrl);
  if (!INDEXING) res.set('X-Robots-Tag', 'noindex, nofollow');
  if (req.protocol === 'https') res.set('Strict-Transport-Security', 'max-age=31536000');
  res.set({
    'Content-Security-Policy': CSP,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  });
  next();
});

const origin = (req) => SITE_URL || `${req.protocol}://${req.get('host')}`;

function sendHtml(req, res, key, status = 200) {
  let html = htmlCache.get(key)
    .replace(/%%SITE_URL%%/g, origin(req))
    .replace(/%%LAWYER_URL%%/g, LAWYER_URL)
    .replace(/%%LAWYER_REL%%/g, LAWYER_REL)
    .replace(/%%LAWYER_DISCLOSURE%%/g, LAWYER_DISCLOSURE)
    .replace(/<p class="muted" data-disc><\/p>/g, '')
    .replace(/%%ROBOTS_INDEX%%/g, ROBOTS_INDEX);
  html = DONATE_URL ? html.replace(/%%DONATE_URL%%/g, DONATE_URL) : html.replace(/<!--donate-->[\s\S]*?<!--\/donate-->/g, '');
  if (LAWYER_URL.startsWith('tel:')) html = html.replace('Написати адвокату в Telegram', 'Заявка адвокату недоступна — зателефонуйте 0 800 213 103').replace('Надіслати в Telegram', 'Зателефонувати 0 800 213 103').replace(/ target="_blank" rel="noopener noreferrer">(Заявка адвокату недоступна|Зателефонувати)/g, '>$1');
  res.status(status).type('html').set('Cache-Control', 'no-cache').send(html);
}

app.get('/robots.txt', (req, res) => {
  if (!INDEXING) return res.type('text/plain').send('User-agent: *\nDisallow: /\n');
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /poshuk/\nDisallow: /offline/\n\nSitemap: ${origin(req)}/sitemap.xml\n`);
});

app.get('/favicon.ico', (req, res) => res.set('Cache-Control', 'public, max-age=86400').type('image/png').sendFile(path.join(DIST, 'assets', 'favicon-48.png')));

app.get('/sitemap.xml', (req, res) => {
  const o = origin(req);
  const today = pagesInfo.built;
  const urls = pagesMeta
    .map((p) => `  <url><loc>${o}${p.u}</loc><lastmod>${today}</lastmod><priority>${p.p}</priority></url>`)
    .join('\n');
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
});

app.get('/sw.js', (req, res) => {
  res.set('Cache-Control', 'no-cache').type('application/javascript').sendFile(path.join(DIST, 'sw.js'));
});

// HTML-сторінки
app.get(/^\/(?:[a-z0-9-]+\/)*$/, (req, res, next) => {
  if (htmlCache.has(req.path)) return sendHtml(req, res, req.path);
  next();
});
// /faq → /faq/
app.get(/^\/[a-z0-9-]+$/, (req, res, next) => {
  if (htmlCache.has(req.path + '/')) return res.redirect(301, req.path + '/' + (req._parsedUrl.search || ''));
  next();
});

// Ресурси: URL з ?v=… — надовго; без версії — на годину
app.use('/assets', (req, res, next) => {
  res.set('Cache-Control', req.query.v ? 'public, max-age=31536000, immutable' : 'public, max-age=3600');
  next();
});
app.use(
  express.static(DIST, {
    index: false,
    setHeaders(res, file) {
      if (file.endsWith('.webmanifest')) res.type('application/manifest+json');
      if (!/[\\/]assets[\\/]/.test(file)) res.set('Cache-Control', 'no-cache');
    },
  })
);

app.use((req, res) => {
  res.status(404).type('html').set('Cache-Control', 'no-cache').send(
    '<!doctype html><html lang="uk"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Сторінку не знайдено</title><body style="font:18px system-ui;padding:24px"><h1>Сторінку не знайдено</h1><p><a href="/">На головну</a> · <a href="/mene-zupynyly/">Мене зупинили — що робити</a></p></body></html>'
  );
});

app.listen(PORT, () => console.log(`Мої права: http://localhost:${PORT}`));
