'use strict';
// Швидка заявка юристу: текст складається на пристрої; нічого не надсилається, доки ви самі не натиснете Telegram.
(function () {
  var form = document.getElementById('urg');
  if (!form) return;
  var $ = function (id) { return document.getElementById(id); };
  var out = $('u-out'), tg = $('u-tg'), base = tg.getAttribute('href'), say = function (m) { $('u-status').textContent = m; };
  var noLawyer = /#no-lawyer$/.test(base);
  if (noLawyer) { tg.textContent = 'Telegram недоступний — зателефонуйте 0 800 213 103'; tg.setAttribute('href', 'tel:0800213103'); tg.removeAttribute('target'); }

  function v(n) { return (form.elements[n].value || '').trim(); }
  function fmt(d) { if (!d) return ''; var p = d.split('-'); return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0] : d; }
  function build() {
    var rel = form.elements.who.value === 'rel';
    var ds = Array.prototype.map.call(form.querySelectorAll('input[name=d]:checked'), function (c) { return c.value; });
    var when = [fmt(v('date')), v('time')].filter(Boolean).join(' ');
    var L = ['ТЕРМІНОВО потрібен юрист.'];
    L.push((rel ? 'Йдеться про рідну людину: ' : 'Йдеться про мене: ') + (v('name') || '(ПІБ не вказано)'));
    L.push('Що сталося: ' + form.elements.what.value + '.');
    if (v('by')) L.push('Хто діяв: ' + v('by') + '.');
    if (when) L.push('Коли: ' + when + '.');
    if (v('place')) L.push('Де (область/місто): ' + v('place') + '.');
    if (ds.length) L.push('Важливо: ' + ds.join('; ') + '.');
    if (v('base')) L.push('Підстава відстрочки: ' + v('base') + '.');
    if (v('done')) L.push('Вже зроблено: ' + v('done') + '.');
    if (v('more')) L.push('Деталі: ' + v('more'));
    L.push('Контакт: ' + (v('contact') || '(вкажу в чаті)'));
    L.push('Прошу допомогти: захистити права, оформити відстрочку/скаргу, з’ясувати, де людина і що з нею.');
    return L.join('\n');
  }
  function link() {
    if (noLawyer) return;
    // для особистого акаунта/бота t.me/<name> можна передати готовий текст
    tg.href = /^https:\/\/(t|telegram)\.me\/[A-Za-z0-9_]+$/.test(base) ? base + '?text=' + encodeURIComponent(out.value) : base;
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    out.value = build();
    $('u-out-wrap').hidden = false;
    link();
    say(/^https:\/\/(t|telegram)\.me\/[A-Za-z0-9_]+$/.test(base) || noLawyer ? 'Текст готовий. Перевірте і надішліть.' : 'Текст готовий. Після відкриття чату вставте скопійований текст.');
    $('u-out-wrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  out.addEventListener('input', link);
  $('u-copy').addEventListener('click', function () {
    var ok = function () { say('Скопійовано.'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(out.value).then(ok, function () { out.select(); document.execCommand('copy'); ok(); });
    else { out.select(); document.execCommand('copy'); ok(); }
  });
  tg.addEventListener('click', function () {
    // якщо чат відкривається без готового тексту — копіюємо його заздалегідь
    if (!/\?text=/.test(tg.href) && navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(out.value).catch(function () {});
  });
})();
