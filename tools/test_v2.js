/* v2 (KOTO) — UI ба АХИЦЫН СИНКИЙН тест.
 *
 * v1-ийн `test_ui.js`-ээс ТУСДАА: v2 нь өөр өгөгдөл, өөр DOM, өөр
 * хадгалалттай. Нэг файлд хийвэл аль аппын шалгуур унасан нь
 * тодорхойгүй болно.
 *
 * ЯАГААД `window.KOTO` ХЭРЭГТЭЙ: v2-ийн `app.js` нь IIFE тул гаднаас
 * `kotoMerge`-д хандах өөр арга алга. Тэр функц нь `koto_put` дахь
 * SQL-тэй ИЖИЛ дүрэмтэй байх ёстой — хоёр нь салж явбал хоёр
 * төхөөрөмж нийлүүлэхэд нэг талын ахиц алдагдана. SQL талыг
 * `test_sql.js` шалгадаг; энд КЛИЕНТ талыг шалгана.
 *
 * Ажиллуулах:
 *     python -m http.server 8765 --bind 127.0.0.1     (репогийн үндсээс)
 *     node tools/test_v2.js
 */
'use strict';
const { spawn } = require('child_process');
const http = require('http');
const DBG = 9233;
const SITE = process.env.SITE_V2 || 'http://127.0.0.1:8765/v2/';
const CHROME = process.env.CHROME
  || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let bad = 0, good = 0;
const fails = [];
function ok(name, pass, extra) {
  if (pass) { good++; console.log('  ok   ' + name); }
  else { bad++; fails.push(name + (extra ? ' — ' + extra : '')); console.log('  FAIL ' + name + (extra ? '  ' + extra : '')); }
}

function getJSON(path, method) {
  return new Promise((res, rej) => {
    const req = http.request({ host: '127.0.0.1', port: DBG, path, method: method || 'GET' },
      r => { let b = ''; r.on('data', c => b += c); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); });
    req.on('error', rej); req.end();
  });
}

