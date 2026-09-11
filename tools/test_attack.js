/* ДОВТОЛГООНЫ шалгалт — аппыг зориудаар эвдэх оролдлого.
 *
 * `test_ui.js` нь «зөв ажиллаж байна уу» гэдгийг шалгадаг. Энэ нь
 * эсрэгээрээ: хэрэглэгч ХОРТОЙ юм өгвөл яах вэ.
 *
 * ЧУХАЛ: төлөвийг ГАРААР оноож болохгүй (`settings = {...}`). Тэр нь
 * бодит довтолгооны зам БИШ — жинхэнэ дайрагч зөвхөн (1) нөөц файл,
 * (2) `localStorage`, (3) URL, (4) синкийн сервер гэсэн дөрвөн хаалгаар
 * л орж чадна. Бүгд `cleanSettings()` / `cleanProgress()`-оор шүүгддэг.
 *
 * Ажиллуулах:
 *     python -m http.server 8765 --bind 127.0.0.1
 *     node tools/test_attack.js
 */
'use strict';
const { spawn } = require('child_process');
const http = require('http');
const PORT = 9225;
const CHROME = process.env.CHROME
  || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let hits = 0, safe = 0;
const found = [];
function rep(name, broken) {
  if (broken) { hits++; found.push(name + ' — ' + broken); console.log('  ЭВДРЭВ  ' + name + '  ' + broken); }
  else { safe++; console.log('  тэсэв   ' + name); }
}

function getJSON(path, method) {
  return new Promise((res, rej) => {
    const req = http.request({ host: '127.0.0.1', port: PORT, path, method: method || 'GET' },
      r => { let b = ''; r.on('data', c => b += c); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); });
    req.on('error', rej); req.end();
  });
}

