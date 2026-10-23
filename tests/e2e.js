'use strict';
// E2E-перевірка у Chromium (Playwright). Запуск: BASE=http://localhost:3111 node tests/e2e.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:3000';
const SHOTS = process.env.SHOTS || '';
const PAGES = ['/', '/mene-zupynyly/', '/blokpost/', '/povistka/', '/perevirka-povistky/', '/vidstrochka/', '/skarha/', '/shtraf/', '/zabraly/', '/dopomoha/', '/faq/', '/poshuk/', '/pryvatnist/', '/terminovo/', '/sytuatsiyi/politsiya-pdr/', '/sytuatsiyi/politsiya-szch/', '/sytuatsiyi/tck-vidstrochka/', '/zaiava-vidstrochka/', '/sytuatsiyi/povistka-poshtoiu/', '/sytuatsiyi/ne-prybuv-u-strok/', '/dlia-rodyn/', '/rezerv-plus/', '/slovnyk/', '/pro-sait/', '/vidpyska-tck/'];
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  // 1. сторінки відкриваються, немає горизонтального скролу на 360px, є дисклеймер
  const links = new Set();
  for (const u of PAGES) {
    const r = await page.goto(BASE + u, { waitUntil: 'load' });
    ok(r.status() === 200, `${u} → 200`);
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(ov <= 0, `${u} без горизонтального скролу (різниця ${ov})`);
    ok((await page.content()).includes('а не юридична консультація'), `${u} має дисклеймер`);
    ok(await page.locator('.nav-sos').isVisible(), `${u} видно кнопку «Мене зупинили»`);
    ok((await page.locator('h1').count()) === 1, `${u} один h1`);
    for (const h of await page.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href')))) if (h.startsWith('/')) links.add(h.split('#')[0].split('?')[0]);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${u === '/' ? 'home' : u.replace(/\//g, '')}.png`, fullPage: false });
  }
  // 2. внутрішні посилання
  for (const l of links) { if (!l) continue; const r = await ctx.request.get(BASE + l); ok(r.status() === 200, `посилання ${l} → ${r.status()}`); }

  // 3. генератор скарг
  await page.goto(BASE + '/skarha/');
  await page.fill('#f-name', 'Іваненко Іван Іванович');
  await page.fill('#f-contact', 'м. Київ, +380000000000');
  await page.fill('#f-date', '2026-10-20');
  await page.fill('#f-time', '14:30');
  await page.fill('#f-place', 'м. Київ');
  await page.fill('#f-desc', 'Мене зупинили, не назвалися і не показали посвідчення.');
  await page.selectOption('#f-mask', 'так');
  await page.selectOption('#f-intro', 'ні');
  await page.check('input[name=ev][value="відеозапис"]');
  const reqs = []; page.on('request', (r) => { if (r.method() !== 'GET') reqs.push(r.url()); });
  await page.click('#make');
  const text = await page.inputValue('#out');
  ok(text.includes('Іваненко Іван Іванович') && text.includes('20.10.2026 о 14:30') && text.includes('Обличчя були закриті (балаклави): так.') && text.includes('Особи назвалися та пред’явили службові посвідчення: ні.') && text.includes('відеозапис'), 'генератор: омбудсман — текст коректний');
  ok(text.includes('Уповноваженому Верховної Ради'), 'генератор: адресат за замовчуванням');
  ok((await page.getAttribute('#tg', 'href')).startsWith('https://t.me/share/url?'), 'генератор: Telegram-посилання');
  await page.click('#copy');
  ok((await page.evaluate(() => navigator.clipboard.readText())) === text, 'генератор: копіювання');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#dl')]);
  ok(dl.suggestedFilename().endsWith('.txt'), 'генератор: завантаження .txt');
  await page.check('input[name=kind][value=appeal]');
  ok(await page.locator('#appeal-box').isVisible(), 'генератор: блок постанови показується');
  await page.fill('#f-pnum', '123'); await page.fill('#f-pgr', 'Повістку не вручали.');
  await page.click('#make');
  const t2 = await page.inputValue('#out');
  ok(t2.includes('оскаржую постанову № 123') && t2.includes('Повістку не вручали.') && t2.includes('Скасувати зазначену постанову'), 'генератор: оскарження постанови');
  await page.check('input[name=kind][value=vlk]');
  ok(await page.locator('#appeal-box').isVisible() && (await page.innerText('#ab-legend')).includes('Рішення ВЛК'), 'генератор: ВЛК — блок рішення');
  await page.fill('#f-pgr', 'Не враховано діагноз.'); await page.fill('#f-porg', 'Районний ТЦК'); await page.click('#make');
  const tv = await page.inputValue('#out');
  ok(tv.includes('не згоден(на) з рішенням військово-лікарської комісії') && tv.includes('п. 72') && tv.includes('Не враховано діагноз.'), 'генератор: заява про незгоду з ВЛК');
  await page.check('input[name=kind][value=police]'); await page.selectOption('#f-viol', 'так'); await page.click('#make');
  ok((await page.inputValue('#out')).includes('внести відомості до Єдиного реєстру'), 'генератор: поліція');
  await page.click('#clear');
  ok(!(await page.locator('#out-wrap').isVisible()), 'генератор: очищення ховає результат');
  ok(reqs.length === 0, 'генератор: жодних POST/PUT запитів');
  const ls = await page.evaluate(() => Object.keys(localStorage).concat(Object.keys(sessionStorage)));
  ok(ls.every((k) => k === 'theme'), 'генератор: у сховищі тільки тема: ' + JSON.stringify(ls));

  // 3a2. правове обґрунтування у скарзі
  await page.goto(BASE + '/skarha/');
  await page.fill('#f-name', 'Тест'); await page.fill('#f-contact', 'м. Київ'); await page.fill('#f-desc', 'Опис');
  await page.selectOption('#f-intro', 'ні'); await page.selectOption('#f-wt', 'tck');
  await page.check('input[name=v2][value=detain]'); await page.check('input[name=v2][value=hours3]'); await page.check('input[name=v2][value=relatives]');
  await page.click('#make');
  const lt = await page.inputValue('#out');
  ok(lt.includes('Правове обґрунтування:') && lt.includes('Пунктом 54') && lt.includes('статей 261 і 262') && lt.includes('ч. 1 ст. 263') && lt.includes('ст. 261') && !lt.includes('статті 18'), 'скарга: норми за обраними порушеннями (ТЦК)');
  await page.selectOption('#f-wt', 'police'); await page.click('#make');
  ok((await page.inputValue('#out')).includes('статті 18 Закону України «Про Національну поліцію»'), 'скарга: для поліції — ст. 18 ЗНП');
  await page.selectOption('#f-intro', ''); await page.uncheck('input[name=v2][value=detain]'); await page.uncheck('input[name=v2][value=hours3]'); await page.uncheck('input[name=v2][value=relatives]'); await page.click('#make');
  ok((await page.innerText('#status')).includes('що порушено'), 'скарга: підказка, якщо порушення не обрано');
  await page.check('input[name=kind][value=appeal]'); await page.check('input[name=gr][value=nopov]'); await page.check('input[name=gr][value=reg]'); await page.click('#make');
  const at = await page.inputValue('#out');
  ok(at.includes('Обґрунтування:') && at.includes('п. 41') && at.includes('приміткою до ст. 210'), 'оскарження: підстави з нормами');

  // 3a3. скарга до вищого органу
  await page.goto(BASE + '/skarha/'); await page.fill('#f-name', 'Тест'); await page.fill('#f-contact', 'м. Київ'); await page.fill('#f-desc', 'Опис');
  await page.check('input[name=kind][value=higher]'); await page.fill('#f-pnum', '12/345'); await page.fill('#f-pgr', 'Не перевірено відео.'); await page.fill('#f-porg', 'Районний ТЦК'); await page.click('#make');
  const hg = await page.inputValue('#out');
  ok(hg.includes('Органу вищого рівня') && hg.includes('№ 12/345') && hg.includes('Не перевірено відео.') && hg.includes('ст. 18 Закону') && hg.includes('ст. 17 цього Закону'), 'скарга до вищого органу: структура й норми');

  // 3b. швидка заявка юристу
  await page.goto(BASE + '/terminovo/');
  await page.check('input[name=who][value=rel]');
  await page.fill('#u-name', 'Петренко Петро, 01.01.1990');
  await page.check('input[name=what][value="Забрали / доставили до ТЦК"]');
  await page.selectOption('#u-by', 'ТЦК');
  await page.fill('#u-place', 'м. Львів');
  await page.check('input[name=d][value="є підстава для відстрочки, але вона не оформлена"]');
  await page.fill('#u-base', 'троє дітей');
  await page.fill('#u-contact', '+380000000000');
  await page.click('#urg button[type=submit]');
  const um = await page.inputValue('#u-out');
  ok(um.includes('рідну людину') && um.includes('Петренко') && um.includes('Забрали / доставили до ТЦК') && um.includes('троє дітей') && um.includes('м. Львів'), 'терміново: повідомлення коректне');
  ok((await page.getAttribute('#u-tg', 'href')).startsWith('https://t.me/example_lawyer?text='), 'терміново: Telegram з готовим текстом');
  ok(await page.locator('#u-tg[rel~=noopener]').count() === 1 && await page.locator('#u-tg[rel~=sponsored]').count() === 0, 'терміново: rel=noopener, без sponsored');
  // каталог ситуацій
  await page.goto(BASE + '/mene-zupynyly/');
  ok((await page.locator('a[href^="/sytuatsiyi/"]').count()) >= 14, 'мене зупинили: показано всі ситуації');

  // 3c. заява про відстрочку
  await page.goto(BASE + '/zaiava-vidstrochka/');
  await page.fill('#z-name', 'Сидоренко Сидір Сидорович'); await page.fill('#z-id', '1234567890');
  await page.fill('#z-birth', '1990-05-17'); await page.fill('#z-addr', 'м. Київ, вул. Тестова, 1');
  await page.fill('#z-mail', 'a@b.ua'); await page.fill('#z-tel', '+380000000000'); await page.fill('#z-tck', 'Тестовий РТЦК та СП');
  await page.selectOption('#z-ground', 'g_3kids');
  ok((await page.innerText('#z-docs')).includes('Свідоцтво про народження'), 'заява: перелік документів за підставою');
  await page.click('#zv button[type=submit]');
  const zt = await page.inputValue('#z-out');
  ok(zt.includes('Сидоренко Сидір') && zt.includes('17.05.1990') && zt.includes('ст. 23, ч. 1, п. 3') && zt.includes('про надання відстрочки') && zt.includes('Тестовий РТЦК'), 'заява: текст коректний');
  await page.check('input[name=renew]'); await page.fill('#z-old', 'п. 2, до 01.2027'); await page.click('#zv button[type=submit]');
  ok((await page.inputValue('#z-out')).includes('про переоформлення відстрочки') && (await page.inputValue('#z-out')).includes('п. 2, до 01.2027'), 'заява: переоформлення');

  // 3d. заява: основи без подання, п. 58-1
  const opts = await page.$$eval('#z-ground option', (o) => o.map((x) => x.value));
  ok(!opts.includes('g_bron') && !opts.includes('g_contract1y'), 'заява: немає підстав, що не подаються до комісії');
  await page.selectOption('#z-ground', 'g_parent_disab'); await page.fill('#z-name', 'Тест'); await page.click('#zv button[type=submit]');
  const z58 = await page.inputValue('#z-out');
  ok(z58.includes('п. 58-1') && !z58.includes('Оформлює'), 'заява: абзац п. 58-1, без службових пояснень у додатках');
  await page.goto(BASE + '/skarha/'); await page.check('input[name=kind][value=appeal]'); await page.fill('#f-desc', 'Опис'); await page.check('input[name=kind][value=appeal]'); await page.selectOption('#f-viol', { value: 'так' }).catch(() => {}); await page.click('#make');
  const ta = await page.inputValue('#out');
  ok(!ta.includes('Насильство або погрози') && ta.includes('Вищестоящому органу'), 'скарга на штраф: без зайвих полів, адресат за ст. 288');
  await page.check('input[name=kind][value=police]'); await page.selectOption('#f-viol', 'так'); await page.click('#make');
  ok((await page.inputValue('#out')).includes('ст. 383'), 'поліція: попередження про ст. 383 КК');
  await page.check('input[name=kind][value=ombudsman]'); await page.click('#make');
  ok((await page.inputValue('#out')).includes('ст. 7 Закону України «Про звернення громадян»') && (await page.innerText('#status')).includes('анонімним'), 'омбудсман: ст. 7 і застереження про анонімність');

  // 4. навігатор відстрочок
  await page.goto(BASE + '/vidstrochka/');
  await page.check('input[name=q0][value="0"]');
  await page.check('input[name=q2][value="3"]');
  await page.click('#vnav button[type=submit]');
  const vr = await page.innerText('.vres');
  ok(vr.includes('Троє і більше дітей') && vr.includes('Постійний догляд') && vr.includes('ЦНАП'), 'навігатор: результати');
  await page.click('#vnav button[type=reset]');
  await page.click('#vnav button[type=submit]');
  ok((await page.innerText('.vres')).includes('підстав не знайдено'), 'навігатор: порожній результат');

  // 5. пошук
  await page.goto(BASE + '/poshuk/?q=повістка');
  await page.waitForSelector('.res a');
  ok((await page.locator('.res a').count()) >= 2, 'пошук: знаходить сторінки');

  // 6. тема
  await page.goto(BASE + '/');
  await page.click('#theme-btn');
  ok(['dark', 'light'].includes(await page.evaluate(() => document.documentElement.dataset.theme)), 'тема перемикається');
  await page.evaluate(() => localStorage.clear());

  // 7. офлайн
  await page.goto(BASE + '/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(1500);
  await ctx.setOffline(true);
  for (const u of ['/', '/mene-zupynyly/', '/skarha/', '/vidstrochka/', '/faq/', '/terminovo/', '/sytuatsiyi/politsiya-pdr/']) {
    try { const r = await page.goto(BASE + u); ok(r && r.ok() && (await page.locator('h1').count()) === 1, `офлайн: ${u}`); } catch (e) { ok(false, `офлайн: ${u} ${e.message}`); }
  }
  await page.goto(BASE + '/skarha/');
  await page.fill('#f-name', 'Тест'); await page.click('#make');
  ok((await page.inputValue('#out')).includes('Тест'), 'офлайн: генератор працює');
  await ctx.setOffline(false);

  ok(errors.length === 0, 'немає помилок у консолі' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log(fail ? `\n${fail} FAILED` : '\nALL OK');
  process.exit(fail ? 1 : 0);
})();
