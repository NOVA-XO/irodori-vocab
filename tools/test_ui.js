/* Аппын БОДИТ ажиллагааг браузер дотор шалгана.
 *
 * Яагаад зураг биш вэ: зураг нь «харагдаж байна» гэдгийг л хэлнэ, «зөв
 * ажиллаж байна» гэдгийг хэлэхгүй. Энд DOM ба төлөвийг ШУУД уншиж
 * баталгаажуулна — 4 сан × 4 горим, Явц, Профайл, загвар солих.
 *
 * Гадаад сан ХЭРЭГГҮЙ: Node 24-д `WebSocket` дотоод байдаг тул Chrome
 * DevTools Protocol-той шууд ярина.
 *
 * Ажиллуулах:
 *     python -m http.server 8765      (өөр цонхонд, төслийн үндсэнд)
 *     node tools/test_ui.js
 *
 * exit 0 = бүх шалгуур цэвэр.
 *
 * ОРЧНЫ УРХИ (docs/STATE.md §2.8, §2.17):
 *  · `--virtual-time-budget` нь медиатай хуудсан дээр гацдаг — хэрэглэхгүй.
 *  · Chrome-ийн цонх 500px-ээс нарийн болдоггүй — өргөнөөс хамаарсан
 *    шалгуур бичихгүй.
 *  · `--blink-settings=preferredColorScheme=2` нь headless-ийг унагадаг.
 */
'use strict';

const { spawn } = require('child_process');
const http = require('http');

const URL_BASE = process.env.TEST_URL || 'http://127.0.0.1:8765/';
const PORT = 9222;
const CHROME = process.env.CHROME
  || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

let pass = 0, fail = 0;
const fails = [];

function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else {
    fail++; fails.push(name + (detail ? '  — ' + detail : ''));
    console.log('  FAIL ' + name + (detail ? '  — ' + detail : ''));
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

function getJSON(path, method) {
  return new Promise((res, rej) => {
    const req = http.request(
      { host: '127.0.0.1', port: PORT, path, method: method || 'GET' },
      r => {
        let b = '';
        r.on('data', c => (b += c));
        r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } });
      });
    req.on('error', rej);
    req.end();
  });
}

/* ── CDP-ийн хамгийн бага клиент ──────────────────────────────────── */
class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.waiting = new Map();
    this.errors = [];                       // консолын алдаа ба exception
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.id && this.waiting.has(m.id)) {
        const { res, rej } = this.waiting.get(m.id);
        this.waiting.delete(m.id);
        m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
      }
      if (m.method === 'Runtime.exceptionThrown') {
        const d = m.params.exceptionDetails;
        this.errors.push('exception: ' + (d.exception && d.exception.description
          || d.text));
      }
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
        this.errors.push('console.error: ' +
          m.params.args.map(a => a.value || a.description || '').join(' '));
      }
    };
  }
  send(method, params) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      this.waiting.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
      setTimeout(() => {
        if (this.waiting.has(id)) { this.waiting.delete(id); rej(new Error('timeout ' + method)); }
      }, 30000);
    });
  }
  /** Хуудсан дотор JS ажиллуулж утгыг нь буцаана. */
  async ev(expr) {
    const r = await this.send('Runtime.evaluate', {
      expression: '(async () => { ' + expr + ' })()',
      awaitPromise: true, returnByValue: true,
    });
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception
        ? r.exceptionDetails.exception.description : r.exceptionDetails.text);
    }
    return r.result.value;
  }
}

async function main() {
  console.log('Chrome асааж байна…');
  const chrome = spawn(CHROME, [
    '--headless=new', '--remote-debugging-port=' + PORT,
    '--no-first-run', '--no-default-browser-check',
    '--disable-gpu', '--mute-audio',
    // ШИНЭ профайл бүрд: тогтмол профайл дээр хуучин service-worker
    // кэш (ж: data/audio.json) тестийн үр дүнг гажуудуулдаг.
    '--user-data-dir=' + require('os').tmpdir() + '\\irodori-uitest-' + Date.now(),
    'about:blank',
  ], { stdio: 'ignore' });

  // Порт нээгдэхийг хүлээнэ.
  let tab = null;
  for (let i = 0; i < 60 && !tab; i++) {
    try { tab = await getJSON('/json/new?' + encodeURIComponent(URL_BASE), 'PUT'); }
    catch (e) { await sleep(250); }
  }
  if (!tab) { console.log('Chrome нээгдсэнгүй'); chrome.kill(); process.exit(2); }

  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  const c = new CDP(ws);

  await c.send('Runtime.enable');
  await c.send('Page.enable');

  try {
    await run(c);
  } catch (e) {
    fail++; fails.push('ТЕСТ УНАВ: ' + e.message);
    console.log('  FAIL ТЕСТ УНАВ: ' + e.message);
  }

  // Консолын алдаа — дуу байхгүй үед гардаг сэрэмжлүүлгийг тооцохгүй.
  const real = c.errors.filter(e => !/audio|mp3|Failed to load resource/i.test(e));
  ok('консолын алдаа гараагүй', real.length === 0, real.slice(0, 3).join(' | '));

  ws.close(); chrome.kill();

  console.log('\n' + '─'.repeat(50));
  console.log('цэвэр: ' + pass + '   унасан: ' + fail);
  if (fails.length) { console.log('\nУНАСАН:'); fails.forEach(f => console.log('  · ' + f)); }
  process.exit(fail ? 1 : 0);
}

