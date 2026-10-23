'use strict';
// Одноразово генерує PNG-іконки та og.png (потрібен Playwright + Chromium). Результат лежить у src/assets.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const out = path.join(__dirname, '..', 'src', 'assets');
const svg = fs.readFileSync(path.join(out, 'icon.svg'), 'utf8');
(async () => {
  const b = await chromium.launch();
  for (const s of [192, 512]) {
    const p = await b.newPage({ viewport: { width: s, height: s } });
    await p.setContent(`<body style="margin:0">${svg.replace('<svg ', `<svg width="${s}" height="${s}" `)}</body>`);
    await p.screenshot({ path: path.join(out, `icon-${s}.png`) });
  }
  {
    const f = await b.newPage({ viewport: { width: 48, height: 48 } });
    await f.setContent(`<body style="margin:0">${svg.replace('<svg ', '<svg width="48" height="48" ')}</body>`);
    await f.screenshot({ path: path.join(out, 'favicon-48.png') });
  }
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await p.setContent(`<body style="margin:0;width:1200px;height:630px;background:#14213d;color:#fff;font-family:system-ui,Arial,sans-serif;display:flex;align-items:center;gap:56px;padding:0 80px;box-sizing:border-box">
  <div style="width:260px;height:260px;flex:none">${svg.replace('<svg ', '<svg width="260" height="260" ')}</div>
  <div><div style="font-size:92px;font-weight:800">Мої права</div>
  <div style="font-size:38px;margin-top:18px;line-height:1.3;color:#e5e7eb">Знай права й обов’язки.<br>Дій за законом. Фіксуй порушення.</div></div></body>`);
  await p.screenshot({ path: path.join(out, 'og.png') });
  await b.close();
})();
