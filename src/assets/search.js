'use strict';
(function () {
  var form = document.getElementById('sf'), q = document.getElementById('q'), box = document.getElementById('results');
  if (!form) return;
  var index = null;
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function stem(w) { return w.length > 5 ? w.slice(0, w.length - 2) : w; }
  function load() {
    if (index) return Promise.resolve(index);
    return fetch('/assets/search-index.json?v=' + (document.documentElement.dataset.v || '1')).then(function (r) { return r.json(); }).then(function (j) { return (index = j); });
  }
  function run() {
    var words = q.value.toLowerCase().split(/[^\p{L}\p{N}-]+/u).filter(function (w) { return w.length > 1; }).map(stem);
    if (!words.length) { box.innerHTML = ''; return; }
    load().then(function (idx) {
      var scored = idx.map(function (p) {
        var t = p.t.toLowerCase(), d = p.d.toLowerCase(), x = p.x.toLowerCase(), s = 0, all = true;
        words.forEach(function (w) {
          var hit = false;
          if (t.indexOf(w) >= 0) { s += 5; hit = true; }
          if (d.indexOf(w) >= 0) { s += 3; hit = true; }
          if (x.indexOf(w) >= 0) { s += 1; hit = true; }
          if (!hit) all = false;
        });
        return { p: p, s: all ? s : 0 };
      }).filter(function (r) { return r.s > 0; }).sort(function (a, b) { return b.s - a.s; });
      box.innerHTML = scored.length
        ? '<ul class="res">' + scored.map(function (r) { return '<li><a href="' + r.p.u + '"><strong>' + esc(r.p.t) + '</strong>' + esc(r.p.d) + '</a></li>'; }).join('') + '</ul>'
        : '<p>Нічого не знайдено. Спробуйте інше слово: «повістка», «відстрочка», «скарга».</p>';
    }).catch(function () { box.innerHTML = '<p>Пошук недоступний без з’єднання, поки індекс не збережено.</p>'; });
  }
  form.addEventListener('submit', function (e) { e.preventDefault(); run(); });
  q.addEventListener('input', run);
  var m = /[?&]q=([^&]*)/.exec(location.search);
  if (m) { try { q.value = decodeURIComponent(m[1].replace(/\+/g, ' ')); run(); } catch (e) {} }
})();
