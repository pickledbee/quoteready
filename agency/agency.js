(function () {
  'use strict';
  var API_RE = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{20,}\/exec$/;
  var $ = function (id) { return document.getElementById(id); };
  var defaultBase = location.href.replace(/agency\/(index\.html)?(\?.*)?(#.*)?$/, '');
  $('base').value = defaultBase;

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  $('kitForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var api = $('api').value.trim();
    var base = $('base').value.trim();
    if (base && base.slice(-1) !== '/') base += '/';
    var err = '';
    if (!API_RE.test(api)) err = 'That does not look like a web app address. It should start with https://script.google.com/macros/s/ and end with /exec. Use a "Deploy > New deployment" address, not the "Test deployment" one (that ends in /dev).';
    else if (!/^(https:\/\/|http:\/\/localhost)/.test(base)) err = 'The quote page address must start with https://';
    $('apiErr').textContent = err;
    $('api').setAttribute('aria-invalid', err ? 'true' : 'false');
    if (err) { $('api').focus(); return; }
    var name = $('client').value.trim() || 'the client';
    var link = base + 'quote/?api=' + encodeURIComponent(api);
    $('link').value = link;
    $('embed').value = '<div id="quoteready"></div>\n<script src="' + base + 'embed.js" data-api="' + api + '" defer></script>';
    $('button').value = '<a href="' + link + '" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#0f1b2d;color:#ffffff;font-weight:700;text-decoration:none">Get an instant quote</a>';
    $('open').href = link;
    $('open').textContent = 'Open ' + name + "'s live quote page";
    $('outEmpty').hidden = true;
    $('outFull').hidden = false;
  });

  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var box = $(btn.getAttribute('data-copy'));
      box.select();
      var done = function () { var t = btn.textContent; btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = t; }, 1500); };
      if (navigator.clipboard) navigator.clipboard.writeText(box.value).then(done, function () { document.execCommand('copy'); done(); });
      else { document.execCommand('copy'); done(); }
    });
  });

  var demos = [['house-cleaning', 'House cleaning'], ['lawn-care', 'Lawn care'], ['pressure-washing', 'Pressure washing'], ['interior-painting', 'Interior painting'], ['window-cleaning', 'Window cleaning'], ['junk-removal', 'Junk removal']];
  var box = $('demos');
  demos.forEach(function (d) {
    var a = document.createElement('a');
    a.href = defaultBase + 'quote/?demo=' + d[0];
    a.target = '_blank';
    a.rel = 'noopener';
    a.innerHTML = esc(d[1]) + '<span>' + esc(defaultBase + 'quote/?demo=' + d[0]) + '</span>';
    box.appendChild(a);
  });
})();
