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
    '--user-data-dir=' + require('os').tmpdir() + '\\irodori-uitest',
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
  ok('дэвсгэр (#bg) байна', await c.ev('return !!document.getElementById("bg")'));
  ok('гарчиг «Мартчихлаа»',
    (await c.ev('return document.title')).indexOf('Мартчихлаа') >= 0,
    await c.ev('return document.title'));

  console.log('\n[2] localhost дээр ping БИЧИХГҮЙ (§2.13)');
  ok('isDevHost() = true', await c.ev('return isDevHost() === true'));

  console.log('\n[3] Дэлгэц бүр нээгдэнэ');
  for (const s of ['irodori', 'jlpt', 'kana', 'stats', 'profile', 'feedback', 'home']) {
    await c.ev('go("' + s + '"); return 1');
    await sleep(120);
    const vis = await c.ev('return !document.getElementById("' + s + '").hidden');
    ok('дэлгэц ' + s, vis);
  }

  console.log('\n[4] Ханзны 3D цагираг дэлгэц дагаж нүүнэ');
  for (const s of ['home', 'irodori', 'jlpt', 'kana']) {
    await c.ev('go("' + s + '"); return 1');
    await sleep(150);
    const r = await c.ev(
      'const r=document.getElementById("ring");' +
      'return r ? {inScreen: !!r.closest("#' + s + '"), w: r.getBoundingClientRect().width} : null');
    ok('цагираг ' + s + '-д байна', r && r.inScreen, JSON.stringify(r));
    ok('цагирагны өргөн > 0', r && r.w > 0, r ? String(r.w) : 'ring алга');
  }

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

  console.log('\n[7] Загвар солих');
  const themes = await c.ev('return THEMES.map(t=>t.k)');
  ok('5 загвар бүртгэлтэй', themes.length === 5, themes.join(','));
  for (const t of themes) {
    const r = await c.ev(
      'applyTheme(' + JSON.stringify(t) + ');' +
      'const cs=getComputedStyle(document.documentElement);' +
      'return {attr: document.documentElement.getAttribute("data-theme"),' +
      ' bg: cs.getPropertyValue("--bg").trim(),' +
      ' ink: cs.getPropertyValue("--ink").trim()}');
    ok('загвар ' + t + ' — data-theme тавигдсан', r.attr === t, JSON.stringify(r));
    ok('загвар ' + t + ' — --bg токен бий', /^#|rgb/.test(r.bg), r.bg);
  }
  await c.ev('applyTheme("minimal"); return 1');
  const mb = await c.ev(
    'return getComputedStyle(document.documentElement).getPropertyValue("--bg").trim()');
  ok('minimal нь GitHub-ийн #0d1117', mb === '#0d1117', mb);

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

  console.log('\n[10] .busy — дасгалын үед дэвсгэр зогсоно');
  await c.ev('queue = ALL.slice(0,2); deck="vocab"; mode="flash"; enterStudy(); return 1');
  await sleep(100);
  ok('дасгал дээр .busy тавигдсан',
    await c.ev('return document.documentElement.classList.contains("busy")'));
  await c.ev('show("home"); return 1');
  ok('гармагц .busy авагдсан',
    await c.ev('return !document.documentElement.classList.contains("busy")'));
}

main().catch(e => { console.error(e); process.exit(2); });
