'use strict';
// Машинна перевірка тверджень сайту проти ПЕРВОДЖЕРЕЛ (zakon.rada.gov.ua).
//   npm run verify            — завантажує свіжі тексти, перевіряє цитати, редакції та посилання «п./ст.»
//   npm run verify -- --offline  — використовує кеш у .verify-cache/ (без мережі)
// Результат: docs/VERIFICATION.md та content/verification.json (дата, статистика). Код виходу ≠ 0, якщо щось не підтверджено.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const CACHE = path.join(ROOT, '.verify-cache');
const offline = process.argv.includes('--offline');
const claimsPath = path.join(ROOT, 'content', 'claims.json');
const claimsFile = JSON.parse(fs.readFileSync(claimsPath, 'utf8'));
const { sources, claims } = claimsFile;

const norm = (s) =>
  String(s)
    .replace(/[’ʼ‘`´]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function htmlToText(html) {
  let t = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '');
  t = t.replace(/<\/(p|div|h\d|li|tr)>/g, '\n').replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '');
  t = t
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&');
  return t;
}

function fetchSource(id, url) {
  fs.mkdirSync(CACHE, { recursive: true });
  const file = path.join(CACHE, id + '.txt');
  if (offline) {
    if (!fs.existsSync(file)) throw new Error('Немає кешу для ' + id);
    return fs.readFileSync(file, 'utf8');
  }
  if (!process.argv.includes('--fresh') && fs.existsSync(file) && Date.now() - fs.statSync(file).mtimeMs < 6 * 3600 * 1000) return fs.readFileSync(file, 'utf8');
  let last;
  for (let i = 0; i < 4; i++) {
    try {
      const html = execFileSync('curl', ['-sS', '--compressed', '-m', '120', '-A', 'Mozilla/5.0', url.replace(/\/?$/, '/print')], { encoding: 'utf8', maxBuffer: 1 << 28 });
      const text = htmlToText(html);
      if (/Редакція від/.test(text)) { fs.writeFileSync(file, text); return text; }
      last = new Error('сторінка без «Редакція від»');
    } catch (e) { last = e; }
    execFileSync('sleep', [String(2 + i * 2)]);
  }
  if (fs.existsSync(file)) { console.log('УВАГА: ' + id + ' — не вдалося оновити, використано кеш (' + fs.statSync(file).mtime.toISOString().slice(0, 10) + ')'); staleCache.push(id); return fs.readFileSync(file, 'utf8'); }
  throw new Error('Не вдалося завантажити ' + id + ': ' + (last && last.message));
}

const staleCache = [];
const crypto = require('crypto');
const updateHashes = process.argv.includes('--update-hashes');
const pointStart = /^\s*\d+(?:[.\-]\d+)*\.\s/;
// Витягує текст статті/пункту, на який посилається claim (за першим «ст. N» або «п. N» у ref)
function section(raw, ref) {
  const lines = raw.split('\n');
  let m = /ст\.\s*(\d+(?:-\d+)?)/.exec(ref);
  if (m) {
    const re = new RegExp('^\\s*Стаття ' + m[1].replace('-', '\\-') + '\\.\\s');
    const i = lines.findIndex((l) => re.test(l));
    if (i < 0) return null;
    let j = i + 1;
    while (j < lines.length && !/^\s*Стаття \d/.test(lines[j])) j++;
    return lines.slice(i, j).join('\n');
  }
  m = /п\.\s*(\d+(?:[.\-]\d+)*)/.exec(ref);
  if (m) {
    const num = m[1];
    const re = new RegExp('^\\s*' + num.replace(/\./g, '\\.').replace('-', '\\-') + '\\.\\s');
    const i = lines.findIndex((l) => re.test(l));
    if (i < 0) return null;
    let j = i + 1;
    while (j < lines.length && !pointStart.test(lines[j])) j++;
    return lines.slice(i, j).join('\n');
  }
  return null;
}
const results = { sources: {}, claims: [], refs: [] };
let failed = 0, editionChanged = 0;

// 1. Джерела й редакції
const texts = {};
for (const [id, s] of Object.entries(sources)) {
  const raw = fetchSource(id, s.url);
  texts[id] = { raw, n: norm(raw) };
  const m = /Редакція від (\d{2}\.\d{2}\.\d{4})/.exec(raw);
  const ed = m ? m[1] : null;
  const changed = s.edition && ed !== s.edition;
  results.sources[id] = { title: s.title, url: s.url, edition: ed, expected: s.edition, changed: !!changed, cached: staleCache.includes(id) };
  if (changed) { editionChanged++; console.log(`ЗМІНИЛАСЬ РЕДАКЦІЯ ${id}: було ${s.edition}, зараз ${ed}`); }
}

// 2. Цитати
for (const c of claims) {
  const src = texts[c.src];
  let ok = !!src && (c.absent ? true : src.n.includes(norm(c.quote)));
  let note = '';
  if (!ok) { failed++; console.log(`НЕ ЗНАЙДЕНО [${c.id}] ${c.src} ${c.ref}: «${c.quote.slice(0, 80)}…»`); }
  else {
    const sec = section(src.raw, c.ref);
    if (sec == null) { ok = false; failed++; note = 'розділ не знайдено'; console.log(`РОЗДІЛ НЕ ЗНАЙДЕНО [${c.id}] ${c.src} ${c.ref}`); }
    else if (c.absent && norm(sec).toLowerCase().includes(c.absent.toLowerCase())) { ok = false; failed++; note = 'термін присутній'; console.log(`ТЕРМІН ПРИСУТНІЙ [${c.id}] ${c.src} ${c.ref}: ${c.absent}`); }
    else if (!c.absent && !norm(sec).includes(norm(c.quote))) { ok = false; failed++; note = 'цитата поза зазначеним розділом'; console.log(`ЦИТАТА ПОЗА РОЗДІЛОМ [${c.id}] ${c.src} ${c.ref}`); }
    else {
      const h = crypto.createHash('sha1').update(norm(sec)).digest('hex').slice(0, 10);
      if (updateHashes) c.h = h;
      else if (c.h && c.h !== h) { ok = false; failed++; note = 'норму змінено'; console.log(`НОРМУ ЗМІНЕНО [${c.id}] ${c.src} ${c.ref}: перечитайте розділ і оновіть (--update-hashes)`); }
      else if (!c.h) { console.log(`Немає хешу [${c.id}] — запустіть з --update-hashes`); }
    }
  }
  results.claims.push({ ...c, ok, note });
}

// 3. Лінт посилань «п. N» / «ст. N» у контенті
function listJson(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? listJson(path.join(dir, e.name)) : e.name.endsWith('.json') ? [path.join(dir, e.name)] : []));
}
const pointSources = ['pkmu560', 'pkmu1455', 'pkmu1456', 'pdr'];
const articleSources = ['law3543', 'znp', 'voenstan', 'kupap', 'kk', 'zvern'];
const hasPoint = (id, n) => new RegExp('(^|\\n)\\s*' + n.replace('-', '\\-') + '\\.\\s', 'm').test(texts[id].raw);
const hasArticle = (id, n) => new RegExp('(^|\\n)\\s*Стаття ' + n.replace('.', '\\.') + '\\.\\s', 'm').test(texts[id].raw);
const stringsOf = (o) => (typeof o === 'string' ? [o] : Array.isArray(o) ? o.flatMap(stringsOf) : o && typeof o === 'object' ? Object.values(o).flatMap(stringsOf) : []);
for (const f of listJson(path.join(ROOT, 'content'))) {
  if (/claims\.json|verification\.json|sources\.json/.test(f)) continue;
  const rel = path.relative(ROOT, f);
  const data = JSON.parse(fs.readFileSync(f, 'utf8'));
  const docSources = (data.sources || []).filter((s) => texts[s]);
  const text = stringsOf(data).join('\n');
  const pointPool = (docSources.length ? docSources : Object.keys(texts)).filter((s) => pointSources.includes(s));
  const articlePool = (docSources.length ? docSources : Object.keys(texts)).filter((s) => articleSources.includes(s));
  const globalPoint = pointSources.filter((s) => texts[s]);
  const globalArticle = articleSources.filter((s) => texts[s]);
  for (const m of text.matchAll(/(?<![A-Za-zА-Яа-яІіЇїЄє])п\.\s*(\d+(?:-\d+)?)/g)) {
    const n = m[1];
    const inPage = pointPool.some((s) => hasPoint(s, n));
    // «п. 3» у статтях закону (ст. 23 ч. 1 п. 3) і додатках — не перевіряємо за ПКМУ: пропускаємо, якщо поряд «ст.»/«ч.»/«додатка»
    const ctx = text.slice(Math.max(0, m.index - 28), m.index);
    if (/(ст\.|ч\.|додатк\S*|підп\.|підпункт\S*|пункт\S*|КК|КУпАП)\s*[\d\s\-–,.чч]*$/i.test(ctx) || /\bч\.\s*\d+\s*$/.test(ctx)) continue;
    if (!inPage) {
      const elsewhere = globalPoint.some((s) => hasPoint(s, n));
      results.refs.push({ file: rel, ref: 'п. ' + n, level: elsewhere ? 'warn' : 'error' });
      if (!elsewhere) { failed++; console.log(`ПОСИЛАННЯ НЕ ІСНУЄ ${rel}: п. ${n}`); }
    }
  }
  for (const m of text.matchAll(/ст\.\s*(\d+(?:-\d+)?)/g)) {
    const n = m[1];
    if (articlePool.some((s) => hasArticle(s, n))) continue;
    // Конституція, Сімейний кодекс, КПК, ПК тощо поза переліком — повідомляємо як попередження
    results.refs.push({ file: rel, ref: 'ст. ' + n, level: 'warn' });
  }
}

// 3a. Лінт посилань у JS-шаблонах (генератори)
for (const jf of ['generator.js', 'zaiava.js']) {
  const t = fs.readFileSync(path.join(ROOT, 'src', 'assets', jf), 'utf8');
  for (const m of t.matchAll(/(?<![A-Za-zА-Яа-яІіЇїЄє])п\.\s*(\d+(?:-\d+)?)/g)) {
    const ctx = t.slice(Math.max(0, m.index - 28), m.index);
    if (/(ст\.|ч\.|додатк\S*|підп\.|КК|КУпАП)\s*[\d\s\-–,.чч]*$/i.test(ctx)) continue;
    if (!pointSources.filter((s) => texts[s]).some((s) => hasPoint(s, m[1]))) { failed++; console.log(`ПОСИЛАННЯ НЕ ІСНУЄ у ${jf}: п. ${m[1]}`); }
  }
  for (const m of t.matchAll(/ст\.\s*(\d+(?:-\d+)?)/g)) {
    if (!articleSources.filter((s) => texts[s]).concat(['zvern']).some((s) => texts[s] && hasArticle(s, m[1]))) { failed++; console.log(`ПОСИЛАННЯ НЕ ІСНУЄ у ${jf}: ст. ${m[1]}`); }
  }
}

// 3b. Покриття: які «п./ст.» з контенту мають claim
const covered = new Set(claims.map((c) => c.src + '|' + (/(?:ст|п)\.\s*\d+(?:[.\-]\d+)*/.exec(c.ref) || [''])[0].replace(/\s+/g, ' ')));
const cov = { total: 0, covered: 0, missing: [] };
for (const f of listJson(path.join(ROOT, 'content'))) {
  if (/claims\.json|verification\.json|sources\.json|vidstrochka-data\.json/.test(f)) continue;
  const data = JSON.parse(fs.readFileSync(f, 'utf8'));
  const docSources = (data.sources || []).filter((x) => texts[x]);
  const text = stringsOf(data).join('\n');
  const seen = new Set();
  for (const m of text.matchAll(/(?<![A-Za-zА-Яа-яІіЇїЄє])п\.\s*(\d+(?:-\d+)?)/g)) {
    const ctx = text.slice(Math.max(0, m.index - 28), m.index);
    if (/(ст\.|ч\.|додатк\S*|підп\.|підпункт\S*|пункт\S*|КК|КУпАП)\s*[\d\s\-–,.чч]*$/i.test(ctx)) continue;
    const n = m[1];
    const src = docSources.filter((x) => pointSources.includes(x)).find((x) => hasPoint(x, n));
    if (!src || seen.has(src + n)) continue;
    seen.add(src + n); cov.total++;
    if (covered.has(src + '|п. ' + n)) cov.covered++; else cov.missing.push(`${path.relative(ROOT, f)}: ${src} п. ${n}`);
  }
  for (const m of text.matchAll(/ст\.\s*(\d+(?:-\d+)?)/g)) {
    const n = m[1];
    const src = docSources.filter((x) => articleSources.includes(x)).find((x) => hasArticle(x, n));
    if (!src || seen.has(src + 'ст' + n)) continue;
    seen.add(src + 'ст' + n); cov.total++;
    if (covered.has(src + '|ст. ' + n)) cov.covered++; else cov.missing.push(`${path.relative(ROOT, f)}: ${src} ст. ${n}`);
  }
}
cov.pct = cov.total ? Math.round((cov.covered / cov.total) * 100) : 100;
console.log(`Покриття посилань claim-ами: ${cov.covered}/${cov.total} (${cov.pct}%)`);

// 4. Звіт
const date = new Date().toISOString().slice(0, 10);
const okCount = results.claims.filter((c) => c.ok).length;
const bySrc = {};
for (const c of results.claims) (bySrc[c.src] = bySrc[c.src] || []).push(c);
let md = `# Звіт автоматичної перевірки тверджень\n\nДата перевірки: **${date}**. Підтверджено цитат: **${okCount} з ${claims.length}**. Змінених редакцій джерел: **${editionChanged}**. Неіснуючих посилань «п.»: **${results.refs.filter((r) => r.level === 'error').length}**.\n\n`;
md += `Що це означає: скрипт завантажив поточні тексти норм з zakon.rada.gov.ua і підтвердив, що кожна цитата є в тексті дослівно. Це підтверджує **наявність і точність цитат та номерів пунктів**, але не замінює юридичної оцінки застосування норм до конкретної ситуації.\n\n## Джерела\n\n| Джерело | Редакція | Статус |\n|---|---|---|\n`;
for (const [id, s] of Object.entries(results.sources)) md += `| [${s.title}](${s.url}) | ${s.edition} | ${s.changed ? '⚠ змінилась (було ' + s.expected + ')' : 'без змін'}${s.cached ? ' (текст із кешу)' : ''} |\n`;
md += `\n## Покриття\n\nПосилань «п./ст.» у контенті, що мають перевірену цитату: **${cov.covered} з ${cov.total} (${cov.pct}%)**. Решта — без автоматичної перевірки:\n\n${cov.missing.map((x) => '- ' + x).join('\n')}\n`;
md += '\n## Твердження\n';
for (const [id, list] of Object.entries(bySrc)) {
  md += `\n### ${sources[id].title}\n\n| № | Пункт | Твердження | Результат |\n|---|---|---|---|\n`;
  for (const c of list) md += `| ${c.id} | ${c.ref} | ${c.claim.replace(/\|/g, '/')} | ${c.ok ? '✓' : '✗ НЕ ЗНАЙДЕНО'} |\n`;
}
const warn = results.refs.filter((r) => r.level === 'warn');
if (warn.length) md += `\n## Посилання на інші акти (не перевіряються автоматично)\n\nСтатті Конституції, КПК, Сімейного кодексу, Податкового кодексу та інші акти, яких немає в списку джерел, перевіряються вручну:\n\n${[...new Set(warn.map((w) => `- ${w.file}: ${w.ref}`))].join('\n')}\n`;
fs.writeFileSync(path.join(ROOT, 'docs', 'VERIFICATION.md'), md);
if (updateHashes) { fs.writeFileSync(claimsPath, JSON.stringify(claimsFile, null, 1) + '\n'); console.log('Хеші розділів оновлено в content/claims.json'); }
const pub = {
  date,
  total: claims.length,
  ok: okCount,
  editionChanged,
  coverage: { total: cov.total, covered: cov.covered, pct: cov.pct },
  sources: results.sources,
  claims: results.claims.map(({ id, src, ref, claim, quote, ok, pages }) => ({ id, src, ref, claim, quote, ok, pages })),
};
if (!offline) fs.writeFileSync(path.join(ROOT, 'content', 'verification.json'), JSON.stringify(pub, null, 2) + '\n');
console.log(`Підтверджено ${okCount}/${claims.length} цитат; змінених редакцій: ${editionChanged}; помилок: ${failed}`);
process.exit(failed || editionChanged ? 1 : 0);