(async () => {
  const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + DBG,
    '--no-first-run', '--disable-gpu', '--mute-audio', '--window-size=1400,900',
    '--user-data-dir=' + require('os').tmpdir() + '\\kotov2-' + Date.now(),
    'about:blank'], { stdio: 'ignore' });

  let tab = null;
  for (let i = 0; i < 60 && !tab; i++) {
    try { tab = await getJSON('/json/new?' + encodeURIComponent(SITE), 'PUT'); }
    catch (e) { await sleep(250); }
  }
  if (!tab) { console.log('Chrome neegdsengui'); chrome.kill(); process.exit(2); }

  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const w = new Map(); const errs = []; let onPaused = null;
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && w.has(m.id)) { const x = w.get(m.id); w.delete(m.id); m.error ? x.rej(new Error(JSON.stringify(m.error))) : x.res(m.result); }
    if (m.method === 'Fetch.requestPaused' && onPaused) onPaused(m.params);
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      errs.push(String((d.exception || {}).description || d.text).slice(0, 200));
    }
  };
  const send = (method, params) => new Promise((res, rej) => {
    const i = ++id; w.set(i, { res, rej });
    ws.send(JSON.stringify({ id: i, method, params: params || {} }));
  });
  await send('Runtime.enable');
  /* §2.116: локал хамгаалалт эвдэрвэл хуудас ачаалахад `ping` БОДИТ сервер рүү явдаг (мутацаас 2 мөр орсон) — тестийн явцад сүлжээнд хаана. */
  await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['*/rest/v1/rpc/ping*'] });
  const ev = async expr => {
    const r = await send('Runtime.evaluate', {
      expression: '(async()=>{' + expr + '})()',
      awaitPromise: true, returnByValue: true,
    });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300));
    return r.result.value;
  };

  console.log('\n[1] Ачаалалт');
  let up = false;
  for (let i = 0; i < 40 && !up; i++) {
    try { up = await ev('return !!window.KOTO && !!document.querySelector("#view-learn .hero");'); }
    catch (e) {}
    if (!up) await sleep(250);
  }
  ok('v2 ачаалагдав, тестийн гарц бий', up);
  /* Үгийн сан (2026-11-05): Irodori 3 ном → 3 түвшин → утгын нэгж → 5 үгийн хичээл (tools/build_v2_vocab.py).
     Тоог өгөгдлөөс биш, тестийн өөрийн тодорхойлолтоор (§2.91): нэгж бүр 12–40, хичээл ≤ 5, үг давхардахгүй. */
  const vs = await ev(`
    const V = window.KOTO.vocab, U = V.units(), L = V.lessons(), W = window.KOTO.words();
    const ids = W.map(w => w.id), lv = V.levels().map(l => l.key);
    return { levels: lv.join(), units: U.length, words: W.length, uniq: new Set(ids).size, lessons: L.length,
             perLevel: lv.map(k => U.filter(u => u.level === k).length).join(),
             sizes: U.every(u => u.words.length >= 12 && u.words.length <= 40), five: L.every(l => l.words.length >= 1 && l.words.length <= 5),
             keys: U.every((u, i) => /^A(1|2a|2b)-\\d\\d$/.test(u.key) && (i === 0 || U[i - 1].level === u.level || lv.indexOf(U[i - 1].level) < lv.indexOf(u.level))),
             first: U[0].title, firstTheme: U[0].theme, au: W.filter(w => w.au).length,
             extra: V.extra().length, extraOnPath: V.extra().filter(x => ids.includes(x.id)).length,
             legacy: Object.keys(V.legacy()).length, legacyTargets: [...new Set(Object.values(V.legacy()))].filter(id => !W.some(w => w.id === id && w.level === 'A1')).length,
             navCount: document.querySelector('.nav-count').textContent,
             heroUnits: [...document.querySelectorAll('.hero-mini strong')].map(x => x.textContent)[1] };
  `);
  ok('3 түвшин A1 → A2a → A2b, 147 нэгж (55 · 39 · 53), 2994 үг давхардалгүй, 664 хичээл',
    vs && vs.levels === 'A1,A2a,A2b' && vs.units === 147 && vs.perLevel === '55,39,53' && vs.words === 2994 && vs.uniq === 2994 && vs.lessons === 664,
    JSON.stringify(vs));
  ok('нэгж бүр 12–40 үг, хичээл бүр 1–5 үг, нэгжийн түлхүүр түвшнээрээ дараалсан (A1-01 …)',
    vs && vs.sizes && vs.five && vs.keys, JSON.stringify(vs && { s: vs.sizes, f: vs.five, k: vs.keys }));
  ok('эхний нэгж — мэндчилгээ (суурь эхэнд); үг бүр бичлэгтэй; 参考 707 нь замд ороогүй (販売中 засвараар 1 нь замын үгтэй нийлэв)',
    vs && vs.firstTheme === 'greet' && vs.au === vs.words && vs.extra === 707 && vs.extraOnPath === 0, JSON.stringify(vs));
  ok('хуучин 432 байрлалын id бүгд A1-ийн үгэнд очно (ахиц алдагдахгүй)',
    vs && vs.legacy === 432 && vs.legacyTargets === 0, JSON.stringify(vs && { n: vs.legacy, lost: vs.legacyTargets }));
  ok('цэсний тоо = нийт үг, нүүрэнд «147 нэгж»',
    vs && vs.navCount === String(vs.words) && vs.heroUnits === '147', JSON.stringify(vs && { nav: vs.navCount, hero: vs.heroUnits }));

  /* Ахицын шилжүүлэлт: хуучин `сэдэв:дугаар` түлхүүр → тогтвортой id. 6:25 ба 16:80 (げつようび) нэг үгэнд
     нийлнэ — СҮҮЛД үзсэн нь `weak` тул тэр ялна (kotoMerge-ийн дүрэм). Серверээс ирсэн ч (readFrom) ижил. */
  const mg = await ev(`
    const V = window.KOTO.vocab, legacy = V.legacy();
    const raw = { version:1, xp:40, selectedTopic:3, completed:['0-0','1-2'],
      words:{ '0:0':{passes:2,due:'2026-01-05',last:'2026-01-02'}, '6:25':{passes:3,due:'2026-02-01',last:'2026-01-10'},
              '16:80':{passes:0,weak:true,due:'2026-01-20',last:'2026-01-20'}, 'J-65E5':{passes:1,due:'2026-01-03',last:'2026-01-01'} },
      days:{ '2026-01-20':['0:0','16:80','6:25'] }, kana:{}, xpd:{} };
    /* Бүх үг нь хуучин 432-оос гаралтай нэг хичээлийн үгсийг ХУУЧИН түлхүүрээр → тэр хичээл «дууссан» болох ёстой. */
    const back = {}; for (const [o, n] of Object.entries(legacy)) if (!back[n]) back[n] = o;
    const full = V.lessons().find(l => l.words.length === 5 && l.words.every(w => back[w.id] && !['0:0','6:25','16:80'].includes(back[w.id])));
    full.words.forEach(w => { raw.words[back[w.id]] = {passes:1,due:'2026-01-06',last:'2026-01-05'}; });
    const keep = localStorage.getItem('koto-irodori-v1');
    const s = V.readFrom(raw), again = V.readFrom(JSON.parse(JSON.stringify(s)));
    if (keep === null) localStorage.removeItem('koto-irodori-v1'); else localStorage.setItem('koto-irodori-v1', keep);
    const w0 = legacy['0:0'], wm = legacy['6:25'];
    const L = V.lessons(), done = L.filter(l => l.words.every(w => s.words[w.id])).map(l => l.id);
    return { w0, wm, full: full.id, same: legacy['16:80'] === wm, keys: Object.keys(s.words).sort().join(), old: Object.keys(s.words).filter(k => /^\\d+:\\d+$/.test(k)).length,
             merged: s.words[wm], first: s.words[w0], kanji: !!s.words['J-65E5'],
             days: s.days['2026-01-20'].join(), completed: s.completed.join(), done: done.join(),
             idem: JSON.stringify(again.words) === JSON.stringify(s.words) && again.completed.join() === s.completed.join() };
  `);
  ok('шилжүүлэлт: 0:0 → ' + (mg && mg.w0) + ', хуучин түлхүүр 0, ханзны J- id хэвээр',
    mg && mg.old === 0 && mg.first && mg.first.passes === 2 && mg.kanji && mg.keys.split(',').length === 8, JSON.stringify(mg));
  ok('6:25 + 16:80 (げつようび) нэг үгэнд — сүүлд үзсэн weak ялна',
    mg && mg.same && mg.merged && mg.merged.weak === true && mg.merged.last === '2026-01-20', JSON.stringify(mg && mg.merged));
  ok('өдрийн ахиц шилжинэ, давхардалгүй (3 → 2 үг); хуучин дууссан хичээл (0-0) алга, бүх үг нь үзэгдсэн хичээл л «дууссан»',
    mg && mg.days === [mg.w0, mg.wm].join() && mg.completed === mg.done && mg.completed.split(',').includes(mg.full), JSON.stringify(mg && { d: mg.days, c: mg.completed, done: mg.done, full: mg.full }));
  ok('дахин уншихад (серверээс татах бүрд) үр дүн хэвээр — идэмпотент', mg && mg.idem, JSON.stringify(mg && mg.idem));

  /* Нүүр: түвшний таб ба зөвхөн тухайн түвшний нэгжүүд; сонголт энэ төхөөрөмжид (koto-v2-unit). */
  const ht = await ev(`
    const wait = ms => new Promise(r => setTimeout(r, ms)), U = window.KOTO.vocab.units();
    const grid = () => [...document.querySelectorAll('#view-learn .topic-card')].map(b => U[+b.dataset.topic].level);
    const out = { tabs: [...document.querySelectorAll('#view-learn .level-tab')].map(b => b.textContent).join('|'), a1: grid() };
    document.querySelectorAll('#view-learn .level-tab')[2].click(); await wait(100);
    out.a2b = grid(); out.pressed = [...document.querySelectorAll('#view-learn .level-tab')].map(b => b.getAttribute('aria-pressed')).join();
    const card = document.querySelectorAll('#view-learn .topic-card')[3]; const t = +card.dataset.topic; card.click(); await wait(100);
    out.title = document.querySelector('#current-unit .unit-title').textContent; out.want = U[t].title;
    out.stored = localStorage.getItem('koto-v2-unit') === U[t].key; out.sel = window.KOTO.vocab.selected() === t;
    document.querySelectorAll('#view-learn .level-tab')[0].click(); await wait(100);
    return out;`);
  ok('нүүр: 3 түвшний таб, зөвхөн сонгосон түвшний нэгж (A1 55, A2b 53); нэгж сонгоход гарчиг солигдож, төхөөрөмжид хадгална',
    ht && /Суурь шат/.test(ht.tabs) && ht.a1.length === 55 && ht.a1.every(l => l === 'A1') && ht.a2b.length === 53 && ht.a2b.every(l => l === 'A2b') &&
      ht.pressed === 'false,false,true' && ht.title === ht.want && ht.stored && ht.sel, JSON.stringify(ht));

  /* Өгүүлбэр: тулгуур үгийн хичээлийн төгсгөлд (v2/sentences.js `w`). */
  const sq = await ev(`
    const wait = ms => new Promise(r => setTimeout(r, ms)), V = window.KOTO.vocab, U = V.units();
    const run = async w => { const id = V.lessonOf(w), l = V.lessons().find(x => x.id === id);
      document.querySelector('#view-learn .level-tab').click(); await wait(50);
      document.querySelector('#view-learn .topic-card[data-topic="' + l.topic + '"]').click(); await wait(100);
      document.querySelector('#current-unit .node-button[data-lesson="' + id + '"]').click(); await wait(150);
      const s = window.KOTO.numTest.session(), q = s.queue, last = q[q.length - 1];
      const r = { id: s.lesson && s.lesson.id, want: id, last: last.type, n: q.filter(x => x.type === 'sentence').length,
                  tokens: last.sentence ? last.sentence.tokens.join(' ') : null, mn: last.sentence ? last.sentence.mn : null };
      document.getElementById('lesson-dialog').close(); return r; };
    const dare = window.KOTO_SENTENCES.find(x => x.tokens.join(' ') === 'だれ です か');
    const birth = window.KOTO_SENTENCES.find(x => x.tokens.join(' ') === 'わたし は にせんよねん くがつ はつか に うまれました');
    const noSent = V.lessons().find(l => !V.sentences()[l.id]);
    const out = { a: await run(dare.w), b: await run(birth.w), lessonsWith: Object.keys(V.sentences()).length };
    out.c = await run(noSent.words[0].id);
    return out;`);
  ok('өгүүлбэр тулгуур үгийнхээ хичээлд: «だれ です か» — сүүлийн дасгал, ганц',
    sq && sq.a.id === sq.a.want && sq.a.last === 'sentence' && sq.a.n === 1 && sq.a.tokens === 'だれ です か', JSON.stringify(sq && sq.a));
  ok('эзний төрсөн өдөр «わたし は にせんよねん くがつ はつか に うまれました» өөрийн хичээлд',
    sq && sq.b.id === sq.b.want && sq.b.tokens === 'わたし は にせんよねん くがつ はつか に うまれました' && /2004/.test(sq.b.mn), JSON.stringify(sq && sq.b));
  ok('өгүүлбэргүй хичээлд өгүүлбэрийн алхам алгасагдана (91 өгүүлбэр → ' + (sq && sq.lessonsWith) + ' хичээл)',
    sq && sq.c.n === 0 && sq.c.last === 'quiz' && sq.lessonsWith >= 60, JSON.stringify(sq && sq.c));

  /* Тооны шалгалт: дуудлага өөрчлөгддөг тоо (хүснэгт) + үүсгэсэн огноо/цаг. Үг нь A1-ийн тоо/цагийн нэгжээс. */
  const nt = await ev(`
    const T = window.KOTO.numTest, V = window.KOTO.vocab, U = V.units(), wait = ms => new Promise(r => setTimeout(r, ms));
    const out = { months: T.MONTHS.length, days: T.DAYS.length, hours: T.HOURS.length,
                  m4: T.MONTHS[3], m7: T.MONTHS[6], m9: T.MONTHS[8], d1: T.DAYS[0], d14: T.DAYS[13],
                  d20: T.DAYS[19], d24: T.DAYS[23], h4: T.HOURS[3], h9: T.HOURS[8] };
    let okDate = true, okTime = true;
    for (let i = 0; i < 300; i++) {
      const d = T.genDate(), m = /^(\\d+)-р сарын (\\d+)$/.exec(d.mn);
      if (!m || d.jp !== T.MONTHS[m[1] - 1] + ' ' + T.DAYS[m[2] - 1] || +m[2] > [31,29,31,30,31,30,31,31,30,31,30,31][m[1] - 1]) okDate = false;
      const t = T.genTime(), h = /^(\\d+) цаг/.exec(t.mn);
      if (!h || !t.jp.startsWith(T.HOURS[h[1] - 1])) okTime = false;
    }
    out.okDate = okDate; out.okTime = okTime;
    const num = V.num(); out.numUnits = num.map(i => U[i].level + ':' + U[i].theme).join();
    const b = T.build();
    out.qn = b.queue.length; out.gen = b.queue.filter(q => q.word.gen).length;
    out.opts = b.queue.every(q => q.options.length === 4 && new Set(q.options).size === 4 && q.options.includes(q.correct));
    out.numOnly = b.words.every(w => num.includes(w.topic));
    // UI: тооны нэгжийн картаас эхлүүлж, бүгдийг зөв хариулаад дуусгана.
    document.querySelector('#view-learn .level-tab').click(); await wait(50);
    document.querySelector('#view-learn .topic-card[data-topic="' + num[0] + '"]').click(); await wait(100);
    const btn = document.querySelector('#current-unit [data-action="test"]');
    out.btn = !!btn; btn.click(); await wait(150);
    out.meta = document.querySelector('#lesson-content .lesson-meta span').textContent;
    const S = T.session();
    for (let i = 0; i < 40 && !S.completed; i++) {
      const q = S.queue[S.pos];
      document.querySelectorAll('#lesson-content [data-action="choose"]')[q.options.indexOf(q.correct)].click();
      document.querySelector('#lesson-content [data-action="check"]').click();
      document.querySelector('#lesson-content [data-action="next"]').click();
    }
    out.done = S.completed; out.title = (document.querySelector('#lesson-content .completion h1') || {}).textContent;
    out.genSaved = Object.keys(window.KOTO.state().words).some(k => k.startsWith('gen-'));
    document.getElementById('lesson-dialog').close();
    document.querySelector('#view-learn .topic-card[data-topic="0"]').click(); await wait(100);
    out.noBtn0 = !document.querySelector('#current-unit [data-action="test"]');
    return out;
  `);
  ok('тооны хүснэгт: 12 сар · 31 өдөр · 12 цаг; しがつ/しちがつ/くがつ, ついたち/じゅうよっか/はつか/にじゅうよっか, よじ/くじ',
    nt && nt.months === 12 && nt.days === 31 && nt.hours === 12 && nt.m4 === 'しがつ' && nt.m7 === 'しちがつ' && nt.m9 === 'くがつ'
      && nt.d1 === 'ついたち' && nt.d14 === 'じゅうよっか' && nt.d20 === 'はつか' && nt.d24 === 'にじゅうよっか'
      && nt.h4 === 'よじ' && nt.h9 === 'くじ', JSON.stringify(nt));
  ok('үүсгэсэн огноо/цаг 300 удаа — монгол ба япон нь таарна, байхгүй өдөр (2/30) гарахгүй',
    nt && nt.okDate && nt.okTime, JSON.stringify(nt && { d: nt.okDate, t: nt.okTime }));
  ok('шалгалт 20 асуулт (огноо/цаг 6), асуулт бүр 4 давхардалгүй сонголт, үг нь зөвхөн A1-ийн тоо/цагийн нэгжээс',
    nt && nt.qn === 20 && nt.gen === 6 && nt.opts && nt.numOnly && nt.numUnits && nt.numUnits.split(',').every(x => /^A1:(num|time)$/.test(x)), JSON.stringify(nt));
  ok('«Тооны шалгалт» товчоор эхэлж, бүгдийг зөв хариулахад «Шалгалт дууслаа!»; үүсгэсэн асуулт ахицад бичигдэхгүй',
    nt && nt.btn && /Тооны шалгалт/.test(nt.meta) && nt.done && nt.title === 'Шалгалт дууслаа!' && !nt.genSaved,
    JSON.stringify(nt));
  ok('тооны бус нэгжид (мэндчилгээ) шалгалтын товч гарахгүй', nt && nt.noBtn0, JSON.stringify(nt && nt.noBtn0));
  ok('синкийн тохиргоо v1-ээс ачаалагдав (../sync-config.js)',
    await ev('return !!(window.SYNC_CONFIG && window.SYNC_CONFIG.url) && window.KOTO.on() === true;'));

  console.log('\n[2] kotoMerge — SQL-тэй ИЖИЛ дүрэм');
  /* Эдгээр нь `test_sql.js`-ийн [KOTO] хэсэгтэй ЯГ ижил өгөгдөл:
     хоёр хэрэгжүүлэлт салж явбал энд ялгаа гарна. */
  const m = await ev(`
    const A = { version:1, xp:120, completed:['t0-l0','t0-l1'],
      words:{ w1:{passes:2,weak:false,due:'2026-11-01',last:'2026-10-29'}, w2:{passes:0,weak:true,due:'2026-10-24',last:'2026-10-23'},
              w4:{passes:3,weak:false,due:'2026-10-29',last:'2026-10-22'}, w5:{passes:3,weak:false,due:'2026-11-05',last:'2026-10-29'} },
      days:{ '2026-10-23':['w1','w2'] }, selectedTopic:3 };
    const B = { version:1, xp:80, completed:['t0-l1','t0-l2'],
      words:{ w1:{passes:0,weak:true,due:'2026-10-24',last:'2026-10-23'}, w3:{passes:1,weak:false,due:'2026-10-30',last:'2026-10-29'},
              w4:{passes:1,weak:false,due:'2026-11-02',last:'2026-11-01'}, w5:{passes:0,weak:true,due:'2026-11-02',last:'2026-11-01'} },
      days:{ '2026-10-23':['w3'], '2026-10-24':['w1'] }, selectedTopic:7 };
    const r = window.KOTO.merge(A, B);
    return { xp:r.xp, comp:r.completed.slice().sort(), w1:r.words.w1, w4:r.words.w4, w5:r.words.w5,
             wKeys:Object.keys(r.words).sort(), d23:(r.days['2026-10-23']||[]).slice().sort(),
             d24:r.days['2026-10-24'], topic:r.selectedTopic };
  `);
  ok('XP — ИХ нь ялна (120)', m && m.xp === 120, JSON.stringify(m && m.xp));
  ok('дуусгасан хичээл — НЭГДЭЛ (3)',
    m && m.comp.length === 3 && m.comp.join() === 't0-l0,t0-l1,t0-l2', JSON.stringify(m && m.comp));
  ok('үгийн хуваарь — хуучин алдалт шинэ ахицыг дарахгүй (w1 passes 2)',
    m && m.w1 && m.w1.passes === 2 && m.w1.weak === false, JSON.stringify(m && m.w1));
  ok('№33: 3 удаа зөв хариулсан ахиц УХРАХГҮЙ (w4 passes 3)',
    m && m.w4 && m.w4.passes === 3 && m.w4.due === '2026-11-02', JSON.stringify(m && m.w4));
  ok('саяхан мартсан нь ялна (w5 weak)',
    m && m.w5 && m.w5.weak === true && m.w5.passes === 0, JSON.stringify(m && m.w5));
  ok('шинэ үг хоёр талаас хадгалагдана (w1…w5)',
    m && m.wKeys.join() === 'w1,w2,w3,w4,w5', JSON.stringify(m && m.wKeys));
  ok('өдрийн ахиц — НЭГДЭЛ (10-23-д 3 үг)',
    m && m.d23.length === 3 && Array.isArray(m.d24), JSON.stringify(m && { a: m.d23, b: m.d24 }));
  ok('selectedTopic — ХОЙД нь (7)', m && m.topic === 7, JSON.stringify(m && m.topic));

  const edge = await ev(`
    const K = window.KOTO.merge;
    return { nul: JSON.stringify(K(null, null)),
             str: JSON.stringify(K('x', 5)),
             badXp: K({xp:'abc'}, {xp:7}).xp,
             badWords: JSON.stringify(K({words:'x'}, {words:[1,2]}).words),
             badDays: JSON.stringify(K({days:7}, {days:{a:'x'}}).days) };
  `);
  ok('хорлонтой/эвдэрсэн өгөгдөл дээр УНАХГҮЙ',
    edge && edge.badXp === 7 && edge.badWords === '{}' && edge.nul.indexOf('"xp":0') > 0,
    JSON.stringify(edge));

  console.log('\n[3] Нэвтрэх — зөвхөн Google (11-05: нууц кодын синк хасагдсан)');
  const acc = await ev(`
    const b = document.getElementById('open-sync');
    return { act: b ? b.dataset.action || '' : null, view: b ? b.dataset.view || '' : null,
             text: b ? b.textContent.trim() : '', dis: b ? b.disabled : null,
             dialog: !!document.getElementById('sync-dialog'),
             input: !!document.querySelector('#sync-code, input[minlength="8"]'),
             codeApi: 'code' in window.KOTO };
  `);
  ok('хажуугийн цэс «Нэвтрэх» → google-in (идэвхтэй); синкийн цонх, кодын талбар, KOTO.code АЛГА',
    acc && acc.act === 'google-in' && !acc.view && /Нэвтрэх/.test(acc.text) && acc.dis === false
      && !acc.dialog && !acc.input && !acc.codeApi, JSON.stringify(acc));

  // Хуучин хэрэглэгчийн хадгалсан нууц код ҮЛ ТООГДОНО (устгахгүй, синк хийхгүй).
  await ev(`localStorage.setItem('koto-sync-code', 'zz-legacy-code-01'); return true;`);
  await send('Page.reload', {});
  for (let i = 0; i < 40; i++) { await sleep(150); try { if (await ev('return !!window.KOTO')) break; } catch (e) {} }
  await sleep(400);
  const legacy = await ev(`return { mode: window.KOTO.mode(), kept: localStorage.getItem('koto-sync-code'),
    save: document.getElementById('save-status').textContent };`);
  await ev(`localStorage.removeItem('koto-sync-code'); return true;`);
  ok('хуучин `koto-sync-code` байсан ч mode="" (синкгүй), түлхүүр устаагүй, footer «хөтөч дээр»',
    legacy && legacy.mode === '' && legacy.kept === 'zz-legacy-code-01' && /хөтөч дээр/.test(legacy.save), JSON.stringify(legacy));

  /* «Нэвтрэх» нь Google руу ШУУД (цонхгүй). Жинхэнэ Google руу явуулахгүй:
     authorize хүсэлтийг CDP Fetch-ээр барьж цуцална — хуудас хэвээр үлдэнэ. */
  let authUrl = null;
  await send('Fetch.enable', { patterns: [{ urlPattern: '*/auth/v1/authorize*', requestStage: 'Request' }] });
  onPaused = p => { authUrl = p.request.url; send('Fetch.failRequest', { requestId: p.requestId, errorReason: 'Aborted' }); };
  await ev(`localStorage.removeItem('koto-pkce'); document.getElementById('open-sync').click(); return true;`);
  for (let i = 0; i < 40 && !authUrl; i++) await sleep(100);
  await sleep(400);
  onPaused = null;
  await send('Fetch.disable', {});
  const go = await ev(`return { pkce: !!localStorage.getItem('koto-pkce'), app: !!window.KOTO,
    dialog: !!document.querySelector('dialog[open]') };`);
  await ev(`localStorage.removeItem('koto-pkce'); return true;`);
  ok('«Нэвтрэх» → шууд Google: authorize?provider=google + PKCE challenge, verifier хөтөч дээр, цонх нээгдээгүй',
    !!authUrl && /provider=google/.test(authUrl) && /code_challenge=/.test(authUrl) && /code_challenge_method=s256/.test(authUrl)
      && go.pkce && go.app && !go.dialog, JSON.stringify({ authUrl: authUrl && authUrl.slice(0, 120), go }));

  console.log('\n[4] Ахиц хадгалагдана (localStorage)');
  const store = await ev(`
    const node = document.querySelector('.node-button:not(:disabled)');
    if (!node) return { e: 'хичээл алга' };
    node.click(); await new Promise(r => setTimeout(r, 400));
    for (let i = 0; i < 400; i++) {
      if (document.querySelector('.completion')) break;
      const btn = document.querySelector('.lesson-bottom .primary-btn');
      const sel = document.querySelector('.choice.selected, .choice[aria-pressed="true"]');
      const ch = [...document.querySelectorAll('.choice:not(:disabled)')];
      const tok = [...document.querySelectorAll('.token-bank .token:not(.used)')];
      if (btn && !btn.disabled && (sel || !ch.length)) btn.click();
      else if (ch.length) ch[0].click();
      else if (tok.length) tok[0].click();
      else break;
      await new Promise(r => setTimeout(r, 110));
    }
    const raw = localStorage.getItem('koto-irodori-v1');
    const st = raw ? JSON.parse(raw) : null;
    return { done: !!document.querySelector('.completion'),
             xp: st ? st.xp : null, words: st ? Object.keys(st.words).length : null,
             completed: st ? st.completed.length : null,
             topXp: (document.getElementById('xp') || {}).textContent };
  `);
  ok('хичээл дуусав', store && store.done === true, JSON.stringify(store));
  ok('XP, үзсэн үг, дуусгасан хичээл хадгалагдав',
    store && store.xp > 0 && store.words > 0 && store.completed > 0, JSON.stringify(store));
  ok('дэлгэцийн XP нь төлөвтэй таарна',
    store && String(store.xp) === store.topXp, JSON.stringify(store && { st: store.xp, ui: store.topXp }));

  console.log('\n[4б] Хурдан засвар — ахицын зурвас, зорилго, дуу, шүүлтүүр, хадгалалт');
  /* Хичээлийг ЭХНЭЭС нь эхлүүлж, асуулт бүрт ЗОРИУД алдана. Шалгах зүйл:
     алдахад зурвас ухрахгүй, давталтын үе гарна, доод самбар төлөвийн
     класстай, бүх үгээ алдсан хичээл өдрийн зорилгод 0 үг нэмнэ. */
  /* Цэвэр төлөв: localStorage-ийг солиод ДАХИН АЧААЛНА. Ачаалалгүй бол апп
     санах ой дахь хуучин төлөвөө save()-ээр буцааж бичдэг (эхний ажиллуулалтад
     өмнөх хэсгийн 14 үг зорилгод орж, тест буруу дүгнэлт гаргав). */
  await ev(`localStorage.setItem('koto-irodori-v1', JSON.stringify({version:1,xp:0,completed:[],words:{},days:{},selectedTopic:0})); location.hash = 'learn';`);
  await send('Page.reload', {});
  for (let i = 0; i < 40; i++) { await sleep(150); try { if (await ev('return !!window.KOTO')) break; } catch (e) {} }
  await sleep(400);
  const qf = await ev(`
    const S = ms => new Promise(r => setTimeout(r, ms));
    document.querySelector('[data-action=start]').click(); await S(200);
    const width = () => parseFloat(document.querySelector('.progress-fill').style.width);
    const out = { regress: [], bottomCls: '', retryPhase: false, metaRetry: '', chip: false, soundBtn: false };
    out.soundBtn = !!document.querySelector('.lesson-top [data-action=sound]');
    for (let i = 0; i < 80; i++) {
      if (document.querySelector('.completion')) break;
      const fr = document.querySelector('.lesson-frame');
      if (fr && fr.classList.contains('is-retry-phase')) {
        out.retryPhase = true;
        out.metaRetry = document.querySelector('.lesson-meta span:last-child').textContent;
      }
      const nx = document.querySelector('[data-action=next]');
      if (nx && !document.querySelector('.choice') && !document.querySelector('.token-bank')) { nx.click(); await S(40); continue; }
      if (nx && document.querySelector('.lesson-bottom.is-correct, .lesson-bottom.is-incorrect')) { nx.click(); await S(40); continue; }
      const sess = window.KOTO.numTest.session(), q = sess.queue[sess.pos];
      const before = width();
      if (q.type === 'quiz') {
        const wrong = [...document.querySelectorAll('.choice')].find(b => b.textContent.trim().indexOf(q.correct) < 0);
        wrong.click(); await S(20);
      } else if (q.type === 'sentence') {
        const toks = [...document.querySelectorAll('.token-bank .token')].reverse();
        toks.forEach(t => t.click()); await S(20);
      }
      document.querySelector('[data-action=check]').click(); await S(40);
      const after = width();
      if (after < before - 0.001) out.regress.push(before + '->' + after);
      const lb = document.querySelector('.lesson-bottom');
      if (!out.bottomCls && lb) out.bottomCls = lb.className;
      if (document.querySelector('.retry-chip')) out.chip = true;
    }
    const st = JSON.parse(localStorage.getItem('koto-irodori-v1'));
    const day = Object.keys(st.days)[0];
    out.done = !!document.querySelector('.completion');
    out.dayIds = day ? st.days[day].length : 0;
    out.weak = Object.values(st.words).filter(w => w.weak).length;
    document.querySelector('[data-action=finish]').click(); await S(200);
    const ring = document.querySelector('.goal-ring');
    out.goal = ring ? ring.getAttribute('aria-label') : '';
    out.streak = document.getElementById('streak').textContent;
    return out;
  `);
  ok('алдахад ахицын зурвас УХРАХГҮЙ', qf && qf.regress.length === 0, JSON.stringify(qf && qf.regress));
  ok('давтах асуулт хүлээгдэж байхад «+N давтах» тэмдэг', qf && qf.chip, JSON.stringify(qf));
  ok('давталтын үе: .is-retry-phase, «Алдсан асуултууд · k / n»',
    qf && qf.retryPhase && /Алдсан асуултууд · \d+ \/ \d+/.test(qf.metaRetry), JSON.stringify(qf && qf.metaRetry));
  ok('шалгасны дараа доод самбар төлөвийн класстай (is-incorrect)',
    qf && /\bis-incorrect\b/.test(qf.bottomCls), JSON.stringify(qf && qf.bottomCls));
  ok('хичээлийн дотор дууны товч бий', qf && qf.soundBtn);
  /* Бүгдийг алдсан: идэвх (streak) тоологдоно, «бататгасан» зорилго 0. */
  ok('бүгдийг алдсан хичээл: streak 1 болно, гэвч зорилгод 0 үг',
    qf && qf.done && qf.dayIds === 5 && qf.weak === 5 && /Өнөөдөр 0,/.test(qf.goal) && qf.streak === '1',
    JSON.stringify(qf && { day: qf.dayIds, weak: qf.weak, goal: qf.goal, streak: qf.streak }));

  const snd = await ev(`
    const S = ms => new Promise(r => setTimeout(r, ms));
    localStorage.removeItem('koto-sound');
    document.querySelector('[data-action=start]').click(); await S(200);
    const b1 = document.querySelector('[data-action=sound]');
    const p1 = b1.getAttribute('aria-pressed');
    b1.click(); await S(60);
    const b2 = document.querySelector('[data-action=sound]');
    const r = { p1, p2: b2.getAttribute('aria-pressed'), stored: localStorage.getItem('koto-sound'), label: b2.getAttribute('aria-label') };
    b2.click(); await S(40);
    r.p3 = document.querySelector('[data-action=sound]').getAttribute('aria-pressed');
    r.stored3 = localStorage.getItem('koto-sound');
    document.querySelector('[data-action=exit]').click(); await S(60);
    document.querySelector('[data-action=discard]').click(); await S(120);
    return r;
  `);
  ok('дууны товч: асаах/унтраах, localStorage-д хадгална',
    snd && snd.p1 === 'true' && snd.p2 === 'false' && snd.stored === '0' && snd.p3 === 'true' && snd.stored3 === '1',
    JSON.stringify(snd));

  const flt = await ev(`
    const S = ms => new Promise(r => setTimeout(r, ms));
    location.hash = 'words'; await S(200);
    const inp = document.getElementById('word-search');
    inp.value = 'だれ'; inp.dispatchEvent(new Event('input', { bubbles: true })); await S(60);
    const n1 = document.querySelectorAll('#word-results .word-card').length;
    location.hash = 'learn'; await S(200);
    location.hash = 'words'; await S(200);
    return { n1, kept: document.getElementById('word-search').value,
             n2: document.querySelectorAll('#word-results .word-card').length };
  `);
  ok('үгийн сангийн хайлт цэс солиход хадгалагдана',
    flt && flt.kept === 'だれ' && flt.n1 === flt.n2 && flt.n1 > 0 && flt.n1 < 50, JSON.stringify(flt));
  await ev(`const i=document.getElementById('word-search');i.value='';i.dispatchEvent(new Event('input',{bubbles:true}));`);

  const sav = await ev(`
    const S = ms => new Promise(r => setTimeout(r, ms));
    const local = document.getElementById('save-status').textContent;
    localStorage.setItem('koto-auth', JSON.stringify({ access_token: 'x', refresh_token: 'r',
      expires_at: Math.floor(Date.now() / 1000) + 86400, user: { email: 'a@b.c', name: 'A', avatar: null } }));
    return { local, hasSpan: !!document.getElementById('save-status') };
  `);
  ok('footer-ийн хадгалалтын төлөв: синкгүй үед «хөтөч дээр»',
    sav && sav.hasSpan && /хөтөч дээр/.test(sav.local), JSON.stringify(sav));
  await send('Page.reload', {});
  for (let i = 0; i < 40; i++) { await sleep(150); try { if (await ev('return !!window.KOTO')) break; } catch (e) {} }
  await sleep(400);
  const sav2 = await ev(`return { mode: window.KOTO.mode(), text: document.getElementById('save-status').textContent };`);
  ok('Google-ээр нэвтэрсэн үед footer «Google бүртгэлд» гэнэ (өмнө худлаа «хөтөч дээр»)',
    sav2 && sav2.mode === 'user' && /Google/.test(sav2.text) && !/хөтөч дээр/.test(sav2.text), JSON.stringify(sav2));
  await ev(`localStorage.removeItem('koto-auth');`);

  console.log('\n[4в] Ахиц: бичиг (кана/ханз), катакана, өдрийн XP, нүдэн график');
  const reload = async () => { await send('Page.reload', {}); for (let i = 0; i < 40; i++) { await sleep(150); try { if (await ev('return !!window.KOTO')) break; } catch (e) {} } await sleep(400); };
  await ev(`localStorage.removeItem('koto-auth');localStorage.removeItem('koto-script');localStorage.setItem('koto-irodori-v1', JSON.stringify({version:1,xp:0,completed:[],words:{},days:{},selectedTopic:0}));location.hash='learn';`);
  await reload();
  /* Хичээлийг туулна: асуултад зөв (эсвэл `wrongFirst` бол эхнийхэд буруу). */
  const RUN = `const S=ms=>new Promise(r=>setTimeout(r,ms));const K=window.KOTO;
    for(let i=0;i<120;i++){if(document.querySelector('.completion'))break;const s=K.numTest.session(),q=s.queue[s.pos];
      if(q.type==='learn'){document.querySelector('[data-action=next]').click();await S(25);continue;}
      if(q.type==='quiz'){const idx=q.options.indexOf(q.correct);const pickIdx=window.__wrong?(idx+1)%4:idx;window.__wrong=false;document.querySelectorAll('.choice')[pickIdx].click();}
      else{for(let k=0;k<30;k++){const b=document.querySelector('.token-bank .token:not(.used):not([disabled])');if(!b)break;b.click();await S(5);}}
      await S(15);document.querySelector('[data-action=check]').click();await S(25);document.querySelector('[data-action=next]').click();await S(25);}
    return !!document.querySelector('.completion');`;
  const sc = await ev(`
    const S = ms => new Promise(r => setTimeout(r, ms)), K = window.KOTO, P = K.profile, out = {};
    location.hash = 'words'; await S(200);
    out.kanaFirst = document.querySelector('.word-card .word-kana').innerHTML;
    location.hash = 'profile'; await S(200);
    out.profileShown = !document.getElementById('view-profile').hidden;
    document.querySelector('[data-action=script][data-script=kanji]').click(); await S(150);
    out.script = P.script(); out.stored = localStorage.getItem('koto-script');
    location.hash = 'words'; await S(200);
    out.ruby = document.querySelectorAll('#word-results ruby.jp-face').length;
    out.first = document.querySelector('.word-card .word-kana ruby') ? document.querySelector('.word-card .word-kana ruby').firstChild.textContent : '';
    out.kjAll = K.words().filter(w => w.kj).length; out.firstKj = (K.words().find(w => w.kj) || {}).kj;
    const inp = document.getElementById('word-search'); inp.value = '何'; inp.dispatchEvent(new Event('input', { bubbles: true })); await S(60);
    out.searchKj = document.querySelectorAll('#word-results .word-card').length;
    inp.value = ''; inp.dispatchEvent(new Event('input', { bubbles: true }));
    const sel = document.getElementById('word-topic'); sel.value = 'kata'; sel.dispatchEvent(new Event('change', { bubbles: true })); await S(60);
    out.kata = document.querySelectorAll('#word-results .word-card').length;
    out.kataMarked = document.querySelectorAll('#word-results .word-card.is-kata').length;
    out.kataAll = P.kata().length;
    sel.value = 'all'; sel.dispatchEvent(new Event('change', { bubbles: true }));
    return out;`);
  /* 2026-11-05: 3 номын үг — ханзтай үгийн тоог өгөгдлөөс (өмнө 289/432). */
  ok('ханзын горим: тохиргоо хадгалагдана, ханзтай үг бүр ruby-тай, эхнийх нь kj-ээрээ; кана горимд ruby-гүй',
    sc.profileShown && sc.script === 'kanji' && sc.stored === 'kanji' && sc.ruby === sc.kjAll && sc.kjAll > 1500 && sc.first === sc.firstKj && !/ruby/.test(sc.kanaFirst),
    JSON.stringify(sc));
  ok('үгийн сан: ханзаар хайна (何), «Катакана үгс» шүүлтүүр = бүх катакана үг (' + sc.kataAll + ') / бүгд .is-kata',
    sc.searchKj > 5 && sc.kataAll > 34 && sc.kata === sc.kataAll && sc.kataMarked === sc.kataAll, JSON.stringify(sc));

  const ls = await ev(`
    const S = ms => new Promise(r => setTimeout(r, ms)), K = window.KOTO;
    location.hash = 'learn'; await S(200);
    /* Эхний нэгж (мэндчилгээ) кана үгтэй — ханзтай үг агуулсан эхний хичээлийг эхлүүлнэ. */
    const KL = K.vocab.lessons().find(l => l.words.filter(w => w.kj).length >= 2);
    document.querySelector('#view-learn .topic-card[data-topic="' + KL.topic + '"]').click(); await S(100);
    document.querySelector('#current-unit .node-button[data-lesson="' + KL.id + '"]').click(); await S(300);
    const s = K.numTest.session(), kq = s.queue.filter(q => q.direction === 'kj-jp');
    const out = { kjq: kq.length, kjWords: s.words.filter(w => w.kj).length,
      kjOk: kq.every(q => q.options.length === 4 && new Set(q.options).size === 4 && q.options.includes(q.correct) && q.correct === q.word.jp) };
    out.done = await (async () => { ${RUN} })();
    out.sessXp = s.xp; const st = K.state(); out.xp = st.xp; out.xpd = st.xpd; out.dev = K.profile.dev();
    document.querySelector('[data-action=finish]').click(); await S(200);
    return out;`);
  const xd = ls && ls.xpd && Object.values(ls.xpd)[0];
  ok('ханзын горимд хичээл: ханзтай үг бүрд «ханзаар унших» асуулт (4 өөр сонголт)',
    ls.kjq === ls.kjWords && ls.kjq > 0 && ls.kjOk, JSON.stringify({ kjq: ls.kjq, kjWords: ls.kjWords, kjOk: ls.kjOk }));
  ok('өдрийн XP: хичээлийн XP өнөөдрийн төхөөрөмжийн тоолуурт (нийт XP-тэй ижил)',
    ls.done && ls.sessXp > 0 && ls.xp === ls.sessXp && Object.keys(ls.xpd).length === 1 && xd && xd[ls.dev] === ls.sessXp && /^[a-z0-9]{8}$/.test(ls.dev),
    JSON.stringify({ done: ls.done, sessXp: ls.sessXp, xp: ls.xp, xpd: ls.xpd, dev: ls.dev }));

  const kn = await ev(`
    const S = ms => new Promise(r => setTimeout(r, ms)), K = window.KOTO;
    const before = JSON.parse(JSON.stringify(K.state()));
    location.hash = 'profile'; await S(200);
    document.querySelector('[data-action=kana-lesson][data-kana="0"]').click(); await S(300);
    const s = K.numTest.session();
    const out = { title: s.title, learn: s.queue.filter(q => q.type === 'learn').length,
      kh: s.queue.filter(q => q.direction === 'kata-hira'), hk: s.queue.filter(q => q.direction === 'hira-kata') };
    out.khOk = out.kh.length === 5 && out.kh.every(q => q.options.length === 4 && q.options.every(o => /^[\\u3041-\\u309f]+$/.test(o)));
    out.hkOk = out.hk.length === 5 && out.hk.every(q => q.options.length === 4 && q.options.every(o => /^[\\u30a1-\\u30fa]+$/.test(o)));
    out.chars = s.words.map(k => k.jp).join('');
    delete out.kh; delete out.hk;
    window.__wrong = true;
    out.done = await (async () => { ${RUN} })();
    const st = K.state(), today = Object.keys(st.xpd)[0];
    out.kana = Object.keys(st.kana).sort().join(',');
    out.weak = Object.values(st.kana).filter(r => r.weak).length;
    out.wordsSame = JSON.stringify(Object.keys(st.words).sort()) === JSON.stringify(Object.keys(before.words).sort());
    out.completedSame = st.completed.length === before.completed.length;
    out.dayK = st.days[today].filter(id => /^K-/.test(id)).length;
    out.xpGrew = st.xp > before.xp && st.xpd[today][K.profile.dev()] === st.xp;
    document.querySelector('[data-action=finish]').click(); await S(200);
    const p = K.profile.data();
    out.p = { seen: p.kana.seen, l0: p.kana.lessons[0].seen + '/' + p.kana.lessons[0].total, lessons: p.kana.lessons.length, total: p.kana.total };
    return out;`);
  ok('катакана үсгийн хичээл: ア–オ, 5 сурах карт, катакана→хирагана 5, хирагана→катакана 5',
    kn.chars === 'アイウエオ' && kn.learn === 5 && kn.khOk && kn.hkOk, JSON.stringify(kn));
  ok('катакана ахиц `kana`-д (үг, хичээлийн жагсаалт хөндөгдөөгүй), streak-д тоологдоно, алдсан нь сул',
    kn.done && kn.kana === 'K-001,K-002,K-003,K-004,K-005' && kn.weak === 1 && kn.wordsSame && kn.completedSame && kn.dayK === 5 && kn.xpGrew,
    JSON.stringify(kn));
  ok('ахицын өгөгдөл: катакана 5/107, 21 хичээл, эхний хичээл 5/5',
    kn.p.seen === 5 && kn.p.total === 107 && kn.p.lessons === 21 && kn.p.l0 === '5/5', JSON.stringify(kn.p));

  /* Нүдэн график ба streak: зохиомол түүх. Өдрийн XP бичигдэхээс өмнөх
     идэвхтэй өдөр — legacy (түвшин 1, XP зохиохгүй). */
  await ev(`const t=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ulaanbaatar',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const d=n=>{const x=new Date(t+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10);};
    const days={};for(const n of [-400,-12,-11,-10,-3,-1,0])days[d(n)]=['0:0'];days['bad-key']=['0:1'];
    localStorage.setItem('koto-irodori-v1',JSON.stringify({version:1,xp:0,completed:[],words:{},days,xpd:{[d(-1)]:{a1:499},[d(0)]:{a1:300,b2:220},[d(-3)]:{a1:-5},[d(-20)]:{a1:119},[d(-21)]:{a1:120},[d(-22)]:{a1:249},[d(-23)]:{a1:250},[d(-24)]:{a1:500}},selectedTopic:0}));
    window.__t=t;`);
  await reload();
  const hm = await ev(`
    const t=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ulaanbaatar',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const d=n=>{const x=new Date(t+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10);};
    const P=window.KOTO.profile,p=P.data(),cells=p.heat.weeks.flat(),at=k=>cells.find(c=>c.date===k)||{};
    const lastCol=p.heat.weeks[52];
    return { weeks:p.heat.weeks.length, cols7:p.heat.weeks.every(c=>c.length===7), monday:new Date(p.heat.weeks[0][0].date+'T12:00:00Z').getUTCDay(),
      todayInLast:lastCol.some(c=>c.date===t), futureOk:cells.every(c=>c.future===(c.date>t)), futureZero:cells.filter(c=>c.future).every(c=>c.level===0),
      today:at(t), y:at(d(-1)), m3:at(d(-3)), m10:at(d(-10)), m2:at(d(-2)), old:cells.some(c=>c.date===d(-400)),
      edge:[-20,-21,-22,-23,-24].map(n=>at(d(n)).level),
      streak:p.streak, longest:p.longest, active:p.activeDays, todayXp:p.todayXp, hasLegacy:p.heat.hasLegacy };`);
  ok('нүдэн график: 53 долоо хоног × 7, Даваагаас, өнөөдөр сүүлийн баганад, ирээдүй хоосон',
    hm.weeks === 53 && hm.cols7 && hm.monday === 1 && hm.todayInLast && hm.futureOk && hm.futureZero, JSON.stringify(hm));
  ok('нүдний түвшин: өнөөдөр 2 төхөөрөмж 300+220 XP → 4 (тус бүр 500 хүрэхгүй), өчигдөр 499 → 3, XP-гүй идэвхтэй өдөр → 1 legacy, сөрөг XP тоологдохгүй',
    hm.today.xp === 520 && hm.today.level === 4 && hm.y.level === 3 && hm.m10.level === 1 && hm.m10.legacy && hm.m3.xp === 0 && hm.m3.legacy && hm.m2.level === 0 && hm.todayXp === 520 && hm.hasLegacy,
    JSON.stringify({ today: hm.today, y: hm.y, m3: hm.m3, m10: hm.m10, m2: hm.m2 }));
  ok('шатлалын хил: 119 → 1, 120 → 2, 249 → 2, 250 → 3, 500 → 4 (дээд шат 500+)',
    JSON.stringify(hm.edge) === '[1,2,2,3,4]', JSON.stringify(hm.edge));
  ok('streak 2 (өнөөдөр+өчигдөр), хамгийн урт 3 (-12…-10), хог түлхүүр алгасна, 400 хоногийн өмнөх график гадна',
    hm.streak === 2 && hm.longest === 3 && hm.active === 7 && !hm.old, JSON.stringify({ streak: hm.streak, longest: hm.longest, active: hm.active, old: hm.old }));

  /* Avatar → ахицын хуудас; бүртгэлийн карт тэнд (11-05: синкийн цонх хасагдсан). */
  const av = await ev(`const S=ms=>new Promise(r=>setTimeout(r,ms));location.hash='learn';await S(150);
    document.getElementById('open-sync-top').click();await S(200);const prof=location.hash==='#profile'&&!document.getElementById('view-profile').hidden;
    const b=document.querySelector('#view-profile .p-account [data-action=google-in]');
    return {prof,btn:b?b.textContent.trim():null,dis:b?b.disabled:null,old:!!document.querySelector('[data-action=sync-open]'),nav:document.querySelectorAll('.nav-item[data-view=profile]').length};`);
  ok('avatar ба «Ахиц» цэс → ахицын хуудас; бүртгэлийн картад «Нэвтрэх» (Google руу шууд), «Нэвтрэлт ба синк» алга',
    av.prof && av.btn === 'Нэвтрэх' && av.dis === false && !av.old && av.nav === 1, JSON.stringify(av));

  /* Хуучин SQL (`xpd`, `kana`-г мэдэхгүй) түлхэлтийн хариунаас тэднийг хаявал
     локал өгөгдөл УСТАХГҮЙ — клиент хариуг локалтай нийлүүлдэг. Серверийн
     хариуг CDP Fetch-ээр дуурайна (жинхэнэ сервер рүү бичихгүй). */
  await send('Fetch.enable', { patterns: [{ urlPattern: '*rpc/koto_user_*', requestStage: 'Request' }] });
  let putSeen = null;
  onPaused = p => {
    if (p.request.method !== 'POST') { send('Fetch.continueRequest', { requestId: p.requestId }); return; }
    if (p.request.url.includes('koto_user_get')) {   // ачаалах үеийн татлага: серверт ахиц алга
      send('Fetch.fulfillRequest', { requestId: p.requestId, responseCode: 200,
        responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: '*' }],
        body: Buffer.from('null').toString('base64') });
      return;
    }
    const body = JSON.parse(p.request.postData || '{}'), old = Object.assign({}, body.p_data);
    putSeen = { xpd: !!(old.xpd && Object.keys(old.xpd).length), kana: !!(old.kana && Object.keys(old.kana).length) };
    delete old.xpd; delete old.kana;
    send('Fetch.fulfillRequest', { requestId: p.requestId, responseCode: 200,
      responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: '*' }],
      body: Buffer.from(JSON.stringify(old)).toString('base64') });
  };
  const sp = await ev(`const s=JSON.parse(localStorage.getItem('koto-irodori-v1'));s.kana={'K-001':{passes:1,weak:false,due:'2099-01-01',last:'2026-11-01'}};
    localStorage.setItem('koto-irodori-v1',JSON.stringify(s));localStorage.setItem('koto-auth',JSON.stringify({access_token:'x.y.z',refresh_token:'r',expires_at:Math.floor(Date.now()/1000)+86400,user:{email:'a@b.c',name:'A',avatar:null}}));location.hash='learn';return true;`);
  await reload();
  /* Эерэг XP-ийг (өдөр|төхөөрөмж=xp) жагсааж харьцуулна — сөрөгийг уусгалт зөв хаяна. */
  const sp2 = await ev(`const K=window.KOTO,pos=x=>Object.keys(x).sort().flatMap(d=>Object.keys(x[d]).sort().filter(v=>x[d][v]>0).map(v=>d+'|'+v+'='+x[d][v])).join(',');
    const before={xpd:pos(K.state().xpd),kana:Object.keys(K.state().kana).length};
    const r=await K.push(true);const st=K.state(),saved=JSON.parse(localStorage.getItem('koto-irodori-v1'));
    return {mode:K.mode(),r,before,xpd:pos(st.xpd),kana:Object.keys(st.kana).length,savedXpd:pos(saved.xpd||{}),savedKana:Object.keys(saved.kana||{}).length};`);
  onPaused = null;
  await send('Fetch.disable', {});
  await ev(`localStorage.removeItem('koto-auth');`);
  ok('хуучин SQL `xpd`/`kana`-г хаяж буцаасан ч локал хэвээр (түлхэлтийн хариуг нийлүүлнэ)',
    sp && sp2.mode === 'user' && sp2.r === true && putSeen && putSeen.xpd && putSeen.kana && sp2.before.kana === 1 && sp2.before.xpd.split(',').length === 8
      && sp2.xpd === sp2.before.xpd && sp2.kana === 1 && sp2.savedXpd === sp2.before.xpd && sp2.savedKana === 1,
    JSON.stringify({ sp2, putSeen }));

  console.log('\n[P] Үгийн аймаг (11-05): өгөгдөл, ангиллаар дасгал, тоглоомын сан');
  const pd = await ev(`const D=window.KOTO_DATA,W=D.units.flatMap(u=>u.words),K=['noun','verb','adj','adv','exp','other'];
    const bad=W.filter(w=>!K.includes(w.p)).map(w=>w.id),c={};W.forEach(w=>c[w.p]=(c[w.p]||0)+1);
    const find=(jp,kj)=>{const w=W.find(x=>x.jp===jp&&(kj===undefined||x.kj===kj));return w?w.p:'алга';};
    const exp={'たべます':'verb','いきます':'verb','わかります':'verb','べんきょうする':'verb','おおきい':'adj','たかい':'adj','きれい':'adj',
      'ほん':'noun','べんきょう':'noun','りょうり':'noun','ゆっくり':'adv','とても':'adv','おはようございます':'exp','すみません':'exp','ありがとうございます':'exp',
      'これ':'other','わたし':'other','さんじ':'other'};
    const got={};for(const j in exp)got[j]=find(j);
    return {n:W.length,nb:bad.length,bad:bad.slice(0,5),c,wrong:Object.keys(exp).filter(j=>got[j]!==exp[j]).map(j=>j+':'+got[j]+'≠'+exp[j])};`);
  ok('замын 2994 үг бүгд 6 ангиллын нэгтэй, ангилал бүрт ≥ 50 үг',
    pd.n === 2994 && pd.nb === 0 && Object.keys(pd.c).length === 6 && Object.values(pd.c).every(x => x >= 50), JSON.stringify({ n: pd.n, nb: pd.nb, bad: pd.bad, c: pd.c }));
  ok('гараар заасан 18 үг зөв ангилалтай (～ます үйл үг, する, い/な тэмдэг нэр, тоо+цаг → Бусад, мэндчилгээ → Хэллэг)',
    pd.wrong.length === 0, pd.wrong.join(' | '));
  const pa = await ev(`const W=window.KOTO_DATA.units.flatMap(u=>u.words);
    const find=(jp,kj)=>{const m=W.filter(x=>x.jp===jp&&(kj===undefined||x.kj===kj));return m.length===1?m[0].p:'олдсон '+m.length;};
    const exp=[['だれ',,'other'],['なんにん','何人','other'],['いくら',,'other'],['ろく',,'other'],['かん','缶','noun'],['やま','山','noun'],['ひゃくえんショップ','100円ショップ','noun'],
      ['あとで',,'adv'],['もうすぐ',,'adv'],['いちばん',,'adv'],['しりませんでした','知りませんでした','verb'],['しつれいします','失礼します','exp'],
      ['おとこのこ','男の子','noun'],['おおきな','大きな','adj'],['おねがい','お願い','noun']];
    return exp.map(([j,k,p])=>[j,find(j,k),p]).filter(([,g,p])=>g!==p).map(([j,g,p])=>j+':'+g+'≠'+p);`);
  ok('Codex-ийн тулгалтаас (11-05) гарсан алдааны төрөл бүрийн 15 үг: асуух үг, тоотой ижил бичлэг, дайвар хэллэг, ганц үйл үг ≠ Хэллэг',
    pa.length === 0, pa.join(' | '));
  /* №52 (11-06): хуучин v2-ийн «せん = мянга» дуудлагаар эх номын 線 (шугам)-д холбогдож, «Галт тэрэг ба шугам» нэгжид орсон байв. */
  const wf = await ev(`const U=window.KOTO_DATA.units,W=U.flatMap(u=>u.words),f=i=>W.find(x=>x.id===i),unitOf=i=>U.find(u=>u.words.some(x=>x.id===i)).title;
    const train=U.find(u=>u.title==='Галт тэрэг ба шугам'),K=window.KOTO_KANJI,ex=c=>(K.find(k=>k.c===c).ex||[]);
    return {sen:f('E1-12-050'),senUnit:unitOf('E1-12-050'),trainThousand:train.words.filter(x=>/мянга/.test(x.mn)).length,nansatsu:f('E2-13-060').mn,
      sen1:ex('千')[0]&&ex('千')[0].jp+'='+ex('千')[0].mn,satsu:ex('冊').filter(e=>e.jp==='何冊').map(e=>e.mn).join(),sen3:ex('線').filter(e=>/мянга/.test(e.mn)).length};`);
  ok('№52: せん = 千 «мянга» тоон нэгжид (галт тэрэгний нэгжид биш), なんさつ «хэдэн ширхэг (ном)»; ханзны жишээ ч зөв',
    wf.sen.kj === '千' && wf.sen.mn === 'мянга (1 000)' && wf.senUnit === 'Зуу, мянга, түм' && wf.trainThousand === 0 && wf.nansatsu === 'хэдэн ширхэг (ном)' &&
    wf.sen1 === '千=мянга (1 000)' && wf.satsu === 'хэдэн ширхэг (ном)' && wf.sen3 === 0, JSON.stringify(wf));

  const pp = await ev(`const K=window.KOTO,W=K.words(),S=ms=>new Promise(r=>setTimeout(r,ms));
    const verbs=W.filter(w=>w.p==='verb').slice(0,8),nouns=W.filter(w=>w.p==='noun').slice(0,6),d=new Date().toISOString().slice(0,10),words={};
    verbs.forEach((w,i)=>words[w.id]={passes:1,weak:i<2,due:d,last:d,attempts:2,misses:i<2?1:0});
    nouns.forEach(w=>words[w.id]={passes:1,weak:false,due:d,last:d,attempts:1,misses:0});
    localStorage.setItem('koto-irodori-v1',JSON.stringify({version:1,xp:0,completed:[],words,kana:{},days:{},xpd:{},selectedTopic:0}));return true;`);
  await reload();
  const ps = await ev(`const K=window.KOTO,S=ms=>new Promise(r=>setTimeout(r,ms)),st=K.state();
    const weakIds=Object.keys(st.words).filter(id=>st.words[id].weak);
    K.pos.start('verb');await S(300);const s=K.numTest.session();
    const r={open:document.getElementById('lesson-dialog').open,n:s.words.length,kinds:[...new Set(s.words.map(w=>w.p))].join(),
      learned:s.words.every(w=>st.words[w.id]),weakFirst:s.words.slice(0,2).every(w=>weakIds.includes(w.id)),title:s.title,review:s.review};
    document.getElementById('lesson-dialog').close();
    const before=K.numTest.session();K.pos.start('adv');K.pos.start('xyz');K.pos.start('all');await S(150);
    r.noAdv=K.numTest.session()===before&&!document.getElementById('lesson-dialog').open;
    return r;`);
  ok('ангиллаар дасгал: зөвхөн «Үйл үг», зөвхөн үзсэн, 5 үг, алдсан нь түрүүнд, гарчиг «Үйл үг · давтлага»',
    ps.open && ps.n === 5 && ps.kinds === 'verb' && ps.learned && ps.weakFirst && ps.title === 'Үйл үг · давтлага' && ps.review, JSON.stringify(ps));
  ok('үзсэн үггүй ангилал (Дайвар үг), буруу/«all» түлхүүр — дасгал ЭХЛЭХГҮЙ', ps.noAdv, JSON.stringify(ps));

  const pg = await ev(`const K=window.KOTO;localStorage.removeItem('koto-game-pos');
    const all=K.pos.pool('all').length,v=K.pos.pool('verb'),n=K.pos.pool('noun');
    K.pos.setGame('noun');const saved=localStorage.getItem('koto-game-pos'),cur=K.pos.game(),def=K.pos.pool().every(w=>w.p==='noun');
    K.pos.setGame('xyz');const kept=K.pos.game();
    return {all,v:v.length,vk:v.every(w=>w.p==='verb'),n:n.length,saved,cur,def,kept};`);
  await reload();
  const pg2 = await ev(`const K=window.KOTO,g=K.pos.game();K.pos.setGame('all');return {g,after:localStorage.getItem('koto-game-pos')};`);
  ok('тоглоомын сан: ангиллаар шүүнэ (8 үйл үг, 6 нэр үг), сонголт төхөөрөмж дээр хадгалагдаж дахин ачаалахад хэвээр, буруу түлхүүрийг үл тооно',
    pg.all === 14 && pg.v === 8 && pg.vk && pg.n === 6 && pg.saved === 'noun' && pg.cur === 'noun' && pg.def && pg.kept === 'noun' && pg2.g === 'noun' && pg2.after === 'all',
    JSON.stringify({ pg, pg2 }));
  await ev(`localStorage.removeItem('koto-irodori-v1');localStorage.removeItem('koto-game-pos');return true;`);
  await reload();

  console.log('\n[U] Хэрэглээний нэргүй тоо (11-07; v1-ийн ping, id «v2-»)');
  /* Бодит сервер рүү юу ч явахгүй: `fetch`-ийг орлуулна. Тоо нь тест дотроо: 3 үг, 7+2+4 = 13 хариулт, 1 бататгасан. */
  await ev(`const W=window.KOTO.words().slice(0,3),t='2026-11-07',r=(passes,weak,attempts)=>({passes,weak,due:t,last:t,attempts,misses:weak?1:0});
    localStorage.setItem('koto-irodori-v1',JSON.stringify({version:1,xp:0,completed:[],words:{[W[0].id]:r(3,false,7),[W[1].id]:r(1,false,2),[W[2].id]:r(0,true,4)},kana:{},days:{},xpd:{},selectedTopic:0}));
    localStorage.removeItem('koto-usage-id');localStorage.removeItem('koto-usage-day');return true;`);
  const U_RESET = `window.__real=window.__real||window.fetch;window.__calls=[];window.__mode=200;window.fetch=async(u,o)=>{if(String(u).includes('/rpc/ping')){window.__calls.push({u:String(u),h:(o||{}).headers,b:JSON.parse((o||{}).body||'{}')});if(window.__mode==='throw')throw new TypeError('сүлжээгүй');return new Response(null,{status:window.__mode});}return new Response('null',{status:401});};`;
  await reload();
  const uDev = await ev(U_RESET + `const U=window.KOTO.usage,started=performance.getEntriesByType('resource').filter(e=>e.name.includes('/rpc/ping')).length,idEarly=localStorage.getItem('koto-usage-id');
    for(const h of ['127.0.0.1','localhost','[::1]','pc.local','']){U.host(h);await U.ping();await U.stats(Date.now()+1e9*(h.length+1));}
    return {started,idEarly,calls:window.__calls.length,idAfter:localStorage.getItem('koto-usage-id')};`);
  ok('Локал хаяг дээр бүртгэхгүй: нээгдэхэд ч, 5 локал нэр дээр ч ping алга, id ч үүсэхгүй', uDev.started === 0 && uDev.idEarly === null && uDev.calls === 0 && uDev.idAfter === null, JSON.stringify(uDev));
  const uRun = await ev(U_RESET + `const U=window.KOTO.usage;U.host('nova-xo.github.io');localStorage.setItem('koto-auth',JSON.stringify({access_token:'USER-TOKEN',refresh_token:'r',expires_at:Math.floor(Date.now()/1000)+86400,user:{email:'a@b.c',name:'A',avatar:null}}));
    const out={};await U.ping();const c=window.__calls[0]||{};out.n1=window.__calls.length;out.u=c.u;out.h=c.h;out.b=c.b;out.day=localStorage.getItem('koto-usage-day');
    await U.ping();out.n2=window.__calls.length;
    localStorage.removeItem('koto-usage-day');window.__mode=500;await U.ping();out.n3=window.__calls.length;out.day500=localStorage.getItem('koto-usage-day');
    window.__mode='throw';await U.ping();out.n4=window.__calls.length;out.dayThrow=localStorage.getItem('koto-usage-day');
    window.__mode=200;await U.ping();out.n5=window.__calls.length;out.dayOk=!!localStorage.getItem('koto-usage-day');
    const T=Date.now()+1e11,n=window.__calls.length;await U.stats(T);out.st1=window.__calls.length-n;out.stB=(window.__calls[n]||{}).b;await U.stats(T+1000);out.st2=window.__calls.length-n;await U.stats(T+121000);out.st3=window.__calls.length-n;
    out.id=U.id();out.dev=window.KOTO.profile.dev();out.inState=JSON.stringify(window.KOTO.state()).includes(out.id);localStorage.removeItem('koto-auth');return out;`);
  ok('Илгээх зүйл: зөвхөн id + 3 тоо (3 үг, 13 хариулт, 1 бататгасан); /rest/v1/rpc/ping; хэрэглэгчийн токен ЯВАХГҮЙ',
    uRun.n1 === 1 && /\/rest\/v1\/rpc\/ping$/.test(uRun.u) && Object.keys(uRun.b).sort().join() === 'p_answers,p_cards,p_dev,p_learned' && uRun.b.p_cards === 3 && uRun.b.p_answers === 13 && uRun.b.p_learned === 1 &&
    !JSON.stringify(uRun.h).includes('USER-TOKEN') && !!uRun.h.apikey, JSON.stringify({ b: uRun.b, u: uRun.u, h: Object.keys(uRun.h || {}) }));
  ok('Өдөрт нэг удаа; сервер алдаа ба сүлжээгүйд өдөр тэмдэглэхгүй, дахин оролдоно; апп уналгүй', uRun.day && uRun.n2 === 1 && uRun.n3 === 2 && uRun.day500 === null && uRun.n4 === 3 && uRun.dayThrow === null && uRun.n5 === 4 && uRun.dayOk, JSON.stringify(uRun));
  ok('Дасгалын дараах тоо: p_bump:false (нээлт нэмэхгүй), 2 минутад нэг', uRun.st1 === 1 && uRun.stB.p_bump === false && uRun.st2 === 1 && uRun.st3 === 2, JSON.stringify([uRun.st1, uRun.st2, uRun.st3]));
  ok('id нэргүй: v2- + 32 hex, xpd-ийн devId-ээс ялгаатай, Google-д синк хийгддэг төлөвт ороогүй', /^v2-[0-9a-f]{32}$/.test(uRun.id) && uRun.id !== uRun.dev && !uRun.inState, JSON.stringify({ id: uRun.id, dev: uRun.dev }));
  await reload();
  await ev(U_RESET + `const U=window.KOTO.usage;U.host('nova-xo.github.io');window.__id0=U.id();document.querySelector('.node-button:not(:disabled)').click();await new Promise(r=>setTimeout(r,300));return true;`);
  const uDone = await ev(RUN);
  const uLes = await ev(`await new Promise(r=>setTimeout(r,100));const c=window.__calls,id=localStorage.getItem('koto-usage-id');const d=document.getElementById('lesson-dialog');if(d.open)d.close();return {n:c.length,b:c[0]&&c[0].b,id};`);
  ok('Бодит хичээл дуусахад тоо шинэчлэгдэнэ (p_bump:false), id дахин ачаалсны дараа ижил', uDone && uLes.n === 1 && uLes.b.p_bump === false && uLes.b.p_cards > 3 && uLes.id === uRun.id && uLes.b.p_dev === uRun.id, JSON.stringify(uLes));
  await ev(`localStorage.removeItem('koto-irodori-v1');localStorage.removeItem('koto-usage-id');localStorage.removeItem('koto-usage-day');localStorage.removeItem('koto-auth');return true;`);

  console.log('\n[5] Консол');
  ok('барьсангүй уналт гараагүй', errs.length === 0, errs.slice(0, 3).join(' | '));

  console.log('\n' + '─'.repeat(50));
  console.log('tsever: ' + good + '   unasan: ' + bad);
  if (fails.length) { console.log('\nUNASAN:'); fails.forEach(x => console.log('  · ' + x)); }
  try { ws.close(); } catch (e) {}
  chrome.kill();
  process.exit(bad ? 1 : 0);
})().catch(e => { console.log('ALDAA: ' + e.message); process.exit(2); });
