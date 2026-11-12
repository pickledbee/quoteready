/*
 * QuoteReady embed script. Paste on any website:
 *
 *   <div id="quoteready"></div>
 *   <script src="https://YOUR-QUOTE-PAGE-ADDRESS/embed.js"
 *           data-api="https://script.google.com/macros/s/XXXX/exec" defer></script>
 *
 * Optional attributes:
 *   data-target="#my-box"   put the form somewhere other than #quoteready
 *   data-demo="lawn-care"   show a demo instead of a live form (no data-api needed)
 *
 * When a customer finishes a quote, this fires:
 *   - window event "quoteready:lead"  (detail: { service, value })
 *   - Google Tag Manager dataLayer push { event: "quoteready_lead" } if GTM is on the page
 *   - gtag('event', 'generate_lead') if Google Analytics 4 is on the page
 *   - fbq('track', 'Lead') if the Meta pixel is on the page
 * No names, emails or phone numbers are ever shared with the host page or trackers.
 */
(function () {
  'use strict';
  var script = document.currentScript || (function () { var s = document.getElementsByTagName('script'); return s[s.length - 1]; })();
  if (!script) return;
  var base = script.src.replace(/embed\.js(\?.*)?$/, '');
  var api = script.getAttribute('data-api') || '';
  var demo = script.getAttribute('data-demo') || '';
  var target = document.querySelector(script.getAttribute('data-target') || '#quoteready');
  if (!target) { target = document.createElement('div'); script.parentNode.insertBefore(target, script); }

  // Only pass the page address and ad-tracking tags, never anything else from the host page.
  var ref = location.origin + location.pathname;
  var utm = new URLSearchParams(location.search);
  var keep = [];
  ['utm_source', 'utm_medium', 'utm_campaign', 'gclid', 'fbclid'].forEach(function (k) { if (utm.get(k)) keep.push(k + '=' + encodeURIComponent(utm.get(k)).slice(0, 80)); });
  if (keep.length) ref += '?' + keep.join('&');

  var q = api ? 'api=' + encodeURIComponent(api) : 'demo=' + encodeURIComponent(demo || 'house-cleaning');
  var src = base + 'quote/?' + q + '&ref=' + encodeURIComponent(ref);

  var frame = document.createElement('iframe');
  frame.src = src;
  frame.title = 'Instant price quote form';
  frame.loading = 'lazy';
  frame.setAttribute('allow', 'clipboard-write');
  frame.style.cssText = 'width:100%;border:0;display:block;min-height:560px;height:720px;background:transparent;color-scheme:normal';
  target.appendChild(frame);

  // Only listen to OUR quote frame. (Checking the window, not the address, keeps working
  // if the quote page moves to a custom domain and the old address redirects.)
  window.addEventListener('message', function (e) {
    if (e.source !== frame.contentWindow || !e.data || typeof e.data !== 'object') return;
    if (e.data.type === 'quoteready:height' && typeof e.data.height === 'number') {
      frame.style.height = Math.max(420, Math.min(4000, e.data.height + 4)) + 'px';
    }
    if (e.data.type === 'quoteready:lead') {
      var detail = { service: String(e.data.service || '').slice(0, 80), value: Number(e.data.value) || 0 };
      try { window.dispatchEvent(new CustomEvent('quoteready:lead', { detail: detail })); } catch (x) { /* old browser */ }
      try { if (window.dataLayer && window.dataLayer.push) window.dataLayer.push({ event: 'quoteready_lead', quoteready_service: detail.service, value: detail.value }); } catch (x) { /* ignore */ }
      try { if (typeof window.gtag === 'function') window.gtag('event', 'generate_lead', { value: detail.value, currency: 'USD', service: detail.service }); } catch (x) { /* ignore */ }
      try { if (typeof window.fbq === 'function') window.fbq('track', 'Lead', { value: detail.value, currency: 'USD' }); } catch (x) { /* ignore */ }
    }
  });
})();