(async () => {
  const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT,
    '--no-first-run', '--disable-gpu', '--mute-audio',
    '--user-data-dir=' + require('os').tmpdir() + '\\irodori-atk', 'about:blank'],
    { stdio: 'ignore' });
  let tab = null;
  for (let i = 0; i < 60 && !tab; i++) {
    try { tab = await getJSON('/json/new?' + encodeURIComponent('http://127.0.0.1:8765/'), 'PUT'); }
    catch (e) { await sleep(250); }
  }
  if (!tab) { console.log('Chrome нээгдсэнгүй'); chrome.kill(); process.exit(2); }
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const w = new Map(); let errs = [];
  ws.onmessage = e2 => {
    const m = JSON.parse(e2.data);
    if (m.id && w.has(m.id)) { const x = w.get(m.id); w.delete(m.id); m.error ? x.rej(new Error(JSON.stringify(m.error))) : x.res(m.result); }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      errs.push(String((d.exception || {}).description || d.text).slice(0, 200));
    }
  };
  const send = (method, params) => new Promise((res, rej) => {
    const i = ++id; w.set(i, { res, rej });
    ws.send(JSON.stringify({ id: i, method, params: params || {} }));
    setTimeout(() => { if (w.has(i)) { w.delete(i); rej(new Error('TIMEOUT ' + method)); } }, 25000);
  });
  const ev = async expr => {
    const r = await send('Runtime.evaluate', {
      expression: '(async()=>{' + expr + '})()', awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) return '__ХАЯВ__ ' + (r.exceptionDetails.exception
      ? r.exceptionDetails.exception.description : r.exceptionDetails.text);
    return r.result.value;
  };
  const ready = async () => {
    for (let i = 0; i < 80; i++) {
      if (await ev('return typeof ALL !== "undefined" && ALL.length > 0')) return true;
      await sleep(250);
    }
    return false;
  };
  const reload = async () => {
    errs = [];
    await send('Page.enable');
    await send('Page.navigate', { url: 'http://127.0.0.1:8765/?t=' + Date.now() });
    await sleep(400);
    return ready();
  };
  await send('Runtime.enable');
  await ready();

  /* ── A · ХОРТОЙ НӨӨЦ ФАЙЛ ─────────────────────────────────────── */
  console.log('\n[A] Хортой нөөц файл импортлох (жинхэнэ зам)');
  const imp = async payload => ev(`
    const данные = ${JSON.stringify(JSON.stringify(payload))};
    let alerted = null;
    const _a = window.alert; window.alert = m => { alerted = m; };
    try {
      document.getElementById('file-import').onchange({
        target: { files: [ { text: () => Promise.resolve(данные) } ] } });
      await new Promise(r => setTimeout(r, 500));
    } catch (e) { window.alert = _a; return '__ХАЯВ__ ' + e.message; }
    window.alert = _a;
    // Импортын дараа апп ажиллаж байх ЁСТОЙ.
    try { refreshHome(); refreshStats(); go('irodori'); go('home'); }
    catch (e) { return '__ХАЯВ__ дараа нь: ' + e.message; }
    return null;
  `);

  rep('A1 les нь мөр', await imp({ settings: { book: 'starter', les: 'ХОРТОЙ' } }));
  rep('A2 book нь байхгүй ном', await imp({ settings: { book: '../../etc/passwd', les: {} } }));
  rep('A3 kgroups нь тоо', await imp({ settings: { kgroups: 42, les: {} } }));
  rep('A4 goal = 0 (тэгд хуваах)', await imp({ settings: { goal: 0, les: {} } }));
  rep('A5 les.starter нь объект', await imp({ settings: { les: { starter: { a: 1 } } } }));
  rep('A6 явц нь null/тоо/мөр', await imp({
    progress: { 'L01-001': null, 'L01-002': 5, 'L01-003': 'мөр', 'L01-004': [1, 2] } }));
  rep('A7 явцын утга нь NaN/Infinity', await imp({
    progress: { 'L01-001': { n: 'abc', b: 1e400, d: -1e9, c: null, w: {} } } }));
  rep('A8 settings нь массив', await imp({ settings: [1, 2, 3] }));
  rep('A9 progress нь мөр', await imp({ progress: 'бүхэлдээ мөр' }));
  rep('A10 __proto__ бохирдуулалт', await ev(`
    const payload = '{"progress":{"__proto__":{"ЭЗЭМДСЭН":1},"L01-001":{"n":1,"b":1}}}';
    const _a = window.alert; window.alert = () => {};
    document.getElementById('file-import').onchange({
      target: { files: [ { text: () => Promise.resolve(payload) } ] } });
    await new Promise(r => setTimeout(r, 400));
    window.alert = _a;
    const bad = ({}).ЭЗЭМДСЭН === 1;
    delete Object.prototype['ЭЗЭМДСЭН'];
    return bad ? 'Object.prototype бохирдов' : null;
  `));

  /* ── B · ГАРААР ЗАССАН localStorage → ДАХИН АЧААЛАХ ───────────── */
  console.log('\n[B] localStorage-ийг гараар эвдээд ДАХИН ачаалах');
  const boot = async (p, s) => {
    await ev(`
      localStorage.setItem('irodori.progress.v1', ${JSON.stringify(p)});
      localStorage.setItem('irodori.settings.v1', ${JSON.stringify(s)});
      return 1;`);
    const ok = await reload();
    const real = errs.filter(e => !/audio|mp3|Failed to load resource/i.test(e));
    return !ok ? 'апп ачаалагдсангүй'
      : real.length ? ('уналт: ' + real[0].slice(0, 120)) : null;
  };
  rep('B1 эвдэрсэн JSON', await boot('{эвдэрсэн', 'БУРУУ'));
  rep('B2 les нь мөр', await boot('{}', '{"book":"starter","les":"ХОРТОЙ"}'));
  rep('B3 kgroups нь тоо', await boot('{}', '{"kgroups":42,"les":{}}'));
  rep('B4 явц нь null', await boot('{"L01-001":null,"L01-002":7}', '{}'));
  rep('B5 settings нь массив', await boot('{}', '[1,2,3]'));
  rep('B6 goal = 0', await boot('{}', '{"goal":0,"les":{}}'));

  await ev(`localStorage.clear(); return 1;`);
  await reload();

  /* ── C · XSS ──────────────────────────────────────────────────── */
  console.log('\n[C] XSS — атрибут ба HTML');

  // Атрибутаас ГАРЧ чадах уу. DOM-оор шалгана, мөрөөр БИШ:
  // `onmouseover=&quot;` гэсэн ТЕКСТ нь аюулгүй, атрибут нь аюултай.
  rep('C1 атрибутаас гарах (DOM шалгалт)', await ev(`
    const evil = { id: 'A" onmouseover="window.__x=1" y="', lesson: 1, jp: 'а',
                   kana: 'а', mn: 'а', accent: '', romaji: '', ref: false,
                   section: '', ex: 'жишээ' };
    AUDIO_IDS = new Set(['EX-' + evil.id, evil.id]);
    deck = 'vocab'; cur = evil; mode = 'flash';
    try { reveal(); } catch (e) { return 'reveal унав: ' + e.message; }
    const btn = document.querySelector('#a-kj .rsp');
    if (!btn) return 'товч үүсээгүй';
    const attrs = [...btn.attributes].map(x => x.name);
    const bad = attrs.filter(n => n.indexOf('on') === 0 || n === 'y');
    return bad.length ? ('шинэ атрибут үүсэв: ' + bad.join(', ')) : null;
  `));

  rep('C2 HTML тарих (jp/kana/mn)', await ev(`
    window.__x2 = 0;
    const evil = { id: 'E1', lesson: 1, jp: '<img src=x onerror="window.__x2=1">',
                   kana: '<svg onload="window.__x2=1">',
                   mn: '<iframe srcdoc="<script>parent.__x2=1<\\/script>">',
                   accent: '', romaji: '', ref: false, section: '' };
    ALL = [evil]; deck = 'vocab'; mode = 'flash'; pool = [evil];
    queue = [evil]; cur = evil;
    try { reveal(); buildRing(); } catch (e) { return 'унав: ' + e.message; }
    await new Promise(r => setTimeout(r, 400));
    return window.__x2 ? 'СКРИПТ АЖИЛЛАВ' : null;
  `));

  rep('C3 өргөлтийн тэмдэглэгээгээр', await ev(`
    window.__x3 = 0;
    const evil = { id: 'E2', lesson: 1, jp: 'а', kana: 'а', mn: 'а',
                   accent: '<img src=x onerror="window.__x3=1">', romaji: '',
                   ref: false, section: '' };
    deck = 'vocab'; cur = evil; mode = 'flash';
    try { reveal(); } catch (e) { return 'унав: ' + e.message; }
    await new Promise(r => setTimeout(r, 300));
    return window.__x3 ? 'СКРИПТ АЖИЛЛАВ' : null;
  `));

  /* ── D · Клиентийн DoS ────────────────────────────────────────── */
  console.log('\n[D] Клиентийн DoS');
  rep('D1 1 МБ хариулт бичих', await ev(`
    const t0 = Date.now();
    try { toKana('あ'.repeat(1000000)); } catch (e) { return 'унав: ' + e.message; }
    const dt = Date.now() - t0;
    return dt > 5000 ? ('toKana ' + dt + 'мс') : null;
  `));
  rep('D2 editDist 3000 тэмдэгт', await ev(`
    const t0 = Date.now();
    try { editDist('あ'.repeat(3000), 'い'.repeat(3000)); }
    catch (e) { return 'унав: ' + e.message; }
    const dt = Date.now() - t0;
    return dt > 5000 ? (dt + 'мс') : null;
  `));
  rep('D3 200k бичлэгтэй явц уусгах', await ev(`
    const big = {};
    for (let i = 0; i < 200000; i++) big['X' + i] = { n:1, b:1, c:1, w:0, d:0 };
    const t0 = Date.now();
    try { mergeProgress({}, big); } catch (e) { return 'унав: ' + e.message; }
    const dt = Date.now() - t0;
    return dt > 5000 ? ('mergeProgress ' + dt + 'мс') : null;
  `));

  /* ── E · URL ──────────────────────────────────────────────────── */
  console.log('\n[E] URL-ээр дамжуулан');
  rep('E1 hash-д script', await ev(`
    window.__x4 = 0;
    location.hash = '#m=flash&x=<img src=x onerror="window.__x4=1">';
    const _a = window.alert; window.alert = () => {};
    try { autoStart(); } catch (e) { window.alert = _a; return 'унав: ' + e.message; }
    await new Promise(r => setTimeout(r, 400));
    window.alert = _a; location.hash = ''; show('home');
    return window.__x4 ? 'ажиллав' : null;
  `));

  const real = errs.filter(e => !/audio|mp3|Failed to load resource/i.test(e));
  rep('F1 барьсангүй уналт гараагүй', real.length ? real[0].slice(0, 140) : null);

  ws.close(); chrome.kill();
  console.log('\n' + '─'.repeat(52));
  console.log('эвдэрсэн: ' + hits + '   тэссэн: ' + safe);
  if (found.length) { console.log('\nОЛДВОР:'); found.forEach(f => console.log('  · ' + f)); }
  process.exit(hits ? 1 : 0);
})().catch(e => { console.error('УНАВ:', e.message); process.exit(2); });
