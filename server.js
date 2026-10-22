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
const pagesMeta = JSON.parse(fs.readFileSync(path.join(DIST, 'pages.json'), 'utf8'));

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
  const html = htmlCache.get(key)
    .replace(/%%SITE_URL%%/g, origin(req))
    .replace(/%%LAWYER_URL%%/g, LAWYER_URL);
  res.status(status).type('html').set('Cache-Control', 'no-cache').send(html);
}

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\n\nSitemap: ${origin(req)}/sitemap.xml\n`);
});

app.get('/sitemap.xml', (req, res) => {
  const o = origin(req);
  const today = new Date().toISOString().slice(0, 10);
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
