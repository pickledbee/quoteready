(function () {
  'use strict';
  var frame = document.getElementById('demoFrame');
  var industry = document.getElementById('industry');
  var live = document.getElementById('liveToggle');
  var contact = document.getElementById('contactMode');
  function load() {
    frame.src = 'quote/?demo=' + encodeURIComponent(industry.value) + (live.checked ? '&live=1' : '') + '&contact=' + encodeURIComponent(contact.value);
  }
  industry.addEventListener('change', load);
  live.addEventListener('change', load);
  contact.addEventListener('change', load);
  // Grow the demo frame to fit the form.
  window.addEventListener('message', function (e) {
    if (e.source !== frame.contentWindow || !e.data || e.data.type !== 'quoteready:height') return;
    frame.style.height = Math.max(560, Math.min(2000, e.data.height + 8)) + 'px';
  });
  // In-page links: scroll with script (works inside embedded viewers too) and make the demo flash
  // so a click always shows a visible result, even when the demo is already on screen.
  var card = document.querySelector('.demo-card');
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href').slice(1);
      var target = id ? document.getElementById(id) : null;
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: id === 'demo' ? 'center' : 'start' });
      if (id === 'demo' && card) {
        card.classList.remove('flash');
        void card.offsetWidth;
        card.classList.add('flash');
        setTimeout(function () { industry.focus({ preventScroll: true }); }, 400);
      }
    });
  });

  // If the demo frame never reports in (some viewers block embedded frames), offer a full-page link.
  var heard = false;
  window.addEventListener('message', function (e) { if (e.source === frame.contentWindow) heard = true; });
  setTimeout(function () {
    if (heard) return;
    var p = document.createElement('p');
    p.className = 'demo-fallback';
    var a = document.createElement('a');
    a.href = frame.src;
    a.target = '_blank';
    a.rel = 'noopener';
    a.className = 'btn dark small';
    a.textContent = 'Open the demo in a full page';
    p.appendChild(document.createTextNode('Demo not showing? '));
    p.appendChild(a);
    frame.parentNode.insertBefore(p, frame);
  }, 5000);

  var yr = document.getElementById('yr');
  if (yr) yr.textContent = String(new Date().getFullYear());
})();
