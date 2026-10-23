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
  ok('312 үг / 16 сэдэв',
    await ev('const d=window.KOTO_DATA; return d.length===16 && d.reduce((s,t)=>s+t.words.length,0)===312;'));
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