/* ── Шалгуурууд ───────────────────────────────────────────────────── */
async function run(c) {
  // Өгөгдөл ачаалагдахыг хүлээнэ.
  for (let i = 0; i < 80; i++) {
    if (await c.ev('return typeof ALL !== "undefined" && ALL.length > 0')) break;
    await sleep(250);
  }

  console.log('\n[1] Ачаалалт');
  ok('үгийн сан ачаалагдсан', await c.ev('return ALL.length') > 1000);
  ok('нүүр дэлгэц гарсан', await c.ev('return screen === "home"'));
  ok('ханз ачаалагдсан', await c.ev('return KANJI.length') > 1000);
  ok('кана ачаалагдсан', await c.ev('return KANA.length') === 107);
  // Чимэглэлүүд 2026-09-21-нд ХАСАГДСАН. Буцаж орж ирвэл энд баригдана.
  ok('чимэглэл байхгүй (#bg · ring · seal)',
    await c.ev('return !document.getElementById("bg")'
      + ' && !document.getElementById("ring")'
      + ' && !document.querySelector(".seal,.ringslot,.flyer")'));
  ok('гарчиг «Мартчихлаа»',
    (await c.ev('return document.title')).indexOf('Мартчихлаа') >= 0,
    await c.ev('return document.title'));

  console.log('\n[2] localhost дээр ping БИЧИХГҮЙ (§2.13)');
  ok('isDevHost() = true', await c.ev('return isDevHost() === true'));

  console.log('\n[3] Дэлгэц бүр нээгдэнэ');
  // JLPT-г ТҮР унтраасан бол (app.js: `JLPT_ON`) тэр дэлгэц нээгдэхгүй байх
  // нь ЗӨВ. Тугийг буцаахад энэ тест автоматаар дахин шалгана.
  const jlptOn = await c.ev('return typeof JLPT_ON === "undefined" || JLPT_ON === true');
  const screens = ['irodori', 'kana', 'stats', 'profile', 'feedback', 'home'];
  if (jlptOn) screens.splice(1, 0, 'jlpt');
  for (const s of screens) {
    await c.ev('go("' + s + '"); return 1');
    await sleep(120);
    const vis = await c.ev('return !document.getElementById("' + s + '").hidden');
    ok('дэлгэц ' + s, vis);
  }
  if (!jlptOn) {
    ok('JLPT унтраалттай — go("jlpt") нүүр рүү буцаана',
      await c.ev('go("jlpt"); await new Promise(r=>setTimeout(r,120)); return screen === "home"'));
    ok('JLPT унтраалттай — оролтууд нуугдсан',
      await c.ev('return [...document.querySelectorAll(\'[data-go="jlpt"]\')].every(e=>e.hidden)'));
  }

  console.log('\n[4] Цайвар / бараан — СИСТЕМЭЭ дагана');
  // Сэдэв сонгогч байхгүй. Хөтчийн `prefers-color-scheme`-ийг дуурайж
  // токен ҮНЭХЭЭР солигдож байгааг шалгана — CSS бичигдсэн эсэхийг биш.
  const tok = () => c.ev(
    'const cs = getComputedStyle(document.documentElement);'
    + 'return { bg: cs.getPropertyValue("--bg").trim(),'
    + '         ink: cs.getPropertyValue("--ink").trim() };');

  await c.send('Emulation.setEmulatedMedia',
    { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  await sleep(150);
  const lt = await tok();
  ok('цайвар: --bg нь #a9d0fb', lt.bg === '#a9d0fb', JSON.stringify(lt));
  ok('цайвар: бичиг бараан',   lt.ink === '#0b1540', JSON.stringify(lt));

  await c.send('Emulation.setEmulatedMedia',
    { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  await sleep(150);
  const dk = await tok();
  ok('бараан: --bg нь #0f172a', dk.bg === '#0b1540', JSON.stringify(dk));
  ok('бараан: бичиг цайвар',    dk.ink === '#e9f0ff', JSON.stringify(dk));
  ok('хоёр горим ҮНЭХЭЭР ялгаатай', lt.bg !== dk.bg, lt.bg + ' / ' + dk.bg);

  // Хаягийн мөрний өнгө хоёулаа бичигдсэн эсэх (JS-ээр солихоо больсон).
  const tcs = await c.ev(
    'return [...document.querySelectorAll("meta[name=theme-color]")]'
    + '.map(m => m.media + " " + m.content);');
  ok('theme-color хоёр мөртэй', Array.isArray(tcs) && tcs.length === 2,
    JSON.stringify(tcs));

  await c.send('Emulation.setEmulatedMedia', { features: [] });
  await sleep(150);

  /* Гараар дарах — ГУРВАН төлөв: систем → цайвар → бараан → систем.
     Системийг БАРААН болгож эмуляцлаад «цайвар» сонгоход үнэхээр
     цайвар болох ёстой: тэр нь `:root:not([data-theme="light"])`
     сонгогч ажиллаж байгаагийн шууд нотолгоо. */
  await c.send('Emulation.setEmulatedMedia',
    { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  await sleep(120);

  const cyc = await c.ev(`
    const out = [];
    const bg = () => getComputedStyle(document.documentElement)
                       .getPropertyValue('--bg').trim();
    applyScheme('');                       // систем (бараан)
    out.push({ v: curScheme(), bg: bg(), attr: document.documentElement.dataset.theme || null });
    document.getElementById('btn-scheme').click();
    out.push({ v: curScheme(), bg: bg(), attr: document.documentElement.dataset.theme || null });
    document.getElementById('btn-scheme').click();
    out.push({ v: curScheme(), bg: bg(), attr: document.documentElement.dataset.theme || null });
    document.getElementById('btn-scheme').click();
    out.push({ v: curScheme(), bg: bg(), attr: document.documentElement.dataset.theme || null });
    return out;
  `);
  ok('систем горим: бараан дагав',
    cyc && cyc[0].v === '' && cyc[0].bg === '#0b1540' && cyc[0].attr === null,
    JSON.stringify(cyc));
  ok('дарвал ЦАЙВАР — систем бараан байсан ч',
    cyc && cyc[1].v === 'light' && cyc[1].bg === '#a9d0fb' && cyc[1].attr === 'light',
    JSON.stringify(cyc));
  ok('дахин дарвал БАРААН',
    cyc && cyc[2].v === 'dark' && cyc[2].bg === '#0b1540' && cyc[2].attr === 'dark',
    JSON.stringify(cyc));
  ok('гурав дахь даралт СИСТЕМ рүү эргэнэ',
    cyc && cyc[3].v === '' && cyc[3].attr === null, JSON.stringify(cyc));

  // Сонголт хадгалагдах ёстой — эс тэгвэл дахин нээхэд алдагдана.
  const kept = await c.ev(`
    applyScheme('dark');
    const raw = localStorage.getItem('irodori.scheme.v1');
    const icon = document.getElementById('btn-scheme').innerHTML.length;
    const t = document.getElementById('btn-scheme').title;
    applyScheme('');
    return { raw: raw, icon: icon, title: t };
  `);
  ok('сонголт localStorage-д хадгалагдана',
    kept && kept.raw === '"dark"', JSON.stringify(kept));
  ok('товчны дүрс ба тайлбар шинэчлэгдэнэ',
    kept && kept.icon > 50 && /бараан/.test(kept.title), JSON.stringify(kept));

  await c.send('Emulation.setEmulatedMedia', { features: [] });
  await sleep(120);

  // Гарчиг дархад нүүр рүү — толгойн мөр бүх дэлгэц дээр байдаг.
  const backHome = await c.ev(`
    go('stats'); await new Promise(r => setTimeout(r, 150));
    const was = screen;
    document.getElementById('btn-home').click();
    await new Promise(r => setTimeout(r, 200));
    return { was: was, now: screen };
  `);
  ok('гарчиг дархад нүүр рүү',
    backHome && backHome.was === 'stats' && backHome.now === 'home',
    JSON.stringify(backHome));


  console.log('\n[5] Бүх сан × бүх горим — БОДИТ эхлэх замаар');
  // Төлөвийг гараар тавьж БОЛОХГҮЙ: `deck` ба `pool` хоёр зэрэг
  // солигдох ёстой. Гараар тавибал `simKey()` нь өмнөх сангийн
  // бичлэг дээр унана — бодит алдаа биш, тестийн алдаа болно.
  const SESSIONS = [
    ['irodori', 'startSession(M, false, "book")', ['flash', 'choice', 'type', 'listen']],
    ['n5', 'startSession(M, false, "n5")', ['flash', 'choice', 'type', 'listen']],
    ['kanji-les', 'startKanji(M, "les")', ['flash', 'k2m', 'm2k', 'read']],
    ['kanji-jlpt', 'startKanji(M, "jlpt")', ['flash', 'k2m', 'm2k', 'read']],
    ['kana', 'startKana(M)', ['h2k', 'k2h', 'sound', 'klisten']],
  ];
  for (const [name, call, modes] of SESSIONS) {
    for (const md of modes) {
      const r = await c.ev(`
        localStorage.removeItem('irodori.progress.v1');
        progress = {};
        window.__alert = null;
        const _a = window.alert; window.alert = m => { window.__alert = m; };
        const M = ${JSON.stringify(md)};
        try { ${call}; } finally { window.alert = _a; }
        await new Promise(r=>setTimeout(r,150));
        if (window.__alert) return {alerted: window.__alert};
        const before = Object.keys(progress).length;
        if (!cur) return {err:'cur хоосон', screen};
        grade(cur.id, true);
        const box = progress[cur.id] ? progress[cur.id].b : -1;
        const r2 = {screen, qlen: queue.length, poolLen: pool.length,
                    before, after: Object.keys(progress).length, box,
                    deck, mode, kmode};
        show('home');
        return r2;
      `);
      const tag = name + '/' + md;
      ok('дасгал ' + tag + ' — эхэлсэн',
        r && r.screen === 'study', JSON.stringify(r));
      ok('дасгал ' + tag + ' — явц бичигдсэн',
        r && r.after === r.before + 1 && r.box === 1, JSON.stringify(r));
    }
  }

  console.log('\n[6] Явц дэлгэц — 6 таб бүр зурагдана');
  await c.ev('go("stats"); return 1');
  await sleep(400);
  await c.ev('return loadAllBooks().then(()=>refreshStats())');
  await sleep(300);
  for (const t of ['starter', 'el1', 'el2', 'n5', 'kanji', 'kana']) {
    const n = await c.ev(
      'statTab=' + JSON.stringify(t) + '; refreshStats();' +
      'return document.getElementById("stat-lessons").children.length');
    ok('Явц таб ' + t + ' — мөр зурагдсан', n > 0, 'мөр: ' + n);
  }
  const sum = await c.ev('return document.getElementById("stat-sum").textContent');
  ok('Явцын дүн хоосон биш', sum && sum.length > 5, sum);

  console.log('\n[7] Загварын систем УСТСАН');
  const gone = await c.ev(
    'return { themes: typeof THEMES,'
    + '        applyTheme: typeof applyTheme,'
    + '        buildRing: typeof buildRing,'
    + '        applyFx: typeof applyFx,'
    + '        list: !!document.getElementById("theme-list"),'
    + '        fxBtn: !!document.getElementById("btn-fx"),'
    + '        attr: document.documentElement.getAttribute("data-theme") };');
  ok('THEMES · applyTheme устсан',
    gone && gone.themes === 'undefined' && gone.applyTheme === 'undefined',
    JSON.stringify(gone));
  ok('buildRing · applyFx устсан',
    gone && gone.buildRing === 'undefined' && gone.applyFx === 'undefined',
    JSON.stringify(gone));
  ok('сонгогч ба хөдөлгөөний товч устсан',
    gone && gone.list === false && gone.fxBtn === false, JSON.stringify(gone));
  ok('data-theme огт тавигдахгүй', gone && gone.attr === null, JSON.stringify(gone));

  console.log('\n[8] JS-ээс дуудагддаг DOM id бүр index.html-д байгаа эсэх');
  const missing = await c.ev(`
    const src = await (await fetch('app.js')).text();
    const ids = new Set();
    const re = /\\$\\((['"])([A-Za-z0-9_-]+)\\1\\)/g;
    let m; while ((m = re.exec(src))) ids.add(m[2]);
    const miss = [...ids].filter(i => !document.getElementById(i));
    return miss;
  `);
  ok('дутуу DOM id алга', missing.length === 0, missing.join(', '));

  console.log('\n[9] 2026-09-11-ний аудитын регресс');
  // Эдгээр нь БОДИТООР гарсан алдаанууд. Тест нь тэднийг буцаж
  // ирэхээс хамгаална — тайлбар нь docs/STATE.md §2.27 ба CHANGELOG.

  // №4 — ханзны дасгал дуусаад «Алдаагаа давтах» дарахад унадаг байв.
  {
    const r = await c.ev(`
      progress = {}; const _a = window.alert; window.alert = () => {};
      startKanji('k2m', 'jlpt');
      await new Promise(r=>setTimeout(r,120));
      missed = queue.slice(0, 3); queue = [];
      finish();                       // → refreshHome() → урьд нь pool-ыг эвдэнэ
      let crashed = null;
      try { document.getElementById('fin-retry').onclick(); }
      catch (e) { crashed = String(e && e.message); }
      const poolIsKanji = !!(pool[0] && ('on' in pool[0]));
      window.alert = _a; show('home');
      return { crashed, deck, poolIsKanji, screen };
    `);
    ok('№4 ханз→давтах унахгүй', r.crashed === null, r.crashed || '');
    ok('№4 давтахад pool нь ХАНЗ хэвээр', r.poolIsKanji, JSON.stringify(r));
  }

  // №17 — N5 ороод гарвал Irodori 0 үг харуулдаг байв.
  {
    const r = await c.ev(`
      const _a = window.alert; window.alert = () => {};
      go('irodori'); await new Promise(r=>setTimeout(r,150));
      const before = document.getElementById('vocab-hint').textContent;
      await loadN5();
      startSession('flash', false, 'n5');
      await new Promise(r=>setTimeout(r,120));
      show('home');
      go('irodori'); await new Promise(r=>setTimeout(r,200));
      const after = document.getElementById('vocab-hint').textContent;
      window.alert = _a;
      return { before, after, same: before === after };
    `);
    ok('№17 N5-ийн дараа Irodori-гийн тоо хэвээр', r.same,
      JSON.stringify(r));
  }

  // №19 — бүгдийг зөв хариулахад 20/21 (95.2%) гардаг байв.
  {
    const r = await c.ev(`
      done = 7; queue = []; answered = true; updateBar();
      const full = document.getElementById('pring').style.strokeDashoffset;
      done = 7; queue = []; answered = false; updateBar();
      const notYet = document.getElementById('pring').style.strokeDashoffset;
      return { full: parseFloat(full), notYet: parseFloat(notYet) };
    `);
    ok('№19 сүүлийн картыг давхар тоолохгүй', Math.abs(r.full) < 0.001,
      JSON.stringify(r));
    ok('№19 хариулаагүй байхад дүүрэхгүй', r.notYet > 0.5, JSON.stringify(r));
  }

  // №16 — хоолой хожуу ирэхэд «бичих» горимд хариулт задардаг байв.
  {
    const r = await c.ev(`
      const _a = window.alert; window.alert = () => {};
      startSession('type', false, 'book');
      await new Promise(r=>setTimeout(r,120));
      const hiddenAtStart = document.getElementById('btn-speak').hidden;
      pickVoice();                    // хоолой хожуу ирэв
      const hiddenAfterVoices = document.getElementById('btn-speak').hidden;
      reveal();
      const hiddenAfterReveal = document.getElementById('btn-speak').hidden;
      window.alert = _a; show('home');
      return { hiddenAtStart, hiddenAfterVoices, hiddenAfterReveal };
    `);
    ok('№16 «бичих»-д дуу товч эхэндээ нуугдсан', r.hiddenAtStart === true,
      JSON.stringify(r));
    ok('№16 хоолой ирсэн ч нуугдсан хэвээр', r.hiddenAfterVoices === true,
      JSON.stringify(r));
  }

  // №1 — өөр таб бичсэнийг уусгана, дарж бичихгүй.
  {
    const r = await c.ev(`
      // Өмнөх хэсгүүдийн үлдэгдлийг цэвэрлэнэ — эс тэгвэл түлхүүрийн
      // тоо таарахгүй: saveProgress нь дискэн дээрхтэй уусгадаг.
      localStorage.removeItem('irodori.progress.v1');
      progress = { A: { n: 5, b: 2, d: 0, c: 5, w: 0 } };
      saveProgress();
      // өөр таб B-г нэмэв
      const disk = JSON.parse(localStorage.getItem('irodori.progress.v1'));
      disk.B = { n: 3, b: 1, d: 0, c: 3, w: 0 };
      localStorage.setItem('irodori.progress.v1', JSON.stringify(disk));
      // энэ таб нь B-г мэдэхгүй байж дахин бичнэ
      progress.A.n = 6;
      saveProgress();
      const out = JSON.parse(localStorage.getItem('irodori.progress.v1'));
      progress = {};
      return { keys: Object.keys(out).sort(), aN: out.A && out.A.n };
    `);
    ok('№1 өөр табын явц устахгүй',
      r.keys.length === 2 && r.keys[0] === 'A' && r.keys[1] === 'B',
      JSON.stringify(r));
    ok('№1 өөрийн шинэ утга үлдэнэ', r.aN === 6, JSON.stringify(r));
  }

  // №9 — амжилтгүй татал кэшийг хордуулдаг байв.
  {
    const r = await c.ev(`
      const js = await (await fetch('app.js')).text();
      return { poisons: /bookCache\\[b\\] *= *\\[\\]/.test(js),
               cachesOnlyOnSuccess: js.indexOf('бүтэлгүйтлийг КЭШЛЭХГҮЙ') > 0 };
    `);
    ok('№9 амжилтгүй таталыг кэшлэхгүй', !r.poisons, JSON.stringify(r));
  }

  // №5 / №10 / №12 — service worker
  {
    const r = await c.ev(`
      const t = await (await fetch('sw.js')).text();
      return {
        addAll: /c\\.addAll\\(CORE\\)/.test(t),
        audioJson: t.indexOf("'./data/audio.json'") > 0,
        ownCachesOnly: /k\\.indexOf\\('shell-'\\) *=== *0/.test(t),
        exactFirst: /caches\\.match\\(req\\)\\s*\\n?\\s*\\.then/.test(t),
      };
    `);
    ok('№5 sw: CORE-ыг addAll (алдаа залгихгүй)', r.addAll, JSON.stringify(r));
    ok('№10 sw: audio.json урьдчилан кэшлэнэ', r.audioJson, JSON.stringify(r));
    ok('№12 sw: зөвхөн ӨӨРИЙН кэшийг устгана', r.ownCachesOnly, JSON.stringify(r));
  }

  // №20 / №21 — үхсэн код
  {
    const r = await c.ev(`
      const js = await (await fetch('app.js')).text();
      const html = await (await fetch('index.html')).text();
      return { bookName: js.indexOf('BOOK_NAME') >= 0,
               lastSpeechError: js.indexOf('lastSpeechError') >= 0,
               nVocab: js.indexOf('n-vocab') >= 0,
               dueCard: html.indexOf('id="due-card"') >= 0 };
    `);
    ok('№20 BOOK_NAME хасагдсан', !r.bookName);
    ok('№20 lastSpeechError хасагдсан', !r.lastSpeechError);
    ok('№21 n-vocab хасагдсан', !r.nVocab);
    ok('№21 due-card id хасагдсан', !r.dueCard);
  }

  console.log('\n[9b] Шалгалт — харилцааны, өөрөө үнэлэх');
  {
    // Шалгалтын ӨМНӨХ явцыг тэмдэглэнэ — шалгалт үүнийг хөдөлгөх ЁСГҮЙ.
    await c.ev('window.__pBefore = JSON.stringify(progress); return 1;');
    ok('нүүрэнд шалгалтын оролт бий',
      await c.ev('return !!document.querySelector(\'[data-go="exam"]\')'));
    await c.ev('go("exam"); await new Promise(r=>setTimeout(r,200)); return 1;');
    ok('орвол эхлээд ТОХИРГОО гарна',
      await c.ev('return screen === "exam" && !document.getElementById("ex-setup").hidden'
        + ' && document.getElementById("ex-run").hidden'));
    ok('хариулах 2 төрөл байна',
      Number(await c.ev('return document.querySelectorAll("#seg-exam-mode button").length')) === 2);

    await c.ev('const m=document.querySelector(\'#seg-exam-mode button[data-m="think"]\'); if(m) m.click();'
      + 'const b=[...document.querySelectorAll("#seg-exam-n button")].find(x=>x.dataset.n==="10");'
      + 'if(b) b.click(); document.getElementById("btn-exam").click();'
      + 'await new Promise(r=>setTimeout(r,900)); return 1;');
    ok('шалгалт эхлэв', await c.ev('return screen === "exam" && exQs.length === 10'));
    ok('тохиргоо нуугдав', await c.ev('return document.getElementById("ex-setup").hidden === true'));
    ok('япон асуулт гарна',
      String(await c.ev('return document.getElementById("ex-q").textContent')).length > 3);
    ok('монгол орчуулга гарна',
      String(await c.ev('return document.getElementById("ex-qmn").textContent')).length > 3);
    ok('эхэндээ загвар хариулт НУУГДСАН',
      await c.ev('return document.getElementById("ex-model").hidden === true'));
    ok('«бодож» төрөлд микрофон гарахгүй',
      await c.ev('return document.getElementById("ex-speak").hidden === true'));

    /* Бичгийн хэлбэр — апп даяарх НЭГ тохиргоо (`settings.script`).
       Асуулт нь САНАМСАРГҮЙ сонгогддог тул ханзтайг нь ТУЛГАЖ өгнө:
       `ATMはどこですか。` гэх мэт ханзгүй асуулт таарвал «漢字 горимд
       ханз гарна» гэсэн шалгуур зүй ёсоор унадаг байв. */
    await c.ev('exQs[exIdx] = EXAM.items.find(x => x.id === "S01-01");'
      + 'renderExam(); return 1;');
    const kanaOn = await c.ev('settings.script = "kana"; renderExam();'
      + 'await new Promise(r=>setTimeout(r,150));'
      + 'const t = document.getElementById("ex-q").textContent;'
      + 'return { t: t, k: /[\u3400-\u9fff]/.test(t) };');
    ok('かな горимд ХАНЗ гарахгүй', kanaOn && kanaOn.k === false, JSON.stringify(kanaOn));
    const kanjiOn = await c.ev('settings.script = "kanji"; renderExam();'
      + 'await new Promise(r=>setTimeout(r,150));'
      + 'const t = document.getElementById("ex-q").textContent;'
      + 'return { t: t, k: /[\u3400-\u9fff]/.test(t) };');
    ok('漢字 горимд ханз гарна', kanjiOn && kanjiOn.k === true, JSON.stringify(kanjiOn));
    // Асуултыг дуугаар уншуулах товч (TTS).
    ok('асуултын дуу товч байна',
      await c.ev('return !!document.getElementById("ex-say-q")'));
    // Шалгалтын дуу нь VOICEVOX-ийн бэлэн бичлэгээс гарах ёстой (TTS биш):
    // бичлэг нь төхөөрөмж бүрд ИЖИЛ, өргөлт нь зөв.
    ok('асуулт бүрд VOICEVOX бичлэг бий',
      await c.ev('return exQs.every(q => hasAudio("EXQ-" + q.id))'));
    ok('загвар хариулт бүрд бичлэг бий',
      await c.ev('return exQs.every(q => hasAudio("EXA-" + q.id))'));
    ok('дуу товч бичлэг тоглуулна (TTS биш)',
      await c.ev('let used=""; const op=playFile;'
        + 'window.playFile=(id,f)=>{used=id; return true;};'
        + 'examSay(exQs[exIdx], "q"); window.playFile=op;'
        + 'return used.indexOf("EXQ-")===0;'));
    ok('дуу товч дарахад алдаа гарахгүй',
      await c.ev('try { document.getElementById("ex-say-q").click();'
        + 'await new Promise(r=>setTimeout(r,120)); return true; } catch(e) { return String(e.message); }') === true);

    ok('шалгалт Noto Sans JP фонт ашиглана',
      String(await c.ev('return getComputedStyle(document.getElementById("ex-q")).fontFamily'))
        .indexOf('Noto Sans JP') >= 0);

    await c.ev('document.getElementById("ex-reveal").click(); await new Promise(r=>setTimeout(r,120)); return 1;');
    ok('загвар хариулт нээгдэв',
      await c.ev('return document.getElementById("ex-model").hidden === false'
        + ' && document.getElementById("ex-model-jp").textContent.length > 2'));

    const r = await c.ev(`
      for (let i = 0; i < 40 && document.getElementById("ex-done").hidden; i++) {
        if (document.getElementById("ex-model").hidden) document.getElementById("ex-reveal").click();
        await new Promise(r => setTimeout(r, 90));
        document.getElementById("ex-yes").click();
        await new Promise(r => setTimeout(r, 220));
      }
      return { pct: document.getElementById("ex-pct").textContent,
               wrongN: document.getElementById("ex-wrong").children.length };
    `);
    ok('бүгд чадсан -> 100%', r && r.pct === '100%', JSON.stringify(r));
    ok('чадаагүй жагсаалт хоосон', r && r.wrongN === 0, JSON.stringify(r));

    await c.ev('document.getElementById("ex-again").click(); await new Promise(r=>setTimeout(r,200));'
      + 'document.getElementById("btn-exam").click(); await new Promise(r=>setTimeout(r,800)); return 1;');
    const r2 = await c.ev(`
      for (let i = 0; i < 40 && document.getElementById("ex-done").hidden; i++) {
        if (document.getElementById("ex-model").hidden) document.getElementById("ex-reveal").click();
        await new Promise(r => setTimeout(r, 90));
        document.getElementById("ex-no").click();
        await new Promise(r => setTimeout(r, 220));
      }
      return { pct: document.getElementById("ex-pct").textContent,
               wrongN: document.getElementById("ex-wrong").children.length };
    `);
    ok('бүгд чадаагүй -> 0%', r2 && r2.pct === '0%', JSON.stringify(r2));
    ok('чадаагүй 10 асуулт жагсаав', r2 && r2.wrongN === 10, JSON.stringify(r2));

    ok('шалгалт SRS явцыг ХӨДӨЛГӨӨГҮЙ',
      await c.ev('return JSON.stringify(progress) === window.__pBefore;'));

    // ── Уралдааны регресс (docs/STATE.md §2.36) ──
    const race1 = await c.ev(`
      exN = 10; await loadExam(); startExam();
      await new Promise(r => setTimeout(r, 450));
      document.getElementById("ex-reveal").click();
      await new Promise(r => setTimeout(r, 80));
      document.getElementById("ex-yes").click();
      await new Promise(r => setTimeout(r, 40));
      startExam();
      await new Promise(r => setTimeout(r, 500));
      return { exIdx: exIdx, pos: document.getElementById("ex-pos").textContent };
    `);
    ok('№6 хуучин таймер шинэ шалгалтыг алгасахгүй',
      race1 && race1.exIdx === 0 && race1.pos.indexOf('1 /') === 0, JSON.stringify(race1));

    const race2 = await c.ev(`
      EXAM = null; startExam(); go("home");
      await new Promise(r => setTimeout(r, 900));
      return screen;
    `);
    ok('№5 fetch дунд гарахад эргүүлж татахгүй', race2 === 'home', String(race2));

    await c.ev('go("home"); return 1;');
  }

  /* НЭГ ФОНТ (2026-09-21l). Noto Sans JP нь япон, латин, кирилл
     гурвууланг нь өөрөө үүрнэ. Энд шалгах гол зүйл нь «токен зөв
     бичигдсэн үү» БИШ — «браузер үнэхээр ТҮҮГЭЭР зурж байна уу». */
  console.log('\n[11] Фонт — бүх дэлгэц Noto Sans JP');
  const f = await c.ev(`
    await document.fonts.ready;
    const fams = [...document.fonts].map(x => x.family);
    const used = id => {
      const el = document.getElementById(id);
      return el ? getComputedStyle(el).fontFamily : null;
    };
    return {
      faces:  fams.filter(x => x.indexOf('Noto Sans JP') >= 0).length,
      serif:  fams.filter(x => x.indexOf('Noto Serif JP') >= 0).length,
      body:   getComputedStyle(document.body).fontFamily,
      // Кирилл нь Noto Sans JP-д БИЙ эсэх — үнэхээр ачаалагдсан фонтоор
      cyr:    document.fonts.check('16px "Noto Sans JP"', 'Үгийн сан Ө'),
      jp:     document.fonts.check('16px "Noto Sans JP"', '漢字ひらがな'),
      tokens: ['--jp','--jpd','--jps','--ui','--disp'].map(t =>
                getComputedStyle(document.documentElement).getPropertyValue(t).trim())
    };
  `);
  ok('Noto Sans JP бүртгэгдсэн', Number(f.faces) > 0, JSON.stringify(f.faces));
  ok('Noto Serif JP ХАСАГДСАН', Number(f.serif) === 0, JSON.stringify(f.serif));
  // getComputedStyle нь нэрийг ХАШИЛТТАЙ буцаана: `"Noto Sans JP", ...`
  ok('body нь Noto Sans JP', String(f.body).indexOf('"Noto Sans JP"') === 0, String(f.body));
  ok('кирилл (Ү/Ө) Noto Sans JP-д бий', f.cyr === true, JSON.stringify(f.cyr));
  ok('япон бичиг Noto Sans JP-д бий', f.jp === true, JSON.stringify(f.jp));
  ok('таван токен БҮГД Noto Sans JP-ээр эхэлнэ',
    Array.isArray(f.tokens) && f.tokens.length === 5
      && f.tokens.every(t => t.indexOf('"Noto Sans JP"') === 0),
    JSON.stringify(f.tokens));

  // Устгасан сериф файлууд precache-д үлдвэл SW суулт БҮТЭЛГҮЙТНЭ.
  const sw = await c.ev(`
    const t = await (await fetch('sw.js', {cache:'no-store'})).text();
    return { serif: (t.match(/nsjp-\\d/g) || []).length,
             sans:  (t.match(/nsjps-\\d/g) || []).length };
  `);
  ok('sw.js-д сериф файл үлдээгүй', sw && sw.serif === 0, JSON.stringify(sw));
  ok('sw.js-д sans 6 хэсэг байна', sw && sw.sans === 6, JSON.stringify(sw));

  /* ふりがな — ханзан дээрх жижиг кана. Уншлагын хосыг `build_exam.py`
     үүсгэж шалгасан; энд шалгах нь ХӨТӨЧ дээрх үр дүн. */
  console.log('\n[20] Нүүр цэвэр, кредит алдаагүй');
  const cr = await c.ev(`
    go('home'); await new Promise(r => setTimeout(r, 250));
    const home = document.getElementById('home').textContent;
    const prof = document.getElementById('profile').textContent;
    return {
      homeFeedback: !!document.querySelector('#home [data-go=\"feedback\"]'),
      homeSrc: !!document.querySelector('#home .src'),
      homeBy: /novueira/.test(home),
      homeGit: !!document.querySelector('#home .follow'),
      profVoicevox: /VOICEVOX/.test(prof),
      profFoundation: /Japan/.test(prof)
    };
  `);
  ok('нүүрнээс санал хүсэлт хасагдсан',
    cr && cr.homeFeedback === false, JSON.stringify(cr));
  ok('нүүрнээс тайлбарын блок хасагдсан',
    cr && cr.homeSrc === false, JSON.stringify(cr));
  ok('«Developed by novueira» хэвээр',
    cr && cr.homeBy === true, JSON.stringify(cr));
  ok('GitHub-ийн холбоос хэвээр',
    cr && cr.homeGit === true, JSON.stringify(cr));
  /* ЛИЦЕНЗ шаардана: VOICEVOX-ийн кредит аппад БАЙХ ёстой.
     Нүүрнээс зөөсөн боловч УСТГАЖ БОЛОХГҮЙ. */
  ok('VOICEVOX кредит Тохиргоод БИЙ (лиценз)',
    cr && cr.profVoicevox === true, JSON.stringify(cr));
  ok('Japan Foundation кредит Тохиргоод бий',
    cr && cr.profFoundation === true, JSON.stringify(cr));

  console.log('\n[23] Дасгалын тоолуур — алдсан карт тоог хэтрүүлэхгүй');
  /* `done` нь ХАРИУЛТ тоолдог байсан. Алдсан карт мөчлөгийн төгсгөлд
     эргэж ирдэг тул хариултын тоо картын тооноос давж, толгойд
     «21/20» гэж гардаг байв (браузерт давтав: 5 картад 6/5).
     Одоо `done` нь ДУУССАН КАРТЫГ тоолно. */
  const cn = await c.ev(`
    const keep = settings.sfx;
    settings.sfx = 0;
    queue = ALL.slice(0, 5); deck = 'vocab'; mode = 'flash'; enterStudy();
    await new Promise(r => setTimeout(r, 300));
    const seq = [];
    const peek = () => seq.push(
      document.getElementById('c-done').textContent + '/' +
      document.getElementById('c-total').textContent);
    peek();
    for (let i = 0; i < 5; i++) {
      answered = false;
      resolve(i === 1);            // ЗӨВХӨН 2 дахь нь зөв, бусад буруу
      peek(); nextCard();
      await new Promise(r => setTimeout(r, 40));
    }
    // Алдсан 4 картыг эргүүлж зөв хариулна
    for (let i = 0; i < 4; i++) {
      answered = false; resolve(true); peek(); nextCard();
      await new Promise(r => setTimeout(r, 40));
    }
    const last = seq[seq.length - 1];
    const over = seq.filter(x => {
      const p = x.split('/'); return +p[0] > +p[1];
    });
    settings.sfx = keep;
    show('home'); go('home');
    return { seq: seq, last: last, over: over, okN: okN, ngN: ngN };
  `);
  ok('тоолуур ХЭЗЭЭ Ч нийт тооноос хэтрэхгүй',
    cn && cn.over.length === 0, JSON.stringify(cn));
  ok('бүгдийг дуусгахад ЯГ 5/5',
    cn && cn.last === '5/5', JSON.stringify(cn));
  ok('алдаа гаргасан ч зөв/буруу тоо хэвээр бүртгэгдэнэ',
    cn && cn.okN === 5 && cn.ngN === 4, JSON.stringify(cn));

  if (jlptOn) {
    console.log('\n[24] JLPT — N5…N2 ажиллана');
    const jl = await c.ev(`
      const keep = settings.kjn;
      const lv = {};
      for (const n of [5, 4, 3, 2]) {
        settings.kjn = [n]; refreshHome();
        await new Promise(r => setTimeout(r, 120));
        lv['N' + n] = kanjiPool('jlpt').length;
      }
      settings.kjn = [5, 4, 3, 2]; refreshHome();
      await new Promise(r => setTimeout(r, 120));
      const all = kanjiPool('jlpt').length;
      await loadN5();
      settings.kjn = keep; refreshHome();
      return { lv: lv, all: all, n5words: N5.length };
    `);
    ok('N5…N2 ханзны сан бүгд хоосон биш',
      jl && [5, 4, 3, 2].every(n => jl.lv['N' + n] > 0), JSON.stringify(jl));
    ok('дөрвөн түвшний нийлбэр нь нийттэй тэнцэнэ',
      jl && jl.all === [5, 4, 3, 2].reduce((a, n) => a + jl.lv['N' + n], 0),
      JSON.stringify(jl));
    ok('N5-ийн үгийн сан ачаалагдана',
      jl && jl.n5words > 2000, JSON.stringify(jl));
  }

  console.log('\n[22] Engine — аудитаас гарсан засварууд');

  /* ЯПОН гараар зөв бичсэн хариултыг ТАТГАЛЗАЖ байв. `toKana()` нь
     латинд зориулагдсан ([^a-z\\-'] бүхнийг хаядаг) тул `ねこ` → ''
     болж, ЗӨВ хариулт «буруу» болдог байсан. */
  const ct = await c.ev(`
    const mk = k => ({ kana: k, jp: k, mn: 'x', id: 'T', romaji: '' });
    const pairs = [
      ['ねこ', 'ねこ'], ['ねこ', 'ネコ'],
      ['おちゃ', 'おちゃ'], ['せんせい', 'せんせい'],
      ['にほん', 'にほん']
    ];
    const bad = pairs.filter(([k, t]) => !checkTyped(t, mk(k)));
    /* Латин зам ХЭВЭЭР ажиллах ёстой. */
    const latin = checkTyped('neko', { kana: 'ねこ', jp: '猫', mn: 'x', romaji: 'neko' });
    /* БУРУУ хариулт хэвээр буруу байх ёстой (хэт өгөөмөр болоогүй). */
    const wrong = checkTyped('いぬ', mk('ねこ'));
    return { nbad: bad.length, bad: bad, latin: latin, wrong: wrong };
  `);
  ok('ЯПОН гараар бичсэн зөв хариултыг хүлээж авна',
    ct && ct.nbad === 0, JSON.stringify(ct));
  ok('латин зам хэвээр ажиллана', ct && ct.latin === true, JSON.stringify(ct));
  ok('буруу хариулт ХЭВЭЭР буруу', ct && ct.wrong === false, JSON.stringify(ct));

  /* Шалгалтад 160мс дотор хоёр удаа дарвал нэг асуулт хоёр удаа
     бүртгэгдэж, ДАРААГИЙН асуулт хариулагдалгүй алгасагддаг байв. */
  const dbl = await c.ev(`
    await loadExam();
    exN = 10; exMode = 'think'; startExam();
    await new Promise(r => setTimeout(r, 700));
    const i0 = exIdx, n0 = exLog.length;
    examMark(true); examMark(true); examMark(false);
    await new Promise(r => setTimeout(r, 500));
    const out = { di: exIdx - i0, dn: exLog.length - n0 };
    exAbort(); go('home');
    return out;
  `);
  ok('шалгалтад хурдан хэд дарсан ч НЭГ л бүртгэгдэнэ',
    dbl && dbl.dn === 1 && dbl.di === 1, JSON.stringify(dbl));

  /* Синк нислэгт байхад явцаа устгавал, буцаж ирсэн үүлний өгөгдөл
     устгасныг ЭРГҮҮЛЖ тавьдаг байв (`syncCode` өөрчлөгддөггүй тул
     одоо байсан хамгаалалт үүнийг барихгүй). */
  const fl = await c.ev(`
    const realRpc = window.rpc;
    const keep = { p: progress, c: syncCode };
    const calls = [];
    window.rpc = (fn, args) => {
      calls.push(fn);
      if (fn === 'get_progress')
        return new Promise(r => setTimeout(() =>
          r({ 'L01-001': { n: 5, c: 5, b: 3, d: 1 } }), 400));
      if (fn === 'put_progress') return Promise.resolve(args.p_data);
      return Promise.resolve(null);
    };
    syncCode = 'abcd1234efgh';
    progress = { 'L01-001': { n: 5, c: 5, b: 3, d: 1 } }; save(KEY_P, progress);
    const flight = syncNow(true);
    await new Promise(r => setTimeout(r, 120));
    progress = {}; progGen++; save(KEY_P, progress);
    await flight;
    await new Promise(r => setTimeout(r, 200));
    const out = { mem: Object.keys(progress).length,
                  ls: Object.keys(JSON.parse(localStorage.getItem(KEY_P) || '{}')).length,
                  put: calls.includes('put_progress') };
    window.rpc = realRpc;
    progress = keep.p; syncCode = keep.c; save(KEY_P, progress);
    return out;
  `);
  ok('нислэгт байсан синк устгалтыг БУЦААХГҮЙ',
    fl && fl.mem === 0 && fl.ls === 0, JSON.stringify(fl));
  ok('устгасны дараа үүл рүү дахин БИЧИХГҮЙ',
    fl && fl.put === false, JSON.stringify(fl));

  /* Бэлэн mp3 тоглож байхад TTS эхэлбэл хоёр дуу давхцана. */
  const ov = await c.ev(`
    let paused = 0;
    const real = player.pause;
    Object.defineProperty(player, 'paused', { value: false, configurable: true });
    player.pause = () => { paused++; };
    speak('テスト');
    player.pause = real;
    delete player.paused;
    try { speechSynthesis.cancel(); } catch (e) {}
    return paused;
  `);
  ok('TTS эхлэхээс өмнө бичлэг зогсоно', ov === 1, JSON.stringify(ov));

  console.log('\n[21] Кана «сонсоод таах» — ижил дуутай сонголт');
  /* Япон хэлэнд дараах хосууд ИЖИЛ дуудагдана; дууны файл нь ч байт
     хүртэл ижил (шалгав):
         お/を · じ/ぢ · ず/づ · じゃ/ぢゃ · じゅ/ぢゅ · じょ/ぢょ
     Тэднийг сонголтод зэрэг гаргавал сурагч чихээрээ ЯЛГАЖ ЧАДАХГҮЙ.
     Хэрэглэгч үүнийг «буруу дуудлага» гэж мэдээлсэн.

     Кана БҮРИЙГ 25 удаа зурж шалгана — санамсаргүй сонголт тул нэг
     удаа зурахад алдаа мэдэгдэхгүй байж болно. */
  const kl = await c.ev(`
    const keep = { d: deck, k: kmode, p: pool, c: cur };
    deck = 'kana'; kmode = 'klisten'; pool = KANA.slice();
    const bad = []; let built = 0;
    for (const k of KANA) {
      cur = k;
      for (let t = 0; t < 25; t++) {
        buildChoices(); built++;
        const txts = [...document.querySelectorAll('#choices button')]
          .map(b => b.textContent);
        const set = txts.map(h => KANA.find(x => x.hira === h)).filter(Boolean);
        const sounds = set.map(x => x.mn);
        if (sounds.length !== new Set(sounds).size) {
          bad.push(k.hira + ' -> ' + sounds.join(',')); break;
        }
        if (!txts.includes(k.hira)) { bad.push(k.hira + ' зөв хариулт алга'); break; }
        if (txts.length !== 4) { bad.push(k.hira + ' сонголт ' + txts.length); break; }
      }
    }
    deck = keep.d; kmode = keep.k; pool = keep.p; cur = keep.c;
    return { kana: KANA.length, built: built, nbad: bad.length,
             bad: bad.slice(0, 6) };
  `);
  ok('107 кана × 25 зурaлт — сонголт бүрэн'.replace('a', 'а'),
    kl && kl.kana === 107 && kl.built >= 2600, JSON.stringify(kl));
  ok('ИЖИЛ дуутай сонголт хэзээ ч зэрэг гарахгүй',
    kl && kl.nbad === 0, JSON.stringify(kl));

  /* Өгөгдлийн талаас нь ч бататгана: ижил дуутай хос үнэхээр байгаа
     эсэх. Байхгүй бол дээрх тест утгагүй болно (хуурамч тайван). */
  const pairs = await c.ev(`
    const g = {};
    for (const k of KANA) (g[k.mn] = g[k.mn] || []).push(k.hira);
    return Object.entries(g).filter(([, v]) => v.length > 1)
             .map(([m, v]) => m + ':' + v.join('/'));
  `);
  ok('ижил дуутай хос ҮНЭХЭЭР байна (тест утгатай)',
    Array.isArray(pairs) && pairs.length >= 5, JSON.stringify(pairs));

  console.log('\n[19] «Явцыг устгах» товч');
  /* Хоёр БОДИТ алдаа байсан:
       1) хариу мэдэгдэл байхгүй — Профайл дээр байхад юу ч харагдахгүй
          тул хэрэглэгч товч эвдэрсэн гэж ойлгодог;
       2) синк буцааж татдаг — `syncNow()` нь локал ба үүлийг уусгадаг
          тул хоосон локал + бүтэн үүл = бүгд буцна.
     Тиймээс ЗӨВХӨН локал устгалтыг шалгах нь хангалтгүй. */
  const rs = await c.ev(`
    const realRpc = window.rpc;
    const realConfirm = window.confirm;
    const keep = { p: progress, code: syncCode };

    // ── А · үүлний устгалт АЖИЛЛАНА ──
    const calls = [];
    window.rpc = fn => { calls.push(fn); return Promise.resolve(null); };
    window.confirm = () => true;
    syncCode = 'abcd1234efgh';
    progress = {};
    for (let i = 0; i < 4; i++) progress[ALL[i].id] = { n: 2, c: 2, b: 2, d: today() };
    save(KEY_P, progress);
    await document.getElementById('btn-reset').onclick();
    await new Promise(r => setTimeout(r, 220));
    const good = {
      calls: calls.slice(),
      left: Object.keys(progress).length,
      ls: Object.keys(JSON.parse(localStorage.getItem(KEY_P) || '{}')).length,
      code: syncCode,
      msg: document.getElementById('reset-state').textContent
    };

    // ── Б · үүлний устгалт УНАНА (хуучин SQL) ──
    window.rpc = () => Promise.reject(new Error('no such function'));
    syncCode = 'abcd1234efgh'; save(KEY_C, syncCode);
    progress = {};
    for (let i = 0; i < 4; i++) progress[ALL[i].id] = { n: 2, c: 2, b: 2, d: today() };
    save(KEY_P, progress);
    await document.getElementById('btn-reset').onclick();
    await new Promise(r => setTimeout(r, 260));
    const fell = {
      left: Object.keys(progress).length,
      code: syncCode,
      msg: document.getElementById('reset-state').textContent
    };

    window.rpc = realRpc; window.confirm = realConfirm;
    progress = keep.p; syncCode = keep.code;
    save(KEY_P, progress); save(KEY_C, syncCode);
    return { good: good, fell: fell };
  `);
  ok('устгахад явц ХОЁУЛАНГААС нь (санах ой + localStorage) арилна',
    rs && rs.good.left === 0 && rs.good.ls === 0, JSON.stringify(rs.good));
  ok('ҮҮЛНИЙ хуулбарыг ч устгана (wipe_progress)',
    rs && rs.good.calls.includes('wipe_progress'), JSON.stringify(rs.good));
  ok('хэрэглэгчид ХАРИУ мэдэгдэнэ',
    rs && rs.good.msg.length > 5, JSON.stringify(rs.good));
  ok('үүл устгаж чадаагүй бол синкийг САЛГАНА (явц буцаж ирэхгүй)',
    rs && rs.fell.left === 0 && rs.fell.code === null, JSON.stringify(rs.fell));
  ok('салгасныг хэрэглэгчид ил хэлнэ',
    rs && /САЛГА/.test(rs.fell.msg), JSON.stringify(rs.fell));

  /* Явц нь ГУРВАН хадгалалтад тархсан. Урьд нь зөвхөн `progress`
     цэвэрлэгддэг байсан тул нүүрэн дээрх «Өнөөдрийн зорилт 21/20» ба
     «дараалсан өдөр» хэвээр үлдэж, хэрэглэгч устгаагүй гэж ойлгодог
     байв. Тиймээс НҮҮРЭН ДЭЭРХ бодит тоог шалгана. */
  const rz = await c.ev(`
    const realConfirm = window.confirm;
    const keep = { p: progress, d: days, s: settings.last };
    progress = {};
    for (let i = 0; i < 7; i++) progress[ALL[i].id] = { n: 3, c: 3, b: 3, d: today() };
    save(KEY_P, progress);
    days = { last: today(), streak: 5, n: 21 }; save(KEY_D, days);
    settings.last = { d: 'vocab', m: 'choice' }; save(KEY_S, settings);
    go('home'); refreshHome();
    await new Promise(r => setTimeout(r, 300));
    const before = {
      goal: document.getElementById('goal-done').textContent,
      streak: document.getElementById('streak-n').textContent,
      cont: !document.getElementById('btn-continue').hidden
    };
    window.confirm = () => true;
    await document.getElementById('btn-reset').onclick();
    await new Promise(r => setTimeout(r, 400));
    go('home'); refreshHome();
    await new Promise(r => setTimeout(r, 300));
    const after = {
      goal: document.getElementById('goal-done').textContent,
      streak: document.getElementById('streak-n').textContent,
      bar: document.getElementById('goal-bar').style.width,
      cont: !document.getElementById('btn-continue').hidden,
      lsDays: localStorage.getItem(KEY_D),
      lsLast: (JSON.parse(localStorage.getItem(KEY_S) || '{}').last) || null
    };
    window.confirm = realConfirm;
    progress = keep.p; days = keep.d; settings.last = keep.s;
    save(KEY_P, progress); save(KEY_D, days); save(KEY_S, settings);
    return { before: before, after: after };
  `);
  ok('туршилтын өмнө тоонууд БАЙСАН',
    rz && rz.before.goal === '21' && rz.before.streak === '5' && rz.before.cont === true,
    JSON.stringify(rz.before));
  ok('устгахад ӨНӨӨДРИЙН ЗОРИЛТ тэг болно',
    rz && rz.after.goal === '0' && rz.after.bar === '0%', JSON.stringify(rz.after));
  ok('устгахад ДАРААЛСАН ӨДӨР тэг болно',
    rz && rz.after.streak === '0', JSON.stringify(rz.after));
  ok('«Үргэлжлүүлэх» товч алга болно',
    rz && rz.after.cont === false, JSON.stringify(rz.after));
  ok('days ба settings.last хадгалалтаас ч арилна',
    rz && /"n":0/.test(rz.after.lsDays) && rz.after.lsLast === null,
    JSON.stringify(rz.after));

  console.log('\n[18] Толгойн мөр — давхардалгүй');
  const bar = await c.ev(`
    return { buttons: [...document.querySelectorAll('.bar > button')].map(b => b.id),
             profileBtn: !!document.getElementById('btn-profile'),
             inDrawer: [...document.querySelectorAll('#menu button[data-go]')]
                         .some(b => b.dataset.go === 'profile') };
  `);
  ok('толгойд яг гурван удирдлага (☰ · гарчиг · ◐)',
    bar && JSON.stringify(bar.buttons) === '["btn-menu","btn-home","btn-scheme"]',
    JSON.stringify(bar));
  ok('профайлын товч УСТСАН',
    bar && bar.profileBtn === false, JSON.stringify(bar));
  ok('Тохиргоо нь шургуулганд бий',
    bar && bar.inDrawer === true, JSON.stringify(bar));

  console.log('\n[17] Слайд товч ба номын ふりがな');
  /* Тодруулга нь JS-ээр зөөгддөггүй — `:has()`-аар `aria-pressed`-ээс
     дагадаг. Тиймээс CSS-ийг уншиж таамаглахгүй, БОДИТ байрлалыг
     хэмжинэ: `:has()` ажиллахгүй бол тодруулга хөдлөхгүй. */
  const pl = await c.ev(`
    go('irodori');
    await new Promise(r => setTimeout(r, 350));
    const pos = () => {
      const i = document.querySelector('#seg-dir .pill-ind');
      const p = document.getElementById('seg-dir');
      return Math.round(i.getBoundingClientRect().left
                        - p.getBoundingClientRect().left);
    };
    settings.dir = 'jp2mn'; refreshHome();
    await new Promise(r => setTimeout(r, 320));
    const left = pos();
    settings.dir = 'mn2jp'; refreshHome();
    await new Promise(r => setTimeout(r, 320));
    const right = pos();
    settings.dir = 'jp2mn'; refreshHome();

    const pillW = document.getElementById('seg-dir').getBoundingClientRect().width;
    return {
      left: left, right: right, pillW: Math.round(pillW),
      pills: document.querySelectorAll('.pill').length,
      inds: document.querySelectorAll('.pill .pill-ind').length,
      twoEach: [...document.querySelectorAll('.pill')]
                 .every(p => p.querySelectorAll('button').length === 2),
      bookRt: document.querySelectorAll('#seg-book rt').length,
      bookRuby: document.querySelectorAll('#seg-book ruby').length,
      bookText: document.getElementById('seg-book').textContent.trim(),
      kles: !!document.getElementById('n-kles')
    };
  `);
  ok('слайд товч хоёр бий (юу давтах · чиглэл)',
    pl && pl.pills === 2 && pl.inds === 2, JSON.stringify(pl));
  ok('слайд бүр ЯГ хоёр сонголттой', pl && pl.twoEach === true, JSON.stringify(pl));
  ok('тодруулга ҮНЭХЭЭР гүйнэ',
    pl && pl.right > pl.left + 50, JSON.stringify(pl));
  ok('тодруулга хагасаар гүйнэ',
    pl && Math.abs((pl.right - pl.left) - pl.pillW / 2) < 8, JSON.stringify(pl));
  ok('ном бүр ふりがな-тай (3 ruby)',
    pl && pl.bookRuby === 3 && pl.bookRt === 3, JSON.stringify(pl));
  ok('номын шошгоос УРТ тайлбар хасагдсан',
    pl && !/Суурь шат|Анхан шат/.test(pl.bookText), JSON.stringify(pl));
  ok('ханзны тоо (#n-kles) хэвээр бий', pl && pl.kles === true, JSON.stringify(pl));
  await c.ev('go("home"); return 1;');

  console.log('\n[15] Утасны «буцах» товч');
  /* Түүхийг БОДИТООР ухраана (`history.back()`), зөвхөн функц дуудахгүй.
     Урьд нь буцах товч ямар ч гүнзгий байсан САЙТААС гаргадаг байв. */
  const hb = async () => c.ev(
    'history.back(); await new Promise(r => setTimeout(r, 340)); return screen;');

  await c.ev('go("home"); await new Promise(r=>setTimeout(r,200)); return 1;');
  await c.ev('go("irodori"); await new Promise(r=>setTimeout(r,200)); return 1;');
  await c.ev('go("stats"); await new Promise(r=>setTimeout(r,200)); return 1;');
  ok('буцах → өмнөх дэлгэц', await hb() === 'irodori');
  ok('дахин буцах → нүүр', await hb() === 'home');

  // Шургуулга нээлттэй бол буцах нь ЭХЛЭЭД түүнийг хаана.
  const bdr = await c.ev(`
    go('kana'); await new Promise(r => setTimeout(r, 200));
    document.getElementById('btn-menu').click();
    await new Promise(r => setTimeout(r, 350));
    const opened = drawerOpen();
    history.back(); await new Promise(r => setTimeout(r, 360));
    return { opened: opened, stillOpen: drawerOpen(), screen: screen };
  `);
  ok('буцах эхлээд ШУРГУУЛГЫГ хаана',
    bdr && bdr.opened === true && bdr.stillOpen === false, JSON.stringify(bdr));
  ok('шургуулга хаагдахад дэлгэц ХЭВЭЭР', bdr && bdr.screen === 'kana', JSON.stringify(bdr));

  // Дасгал дундаас буцах — гарах ёстой.
  const st = await c.ev(`
    queue = ALL.slice(0, 3); deck = 'vocab'; mode = 'flash'; enterStudy();
    await new Promise(r => setTimeout(r, 300));
    const inStudy = screen;
    history.back(); await new Promise(r => setTimeout(r, 360));
    return { inStudy: inStudy, after: screen };
  `);
  ok('дасгалаас буцвал гарна',
    st && st.inStudy === 'study' && st.after !== 'study', JSON.stringify(st));

  // Цэсээр шилжсэний дараа НЭГ даралтаар буцах (хий бичлэггүй).
  const ph = await c.ev(`
    go('home'); await new Promise(r => setTimeout(r, 200));
    document.getElementById('btn-menu').click();
    await new Promise(r => setTimeout(r, 350));
    document.querySelector('#menu button[data-go=\"stats\"]').click();
    await new Promise(r => setTimeout(r, 300));
    const at = screen;
    history.back(); await new Promise(r => setTimeout(r, 360));
    return { at: at, after: screen };
  `);
  ok('цэсээр шилжээд НЭГ даралтаар буцна',
    ph && ph.at === 'stats' && ph.after === 'home', JSON.stringify(ph));

  console.log('\n[16] Явц — НИЙТ тоо харуулахгүй');
  const sv = await c.ev(`
    /* Цэвэр явцтай хэрэглэгч: юу ч үзээгүй. */
    const keep = progress;
    progress = {};
    go('stats'); refreshStats();
    await new Promise(r => setTimeout(r, 250));
    const empty = {
      cards: document.querySelectorAll('#stat-sum div').length,
      sumText: document.getElementById('stat-sum').textContent,
      sections: document.getElementById('stat-sections').textContent,
      tabsHidden: document.getElementById('seg-stat').hidden,
      helpHidden: ['st-h-sec', 'st-help1', 'st-help2', 'st-h-det']
                    .every(id => document.getElementById(id).hidden)
    };
    /* Нэг үг үзсэн болгоё. */
    progress = { [ALL[0].id]: { n: 1, c: 1, b: 1, d: today() } };
    refreshStats();
    await new Promise(r => setTimeout(r, 250));
    const one = {
      sections: document.querySelectorAll('#stat-sections .l').length,
      tabs: document.querySelectorAll('#seg-stat button').length,
      lessons: document.querySelectorAll('#stat-lessons .l').length
    };
    progress = keep; refreshStats();
    return { empty: empty, one: one };
  `);
  ok('«нийт зүйл» хайрцаг УСТСАН',
    sv && sv.empty.cards === 3 && !/нийт зүйл/.test(sv.empty.sumText),
    JSON.stringify(sv.empty));
  ok('юу ч үзээгүй бол хэсгийн жагсаалт ХООСОН',
    sv && /Эхний дасгалаа/.test(sv.empty.sections), JSON.stringify(sv.empty));
  ok('юу ч үзээгүй бол таб нуугдана',
    sv && sv.empty.tabsHidden === true, JSON.stringify(sv.empty));
  ok('юу ч үзээгүй бол тайлбар ба гарчиг нуугдана',
    sv && sv.empty.helpHidden === true, JSON.stringify(sv.empty));
  ok('нэг үг үзэхэд ЗӨВХӨН нэг хэсэг гарна',
    sv && sv.one.sections === 1 && sv.one.tabs === 1, JSON.stringify(sv.one));
  ok('дэлгэрэнгүйд зөвхөн эхэлсэн хичээл',
    sv && sv.one.lessons === 1, JSON.stringify(sv.one));
  await c.ev('go("home"); return 1;');

  console.log('\n[14] Хариултын дуу ба чичиргээ');
  /* «Алдаа гараагүй» гэдэг нь хангалтгүй — осциллятор ҮНЭХЭЭР үүсч,
     эхэлж байгааг тоолно. Мөн чичиргээ нь ЗӨВХӨН буруу дээр. */
  const snd = await c.ev(`
    const C = window.AudioContext || window.webkitAudioContext;
    let made = 0;
    const real = C.prototype.createOscillator;
    C.prototype.createOscillator = function () { made++; return real.call(this); };
    const vib = [];
    const realVib = navigator.vibrate;
    navigator.vibrate = p => { vib.push(p); return true; };

    const was = settings.sfx;
    settings.sfx = 1;

    made = 0; vib.length = 0;
    sfx(true);
    const good = { osc: made, vib: vib.length };

    made = 0; vib.length = 0;
    sfx(false);
    const bad = { osc: made, vib: vib.slice() };

    settings.sfx = 0;
    made = 0; vib.length = 0;
    sfx(true); sfx(false);
    const off = { osc: made, vib: vib.length };

    settings.sfx = was;
    C.prototype.createOscillator = real;
    navigator.vibrate = realVib;
    return { good, bad, off, ctx: actx ? actx.state : 'none' };
  `);
  ok('зөв хариултад дуу гарна', snd && snd.good.osc > 0, JSON.stringify(snd));
  ok('зөв хариултад чичирэхгүй', snd && snd.good.vib === 0, JSON.stringify(snd));
  ok('буруу хариултад дуу гарна', snd && snd.bad.osc > 0, JSON.stringify(snd));
  ok('буруу хариултад ЧИЧИРНЭ',
    snd && snd.bad.vib.length === 1 && snd.bad.vib[0] > 0, JSON.stringify(snd));
  ok('унтраалттай үед дуу ч, чичиргээ ч ГАРАХГҮЙ',
    snd && snd.off.osc === 0 && snd.off.vib === 0, JSON.stringify(snd));

  /* Дасгалын БОДИТ урсгалд холбогдсон эсэх — `sfx()`-ыг шууд биш,
     хариулт өгөх замаар дуудуулна. */
  const flow = await c.ev(`
    const C = window.AudioContext || window.webkitAudioContext;
    let made = 0;
    const real = C.prototype.createOscillator;
    C.prototype.createOscillator = function () { made++; return real.call(this); };
    settings.sfx = 1;
    queue = ALL.slice(0, 3); deck = 'vocab'; mode = 'flash'; enterStudy();
    await new Promise(r => setTimeout(r, 300));
    made = 0;
    resolve(true);
    await new Promise(r => setTimeout(r, 120));
    const afterResolve = made;
    C.prototype.createOscillator = real;
    show('home'); go('home');
    return { afterResolve: afterResolve };
  `);
  ok('дасгалд хариулахад дуу гарна (resolve-д холбогдсон)',
    flow && flow.afterResolve > 0, JSON.stringify(flow));

  /* Товч нь одоо УНТРААЛГА. `aria-checked` нь зөвхөн атрибут — CSS
     үнэхээр бөмбөлгийг гүйлгэж байгааг БАЙРЛАЛААР хэмжинэ. */
  const btn = await c.ev(`
    go('profile');
    await new Promise(r => setTimeout(r, 250));
    const b = document.getElementById('btn-sfx');
    if (!b) return null;
    const knob = b.querySelector('i');
    const dx = () => Math.round(knob.getBoundingClientRect().left
                                - b.getBoundingClientRect().left);
    const was = settings.sfx;
    settings.sfx = 1; refreshSfx();
    await new Promise(r => setTimeout(r, 250));
    const on = { aria: b.getAttribute('aria-checked'), x: dx() };
    settings.sfx = 0; refreshSfx();
    await new Promise(r => setTimeout(r, 250));
    const off = { aria: b.getAttribute('aria-checked'), x: dx() };
    settings.sfx = was; refreshSfx();
    return { on: on, off: off, def: cleanSettings({}).sfx,
             role: b.getAttribute('role'),
             icons: document.querySelectorAll('#profile .set-i svg').length,
             cards: document.querySelectorAll('#profile .set').length };
  `);
  ok('унтраалга байна (role=switch)',
    btn && btn.role === 'switch', JSON.stringify(btn));
  ok('aria-checked төлөвөө дагана',
    btn && btn.on.aria === 'true' && btn.off.aria === 'false', JSON.stringify(btn));
  ok('бөмбөлөг ҮНЭХЭЭР гүйнэ',
    btn && btn.on.x > btn.off.x + 10, JSON.stringify(btn));
  ok('анхдагчаар АСААЛТТАЙ', btn && btn.def === 1, JSON.stringify(btn));
  ok('тохиргооны мөр бүр иконтой',
    btn && btn.icons === btn.cards, JSON.stringify(btn));
  await c.ev('go("home"); return 1;');

  console.log('\n[13] Нүүрний картууд давхцахгүй');
  /* «Санал хүсэлт» карт нь `.bigcards` торны ГАДНА байсан тул `gap`
     үйлчлэхгүй, өмнөх карт дээрээ наалдаж байв. Зургаар баригдсан.
     Энд ЯГ байрлалыг нь хэмжинэ — CSS уншиж таамаглахгүй. */
  const laid = await c.ev(`
    go('home');
    await new Promise(r => setTimeout(r, 300));
    /* НУУГДСАН картыг тооцохгүй: JLPT нь унтраалттай үед нуугддаг
       бөгөөд түүний хэмжээс БҮГД тэг тул зайн тооцоог гажуудуулна.
       (Загварчилсан мөр дотор ХАЖУУ хашилт бичиж болохгүй.) */
    const cards = [...document.querySelectorAll('.bigcards .bigcard')]
      .filter(c => c.getBoundingClientRect().height > 0);
    const box = cards.map(c => c.getBoundingClientRect());
    let worst = 999, overlap = 0;
    for (let i = 1; i < box.length; i++) {
      const gap = box[i].top - box[i - 1].bottom;
      if (gap < worst) worst = gap;
      if (gap < 0) overlap++;
    }
    return { n: cards.length, worst: Math.round(worst), overlap: overlap,
             outside: document.querySelectorAll('.bigcard:not(.bigcards .bigcard)').length };
  `);
  /* JLPT нуугдсан, «Санал хүсэлт» нь шургуулганд зөөгдсөн тул
     нүүрэнд Irodori · Шалгалт · Кана гурав харагдана. */
  ok('нүүрэнд харагдах карт 3+', laid && laid.n >= 3, JSON.stringify(laid));
  ok('карт хоорондоо ДАВХЦААГҮЙ',
    laid && laid.overlap === 0, JSON.stringify(laid));
  ok('карт хооронд бодит зай бий',
    laid && laid.worst >= 8, JSON.stringify(laid));
  ok('торны ГАДНА карт үлдээгүй',
    laid && laid.outside === 0, JSON.stringify(laid));

  /* Нүүрний блокууд ЖИГД зайтай эсэх. Өмнө нь блок тус бүр өөрийн
     margin-тай байсан тул 0 / 10 / 34px гэсэн санамсаргүй алхам
     гардаг байв. Энд CSS уншихгүй — БОДИТ зайг хэмжинэ. */
  const gaps = await c.ev(`
    go('home');
    await new Promise(r => setTimeout(r, 300));
    const kids = [...document.getElementById('home').children]
      .filter(e => e.getBoundingClientRect().height > 0);
    const g = [];
    for (let i = 1; i < kids.length; i++) {
      g.push(Math.round(kids[i].getBoundingClientRect().top
                        - kids[i - 1].getBoundingClientRect().bottom));
    }
    return { gaps: g, uniq: [...new Set(g)] };
  `);
  ok('нүүрний блокуудын зай ЖИГД (бүгд ижил)',
    gaps && gaps.uniq.length === 1, JSON.stringify(gaps));
  ok('зай нь --list-gap (14px)',
    gaps && gaps.uniq[0] === 14, JSON.stringify(gaps));

  /* Хажуугийн шургуулга. Нээхэд ХОЁР алхам (hidden -> дараагийн кадрт
     `open`) тул зөвхөн `hidden`-ийг шалгавал хагас зураг гарна —
     БОДИТ байрлалыг нь хэмжинэ. */
  const dr = await c.ev(`
    go('stats');
    await new Promise(r => setTimeout(r, 200));
    const m = document.getElementById('menu');
    const sc = document.getElementById('scrim');
    const closed = { hidden: m.hidden, scrim: sc.hidden };

    document.getElementById('btn-menu').click();
    await new Promise(r => setTimeout(r, 450));
    const r1 = m.getBoundingClientRect();
    const opened = {
      hidden: m.hidden, scrim: sc.hidden,
      left: Math.round(r1.left), w: Math.round(r1.width),
      full: Math.round(r1.height) >= innerHeight - 2,
      items: document.querySelectorAll('#menu button[data-go]').length,
      icons: document.querySelectorAll('#menu button[data-go] svg.di').length,
      shown: [...document.querySelectorAll('#menu button[data-go]')]
               .filter(b => !b.hidden).length,
      cur: [...document.querySelectorAll('#menu button[aria-current=\"true\"]')]
               .map(b => b.dataset.go)
    };

    // Бүдгэрүүлэгч дээр дарвал хаагдах ёстой.
    sc.click();
    await new Promise(r => setTimeout(r, 450));
    const afterScrim = { hidden: m.hidden, scrim: sc.hidden };

    // Цэснээс шилжихэд шургуулга хаагдаж, дэлгэц солигдоно.
    document.getElementById('btn-menu').click();
    await new Promise(r => setTimeout(r, 400));
    document.querySelector('#menu button[data-go=\"kana\"]').click();
    await new Promise(r => setTimeout(r, 300));
    const afterNav = { hidden: m.hidden, screen: screen };

    return { closed, opened, afterScrim, afterNav };
  `);
  ok('эхлээд шургуулга ХААЛТТАЙ',
    dr && dr.closed.hidden === true && dr.closed.scrim === true,
    JSON.stringify(dr.closed));
  ok('☰ дарвал нээгдэж ЗҮҮН ирмэгт ирнэ',
    dr && dr.opened.hidden === false && dr.opened.left === 0,
    JSON.stringify(dr.opened));
  ok('бүтэн өндөртэй, 284px өргөн',
    dr && dr.opened.full === true && dr.opened.w === 284,
    JSON.stringify(dr.opened));
  ok('бүдгэрүүлэгч гарч ирнэ',
    dr && dr.opened.scrim === false, JSON.stringify(dr.opened));
  /* JLPT-ийн тугаас хамаарна — хатуу тоо бичвэл тугийг сольмогц унана. */
  ok('шургуулгад 8 бичлэг, JLPT нь тугийг дагана',
    dr && dr.opened.items === 8
      && dr.opened.shown === (jlptOn ? 8 : 7),
    JSON.stringify(dr.opened) + ' jlptOn=' + jlptOn);
  ok('бичлэг БҮР иконтой',
    dr && dr.opened.icons === dr.opened.items, JSON.stringify(dr.opened));
  ok('идэвхтэй хуудас тэмдэглэгдсэн',
    dr && JSON.stringify(dr.opened.cur) === '["stats"]', JSON.stringify(dr.opened));
  ok('бүдгэрүүлэгч дээр дарвал хаагдана',
    dr && dr.afterScrim.hidden === true && dr.afterScrim.scrim === true,
    JSON.stringify(dr.afterScrim));
  ok('бичлэг дарвал хаагдаж шилжинэ',
    dr && dr.afterNav.hidden === true && dr.afterNav.screen === 'kana',
    JSON.stringify(dr.afterNav));
  await c.ev('go("home"); return 1;');

  console.log('\n[12] ふりがな — ruby/rt');
  /* `exScript`-ийг §9b аль хэдийн өөрчилсөн тул одоогийн УТГЫГ нь
     шалгах утгагүй. Шалгах ёстой зүйл нь: юу ч хадгалаагүй шинэ
     хэрэглэгчид ふりがな ОНОГДОНО, сонголт нь яг гурав. */
  const seg = await c.ev(`
    return { fallback: cleanSettings({}).script,
             scripts: SCRIPTS,
             btns: [...document.querySelectorAll('#seg-script button')]
                     .map(b => b.dataset.s),
             inProfile: !!document.querySelector('#profile #seg-script'),
             oldExam: !!document.getElementById('seg-exam-script') };
  `);
  ok('өгөгдмөл нь かな', seg && seg.fallback === 'kana', JSON.stringify(seg));
  ok('бичгийн сонголт яг гурав: kana/ruby/kanji',
    seg && JSON.stringify(seg.btns) === '["kana","ruby","kanji"]',
    JSON.stringify(seg));
  ok('сонгогч нь ПРОФАЙЛ дээр — нэг л газар',
    seg && seg.inProfile === true, JSON.stringify(seg));
  ok('шалгалтын тусдаа сонгогч УСТСАН',
    seg && seg.oldExam === false, JSON.stringify(seg));

  const ru = await c.ev(`
    await loadExam();
    const q = EXAM.items.find(x => x.id === "S01-01");
    settings.script = "ruby"; exN = 10; exMode = "think";
    startExam();
    await new Promise(r => setTimeout(r, 800));
    exQs[exIdx] = q; exIdx = 0; renderExam();
    await new Promise(r => setTimeout(r, 200));
    const el = document.getElementById("ex-q");
    // <ruby> дотор rt нь textContent-д ОРДОГ тул суурийг тусад нь цуглуулна.
    const base = [...el.childNodes].map(n => n.nodeName === "RUBY"
        ? n.firstChild.textContent : n.textContent).join("");
    return {
      rubies:  el.querySelectorAll("ruby").length,
      rts:     el.querySelectorAll("rt").length,
      firstRt: (el.querySelector("rt") || {}).textContent,
      base: base, want: q.q,
      cls: el.className,
      lh: parseFloat(getComputedStyle(el).lineHeight),
      fs: parseFloat(getComputedStyle(el).fontSize)
    };
  `);
  ok('<ruby> элемент үүссэн', ru && ru.rubies > 0, JSON.stringify(ru));
  ok('rt тоо нь ruby тоотой тэнцүү', ru && ru.rts === ru.rubies, JSON.stringify(ru));
  ok('суурь бичиг нь ханзан хэлбэртэй ЯГ тэнцүү',
    ru && ru.base === ru.want, JSON.stringify(ru));
  ok('эхний уншлага «あさ»', ru && ru.firstRt === 'あさ', JSON.stringify(ru));
  ok('.ruby анги зүүгдсэн',
    ru && String(ru.cls).indexOf('ruby') >= 0, JSON.stringify(ru));
  // Мөрийн өндөр өсөөгүй бол дээд мөрийн кана дайрна.
  ok('мөрийн өндөр өссөн (кана дайрахгүй)',
    ru && ru.lh > ru.fs * 1.9, JSON.stringify(ru));

  const rk = await c.ev(`
    settings.script = "kanji"; renderExam(); await new Promise(r => setTimeout(r, 150));
    const el = document.getElementById("ex-q");
    const a = { rubies: el.querySelectorAll("ruby").length,
                cls: el.className, txt: el.textContent };
    settings.script = "kana"; renderExam(); await new Promise(r => setTimeout(r, 150));
    a.kanaTxt = el.textContent;
    a.kanaKanji = /[\\u3400-\\u9fff]/.test(el.textContent);
    settings.script = "ruby";
    return a;
  `);
  ok('漢字 горимд ruby үүсэхгүй', rk && rk.rubies === 0, JSON.stringify(rk));
  ok('漢字 горимд .ruby анги авагдсан',
    rk && String(rk.cls).indexOf('ruby') < 0, JSON.stringify(rk));
  ok('かな горимд ханз гарахгүй', rk && rk.kanaKanji === false, JSON.stringify(rk));

  // Шалгалтын өгөгдөл нь ТАТАЖ авдаг файл — хорлонтой бол яах вэ.
  // `exInto()` нь DOM зангаар барьдаг тул ямар ч тэмдэгт ТЕКСТ л болно.
  const rx = await c.ev(`
    const el = document.getElementById("ex-q");
    settings.script = "ruby";
    exInto(el, { q: "x", qKana: "x",
                 qRuby: [["<img src=x onerror=window.__pwn=1>", "<b>r</b>"]] }, 'q');
    await new Promise(r => setTimeout(r, 300));
    return { imgs: el.querySelectorAll("img,b,script").length,
             pwned: !!window.__pwn,
             rt: (el.querySelector("rt") || {}).textContent };
  `);
  ok('хорлонтой ruby нь ЭЛЕМЕНТ үүсгэхгүй',
    rx && rx.imgs === 0 && rx.pwned === false, JSON.stringify(rx));
  ok('хорлонтой ruby нь ТЕКСТ болж үлдэнэ',
    rx && rx.rt === '<b>r</b>', JSON.stringify(rx));
  /* JS дэх `rubyPairs()` нь `tools/build_exam.py`-гийн алгоритмын ХУУЛБАР.
     Хоёр хэрэгжүүлэлт салж явбал үгийн сан дээр буруу ふりがな гарна.
     Тиймээс Python-ы бэлдсэн 200 хостой ТУЛГАНА — энэ нь хөрвүүлэлт
     зөв эсэхийн шууд нотолгоо. */
  const cross = await c.ev(`
    await loadExam();
    let same = 0, diff = 0, plain = 0; const bad = [];
    for (const it of EXAM.items) {
      for (const [surf, read, want] of [[it.q, it.qKana, it.qRuby],
                                        [it.model, it.modelKana, it.modelRuby]]) {
        // Ханзгүй мөр (ж: おはようございます。): Python нэг зангуу хос
        // хадгалдаг, JS нь null буцаана. Хоёулаа ИЖИЛ зүйл харуулна —
        // энд тулгах нь уншлагатай мөрүүд.
        if (!want.some(x => x[1])) { plain++; continue; }
        const got = rubyPairs(surf, read);
        if (!got) { diff++; bad.push(it.id + ' null'); continue; }
        if (JSON.stringify(got) === JSON.stringify(want)) same++;
        else { diff++; if (bad.length < 4) bad.push(it.id + ' ' + JSON.stringify(got)); }
      }
    }
    return { same: same, diff: diff, plain: plain, bad: bad };
  `);
  ok('JS зэрэгцүүлэгч Python-тойгоо ЯГ таарна (зөрүү 0)',
    cross && cross.diff === 0 && cross.same > 150, JSON.stringify(cross));
  ok('ханзгүй мөрд ふりがな үүсгэхгүй',
    cross && cross.plain > 20 && cross.same + cross.plain === 200,
    JSON.stringify(cross));

  // Үгийн карт: урд тал нь ЦЭВЭР байх ёстой — уншлага нь таах хариулт.
  const wc = await c.ev(`
    settings.script = "ruby";
    const w = ALL.find(x => x.jp && x.kana && x.jp !== x.kana
                            && /[\\u3400-\\u9fff]/.test(x.jp));
    queue = [w]; deck = "vocab"; mode = "flash"; enterStudy();
    await new Promise(r => setTimeout(r, 300));
    const front = document.getElementById("p-main");
    const a = { word: w.jp, kana: w.kana,
                frontRt: front.querySelectorAll("rt").length,
                frontTxt: front.textContent };
    reveal();
    await new Promise(r => setTimeout(r, 200));
    const back = document.getElementById("a-kana");
    a.backRt = back.querySelectorAll("rt").length;
    a.backBase = [...back.childNodes].map(n => n.nodeName === "RUBY"
        ? n.firstChild.textContent : n.textContent).join("");
    a.backCls = back.className;
    return a;
  `);
  ok('үгийн картын УРД талд ふりがな ГАРАХГҮЙ',
    wc && wc.frontRt === 0, JSON.stringify(wc));
  ok('урд тал нь ханзан хэлбэр хэвээр',
    wc && wc.frontTxt === wc.word, JSON.stringify(wc));
  ok('АР талд ふりがな гарна', wc && wc.backRt > 0, JSON.stringify(wc));
  ok('ар талын суурь нь ханзан хэлбэр',
    wc && wc.backBase === wc.word, JSON.stringify(wc));

  // かな горимд үгийн картын ар талд ruby байх ЁСГҮЙ.
  const wk = await c.ev(`
    settings.script = "kana"; reveal();
    await new Promise(r => setTimeout(r, 200));
    const back = document.getElementById("a-kana");
    return { rt: back.querySelectorAll("rt").length, cls: back.className };
  `);
  ok('かな горимд үгийн картад ruby гарахгүй',
    wk && wk.rt === 0 && String(wk.cls).indexOf('ruby') < 0, JSON.stringify(wk));

  await c.ev('settings.script = "kana"; exAbort(); show("home"); go("home"); return 1;');

}

main().catch(e => { console.error(e); process.exit(2); });
