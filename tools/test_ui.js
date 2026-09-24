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
  /* Шинэ профайл = нэр, анги тохируулаагүй -> ЭХЛЭЭД тохируулах дэлгэц.
     Дараагийн бүх тест нүүрнээс эхэлдэг тул «Бусад»-аар дуусгана. */
  ok('анх ороход ТОХИРУУЛАХ дэлгэц гарна', await c.ev('return screen === "setup"'));
  ok('анх ороход «Болих» НУУГДМАЛ',
    await c.ev('return document.getElementById("su-cancel").hidden === true'));
  await c.ev(`
    document.getElementById('su-name').value = 'Тест';
    document.getElementById('su-other').click();
    await saveSetup();
    return 1;
  `);
  ok('«Бусад»-аар дуусгахад нүүр дэлгэц гарсан', await c.ev('return screen === "home"'));
  ok('нэр ба «Бусад» хадгалагдсан',
    await c.ev('const m = load(KEY_ME, {}); return m.done === true && m.name === "Тест" && m.other === true'));
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
    ['kanji-jlpt', 'startKanji(M, "jlpt")', ['flash', 'k2m', 'm2k', 'read', 'emoji']],
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

  console.log('\n[6] Явц дэлгэц — ном тус бүрийн доор ХИЧЭЭЛҮҮД');
  await c.ev('go("stats"); return 1');
  await sleep(400);
  await c.ev('return loadAllBooks().then(()=>refreshStats())');
  await sleep(300);
  /* Хуучин бүтцэд таб дарж хичээл хайдаг байсан. Одоо ном тус бүр
     гарчиг (h3) болж, доор нь ТҮҮНИЙ хичээлүүд эгнэнэ. Бүх номыг
     «эхэлсэн» болгож хэд гарахыг шалгана. */
  const tree = await c.ev(`
    const keep = progress;
    /* Ном бүрээс нэг зүйл үзсэн болгоно — эс тэгвэл зөвхөн эхэлсэн
       ном гардаг тул мод хоосон байна. */
    progress = {};
    for (const t of STAT_TABS) {
      const set = statSet(t.k);
      if (set.length) progress[set[0].id] = { n: 1, c: 1, b: 1, d: today() };
    }
    refreshStats();
    await new Promise(r => setTimeout(r, 250));
    const secs = [...document.querySelectorAll('#stat-tree > section')];
    const out = secs.map(sec => ({
      title: sec.querySelector('h3') ? sec.querySelector('h3').textContent.trim() : null,
      bars: sec.querySelectorAll('.statles.wide .l').length,
      lessons: sec.querySelectorAll('.statles.les .l').length
    }));
    progress = keep; refreshStats();
    return { n: secs.length, secs: out,
             tabsGone: !document.getElementById('seg-stat'),
             detailGone: !document.getElementById('stat-lessons') };
  `);
  ok('ном бүр өөрийн хэсэгтэй (6)', tree && tree.n === 6, JSON.stringify(tree));
  ok('хэсэг бүр гарчигтай',
    tree && tree.secs.every(x => x.title && x.title.length > 0), JSON.stringify(tree));
  /* Номын ТҮВШНИЙ зураас ЗОРИУД хасагдсан: гарчиг дээр «N тогтсон ·
     N үзсэн» аль хэдийн байгаа тул давхардал байв. */
  ok('номын түвшний зураас байхгүй (гарчиг тоог агуулна)',
    tree && tree.secs.every(x => x.bars === 0), JSON.stringify(tree));
  ok('гарчиг тогтсон ба үзсэн хоёуланг харуулна',
    tree && tree.secs.every(x => /тогтсон/.test(x.title) && /үзсэн/.test(x.title)),
    JSON.stringify(tree));
  ok('хэсэг бүрийн доор ХИЧЭЭЛийн мөр бий',
    tree && tree.secs.every(x => x.lessons >= 1), JSON.stringify(tree));
  ok('хуучин таб ба «Дэлгэрэнгүй» УСТСАН',
    tree && tree.tabsGone && tree.detailGone, JSON.stringify(tree));
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

  console.log('\n[26] Өдрийн зорилт — нэг үгийг НЭГ л удаа тоолно');
  /* Хэрэглэгч мэдээлсэн: 20 үгийн НЭГ дасгал хийхэд зорилт «109/20»
     гэж гарсан. `tickDay()` нь `grade()` дотор байсан тул хариулт
     бүрд өсдөг байв — алдсан карт мөчлөгт эргэж ирээд ДАХИН
     бүртгэгддэг. §2.51-д дасгалын тоолуурыг зассан ч энэ тоолуур
     хэвээр үлдсэн байсан.
     ЦУВРАЛ нь тусдаа: буруу хариулсан ч тухайн өдөр давтсанд тооцно. */
  const dc = await c.ev(`
    const keepDays = days, keepProg = progress, keepSfx = settings.sfx;
    settings.sfx = 0;
    const out = {};

    // ── (1) НЭГ картыг буруу, дараа нь зөв -> зорилт ЯГ 1
    progress = {}; days = { last: -1, streak: 0, n: 0 };
    queue = ALL.slice(0, 1); deck = 'vocab'; mode = 'flash';
    missed = []; done = okN = ngN = 0;
    enterStudy();
    await new Promise(r => setTimeout(r, 300));
    answered = false; resolve(false);
    out.afterWrong = todayN();
    nextCard();
    await new Promise(r => setTimeout(r, 40));
    answered = false; resolve(true);
    out.afterRight = todayN();

    // ── (2) Буруу хариулт ч ЦУВРАЛыг эхлүүлнэ
    progress = {}; days = { last: -1, streak: 0, n: 0 };
    queue = ALL.slice(0, 1); missed = []; done = okN = ngN = 0;
    enterStudy();
    await new Promise(r => setTimeout(r, 300));
    answered = false; resolve(false);
    out.streakOnWrong = streakN();
    out.goalOnWrong = todayN();

    // ── (3) 20 картын дасгал, 5 дээр нь алдана -> зорилт ЯГ 20
    progress = {}; days = { last: -1, streak: 0, n: 0 };
    queue = ALL.slice(0, 20); missed = []; done = okN = ngN = 0;
    enterStudy();
    await new Promise(r => setTimeout(r, 300));
    let answers = 0;
    for (let i = 0; i < 20; i++) {
      answered = false; resolve(i >= 5); answers++;
      nextCard();
      await new Promise(r => setTimeout(r, 20));
    }
    for (let i = 0; i < 5; i++) {          // алдсан 5 нь эргэж ирсэн
      answered = false; resolve(true); answers++;
      nextCard();
      await new Promise(r => setTimeout(r, 20));
    }
    out.answers = answers; out.goal = todayN(); out.done = done;

    // ── (4) ЯГ ижил 20 үгийг ДАХИН судална -> зорилт 20 хэвээр
    queue = ALL.slice(0, 20); missed = []; done = okN = ngN = 0;
    enterStudy();
    await new Promise(r => setTimeout(r, 300));
    for (let i = 0; i < 20; i++) {
      answered = false; resolve(true);
      nextCard();
      await new Promise(r => setTimeout(r, 20));
    }
    out.goalAfterRepeat = todayN();

    // ── (5) ӨӨР 20 үг судалбал зорилт 40 болно (давхардал биш)
    queue = ALL.slice(20, 40); missed = []; done = okN = ngN = 0;
    enterStudy();
    await new Promise(r => setTimeout(r, 300));
    for (let i = 0; i < 20; i++) {
      answered = false; resolve(true);
      nextCard();
      await new Promise(r => setTimeout(r, 20));
    }
    out.goalAfterFresh = todayN();

    // ── (6) ХУУЧИН хэлбэрээс шилжих: ids байхгүй бол progress-оос сэргээнэ.
    //    grade() нь d = today() + BOXES[b] гэж бичдэг тул
    //    d - BOXES[b] === today() нь ӨНӨӨДӨР судалсныг ЯГ заана.
    progress = {};
    for (const it of ALL.slice(0, 7)) {
      progress[it.id] = { n:1, c:1, w:0, b:2, d: today() + BOXES[2] };
    }
    // ӨЧИГДӨР судалсан үг — тоололд ОРОХ ЁСГҮЙ
    progress[ALL[50].id] = { n:1, c:1, w:0, b:2, d: today() - 1 + BOXES[2] };
    days = { last: today(), streak: 3, n: 40 };     // хуучин хэлбэр, ХЭТЭРСЭН
    recoverDayIds();
    out.migGoal = todayN(); out.migStreak = streakN();

    // ── (7) Өчигдрийн хуучин бичлэг — өнөөдрийн тоо 0-ээс эхэлнэ
    days = { last: today() - 1, streak: 3, n: 40 };
    recoverDayIds();
    out.migOld = todayN();

    days = keepDays; progress = keepProg; settings.sfx = keepSfx;
    show('home'); go('home');
    return out;
  `);
  ok('буруу хариулт зорилтод ОРОХГҮЙ',
    dc && dc.afterWrong === 0, JSON.stringify(dc));
  ok('карт дуусахад зорилт ЯГ 1 нэмэгдэнэ',
    dc && dc.afterRight === 1, JSON.stringify(dc));
  ok('буруу хариулсан ч ЦУВРАЛ эхэлнэ',
    dc && dc.streakOnWrong === 1 && dc.goalOnWrong === 0, JSON.stringify(dc));
  ok('20 үгийн дасгал 25 хариулттай ч зорилт ЯГ 20',
    dc && dc.answers === 25 && dc.goal === 20, JSON.stringify(dc));
  ok('өдрийн зорилт нь дасгалын тоолууртай ТААРНА',
    dc && dc.goal === dc.done, JSON.stringify(dc));
  ok('ИЖИЛ 20 үгийг дахин судалбал зорилт 20 ХЭВЭЭР',
    dc && dc.goalAfterRepeat === 20, JSON.stringify(dc));
  ok('ӨӨР 20 үг судалбал зорилт 40 болно',
    dc && dc.goalAfterFresh === 40, JSON.stringify(dc));
  ok('шилжилт: хэтэрсэн 40 нь бодит 7 болж ЗАСАГДАНА',
    dc && dc.migGoal === 7, JSON.stringify(dc));
  ok('шилжилт: ЦУВРАЛ хэвээр үлдэнэ',
    dc && dc.migStreak === 3, JSON.stringify(dc));
  ok('шилжилт: өчигдрийн бичлэгээс өнөөдрийн тоо 0',
    dc && dc.migOld === 0, JSON.stringify(dc));

  console.log('\n[27] Явцын дэлгэц — ҮГЭЭР тоолно, хариултаар БИШ');
  /* Хэрэглэгчийн шаардлага: апп даяар тоолол нь ҮГИЙН id-гаар явна,
     картын/хариултын тоогоор БИШ. Өдрийн зорилтыг зассаны дараа явцын
     дэлгэц ч ижил дүрмээр тоолж байгааг БАТЛАНА (уншаад итгэхгүй).
     ЦОР ГАНЦ хариултад суурилсан тоо нь «зөв хариулт %» — тэр нь
     НЯГТРАЛ учир хариултаас бодогдох нь ЗӨВ. */
  const pcount = await c.ev(`
    const keepProg = progress, keepDays = days;
    const A = ALL[0].id, B = ALL[1].id, C = ALL[2].id;
    /* saveProgress() нь localStorage-аас БУЦААЖ нэгтгэдэг (өөр табаас
       хамгаалах зориулалттай) тул зөвхөн хувьсагчийг тэглэхэд өмнөх
       тестүүдийн 42 үг эргэж ирдэг. Хадгалалтыг ч цэвэрлэнэ. */
    const rawP = localStorage.getItem(KEY_P);
    localStorage.removeItem(KEY_P);
    progress = {}; days = { last: -1, streak: 0, n: 0, ids: [] };
    // A-г ГУРВАН удаа алдаад дөрөв дэх удаад зөв; B, C нэг удаа зөв
    grade(A, false); grade(A, false); grade(A, false); grade(A, true);
    grade(B, true); grade(C, true);
    refreshStats();
    await new Promise(r => setTimeout(r, 200));
    const nums = [...document.querySelectorAll('#stat-sum b')].map(x => x.textContent.trim());
    const out = {
      seen: nums[0], learned: nums[1], pct: nums[2],
      answers: progress[A].n + progress[B].n + progress[C].n,
      goal: todayN()
    };
    progress = keepProg; days = keepDays;
    if (rawP === null) localStorage.removeItem(KEY_P);
    else localStorage.setItem(KEY_P, rawP);
    refreshStats(); show('home'); go('home');
    return out;
  `);
  ok('«үзсэн» нь ҮГИЙН тоо — 6 хариулт ч 3 үг',
    pcount && pcount.seen === '3' && pcount.answers === 6, JSON.stringify(pcount));
  ok('«тогтсон» нь ҮГИЙН тоо',
    pcount && pcount.learned === '0', JSON.stringify(pcount));
  ok('«зөв хариулт %» нь ХАРИУЛТААС бодогдоно (3/6)',
    pcount && pcount.pct === '50%', JSON.stringify(pcount));
  ok('өдрийн зорилт ч ҮГЭЭР — 3',
    pcount && pcount.goal === 3, JSON.stringify(pcount));

  console.log('\n[28] Нэр ба анги — хуурамч сервертэй');
  /* Сервер рүү ЖИНХЭНЭ хүсэлт явуулахгүй: `rpc`-г SQL-ийн дүрмийг яг
     дагадаг хуурамч хувилбараар сольно (SQL-ийг өөрөө `test_sql.js`
     бодит Postgres дээр шалгадаг). `isDevHost`-ийг ч солино — эс тэгвэл
     localhost дээр `memberSync` юу ч илгээхгүй.
     Тайлбарт BACKTICK бичихгүй — энэ бүхэл нь template literal. */
  await c.ev(`
    const F = window.__fake = {
      classes: { mica: { name: 'MICA', code: '5173' }, c2: { name: '2-р анги', code: '8264' } },
      members: {}, calls: [], offline: false,
    };
    window.__orig = { rpc: rpc, dev: isDevHost, me: JSON.parse(JSON.stringify(me)) };
    const chk = (c, k) => !F.classes[c] ? 'none'
      : (String(k || '').trim() === F.classes[c].code ? 'ok' : 'bad');
    rpc = async (fn, b) => {
      F.calls.push({ fn: fn, b: JSON.parse(JSON.stringify(b || {})) });
      if (F.offline) throw new Error('offline');
      if (fn === 'class_list') return Object.keys(F.classes).map(id => ({ id: id, name: F.classes[id].name }));
      if (fn === 'class_join') return chk(b.p_class, b.p_code);
      if (fn === 'member_put') {
        const res = {}, ok = [];
        for (const k in (b.p_classes || {})) { res[k] = chk(k, b.p_classes[k]); if (res[k] === 'ok') ok.push(k); }
        if (!ok.length || !String(b.p_name || '').trim()) delete F.members[b.p_member];
        else F.members[b.p_member] = { name: b.p_name, classes: ok, seen: b.p_seen,
          learned: b.p_learned, today: b.p_today, streak: b.p_streak, day: b.p_day };
        return res;
      }
      if (fn === 'class_roster') {
        const st = chk(b.p_class, b.p_code);
        if (st !== 'ok') return { status: st };
        const rows = Object.keys(F.members).filter(id => F.members[id].classes.includes(b.p_class))
          .map(id => Object.assign({ me: id === b.p_member }, F.members[id]))
          .sort((x, y) => y.learned - x.learned);
        rows.forEach(r => delete r.classes);
        return { status: 'ok', name: F.classes[b.p_class].name, rows: rows };
      }
      throw new Error('unknown ' + fn);
    };
    isDevHost = () => false;
    return 1;
  `);

  const wait = 'const wait = ms => new Promise(r => setTimeout(r, ms));';
  const k1 = await c.ev(wait + `
    const F = window.__fake, out = {};
    openSetup(false);
    await wait(300);
    const box = document.getElementById('su-classes');
    const tg = id => box.querySelector('.su-toggle[data-c="' + id + '"]');
    const code = id => document.querySelector('.su-code[data-c="' + id + '"]');
    const err = id => document.querySelector('.su-err[data-c="' + id + '"]');
    out.items = box.querySelectorAll('.su-toggle').length;
    out.names = [...box.querySelectorAll('.su-choice-name')].map(x => x.textContent);
    out.title = document.getElementById('su-title').textContent;
    out.cancelShown = !document.getElementById('su-cancel').hidden;
    out.otherBefore = document.getElementById('su-other').getAttribute('aria-pressed');
    out.boxHiddenBefore = getComputedStyle(code('mica').parentNode).display === 'none';

    tg('mica').click();
    out.otherAfterClass = document.getElementById('su-other').getAttribute('aria-pressed');
    out.boxShownAfter = getComputedStyle(code('mica').parentNode).display !== 'none';

    // Нэргүй -> хадгалахгүй
    document.getElementById('su-name').value = '  ';
    code('mica').value = '5173';
    await saveSetup();
    out.noName = document.getElementById('su-note').textContent;
    out.noNameInvalid = document.getElementById('su-name').getAttribute('aria-invalid');

    // Буруу код
    document.getElementById('su-name').value = 'Бат';
    code('mica').value = '0000';
    await saveSetup();
    out.wrongErr = err('mica').hidden ? '' : err('mica').textContent;
    out.wrongSaved = Object.keys(load(KEY_ME, {}).codes || {});
    out.stillSetup = screen;

    // Зөв код
    code('mica').value = '5173';
    await saveSetup();
    await wait(150);
    out.screen = screen;
    out.codes = me.codes;
    out.navShown = !document.getElementById('nav-klass').hidden;
    out.member = F.members[me.id] || null;
    out.meName = document.getElementById('me-name').textContent;
    out.meClasses = document.getElementById('me-classes').textContent;
    return out;
  `);
  ok('ангиуд СЕРВЕРИЙН нэрээр зурагдана (MICA, 2-р анги)',
    k1 && k1.items === 2 && k1.names.join('|') === 'MICA|2-р анги', JSON.stringify(k1));
  ok('засах үед гарчиг «Профайл засах», «Болих» харагдана',
    k1 && k1.title === 'Профайл засах' && k1.cancelShown, JSON.stringify(k1));
  ok('кодын талбар анги сонгох хүртэл НУУГДМАЛ, сонгоход гарна',
    k1 && k1.boxHiddenBefore && k1.boxShownAfter, JSON.stringify(k1));
  ok('анги сонгоход «Бусад» АВТОМАТААР унтарна',
    k1 && k1.otherBefore === 'true' && k1.otherAfterClass === 'false', JSON.stringify(k1));
  ok('нэргүй бол хадгалахгүй',
    k1 && /Нэрээ/.test(k1.noName) && k1.noNameInvalid === 'true', JSON.stringify(k1));
  ok('буруу код -> ангийн доор алдаа, ХАДГАЛАХГҮЙ',
    k1 && /буруу/.test(k1.wrongErr) && k1.wrongSaved.length === 0 && k1.stillSetup === 'setup',
    JSON.stringify(k1));
  ok('зөв код -> хадгалагдаж Тохиргоо руу буцна',
    k1 && k1.screen === 'profile' && k1.codes.mica === '5173', JSON.stringify(k1));
  ok('серверт НЭР ба тоотой бүртгэгдсэн',
    k1 && k1.member && k1.member.name === 'Бат' && k1.member.classes.join() === 'mica',
    JSON.stringify(k1));
  ok('цэсэнд «Анги» гарч ирнэ', k1 && k1.navShown, JSON.stringify(k1));
  ok('Тохиргооны карт нэр ба ангийг харуулна',
    k1 && k1.meName === 'Бат' && k1.meClasses === 'MICA', JSON.stringify(k1));

  const k2 = await c.ev(wait + `
    const F = window.__fake, out = {}, t = today();
    F.members.memberB0001 = { name: 'Болд', classes: ['mica'], seen: 40, learned: 9, today: 4, streak: 2, day: t };
    F.members.memberS0001 = { name: 'Сараа', classes: ['mica'], seen: 5, learned: 1, today: 7, streak: 6, day: t - 5 };
    F.members.memberC0001 = { name: 'Цэцэг', classes: ['c2'], seen: 60, learned: 20, today: 8, streak: 3, day: t - 1 };
    F.members.memberX0001 = { name: '<img src=x onerror="window.__xss=1">', classes: ['mica'],
      seen: 0, learned: 0, today: 0, streak: 0, day: t };

    // Хоёр дахь ангид НЭМЖ элсэнэ
    openSetup(false);
    await wait(300);
    document.querySelector('#su-classes .su-toggle[data-c="c2"]').click();
    document.querySelector('.su-code[data-c="c2"]').value = '8264';
    await saveSetup();
    await wait(150);
    out.codes = Object.keys(me.codes).sort();

    go('klass');
    await wait(500);
    const secs = [...document.querySelectorAll('#kl-list .kl-class')];
    out.secs = secs.map(s => ({
      title: s.querySelector('h3 span').textContent,
      count: s.querySelector('h3 small').textContent,
      rows: [...s.querySelectorAll('.kl-member')].map(li => ({
        name: li.querySelector('.kl-name b').textContent,
        me: li.classList.contains('me'),
        v: [...li.querySelectorAll('dd')].map(d => d.firstChild.textContent)
      }))
    }));
    out.xss = !!window.__xss;
    out.imgs = document.querySelectorAll('#kl-list img').length;
    out.note = document.getElementById('kl-note').textContent;
    return out;
  `);
  const sec = (t) => k2 && k2.secs.find(s => s.title === t);
  const row = (t, n) => sec(t) && sec(t).rows.find(r => r.name === n);
  ok('ХОЁР ангид зэрэг элссэн', k2 && k2.codes.join() === 'c2,mica', JSON.stringify(k2 && k2.codes));
  ok('ангийн дэлгэц хоёр ангийг хоёуланг харуулна',
    k2 && k2.secs.length === 2 && sec('MICA') && sec('2-р анги'), JSON.stringify(k2));
  ok('анги бүр ЗӨВХӨН өөрийн гишүүдтэй (Цэцэг MICA-д БАЙХГҮЙ)',
    sec('MICA') && !row('MICA', 'Цэцэг') && row('2-р анги', 'Цэцэг'), JSON.stringify(k2));
  ok('тогтсоноор эрэмбэлэгдсэн (Болд 9 эхэнд)',
    sec('MICA') && sec('MICA').rows[0].name === 'Болд', JSON.stringify(sec('MICA')));
  ok('өөрийн мөр тэмдэглэгдсэн (ГАНЦ)',
    sec('MICA') && sec('MICA').rows.filter(r => r.me).length === 1 && row('MICA', 'Бат').me,
    JSON.stringify(sec('MICA')));
  ok('өнөөдөр идэвхтэй: өнөөдөр 4, дараалан 2',
    row('MICA', 'Болд') && row('MICA', 'Болд').v.join() === '9,40,4,2', JSON.stringify(row('MICA', 'Болд')));
  ok('ӨЧИГДӨР идэвхтэй: өнөөдөр 0 (хуучин 8 БИШ), дараалан 3 хэвээр',
    row('2-р анги', 'Цэцэг') && row('2-р анги', 'Цэцэг').v.join() === '20,60,0,3',
    JSON.stringify(row('2-р анги', 'Цэцэг')));
  ok('5 хоногийн өмнө: өнөөдөр 0, дараалан 0 (тасарсан)',
    row('MICA', 'Сараа') && row('MICA', 'Сараа').v.join() === '1,5,0,0',
    JSON.stringify(row('MICA', 'Сараа')));
  ok('гишүүний тоо гарчигт', sec('MICA') && sec('MICA').count === '4 хүн', JSON.stringify(sec('MICA')));
  ok('нэр дэх HTML ГҮЙЦЭТГЭГДЭХГҮЙ (XSS)', k2 && !k2.xss && k2.imgs === 0, JSON.stringify(k2 && k2.xss));

  const k3 = await c.ev(wait + `
    const F = window.__fake, out = {};
    F.calls = [];
    openSetup(false);
    await wait(300);
    document.getElementById('su-other').click();
    out.classesAfterOther = [...document.querySelectorAll('#su-classes .su-toggle')]
      .filter(b => b.getAttribute('aria-pressed') === 'true').length;
    await saveSetup();
    await wait(150);
    const put = F.calls.filter(x => x.fn === 'member_put').pop();
    out.nameSent = put ? put.b.p_name : null;
    out.classesSent = put ? JSON.stringify(put.b.p_classes) : null;
    out.gone = !(me.id in F.members);
    out.navHidden = document.getElementById('nav-klass').hidden;
    out.other = me.other; out.codes = Object.keys(me.codes);
    out.meClasses = document.getElementById('me-classes').textContent;
    F.calls = [];
    lastMemberSync = 0;
    await memberSync(true);
    out.callsAfter = F.calls.length;
    return out;
  `);
  ok('«Бусад» дарахад БҮХ анги унтарна', k3 && k3.classesAfterOther === 0, JSON.stringify(k3));
  ok('«Бусад» руу шилжихэд серверийн мөр УСТАНА', k3 && k3.gone, JSON.stringify(k3));
  ok('устгах хүсэлтэд НЭР ИЛГЭЭГДЭХГҮЙ (хоосон)',
    k3 && k3.nameSent === '' && k3.classesSent === '{}', JSON.stringify(k3));
  ok('цэснээс «Анги» алга болно', k3 && k3.navHidden, JSON.stringify(k3));
  ok('Тохиргооны карт «Бусад»', k3 && k3.meClasses === 'Бусад' && k3.other, JSON.stringify(k3));
  ok('«Бусад» дараа нь сервер рүү ОГТ хүсэлт явахгүй', k3 && k3.callsAfter === 0, JSON.stringify(k3));

  const k4 = await c.ev(wait + `
    const F = window.__fake, out = {};
    // Дахин MICA-д элсээд, өөрчлөөгүй хадгалахад кодыг ДАХИН шалгахгүй
    openSetup(false); await wait(300);
    document.querySelector('#su-classes .su-toggle[data-c="mica"]').click();
    document.querySelector('.su-code[data-c="mica"]').value = '5173';
    await saveSetup(); await wait(150);
    F.calls = [];
    openSetup(false); await wait(300);
    await saveSetup(); await wait(150);
    out.joinsOnResave = F.calls.filter(x => x.fn === 'class_join').length;

    // Сүлжээ тасарсан үед шинэ анги нэмэх
    F.offline = true;
    openSetup(false); await wait(300);
    document.querySelector('#su-classes .su-toggle[data-c="c2"]').click();
    document.querySelector('.su-code[data-c="c2"]').value = '8264';
    await saveSetup();
    out.offNote = document.getElementById('su-note').textContent;
    out.offCodes = Object.keys(me.codes).sort().join();
    out.offScreen = screen;
    F.offline = false;

    // Багш кодоо сольсон
    F.classes.mica.code = '1111';
    go('klass'); await wait(500);
    out.afterChange = Object.keys(me.codes).join();
    out.changeNote = document.getElementById('kl-note').textContent;
    out.navHidden = document.getElementById('nav-klass').hidden;
    // Хаягдсан кодыг дахин ИЛГЭЭХГҮЙ (таах хязгаарыг бүгд хамтдаа дуусгахгүйн тулд)
    F.calls = []; lastMemberSync = 0;
    await memberSync(true);
    const put = F.calls.filter(x => x.fn === 'member_put').pop();
    out.resent = put ? Object.keys(put.b.p_classes || {}).join() : 'none';
    // Цэсэнд «Анги» алга болсон ч ТОХИРГООНЫ картаас шалтгааныг харна
    refreshMe();
    out.cardAfterChange = document.getElementById('me-classes').textContent;
    // Шинэ кодоор дахин элсэхэд мэдэгдэл арилна
    F.classes.mica.code = '4455';
    openSetup(false); await wait(300);
    document.querySelector('#su-classes .su-toggle[data-c="mica"]').click();
    document.querySelector('.su-code[data-c="mica"]').value = '4455';
    await saveSetup(); await wait(150);
    out.lostAfterRejoin = me.lost.slice();
    out.cardAfterRejoin = document.getElementById('me-classes').textContent;
    F.classes.mica.code = '5173';
    return out;
  `);
  ok('өөрчлөөгүй кодыг дахин шалгахгүй (таах хязгаар зарцуулахгүй)',
    k4 && k4.joinsOnResave === 0, JSON.stringify(k4));
  ok('сүлжээ алга -> хадгалахгүй, мэдэгдэнэ',
    k4 && /Сүлжээ/.test(k4.offNote) && k4.offCodes === 'mica' && k4.offScreen === 'setup',
    JSON.stringify(k4));
  ok('код солигдвол -> хуучин код ХАЯГДАНА, мэдэгдэнэ',
    k4 && k4.afterChange === '' && /солигдсон/.test(k4.changeNote), JSON.stringify(k4));
  ok('хаягдсан кодыг дахин ИЛГЭЭХГҮЙ', k4 && k4.resent !== 'mica', JSON.stringify(k4));
  ok('ангигүй болоход цэснээс «Анги» алга', k4 && k4.navHidden, JSON.stringify(k4));
  ok('Тохиргооны карт «код солигдсон» гэж хэлнэ (цэснээс алга болсон ч)',
    k4 && /MICA/.test(k4.cardAfterChange) && /код солигдсон/.test(k4.cardAfterChange),
    JSON.stringify(k4));
  ok('шинэ кодоор дахин элсэхэд мэдэгдэл арилна',
    k4 && k4.lostAfterRejoin.length === 0 && k4.cardAfterRejoin === 'MICA', JSON.stringify(k4));

  /* Нэр серверт солигдоход (2-р анги -> Наран) КЭШ шинэчлэгдэх ёстой.
     Урьд нь зөвхөн тохируулах дэлгэц нээхэд шинэчлэгддэг байсан тул
     аль хэдийн элссэн сурагч хуучин нэрийг үүрд хардаг байв. */
  const k5 = await c.ev(wait + `
    const F = window.__fake, out = {};
    me.codes = { mica: '5173', c2: '8264' }; me.lost = []; me.other = false; save(KEY_ME, me);
    classList = [{ id: 'mica', name: 'MICA' }, { id: 'c2', name: '2-р анги' }];
    save(KEY_CLS, classList);
    F.classes.c2.name = 'Наран';
    refreshMe();
    out.before = document.getElementById('me-classes').textContent;
    // (1) Апп нээгдэх үеийн шинэчлэл
    await refreshClassNames();
    out.afterBoot = document.getElementById('me-classes').textContent;
    out.cached = (load(KEY_CLS, []).find(x => x.id === 'c2') || {}).name;
    // (2) Ангийн дэлгэц серверийн нэрээр кэшээ засна
    classList = [{ id: 'mica', name: 'MICA' }, { id: 'c2', name: '2-р анги' }];
    save(KEY_CLS, classList); refreshMe();
    go('klass'); await wait(500);
    out.afterRoster = document.getElementById('me-classes').textContent;
    out.heading = [...document.querySelectorAll('#kl-list .kl-class h3 span')].map(x => x.textContent);
    F.classes.c2.name = '2-р анги';
    return out;
  `);
  ok('шинэчлэхээс өмнө хуучин нэр (тестийн нөхцөл зөв)',
    k5 && /2-р анги/.test(k5.before), JSON.stringify(k5));
  ok('апп нээгдэхэд ангийн нэр серверээс шинэчлэгдэнэ',
    k5 && k5.afterBoot === 'MICA · Наран' && k5.cached === 'Наран', JSON.stringify(k5));
  ok('ангийн дэлгэц серверийн нэрээр кэшийг засна',
    k5 && k5.afterRoster === 'MICA · Наран' && k5.heading.includes('Наран'), JSON.stringify(k5));

  await c.ev(`
    rpc = window.__orig.rpc; isDevHost = window.__orig.dev;
    me = cleanMe(window.__orig.me); save(KEY_ME, me); refreshMe();
    show('home'); go('home');
    return 1;
  `);

  console.log('\n[33] Шалгалт хэсэг — АВТОМАТААР ЭХЛЭХГҮЙ');
  /* Хэрэглэгчийн шийдвэр: «Шалгалт» руу орвол тохиргоо гарна.
     Даалгаврыг нүүрний картаас нэг дарлагаар эхлүүлнэ.
     Сүлжээг ХААНА: examSetup нь loadClassList дууддаг тул жинхэнэ
     серверийн даалгавар тестийн нөхцлийг дардаг (§2.65).
     Тайлбарт BACKTICK бичихгүй — энэ бүхэл нь template literal. */
  const au = await c.ev(`
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const keep = { cls: classList, hist: exHist, me: JSON.parse(JSON.stringify(me)),
                   les: exLes, n: exN, rpc: rpc, dev: isDevHost };
    rpc = async fn => (fn === 'class_list' ? classList : null);
    isDevHost = () => true;
    const out = {}, t = today();
    const iso = d => new Date(d * 864e5).toISOString().slice(0, 10);
    const TASK = { lessons: [1, 2, 3], n: 10, since: iso(t - 1), until: iso(t + 3) };
    me.codes = { mica: '1111' }; me.teach = {}; me.other = false; me.done = true; save(KEY_ME, me);
    classList = [{ id: 'mica', name: 'MICA', task: TASK }]; save(KEY_CLS, classList);
    exHist = {}; save(KEY_EXH, exHist);
    exLes = [18]; save(KEY_EXL, exLes); exN = 15;

    // (1) Дуусгаагүй даалгавартай ч ТОХИРГОО гарна — шууд эхлэхгүй
    go('exam'); await wait(900);
    out.setupShown = !document.getElementById('ex-setup').hidden;
    out.runHidden = document.getElementById('ex-run').hidden;
    out.keptLes = JSON.stringify(examLessonsSel());
    out.keptN = exN;

    // (2) НҮҮРНИЙ картын товч — ШУУД асуулт эхэлнэ
    go('home'); await wait(400);
    document.querySelector('#home-tasks .ex-task-pick').click();
    await wait(900);
    out.started = !document.getElementById('ex-run').hidden;
    out.screen = screen;
    out.qs = exQs.length;
    out.onlyTask = exQs.every(q => [1, 2, 3].includes(q.lesson));
    out.n = exN;

    exAbort();
    classList = keep.cls; save(KEY_CLS, classList);
    exHist = keep.hist; save(KEY_EXH, exHist);
    me = cleanMe(keep.me); save(KEY_ME, me);
    exLes = keep.les; save(KEY_EXL, exLes); exN = keep.n;
    rpc = keep.rpc; isDevHost = keep.dev;
    refreshMe(); go('home');
    return out;
  `);
  ok('«Шалгалт» руу орвол ТОХИРГОО гарна (автоматаар эхлэхгүй)',
    au && au.setupShown && au.runHidden, JSON.stringify(au));
  ok('хэсэг рүү орох нь хичээлийн сонголтыг ХӨНДӨХГҮЙ',
    au && au.keptLes === '[18]' && au.keptN === 15, JSON.stringify(au));
  ok('нүүрний картын товч ШУУД асуулт эхлүүлнэ',
    au && au.started && au.screen === 'exam', JSON.stringify(au));
  ok('багшийн сонгосон хичээл ба тоогоор (L1–L3, 10 асуулт)',
    au && au.qs === 10 && au.onlyTask && au.n === 10, JSON.stringify(au));

  console.log('\n[32] Багш — тусдаа код, даалгавар тавих, хугацаа');
  /* Багш тусдаа кодтой: жагсаалтыг харах ба даалгавар тавих эрхтэй,
     гэхдээ жагсаалтад ОРОХГҮЙ, нэр нь серверт очихгүй.
     Тайлбарт BACKTICK бичихгүй — энэ бүхэл нь template literal. */
  const tc = await c.ev(`
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const out = {};
    const keep = { rpc: rpc, dev: isDevHost, me: JSON.parse(JSON.stringify(me)),
                   cls: classList, hist: exHist };
    const F = { task: null, calls: [], members: { s1: { name: 'Сараа', classes: ['mica'], exam: {} } } };
    const chk = (c, k) => c !== 'mica' ? 'none'
      : (k === '5173' ? 'ok' : (k === '246802' ? 'teacher' : 'bad'));
    rpc = async (fn, b) => {
      F.calls.push({ fn: fn, b: JSON.parse(JSON.stringify(b || {})) });
      if (fn === 'class_list') return [{ id: 'mica', name: 'MICA', task: F.task }];
      if (fn === 'class_join') return chk(b.p_class, b.p_code);
      if (fn === 'member_put') {
        const res = {};
        for (const k in (b.p_classes || {})) res[k] = chk(k, b.p_classes[k]);
        return res;
      }
      if (fn === 'class_roster') {
        const st = chk(b.p_class, b.p_code);
        if (st !== 'ok' && st !== 'teacher') return { status: st };
        return { status: 'ok', role: st, name: 'MICA', task: F.task,
                 rows: [{ name: 'Сараа', seen: 1, learned: 1, today: 0, streak: 0, day: today(),
                          me: false, task_n: F.task ? 5 : null, task_ok: 0 }] };
      }
      if (fn === 'task_set') {
        if (b.p_tcode !== '246802') return { status: 'denied' };
        if (!b.p_lessons || !b.p_lessons.length) { F.task = null; return { status: 'ok', task: null }; }
        const until = new Date(Date.parse(b.p_since) + b.p_days * 864e5).toISOString().slice(0, 10);
        F.task = { lessons: b.p_lessons, n: b.p_n, days: b.p_days, since: b.p_since, until: until };
        return { status: 'ok', task: F.task };
      }
      return null;
    };
    isDevHost = () => false;
    me.codes = {}; me.teach = {}; me.other = false; me.done = true; me.name = 'Багш';
    me.lost = []; save(KEY_ME, me);
    classList = [{ id: 'mica', name: 'MICA', task: null }]; save(KEY_CLS, classList);

    // (1) Тохируулах дэлгэцэд БАГШИЙН код
    openSetup(false); await wait(400);
    document.getElementById('su-name').value = 'Багш';
    document.querySelector('#su-classes .su-toggle[data-c="mica"]').click();
    document.querySelector('.su-code[data-c="mica"]').value = '246802';
    await saveSetup(); await wait(200);
    out.teach = JSON.stringify(me.teach);
    out.codes = JSON.stringify(me.codes);
    out.navShown = !document.getElementById('nav-klass').hidden;
    out.card = document.getElementById('me-classes').textContent;
    const put = F.calls.filter(x => x.fn === 'member_put').pop();
    out.putClasses = put ? JSON.stringify(put.b.p_classes) : 'none';
    out.putName = put ? put.b.p_name : 'none';

    // (2) Ангийн дэлгэц — багшийн самбар
    go('klass'); await wait(700);
    out.badge = !!document.querySelector('.kl-teach .kl-badge');
    out.editLabel = (document.querySelector('.kl-task-edit') || {}).textContent;
    out.formHidden = document.querySelector('.kl-form').hidden;
    out.meRow = document.querySelectorAll('#kl-list .kl-member').length;   // зөвхөн Сараа
    document.querySelector('.kl-task-edit').click();
    await wait(200);
    out.formOpen = !document.querySelector('.kl-form').hidden;
    out.chips = document.querySelectorAll('.kl-les button').length;

    // (3) Хичээл, тоо, хоног сонгоно
    const chips = [...document.querySelectorAll('.kl-les button')];
    chips[0].click(); chips[1].click();
    document.querySelector('.kl-n button[data-n="15"]').click();
    document.querySelector('.kl-days button[data-d="3"]').click();
    out.due = document.querySelector('.kl-due').textContent.trim();
    out.dueWant = 'Дуусах: ' + isoOf(today() + 3);

    // (4) Хадгална
    F.calls = [];
    document.querySelector('.kl-save').click();
    await wait(600);
    const ts = F.calls.filter(x => x.fn === 'task_set').pop();
    out.sent = ts ? JSON.stringify([ts.b.p_lessons, ts.b.p_n, ts.b.p_days, ts.b.p_since]) : 'none';
    out.sentCode = ts ? ts.b.p_tcode : 'none';
    out.taskLine = (document.querySelector('.kl-teach .kl-task span') || {}).textContent;
    out.editLabel2 = (document.querySelector('.kl-task-edit') || {}).textContent;
    out.delShown = !document.querySelector('.kl-del').hidden;
    out.deadline = (document.querySelector('.kl-teach .task-deadline') || {}).textContent;

    // (5) Хугацаа дууссан бол тоолол ЗОГСОНО
    const past = { lessons: [1], n: 20, since: isoOf(today() - 10), until: isoOf(today() - 1) };
    exHist = { Q1: [today() - 5, 1, 1], Q2: [today(), 1, 1] };   // нэг нь дотор, нэг нь ДАРАА
    out.doneInWindow = taskDoneLocal(past);
    out.dueExpired = taskDue(past).text;
    out.dueToday = taskDue({ lessons: [1], n: 5, since: isoOf(today()), until: isoOf(today()) }).text;

    // (6) Даалгавар устгана
    F.calls = [];
    window.confirm = () => true;
    document.querySelector('.kl-task-edit').click(); await wait(150);
    document.querySelector('.kl-del').click();
    await wait(600);
    const td = F.calls.filter(x => x.fn === 'task_set').pop();
    out.delSent = td ? JSON.stringify(td.b.p_lessons) : 'none';
    out.taskGone = (document.querySelector('.kl-teach .kl-task span') || {}).textContent;

    rpc = keep.rpc; isDevHost = keep.dev; me = cleanMe(keep.me); save(KEY_ME, me);
    classList = keep.cls; save(KEY_CLS, classList); exHist = keep.hist; save(KEY_EXH, exHist);
    refreshMe(); go('home');
    return out;
  `);
  ok('багшийн код нь `teach`-д, `codes`-д ОРОХГҮЙ (гишүүн биш)',
    tc && tc.teach === '{"mica":"246802"}' && tc.codes === '{}', JSON.stringify(tc));
  /* Багш гишүүн биш тул `memberSync` огт сүлжээ дуудахгүй — нэр нь
     хоосон ч гэсэн илгээгдэхгүй. Хүлээснээс ч сайн. */
  ok('багшийн НЭР серверт ОГТ илгээгдэхгүй (member_put дуудагдаагүй)',
    tc && tc.putClasses === 'none', JSON.stringify(tc));
  ok('цэсэнд «Анги» гарна, картад «(багш)»',
    tc && tc.navShown && /багш/.test(tc.card), JSON.stringify(tc));
  ok('ангийн дэлгэцэд «Багш» самбар, маягт хаалттай',
    tc && tc.badge && tc.editLabel === 'Даалгавар өгөх' && tc.formHidden === true, JSON.stringify(tc));
  ok('багш ЖАГСААЛТАД ОРООГҮЙ (зөвхөн Сараа)', tc && tc.meRow === 1, JSON.stringify(tc));
  ok('маягт нээгдэж 18 хичээлийн чип гарна',
    tc && tc.formOpen && tc.chips === 18, JSON.stringify(tc));
  ok('дуусах огноо = өнөөдөр + хоног', tc && tc.due === tc.dueWant, JSON.stringify(tc));
  ok('хадгалахад task_set зөв утгаар дуудагдана',
    tc && tc.sent === '[[1,2],15,3,"' + new Date(Date.now() - new Date().getTimezoneOffset() * 6e4)
      .toISOString().slice(0, 10) + '"]' && tc.sentCode === '246802', JSON.stringify(tc));
  ok('даалгавар харагдаж, товч «Засах» болно',
    tc && tc.taskLine === 'L1–L2 · 15 асуулт' && tc.editLabel2 === 'Засах' && tc.delShown,
    JSON.stringify(tc));
  ok('хугацаа харагдана («3 хоног үлдлээ»)', tc && /3 хоног үлдлээ/.test(tc.deadline), JSON.stringify(tc));
  ok('хугацаа дуусахад тоолол ЗОГСОНО (1, 2 биш)', tc && tc.doneInWindow === 1, JSON.stringify(tc));
  ok('хугацааны бичиг: дууссан / өнөөдөр дуусна',
    tc && tc.dueExpired === 'Хугацаа дууссан' && tc.dueToday === 'Өнөөдөр дуусна', JSON.stringify(tc));
  ok('устгахад хоосон хичээл илгээгдэж даалгавар алга болно',
    tc && tc.delSent === '[]' && tc.taskGone === 'Даалгавар алга', JSON.stringify(tc));

  console.log('\n[31] Утас + компьютер = ангид НЭГ нэр');
  /* Урьд нь гишүүний id төхөөрөмж тутамд санамсаргүй байсан тул нэг хүн
     жагсаалтад ХОЁР удаа гардаг байв. Одоо СИНКИЙН КОДООС гаргана —
     хоёр төхөөрөмж ижил кодтой бол ижил id. */
  const one = await c.ev(`
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const out = {}, keep = { rpc: rpc, dev: isDevHost, me: JSON.parse(JSON.stringify(me)), code: syncCode };
    const F = { rows: {}, calls: [] };
    rpc = async (fn, b) => {
      F.calls.push({ fn: fn, m: b.p_member, name: b.p_name });
      if (fn === 'member_put') {
        if (!Object.keys(b.p_classes || {}).length || !b.p_name) delete F.rows[b.p_member];
        else F.rows[b.p_member] = b.p_name;
        return { mica: 'ok' };
      }
      if (fn === 'class_list') return [{ id: 'mica', name: 'MICA', task: null }];
      if (fn === 'class_roster') return { status: 'ok', name: 'MICA', task: null, rows: [] };
      return null;
    };
    isDevHost = () => false;
    me.codes = { mica: '1111' }; me.other = false; me.name = 'Бат'; me.done = true;
    me.sent = ''; me.syncId = ''; me.syncFor = ''; save(KEY_ME, me);

    // (1) Синкгүй -> ТӨХӨӨРӨМЖИЙН id
    syncCode = null;
    await deriveMember();
    out.noSync = memberKey === me.id;

    // (2) Утас: код холбоно
    syncCode = 'aaaa-bbbb-cccc';
    me.syncId = ''; me.syncFor = '';
    await deriveMember();
    out.k1 = memberKey;
    out.derived = memberKey !== me.id;

    // (3) Компьютер: ӨӨР төхөөрөмж (өөр me.id), ИЖИЛ код
    const phoneId = me.id;
    me.id = 'zzz' + Math.random().toString(36).slice(2, 12);
    me.syncId = ''; me.syncFor = '';
    await deriveMember();
    out.k2 = memberKey;
    out.same = out.k1 === out.k2;
    out.notDeviceId = memberKey !== me.id && memberKey !== phoneId;
    out.codeNotSent = memberKey.indexOf('aaaa') < 0;   // код түүхийгээр ОРООГҮЙ

    // (4) Тогтмол: кэш цэвэрлээд дахин гаргахад ИЖИЛ
    me.syncId = ''; me.syncFor = '';
    await deriveMember();
    out.stable = memberKey === out.k1;

    // (5) id солигдоход ХУУЧИН мөр устана
    F.rows = { oldmember0001: 'Бат' };
    me.sent = 'oldmember0001'; save(KEY_ME, me);
    F.calls = []; lastMemberSync = 0;
    await memberSync(true);
    await wait(100);
    out.oldGone = !('oldmember0001' in F.rows);
    out.newRow = F.rows[memberKey] === 'Бат';
    out.rowCount = Object.keys(F.rows).length;
    out.delCall = F.calls.some(x => x.fn === 'member_put' && x.m === 'oldmember0001' && x.name === '');
    out.sentSaved = load(KEY_ME, {}).sent === memberKey;

    // (6) Хоёр дахь синк ДАВХАР мөр үүсгэхгүй
    F.calls = []; lastMemberSync = 0;
    await memberSync(true);
    out.rowCount2 = Object.keys(F.rows).length;
    out.noDelSecond = !F.calls.some(x => x.fn === 'member_put' && x.name === '');

    // (7) Ангийн жагсаалт өөрийг нь таних id-гаар дуудагдана
    F.calls = []; await refreshKlass(); await wait(200);
    const rq = F.calls.find(x => x.fn === 'class_roster');
    out.rosterMember = rq ? rq.m : null;

    rpc = keep.rpc; isDevHost = keep.dev; me = cleanMe(keep.me); save(KEY_ME, me);
    syncCode = keep.code; await deriveMember(); refreshMe(); go('home');
    return out;
  `);
  /* `2026-09-23c`-ээс ӨМНӨ бүртгүүлсэн хүнд `sent` талбар байхгүй.
     Хоосон орхивол синк холбоход хуучин мөр ангид ҮҮРД үлдэнэ
     (бодит тохиолдол: «Өлзийбаяр» ба «Admin» хоёр мөр). */
  const mig = await c.ev(`
    const old = { id: 'abcdefgh12345678', name: 'Бат', codes: { mica: '1111' }, done: true };
    const a = cleanMe(old);
    const b = cleanMe({ id: 'abcdefgh12345678', name: 'Бат', codes: {}, other: true });
    const c2 = cleanMe(Object.assign({}, old, { sent: 'zzzzzzzz99999999' }));
    return { withClass: a.sent, noClass: b.sent, explicit: c2.sent };
  `);
  ok('хуучин суулгац: ангид элссэн бол `sent` нь `id`-гаар нөхөгдөнө',
    mig && mig.withClass === 'abcdefgh12345678', JSON.stringify(mig));
  ok('ангигүй хүнд нөхөхгүй (дэмий устгал явуулахгүй)',
    mig && mig.noClass === '', JSON.stringify(mig));
  ok('байгаа `sent`-ийг дарж бичихгүй',
    mig && mig.explicit === 'zzzzzzzz99999999', JSON.stringify(mig));

  /* Нэр нь төхөөрөмж тус бүрд хадгалагддаг тул нөгөө дээрээ зассаныг
     энэ талдаа мэдэхгүй байв. Сервер хүчинтэй нэрийг буцаана — клиент
     түүнийг аваад тавина. Тайлбарт BACKTICK бичихгүй. */
  const nm = await c.ev(`
    const keep = { rpc: rpc, dev: isDevHost, me: JSON.parse(JSON.stringify(me)) };
    const F = { calls: [] };
    rpc = async (fn, b) => {
      F.calls.push({ fn: fn, b: b });
      if (fn === 'member_put') return { mica: 'ok', name: 'Өлзийбаяр',
        // Нөгөө төхөөрөмж дээр хийсэн даалгавар — сервер УУСГААД буцаана
        exam: { S01: [today(), 1, 1], S02: [today(), 0, 2] } };
      return null;
    };
    isDevHost = () => false;
    me.codes = { mica: '1111' }; me.teach = {}; me.other = false; me.done = true;
    me.name = 'Admin'; me.nameAt = 1234; me.sent = ''; save(KEY_ME, me);
    exHist = {}; save(KEY_EXH, exHist);
    lastMemberSync = 0;
    await memberSync(true);
    await new Promise(r => setTimeout(r, 100));
    const sent = F.calls.filter(x => x.fn === 'member_put').pop();
    const out = {
      adopted: me.name,
      saved: load(KEY_ME, {}).name,
      sentAt: sent ? sent.b.p_name_at : null,
      srv: JSON.stringify(me.srv),
      card: document.getElementById('me-classes').textContent,
      exam: Object.keys(exHist).sort().join(),
      examSaved: Object.keys(load(KEY_EXH, {})).sort().join(),
    };
    exHist = {}; save(KEY_EXH, exHist);
    rpc = keep.rpc; isDevHost = keep.dev; me = cleanMe(keep.me); save(KEY_ME, me);
    refreshMe();
    return out;
  `);
  ok('нөгөө төхөөрөмж дээр зассан нэрийг АВЧ тавина',
    nm && nm.adopted === 'Өлзийбаяр' && nm.saved === 'Өлзийбаяр', JSON.stringify(nm));
  ok('нэр зассан цагийг серверт илгээнэ', nm && nm.sentAt === 1234, JSON.stringify(nm));
  ok('`name`, `exam` нь ангийн жагсаалтад ОРОХГҮЙ', nm && nm.srv === '["mica"]', JSON.stringify(nm));
  /* Нөгөө төхөөрөмж дээр хийсэн даалгавар энд ч тоологдох ёстой —
     эс тэгвэл утас «0/20» гэж харуулаад, дараагийн синкдээ серверийн
     20 хариултыг ДАРЖ УСТГАНА (бодит алдаа). */
  ok('серверээс ирсэн шалгалтын хариулт нэгдэнэ',
    nm && nm.exam === 'S01,S02' && nm.examSaved === 'S01,S02', JSON.stringify(nm));

  ok('синкгүй бол ТӨХӨӨРӨМЖИЙН id', one && one.noSync, JSON.stringify(one));
  ok('синктэй бол кодоос гаргасан id', one && one.derived, JSON.stringify(one));
  ok('ИЖИЛ кодтой хоёр төхөөрөмж -> ИЖИЛ id (нэг нэр)',
    one && one.same && one.notDeviceId, JSON.stringify(one));
  ok('синкийн код id дотор ТҮҮХИЙГЭЭР орохгүй (хэшлэгдсэн)',
    one && one.codeNotSent, JSON.stringify(one));
  ok('дахин гаргахад ИЖИЛ id (тогтмол)', one && one.stable, JSON.stringify(one));
  ok('id солигдоход ХУУЧИН мөр устана (давхар нэр үлдэхгүй)',
    one && one.oldGone && one.newRow && one.rowCount === 1 && one.delCall, JSON.stringify(one));
  ok('дараагийн синк дэмий устгал хийхгүй, мөр нэг хэвээр',
    one && one.rowCount2 === 1 && one.noDelSecond, JSON.stringify(one));
  ok('ангийн жагсаалт өөрийг нь ижил id-гаар таниулна',
    one && one.rosterMember && one.rosterMember === one.k1, JSON.stringify(one));

  console.log('\n[35] Даалгаврын төрөл — үг ба ханз');
  /* Шалгалтын хариултын түүх серверт байдаг тул түүнийг СЕРВЕР боддог.
     Үг/ханзны хувьд бүтэн түүх серверт байхгүй (4210 үг) тул КЛИЕНТ
     бодож илгээнэ. Тоолох арга: grade() нь p.d = today() + BOXES[p.b]
     гэж бичдэг тул p.d - BOXES[p.b] нь СҮҮЛД үзсэн өдөр.
     Тайлбарт BACKTICK бичихгүй — энэ бүхэл нь template literal. */
  const kd = await c.ev(`
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const keep = { rpc: rpc, dev: isDevHost, me: JSON.parse(JSON.stringify(me)),
                   cls: classList, prog: progress, raw: localStorage.getItem(KEY_P),
                   set: JSON.parse(JSON.stringify(settings)) };
    const out = {}, t = today();
    const iso = d => new Date(d * 864e5).toISOString().slice(0, 10);
    const F = { calls: [] };
    rpc = async (fn, b) => { F.calls.push({ fn: fn, b: b });
      return fn === 'class_list' ? classList : { mica: 'ok' }; };
    isDevHost = () => false;
    me.codes = { mica: '1111' }; me.teach = {}; me.other = false; me.done = true;
    me.name = 'Бат'; me.sent = ''; save(KEY_ME, me);

    const WTASK = { kind: 'word', src: 'book', lessons: [1, 2], n: 20,
                    since: iso(t - 2), until: iso(t + 3) };
    classList = [{ id: 'mica', name: 'MICA', task: WTASK, task_v: 'v1' }];
    save(KEY_CLS, classList);

    // Хичээл 1-2-оос 3 үг, хугацаанд нь үзсэн; 1 нь хугацаанаас ӨМНӨ;
    // 1 нь ӨӨР хичээлээс — тоологдох ёсгүй.
    localStorage.removeItem(KEY_P);
    progress = {};
    const pool = (bookCache.starter || ALL);
    const l12 = pool.filter(i => i.lesson === 1 || i.lesson === 2);
    const other = pool.filter(i => i.lesson === 5);
    const put = (item, day) => { progress[item.id] = { n: 1, c: 1, w: 0, b: 1, d: day + BOXES[1] }; };
    put(l12[0], t); put(l12[1], t - 1); put(l12[2], t - 2);
    put(l12[3], t - 9);            // хугацаанаас ӨМНӨ
    put(other[0], t);              // өөр хичээл
    out.word = taskDoneLocal(WTASK);
    out.label = taskLabel(WTASK);

    // ХАНЗ — хичээлийн ханз
    const KTASK = { kind: 'kanji', src: 'les', lessons: [1], n: 5,
                    since: iso(t - 2), until: iso(t + 3) };
    const kj = KANJI.filter(k => (k.l || []).includes(1));
    put(kj[0], t); put(kj[1], t - 1);
    out.kanji = taskDoneLocal(KTASK);
    out.kanjiLabel = taskLabel(KTASK);
    out.jlptLabel = taskLabel({ kind: 'kanji', src: 'jlpt', lessons: [5, 4], n: 30,
                                since: iso(t - 2) });

    // Серверт КЛИЕНТИЙН тоо явна
    F.calls = []; lastMemberSync = 0;
    await memberSync(true); await wait(150);
    const sent = F.calls.filter(x => x.fn === 'member_put').pop();
    out.sentTasks = sent ? JSON.stringify(sent.b.p_tasks) : 'none';

    // Нүүрний карт ба товч
    go('home'); await wait(400);
    out.card = document.querySelector('#home-tasks .ex-task-label').textContent.replace(/\\s+/g, ' ').trim();
    document.querySelector('#home-tasks .ex-task-pick').click();
    await wait(400);
    out.screen = screen;
    out.lesSet = JSON.stringify(settings.les.starter);

    // Шалгалтын самбарт ҮГИЙН даалгавар ГАРАХГҮЙ
    go('exam'); await wait(600);
    out.examBoxHidden = document.getElementById('ex-tasks').hidden;

    rpc = keep.rpc; isDevHost = keep.dev; me = cleanMe(keep.me); save(KEY_ME, me);
    classList = keep.cls; save(KEY_CLS, classList);
    progress = keep.prog; settings = keep.set; save(KEY_S, settings);
    if (keep.raw === null) localStorage.removeItem(KEY_P);
    else localStorage.setItem(KEY_P, keep.raw);
    exAbort(); refreshMe(); go('home');
    return out;
  `);
  ok('ҮГИЙН даалгавар: хугацаанд үзсэн 3 үг (өмнөх ба өөр хичээл ОРОХГҮЙ)',
    kd && kd.word === 3, JSON.stringify(kd));
  ok('ХАНЗНЫ даалгавар: хичээлийн ханзаас 2', kd && kd.kanji === 2, JSON.stringify(kd));
  ok('шошго нэгжээ зөв хэлнэ (үг · ханз · N түвшин)',
    kd && kd.label === 'L1–L2 · 20 үг' && kd.kanjiLabel === 'L1 · 5 ханз'
      && kd.jlptLabel === 'N5, N4 · 30 ханз', JSON.stringify(kd));
  ok('клиентийн тоо серверт хурууны хээтэй хамт явна',
    kd && kd.sentTasks === '{"mica":{"n":3,"v":"v1"}}', JSON.stringify(kd));
  ok('нүүрний карт ҮГ гэж бичнэ', kd && /MICA · L1–L2 · 20 үг/.test(kd.card), JSON.stringify(kd));
  ok('«Эхлүүлэх» нь Irodori дэлгэц рүү аваачиж хичээлийг тохируулна',
    kd && kd.screen === 'irodori' && kd.lesSet === '[1,2]', JSON.stringify(kd));
  ok('шалгалтын самбарт ҮГИЙН даалгавар гарахгүй',
    kd && kd.examBoxHidden === true, JSON.stringify(kd));


  console.log('\n[36] Эможи \u2192 \u6f22\u5b57 \u2014 \u0437\u04e9\u0432\u0445\u04e9\u043d JLPT');
  /* Эможи нь ханз бүрд ЦОРЫН ГАНЦ байх ёстой. Хоёр ханз ижил эможитой
     бол 4 сонголтын хоёр нь ч зөв мэт харагдаж, асуулт хариултгүй болно.
     Эможигүй ханз сандруулагчаар ч гарч болохгүй: 🐘 асуухад 象 гарвал
     сурагч зөвийг нь дараад «буруу» гэж авна.
     Тайлбарт BACKTICK бичихгүй — энэ бүхэл нь template literal. */
  const em = await c.ev(`
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const keep = { kjn: settings.kjn.slice(), prog: progress };
    const out = {};
    out.withE = KANJI.filter(k => k.e).length;
    const seen = {}; let dup = 0;
    for (const k of KANJI) if (k.e) { if (seen[k.e]) dup++; seen[k.e] = 1; }
    out.dup = dup;

    settings.kjn = [5]; save(KEY_S, settings);
    go('jlpt'); await wait(250);
    out.btnHidden = document.getElementById('kj-emoji').hidden;
    out.btnN = document.getElementById('n-kjemoji').textContent;
    out.inIrodori = document.querySelectorAll('#wrap-kanji .mode[data-kj]').length;
    out.irodoriEmoji = document.querySelectorAll('#wrap-kanji .mode[data-kj="emoji"]').length;

    progress = {};
    const _a = window.alert; window.alert = m => { out.alerted = m; };
    document.querySelector('.mode[data-kj2="emoji"]').click();
    await wait(200);
    window.alert = _a;
    out.screen = screen; out.deck = deck; out.kmode = kmode;
    out.poolLen = pool.length;
    out.poolAllE = pool.every(k => k.e && k.n === 5);
    out.prompt = document.getElementById('p-main').textContent;
    out.cls = document.getElementById('p-main').className;
    out.promptIsEmoji = cur.e === out.prompt && !/[\u4e00-\u9fff]/.test(out.prompt);
    out.soundHidden = document.getElementById('btn-speak').hidden;

    const btns = [...document.querySelectorAll('#choices button')];
    out.nOpt = btns.length;
    out.optAllEmojiKanji = btns.every(b => KANJI.some(k => k.c === b.textContent && k.e));
    out.optHasAnswer = btns.some(b => b.textContent === cur.c);
    out.optUniq = new Set(btns.map(b => b.textContent)).size === btns.length;
    out.optEmojiUniq = new Set(btns.map(b =>
      (KANJI.find(k => k.c === b.textContent) || {}).e)).size === btns.length;

    const id = cur.id, want = cur.c, wantMn = cur.mn;
    btns.find(b => b.textContent === want).click();
    await wait(150);
    out.aKana = document.getElementById('a-kana').textContent;
    out.aMnOk = document.getElementById('a-mn').textContent === wantMn;
    out.answerShown = want === out.aKana;
    out.box = progress[id] ? progress[id].b : -1;

    // ХЭМЖЭЭ: ганц дүрс томоор (.one), 🌳🌳🌳 нь жижгээр — 360px-д багтана.
    // Картыг СОЛИХДОО queue-д түрүүлж тавина: nextCard нь cur-ыг queue-аас авдаг.
    const one = KANJI.find(k => k.e && !emojiWide(k.e));
    const wide = KANJI.find(k => k.e && emojiWide(k.e));
    queue.unshift(one); nextCard();
    out.clsOne = document.getElementById('p-main').className;
    queue.unshift(wide); nextCard();
    out.clsWide = document.getElementById('p-main').className;
    out.wideE = wide.e;
    out.zwj = emojiWide('\u{1F468}\u200D\u{1F373}');

    // Түвшин огт сонгоогүй бол товч ОГТ гарахгүй.
    show('home'); settings.kjn = []; save(KEY_S, settings);
    go('jlpt'); await wait(250);
    out.btnHiddenEmpty = document.getElementById('kj-emoji').hidden;

    settings.kjn = keep.kjn; save(KEY_S, settings);
    progress = keep.prog; go('home'); await wait(120);
    return out;
  `);
  ok('эможи ↔ ханз ачаалагдсан (100-аас олон)', em && em.withE > 100, JSON.stringify(em && em.withE));
  ok('ДАВХАРДСАН эможи АЛГА — хоёр ханз ижил дүрстэй байж болохгүй',
    em && em.dup === 0, JSON.stringify(em && em.dup));
  ok('JLPT дэлгэцэд «Эможи» товч гарна, тоогоо хэлнэ',
    em && em.btnHidden === false && /^\d+ ханз$/.test(em.btnN), JSON.stringify(em));
  ok('Irodori талд эможи горим БАЙХГҮЙ (зөвхөн JLPT)',
    em && em.inIrodori === 4 && em.irodoriEmoji === 0, JSON.stringify(em));
  ok('дасгал эхэлсэн, багц нь бүхэлдээ эможитой N5 ханз',
    em && em.screen === 'study' && em.deck === 'kanji' && em.kmode === 'emoji'
      && em.poolAllE && em.poolLen > 20 && !em.alerted, JSON.stringify(em));
  ok('асуулт нь ЭМОЖИ — ханз харагдахгүй',
    em && em.promptIsEmoji && /^prompt emoji( one)?$/.test(em.cls), JSON.stringify(em));
  ok('ганц дүрс ТОМ, олон дүрс ЖИЖИГ (360px-д багтах ёстой)',
    em && em.clsOne === 'prompt emoji one' && em.clsWide === 'prompt emoji',
    JSON.stringify(em));
  ok('ZWJ-ээр наалдсан 👨‍🍳 нь НЭГ дүрс гэж тоологдоно',
    em && em.zwj === false, JSON.stringify(em && em.zwj));
  ok('дуу товч НУУГДСАН — уншлага нь хариултыг задална',
    em && em.soundHidden === true, JSON.stringify(em));
  ok('4 сонголт, бүгд эможитой ханз, давхардалгүй',
    em && em.nOpt === 4 && em.optAllEmojiKanji && em.optUniq && em.optHasAnswer,
    JSON.stringify(em));
  ok('сонголтуудын ЭМОЖИ бас давхцахгүй — нэг нь л зөв',
    em && em.optEmojiUniq === true, JSON.stringify(em));
  ok('зөв дархад ханз ба утга гарч, явц бичигдэнэ',
    em && em.answerShown && em.aMnOk && em.box === 1, JSON.stringify(em));
  ok('түвшин сонгоогүй бол «Эможи» товч огт гарахгүй',
    em && em.btnHiddenEmpty === true, JSON.stringify(em));

  console.log('\n[37] Дизайны аудит — 5 согогийн засвар');
  /* Эдгээр нь БОДИТООР хэмжигдсэн согогууд (2026-09-23, Astra-гийн аудит):
     зөв хариулт 42% бүдэг, шалгалтын зураас 0px, зорилтын сонголт
     мэдэгдэхгүй, дууны товч 26x13px, бараан hover 2.77:1.
     Тайлбарт BACKTICK бичихгүй — энэ бүхэл нь template literal. */
  const d5 = await c.ev(`
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const out = {}, _a = window.alert;
    window.alert = () => {};

    // 1) Хариулсны дараа ЗӨВ (ба буруу) хариулт бүдгэрэхгүй
    startSession('choice', false, 'book');
    await wait(300);
    let btns = [...document.querySelectorAll('#choices button')];
    const right = btns.find(b => b.textContent === optText(cur));
    right.click(); await wait(400);
    const okB = document.querySelector('#choices button.correct');
    const restB = btns.find(b => !b.className.includes('correct'));
    out.okOpacity = getComputedStyle(okB).opacity;
    out.okDisabled = okB.disabled;
    out.restOpacity = getComputedStyle(restB).opacity;

    // Буруу хариулт ч тод үлдэнэ — алдаагаа харах хэрэгтэй
    document.getElementById('btn-next').click(); await wait(300);
    btns = [...document.querySelectorAll('#choices button')];
    const bad = btns.find(b => b.textContent !== optText(cur));
    bad.click(); await wait(400);
    const ngB = document.querySelector('#choices button.wrong');
    out.ngOpacity = ngB ? getComputedStyle(ngB).opacity : 'none';

    // 2) Шалгалтын явцын зураас ХАРАГДАНА
    show('home'); go('exam'); await wait(700);
    const eb = document.getElementById('btn-exam');
    if (eb && !eb.disabled) eb.click();
    await wait(800);
    const tr = document.querySelector('#exam .ex-top .track');
    const fl = document.getElementById('ex-bar');
    out.trackH = tr ? parseFloat(getComputedStyle(tr).height) : -1;
    out.trackBg = tr ? getComputedStyle(tr).backgroundColor : 'none';
    out.fillBg = fl ? getComputedStyle(fl).backgroundColor : 'none';
    exAbort(); show('home');

    // 3) Өдрийн зорилтын сонгосон товч ЯЛГАРНА
    go('profile'); await wait(500);
    const gb = [...document.querySelectorAll('#goal-pick button')];
    const sig = e => { const st = getComputedStyle(e);
      return [st.backgroundColor, st.color, st.borderColor, st.fontWeight].join('|'); };
    const onB = gb.find(b => b.getAttribute('aria-pressed') === 'true');
    const offB = gb.find(b => b.getAttribute('aria-pressed') !== 'true');
    out.goalDiffers = !!(onB && offB) && sig(onB) !== sig(offB);

    // 4) Дууны товчны дарах талбай
    show('home'); startKanji('k2m', 'jlpt'); await wait(300);
    // ХҮЛЭЭЛТ: .card.flip нь 0.5s rotateY. Дундуур нь хэмжвэл өргөн нь
    // шахагдаж 4px гарч ирнэ — бодит алдаа биш, тестийн алдаа болно.
    reveal(); await wait(800);
    const rs = [...document.querySelectorAll('.a-kj .rsp')].map(x => x.getBoundingClientRect());
    out.rspN = rs.length;
    out.rspW = rs.length ? Math.round(Math.min(...rs.map(r => r.width))) : -1;
    out.rspH = rs.length ? Math.round(Math.min(...rs.map(r => r.height))) : -1;
    out.rspOverlap = rs.filter((r, i) => i && r.top < rs[i - 1].bottom - 0.5).length;
    show('home');

    // 5) Гол товчны hover — контраст ба ӨӨРЧЛӨГДӨХ эсэх (хоёр сэдэвт)
    const probe = document.createElement('div');
    document.body.appendChild(probe);
    const rgbOf = v => { probe.style.color = ''; probe.style.color = v;
                         return getComputedStyle(probe).color; };
    const lum = c2 => { const m = c2.match(/[0-9.]+/g).slice(0, 3).map(Number)
        .map(x => x / 255)
        .map(x => x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4));
      return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; };
    const ratio = (a, b) => { const la = lum(rgbOf(a)), lb = lum(rgbOf(b));
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
    // .primary:hover ДҮРЭМ өөрөө юу хэрэглэж байгааг уншина — токеныг
    // шалгах нь хангалтгүй: дүрмийг нь буцааж хуучин өнгө рүү сольсон ч
    // токен байрандаа үлдэж, тест хууртагдана (сөрөг тестээр илрэв).
    // BACKTICK бичихгүй — энэ бүхэл нь template literal (docs §2.57).
    let hoverBg = '';
    for (const sh of document.styleSheets) {
      let rules = null; try { rules = sh.cssRules; } catch (e) { continue; }
      for (const r of rules)
        if (r.selectorText === '.primary:hover')
          hoverBg = r.style.backgroundColor || r.style.background;
    }
    out.hoverRule = hoverBg;
    const root = document.documentElement;
    const keepTheme = root.getAttribute('data-theme');
    const theme = {};
    for (const t of ['light', 'dark']) {
      root.setAttribute('data-theme', t);
      theme[t] = { cr: Math.round(ratio(hoverBg, 'var(--btn-fg)') * 100) / 100,
                   moves: rgbOf(hoverBg) !== rgbOf('var(--btn-bg)') };
    }
    if (keepTheme) root.setAttribute('data-theme', keepTheme);
    else root.removeAttribute('data-theme');
    probe.remove();
    out.theme = theme;

    // Бараан токен ХОЁР блокт давхардана (media + data-theme) — гурвуулаа
    const css = await fetch('app.css?t=' + Date.now()).then(r => r.text());
    out.hovDecls = (css.match(/--btn-hov:/g) || []).length;

    window.alert = _a; go('home');
    return out;
  `);
  ok('ЗӨВ хариулт бүдгэрэхгүй (disabled боловч бүрэн тод)',
    d5 && d5.okOpacity === '1' && d5.okDisabled === true, JSON.stringify(d5));
  ok('БУРУУ хариулт ч тод — алдаагаа харах ёстой',
    d5 && d5.ngOpacity === '1', JSON.stringify(d5));
  ok('сонгоогүй үлдсэн сонголт л бүдгэрнэ',
    d5 && parseFloat(d5.restOpacity) < 0.6, JSON.stringify(d5));
  ok('шалгалтын явцын зураас ХАРАГДАНА (өндөр > 0, дэвсгэртэй)',
    d5 && d5.trackH >= 3 && d5.trackBg !== 'rgba(0, 0, 0, 0)', JSON.stringify(d5));
  ok('зураасны дүүргэлт өнгөтэй', d5 && d5.fillBg !== 'rgba(0, 0, 0, 0)', JSON.stringify(d5));
  ok('өдрийн зорилтын СОНГОСОН товч ялгарна', d5 && d5.goalDiffers === true, JSON.stringify(d5));
  ok('дууны товчны дарах талбай томорсон (>= 36x30)',
    d5 && d5.rspN >= 2 && d5.rspW >= 36 && d5.rspH >= 30, JSON.stringify(d5));
  ok('дууны товчнууд ДАВХЦАХГҮЙ — буруу мөрийн дуу гарахгүй',
    d5 && d5.rspOverlap === 0, JSON.stringify(d5));
  ok('гол товчны hover нь өнгөө СОЛИНО (хоёр сэдэвт)',
    d5 && d5.theme && d5.theme.light.moves && d5.theme.dark.moves, JSON.stringify(d5 && d5.theme));
  ok('hover дээрх бичиг AA давна (>= 4.5:1, хоёр сэдэвт)',
    d5 && d5.theme && d5.theme.light.cr >= 4.5 && d5.theme.dark.cr >= 4.5,
    JSON.stringify(d5 && d5.theme));
  ok('--btn-hov гурван блок бүрд (цайвар + бараан 2) — нэгийг нь мартаагүй',
    d5 && d5.hovDecls === 3, JSON.stringify(d5 && d5.hovDecls));

  console.log('\n[38] Дүрмийн дасгал — тайлбар + 20 дасгал');
  /* Шалгалт нь ЧӨЛӨӨТ хариулттай (сурагч өөрөө үнэлнэ), дүрмийн дасгал нь
     4 СОНГОЛТТОЙ тул апп өөрөө дүгнэнэ. Тиймээс энд дүгнэлт, хадгалалт,
     алдсаны жагсаалт гурвыг бодитоор ажиллуулж шалгана.
     Тайлбарт BACKTICK бичихгүй — энэ бүхэл нь template literal. */
  const gr = await c.ev(`
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const out = {}, keep = localStorage.getItem('irodori.grammar.v1');
    localStorage.removeItem('irodori.grammar.v1');
    grStat = {};

    // ── Өгөгдлийн БҮРЭН БАЙДАЛ ──
    const pts = await loadGrammar();
    out.n = pts.length;
    out.drills = pts.reduce((a, p) => a + p.drills.length, 0);
    out.each20 = pts.every(p => p.drills.length === 20);
    out.hasText = pts.every(p => p.mn.length > 120 && p.ex.length >= 3);
    const kanji = /[\u3400-\u9fff]/;
    out.kanaClean = pts.every(p => p.drills.every(d => !kanji.test(d.kana))
                                && p.ex.every(e => !kanji.test(e.kana)));
    out.optsOk = pts.every(p => p.drills.every(d =>
      d.opts.length === 4 && new Set(d.opts).size === 4
      && d.a >= 0 && d.a < 4));
    out.blankOk = pts.every(p => p.drills.every(d => d.jp.indexOf('＿') >= 0));

    // ── Жагсаалт ──
    go('grammar'); await wait(700);
    out.screen = screen;
    out.listN = document.querySelectorAll('#gr-list button').length;
    out.homeN = document.getElementById('n-gram').textContent;

    // ── Тайлбар ──
    document.querySelector('#gr-list button').click(); await wait(250);
    out.readShown = !document.getElementById('gr-read').hidden;
    out.exN = document.querySelectorAll('#gr-ex > div').length;
    out.mnLen = document.getElementById('gr-mn').textContent.length;

    // ── 20 дасгал: БҮГДИЙГ ЗӨВ ──
    document.getElementById('gr-start').click(); await wait(250);
    out.runShown = !document.getElementById('gr-run').hidden;
    out.optN = document.getElementById('gr-opts').children.length;
    out.firstN = document.getElementById('gr-n').textContent;
    for (let k = 0; k < 40 && !document.getElementById('gr-run').hidden; k++) {
      [...document.getElementById('gr-opts').children][grQ[grIdx].a].click();
      await wait(25);
      document.getElementById('gr-next').click();
      await wait(25);
    }
    out.doneShown = !document.getElementById('gr-done').hidden;
    out.pct = document.getElementById('gr-pct').textContent;
    out.saved = JSON.parse(localStorage.getItem('irodori.grammar.v1') || '{}');

    // ── БҮГДИЙГ БУРУУ: алдсаны жагсаалт гарах ёстой ──
    grAbort();
    document.querySelector('#gr-list button').click(); await wait(200);
    document.getElementById('gr-start').click(); await wait(200);
    for (let k = 0; k < 40 && !document.getElementById('gr-run').hidden; k++) {
      [...document.getElementById('gr-opts').children][(grQ[grIdx].a + 1) % 4].click();
      await wait(25);
      document.getElementById('gr-next').click();
      await wait(25);
    }
    out.badPct = document.getElementById('gr-pct').textContent;
    out.missN = document.querySelectorAll('#gr-miss > div').length;

    // Дүрэм бүрийн дасгал нь ТУХАЙН хичээлийн хүрээнд байх (id таарна)
    out.idOk = pts.every(p => p.drills.every(d => d.id.indexOf(p.id) === 0));

    grAbort(); go('home');
    if (keep === null) localStorage.removeItem('irodori.grammar.v1');
    else localStorage.setItem('irodori.grammar.v1', keep);
    grStat = JSON.parse(keep || '{}');
    return out;
  `);
  ok('дүрэм бүр ЯГ 20 дасгалтай', gr && gr.each20 && gr.drills === gr.n * 20,
    JSON.stringify(gr && { n: gr.n, drills: gr.drills, each20: gr.each20 }));
  ok('дүрэм бүрд тайлбар ба 3 жишээ бий', gr && gr.hasText, JSON.stringify(gr && gr.hasText));
  ok('кана талбарт ХАНЗ алга (かな горимд уншигдана)', gr && gr.kanaClean,
    JSON.stringify(gr && gr.kanaClean));
  ok('дасгал бүр 4 ДАВХАРДААГҮЙ сонголттой, хариулт нь мужид',
    gr && gr.optsOk, JSON.stringify(gr && gr.optsOk));
  ok('дасгал бүрд нөхөх нүд (＿) бий', gr && gr.blankOk, JSON.stringify(gr && gr.blankOk));
  ok('жагсаалт нь дүрэм болгоныг харуулна, нүүр тоог хэлнэ',
    gr && gr.screen === 'grammar' && gr.listN === gr.n
      && gr.homeN === String(gr.drills), JSON.stringify(gr));
  ok('дүрэм дарахад ТАЙЛБАР ба жишээ гарна',
    gr && gr.readShown && gr.exN === 3 && gr.mnLen > 120, JSON.stringify(gr));
  ok('«20 дасгал эхлүүлэх» нь 4 сонголттой дасгал нээнэ',
    gr && gr.runShown && gr.optN === 4 && gr.firstN === '1 / 20', JSON.stringify(gr));
  ok('бүгдийг зөв хариулбал 100%, үр дүн ХАДГАЛАГДАНА',
    gr && gr.doneShown && gr.pct === '100%' && gr.saved.G01
      && gr.saved.G01.ok === 20, JSON.stringify(gr && gr.saved));
  ok('бүгдийг буруу хариулбал 0% ба АЛДСАН жагсаалт 20 мөр',
    gr && gr.badPct === '0%' && gr.missN >= 20, JSON.stringify(gr));
  ok('дасгалын id нь дүрмийнхээ id-аар эхэлнэ', gr && gr.idOk, JSON.stringify(gr && gr.idOk));

  console.log('\n[39] Ярианы хариулт — ЗӨӨЛӨН үнэлгээ');
  /* Шалгалт чөлөөт хариулттай тул хатуу тэнцүүлж БОЛОХГҮЙ:
     「はい、しちじにおきます」 ба 「しちじにおきます」 хоёулаа зөв.
     Гурван зэрэг: ok (зөв) · near (ойролцоо) · off (өөр хариулт).
     Тайлбарт BACKTICK бичихгүй — энэ бүхэл нь template literal. */
  const sp = await c.ev(`
    const Q = (model, kana, key) => ({ model: model, modelKana: kana, key: key });
    const T = [
      // [сонссон, загвар, кана, key, хүлээж буй зэрэг, тайлбар]
      ['おはようございます', 'おはようございます。', 'おはようございます。', 'あいさつ', 'ok'],
      ['はい、しちじにおきます', '七時に起きます。', 'しちじにおきます。', '時間', 'ok'],
      ['おはよう', 'おはようございます。', 'おはようございます。', 'あいさつ', 'near'],
      ['ペンかして', 'ペンを貸してください。', 'ペンをかしてください。', '依頼', 'near'],
      ['こんばんは', 'おはようございます。', 'おはようございます。', 'あいさつ', 'off'],
      ['ろくじです', '七時に起きます。', 'しちじにおきます。', '時間', 'off'],
      ['', 'おはようございます。', 'おはようございます。', 'あいさつ', 'none'],
    ];
    const out = { rows: [], bad: [] };
    for (const t of T) {
      const j = judgeSpoken(t[0] ? [t[0]] : [], Q(t[1], t[2], t[3]));
      out.rows.push(t[0] + ' -> ' + j.band + ' (' + j.sim + ')');
      if (j.band !== t[4]) out.bad.push(t[0] + ' = ' + j.band + ' (хүлээсэн ' + t[4] + ')');
    }
    // Таних системийн ХЭД ХЭДЭН хувилбарын аль нэг нь таарвал зөв
    const alt = judgeSpoken(['ごめんなさい', 'おはようございます'],
                            Q('おはようございます。', 'おはようございます。', 'あいさつ'));
    out.altBand = alt.band;

    // key нь БҮТЭЦ бол зөвлөгөөнд гарна; АНГИЛАЛ бол гарахгүй
    const st = judgeSpoken(['ペンをかして'],
      Q('ペンを貸してください。', 'ペンをかしてください。', 'てください'));
    const cat = judgeSpoken(['ペンをかして'],
      Q('ペンを貸してください。', 'ペンをかしてください。', '依頼'));
    out.structKey = st.key; out.structHas = st.hasKey;
    out.catKey = cat.key; out.catHas = cat.hasKey;
    out.structText = judgeText(st);
    out.okText = judgeText(judgeSpoken(['おはようございます'],
      Q('おはようございます。', 'おはようございます。', 'あいさつ')));

    // Хоосон/хог оролтод УНАХГҮЙ
    let crashed = null;
    try {
      judgeSpoken(null, Q('あ', 'あ', ''));
      judgeSpoken([''], Q('', '', ''));
      judgeSpoken(['あ'], Q('あ', 'あ', ''));
    } catch (e) { crashed = String(e && e.message); }
    out.crashed = crashed;
    return out;
  `);
  ok('долоон жишээ бүгд хүлээсэн зэрэгтээ таарна',
    sp && sp.bad.length === 0, JSON.stringify(sp && sp.bad));
  ok('таних хувилбаруудын аль нэг таарвал ЗӨВ гэж үзнэ',
    sp && sp.altBand === 'ok', JSON.stringify(sp && sp.altBand));
  ok('key нь БҮТЭЦ үед зөвлөгөөнд нэрлэгдэнэ',
    sp && sp.structKey === 'てください' && sp.structHas === false,
    JSON.stringify(sp && [sp.structKey, sp.structHas]));
  ok('key нь АНГИЛАЛ (依頼) бол бүтэц гэж заахгүй — төөрөгдүүлэхгүй',
    sp && sp.catKey === '' && sp.catHas === null,
    JSON.stringify(sp && [sp.catKey, sp.catHas]));
  ok('зөвлөгөө МОНГОЛООР, аппын загвараар угсрагдана',
    sp && /Ойролцоо/.test(sp.structText) && /てください/.test(sp.structText)
      && /Зөв байна/.test(sp.okText), JSON.stringify(sp && sp.structText));
  ok('хоосон, хог оролтод унахгүй', sp && sp.crashed === null,
    JSON.stringify(sp && sp.crashed));

  console.log('\n[40] Нарийвчилсан үнэлгээ — прокси руу дуудах зам');
  /* API түлхүүр браузерт БАЙХГҮЙ: апп зөвхөн Supabase-ийн Edge Function
     рүү ханддаг. Энд тэр дуудлагыг хуурамчаар орлуулж (stub) шалгана —
     жинхэнэ LLM рүү явуулахгүй (тогтворгүй, квот иддэг).
     Тайлбарт BACKTICK бичихгүй — энэ бүхэл нь template literal. */
  const ai = await c.ev(`
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const keepFetch = window.fetch, keepSync = { url: SYNC.url, key: SYNC.key };
    const out = { calls: [] };
    SYNC.url = 'https://test.example.co'; SYNC.key = 'eyJtest';
    const Q = { q: 'ペンを貸してください。', model: 'ペンを貸してください。',
                modelKana: 'ペンをかしてください。', key: 'てください' };

    const stub = reply => {
      window.fetch = (u, o) => {
        out.calls.push({ url: String(u), body: o && o.body,
                         auth: o && o.headers && o.headers.Authorization,
                         key: o && o.headers && o.headers.apikey });
        return Promise.resolve(reply);
      };
    };

    // (1) Амжилттай хариу -> монгол бичвэр АППААС угсрагдана
    stub({ ok: true, json: () => Promise.resolve(
      { band: 'near', missing: ['ください'], better: 'ペンを貸してください。', src: 'groq' }) });
    const r1 = await aiJudge('ペンをかして', Q);
    out.band1 = r1 && r1.band;
    out.text1 = r1 && aiText(r1);
    out.url = out.calls[0] && out.calls[0].url;
    out.sentKey = out.calls[0] && out.calls[0].key;
    out.sentAuth = !!(out.calls[0] && out.calls[0].auth);
    out.bodyHasHeard = !!(out.calls[0] && out.calls[0].body.indexOf('ペンをかして') >= 0);
    // Квотыг IP-ээр биш ТӨХӨӨРӨМЖӨӨР тоолохын тулд нэргүй дугаар явна
    out.sentDev = (() => { try { return JSON.parse(out.calls[0].body).dev; }
                           catch (e) { return null; } })();
    // Түлхүүр ЯВААГҮЙ байх ёстой — зөвхөн anon түлхүүр
    out.bodyNoSecret = !!(out.calls[0]
      && out.calls[0].body.indexOf('gsk_') < 0 && out.calls[0].body.indexOf('AIza') < 0);

    // (2) 503 (нийлүүлэгч байхгүй) -> null, локал үнэлгээ хэвээр
    stub({ ok: false, status: 503, json: () => Promise.resolve({ error: 'no provider' }) });
    out.r503 = await aiJudge('ペンをかして', Q);

    // (3) Сүлжээний алдаа -> null, УНАХГҮЙ
    window.fetch = () => Promise.reject(new Error('offline'));
    out.rErr = await aiJudge('ペンをかして', Q);

    // (4) Гэрээ зөрчсөн хариу (band алга) -> null
    stub({ ok: true, json: () => Promise.resolve({ hello: 'world' }) });
    out.rBad = await aiJudge('ペンをかして', Q);

    // (5) SYNC тохируулаагүй бол ОГТ дуудахгүй
    SYNC.url = '';
    out.callsBefore = out.calls.length;
    out.rNoSync = await aiJudge('ペンをかして', Q);
    out.callsAfter = out.calls.length;

    // (6) Монгол бичвэрийн хувилбарууд
    out.okText = aiText({ band: 'ok', missing: [], better: '' });
    out.offText = aiText({ band: 'off', missing: ['おはよう'], better: '' });

    window.fetch = keepFetch; SYNC.url = keepSync.url; SYNC.key = keepSync.key;
    return out;
  `);
  ok('дуудлага Edge Function руу явна (/functions/v1/judge)',
    ai && /\/functions\/v1\/judge$/.test(ai.url || ''), JSON.stringify(ai && ai.url));
  ok('зөвхөн ANON түлхүүр явна — LLM-ийн түлхүүр браузерт БАЙХГҮЙ',
    ai && ai.sentKey === 'eyJtest' && ai.sentAuth && ai.bodyNoSecret, JSON.stringify(ai));
  ok('сонссон текст хүсэлтэд орно', ai && ai.bodyHasHeard, JSON.stringify(ai));
  ok('НЭРГҮЙ төхөөрөмжийн дугаар явна (квотыг IP-ээр биш үүгээр тоолно)',
    ai && typeof ai.sentDev === 'string' && ai.sentDev.length >= 8,
    JSON.stringify(ai && ai.sentDev));
  ok('амжилттай хариунаас МОНГОЛ зөвлөгөө угсрагдана',
    ai && ai.band1 === 'near' && /Ойролцоо/.test(ai.text1)
      && /ください/.test(ai.text1), JSON.stringify(ai && ai.text1));
  ok('503, сүлжээний алдаа, гэрээ зөрчсөн хариу — бүгд null (локал үнэлгээ хэвээр)',
    ai && ai.r503 === null && ai.rErr === null && ai.rBad === null, JSON.stringify(ai));
  ok('синк тохируулаагүй бол прокси руу ОГТ хандахгүй',
    ai && ai.rNoSync === null && ai.callsAfter === ai.callsBefore, JSON.stringify(ai));
  const mg = await c.ev(`
    const L = b => ({ band: b, sim: 0 });
    const A = (b, miss) => ({ band: b, missing: miss || [], better: 'X', src: 'groq' });
    return {
      // Локал «зөв» гэснийг LLM БУУРУУЛЖ чадахгүй (канаар зөв хэлсэнийг
      // «ханз дутуу» гэж буруутгадаг байв)
      okDown: mergeJudge(L('ok'), A('near', ['貸'])).band,
      okOff: mergeJudge(L('ok'), A('off')).band,
      // Локал «өөр» гэснийг LLM ДЭЭШЛҮҮЛЖ чадна (өөр үгээр зөв хэлсэн)
      offUp: mergeJudge(L('off'), A('ok')).band,
      offNear: mergeJudge(L('off'), A('near')).band,
      // «ойролцоо»-г доошлуулахгүй
      nearKeep: mergeJudge(L('near'), A('off')).band,
      nearUp: mergeJudge(L('near'), A('ok')).band,
      // Зөвлөгөө нь ҮРГЭЛЖ LLM-ийнх
      miss: mergeJudge(L('ok'), A('near', ['ください'])).missing.join(','),
      // LLM байхгүй бол локал хэвээр
      noAi: mergeJudge(L('near'), null).band,
      noAiSrc: mergeJudge(L('near'), null).src,
    };
  `);
  ok('локал «зөв»-ийг LLM бууруулж ЧАДАХГҮЙ',
    mg && mg.okDown === 'ok' && mg.okOff === 'ok', JSON.stringify(mg));
  ok('локал «өөр»-ийг LLM дээшлүүлж ЧАДНА (өөр үгээр зөв хэлсэн)',
    mg && mg.offUp === 'ok' && mg.offNear === 'near', JSON.stringify(mg));
  ok('«ойролцоо» нь доошлохгүй, дээшилж болно',
    mg && mg.nearKeep === 'near' && mg.nearUp === 'ok', JSON.stringify(mg));
  ok('зөвлөгөө (дутуу үг) нь LLM-ийнх',
    mg && mg.miss === 'ください', JSON.stringify(mg && mg.miss));
  ok('LLM байхгүй бол ЛОКАЛ дүгнэлт хэвээр',
    mg && mg.noAi === 'near' && mg.noAiSrc === 'local', JSON.stringify(mg));

  ok('«зөв» ба «өөр хариулт»-ын бичвэр ч монголоор',
    ai && /Зөв байна/.test(ai.okText) && /Өөр хариулт/.test(ai.offText),
    JSON.stringify(ai && [ai.okText, ai.offText]));

  console.log('\n[41] Хүртээмж ба байрлал — ХЭМЖСЭН регресс');
  /* Энэ хэсэг бүхэлдээ ХЭМЖИЛТЭЭР ажиллана: өнгө, зай, фокусыг нүдээр
     биш, computed style ба getBoundingClientRect-ээр уншина.
     Тайлбарт BACKTICK бичихгүй — энэ бүхэл нь template literal.
     Escape (тэмдэгт ангийн \\d г.м.) БИЧИХГҮЙ — template literal идэж
     орхино; [0-9] мэтээр бич. */

  // (1) БҮХ дэлгэц дээрх бичвэр WCAG AA хангана уу (цайвар БА бараан)
  const aa = await c.ev(`
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const rgb = s => (s.match(/[0-9.]+/g) || []).slice(0, 3).map(Number);
    const lum = a => { const f = v => { v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(a[0]) + 0.7152 * f(a[1]) + 0.0722 * f(a[2]); };
    const cr = (a, b) => { const l1 = lum(rgb(a)), l2 = lum(rgb(b));
      return Math.round(100 * ((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05))) / 100; };
    const opaque = b => b && b.indexOf('rgba') < 0 && b !== 'transparent';
    const bgOf = el => { let n = el; while (n) { const b = getComputedStyle(n).backgroundColor;
      if (opaque(b)) return b; n = n.parentElement; } return 'rgb(255, 255, 255)'; };
    const SCREENS = ['home','study','exam','grammar','kanji','progress','profile','feedback'];
    const bad = [];
    const scan = theme => {
      for (const el of document.querySelectorAll('*')) {
        if (el.offsetParent === null && el.tagName !== 'BODY') continue;
        const txt = [].slice.call(el.childNodes).filter(n => n.nodeType === 3)
          .map(n => n.textContent.trim()).join('');
        if (!txt) continue;
        // ЭМОЖИ нь өөрийн өнгөөр буддаг тул CSS-ийн color үйлчлэхгүй —
        // ялгарал хэмжих утгагүй (🔊 товч 1.34:1 гэж ХУДАЛ дохио өгч байв).
        if (!/[0-9A-Za-zА-Яа-яЁёぁ-ヿ㐀-鿿]/.test(txt)) continue;
        const st = getComputedStyle(el);
        const size = parseFloat(st.fontSize);
        const bold = (parseInt(st.fontWeight, 10) || 400) >= 700;
        const need = (size >= 24 || (size >= 18.66 && bold)) ? 3 : 4.5;
        const ratio = cr(st.color, bgOf(el));
        if (ratio >= need) continue;
        const sel = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '');
        bad.push(theme + ' ' + sel + ' ' + ratio + '<' + need + ' [' + txt.slice(0, 16) + ']');
      } };
    const keep = document.documentElement.getAttribute('data-theme');
    for (const th of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', th);
      for (const sc of SCREENS) { try { go(sc); } catch (e) { continue; } await wait(260); scan(th); }
    }
    if (keep) document.documentElement.setAttribute('data-theme', keep);
    else document.documentElement.removeAttribute('data-theme');
    go('home');
    return bad;
  `);
  ok('бүх дэлгэцийн бичвэр WCAG AA давна (цайвар + бараан)',
    Array.isArray(aa) && aa.length === 0, (aa || []).slice(0, 4).join(' | '));

  // (2)(3)(4) Дүрмийн дасгал: бүлгийн зай · гарын товчлол · фокус
  const gu = await c.ev(`
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const o = {};
    go('grammar'); await wait(900);
    document.querySelector('#gr-list button').click(); await wait(500);
    document.getElementById('gr-start').click(); await wait(700);
    const card = document.querySelector('#gr-run .gr-card');
    const opts = document.getElementById('gr-opts');
    const next = document.getElementById('gr-next');
    const cb = card.getBoundingClientRect(), ob = opts.getBoundingClientRect();
    o.gapCardOpts = Math.round(ob.top - cb.bottom);
    o.focusOnShow = document.activeElement ? document.activeElement.id : 'none';
    // Гараас «1» дарахад эхний сонголт сонгогдоно
    o.lockedBefore = opts.querySelectorAll('button[disabled]').length;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
    await wait(400);
    o.lockedAfter = opts.querySelectorAll('button[disabled]').length;
    o.focusAfterPick = document.activeElement ? document.activeElement.id : 'none';
    o.nextShown = !next.hidden;
    const bs = [].slice.call(opts.querySelectorAll('button')).map(b => b.getBoundingClientRect());
    o.gapOptsNext = Math.round(next.getBoundingClientRect().top - bs[bs.length - 1].bottom);
    // Enter нь «Дараах»-ыг дарна -> шинэ асуулт, фокус асуулт дээр
    const n0 = document.getElementById('gr-n').textContent;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await wait(500);
    o.advanced = document.getElementById('gr-n').textContent !== n0;
    o.focusAfterNext = document.activeElement ? document.activeElement.id : 'none';
    // Дугаар ХАРАГДАЖ байгаа эсэх (амлалт нь ажиллаж байгаатай нийцэх ёстой)
    o.numShown = getComputedStyle(opts.querySelector('button'), '::before').content;
    grAbort(); go('home');
    return o;
  `);
  ok('дүрмийн дасгал: асуулт -> сонголтын зай >= 16px (бүлэг наалдахгүй)',
    gu && gu.gapCardOpts >= 16, JSON.stringify(gu && gu.gapCardOpts));
  ok('дүрмийн дасгал: сонголт -> «Дараах»-ын зай >= 8px',
    gu && gu.gapOptsNext >= 8, JSON.stringify(gu && gu.gapOptsNext));
  ok('дүрмийн дасгал: гарын 1-4 АЖИЛЛАНА (дугаар нь харагддаг тул заавал)',
    gu && gu.lockedBefore === 0 && gu.lockedAfter === 4 && gu.nextShown,
    JSON.stringify(gu));
  ok('дүрмийн дасгал: Enter нь дараагийн асуулт руу оруулна',
    gu && gu.advanced === true, JSON.stringify(gu && gu.advanced));
  ok('фокус хариултын дараа «Дараах» дээр — BODY дээр унахгүй',
    gu && gu.focusAfterPick === 'gr-next', JSON.stringify(gu && gu.focusAfterPick));
  ok('фокус шинэ асуулт дээр зөөгдөнө — BODY дээр унахгүй',
    gu && gu.focusAfterNext === 'gr-q', JSON.stringify(gu && gu.focusAfterNext));

  // (5) Локал үнэлгээ: БОГИНО зөв хариулт ба ХАНЗТАЙ түлхүүр
  const sj = await c.ev(`
    const J = (heard, model, kana, key) =>
      judgeSpoken([heard], { model: model, modelKana: kana, key: key }).band;
    return {
      // Богино хариулт нь «өөр хариулт» БИШ
      short: J('ろくじです', '六時に起きます。', 'ろくじにおきます。', '時間'),
      short2: J('すし', 'すしが好きです。', 'すしがすきです。', '好きです'),
      // ХАНЗТАЙ түлхүүр нь канан хариултыг бууруулахгүй
      kanjiKey: J('すしがすきです', 'すしが好きです。', 'すしがすきです。', '好きです'),
      // КАНАН түлхүүр нь бүтэц дутууг барьсаар байна
      kanaKey: J('ペンをかして', 'ペンを貸してください。', 'ペンをかしてください。', 'てください'),
      // СӨРӨГ: огт өөр сэдэв нь дээшлэхгүй
      offA: J('すしがすきです', '六時に起きます。', 'ろくじにおきます。', '時間'),
      offB: J('こんばんは', 'おはようございます。', 'おはようございます。', 'あいさつ'),
      offC: J('わかりません', 'さんじです。', 'さんじです。', '時間'),
      // Зөвхөн ЭЕЛДЭГ ТӨГСГӨЛӨӨР (です) таарсан нь агуулгын нотолгоо БИШ
      offD: J('きょうはあついです', '田中です。', 'たなかです。', '名前'),
    };
  `);
  ok('богино ч зөв хариулт «өөр хариулт» болохгүй (ろくじです · すし)',
    sj && sj.short === 'near' && sj.short2 === 'near', JSON.stringify(sj));
  ok('ХАНЗТАЙ түлхүүр нь канан хариултыг бууруулахгүй',
    sj && sj.kanjiKey === 'ok', JSON.stringify(sj));
  ok('КАНАН түлхүүр нь дутуу бүтцийг барьсаар байна',
    sj && sj.kanaKey === 'near', JSON.stringify(sj));
  ok('СӨРӨГ: огт өөр сэдэв дээшлэхгүй (дөрвүүлээ «өөр хариулт»)',
    sj && sj.offA === 'off' && sj.offB === 'off' && sj.offC === 'off'
      && sj.offD === 'off', JSON.stringify(sj));

  console.log('\n[42] ХУВИЙН асуулт — сурагчийн үнэн хариултыг буруутгахгүй');
  /* Шалгалтын 180 асуултын дийлэнх нь сурагчийн ӨӨРИЙНХ нь тухай.
     Загвар хариулт нь ЖИШЭЭ — 4 настай сурагчид «25 настай» гэж
     хэлүүлэх нь хамгийн хортой алдаа.
     Тайлбарт BACKTICK бичихгүй. Escape (\\d г.м.) БИЧИХГҮЙ. */
  const fr = await c.ev(`
    const out = {};
    const ex = await fetch('data/exam-starter.json').then(r => r.json());
    out.n = ex.items.length;
    out.withFlag = ex.items.filter(x => x.free === 0 || x.free === 1).length;
    out.free = ex.items.filter(x => x.free === 1).length;
    // Хэвшмэл үг («юу гэж хэлэх вэ») нь ТОГТМОЛ байх ёстой
    const say = ex.items.filter(x => x.q.indexOf('何と言いますか') >= 0);
    out.sayN = say.length;
    out.sayFixed = say.filter(x => x.free === 0).length;
    // ЗОРИУДЫН онцгой тохиолдол: «何になさいますか» гэж асуухад ямар ч
    // хоол захиалж болно. Ганц л ийм байх ёстой — өсвөл хэв маяг эвдэрсэн.
    out.sayFreeIds = say.filter(x => x.free === 1).map(x => x.id).join(',');
    // Хувийн асуултын жишээ — ТУС БҮР чөлөөт байх ёстой
    const pick = id => (ex.items.find(x => x.id === id) || {}).free;
    out.age = pick('S04-01'); out.kid = pick('S04-09');
    out.wake = pick('S09-07'); out.live = pick('S04-08');
    out.pen = pick('S10-06');          // ТОГТМОЛ байх ёстой
    return out;
  `);
  ok('шалгалтын бүх асуулт free тэмдэгтэй (180)',
    fr && fr.n === 180 && fr.withFlag === 180, JSON.stringify(fr));
  ok('чөлөөт асуулт олонх (100..160)',
    fr && fr.free >= 100 && fr.free <= 160, JSON.stringify(fr && fr.free));
  ok('«юу гэж хэлэх вэ» асуултууд ТОГТМОЛ — ганц мэдэгдэж буй онцгойлолтой',
    fr && fr.sayN > 20 && fr.sayFixed === fr.sayN - 1
      && fr.sayFreeIds === 'S06-01', JSON.stringify(fr));
  ok('нас · хүүхдийн нас · босох цаг · оршин суух газар = ЧӨЛӨӨТ',
    fr && fr.age === 1 && fr.kid === 1 && fr.wake === 1 && fr.live === 1,
    JSON.stringify(fr));
  ok('«ペンを貸してください» = ТОГТМОЛ (нөхцөл нь өгөгдсөн)',
    fr && fr.pen === 0, JSON.stringify(fr && fr.pen));

  const fj = await c.ev(`
    const J = (heard, model, kana, key, free) =>
      judgeSpoken([heard], { model: model, modelKana: kana, key: key, free: free }).band;
    return {
      // Сурагчийн ҮНЭН хариулт загвараас зөрсөн ч ЗӨВ
      age:  J('よんさいです', '25歳です。', 'にじゅうごさいです。', '〜歳です', 1),
      wake: J('しちじにおきます', '六時に起きます。', 'ろくじにおきます。', '時間', 1),
      fam:  J('ごにんです', 'よにんです。', 'よにんです。', '家族', 1),
      live: J('うらんばーとるにすんでいます', '東京に住んでいます。',
              'とうきょうにすんでいます。', '住んで', 1),
      food: J('ぶうずがすきです', 'すしが好きです。', 'すしがすきです。', '好きです', 1),
      hob:  J('しゅみはすぽーつです', '趣味は音楽です。', 'しゅみはおんがくです。', '趣味', 1),
      // ХЭЛБЭР эвдэрсэн бол чөлөөт асуултад ч анхааруулна
      broken: J('よんさい', '25歳です。', 'にじゅうごさいです。', '〜歳です', 1),
      // Чөлөөт асуултад «Өөр хариулт» гэж ХЭЗЭЭ Ч хэлэхгүй
      nonsense: J('わかりません', '25歳です。', 'にじゅうごさいです。', '〜歳です', 1),
      // ТОГТМОЛ асуулт — зан төлөв ӨӨРЧЛӨГДӨӨГҮЙ байх ёстой
      fixOk:   J('ペンをかしてください', 'ペンを貸してください。', 'ペンをかしてください。', 'てください', 0),
      fixNear: J('ペンをかして', 'ペンを貸してください。', 'ペンをかしてください。', 'てください', 0),
      fixOff:  J('こんばんは', 'おはようございます。', 'おはようございます。', 'あいさつ', 0),
    };
  `);
  ok('хувийн ҮНЭН хариулт «зөв» гэж үнэлэгдэнэ (6 тохиолдол)',
    fj && fj.age === 'ok' && fj.wake === 'ok' && fj.fam === 'ok'
      && fj.live === 'ok' && fj.food === 'ok' && fj.hob === 'ok', JSON.stringify(fj));
  ok('чөлөөт асуултад ч ХЭЛБЭРийн алдааг барина (です алга)',
    fj && fj.broken === 'near', JSON.stringify(fj && fj.broken));
  ok('чөлөөт асуултад «Өөр хариулт» гэж ХЭЗЭЭ Ч хэлэхгүй',
    fj && fj.nonsense !== 'off', JSON.stringify(fj && fj.nonsense));
  ok('ТОГТМОЛ асуултын зан төлөв хэвээр (ok/near/off)',
    fj && fj.fixOk === 'ok' && fj.fixNear === 'near' && fj.fixOff === 'off',
    JSON.stringify(fj));

  const fm = await c.ev(`
    const L = (b, free) => ({ band: b, free: free });
    const A = (b, miss, better) => ({ band: b, missing: miss || [],
                                      better: better || '', src: 'groq' });
    return {
      // Хувийн асуулт: LLM «off» гэвэл АГУУЛГЫГ дүгнэсэн -> үл тоомсорлоно
      offBand: mergeJudge(L('ok', true), A('off', [], 'ろくじにおきます。')).band,
      offAdv: mergeJudge(L('ok', true), A('off', ['ろくじ'], 'ろくじにおきます。')).better,
      offMiss: mergeJudge(L('ok', true), A('off', ['ろくじ'], '')).missing.length,
      // Хувийн асуулт: LLM «near» гэвэл ХЭЛБЭРийн алдаа -> хүлээж авна
      nearBand: mergeJudge(L('ok', true), A('near', ['です'], 'よんさいです。')).band,
      nearAdv: mergeJudge(L('ok', true), A('near', ['です'], 'よんさいです。')).better,
      // ТОГТМОЛ асуулт: хуучин дүрэм хэвээр — LLM зөвхөн ДЭЭШЛҮҮЛНЭ
      fixDown: mergeJudge(L('ok', false), A('off')).band,
      fixUp: mergeJudge(L('off', false), A('ok')).band,
      fixAdv: mergeJudge(L('ok', false), A('near', ['ください'], 'X')).missing.join(','),
    };
  `);
  ok('хувийн: LLM-ийн «off» нь зэрэгт нөлөөлөхгүй',
    fm && fm.offBand === 'ok', JSON.stringify(fm && fm.offBand));
  ok('хувийн: LLM-ийн «off» үеийн ЗӨВЛӨГӨӨ хаягдана (загварын баримт)',
    fm && fm.offAdv === '' && fm.offMiss === 0, JSON.stringify(fm));
  ok('хувийн: LLM-ийн «near» (хэлбэрийн алдаа) хүлээн авагдана',
    fm && fm.nearBand === 'near' && /です/.test(fm.nearAdv), JSON.stringify(fm));
  ok('ТОГТМОЛ асуултад нэгтгэх хуучин дүрэм хэвээр',
    fm && fm.fixDown === 'ok' && fm.fixUp === 'ok' && fm.fixAdv === 'ください',
    JSON.stringify(fm));

  console.log('\n[34] «Явцыг устгах» — шалгалтын хариулт серверээс ч устана');
  /* Уусгалт нэмсний дараа хоосон түүх юу ч устгахаа больсон (зөв). Гэвч
     устгах товч ч устгаж чадахаа больсон: хэрэглэгч шалгалтын дэлгэцэд
     «0/20», ангийн жагсаалтад «20/20» гэсэн ХОЁР ӨӨР тоо харах байв.
     Тайлбарт BACKTICK бичихгүй — энэ бүхэл нь template literal. */
  const wp = await c.ev(`
    const keep = { rpc: rpc, dev: isDevHost, me: JSON.parse(JSON.stringify(me)),
                   hist: exHist, prog: progress, days: days, conf: window.confirm,
                   raw: localStorage.getItem(KEY_P) };
    const F = { calls: [] };
    rpc = async (fn, b) => { F.calls.push({ fn: fn, b: b }); return { mica: 'ok' }; };
    isDevHost = () => false;
    window.confirm = () => true;
    me.codes = { mica: '1111' }; me.teach = {}; me.other = false; me.done = true;
    me.name = 'Бат'; me.sent = ''; save(KEY_ME, me);
    exHist = { S01: [today(), 1, 1] }; save(KEY_EXH, exHist);
    lastMemberSync = 0;
    document.getElementById('btn-reset').click();
    await new Promise(r => setTimeout(r, 600));
    const put = F.calls.filter(x => x.fn === 'member_put').pop();
    const out = {
      wipe: put ? put.b.p_wipe : null,
      examSent: put ? JSON.stringify(put.b.p_exam) : null,
      local: Object.keys(exHist).length,
    };
    rpc = keep.rpc; isDevHost = keep.dev; window.confirm = keep.conf;
    me = cleanMe(keep.me); save(KEY_ME, me);
    exHist = keep.hist; save(KEY_EXH, exHist);
    progress = keep.prog; days = keep.days;
    if (keep.raw === null) localStorage.removeItem(KEY_P);
    else localStorage.setItem(KEY_P, keep.raw);
    save(KEY_D, days); refreshHome(); refreshStats();
    return out;
  `);
  ok('устгах товч серверт `p_wipe` илгээнэ (уусгахгүй, дарж бичнэ)',
    wp && wp.wipe === true && wp.examSent === '{}', JSON.stringify(wp));
  ok('локал шалгалтын түүх ч цэвэрлэгдэнэ', wp && wp.local === 0, JSON.stringify(wp));

  console.log('\n[30] Ангийн даалгавар — L1–L8-аас 20 өөр асуулт');
  /* Хуурамч сервер SQL-ийн дүрмийг дагана (SQL-ийг test_sql.js §9 шалгадаг):
     task_n = даалгаврын хичээлээс since-ээс хойш хариулсан ӨӨР асуулт.
     Тайлбарт BACKTICK бичихгүй — энэ бүхэл нь template literal. */
  const tk = await c.ev(`
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const out = {};
    const keep = { rpc: rpc, dev: isDevHost, me: JSON.parse(JSON.stringify(me)),
                   hist: exHist, les: exLes, n: exN, cls: classList };
    const TASK = { lessons: [1, 2, 3, 4, 5, 6, 7, 8], n: 20, since: '2026-01-01' };
    const F = { classes: { mica: { name: 'MICA', code: '5173', task: TASK },
                           c2: { name: 'Наран', code: '8264', task: null } },
                members: {}, calls: [] };
    const sinceDay = d => Math.floor(Date.UTC(+d.slice(0,4), +d.slice(5,7) - 1, +d.slice(8,10)) / 864e5);
    const chk = (c, k) => !F.classes[c] ? 'none' : (String(k || '') === F.classes[c].code ? 'ok' : 'bad');
    rpc = async (fn, b) => {
      F.calls.push({ fn: fn, b: JSON.parse(JSON.stringify(b || {})) });
      if (fn === 'class_list') return Object.keys(F.classes).map(id =>
        ({ id: id, name: F.classes[id].name, task: F.classes[id].task }));
      if (fn === 'class_join') return chk(b.p_class, b.p_code);
      if (fn === 'member_put') {
        const res = {}, ok = [];
        for (const k in (b.p_classes || {})) { res[k] = chk(k, b.p_classes[k]); if (res[k] === 'ok') ok.push(k); }
        if (!ok.length) { delete F.members[b.p_member]; return res; }
        const prev = F.members[b.p_member] || {};
        F.members[b.p_member] = { name: b.p_name, classes: ok, seen: b.p_seen, learned: b.p_learned,
          today: b.p_today, streak: b.p_streak, day: b.p_day,
          exam: b.p_exam === null || b.p_exam === undefined ? (prev.exam || {}) : b.p_exam };
        return res;
      }
      if (fn === 'class_roster') {
        const st = chk(b.p_class, b.p_code);
        if (st !== 'ok') return { status: st };
        const t = F.classes[b.p_class].task;
        const rows = Object.keys(F.members).filter(id => F.members[id].classes.includes(b.p_class))
          .map(id => {
            const m = F.members[id], ex = Object.values(m.exam || {});
            const inT = t ? ex.filter(h => t.lessons.includes(h[2]) && h[0] >= sinceDay(t.since)) : null;
            return { name: m.name, seen: m.seen, learned: m.learned, today: m.today, streak: m.streak,
              day: m.day, me: id === b.p_member,
              task_n: t ? inT.length : null, task_ok: t ? inT.filter(h => h[1]).length : null };
          });
        return { status: 'ok', name: F.classes[b.p_class].name, task: t, rows: rows };
      }
      throw new Error('unknown ' + fn);
    };
    isDevHost = () => false;
    me.codes = { mica: '5173', c2: '8264' }; me.other = false; me.lost = []; me.done = true;
    me.name = 'Бат'; save(KEY_ME, me);
    exHist = {}; save(KEY_EXH, exHist);
    await loadClassList();

    // Анги нэгт хоёр хүн: нэг нь ХИЙСЭН (20), нөгөө нь дутуу (12)
    const mk = n => { const o = {}; for (let i = 0; i < n; i++) o['Z' + i] = [today(), 1, 1 + (i % 8)]; return o; };
    F.members.memberDONE01 = { name: 'Болд', classes: ['mica'], seen: 1, learned: 1, today: 0, streak: 0, day: today(), exam: mk(20) };
    F.members.memberHALF01 = { name: 'Сараа', classes: ['mica', 'c2'], seen: 1, learned: 1, today: 0, streak: 0, day: today(), exam: mk(12) };

    // (1) Шалгалтын самбар — зөвхөн даалгавартай анги
    go('exam'); await wait(600);
    const box = document.getElementById('ex-tasks');
    out.bannerShown = !box.hidden;
    out.bannerItems = [...box.querySelectorAll('.ex-task')].map(li => li.textContent.replace(/\\s+/g, ' ').trim());

    // (1b) НҮҮРНИЙ хамгийн дээр ч гарна — сурагч орж ирмэгц харна
    go('home'); await wait(400);
    const hb = document.getElementById('home-tasks');
    const home = document.getElementById('home');
    out.homeShown = !hb.hidden;
    out.homeFirst = home.firstElementChild === hb;   // ХАМГИЙН ДЭЭР
    out.homeText = hb.textContent.replace(/\\s+/g, ' ').trim();
    out.homeBtn = (hb.querySelector('.ex-task-pick') || {}).textContent;
    // «Эхлүүлэх» -> хичээл тохирч, шалгалтын дэлгэц рүү шилжинэ
    hb.querySelector('.ex-task-pick').click();
    await wait(500);
    out.afterClick = screen;
    out.afterLes = JSON.stringify(examLessonsSel());
    out.afterN = exN;

    // (2) L1-ийн 10 асуултыг хариулна — түүхэнд 10
    exLes = [1]; save(KEY_EXL, exLes); exN = 15; startExam(); await wait(400);
    for (let i = 0; i < exQs.length; i++) { examMark(i % 2 === 0); await wait(220); }
    out.hist1 = Object.keys(exHist).length;
    out.histShape = JSON.stringify(Object.values(exHist)[0]);
    // (3) ИЖИЛ 10 асуултыг дахин — давхардахгүй
    examSetup(); await wait(300); startExam(); await wait(400);
    for (let i = 0; i < exQs.length; i++) { examMark(true); await wait(220); }
    out.hist2 = Object.keys(exHist).length;
    await wait(200);
    const put = F.calls.filter(x => x.fn === 'member_put').pop();
    out.sentExam = put ? Object.keys(put.b.p_exam || {}).length : -1;

    // (4) Самбар 10/20 харуулна; «Сонгох» -> L1–L8, 20 асуулт
    examSetup(); await wait(400);
    const bs = () => box.querySelector('.ex-task .task-state');
    out.bannerAfter = bs() ? bs().textContent : null;
    if (box.querySelector('.ex-task-pick')) box.querySelector('.ex-task-pick').click();
    await wait(100);
    out.pickLes = JSON.stringify(examLessonsSel());
    out.pickN = exN;
    out.pickNote = document.getElementById('ex-les-note').textContent;

    // (5) Ангийн дэлгэц
    go('klass'); await wait(600);
    const secs = [...document.querySelectorAll('#kl-list .kl-class')];
    const sec = t => secs.find(s => s.querySelector('h3 span').textContent === t);
    const mica = sec('MICA'), naran = sec('Наран');
    const kt = mica && mica.querySelector('.kl-task');
    out.taskLine = kt ? kt.querySelector('span').textContent + ' | ' + kt.querySelector('strong').textContent : null;
    const st = (s, n) => { const li = [...s.querySelectorAll('.kl-member')].find(l => l.querySelector('.kl-name b').textContent === n);
                           return li && li.querySelector('.task-state') ? li.querySelector('.task-state').textContent : null; };
    out.bold = mica && st(mica, 'Болд');
    out.saraa = mica && st(mica, 'Сараа');
    out.me = mica && st(mica, 'Бат');
    out.order = mica ? [...mica.querySelectorAll('.kl-member .kl-name b')].map(b => b.textContent) : [];
    out.micaMetrics = mica ? mica.querySelectorAll('.kl-metrics').length : -1;
    out.naranMetrics = naran ? naran.querySelectorAll('.kl-metrics').length : -1;
    const sli = mica && [...mica.querySelectorAll('.kl-member')].find(l => l.querySelector('.kl-name b').textContent === 'Сараа');
    // null-д тэсвэртэй: нэг эвдрэл бусад шалгалтыг ДАРАХГҮЙ байх ёстой.
    const q1 = (el, sel) => el && el.querySelector(sel);
    out.saraaSmall = q1(sli, '.kl-prog small') ? q1(sli, '.kl-prog small').textContent : null;
    out.saraaBar = q1(sli, '.kl-prog .fill') ? q1(sli, '.kl-prog .fill').style.width : null;
    out.naranTask = naran ? !!naran.querySelector('.kl-task') : 'no-section';
    out.naranStates = naran ? naran.querySelectorAll('.task-state').length : -1;

    // (6) since-ээс ӨМНӨХ хариулт тоологдохгүй (орон нутгийн тооцоо)
    out.localBefore = taskDoneLocal({ lessons: [1], n: 20, since: '2099-01-01' });

    // (7) 20 өөр асуулт хүрвэл «Хийсэн»
    for (let i = 0; i < 20; i++) exHist['Y' + i] = [today(), 1, 2];
    save(KEY_EXH, exHist);
    examSetup(); await wait(400);
    out.bannerDone = bs() ? bs().textContent : null;
    out.bannerDoneCls = bs() ? bs().className : '';

    // (8) «Бусад» -> даалгаврын хариулт серверт ИЛГЭЭГДЭХГҮЙ
    me.codes = {}; me.other = true; save(KEY_ME, me);
    F.calls = []; lastMemberSync = 0; await memberSync(true);
    const put2 = F.calls.filter(x => x.fn === 'member_put').pop();
    out.otherExam = put2 ? JSON.stringify(put2.b.p_exam) : 'no-call';
    examSetup(); await wait(300);
    out.otherBanner = box.hidden;

    rpc = keep.rpc; isDevHost = keep.dev; me = cleanMe(keep.me); save(KEY_ME, me);
    exHist = keep.hist; save(KEY_EXH, exHist); exLes = keep.les; save(KEY_EXL, exLes);
    exN = keep.n; classList = keep.cls; save(KEY_CLS, classList);
    exAbort(); refreshMe(); go('home');
    return out;
  `);
  ok('шалгалтын дэлгэцэд даалгавар — ЗӨВХӨН даалгавартай анги (MICA)',
    tk && tk.bannerShown && tk.bannerItems.length === 1 && /MICA · L1–L8 · 20 асуулт/.test(tk.bannerItems[0]),
    JSON.stringify(tk && tk.bannerItems));
  ok('даалгавар НҮҮРНИЙ ХАМГИЙН ДЭЭР гарна',
    tk && tk.homeShown && tk.homeFirst && /MICA · L1–L8 · 20 асуулт/.test(tk.homeText),
    JSON.stringify(tk && { s: tk.homeShown, f: tk.homeFirst, t: tk.homeText }));
  ok('нүүрний товч «Эхлүүлэх» — шалгалт руу аваачиж хичээлийг тохируулна',
    tk && tk.homeBtn === 'Эхлүүлэх' && tk.afterClick === 'exam'
      && tk.afterLes === '[1,2,3,4,5,6,7,8]' && tk.afterN === 20,
    JSON.stringify(tk && { b: tk.homeBtn, s: tk.afterClick, l: tk.afterLes, n: tk.afterN }));
  ok('шалгалтын хариулт түүхэнд бүртгэгдэнэ [өдөр, 0/1, хичээл]',
    tk && tk.hist1 === 10 && /^\[\d+,[01],1\]$/.test(tk.histShape), JSON.stringify(tk));
  ok('ИЖИЛ асуултыг дахин хариулахад ДАВХАРДАХГҮЙ (10 хэвээр)', tk && tk.hist2 === 10, JSON.stringify(tk));
  ok('шалгалт дуусахад хариулт серверт илгээгдэнэ', tk && tk.sentExam === 10, JSON.stringify(tk));
  ok('самбар явцыг харуулна: 10/20', tk && tk.bannerAfter === '10/20', JSON.stringify(tk));
  ok('«Сонгох» -> L1–L8 ба 20 асуулт',
    tk && tk.pickLes === '[1,2,3,4,5,6,7,8]' && tk.pickN === 20 && tk.pickNote === '8 хичээл · 80 асуулт',
    JSON.stringify(tk));
  ok('ангийн дэлгэц: «Даалгавар · L1–L8 · 20 асуулт · 1/3 хийсэн»',
    tk && tk.taskLine === 'Даалгавар · L1–L8 · 20 асуулт | 1/3 хийсэн', JSON.stringify(tk && tk.taskLine));
  ok('20 хүрсэн гишүүн -> «✓ 100%»', tk && tk.bold === '✓ 100%', JSON.stringify(tk));
  ok('дутуу гишүүн -> «60%», зураас 60%, «12/20 асуулт»',
    tk && tk.saraa === '60%' && tk.saraaBar === '60%' && tk.saraaSmall === '12/20 асуулт', JSON.stringify(tk));
  ok('өөрийн мөр ч гүйцэтгэлтэй (50%)', tk && tk.me === '50%', JSON.stringify(tk));
  ok('даалгавартай ангид ЦЭЭЖИЛСЭН ҮГИЙН тоо ХАРАГДАХГҮЙ', tk && tk.micaMetrics === 0, JSON.stringify(tk));
  ok('даалгаваргүй ангид (Наран) хуучин тоо хэвээр', tk && tk.naranMetrics > 0, JSON.stringify(tk));
  ok('гүйцэтгэлээр эрэмбэлэгдсэн (Болд 100 · Сараа 60 · Бат 30)',
    tk && tk.order.join() === 'Болд,Сараа,Бат', JSON.stringify(tk && tk.order));
  ok('даалгаваргүй анги (Наран) -> даалгаврын мөр, төлөв БАЙХГҮЙ',
    tk && tk.naranTask === false && tk.naranStates === 0, JSON.stringify(tk));
  ok('since-ээс ӨМНӨХ хариулт тоологдохгүй', tk && tk.localBefore === 0, JSON.stringify(tk));
  ok('20 өөр асуулт хүрвэл самбар «✓ Хийсэн»',
    tk && tk.bannerDone === '✓ Хийсэн' && /is-done/.test(tk.bannerDoneCls), JSON.stringify(tk));
  ok('«Бусад» -> хариулт серверт ИЛГЭЭГДЭХГҮЙ, самбар нуугдана',
    tk && tk.otherExam === 'null' && tk.otherBanner === true, JSON.stringify(tk));

  console.log('\n[29] Шалгалт — ХИЧЭЭЛЭЭР сонгох');
  /* Хэрэглэгчийн хүсэлт: 100 асуултаас санамсаргүй биш, СОНГОСОН
     хичээлийн асуултаас. Асуулт бүр `lesson` талбартай. Хуваалцсан
     профайл тул төгсгөлд сонголтыг «бүгд» (null) болгож буцаана.
     Тайлбарт BACKTICK бичихгүй — энэ бүхэл нь template literal. */
  const ex = await c.ev(`
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const keepN = exN, out = {};
    exLes = null; save(KEY_EXL, null);
    exN = 15;
    go('exam'); await wait(600);
    const chips = () => [...document.querySelectorAll('#ex-lessons button')];
    const note = () => document.getElementById('ex-les-note').textContent;
    out.chips = chips().length;
    out.pressedAll = chips().every(b => b.getAttribute('aria-pressed') === 'true');
    out.noteAll = note();
    out.l1small = chips()[0] && chips()[0].querySelector('small').textContent;

    document.getElementById('ex-none').click();
    out.pressedNone = chips().filter(b => b.getAttribute('aria-pressed') === 'true').length;
    out.noteNone = note();
    out.btnNone = document.getElementById('btn-exam').disabled;

    // Зөвхөн L1 (10 асуулт) — 15 гэж сонгосон ч 10-г л асууна
    chips()[0].click();
    out.noteL1 = note();
    out.btnL1 = document.getElementById('btn-exam').disabled;
    startExam(); await wait(400);
    out.l1len = exQs.length;
    out.l1only = exQs.every(q => q.lesson === 1);

    // L1-L3, 10 асуулт
    examSetup(); await wait(400);
    chips()[1].click(); chips()[2].click();
    exN = 10; renderExamLessons();
    out.noteL123 = note();
    out.stored = localStorage.getItem(KEY_EXL);
    startExam(); await wait(400);
    out.l123len = exQs.length;
    out.l123only = exQs.every(q => [1, 2, 3].includes(q.lesson));
    out.topic = document.getElementById('ex-topic').textContent;

    // Бүгдийг сонгоход null болж хадгалагдана
    examSetup(); await wait(400);
    document.getElementById('ex-all').click();
    out.storedAll = localStorage.getItem(KEY_EXL);   // load() нь null-д анхдагчаа өгдөг тул ТҮҮХИЙгээр

    exN = keepN; exLes = null; save(KEY_EXL, null);
    exAbort(); go('home');
    return out;
  `);
  ok('18 хичээлийн чип, анхдагчаар БҮГД сонгогдсон',
    ex && ex.chips === 18 && ex.pressedAll, JSON.stringify(ex));
  ok('чип дээр асуултын тоо (L1 = 10)', ex && ex.l1small === '10', JSON.stringify(ex));
  ok('бүгд үед «18 хичээл · 180 асуулт»', ex && ex.noteAll === '18 хичээл · 180 асуулт', JSON.stringify(ex));
  ok('«Цэвэрлэх» -> юу ч сонгоогүй, эхлүүлэх товч ИДЭВХГҮЙ',
    ex && ex.pressedNone === 0 && ex.btnNone && /сонгоно/.test(ex.noteNone), JSON.stringify(ex));
  ok('зөвхөн L1 -> «1 хичээл · 10 асуулт — бүгдийг нь асууна»',
    ex && ex.noteL1 === '1 хичээл · 10 асуулт — бүгдийг нь асууна' && !ex.btnL1, JSON.stringify(ex));
  ok('L1 шалгалт: 15 гэсэн ч 6 асуулт, бүгд L1',
    ex && ex.l1len === 10 && ex.l1only, JSON.stringify(ex));
  ok('L1–L3, 10 асуулт: зөвхөн тэр гурван хичээлээс',
    ex && ex.l123len === 10 && ex.l123only && ex.noteL123 === '3 хичээл · 30 асуулт', JSON.stringify(ex));
  ok('асуултын дээр хичээлийн дугаар харагдана', ex && /^L[123] · /.test(ex.topic), JSON.stringify(ex));
  ok('сонголт хадгалагдана [1,2,3]; бүгдийг сонгоход null',
    ex && ex.stored === '[1,2,3]' && ex.storedAll === 'null', JSON.stringify(ex));

  console.log('\n[25] Дүгнэлтийн гол товч — «Дараагийн хэсэг» уу «Дахин эхлүүлэх» үү');
  /* «Дахин үзэх» гэсэн шошго ХУДАЛ байв: тэр товч нь ижил 20 үгийг биш,
     ДАРААГИЙН шинэ багцыг өгдөг (`buildQueue` нь `due → fresh → rest`).
     Одоо шошго нь үлдсэн ШИНЭ үгээс хамаарна. */
  const fb = await c.ev(`
    const keepProg = progress, keepLast = settings.last, keepSfx = settings.sfx;
    settings.sfx = 0;
    const out = {};

    // ── (1) Хичээлд ШИНЭ үг ҮЛДСЭН үе
    progress = {};
    deck = 'vocab'; mode = 'flash'; wordSrc = 'book';
    rebuildPool();
    out.poolN = pool.length;
    // Багцын ЦӨӨН хэсгийг л үзсэн болгоно
    for (const it of pool.slice(0, 3)) progress[it.id] = { n:1, c:1, b:1, d:'2099-01-01' };
    okN = 3; ngN = 0; missed = [];
    // Хуурамч утгаар дарна: эс тэгвэл энэ шалгуур нь HTML-ийн анхдагч
    // шошготой давхцаж, finish() огт бичээгүй ч тэнцэх байв.
    // (Тайлбарт BACKTICK бичихгүй — энэ бүхэл нь template literal.)
    document.getElementById('fin-again').textContent = '<бичигдээгүй>';
    finish();
    await new Promise(r => setTimeout(r, 200));
    out.more = document.getElementById('fin-again').textContent.trim();

    // ── (2) Хичээлийн үг БҮГД үзэгдсэн үе
    for (const it of pool) progress[it.id] = { n:1, c:1, b:1, d:'2099-01-01' };
    finish();
    await new Promise(r => setTimeout(r, 200));
    out.all = document.getElementById('fin-again').textContent.trim();

    // ── (3) Товч нь ҮНЭХЭЭР дараагийн ШИНЭ үгсийг өгөх үү
    progress = {};
    rebuildPool();
    const first = buildQueue(false).map(x => x.id);
    for (const id of first) progress[id] = { n:1, c:1, b:1, d:'2099-01-01' };
    const second = buildQueue(false).map(x => x.id);
    out.overlap = second.filter(id => first.includes(id)).length;
    out.firstN = first.length; out.secondN = second.length;

    progress = keepProg; settings.last = keepLast; settings.sfx = keepSfx;
    show('home'); go('home');
    return out;
  `);
  ok('шинэ үг үлдсэн бол «Дараагийн хэсэг»',
    fb && fb.more === 'Дараагийн хэсэг', JSON.stringify(fb));
  ok('бүгд үзэгдсэн бол «Дахин эхлүүлэх»',
    fb && fb.all === 'Дахин эхлүүлэх', JSON.stringify(fb));
  ok('товч нь ҮНЭХЭЭР шинэ үг өгнө — багцууд ДАВХАРДАХГҮЙ',
    fb && fb.firstN > 0 && fb.secondN > 0 && fb.overlap === 0, JSON.stringify(fb));

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
      sections: document.getElementById('stat-tree').textContent,
      helpHidden: ['st-h-sec', 'st-help1']
                    .every(id => document.getElementById(id).hidden)
    };
    /* Нэг үг үзсэн болгоё. */
    progress = { [ALL[0].id]: { n: 1, c: 1, b: 1, d: today() } };
    refreshStats();
    await new Promise(r => setTimeout(r, 250));
    const one = {
      sections: document.querySelectorAll('#stat-tree > section').length,
      lessons: document.querySelectorAll('#stat-tree .statles.les .l').length
    };
    progress = keep; refreshStats();
    return { empty: empty, one: one };
  `);
  ok('«нийт зүйл» хайрцаг УСТСАН',
    sv && sv.empty.cards === 3 && !/нийт зүйл/.test(sv.empty.sumText),
    JSON.stringify(sv.empty));
  ok('юу ч үзээгүй бол хэсгийн жагсаалт ХООСОН',
    sv && /Эхний дасгалаа/.test(sv.empty.sections), JSON.stringify(sv.empty));

  ok('юу ч үзээгүй бол тайлбар ба гарчиг нуугдана',
    sv && sv.empty.helpHidden === true, JSON.stringify(sv.empty));
  ok('нэг үг үзэхэд ЗӨВХӨН нэг хэсэг гарна',
    sv && sv.one.sections === 1, JSON.stringify(sv.one));
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
  /* JLPT-ийн тугаас хамаарна — хатуу тоо бичвэл тугийг сольмогц унана.
     9 дэх нь «Анги» — зөвхөн ангид элссэн үед харагдана (энэ үед үгүй). */
  ok('шургуулгад 10 бичлэг, «Анги» нуугдмал, JLPT нь тугийг дагана',
    dr && dr.opened.items === 10
      && dr.opened.shown === (jlptOn ? 9 : 8),
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
    cross && cross.plain > 20 && cross.same + cross.plain === 360,
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
