'use strict';
(function () {
  var root = document.documentElement;
  var btn = document.getElementById('theme-btn');
  if (btn) {
    btn.addEventListener('click', function () {
      var cur = root.dataset.theme;
      if (!cur) cur = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      var next = cur === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch (e) {}
    });
  }
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
    });
  }
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('[data-print]')) {
      var pre = document.getElementById('printable');
      if (!pre) { pre = document.createElement('pre'); pre.id = 'printable'; document.body.appendChild(pre); }
      pre.textContent = 'МЕНЕ ЗУПИНИЛИ — СПОКІЙНО\n\n1. Не чиніть опір. Не тікайте.\n2. Запитайте: хто ви? П.І.Б., посада, причина.\n3. Покажіть паспорт і військово-обліковий документ.\n4. Не підписуйте нечитане.\n5. Запам’ятайте час, П.І.Б., номери авто.\n\nБезоплатна правова допомога: 0 800 213 103\nЗагроза життю: 102 / 112\n\nДовідкова інформація, а не юридична консультація.';
      window.print();
    }
  });
  // посилання виду /сторінка/#розділ: відкриваємо розділ-згортку
  function openHash() {
    var h = decodeURIComponent((location.hash || '').slice(1)), el = h && document.getElementById(h);
    if (el && el.tagName === 'DETAILS') { el.open = true; setTimeout(function () { el.scrollIntoView(); }, 50); }
  }
  openHash();
  window.addEventListener('hashchange', openHash);
  // кнопка адвоката: якщо LAWYER_TELEGRAM_URL не задано, сервер ставить tel:
  var lb = document.getElementById('lawyer-btn');
  if (lb && /^tel:/.test(lb.getAttribute('href'))) {
    lb.removeAttribute('target');
    lb.removeAttribute('rel');
    lb.textContent = 'Безоплатна правова допомога: 0 800 213 103';
    lb.classList.add('sos');
  }
})();
