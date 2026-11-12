/*
 * QuoteReady quote page logic.
 * URL options:
 *   ?api=https://script.google.com/macros/s/XXXX/exec   live mode (talks to the owner's Google Sheet)
 *   ?demo=house-cleaning                                  demo mode (nothing is sent anywhere)
 *   &live=1                                               demo only: show the price while choosing
 *   &ref=https://their-site.com/page                      where the customer came from (set by embed.js)
 * All text from the price list is inserted with textContent, never as HTML.
 */
(function () {
  'use strict';

  var P = window.QRPricing;
  var T = window.QRTemplates;
  var params = new URLSearchParams(location.search);
  var API_RE = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{20,}\/exec$/;

  var state = {
    step: 'service',
    config: null,
    api: null,
    demo: false,
    sel: { serviceId: '', qty: null, options: {}, addons: [], frequencyId: '' },
    contact: { name: '', email: '', phone: '', address: '', note: '', contactPref: 'any', marketingOk: false },
    startedAt: Date.now(),
    result: null,
    submitting: false
  };

  var $ = function (id) { return document.getElementById(id); };

  /* Small DOM helper: h('div', {class:'x', onclick: fn}, [children or text]) */
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    [].concat(kids || []).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return el;
  }

  function safeUrl(u) { return /^https:\/\/[^\s"'<>]+$/i.test(String(u || '')) ? u : ''; }

  /* ------------------------------------------------------------------ */
  /* Start up                                                            */
  /* ------------------------------------------------------------------ */

  function start() {
    var api = params.get('api');
    var demoKey = params.get('demo');
    if (api && API_RE.test(api)) {
      state.api = api;
      loadLiveConfig();
    } else if (api) {
      fatal('This quote link is not set up correctly (the web app address is wrong). Please contact the business directly.');
    } else {
      state.demo = true;
      useDemo(demoKey && T[demoKey] ? demoKey : 'house-cleaning');
    }
  }

  function demoConfig(key) {
    var t = T[key];
    var parsed = P.fromSheetRows({ services: t.services, options: t.options, addons: t.addons, frequencies: t.frequencies });
    return {
      business: {
        name: t.business.name, brandColor: t.business.brandColor, phone: t.business.phone, logoUrl: '',
        headline: t.business.headline, intro: t.business.intro, publicEmail: 'hello@example.com', website: '',
        serviceArea: 'Sample service area', hours: 'Mon-Sat 8am-6pm',
        disclaimer: 'This is an estimate based on what you told us. Your final price is confirmed after we see the job.',
        thankYou: 'Thanks! We got your request and will contact you soon.', bookingUrl: '', privacyUrl: '', currency: '$'
      },
      display: { priceMode: 'range', rangePercent: 10, priceTiming: params.get('live') === '1' ? 'live' : 'after', poweredBy: true, poweredByText: 'QuoteReady', poweredByUrl: '', contactButton: ['call', 'email', 'both', 'none'].indexOf(params.get('contact')) >= 0 ? params.get('contact') : 'call' },
      form: { phone: 'required', address: 'zip' },
      zipCodes: [],
      services: parsed.services,
      frequencies: parsed.frequencies
    };
  }

  function useDemo(key) {
    state.config = demoConfig(key);
    var banner = $('qr-demo-banner');
    banner.hidden = false;
    banner.textContent = 'Demo with sample prices for a made-up business. Nothing you type is sent or saved.';
    boot();
  }

  function loadLiveConfig() {
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 15000);
    fetch(state.api + '?action=config', { method: 'GET', signal: ctrl ? ctrl.signal : undefined, credentials: 'omit' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (data) {
        clearTimeout(timer);
        if (!data || !data.ok || !data.config) throw new Error((data && data.error) || 'No price list');
        if (!data.config.services || !data.config.services.length) throw new Error('empty');
        state.config = data.config;
        boot();
      })
      .catch(function (err) {
        clearTimeout(timer);
        fatal(String(err && err.message) === 'empty'
          ? 'Online quotes are not set up yet. Please contact the business directly.'
          : 'We could not load the price list. Please check your internet connection and try again, or contact the business directly.', true);
      });
  }

  function fatal(message, canRetry) {
    $('qr-header').setAttribute('aria-busy', 'false');
    $('qr-headline').textContent = 'Instant quote';
    var main = $('qr-main');
    main.textContent = '';
    main.appendChild(h('div', { class: 'qr-error-box', role: 'alert' }, message));
    if (canRetry) main.appendChild(h('button', { class: 'qr-btn ghost', type: 'button', onclick: function () { location.reload(); } }, 'Try again'));
  }

  function boot() {
    var c = state.config;
    applyTheme(c.business.brandColor);
    document.title = (c.business.headline || 'Instant quote') + ' | ' + c.business.name;
    renderHeader();
    renderFooter();
    if (c.services.length === 1) { chooseService(c.services[0].id); go('details', true); }
    else go('service', true);
    observeHeight();
  }

  function applyTheme(color) {
    var root = document.documentElement.style;
    var brand = P.isHexColor(color) ? (color.charAt(0) === '#' ? color : '#' + color) : '#2a7de1';
    root.setProperty('--brand', brand);
    root.setProperty('--on-brand', P.readableTextOn(brand));
    root.setProperty('--brand-text', P.accessibleOnWhite(brand));
  }

  function renderHeader() {
    var b = state.config.business;
    var head = $('qr-header');
    head.setAttribute('aria-busy', 'false');
    var brand = head.querySelector('.qr-brand');
    brand.textContent = '';
    var logo = safeUrl(b.logoUrl);
    if (logo) {
      var img = h('img', { src: logo, alt: b.name });
      img.addEventListener('error', function () { brand.textContent = ''; brand.appendChild(h('span', { class: 'qr-dot', 'aria-hidden': 'true' })); brand.appendChild(h('span', { class: 'qr-name', text: b.name })); });
      brand.appendChild(img);
    } else {
      brand.appendChild(h('span', { class: 'qr-dot', 'aria-hidden': 'true' }));
      brand.appendChild(h('span', { class: 'qr-name', text: b.name }));
    }
    $('qr-headline').textContent = b.headline || 'Get your price in 60 seconds';
    $('qr-intro').textContent = b.intro || '';
  }

  function renderFooter() {
    var b = state.config.business, d = state.config.display;
    var f = $('qr-footer');
    f.textContent = '';
    var bits = [];
    if (b.phone) bits.push(h('a', { href: 'tel:' + b.phone.replace(/[^0-9+]/g, '') }, b.phone));
    if (b.publicEmail) bits.push(h('a', { href: 'mailto:' + b.publicEmail }, b.publicEmail));
    if (bits.length) {
      var p = h('p', {}, ['Questions? ']);
      bits.forEach(function (el, i) { if (i) p.appendChild(document.createTextNode(' or ')); p.appendChild(el); });
      f.appendChild(p);
    }
    var line2 = [b.serviceArea, b.hours].filter(Boolean).join(' | ');
    if (line2) f.appendChild(h('p', { text: line2 }));
    if (d.poweredBy) {
      var url = safeUrl(d.poweredByUrl);
      var label = d.poweredByText || 'QuoteReady';
      f.appendChild(h('p', { class: 'powered' }, ['Powered by ', url ? h('a', { href: url, target: '_blank', rel: 'noopener' }, label) : label]));
    }
  }

  /* ------------------------------------------------------------------ */
  /* Steps                                                               */
  /* ------------------------------------------------------------------ */

  var STEPS = [['service', 'Service'], ['details', 'Details'], ['contact', 'Your info'], ['done', 'Your price']];

  function go(step, initial) {
    state.step = step;
    var c = state.config;
    var list = STEPS.filter(function (s) { return !(s[0] === 'service' && c.services.length === 1); });
    var idx = list.map(function (s) { return s[0]; }).indexOf(step);
    var ol = $('qr-steps');
    ol.textContent = '';
    list.forEach(function (s, i) {
      ol.appendChild(h('li', { class: i < idx ? 'done' : (i === idx ? 'current' : ''), 'aria-current': i === idx ? 'step' : null }, s[1]));
    });
    $('qr-progress').hidden = false;

    var main = $('qr-main');
    main.textContent = '';
    if (step === 'service') renderService(main);
    if (step === 'details') renderDetails(main);
    if (step === 'contact') renderContact(main);
    if (step === 'done') renderDone(main);
    updateLiveBar();
    if (!initial) {
      var heading = main.querySelector('h2');
      if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }); }
      try { (window.parent !== window ? main : document.body).scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (x) { /* old browsers */ }
      postToParent({ type: 'quoteready:step', step: step });
    }
  }

  function service() { return (state.config.services || []).filter(function (s) { return s.id === state.sel.serviceId; })[0]; }

  function chooseService(id) {
    if (state.sel.serviceId === id) return;
    var s = state.config.services.filter(function (x) { return x.id === id; })[0];
    state.sel = { serviceId: id, qty: P.hasQuantity(s) ? s.def : null, options: {}, addons: [], frequencyId: '' };
    // Pre-select the first answer of each question and the first frequency so the price can show immediately.
    s.options.forEach(function (o) { if (o.choices[0]) state.sel.options[o.id] = o.choices[0].id; });
    if (s.recurring && state.config.frequencies.length) state.sel.frequencyId = state.config.frequencies[0].id;
  }

  function renderService(main) {
    main.appendChild(h('h2', { text: 'What do you need?' }));
    main.appendChild(h('p', { class: 'qr-sub', text: 'Pick one to start. You can change it later.' }));
    var fs = h('fieldset', {}, [h('legend', { class: 'qr-sr', text: 'Choose a service' })]);
    var grid = h('div', { class: 'qr-choices' });
    state.config.services.forEach(function (s) {
      var input = h('input', { type: 'radio', name: 'service', value: s.id, id: 'svc-' + s.id, checked: state.sel.serviceId === s.id });
      input.addEventListener('change', function () { chooseService(s.id); go('details'); });
      grid.appendChild(h('div', { class: 'qr-choice' }, [input, h('label', { class: 'box', for: 'svc-' + s.id }, [h('b', { text: s.name }), s.description ? h('span', { text: s.description }) : null])]));
    });
    fs.appendChild(grid);
    main.appendChild(fs);
  }

  function errorSlot(id) { return h('div', { class: 'qr-err', id: id + '-err', role: 'alert' }); }

  function renderDetails(main) {
    var s = service();
    var c = state.config;
    main.appendChild(h('h2', { text: s.name }));
    main.appendChild(h('p', { class: 'qr-sub', text: s.description || 'A few quick questions so we can price it right.' }));

    if (P.hasQuantity(s)) {
      var label = 'How many ' + (s.unitLabel || 'units') + '?';
      var number = h('input', { type: 'number', id: 'qty', inputmode: 'decimal', min: s.min, max: s.max, step: s.step, value: state.sel.qty, 'aria-describedby': 'qty-hint qty-err' });
      var range = h('input', { type: 'range', id: 'qty-range', min: s.min, max: s.max, step: s.step, value: state.sel.qty, 'aria-label': label + ' (slider)' });
      number.addEventListener('input', function () { state.sel.qty = number.value === '' ? null : Number(number.value); if (number.value !== '') range.value = number.value; clearErr('qty'); updateLiveBar(); });
      range.addEventListener('input', function () { number.value = range.value; state.sel.qty = Number(range.value); clearErr('qty'); updateLiveBar(); });
      main.appendChild(h('div', { class: 'qr-field' }, [
        h('label', { for: 'qty', text: label }),
        h('div', { class: 'qr-qty' }, [range, number]),
        h('div', { class: 'qr-privacy', id: 'qty-hint', text: 'Between ' + s.min + ' and ' + s.max + '. A good guess is fine.' }),
        errorSlot('qty')
      ]));
    }

    s.options.forEach(function (o) {
      var fs = h('fieldset', { 'aria-describedby': 'opt-' + o.id + '-err' }, [h('legend', { text: o.question })]);
      var grid = h('div', { class: 'qr-choices cols' });
      o.choices.forEach(function (ch) {
        var id = 'opt-' + o.id + '-' + ch.id;
        var input = h('input', { type: 'radio', name: 'opt-' + o.id, id: id, value: ch.id, checked: state.sel.options[o.id] === ch.id });
        input.addEventListener('change', function () { state.sel.options[o.id] = ch.id; clearErr('opt-' + o.id); updateLiveBar(); });
        grid.appendChild(h('div', { class: 'qr-choice' }, [input, h('label', { class: 'box', for: id }, [h('b', { text: ch.label })])]));
      });
      fs.appendChild(grid);
      fs.appendChild(errorSlot('opt-' + o.id));
      main.appendChild(fs);
    });

    if (s.addons.length) {
      var afs = h('fieldset', {}, [h('legend', { text: 'Add any extras?' })]);
      var agrid = h('div', { class: 'qr-choices' });
      s.addons.forEach(function (a) {
        var id = 'addon-' + a.id;
        var input = h('input', { type: 'checkbox', id: id, value: a.id, checked: state.sel.addons.indexOf(a.id) >= 0 });
        input.addEventListener('change', function () {
          state.sel.addons = state.sel.addons.filter(function (x) { return x !== a.id; });
          if (input.checked) state.sel.addons.push(a.id);
          updateLiveBar();
        });
        var priceText = a.amount ? '+' + P.money(a.amount, c.business.currency) + (a.type === 'perunit' ? ' per ' + singular(s.unitLabel) : '') : '';
        agrid.appendChild(h('div', { class: 'qr-choice qr-check' }, [input, h('label', { class: 'box', for: id }, [h('span', {}, [h('b', { text: a.label }), priceText ? h('span', { text: priceText }) : null]), h('span', { class: 'tick', 'aria-hidden': 'true' })])]));
      });
      afs.appendChild(agrid);
      main.appendChild(afs);
    }

    if (s.recurring && c.frequencies.length) {
      var ffs = h('fieldset', { 'aria-describedby': 'frequency-err' }, [h('legend', { text: 'How often?' })]);
      var fgrid = h('div', { class: 'qr-choices cols' });
      c.frequencies.forEach(function (f) {
        var id = 'freq-' + f.id;
        var input = h('input', { type: 'radio', name: 'frequency', id: id, value: f.id, checked: state.sel.frequencyId === f.id });
        input.addEventListener('change', function () { state.sel.frequencyId = f.id; clearErr('frequency'); updateLiveBar(); });
        fgrid.appendChild(h('div', { class: 'qr-choice' }, [input, h('label', { class: 'box', for: id }, [h('b', { text: f.label }), f.discount ? h('span', { text: 'Save ' + f.discount + '%' }) : null])]));
      });
      ffs.appendChild(fgrid);
      ffs.appendChild(errorSlot('frequency'));
      main.appendChild(ffs);
    }

    var actions = h('div', { class: 'qr-actions' });
    if (c.services.length > 1) actions.appendChild(h('button', { type: 'button', class: 'qr-btn ghost', onclick: function () { go('service'); } }, 'Back'));
    actions.appendChild(h('button', { type: 'button', class: 'qr-btn primary', onclick: function () {
      var errs = P.validateSelection(c, state.sel);
      if (errs.length) { showErrors(errs); return; }
      go('contact');
    } }, c.display.priceTiming === 'live' ? 'Continue' : 'Next: see my price'));
    main.appendChild(actions);
  }

  function singular(label) { return String(label || 'unit').replace(/s$/i, ''); }

  function renderContact(main) {
    var c = state.config, k = state.contact, form = c.form || { phone: 'required', address: 'zip' };
    var live = c.display.priceTiming === 'live';
    main.appendChild(h('h2', { text: live ? 'Where should we send your quote?' : 'Your price is ready' }));
    main.appendChild(h('p', { class: 'qr-sub', text: live ? 'We will email you a copy and reach out to get you scheduled.' : 'Tell us where to send it and we will show it to you right away.' }));

    var f = h('form', { novalidate: true, id: 'contact-form' });
    f.appendChild(field('name', 'Your name', 'text', k.name, { autocomplete: 'name', maxlength: 80, required: true }));
    f.appendChild(field('email', 'Email', 'email', k.email, { autocomplete: 'email', maxlength: 120, required: true, inputmode: 'email' }));
    if (form.phone !== 'hidden') f.appendChild(field('phone', 'Phone', 'tel', k.phone, { autocomplete: 'tel', maxlength: 25, required: form.phone === 'required', inputmode: 'tel' }, form.phone === 'optional'));
    if (form.address !== 'hidden') {
      var zipOnly = form.address === 'zip';
      f.appendChild(field('address', zipOnly ? 'ZIP code' : 'Job address', 'text', k.address, { autocomplete: zipOnly ? 'postal-code' : 'street-address', maxlength: zipOnly ? 10 : 150, required: true, inputmode: zipOnly ? 'numeric' : null }));
    }
    var pref = h('select', { id: 'contactPref', name: 'contactPref' });
    [['any', 'Any way is fine'], ['call', 'Call me'], ['text', 'Text me'], ['email', 'Email me']].forEach(function (o) { pref.appendChild(h('option', { value: o[0], selected: k.contactPref === o[0] }, o[1])); });
    f.appendChild(h('div', { class: 'qr-field' }, [h('label', { for: 'contactPref', text: 'Best way to reach you' }), pref]));
    var note = h('textarea', { id: 'note', name: 'note', maxlength: 1000, rows: 3 }, k.note);
    f.appendChild(h('div', { class: 'qr-field' }, [h('label', { for: 'note' }, ['Anything we should know? ', h('span', { class: 'opt', text: '(optional)' })]), note]));

    // Honeypot: real people never see this field. Bots fill it in.
    f.appendChild(h('div', { class: 'qr-hp', 'aria-hidden': 'true' }, [h('label', { for: 'company_website', text: 'Leave this empty' }), h('input', { type: 'text', id: 'company_website', name: 'company_website', tabindex: '-1', autocomplete: 'off' })]));

    var consent = h('input', { type: 'checkbox', id: 'marketingOk', checked: k.marketingOk });
    f.appendChild(h('div', { class: 'qr-field' }, [h('label', { class: 'qr-consent', for: 'marketingOk' }, [consent, h('span', { text: 'Optional: you may also send me occasional offers by email. I can unsubscribe any time.' })])]));

    var privacy = h('p', { class: 'qr-privacy' }, ['We use your info only to answer this request. ']);
    var purl = safeUrl(c.business.privacyUrl);
    if (purl) privacy.appendChild(h('a', { href: purl, target: '_blank', rel: 'noopener', text: 'Privacy policy' }));
    f.appendChild(privacy);
    f.appendChild(h('div', { class: 'qr-error-box', id: 'form-err', role: 'alert', hidden: true }));

    var submit = h('button', { type: 'submit', class: 'qr-btn primary', id: 'submit-btn' }, live ? 'Send my request' : 'Show my price');
    f.appendChild(h('div', { class: 'qr-actions' }, [h('button', { type: 'button', class: 'qr-btn ghost', onclick: function () { saveContact(); go('details'); } }, 'Back'), submit]));
    f.addEventListener('submit', function (ev) { ev.preventDefault(); submitLead(); });
    main.appendChild(f);
  }

  function field(id, label, type, value, attrs, optional) {
    var a = { type: type, id: id, name: id, value: value || '', 'aria-describedby': id + '-err' };
    Object.keys(attrs || {}).forEach(function (k) { if (attrs[k] !== null) a[k] = attrs[k]; });
    var input = h('input', a);
    input.addEventListener('input', function () { clearErr(id); });
    return h('div', { class: 'qr-field' }, [h('label', { for: id }, [label, optional ? h('span', { class: 'opt', text: ' (optional)' }) : null]), input, errorSlot(id)]);
  }

  function saveContact() {
    ['name', 'email', 'phone', 'address', 'note', 'contactPref'].forEach(function (k) { var el = $(k); if (el) state.contact[k] = el.value; });
    var m = $('marketingOk'); if (m) state.contact.marketingOk = m.checked;
  }

  function clearErr(id) {
    var slot = $(id + '-err'); if (slot) slot.textContent = '';
    var input = $(id); if (input) input.removeAttribute('aria-invalid');
  }

  function showErrors(errs) {
    var first = null;
    errs.forEach(function (e) {
      var slot = $(e.field + '-err');
      if (slot) slot.textContent = e.message;
      var input = $(e.field) || document.querySelector('[name="' + e.field + '"]');
      if (input) input.setAttribute('aria-invalid', 'true');
      if (!first) first = input || slot;
    });
    if (!errs.some(function (e) { return $(e.field + '-err'); })) {
      var box = $('form-err');
      if (box) { box.hidden = false; box.textContent = errs[0].message; first = box; }
    }
    if (first && first.focus) { if (!first.hasAttribute('tabindex') && first.tagName === 'DIV') first.setAttribute('tabindex', '-1'); first.focus(); }
  }

  /* Client-side contact checks (the server checks again). */
  function checkContact() {
    var c = state.config, k = state.contact, form = c.form || { phone: 'required', address: 'zip' }, errs = [];
    if (String(k.name).trim().length < 2) errs.push({ field: 'name', message: 'Please enter your name.' });
    if (!/^[^\s@<>"'(),;:]{1,64}@[^\s@<>"'(),;:]{1,180}\.[a-z]{2,24}$/i.test(String(k.email).trim())) errs.push({ field: 'email', message: 'Please enter a valid email address, like name@example.com.' });
    var digits = String(k.phone || '').replace(/\D/g, '');
    if (form.phone === 'required' && (digits.length < 7 || digits.length > 15)) errs.push({ field: 'phone', message: 'Please enter a phone number we can reach you at.' });
    else if (form.phone !== 'hidden' && k.phone && (digits.length < 7 || digits.length > 15 || /[^0-9+()\-.\s]/.test(k.phone))) errs.push({ field: 'phone', message: 'That phone number does not look right.' });
    if (form.address !== 'hidden' && String(k.address).trim().length < 3) errs.push({ field: 'address', message: form.address === 'zip' ? 'Please enter your ZIP code.' : 'Please enter the job address.' });
    return errs;
  }

  function submitLead() {
    if (state.submitting) return;
    saveContact();
    var errs = checkContact();
    if (errs.length) { showErrors(errs); return; }
    var price = P.calculate(state.config, state.sel);
    if (!price.ok) { go('details'); setTimeout(function () { showErrors(price.errors); }, 0); return; }

    var hp = $('company_website');
    var payload = {
      action: 'submit',
      selection: state.sel,
      contact: {
        name: state.contact.name.trim(), email: state.contact.email.trim(), phone: (state.contact.phone || '').trim(),
        address: (state.contact.address || '').trim(), note: (state.contact.note || '').trim(), contactPref: state.contact.contactPref, marketingOk: !!state.contact.marketingOk
      },
      source: (safeRef() || document.referrer || '').slice(0, 300),
      elapsedMs: Date.now() - state.startedAt,
      company_website: hp ? hp.value : ''
    };

    setBusy(true);
    var done = function (res) {
      setBusy(false);
      if (!res || !res.ok) {
        var field = res && res.field;
        var e = [{ field: field && $(field) ? field : 'form', message: (res && res.error) || 'Something went wrong. Please try again.' }];
        if (field && /^(qty|opt-|frequency|service|addons)/.test(field)) { go('details'); setTimeout(function () { showErrors(e); }, 0); return; }
        showErrors(e);
        return;
      }
      state.result = { price: price, server: res.estimate, leadId: res.leadId, outside: !!res.outsideArea };
      postToParent({ type: 'quoteready:lead', service: price.serviceName, value: Math.round((price.low + price.high) / 2) });
      go('done');
    };

    if (state.demo) { setTimeout(function () { done({ ok: true, leadId: 'DEMO', estimate: null }); }, 650); return; }

    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 25000);
    fetch(state.api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload), signal: ctrl ? ctrl.signal : undefined, credentials: 'omit' })
      .then(function (r) { return r.json(); })
      .then(function (res) { clearTimeout(timer); done(res); })
      .catch(function () {
        clearTimeout(timer);
        var phone = state.config.business.phone;
        done({ ok: false, field: 'form', error: 'We could not send your request. Please check your internet connection and try again' + (phone ? ', or call ' + phone : '') + '.' });
      });
  }

  function setBusy(busy) {
    state.submitting = busy;
    var b = $('submit-btn');
    if (b) { b.disabled = busy; b.textContent = busy ? 'Sending...' : (state.config.display.priceTiming === 'live' ? 'Send my request' : 'Show my price'); }
    var box = $('form-err'); if (box && busy) box.hidden = true;
  }

  function safeRef() {
    var r = params.get('ref');
    return r && /^https?:\/\//i.test(r) ? r : '';
  }

  function renderDone(main) {
    var c = state.config, b = c.business, r = state.result, price = r.price;
    var wrap = h('div', { class: 'qr-result' });
    wrap.appendChild(h('div', { class: 'qr-success', role: 'status' }, [h('span', { 'aria-hidden': 'true', text: '✓' }), h('span', { text: b.thankYou || 'Thanks! We got your request.' })]));
    if (r.outside) wrap.appendChild(h('div', { class: 'qr-warn', text: 'Your address may be outside our usual service area. We will let you know if we can help.' }));
    wrap.appendChild(h('h2', { text: 'Your estimate for ' + price.serviceName }));
    wrap.appendChild(h('p', { class: 'price', text: price.display }));
    wrap.appendChild(h('p', { class: 'what', text: price.summary }));
    if (price.mode === 'exact') {
      var tb = h('tbody');
      price.lines.forEach(function (l) { tb.appendChild(h('tr', {}, [h('td', { text: l.label }), h('td', { text: l.amount === null ? '' : P.money(l.amount, b.currency) })])); });
      tb.appendChild(h('tr', {}, [h('td', {}, [h('b', { text: 'Total' })]), h('td', {}, [h('b', { text: P.money(price.total, b.currency) })])]));
      wrap.appendChild(h('table', {}, [h('caption', { class: 'qr-sr', text: 'Price breakdown' }), tb]));
    }
    if (b.disclaimer) wrap.appendChild(h('p', { class: 'qr-note', text: b.disclaimer }));
    if (!state.demo) wrap.appendChild(h('p', { class: 'qr-privacy', text: 'Reference number: ' + r.leadId + '. ' + (state.contact.email ? 'A copy may also be sent to ' + state.contact.email + '.' : '') }));
    var actions = h('div', { class: 'qr-actions' });
    var book = safeUrl(b.bookingUrl);
    if (book) actions.appendChild(h('a', { class: 'qr-btn primary', href: book, target: '_blank', rel: 'noopener' }, 'Book a time'));
    contactButtons(b, c.display.contactButton || 'call', price, r.leadId).forEach(function (btn, i) {
      btn.className = 'qr-btn ' + (!book && i === 0 ? 'primary' : 'ghost');
      actions.appendChild(btn);
    });
    actions.appendChild(h('button', { type: 'button', class: 'qr-btn ghost', onclick: function () { window.print(); } }, 'Print'));
    actions.appendChild(h('button', { type: 'button', class: 'qr-btn ghost', onclick: function () { state.sel.serviceId = ''; state.result = null; state.startedAt = Date.now(); go(c.services.length === 1 ? (chooseService(c.services[0].id), 'details') : 'service'); } }, 'Start over'));
    wrap.appendChild(actions);
    main.appendChild(wrap);
  }

  /* The owner chooses: Call now, Email us, Both, or None (Settings tab). */
  function contactButtons(b, mode, price, leadId) {
    var out = [];
    var wantCall = (mode === 'call' || mode === 'both') && b.phone;
    var emailOk = /^[^\s@<>"'(),;:]{1,64}@[^\s@<>"'(),;:]{1,180}\.[a-z]{2,24}$/i.test(String(b.publicEmail || ''));
    var wantEmail = (mode === 'email' || mode === 'both') && emailOk;
    if (wantCall) out.push(h('a', { href: 'tel:' + b.phone.replace(/[^0-9+]/g, ''), 'aria-label': 'Call now: ' + b.phone, 'data-contact': 'call' }, 'Call now'));
    if (wantEmail) {
      var subject = 'Quote request: ' + price.serviceName + (leadId && leadId !== 'DEMO' ? ' (' + leadId + ')' : '');
      var body = 'Hi ' + b.name + ',\n\nI just got an estimate of ' + price.display + ' for ' + price.serviceName + ' on your website.\n' + price.summary + '\n\nMy name: ' + (state.contact.name || '') + '\nBest way to reach me: ' + (state.contact.phone || state.contact.email || '') + '\n';
      out.push(h('a', { href: 'mailto:' + b.publicEmail + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body), 'aria-label': 'Email us at ' + b.publicEmail, 'data-contact': 'email' }, 'Email us'));
    }
    if (state.demo) {
      // Demo numbers and emails are fake, so explain instead of dialing.
      out.forEach(function (a) {
        a.addEventListener('click', function (e) {
          e.preventDefault();
          var note = $('demo-contact-note');
          if (!note) { note = h('p', { class: 'qr-note', id: 'demo-contact-note', role: 'status' }); a.parentNode.parentNode.insertBefore(note, a.parentNode.nextSibling); }
          note.textContent = a.getAttribute('data-contact') === 'call'
            ? 'Demo: in your real version, this calls your business phone number.'
            : 'Demo: in your real version, this opens an email to your business, already filled in with the customer\'s quote.';
        });
      });
    }
    return out;
  }

  /* Live price bar (only when the owner chose "Live while choosing"). */
  function updateLiveBar() {
    var bar = $('qr-livebar');
    var c = state.config;
    if (!c || c.display.priceTiming !== 'live' || state.step !== 'details' && state.step !== 'contact') { bar.hidden = true; return; }
    var p = P.calculate(c, state.sel);
    bar.hidden = false;
    bar.textContent = '';
    bar.appendChild(h('span', { text: 'Estimated price' }));
    bar.appendChild(h('strong', { text: p.ok ? p.display : 'Answer the questions' }));
  }

  /* ------------------------------------------------------------------ */
  /* Talking to the website that embeds us (no personal info is sent)   */
  /* ------------------------------------------------------------------ */

  function postToParent(msg) {
    if (window.parent === window) return;
    try { window.parent.postMessage(msg, '*'); } catch (x) { /* ignore */ }
  }

  function observeHeight() {
    if (window.parent === window) return;
    var last = 0;
    var send = function () {
      var hgt = Math.ceil(document.documentElement.scrollHeight);
      if (Math.abs(hgt - last) > 2) { last = hgt; postToParent({ type: 'quoteready:height', height: hgt }); }
    };
    if (window.ResizeObserver) new ResizeObserver(send).observe(document.body);
    window.addEventListener('load', send);
    setInterval(send, 1000);
    send();
  }

  start();
})();
