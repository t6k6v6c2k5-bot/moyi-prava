'use strict';
// Генератор скарг. Працює лише на пристрої: жодних запитів, жодного збереження.
(function () {
  var form = document.getElementById('gen');
  if (!form) return;
  var $ = function (id) { return document.getElementById(id); };
  var out = $('out'), wrap = $('out-wrap'), status = $('status');

  var KINDS = {
    ombudsman: { to: 'Уповноваженому Верховної Ради України з прав людини', title: 'СКАРГА', sub: 'на дії осіб, які діяли від імені органів, що здійснюють заходи мобілізації' },
    police: { to: 'Начальнику територіального органу Національної поліції України (за місцем події)', title: 'ЗАЯВА', sub: 'про вчинення кримінального правопорушення' },
    prosecutor: { to: 'Прокурору (прокуратура за місцем події)', title: 'СКАРГА', sub: 'на дії посадових осіб та осіб, які діяли від їх імені, з проханням провести перевірку дотримання законності' },
    vlk: { to: 'Голові військово-лікарської комісії при районному (міському) територіальному центрі комплектування та соціальної підтримки', title: 'ЗАЯВА', sub: 'про незгоду з рішенням військово-лікарської комісії' },
    appeal: { to: 'Органу (посадової особи), що виніс постанову, або суду за підсудністю — залежно від того, хто виніс постанову', title: 'ЗАЯВА', sub: 'про оскарження постанови у справі про адміністративне правопорушення' }
  };

  function val(n) { return (form.elements[n].value || '').trim(); }
  function kind() { return form.elements.kind.value; }
  function today() { var t = new Date(); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); }
  function fmt(d) { if (!d) return ''; var p = d.split('-'); return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0] : d; }
  function blank(s, hint) { return s || '________' + (hint ? ' [' + hint + ']' : ''); }
  function line(label, v) { return v ? label + ': ' + v + '.' : ''; }

  function syncKind() {
    var k = kind();
    $('appeal-box').hidden = k !== 'appeal' && k !== 'vlk';
    var v = k === 'vlk';
    $('ab-legend').textContent = v ? '5. Рішення ВЛК' : '5. Постанова про штраф';
    document.querySelector('label[for=f-pnum]').textContent = v ? 'Номер/реквізити рішення (якщо є)' : 'Номер постанови (якщо є)';
    document.querySelector('label[for=f-pdate]').textContent = v ? 'Дата рішення ВЛК' : 'Дата постанови';
    document.querySelector('label[for=f-porg]').textContent = v ? 'Який ТЦК / яка ВЛК ухвалила рішення' : 'Хто виніс постанову (орган / посадова особа)';
    document.querySelector('label[for=f-pgr]').textContent = v ? 'Чому не згодні (діагнози, документи, що не враховано)' : 'Чому не погоджуєтесь (по пунктах)';
    $('f-to').placeholder = KINDS[k].to;
  }
  Array.prototype.forEach.call(form.elements.kind, function (r) { r.addEventListener('change', syncKind); });
  syncKind();

  function build() {
    var k = kind(), K = KINDS[k];
    var ev = Array.prototype.filter.call(form.querySelectorAll('input[name=ev]:checked'), Boolean).map(function (c) { return c.value; });
    var when = [fmt(val('date')), val('time') ? 'о ' + val('time') : ''].filter(Boolean).join(' ');
    var L = [];
    L.push('До: ' + (val('to') || K.to));
    L.push('Від: ' + blank(val('name'), 'ПІБ'));
    L.push('Адреса та контакти: ' + blank(val('contact')));
    L.push('');
    L.push(K.title);
    L.push(K.sub);
    L.push('');
    if (k === 'vlk') {
      L.push('Я, ' + blank(val('name'), 'ПІБ') + ', не згоден(на) з рішенням військово-лікарської комісії' + (val('porg') ? ' (' + val('porg') + ')' : '') + (val('pdate') ? ' від ' + fmt(val('pdate')) : '') + (val('pnum') ? ', ' + val('pnum') : '') + '.');
      L.push('');
      L.push('Підстави незгоди:');
      L.push(blank(val('pgr'), 'чому не згодні'));
    } else if (k === 'appeal') {
      L.push('Я, ' + blank(val('name'), 'ПІБ') + ', оскаржую постанову' +
        (val('pnum') ? ' № ' + val('pnum') : '') + (val('pdate') ? ' від ' + fmt(val('pdate')) : '') +
        (val('porg') ? ', винесену: ' + val('porg') : '') + '.');
      L.push('');
      L.push('Обставини справи:');
      var ctx = (when ? when + ', ' : '') + (val('place') ? 'у місці: ' + val('place') + '. ' : '') + (val('who') ? 'Діяли: ' + val('who') + '.' : '');
      if (ctx.trim()) L.push(ctx);
      L.push(blank(val('desc'), 'опишіть, що відбувалося'));
      L.push('');
      L.push('Підстави для скасування постанови:');
      L.push(blank(val('pgr'), 'з чим не згодні'));
    } else {
      L.push('Обставини:');
      L.push((when ? when + ', ' : '') + (val('place') ? 'у місці: ' + val('place') + '. ' : '') + (val('who') ? 'Діяли: ' + val('who') + '.' : ''));
      L.push(blank(val('desc'), 'опишіть, що відбувалося'));
    }
    var extra = [
      line('Обличчя були закриті (балаклави)', val('mask')),
      line('Розпізнавальні знаки були', val('ids')),
      line('Особи назвалися та пред’явили службові посвідчення', val('intro')),
      line('Насильство або погрози', val('viol')),
      line('Прикмети, форма, номерні знаки', val('marks'))
    ].filter(Boolean);
    if (extra.length) { L.push(''); L.push('Додаткові відомості:'); extra.forEach(function (e) { L.push('- ' + e); }); }
    if (val('wit')) { L.push(''); L.push('Свідки: ' + val('wit') + '.'); }
    if (ev.length) { L.push(''); L.push('У мене є докази: ' + ev.join('; ') + '. Можу надати їх на вимогу.'); }
    L.push('');
    L.push('Прошу:');
    if (k === 'ombudsman') {
      L.push('1. Розглянути скаргу та вжити заходів реагування в межах повноважень.');
      L.push('2. Звернутися до відповідних органів для перевірки дій зазначених осіб і встановлення їх особи.');
      L.push('3. Письмово повідомити мене про результати розгляду за вказаною адресою.');
    } else if (k === 'police') {
      L.push('1. Прийняти цю заяву, внести відомості до Єдиного реєстру досудових розслідувань та розпочати розслідування.');
      L.push('2. Видати мені документ, що підтверджує прийняття та реєстрацію заяви.');
      if (val('viol') === 'так') L.push('3. Надати направлення на медичне обстеження та залучити наявні докази (відео, свідків).');
      L.push((val('viol') === 'так' ? '4' : '3') + '. Повідомити мене про хід і результати розслідування.');
      L.push('');
      L.push('Підтверджую достовірність викладених мною відомостей.');
    } else if (k === 'prosecutor') {
      L.push('1. Провести перевірку дотримання законності діями зазначених осіб.');
      L.push('2. У разі виявлення порушень — вжити заходів прокурорського реагування.');
      L.push('3. Письмово повідомити мене про результати розгляду.');
    } else if (k === 'vlk') {
      L.push('1. Відповідно до п. 72 Порядку проведення призову громадян на військову службу під час мобілізації (постанова КМУ № 560 від 16.05.2024) направити мене для проходження військово-лікарської комісії при обласному (Київському, Севастопольському міському) територіальному центрі комплектування та соціальної підтримки.');
      L.push('2. Долучити до матеріалів мої медичні документи (перелік — у додатках).');
      L.push('3. Письмово повідомити мене про направлення.');
    } else {
      L.push('1. Скасувати зазначену постанову та закрити провадження у справі.');
      L.push('2. Розглянути цю заяву в установлений законом строк і повідомити мене про рішення письмово.');
      L.push('3. Надати мені копії матеріалів справи.');
      L.push('4. Якщо строк оскарження (десять днів з дня винесення постанови, ст. 289 КУпАП) пропущено з поважних причин — поновити його.');
    }
    L.push('');
    L.push('Додатки: ' + (ev.length ? ev.join('; ') + '; ' : '') + 'копії документів (за наявності).');
    L.push('');
    L.push('Дата: ' + fmt(today()) + '        Підпис: ____________   ' + (val('name') || ''));
    return L.join('\n');
  }

  function say(m) { status.textContent = m; }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    out.value = build();
    wrap.hidden = false;
    var miss = [];
    if (!val('name')) miss.push('ПІБ');
    if (!val('desc')) miss.push('опис подій');
    say(miss.length ? 'Не заповнено: ' + miss.join(', ') + '. У тексті залишено рядки «________» — допишіть їх.' : 'Текст готовий. Перевірте його перед відправкою.');
    wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('tg').href = tgHref();
  });
  out.addEventListener('input', function () { $('tg').href = tgHref(); });
  form.addEventListener('reset', function () { wrap.hidden = true; out.value = ''; setTimeout(syncKind, 0); });

  function tgHref() {
    return 'https://t.me/share/url?url=' + encodeURIComponent(location.origin) + '&text=' + encodeURIComponent(out.value);
  }

  $('copy').addEventListener('click', function () {
    var done = function () { say('Скопійовано.'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(out.value).then(done, function () { out.select(); document.execCommand('copy'); done(); });
    } else { out.select(); document.execCommand('copy'); done(); }
  });

  $('dl').addEventListener('click', function () {
    var blob = new Blob(['﻿' + out.value], { type: 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'skarha-' + kind() + '.txt';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    say('Файл збережено.');
  });

  $('print').addEventListener('click', function () {
    var pre = document.getElementById('printable');
    if (!pre) { pre = document.createElement('pre'); pre.id = 'printable'; document.body.appendChild(pre); }
    pre.textContent = out.value;
    window.print();
  });
})();
