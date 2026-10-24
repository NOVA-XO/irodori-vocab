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
  let id = 0; const w = new Map(); const errs = [];
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && w.has(m.id)) { const x = w.get(m.id); w.delete(m.id); m.error ? x.rej(new Error(JSON.stringify(m.error))) : x.res(m.result); }
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
  ok('432 үг / 17 сэдэв',
    await ev('const d=window.KOTO_DATA; return d.length===17 && d.reduce((s,t)=>s+t.words.length,0)===432;'));
  /* 17-р сэдэв ТӨГСГӨЛД нэмэгдсэн: үгийн id нь `сэдэв:дугаар` тул дунд нь
     оруулбал сурагчдын хадгалсан ахиц өөр үг рүү шилжинэ. */
  const t17 = await ev(`
    const d = window.KOTO_DATA, t = d[16];
    const jp = t.words.map(w => w.jp);
    return { title: t.title, n: t.words.length, uniq: new Set(jp).size,
             first80: jp[0] + '|' + jp[79], first15: d[15].title,
             has: ['きょう','あした','らいしゅう','カレンダー','ついたち','はつか','しがつ','よじ',
                   'げつようび','かようび','すいようび','もくようび','きんようび','どようび','にちようび',
                   'いちがつ','はちがつ','じゅういちがつ','ひとり','ふたり','よにん','はたち','～まい','～ほん／ぼん／ぽん'].every(x => jp.includes(x)),
             lessons: document.querySelectorAll('.topic-card').length,
             navCount: document.querySelector('.nav-count').textContent,
             heroTopics: [...document.querySelectorAll('.hero-mini strong')].map(x => x.textContent)[1] };
  `);
  ok('17-р сэдэв «Тоо, цаг, хуанли» — 120 давхардалгүй үг (7 гараг, 12 сар, тоолох нэр бүгд)',
    t17 && /Тоо, цаг, хуанли/.test(t17.title) && t17.n === 120 && t17.uniq === 120 && t17.has, JSON.stringify(t17));
  ok('анхны 80 үгийн байрлал хэвээр (хадгалсан ахиц хөдлөхгүй): ゼロ／れい … ～ねん',
    t17 && t17.first80 === 'ゼロ／れい|～ねん', JSON.stringify(t17 && t17.first80));
  ok('өмнөх 16 сэдвийн дараалал хэвээр (16-р нь «Тоо болон материалд…»)',
    t17 && /^16 /.test(t17.first15), JSON.stringify(t17 && t17.first15));
  const l17 = await ev(`
    const wait = ms => new Promise(r => setTimeout(r, ms));
    document.querySelector('.topic-card[data-topic="16"]').click(); await wait(100);
    const unit = document.querySelector('#current-unit');
    const out = { unit: unit.querySelector('.unit-title').textContent,
                  nodes: unit.querySelectorAll('.node-button').length };
    unit.querySelector('.node-button[data-lesson="16-0"]').click(); await wait(150);
    out.first = (document.querySelector('#lesson-content .learn-kana') || {}).textContent;
    out.open = document.getElementById('lesson-dialog').open;
    document.getElementById('lesson-dialog').close();
    document.querySelector('.topic-card[data-topic="0"]').click(); await wait(100);
    return out;
  `);
  ok('17-р сэдэв сонгоход 24 хичээл, эхний хичээл «ゼロ／れい»-гээр эхэлнэ',
    l17 && /Тоо, цаг, хуанли/.test(l17.unit) && l17.nodes === 24 && l17.open && l17.first === 'ゼロ／れい',
    JSON.stringify(l17));
  /* Тооны шалгалт: дуудлага өөрчлөгддөг тоо (хүснэгт) + үүсгэсэн огноо/цаг. */
  const nt = await ev(`
    const T = window.KOTO.numTest, wait = ms => new Promise(r => setTimeout(r, ms));
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
    const b = T.build();
    out.qn = b.queue.length; out.gen = b.queue.filter(q => q.word.gen).length;
    out.opts = b.queue.every(q => q.options.length === 4 && new Set(q.options).size === 4 && q.options.includes(q.correct));
    out.numOnly = b.words.every(w => w.topic === 15 || w.topic === 16);
    // UI: 17-р сэдвийн картаас эхлүүлж, бүгдийг зөв хариулаад дуусгана.
    document.querySelector('.topic-card[data-topic="16"]').click(); await wait(100);
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
    document.querySelector('.topic-card[data-topic="0"]').click(); await wait(100);
    out.noBtn0 = !document.querySelector('#current-unit [data-action="test"]');
    return out;
  `);
  ok('тооны хүснэгт: 12 сар · 31 өдөр · 12 цаг; しがつ/しちがつ/くがつ, ついたち/じゅうよっか/はつか/にじゅうよっか, よじ/くじ',
    nt && nt.months === 12 && nt.days === 31 && nt.hours === 12 && nt.m4 === 'しがつ' && nt.m7 === 'しちがつ' && nt.m9 === 'くがつ'
      && nt.d1 === 'ついたち' && nt.d14 === 'じゅうよっか' && nt.d20 === 'はつか' && nt.d24 === 'にじゅうよっか'
      && nt.h4 === 'よじ' && nt.h9 === 'くじ', JSON.stringify(nt));
  ok('үүсгэсэн огноо/цаг 300 удаа — монгол ба япон нь таарна, байхгүй өдөр (2/30) гарахгүй',
    nt && nt.okDate && nt.okTime, JSON.stringify(nt && { d: nt.okDate, t: nt.okTime }));
  ok('шалгалт 20 асуулт (огноо/цаг 6), асуулт бүр 4 давхардалгүй сонголт, үг нь зөвхөн тооны сэдвээс',
    nt && nt.qn === 20 && nt.gen === 6 && nt.opts && nt.numOnly, JSON.stringify(nt));
  ok('«Тооны шалгалт» товчоор эхэлж, бүгдийг зөв хариулахад «Шалгалт дууслаа!»; үүсгэсэн асуулт ахицад бичигдэхгүй',
    nt && nt.btn && /Тооны шалгалт/.test(nt.meta) && nt.done && nt.title === 'Шалгалт дууслаа!' && !nt.genSaved,
    JSON.stringify(nt));
  ok('тооны бус сэдэвт шалгалтын товч гарахгүй', nt && nt.noBtn0, JSON.stringify(nt && nt.noBtn0));
  ok('нүүрэнд 17 сэдвийн карт, цэсний тоо 432, «17 сэдэв»',
    t17 && t17.lessons === 17 && t17.navCount === '432' && t17.heroTopics === '17', JSON.stringify(t17));
  ok('синкийн тохиргоо v1-ээс ачаалагдав (../sync-config.js)',
    await ev('return !!(window.SYNC_CONFIG && window.SYNC_CONFIG.url) && window.KOTO.on() === true;'));

  console.log('\n[2] kotoMerge — SQL-тэй ИЖИЛ дүрэм');
  /* Эдгээр нь `test_sql.js`-ийн [KOTO] хэсэгтэй ЯГ ижил өгөгдөл:
     хоёр хэрэгжүүлэлт салж явбал энд ялгаа гарна. */
  const m = await ev(`
    const A = { version:1, xp:120, completed:['t0-l0','t0-l1'],
      words:{ w1:{step:2,due:'2026-11-01',weak:false}, w2:{step:0,due:'2026-10-24',weak:true} },
      days:{ '2026-10-23':['w1','w2'] }, selectedTopic:3 };
    const B = { version:1, xp:80, completed:['t0-l1','t0-l2'],
      words:{ w1:{step:0,due:'2026-10-24',weak:true}, w3:{step:1,due:'2026-10-30',weak:false} },
      days:{ '2026-10-23':['w3'], '2026-10-24':['w1'] }, selectedTopic:7 };
    const r = window.KOTO.merge(A, B);
    return { xp:r.xp, comp:r.completed.slice().sort(), w1:r.words.w1,
             wKeys:Object.keys(r.words).sort(), d23:(r.days['2026-10-23']||[]).slice().sort(),
             d24:r.days['2026-10-24'], topic:r.selectedTopic };
  `);
  ok('XP — ИХ нь ялна (120)', m && m.xp === 120, JSON.stringify(m && m.xp));
  ok('дуусгасан хичээл — НЭГДЭЛ (3)',
    m && m.comp.length === 3 && m.comp.join() === 't0-l0,t0-l1,t0-l2', JSON.stringify(m && m.comp));
  ok('үгийн хуваарь — step ИХ нь ялна (w1 step=2, weak=false)',
    m && m.w1 && m.w1.step === 2 && m.w1.weak === false, JSON.stringify(m && m.w1));
  ok('шинэ үг хоёр талаас хадгалагдана (w1,w2,w3)',
    m && m.wKeys.join() === 'w1,w2,w3', JSON.stringify(m && m.wKeys));
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

  console.log('\n[3] Синкийн цонх');
  const dlg = await ev(`
    const btn = document.getElementById('open-sync');
    if (!btn) return { e: 'товч алга' };
    btn.click(); await new Promise(r => setTimeout(r, 300));
    const d = document.getElementById('sync-dialog');
    const inp = document.getElementById('sync-code');
    return { open: d ? d.open : null, hasInput: !!inp,
             min: inp ? inp.getAttribute('minlength') : null,
             max: inp ? inp.getAttribute('maxlength') : null,
             btns: document.querySelectorAll('#sync-dialog [data-action]').length };
  `);
  ok('синкийн цонх нээгдэв, код оруулах талбартай',
    dlg && dlg.open === true && dlg.hasInput === true, JSON.stringify(dlg));
  ok('кодын урт 8..64 гэж хязгаарлагдсан (сервертэй ижил)',
    dlg && dlg.min === '8' && dlg.max === '64', JSON.stringify(dlg));

  const short = await ev(`
    const inp = document.getElementById('sync-code');
    inp.value = 'abc';
    document.querySelector('#sync-dialog [data-action="sync-save"]').click();
    await new Promise(r => setTimeout(r, 300));
    return { note: (document.getElementById('sync-note') || {}).textContent,
             saved: localStorage.getItem('koto-sync-code') };
  `);
  ok('богино код няцаагдана (сервер хүртэл явахгүй)',
    short && /8/.test(short.note || '') && !short.saved, JSON.stringify(short));

  console.log('\n[4] Ахиц хадгалагдана (localStorage)');
  const store = await ev(`
    document.getElementById('sync-dialog').close();
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

  console.log('\n[5] Консол');
  ok('барьсангүй уналт гараагүй', errs.length === 0, errs.slice(0, 3).join(' | '));

  console.log('\n' + '─'.repeat(50));
  console.log('tsever: ' + good + '   unasan: ' + bad);
  if (fails.length) { console.log('\nUNASAN:'); fails.forEach(x => console.log('  · ' + x)); }
  try { ws.close(); } catch (e) {}
  chrome.kill();
  process.exit(bad ? 1 : 0);
})().catch(e => { console.log('ALDAA: ' + e.message); process.exit(2); });
