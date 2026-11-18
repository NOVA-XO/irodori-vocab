/* v2 (KOTO) — «Өөрийгөө сорих» (JLPT N5 хэлбэр) тест (2026-11-18).
 *
 * Өгөгдөл (сан бүрийн хэмжээ, сонголт, ханзны жагсаалт), нүүр хуудас, хэсгээр дасгал, бүтэн шалгалт (90 асуулт,
 * хэсгийн цаг, оноо ба тэнцэх дүрэм), сонсгол (дуу, нэг удаа), гарах баталгаажуулалт, 390px.
 * Хүлээгдэх тоо тест дотроо (албан ёсны 2018 жишгийн тоо, jlpt.jp-ийн оноо, босго).
 *
 *     python -m http.server 8765 --bind 127.0.0.1     (репогийн үндсээс)
 *     node tools/test_v2_n5.js
 */
'use strict';
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const DBG = 9241;
const SITE = process.env.SITE_V2 || 'http://127.0.0.1:8765/v2/';
const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT = require('os').tmpdir() + '\\koto-n5-shots\\';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let bad = 0, good = 0;
function ok(name, pass, extra) {
  if (pass) { good++; console.log('  ok   ' + name + (extra ? '  (' + String(extra).slice(0, 160) + ')' : '')); }
  else { bad++; console.log('  FAIL ' + name + '  ' + String(extra || '').slice(0, 600)); }
}
const getJSON = (p, m) => new Promise((res, rej) => { const q = http.request({ host: '127.0.0.1', port: DBG, path: p, method: m || 'GET' }, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }); q.on('error', rej); q.end(); });

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  /* ── [A] Өгөгдөл (Chrome-гүй) ── */
  console.log('\n[A] Өгөгдөл: v2/n5data.js');
  const src = fs.readFileSync(path.join(__dirname, '..', 'v2', 'n5data.js'), 'utf8');
  const window = {}; eval(src);
  const P = window.KOTO_N5.pools;
  const NEED = { kanji: 12, hyouki: 8, bunmyaku: 10, iikae: 5, form: 16, order: 5, text: 1, short: 3, mid: 1, info: 1, task: 7, point: 6, speech: 5, resp: 6 };
  const small = Object.keys(NEED).filter(k => !P[k] || P[k].length < NEED[k] * 2);
  ok('14 сан бүгд бүтэн шалгалтад хэрэгтэйгээс 2-оос доошгүй дахин их (давталт цөөн)', small.length === 0, small.map(k => k + ':' + (P[k] || []).length).join(' ') || Object.keys(P).map(k => k + ' ' + P[k].length).join(' · '));
  const WHITE = new Set('日一人国年大十二本中出三見月長生五時上行四後金前九入学間円子東八六下今気小七高山女外百先名川千来水男話校北土午木車書半白天西電火語右左聞休食何南万毎雨母読友父');
  const japanese = JSON.stringify(P).replace(/"(mn|tr|sceneMn|exMn|id|audio|g)":"(?:[^"\\]|\\.)*"/g, '');
  const outside = [...new Set([...japanese].filter(c => /[\u4e00-\u9fff]/.test(c) && !WHITE.has(c)))];
  // 表記-ийн буруу сонголт нь ЗОРИУД өөр ханз (木/休 …) — тэдгээрийг хасаж шалгана.
  const hyoukiWrong = new Set(P.hyouki.flatMap(q => [...q.o.slice(1).join('')]));
  const real = outside.filter(c => !hyoukiWrong.has(c));
  ok('Японы бичвэрт N5-ийн 79 ханзаас өөр ханз алга (表記-ийн зориудын буруу сонголтоос бусад)', real.length === 0, real.join(''));
  const optBad = [];
  for (const [k, items] of Object.entries(P)) for (const q of items) {
    const lists = q.qs ? q.qs.map(s => s.o) : [k === 'order' ? q.parts : q.o];
    const n = k === 'speech' || k === 'resp' ? 3 : 4;
    lists.forEach(o => { if (!Array.isArray(o) || o.length !== n || new Set(o).size !== n) optBad.push(q.id); });
  }
  ok('Сонголт бүр 4 (発話表現・即時応答 3), давхардалгүй', optBad.length === 0, optBad.slice(0, 8).join(' '));
  const missingAudio = [...P.task, ...P.point, ...P.speech, ...P.resp].filter(q => !fs.existsSync(path.join(__dirname, '..', 'audio', 'n5', q.id + '.mp3'))).map(q => q.id);
  ok('Сонсголын асуулт бүрд дуу (audio/n5/<id>.mp3)', missingAudio.length === 0, missingAudio.slice(0, 8).join(' '));

  /* ── Chrome ── */
  const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + DBG, '--no-first-run', '--disable-gpu', '--mute-audio', '--autoplay-policy=no-user-gesture-required',
    '--user-data-dir=' + require('os').tmpdir() + '\\koto-n5-' + Date.now(), 'about:blank'], { stdio: 'ignore' });
  let tab = null;
  for (let i = 0; i < 60 && !tab; i++) { try { tab = await getJSON('/json/new?about:blank', 'PUT'); } catch (e) { await sleep(250); } }
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise(r => { ws.onopen = r; });
  let id = 0; const w = new Map(), errs = [];
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && w.has(m.id)) { w.get(m.id)(m.result); w.delete(m.id); } if (m.method === 'Runtime.exceptionThrown') errs.push(String((m.params.exceptionDetails.exception || {}).description || m.params.exceptionDetails.text).slice(0, 200)); };
  const send = (method, params) => new Promise(r => { const i = ++id; w.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async expr => { const r = await send('Runtime.evaluate', { expression: '(async()=>{' + expr + '})()', awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300)); return r.result.value; };
  const shot = async n => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(OUT + n + '.png', Buffer.from(r.data, 'base64')); };
  const nav = async url => { await send('Page.navigate', { url }); for (let i = 0; i < 40; i++) { await sleep(150); try { if (await ev('return !!window.KOTO && !!window.KOTO_N5UI')) break; } catch (e) {} } await sleep(400); };
  const size = (wd, ht, mob) => send('Emulation.setDeviceMetricsOverride', { width: wd, height: ht, deviceScaleFactor: 1, mobile: !!mob });
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['*/rest/v1/rpc/ping*'] });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  await size(1400, 900);

  console.log('\n[B] Нүүр хуудас');
  await nav(SITE + '#test');
  const hub = await ev(`await new Promise(r=>setTimeout(r,300));const v=document.getElementById('view-test');
    return {shown:!v.hidden,nav:!!document.querySelector('.nav-item[data-view=test]'),title:(v.querySelector('.page-title')||{}).textContent,
      mock:!!v.querySelector('[data-n5=mock]'),groups:v.querySelectorAll('.n5-group').length,parts:v.querySelectorAll('.n5-part').length,
      disabled:v.querySelectorAll('.n5-part:disabled').length,page:document.getElementById('page-name').textContent};`);
  ok('#test-ээр шууд нээгдэнэ: «Өөрийгөө сорих», бүтэн шалгалтын товч, 3 хэсэг, 14 төрөл, идэвхгүй алга', hub.shown && hub.nav && hub.title === 'Өөрийгөө сорих' && hub.mock && hub.groups === 3 && hub.parts === 14 && hub.disabled === 0 && hub.page === 'Өөрийгөө сорих', JSON.stringify(hub));
  await shot('n5-hub-1400');

  console.log('\n[C] Хэсгээр дасгал');
  const pr = await ev(`const W=ms=>new Promise(r=>setTimeout(r,ms));document.querySelector('[data-n5=practice][data-part=kanji]').click();await W(200);
    const d=document.getElementById('n5-dialog'),U=window.KOTO_N5UI,s=U.state(),out={open:d.open,n:s.qs.length,mode:s.mode};
    const q=s.qs[0],wrong=(q.ans+1)%4;document.querySelector('#n5-content [data-n5=pick][data-i="'+wrong+'"]').click();await W(50);
    out.checkOn=!document.querySelector('#n5-content [data-n5=check]').disabled;document.querySelector('#n5-content [data-n5=check]').click();await W(50);
    const fb=document.querySelector('#n5-content .feedback');out.fb=fb&&fb.className;out.fbText=fb&&fb.textContent;out.right=q.opts[q.ans];out.why=(document.querySelector('#n5-content .n5-why')||{}).textContent||'';
    out.correctMarked=!!document.querySelector('#n5-content .choice.correct');out.locked=document.querySelector('#n5-content [data-n5=pick]').disabled;
    for(let i=1;i<s.qs.length;i++){document.querySelector('#n5-content [data-n5=next]').click();await W(20);const qq=s.qs[i];document.querySelector('#n5-content [data-n5=pick][data-i="'+qq.ans+'"]').click();await W(10);document.querySelector('#n5-content [data-n5=check]').click();await W(10);}
    document.querySelector('#n5-content [data-n5=finish]').click();await W(50);out.res=(document.querySelector('#n5-res')||{}).textContent;
    document.querySelector('#n5-content [data-n5=exit]').click();await W(100);out.closed=!d.open;return out;`);
  ok('漢字読み дасгал: 10 асуулт, буруу → «Буруу байна», зөв хариулт тэмдэглэгдэж, монгол тайлбар; дараа нь түгжигдэнэ', pr.open && pr.n === 10 && pr.mode === 'practice' && pr.checkOn && /incorrect/.test(pr.fb) && pr.fbText.includes(pr.right) && pr.why.length > 5 && pr.correctMarked && pr.locked, JSON.stringify(pr).slice(0, 300));
  ok('Дасгалын дүн «9 / 10 зөв», «Хаах»-аар цонх хаагдана', pr.res === '9 / 10 зөв' && pr.closed, pr.res);
  const kinds = await ev(`const W=ms=>new Promise(r=>setTimeout(r,ms)),U=window.KOTO_N5UI,bad=[];
    for(const k of Object.keys(U.parts)){U.startPractice(k);await W(80);const s=U.state(),c=document.getElementById('n5-content');
      const q=s.qs[0],need=U.parts[k].spoken?3:4;if(c.querySelectorAll('[data-n5=pick]').length!==need)bad.push(k+':opts');
      if(!c.querySelector('#n5-ask'))bad.push(k+':ask');if(U.parts[k].audio&&!c.querySelector('[data-n5=play]'))bad.push(k+':play');
      if(['text','short','mid','info'].includes(k)&&!c.querySelector('.n5-passage'))bad.push(k+':passage');
      if(k==='order'&&c.querySelectorAll('.n5-slot').length!==4)bad.push(k+':slots');
      document.querySelector('#n5-content [data-n5=exit]').click();await W(40);}
    return bad;`);
  ok('14 төрөл бүр зурагдана: сонголтын тоо, эх, ★ нүд, сонсох товч', kinds.length === 0, kinds.join(' '));

  console.log('\n[D] Бүтэн шалгалт');
  const mk = await ev(`const W=ms=>new Promise(r=>setTimeout(r,ms)),U=window.KOTO_N5UI;localStorage.removeItem('koto-n5');U.startMock();await W(200);
    const s=U.state(),per=[0,1,2].map(i=>s.qs.filter(q=>q.sec===i).length),parts={};s.qs.forEach(q=>parts[q.part]=(parts[q.part]||0)+1);
    const clock=(document.getElementById('n5-clock')||{}).textContent,noFb=!document.querySelector('#n5-content [data-n5=check]');
    const first=s.qs[0].part,order=[...new Set(s.qs.map(q=>q.part))].join(',');
    const pos=[0,1,2,3].map(i=>s.qs.filter(q=>q.ans===i).length),okAns=s.qs.every(q=>q.opts[q.ans]===q.o[0]);
    return {n:s.qs.length,per,parts,clock,noFb,first,order,pos,okAns};`);
  ok('Сонголт холигдоно: зөв хариулт 1-р байрлалд 60%-иас бага, 3+ байрлалд; opts[ans] нь эх өгөгдлийн зөв хариулт', mk.okAns && mk.pos.filter(Boolean).length >= 3 && mk.pos[0] < 54, JSON.stringify(mk.pos));
  ok('90 асуулт: 35 · 31 · 24, албан ёсны дараалал (漢字読み → … → 即時応答), цаг 25:00, шууд үнэлгээгүй', mk.n === 90 && mk.per.join() === '35,31,24' && mk.order === 'kanji,hyouki,bunmyaku,iikae,form,order,text,short,mid,info,task,point,speech,resp' && /^2[45]:\d\d$/.test(mk.clock) && mk.noFb, JSON.stringify(mk));
  const dup = await ev(`const U=window.KOTO_N5UI;let bad=[];for(let t=0;t<300;t++){const seen=new Set(),a=U.draw('kanji',12,seen),b=U.draw('hyouki',8,seen),c=U.draw('bunmyaku',10,seen);
      const w=a.map(q=>q.src.w).concat(b.map(q=>q.src.o[0])),x=c.map(q=>q.src.o[0]);if(new Set(w).size!==w.length||new Set(x).size!==x.length||a.length!==12||b.length!==8||c.length!==10)bad.push(w.join()+'|'+x.join());}
    const p=U.draw('kanji',10).map(q=>q.src.w);return {bad:bad.length,ex:bad[0],p:new Set(p).size};`);
  ok('300 сугалаа: нэг шалгалтад ижил үг давхар гарахгүй (漢字読み↔表記 хооронд ч), тоо бүтэн', dup.bad === 0 && dup.p === 10, JSON.stringify(dup).slice(0, 200));
  const tm = await ev(`const W=ms=>new Promise(r=>setTimeout(r,ms)),U=window.KOTO_N5UI,s=U.state();U.expire();await W(150);const a=s.sec;const clock=(document.getElementById('n5-clock')||{}).textContent;
    const q=s.qs[s.i];return {sec:a,first:q.part,clock,i:s.i};`);
  ok('Хэсгийн цаг дуусахад дараагийн хэсэг (文法 · 50:00) руу автоматаар', tm.sec === 1 && tm.first === 'form' && /^(50|49):\d\d$/.test(tm.clock), JSON.stringify(tm));
  const fin = await ev(`const W=ms=>new Promise(r=>setTimeout(r,ms)),U=window.KOTO_N5UI,s=U.state();s.qs.forEach(q=>q.pick=q.ans);U.expire();await W(80);U.expire();await W(150);
    const t=(document.getElementById('n5-res')||{}).textContent,total=(document.querySelector('.n5-total strong')||{}).textContent,h=JSON.parse(localStorage.getItem('koto-n5')||'[]');
    return {done:s.done,t,total,h:h[0],rows:document.querySelectorAll('.n5-table tbody tr').length,miss:document.querySelectorAll('.n5-miss').length};`);
  ok('Бүгд зөв → 180/180 «Тэнцсэн», 14 мөрийн хүснэгт, алдаагүй, түүх хадгалагдана', fin.done && fin.t === 'Тэнцсэн!' && fin.total === '180' && fin.rows === 14 && fin.miss === 0 && fin.h && fin.h.total === 180 && fin.h.pass, JSON.stringify(fin));
  const sc = await ev(`const U=window.KOTO_N5UI,mk=(lang,lt,lis,ls)=>[...Array(lt)].map((_,i)=>({part:'kanji',ans:0,pick:i<lang?0:1})).concat([...Array(ls)].map((_,i)=>({part:'task',ans:0,pick:i<lis?0:1})));
    return {a:U.score(mk(60,66,24,24)),b:U.score(mk(20,66,24,24)),c:U.score(mk(50,66,7,24)),d:U.score(mk(0,66,0,24))};`);
  ok('Оноо: 120+60; нийт ≥ 80 ч «хэлний мэдлэг» < 38 эсвэл «сонсгол» < 19 бол тэнцэхгүй', sc.a.total === 169 && sc.a.pass && sc.b.lang === 36 && !sc.b.pass && sc.c.listen === 18 && sc.c.total === 109 && !sc.c.pass && sc.d.total === 0, JSON.stringify(sc));
  await ev(`document.querySelector('#n5-content [data-n5=exit]').click();return true;`);

  console.log('\n[E] Сонсгол ба гарах');
  const au = await ev(`const W=ms=>new Promise(r=>setTimeout(r,ms)),U=window.KOTO_N5UI,c=()=>document.getElementById('n5-content'),btn=()=>c().querySelector('[data-n5=play]');
    U.startPractice('task');await W(80);const tq=U.state().qs[0];const r=await fetch(tq.src.audio,{method:'HEAD'});
    btn().click();await W(300);btn().click();await W(300);const prac={played:tq.played,off:btn().disabled};
    c().querySelector('[data-n5=exit]').click();await W(50);
    U.startMock();await W(80);U.expire();await W(80);U.expire();await W(120);const m=U.state(),q=m.qs[m.i];
    const at={sec:m.sec,part:q.part,label:btn()&&btn().textContent};btn().click();await W(200);
    const after={played:q.played,off:btn().disabled};q.pick=null;c().querySelector('[data-n5=next]').click();await W(80);c().querySelector('[data-n5=prev]').click();await W(80);
    return {status:r.status,type:r.headers.get('content-type'),prac,at,after,back:{off:btn().disabled,label:btn().textContent,played:q.played}};`);
  ok('Дуу сервер дээр (200, audio/mpeg); дасгалд дахин сонсож болно (2 удаа)', au.status === 200 && /audio\/mpeg/.test(au.type || '') && au.prac.played === 2 && !au.prac.off, JSON.stringify(au).slice(0, 200));
  ok('Бүтэн шалгалт: сонсгол (聴解) 課題理解-ээр эхэлж, нэг дармагц товч хаагдана, буцаж ирэхэд «Сонссон»', au.at.sec === 2 && au.at.part === 'task' && /Сонсох/.test(au.at.label) && au.after.played === 1 && au.after.off && au.back.off && /Сонссон/.test(au.back.label) && au.back.played === 1, JSON.stringify([au.at, au.after, au.back]));
  const ex = await ev(`const W=ms=>new Promise(r=>setTimeout(r,ms)),d=document.getElementById('n5-dialog');document.querySelector('#n5-content [data-n5=exit]').click();await W(80);
    const first={open:d.open,warn:!!document.querySelector('#n5-content .is-warn')};document.querySelector('#n5-content [data-n5=exit]').click();await W(80);return {first,second:d.open};`);
  ok('Бүтэн шалгалтын дундаас гарахад нэг удаа анхааруулж, дахин дарахад хаагдана', ex.first.open && ex.first.warn && ex.second === false, JSON.stringify(ex));

  console.log('\n[F] Утас 390');
  await size(390, 844, true); await nav(SITE + '#test');
  const m390 = await ev(`const W=ms=>new Promise(r=>setTimeout(r,ms));await W(200);const pg=document.documentElement.scrollWidth;window.KOTO_N5UI.startPractice('mid');await W(150);
    const c=document.getElementById('n5-dialog'),o=[...c.querySelectorAll('*')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).length,small=[...c.querySelectorAll('[data-n5=pick]')].filter(b=>b.getBoundingClientRect().height<44).length;
    return {pg,vw:innerWidth,o,small,nav:[...document.querySelectorAll('.nav-item')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).length};`);
  ok('390: нүүр ба цонх хэвтээ гүйлтгүй, сонголт ≥ 44px, цэс багтана', m390.pg <= m390.vw && m390.o === 0 && m390.small === 0 && m390.nav === 0, JSON.stringify(m390));
  await shot('n5-mid-390');
  await ev(`document.querySelector('#n5-content [data-n5=exit]').click();localStorage.removeItem('koto-n5');return true;`);

  console.log('\n[G] Консол');
  ok('барьсангүй уналт гараагүй (' + errs.length + ')', errs.length === 0, errs.join(' | '));
  console.log('\n──────────────\ntsever: ' + good + '   unasan: ' + bad + '\nzurag: ' + OUT);
  ws.close(); chrome.kill(); process.exit(bad ? 1 : 0);
})().catch(e => { console.log('ALDAA', e && e.message); process.exit(2); });
