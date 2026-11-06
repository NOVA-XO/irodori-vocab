/* KOTO v2 — сэдэв: өнгө (data-palette) × горим (Гэрэлтэй/Бараан/Автомат).
   index.html-д ХОЁР stylesheet-ийн ДАРАА, defer-гүй ачаална: хөтөч өмнөх CSS ачаалагдтал энэ скриптийг хүлээлгэдэг
   тул cssRules бэлэн, анхны зурахаас өмнө хэрэгжинэ (ногоон гялсхийхгүй).
   Горим: styles.css/themes.css-ийн `@media (prefers-color-scheme: dark)` блокуудын нөхцөлийг БАЙРАНД нь сольдог
   (Бараан → үргэлж, Гэрэлтэй → хэзээ ч үгүй, Автомат → анхных). Дүрмийг хуулж давхардуулахгүй, дараалал хөдлөхгүй.
   `data-theme` нь зөвхөн гараар сонгосон үед — styles.css-ийн ханзны үүслийн дүрэм түүнийг ч хардаг. */
(function () {
  'use strict';
  var KEY = 'koto-theme';
  var PALETTES = ['green', 'pink', 'coffee', 'blue'];
  var MODES = ['auto', 'light', 'dark'];
  /* Хөтчийн мөрний өнгө [гэрэлтэй, бараан] — хуудасны дэвсгэр (Цэнхэр, Кофе 11-05e/g; Ягаан — Astra 11-05j), ногоон анхных шигээ лайм. */
  var BAR = { green: ['#b8ef58', '#b8ef58'], pink: ['#fbf7f9', '#21171e'], coffee: ['#f8f4e1', '#241a12'], blue: ['#f9f7f7', '#131e2a'] };
  var root = document.documentElement;
  var rules = null;
  var cur = read();

  function read() {
    var v = {};
    try { v = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { v = {}; }
    return { palette: PALETTES.indexOf(v.palette) >= 0 ? v.palette : 'green', mode: MODES.indexOf(v.mode) >= 0 ? v.mode : 'auto' };
  }

  function collect(list, out) {
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      if (r.media && /prefers-color-scheme/.test(r.media.mediaText)) out.push({ rule: r, text: r.media.mediaText });
      if (r.cssRules) collect(r.cssRules, out);
    }
  }

  function mediaRules() {
    if (rules) return rules;
    var out = [];
    for (var i = 0; i < document.styleSheets.length; i++) {
      var list = null;
      try { list = document.styleSheets[i].cssRules; } catch (e) { continue; }
      if (list) collect(list, out);
    }
    if (out.length) rules = out;
    return out;
  }

  function forced(text, dark) {
    var on = dark ? 'dark' : 'light';
    var re = /\(\s*prefers-color-scheme\s*:\s*(dark|light)\s*\)/g;
    if (/^\s*\(\s*prefers-color-scheme\s*:\s*(dark|light)\s*\)\s*$/.test(text)) return text.replace(re, function (m, v) { return v === on ? 'all' : 'not all'; });
    return text.replace(re, function (m, v) { return v === on ? '(min-width: 0px)' : '(max-width: -1px)'; });
  }

  function apply() {
    /* Солих мөчид хөдөлгөөнгүй: Үгийн сангийн 2994 карт зэрэг `transition` хийвэл дэлгэц 1.4–3.5 сек гацдаг байв (хэмжив, 11-06).
       Хэв маягийг ангитай байх үед нь бодуулж (getComputedStyle), дараагийн кадрт ангийг авна — эс бөгөөс хөдөлгөөн эхэлнэ. */
    root.classList.add('theme-switching');
    root.setAttribute('data-palette', cur.palette);
    if (cur.mode === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', cur.mode);
    var list = mediaRules();
    for (var i = 0; i < list.length; i++) {
      var t = cur.mode === 'auto' ? list[i].text : forced(list[i].text, cur.mode === 'dark');
      if (list[i].rule.media.mediaText !== t) list[i].rule.media.mediaText = t;
    }
    var metas = document.querySelectorAll('meta[name="theme-color"]'), bar = BAR[cur.palette];
    for (var j = 0; j < metas.length; j++) {
      var dark = /dark/.test(metas[j].getAttribute('media') || '');
      metas[j].setAttribute('content', cur.mode === 'auto' ? bar[dark ? 1 : 0] : bar[cur.mode === 'dark' ? 1 : 0]);
    }
    void getComputedStyle(root).color;
    requestAnimationFrame(function () { root.classList.remove('theme-switching'); });
  }

  function set(next) {
    next = next || {};
    if (PALETTES.indexOf(next.palette) >= 0) cur.palette = next.palette;
    if (MODES.indexOf(next.mode) >= 0) cur.mode = next.mode;
    try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch (e) { /* хувийн цонх — энэ удаад л хэрэгжинэ */ }
    apply();
    try { document.dispatchEvent(new CustomEvent('koto-theme', { detail: get() })); } catch (e) { /* хуучин хөтөч */ }
    return get();
  }

  function get() { return { palette: cur.palette, mode: cur.mode }; }

  // Өөр таб дээр сольвол энд ч солигдоно. `localStorage.clear()` нь key=null өгдөг (Astra-гийн хяналт).
  window.addEventListener('storage', function (e) {
    if (e.key !== KEY && e.key !== null) return;
    cur = read(); apply();
    try { document.dispatchEvent(new CustomEvent('koto-theme', { detail: get() })); } catch (err) { /* хуучин хөтөч */ }
  });

  apply();
  window.KOTO_THEME = { get: get, set: set, palettes: PALETTES.slice(), modes: MODES.slice() };
})();
