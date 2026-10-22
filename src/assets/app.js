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
  // кнопка адвоката: якщо LAWYER_TELEGRAM_URL не задано, сервер ставить tel:
  var lb = document.getElementById('lawyer-btn');
  if (lb && /^tel:/.test(lb.getAttribute('href'))) {
    lb.removeAttribute('target');
    lb.removeAttribute('rel');
    lb.textContent = 'Заявка адвокату тимчасово недоступна — зателефонуйте 0 800 213 103';
  }
})();
