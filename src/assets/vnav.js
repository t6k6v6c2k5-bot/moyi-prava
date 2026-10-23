'use strict';
// Навігатор відстрочок: усе локально, без збереження.
(function () {
  var box = document.getElementById('vnav'), src = document.getElementById('vdata');
  if (!box || !src) return;
  var D = JSON.parse(src.textContent);

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function md(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'); }

  var f = document.createElement('form');
  f.setAttribute('aria-label', 'Навігатор відстрочок');
  var html = '<p class="muted">Торкніться розділу, що вам підходить, і позначте пункти. Можна кілька розділів.</p>';
  D.questions.forEach(function (q, qi) {
    html += '<details class="q" id="d' + qi + '"><summary><span>' + esc(q.q) + '</span><span class="cnt" id="c' + qi + '"></span></summary>' + (q.hint ? '<p class="muted hint">' + esc(q.hint) + '</p>' : '');
    q.options.forEach(function (o, oi) {
      html += '<label class="opt"><input type="checkbox" name="q' + qi + '" value="' + oi + '"> <span>' + esc(o.l) + '</span></label>';
    });
    html += '</details>';
  });
  html += '<div class="actions"><button class="btn big" type="submit">Показати підстави</button><button class="btn secondary" type="reset">Очистити</button></div>';
  f.innerHTML = html;
  box.appendChild(f);
  var res = document.createElement('div');
  res.className = 'vres'; res.setAttribute('aria-live', 'polite');
  box.appendChild(res);

  function progress() {
    D.questions.forEach(function (q, qi) {
      var n = f.querySelectorAll('input[name=q' + qi + ']:checked').length;
      document.getElementById('c' + qi).textContent = n ? '✓ ' + n : '';
    });
  }
  f.addEventListener('change', progress);
  f.addEventListener('reset', function () { res.innerHTML = ''; setTimeout(progress, 0); });

  f.addEventListener('submit', function (e) {
    e.preventDefault();
    var ids = [];
    D.questions.forEach(function (q, qi) {
      Array.prototype.forEach.call(f.querySelectorAll('input[name=q' + qi + ']:checked'), function (c) {
        q.options[+c.value].g.forEach(function (g) { if (ids.indexOf(g) < 0) ids.push(g); });
      });
    });
    var h = '';
    if (!ids.length) {
      h = '<div class="callout warn"><p><strong>За вашими відповідями підстав не знайдено.</strong> Це не остаточно: у ст. 23 є й інші випадки (в т.ч. «інші категорії, передбачені законом»). Перегляньте повний перелік нижче або зателефонуйте на безкоштовну лінію <a href="tel:0800213103">0 800 213 103</a>.</p></div>';
    } else {
      h = '<h2>Можливі підстави (' + ids.length + ')</h2>';
      ids.forEach(function (id) {
        var g = D.grounds[id];
        h += '<section class="g"><h3>' + esc(g.t) + '</h3><p class="muted">' + esc(g.ref) + '</p>' +
          (g.zaiava === false ? '<p><strong>Заяву до комісії не подають</strong> (ПКМУ № 560, п. 57–58).</p>' : '') +
          (g.docs.length ? '<strong>Документи:</strong><ul>' + g.docs.map(function (d) { return '<li>' + md(d) + '</li>'; }).join('') + '</ul>' : '') +
          '<details class="fold"><summary>Підстава в законі й нюанси</summary><p class="muted">' + esc(g.ref) + '</p>' + ((g.notes && g.notes.length) ? '<ul class="muted">' + g.notes.map(function (d) { return '<li>' + md(d) + '</li>'; }).join('') + '</ul>' : '') + '</details></section>';
      });
      h += '<div class="callout info"><p><strong>Куди подавати:</strong> заяву на ім’я голови комісії при ТЦК — особисто через ЦНАП (з військово-обліковим документом). Окремо, за технічної можливості, відстрочка може оформитися автоматично через електронний кабінет (Резерв+) — це не заява до комісії. Заява реєструється протягом 1 робочого дня, розглядається до 7 робочих днів. (ПКМУ № 560, п. 58–60)</p></div>';
    }
    res.innerHTML = h;
    res.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  });
})();
