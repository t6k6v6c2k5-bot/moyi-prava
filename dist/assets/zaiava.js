'use strict';
// Чернетка заяви про відстрочку. Працює лише на пристрої.
(function () {
  var form = document.getElementById('zv');
  if (!form) return;
  var $ = function (id) { return document.getElementById(id); };
  var G = JSON.parse($('zdata').textContent);
  var sel = $('z-ground'), out = $('z-out');
  Object.keys(G).forEach(function (k) { var o = document.createElement('option'); o.value = k; o.textContent = G[k].t + ' (' + G[k].ref + ')'; sel.appendChild(o); });
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function plain(s) { return String(s).replace(/\*\*/g, ''); }
  function docs() { var g = G[sel.value]; $('z-docs').innerHTML = '<strong>Додайте до заяви (оригінали або завірені копії):</strong><ul>' + g.docs.map(function (d) { return '<li>' + esc(plain(d)).replace(/\n/g, ' ') + '</li>'; }).join('') + '</ul><p class="muted">Перелік — за додатком 5 ПКМУ № 560; у ЦНАП уточніть повний перелік для вашої ситуації.</p>'; }
  sel.addEventListener('change', docs); docs();
  form.elements.renew.addEventListener('change', function () { var r = form.elements.renew.checked; $('z-old').hidden = !r; $('z-old-l').hidden = !r; });
  function v(n) { return (form.elements[n].value || '').trim(); }
  function fmt(d) { if (!d) return ''; var p = d.split('-'); return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0] : d; }
  function b(s, h) { return s || '________' + (h ? ' [' + h + ']' : ''); }
  function today() { var t = new Date(); return ('0' + t.getDate()).slice(-2) + '.' + ('0' + (t.getMonth() + 1)).slice(-2) + '.' + t.getFullYear(); }
  function build() {
    var g = G[sel.value], renew = form.elements.renew.checked, L = [];
    L.push('Голові комісії з розгляду питань надання/переоформлення відстрочки при ' + b(v('tck'), 'назва ТЦК'));
    L.push('від ' + b(v('name'), 'ПІБ'));
    L.push('РНОКПП / паспорт: ' + b(v('id')));
    L.push('Дата народження: ' + b(fmt(v('birth'))));
    L.push('Адреса проживання (перебування): ' + b(v('addr')));
    L.push('Ел. пошта: ' + b(v('mail')) + '; тел.: ' + b(v('tel')));
    L.push('');
    L.push('ЗАЯВА');
    L.push('про ' + (renew ? 'переоформлення' : 'надання') + ' відстрочки від призову на військову службу під час мобілізації, на особливий період');
    L.push('');
    L.push('Прошу ' + (renew ? 'переоформити' : 'надати') + ' мені відстрочку від призову на військову службу під час мобілізації, на особливий період на підставі: ' + g.t + ' (' + g.ref + ' Закону України «Про мобілізаційну підготовку та мобілізацію»).');
    if (renew) L.push('Наявна відстрочка: ' + b(v('old'), 'підстава, строк') + '.');
    L.push('');
    L.push('До заяви додаю:');
    g.docs.forEach(function (d, i) { L.push((i + 1) + '. ' + plain(d)); });
    L.push('');
    L.push('Військово-обліковий документ пред’явлю під час подання заяви. Прошу повідомити про рішення комісії на вказану адресу електронної пошти.');
    L.push('');
    L.push('Дата: ' + today() + '        Підпис: ____________   ' + (v('name') || ''));
    return L.join('\n');
  }
  function say(m) { $('z-status').textContent = m; }
  form.addEventListener('submit', function (e) {
    e.preventDefault(); out.value = build(); $('z-out-wrap').hidden = false;
    var miss = ['name', 'id', 'birth', 'addr', 'mail', 'tel'].filter(function (n) { return !v(n); });
    say(miss.length ? 'Не заповнено обов’язкові відомості (п. 58): залишено «________». Допишіть їх. Офіційна форма — додаток 4 ПКМУ № 560; ЦНАП може запропонувати її.' : 'Текст готовий. Офіційна форма заяви — додаток 4 ПКМУ № 560; ЦНАП може запропонувати її.');
    $('z-out-wrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  form.addEventListener('reset', function () { $('z-out-wrap').hidden = true; out.value = ''; setTimeout(function () { $('z-old').hidden = true; $('z-old-l').hidden = true; docs(); }, 0); });
  $('z-copy').addEventListener('click', function () {
    var ok = function () { say('Скопійовано.'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(out.value).then(ok, function () { out.select(); document.execCommand('copy'); ok(); });
    else { out.select(); document.execCommand('copy'); ok(); }
  });
  $('z-dl').addEventListener('click', function () {
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + out.value], { type: 'text/plain;charset=utf-8' }));
    a.download = 'zaiava-vidstrochka.txt'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });
  $('z-print').addEventListener('click', function () {
    var pre = document.getElementById('printable');
    if (!pre) { pre = document.createElement('pre'); pre.id = 'printable'; document.body.appendChild(pre); }
    pre.textContent = out.value; window.print();
  });
})();
