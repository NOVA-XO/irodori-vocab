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
    const inp = document.getElementById('word-search'); inp.value = '何'; inp.dispatchEvent(new Event('input', { bubbles: true })); await S(60);
    out.searchKj = document.querySelectorAll('#word-results .word-card').length;
    inp.value = ''; inp.dispatchEvent(new Event('input', { bubbles: true }));
    const sel = document.getElementById('word-topic'); sel.value = 'kata'; sel.dispatchEvent(new Event('change', { bubbles: true })); await S(60);
    out.kata = document.querySelectorAll('#word-results .word-card').length;
    out.kataMarked = document.querySelectorAll('#word-results .word-card.is-kata').length;
    out.kataAll = P.kata().length;
    sel.value = 'all'; sel.dispatchEvent(new Event('change', { bubbles: true }));
    return out;`);
  ok('ханзын горим: тохиргоо хадгалагдана, үгийн карт ruby (なに → 何), кана горимд ruby-гүй',
    sc.profileShown && sc.script === 'kanji' && sc.stored === 'kanji' && sc.ruby === 289 && sc.first === '何' && !/ruby/.test(sc.kanaFirst),
    JSON.stringify(sc));
  ok('үгийн сан: ханзаар хайна (何), «Катакана үгс» шүүлтүүр 34 / бүгд .is-kata',
    sc.searchKj > 5 && sc.kata === 34 && sc.kataMarked === 34 && sc.kataAll === 34, JSON.stringify(sc));

  const ls = await ev(`
    const S = ms => new Promise(r => setTimeout(r, ms)), K = window.KOTO;
    location.hash = 'learn'; await S(200);
    document.querySelector('[data-action=start]').click(); await S(300);
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
    localStorage.setItem('koto-irodori-v1',JSON.stringify({version:1,xp:0,completed:[],words:{},days,xpd:{[d(-1)]:{a1:60},[d(0)]:{a1:200,b2:150},[d(-3)]:{a1:-5}},selectedTopic:0}));
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
      streak:p.streak, longest:p.longest, active:p.activeDays, todayXp:p.todayXp, hasLegacy:p.heat.hasLegacy };`);
  ok('нүдэн график: 53 долоо хоног × 7, Даваагаас, өнөөдөр сүүлийн баганад, ирээдүй хоосон',
    hm.weeks === 53 && hm.cols7 && hm.monday === 1 && hm.todayInLast && hm.futureOk && hm.futureZero, JSON.stringify(hm));
  ok('нүдний түвшин: өнөөдөр 2 төхөөрөмж 350 XP → 4, өчигдөр 60 → 2, XP-гүй идэвхтэй өдөр → 1 legacy, сөрөг XP тоологдохгүй',
    hm.today.xp === 350 && hm.today.level === 4 && hm.y.level === 2 && hm.m10.level === 1 && hm.m10.legacy && hm.m3.xp === 0 && hm.m3.legacy && hm.m2.level === 0 && hm.todayXp === 350 && hm.hasLegacy,
    JSON.stringify({ today: hm.today, y: hm.y, m3: hm.m3, m10: hm.m10, m2: hm.m2 }));
  ok('streak 2 (өнөөдөр+өчигдөр), хамгийн урт 3 (-12…-10), хог түлхүүр алгасна, 400 хоногийн өмнөх график гадна',
    hm.streak === 2 && hm.longest === 3 && hm.active === 7 && !hm.old, JSON.stringify({ streak: hm.streak, longest: hm.longest, active: hm.active, old: hm.old }));

  /* Avatar → ахицын хуудас; синкийн цонх хуудсан дээрх товчоор. */
  const av = await ev(`const S=ms=>new Promise(r=>setTimeout(r,ms));location.hash='learn';await S(150);
    document.getElementById('open-sync-top').click();await S(200);const prof=location.hash==='#profile'&&!document.getElementById('view-profile').hidden;
    document.querySelector('#view-profile [data-action=sync-open]').click();await S(250);const open=document.getElementById('sync-dialog').open;
    document.querySelector('[data-action=sync-close]').click();await S(100);return {prof,open,nav:document.querySelectorAll('.nav-item[data-view=profile]').length};`);
  ok('avatar ба «Ахиц» цэс → ахицын хуудас; синкийн цонх тэндээс нээгдэнэ', av.prof && av.open && av.nav === 1, JSON.stringify(av));

  /* Хуучин SQL (`xpd`, `kana`-г мэдэхгүй) түлхэлтийн хариунаас тэднийг хаявал
     локал өгөгдөл УСТАХГҮЙ — клиент хариуг локалтай нийлүүлдэг. Серверийн
     хариуг CDP Fetch-ээр дуурайна (жинхэнэ сервер рүү бичихгүй). */
  await send('Fetch.enable', { patterns: [{ urlPattern: '*rpc/koto_put*', requestStage: 'Request' }] });
  let putSeen = null;
  onPaused = p => {
    if (p.request.method !== 'POST') { send('Fetch.continueRequest', { requestId: p.requestId }); return; }
    const body = JSON.parse(p.request.postData || '{}'), old = Object.assign({}, body.p_data);
    putSeen = { xpd: !!(old.xpd && Object.keys(old.xpd).length), kana: !!(old.kana && Object.keys(old.kana).length) };
    delete old.xpd; delete old.kana;
    send('Fetch.fulfillRequest', { requestId: p.requestId, responseCode: 200,
      responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: '*' }],
      body: Buffer.from(JSON.stringify(old)).toString('base64') });
  };
  const sp = await ev(`const s=JSON.parse(localStorage.getItem('koto-irodori-v1'));s.kana={'K-001':{passes:1,weak:false,due:'2099-01-01',last:'2026-11-01'}};
    localStorage.setItem('koto-irodori-v1',JSON.stringify(s));localStorage.setItem('koto-sync-code','zz-test-xpd-kana-01');location.hash='learn';return true;`);
  await reload();
  /* Эерэг XP-ийг (өдөр|төхөөрөмж=xp) жагсааж харьцуулна — сөрөгийг уусгалт зөв хаяна. */
  const sp2 = await ev(`const K=window.KOTO,pos=x=>Object.keys(x).sort().flatMap(d=>Object.keys(x[d]).sort().filter(v=>x[d][v]>0).map(v=>d+'|'+v+'='+x[d][v])).join(',');
    const before={xpd:pos(K.state().xpd),kana:Object.keys(K.state().kana).length};
    const r=await K.push(true);const st=K.state(),saved=JSON.parse(localStorage.getItem('koto-irodori-v1'));
    return {mode:K.mode(),r,before,xpd:pos(st.xpd),kana:Object.keys(st.kana).length,savedXpd:pos(saved.xpd||{}),savedKana:Object.keys(saved.kana||{}).length};`);
  onPaused = null;
  await send('Fetch.disable', {});
  await ev(`localStorage.removeItem('koto-sync-code');`);
  ok('хуучин SQL `xpd`/`kana`-г хаяж буцаасан ч локал хэвээр (түлхэлтийн хариуг нийлүүлнэ)',
    sp && sp2.mode === 'code' && sp2.r === true && putSeen && putSeen.xpd && putSeen.kana && sp2.before.kana === 1 && sp2.before.xpd.split(',').length === 3
      && sp2.xpd === sp2.before.xpd && sp2.kana === 1 && sp2.savedXpd === sp2.before.xpd && sp2.savedKana === 1,
    JSON.stringify({ sp2, putSeen }));

  console.log('\n[5] Консол');
  ok('барьсангүй уналт гараагүй', errs.length === 0, errs.slice(0, 3).join(' | '));

  console.log('\n' + '─'.repeat(50));
  console.log('tsever: ' + good + '   unasan: ' + bad);
  if (fails.length) { console.log('\nUNASAN:'); fails.forEach(x => console.log('  · ' + x)); }
  try { ws.close(); } catch (e) {}
  chrome.kill();
  process.exit(bad ? 1 : 0);
})().catch(e => { console.log('ALDAA: ' + e.message); process.exit(2); });
