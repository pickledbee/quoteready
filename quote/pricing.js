/*
 * QuoteReady pricing engine  (shared file)
 * ------------------------------------------------------------
 * This exact file runs in three places:
 *   1. The customer's browser (quote page)       -> window.QRPricing
 *   2. Google Apps Script (copied as Pricing.gs)  -> global QRPricing
 *   3. Node.js tests                               -> require()
 * The server ALWAYS recalculates the price itself. The price a
 * browser sends is never trusted.
 * Run `node tools/sync.js` after editing so Apps Script gets the same copy.
 */
var QRPricing = (function () {
  'use strict';

  var OPTION_TYPES = { add: 'add', percent: 'percent', perunit: 'perunit' };
  var ADDON_TYPES = { flat: 'flat', perunit: 'perunit' };

  function slug(text) {
    return String(text == null ? '' : text)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'item';
  }

  function num(value, fallback) {
    if (value === '' || value === null || value === undefined) return fallback;
    var cleaned = typeof value === 'string' ? value.replace(/[$,%\s]/g, '') : value;
    var n = Number(cleaned);
    return isFinite(n) ? n : fallback;
  }

  function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  /* Rounds to a "friendly" number for price ranges: nearest $5 above $100, nearest $1 below. */
  function friendly(n) {
    if (n >= 100) return Math.round(n / 5) * 5;
    return Math.round(n);
  }

  function normalizeOptionType(t) {
    var s = String(t || '').toLowerCase();
    if (s.indexOf('%') !== -1 || s.indexOf('percent') !== -1) return OPTION_TYPES.percent;
    if (s.indexOf('unit') !== -1 || s.indexOf('per') !== -1) return OPTION_TYPES.perunit;
    return OPTION_TYPES.add;
  }

  function normalizeAddonType(t) {
    var s = String(t || '').toLowerCase();
    if (s.indexOf('unit') !== -1 || s.indexOf('per') !== -1) return ADDON_TYPES.perunit;
    return ADDON_TYPES.flat;
  }

  function hasQuantity(service) {
    return num(service.unitPrice, 0) !== 0 || !!service.unitLabel;
  }

  function findById(list, id) {
    for (var i = 0; i < (list || []).length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  /**
   * Validates a selection against the config.
   * Returns an array of { field, message } (empty when valid).
   */
  function validateSelection(config, sel) {
    var errors = [];
    if (!config || !config.services) return [{ field: 'config', message: 'Price list is not set up yet.' }];
    if (!sel || typeof sel !== 'object') return [{ field: 'service', message: 'Please choose a service.' }];
    var service = findById(config.services, sel.serviceId);
    if (!service) return [{ field: 'service', message: 'Please choose a service from the list.' }];

    if (hasQuantity(service)) {
      var q = num(sel.qty, NaN);
      var min = num(service.min, 0);
      var max = num(service.max, 1000000);
      if (!isFinite(q)) {
        errors.push({ field: 'qty', message: 'Please enter a number for ' + (service.unitLabel || 'size') + '.' });
      } else if (q < min || q > max) {
        errors.push({ field: 'qty', message: 'Please enter a number from ' + min + ' to ' + max + '.' });
      }
    }

    var chosen = sel.options || {};
    (service.options || []).forEach(function (opt) {
      var choiceId = chosen[opt.id];
      if (!choiceId) {
        errors.push({ field: 'opt-' + opt.id, message: 'Please answer: ' + opt.question });
      } else if (!findById(opt.choices, choiceId)) {
        errors.push({ field: 'opt-' + opt.id, message: 'Please pick one of the listed answers for: ' + opt.question });
      }
    });

    (sel.addons || []).forEach(function (addonId) {
      if (!findById(service.addons, addonId)) {
        errors.push({ field: 'addons', message: 'One of the extras is not available for this service.' });
      }
    });

    if (service.recurring && (config.frequencies || []).length) {
      if (!findById(config.frequencies, sel.frequencyId)) {
        errors.push({ field: 'frequency', message: 'Please choose how often you would like this service.' });
      }
    }
    return errors;
  }

  /**
   * Calculates the price.
   * Returns { ok, errors, total, low, high, lines[], summary, display }
   */
  function calculate(config, sel) {
    var errors = validateSelection(config, sel);
    if (errors.length) return { ok: false, errors: errors };

    var service = findById(config.services, sel.serviceId);
    var display = config.display || {};
    var currency = (config.business && config.business.currency) || '$';
    var lines = [];
    var qty = hasQuantity(service) ? num(sel.qty, 0) : 0;
    var base = num(service.base, 0);
    var unitPrice = num(service.unitPrice, 0);

    var subtotal = base;
    if (base) lines.push({ label: service.name + ' (base)', amount: round2(base) });
    if (hasQuantity(service) && unitPrice) {
      var unitCost = unitPrice * qty;
      subtotal += unitCost;
      lines.push({ label: qty + ' ' + (service.unitLabel || 'units') + ' x ' + currency + unitPrice, amount: round2(unitCost) });
    }

    var percent = 0;
    var detailBits = [];
    if (hasQuantity(service)) detailBits.push(qty + ' ' + (service.unitLabel || 'units'));

    (service.options || []).forEach(function (opt) {
      var choice = findById(opt.choices, sel.options[opt.id]);
      detailBits.push(opt.question + (/[?:]$/.test(opt.question) ? ' ' : ': ') + choice.label);
      var amt = num(choice.amount, 0);
      if (!amt) return;
      if (choice.type === OPTION_TYPES.percent) {
        percent += amt;
        lines.push({ label: choice.label + ' (' + (amt > 0 ? '+' : '') + amt + '%)', amount: null, percent: amt });
      } else if (choice.type === OPTION_TYPES.perunit) {
        subtotal += amt * qty;
        lines.push({ label: choice.label, amount: round2(amt * qty) });
      } else {
        subtotal += amt;
        lines.push({ label: choice.label, amount: round2(amt) });
      }
    });

    (sel.addons || []).forEach(function (addonId) {
      var addon = findById(service.addons, addonId);
      var a = num(addon.amount, 0);
      var cost = addon.type === ADDON_TYPES.perunit ? a * qty : a;
      subtotal += cost;
      detailBits.push('Extra: ' + addon.label);
      lines.push({ label: addon.label, amount: round2(cost) });
    });

    var total = subtotal;
    if (percent) {
      var adj = subtotal * (percent / 100);
      total += adj;
      // Replace the % line with its real dollar amount for clarity
      lines = lines.map(function (l) {
        if (l.percent !== undefined) return { label: l.label, amount: round2(subtotal * (l.percent / 100)) };
        return l;
      });
    }

    var freq = null;
    if (service.recurring && (config.frequencies || []).length) {
      freq = findById(config.frequencies, sel.frequencyId);
      detailBits.push('How often: ' + freq.label);
      var disc = num(freq.discount, 0);
      if (disc) {
        var saving = total * (disc / 100);
        total -= saving;
        lines.push({ label: freq.label + ' discount (' + disc + '%)', amount: round2(-saving) });
      }
    }

    var minimum = num(service.minimumCharge, 0);
    if (total < minimum) {
      lines.push({ label: 'Minimum job charge applied', amount: round2(minimum - total) });
      total = minimum;
    }
    if (total < 0) total = 0;
    total = round2(total);

    var mode = display.priceMode === 'exact' ? 'exact' : 'range';
    var r = Math.max(0, Math.min(50, num(display.rangePercent, 10))) / 100;
    var low = total, high = total;
    if (mode === 'range' && r > 0) {
      low = friendly(total * (1 - r));
      high = friendly(total * (1 + r));
      if (minimum && low < minimum) low = friendly(minimum);
      if (high < low) high = low;
    }

    var text;
    if (mode === 'exact' || low === high) text = money(total, currency);
    else text = money(low, currency, true) + ' - ' + money(high, currency, true);
    if (freq && freq.label && !/one/i.test(freq.label)) text += ' per visit';

    return {
      ok: true,
      errors: [],
      serviceName: service.name,
      frequency: freq ? freq.label : '',
      total: total,
      low: low,
      high: high,
      mode: mode,
      display: text,
      lines: lines,
      summary: detailBits.join('; ')
    };
  }

  function money(n, currency, noCents) {
    var c = currency || '$';
    var fixed = noCents || Math.round(n) === n ? Math.round(n).toString() : n.toFixed(2);
    var parts = fixed.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return c + parts.join('.');
  }

  /**
   * Turns rows from the Google Sheet tabs into the normalized config.
   * rows = { services: [[...]], options: [[...]], addons: [[...]], frequencies: [[...]] }
   * (header rows already removed). Unknown/blank rows are skipped.
   * Returns { services, frequencies, problems[] }
   */
  function fromSheetRows(rows) {
    var problems = [];
    var services = [];
    var seen = {};
    (rows.services || []).forEach(function (r, i) {
      // ID | Name | Description | Base | Measure | Price per unit | Min | Max | Step | Default | Minimum charge | Recurring | Active
      var id = slug(r[0] || r[1]);
      var name = String(r[1] || '').trim();
      if (!name) return;
      var active = String(r[12] === undefined || r[12] === '' ? 'yes' : r[12]).toLowerCase();
      if (active === 'no' || active === 'false') return;
      if (seen[id]) { problems.push('Services row ' + (i + 2) + ': the Service ID "' + id + '" is used twice.'); return; }
      seen[id] = true;
      var s = {
        id: id,
        name: name.slice(0, 80),
        description: String(r[2] || '').slice(0, 300),
        base: num(r[3], 0),
        unitLabel: String(r[4] || '').trim().slice(0, 40),
        unitPrice: num(r[5], 0),
        min: num(r[6], 0),
        max: num(r[7], 100000),
        step: num(r[8], 1) || 1,
        def: num(r[9], num(r[6], 0)),
        minimumCharge: num(r[10], 0),
        recurring: /^(y|yes|true|1)$/i.test(String(r[11] || '')),
        options: [],
        addons: []
      };
      if (s.min > s.max) problems.push('Services row ' + (i + 2) + ' (' + name + '): Min is bigger than Max.');
      if ([s.base, s.unitPrice].some(function (v) { return !isFinite(v); })) problems.push('Services row ' + (i + 2) + ': a price is not a number.');
      services.push(s);
    });

    function targets(sid) {
      var key = String(sid || '').trim().toLowerCase();
      if (!key || key === 'all') return services;
      var match = services.filter(function (s) { return s.id === slug(sid); });
      return match;
    }

    (rows.options || []).forEach(function (r, i) {
      // Service ID | Question | Answer | Price change | Type
      var q = String(r[1] || '').trim();
      var label = String(r[2] || '').trim();
      if (!q || !label) return;
      var list = targets(r[0]);
      if (!list.length) { problems.push('Options row ' + (i + 2) + ': no service has the ID "' + r[0] + '".'); return; }
      list.forEach(function (s) {
        var optId = slug(q);
        var opt = findById(s.options, optId);
        if (!opt) { opt = { id: optId, question: q.slice(0, 120), choices: [] }; s.options.push(opt); }
        var cid = slug(label);
        if (findById(opt.choices, cid)) cid = cid + '-' + (opt.choices.length + 1);
        opt.choices.push({ id: cid, label: label.slice(0, 80), amount: num(r[3], 0), type: normalizeOptionType(r[4]) });
      });
    });

    (rows.addons || []).forEach(function (r, i) {
      // Service ID | Extra | Price | Type
      var label = String(r[1] || '').trim();
      if (!label) return;
      var list = targets(r[0]);
      if (!list.length) { problems.push('Extras row ' + (i + 2) + ': no service has the ID "' + r[0] + '".'); return; }
      list.forEach(function (s) {
        var aid = slug(label);
        if (findById(s.addons, aid)) return;
        s.addons.push({ id: aid, label: label.slice(0, 80), amount: num(r[2], 0), type: normalizeAddonType(r[3]) });
      });
    });

    var frequencies = [];
    (rows.frequencies || []).forEach(function (r) {
      var label = String(r[0] || '').trim();
      if (!label) return;
      frequencies.push({ id: slug(label), label: label.slice(0, 40), discount: Math.max(0, Math.min(90, num(r[1], 0))) });
    });

    if (!services.length) problems.push('There are no active services on the Services tab.');
    return { services: services, frequencies: frequencies, problems: problems };
  }

  /* Picks black or white text for a background color (WCAG relative luminance). */
  function readableTextOn(hex) {
    var rgb = hexToRgb(hex);
    if (!rgb) return '#ffffff';
    return contrast(rgb, [255, 255, 255]) >= contrast(rgb, [17, 17, 17]) ? '#ffffff' : '#111111';
  }

  function hexToRgb(hex) {
    var m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!m) return null;
    var h = m[1].length === 3 ? m[1].replace(/(.)/g, '$1$1') : m[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  function lum(rgb) {
    var a = rgb.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  }

  function contrast(a, b) {
    var l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }

  /* Darkens a color until it reaches 4.5:1 contrast on white (for links/text). */
  function accessibleOnWhite(hex) {
    var rgb = hexToRgb(hex);
    if (!rgb) return '#1f5f8b';
    var guard = 0;
    while (contrast(rgb, [255, 255, 255]) < 4.5 && guard++ < 40) {
      rgb = rgb.map(function (v) { return Math.max(0, Math.floor(v * 0.9)); });
    }
    return '#' + rgb.map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join('');
  }

  return {
    calculate: calculate,
    validateSelection: validateSelection,
    fromSheetRows: fromSheetRows,
    money: money,
    slug: slug,
    num: num,
    hasQuantity: hasQuantity,
    readableTextOn: readableTextOn,
    accessibleOnWhite: accessibleOnWhite,
    contrast: function (h1, h2) { return contrast(hexToRgb(h1), hexToRgb(h2)); },
    isHexColor: function (h) { return !!hexToRgb(h); }
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = QRPricing;
