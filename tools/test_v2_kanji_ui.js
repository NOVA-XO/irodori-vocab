/* v2 (KOTO) — «ХАНЗ» хуудасны хөтчийн тест (N5 79 + N4 166).
 *
 * Өгөгдлийг (jisho-гийн жагсаалт, v1-ийн утга, жишээ) `test_v2_kanji.js`
 * шалгана; энд: цэс ба хуудас, хичээлийн хуваалт, 4 төрлийн асуулт (ханз →
 * утга, утга → ханз, ханз → уншлага, жишээ үг), хувилбар давхцахгүй,
 * дуусгалт → `state.kana`-д J-id (катакана шиг хуваарь), жишээ үгийн алдаа
 * ханзанд тоологдох, давтлага, дуудлага (ханз өөрөө хоолойгүй), 4 өргөн.
 *
 * Ажиллуулах:
 *     python -m http.server 8765 --bind 127.0.0.1     (репогийн үндсээс)
 *     node tools/test_v2_kanji_ui.js
 */
'use strict';
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const DBG = 9247;
const SITE = process.env.SITE_V2 || 'http://127.0.0.1:8765/v2/';
const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT = path.join(require('os').tmpdir(), 'koto-kanji-shots') + path.sep;
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });

let bad = 0, good = 0;
const fails = [];
function ok(name, pass, extra) {
  if (pass) { good++; console.log('  ok   ' + name); }
  else { bad++; fails.push(name + (extra ? ' — ' + extra : '')); console.log('  FAIL ' + name + (extra ? '  ' + String(extra).slice(0, 500) : '')); }
}
function getJSON(p, method) {
  return new Promise((res, rej) => {
    const req = http.request({ host: '127.0.0.1', port: DBG, path: p, method: method || 'GET' },
      r => { let b = ''; r.on('data', c => b += c); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); });
    req.on('error', rej); req.end();
  });
}

(async () => {
  const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + DBG,
    '--no-first-run', '--disable-gpu', '--mute-audio', '--window-size=1400,900',
    '--user-data-dir=' + require('os').tmpdir() + '\\kotokanji-' + Date.now(), 'about:blank'], { stdio: 'ignore' });
  let tab = null;
  for (let i = 0; i < 60 && !tab; i++) {
    try { tab = await getJSON('/json/new?' + encodeURIComponent(SITE), 'PUT'); } catch (e) { await sleep(250); }
  }
  if (!tab) { console.log('Chrome neegdsengui'); chrome.kill(); process.exit(2); }
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const w = new Map(); const errs = [];
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && w.has(m.id)) { const x = w.get(m.id); w.delete(m.id); m.error ? x.rej(new Error(JSON.stringify(m.error))) : x.res(m.result); }
    if (m.method === 'Runtime.exceptionThrown') { const d = m.params.exceptionDetails; errs.push(String((d.exception || {}).description || d.text).slice(0, 200)); }
  };
  const send = (method, params) => new Promise((res, rej) => { const i = ++id; w.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  await send('Runtime.enable');
  const ev = async expr => {
    const r = await send('Runtime.evaluate', { expression: '(async()=>{' + expr + '})()', awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300));
    return r.result.value;
  };
  const shot = async name => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(OUT + name + '.png', Buffer.from(r.data, 'base64')); };
  const nav = async () => {
    await send('Page.navigate', { url: SITE });
    for (let i = 0; i < 40; i++) { await sleep(150); try { if (await ev('return !!window.KOTO')) break; } catch (e) {} }
    if (!(await ev('return !!window.KOTO').catch(() => false))) { console.log('KOTO ачаалагдсангүй — локал сервер ажиллаж байна уу? (STATE §2.94)'); process.exit(2); }
    await sleep(300);
  };
  const media = dark => send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }] });
  const size = (wd, ht, mobile) => send('Emulation.setDeviceMetricsOverride', { width: wd, height: ht, deviceScaleFactor: 1, mobile: !!mobile });
  /* Хөтөч рүү очих код: `\d` бичихгүй (STATE §2.89). */
  const H = `const S=ms=>new Promise(r=>setTimeout(r,ms)),$q=s=>document.querySelector('#lesson-content '+s),K=window.KOTO,J=K.kanji,cur=()=>{const s=K.numTest.session();return s&&s.queue[s.pos];};
    const answer=async(right)=>{const q=cur();if(q.type==='learn'){$q('[data-action=next]').click();await S(30);return;}
      const i=right?q.options.indexOf(q.correct):q.options.findIndex(o=>o!==q.correct);$q('[data-option="'+i+'"]').click();await S(20);$q('[data-action=check]').click();await S(30);$q('[data-action=next]').click();await S(40);};`;

  await size(1400, 900, false); await media(false);
  await nav(); await ev(`localStorage.clear();`); await nav();

  console.log('\n[1] Цэс ба хуудас');
  const pg = await ev(`location.hash='kanji';await new Promise(r=>setTimeout(r,250));const v=document.getElementById('view-kanji'),d=window.KOTO.kanji.data();
    return {shown:!v.hidden,nav:document.querySelectorAll('.nav-item').length,cur:!!document.querySelector('.nav-item[data-view=kanji][aria-current=page]'),page:document.getElementById('page-name').textContent,
      lessons:v.querySelectorAll('[data-action=kanji-lesson]').length,review:(v.querySelector('[data-action=kanji-review]')||{}).disabled,total:d.total,levels:d.levels.map(l=>l.label+':'+l.total)};`);
  ok('6 дахь цэс «Ханз» идэвхтэй, хуудас: 50 хичээлийн товч (N5 16 + N4 34), давтлага үзээгүй үед хаалттай, 245 ханз',
    pg.shown && pg.nav === 6 && pg.cur && pg.page === 'Ханз' && pg.lessons === 50 && pg.review === true && pg.total === 245 && pg.levels.join() === 'N5:79,N4:166', JSON.stringify(pg));
  await shot('page-1400');

  console.log('\n[2] Хичээлийн хуваалт ба асуулт');
  const sp = await ev(`const L=window.KOTO.kanji.lessons();return {n5:L.filter(l=>l.n===5).map(l=>l.chars.length).join(''),n4:L.filter(l=>l.n===4).map(l=>l.chars.length).join(''),
    seq:L.flatMap(l=>l.chars.map(c=>c.jp)).join('')===window.KOTO_KANJI.map(k=>k.c).join('')};`);
  ok('N5 16 хичээл (15×5 + 4), N4 34 (30×5 + 4×4) — 1 ханзтай хичээл үгүй; дараалал jisho-гийнх', sp.n5 === '5'.repeat(15) + '4' && sp.n4 === '5'.repeat(30) + '4444' && sp.seq, JSON.stringify(sp));
  const qz = await ev(`const J=window.KOTO.kanji,bad=[],dirs={};let n=0;
    for(const k of J.list())for(let r=0;r<8;r++)for(const q of J.quizzes(k)){n++;dirs[q.direction]=(dirs[q.direction]||0)+1;
      if(q.options.length!==4||new Set(q.options).size!==4||q.options.filter(o=>o===q.correct).length!==1)bad.push(k.jp+' '+q.direction+' '+q.options.join('/'));
      if(q.rid!==k.id)bad.push(k.jp+' rid');
      const same=J.list().filter(x=>x.n===k.n&&x.id!==k.id);
      if(q.direction==='kj-mn'&&q.options.some(o=>o!==k.mn&&!same.some(x=>x.mn===o)))bad.push(k.jp+' kj-mn foreign');
      if(q.direction==='kj-read'&&q.correct!==k.read)bad.push(k.jp+' read');
      if(q.direction==='kw-read'&&!k.exw.some(e=>e.jp===q.word.jp&&e.kana===q.correct))bad.push(k.jp+' kw');}
    const e=J.list().filter(k=>!k.exw.length).map(k=>J.quizzes(k).map(q=>q.direction).join(','));
    return {n,dirs,bad:bad.slice(0,6),nb:bad.length,noEx:[...new Set(e)],ins:J.list().find(k=>k.jp==='員').read+'|'+J.list().find(k=>k.jp==='院').read};`);
  ok('245 ханз × 8 удаа (' + qz.n + ' асуулт): 4 өөр хувилбар, зөв нь 1, хувилбар ижил түвшнээс, уншлага/жишээ зөв',
    qz.nb === 0 && qz.dirs['kj-mn'] === 1960 && qz.dirs['mn-kj'] === 1960 && qz.dirs['kj-read'] === 1960 && qz.dirs['kw-read'] === 1912, JSON.stringify(qz));
  ok('жишээгүй ханзад 3 асуулт (kw-read алга); 員/院 ижил «イン» уншлага давхар зөв болохгүй', qz.noEx.join() === 'kj-mn,mn-kj,kj-read' && qz.ins === 'イン|イン', JSON.stringify(qz));
  /* Давхар утгатай ханз өгөгдөлд ховор (員/院, 曜/洋) — санамсаргүй шалгалт барихгүй байв (mutation 11-04).
     Бүх ханз ижил утгатай гэж тавибал буруу хувилбар нэг л үлдэх ёстой. */
  const pk = await ev(`const J=window.KOTO.kanji,k=J.list()[100];return {same:J.pick(k,x=>x===k?'зөв':'ижил',3),self:J.pick(k,x=>'зөв',3),norm:J.pick(k,x=>x.jp,3).length};`);
  ok('буруу хувилбар давхардахгүй, зөв хариулттай ижил утга орохгүй (тогтмол шалгалт)', pk.same.length === 1 && pk.self.length === 0 && pk.norm === 3, JSON.stringify(pk));
  /* Astra-гийн хяналт (11-04): утгын ХЭСЭГ давхцсан ханз (思«бодох» / 考«бодох, эргэцүүлэх») хоёулаа зөв мэт.
     Тестийн өөрийн тодорхойлолтоор («,» ба «;»), N4-ийн 22 хосын ханз бүрийг 300 удаа. */
  const ov = await ev(`const J=window.KOTO.kanji,L=J.list(),parts=k=>k.mn.split(/[;；,，]/).map(s=>s.trim().toLowerCase()).filter(Boolean),
      over=(a,b)=>parts(a).some(m=>parts(b).includes(m)),bad=[];let pairs=0,tested=0;
    for(const k of L){const mates=L.filter(x=>x.n===k.n&&x!==k&&over(x,k));if(!mates.length)continue;pairs+=mates.length;tested++;
      for(let r=0;r<300;r++)for(const q of J.quizzes(k)){if(q.direction==='kj-mn'&&q.options.some(o=>o!==k.mn&&mates.some(m=>m.mn===o)))bad.push(k.jp+' kj-mn');
        if(q.direction==='mn-kj'&&q.options.some(o=>mates.some(m=>m.jp===o)))bad.push(k.jp+' mn-kj');}}
    return {pairs:pairs/2,tested,bad:[...new Set(bad)].slice(0,6)};`);
  ok('утгын хэсэг давхцсан ханз (' + ov.pairs + ' хос, ' + ov.tested + ' ханз × 300) нэг асуултад хамт гарахгүй', ov.pairs === 22 && !ov.bad.length, JSON.stringify(ov));

  console.log('\n[3] Хичээл дуусгах');
  const ls = await ev(`${H}document.querySelector('#view-kanji [data-action=kanji-lesson][data-kanji="0"]').click();await S(200);const s=K.numTest.session(),out={};
    out.title=s.title;out.types=s.queue.map(q=>q.type==='learn'?'L':q.direction[0]).join('');out.learn=$q('.learn-kana, [lang=ja]')&&document.getElementById('exercise-title').textContent;
    out.mainAudio=!!$q('[data-au-for="'+s.queue[0].word.id+'"]');out.exAudio=document.querySelectorAll('#lesson-content [data-au-for^="JW:"]').length;
    for(let i=0;i<5;i++)await answer(true);
    const kw=cur().direction==='kw-read'?cur():s.queue.slice(s.pos).find(q=>q.direction==='kw-read');
    while(!s.completed){const q=cur();if(q.direction==='kj-mn'&&out.kjAudio===undefined)out.kjAudio=!!$q('.quiz-prompt-card [data-au-for]');await answer(q!==kw);if(q===kw)out.kwRid=Object.keys(s.results).includes(kw.rid);}
    const st=K.state(),d=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ulaanbaatar',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const ids=s.words.map(k=>k.id);out.store=ids.every(i=>st.kana[i]&&st.kana[i].due&&st.kana[i].last===d);out.weak=ids.filter(i=>st.kana[i].weak).map(i=>J.list().find(k=>k.id===i).jp);
    out.kwK=J.list().find(k=>k.id===kw.rid).jp;out.day=ids.every(i=>(st.days[d]||[]).includes(i));out.xp=st.xp;out.wordsUntouched=Object.keys(st.words).length;
    out.h1=(document.querySelector('#lesson-content .completion h1')||{}).textContent;out.p=(document.querySelector('#lesson-content .completion p')||{}).textContent;
    document.querySelector('#lesson-content [data-action=finish]').click();await S(150);const d2=J.data();out.seen=d2.seen;out.due=d2.due;out.lesson0=d2.levels[0].lessons[0].seen;return out;`);
  ok('эхний хичээл «Ханз N5 · 1-р хичээл»: 5 танилцах карт + 5×4 асуулт', ls.title === 'Ханз N5 · 1-р хичээл' && /^LLLLL/.test(ls.types) && ls.types.length === 25, JSON.stringify(ls));
  ok('ханз өөрөө хоолойгүй — танилцах карт ба «ханз → утга» асуултад (TTS ганц ханзыг буруу уншина), жишээ үгс бичлэгтэй',
    !ls.mainAudio && ls.kjAudio === false && ls.exAudio >= 1, JSON.stringify({ main: ls.mainAudio, kj: ls.kjAudio, ex: ls.exAudio }));
  ok('дуусгалт: «Ханзаа бататгалаа!», 5 ханз state.kana-д (хуваарь, өнөөдөр), өдрийн бүртгэлд, үгийн ахиц хөндөгдөөгүй',
    ls.h1 === 'Ханзаа бататгалаа!' && /^5 ханз дээр/.test(ls.p) && ls.store && ls.day && ls.wordsUntouched === 0, JSON.stringify(ls));
  ok('жишээ үгэнд алдвал ТЭР ханз сул болно (' + ls.kwK + ')', ls.kwRid && ls.weak.length === 1 && ls.weak[0] === ls.kwK, JSON.stringify({ weak: ls.weak, kw: ls.kwK }));
  ok('хуудас: 5 үзсэн, 1 давтах, эхний хичээл 5/5', ls.seen === 5 && ls.due === 1 && ls.lesson0 === 5, JSON.stringify(ls));

  console.log('\n[4] Давтлага');
  const rv = await ev(`${H}const b=document.querySelector('#view-kanji [data-action=kanji-review]');const dis=b.disabled;b.click();await S(200);const s=K.numTest.session();
    const first=s.words[0].id,weak=Object.entries(K.state().kana).filter(([i,r])=>i.startsWith('J-')&&r.weak).map(([i])=>i);
    const out={dis,title:s.title,n:s.words.length,learn:s.queue.some(q=>q.type==='learn'),first:weak.includes(first)};document.querySelector('#lesson-content [data-action=exit]').click();await S(60);document.querySelector('#lesson-content [data-action=discard]').click();await S(100);return out;`);
  ok('давтлага: товч нээлттэй, «Ханзны давтлага», сул ханз эхэнд, танилцах карт үгүй', !rv.dis && rv.title === 'Ханзны давтлага' && rv.first && !rv.learn && rv.n >= 1 && rv.n <= 5, JSON.stringify(rv));
  const kata = await ev(`const p=window.KOTO.profile.data();return {seen:p.kana.seen,total:p.kana.total};`);
  ok('катаканы тоо ханзаар бохирдоогүй (ижил store, өөр id)', kata.seen === 0 && kata.total === 107, JSON.stringify(kata));

  console.log('\n[5] Зохиомж — 1400 / 390 / 390 бараан / 320');
  const TAP = `const bad=[];for(const b of document.querySelectorAll(SEL)){const r=b.getBoundingClientRect();if(!r.width&&!r.height)continue;if(r.width<44||r.height<44)bad.push((b.className||b.dataset.action||'').toString().slice(0,30)+' '+Math.round(r.width)+'x'+Math.round(r.height));}`;
  for (const [wd, ht, dk] of [[1400, 900, false], [390, 844, false], [390, 844, true], [320, 640, false]]) {
    const tag = wd + (dk ? ' бараан' : '');
    await size(wd, ht, wd < 700); await media(dk); await nav();
    const hp = await ev(`location.hash='kanji';await new Promise(r=>setTimeout(r,250));const SEL='#view-kanji button, .nav-item';${TAP}
      const clip=[...document.querySelectorAll('.nav-item')].filter(n=>n.offsetParent).flatMap(n=>[...n.querySelectorAll('span:not([data-icon]):not(.nav-count):not(.notification-dot)')].filter(s=>{const r=s.getBoundingClientRect(),b=n.getBoundingClientRect();return r.width&&(r.left<b.left-1||r.right>b.right+1);}).map(s=>s.textContent));
      /* 11-04 зургаар: «Тоглоо/м» — үг бүр нэг мөрөнд (Range-ийн хүрээ 1). */
      const split=[];for(const s of document.querySelectorAll('.nav-item span:not([data-icon]):not(.nav-count):not(.notification-dot)')){const t=s.firstChild;if(!t||t.nodeType!==3||!s.offsetParent)continue;
        let i=0;for(const wd of t.textContent.split(' ')){const r=document.createRange();r.setStart(t,i);r.setEnd(t,i+wd.length);if(wd&&r.getClientRects().length>1)split.push(wd);i+=wd.length+1;}}
      return {page:document.documentElement.scrollWidth,bad,clip,split};`);
    ok(tag + ': «Ханз» хуудас — хэвтээ гүйлт 0, товч 44px+, 6 цэсийн нэр хальдаггүй, үгийн дундуур тасардаггүй', hp.page <= wd && !hp.bad.length && !hp.clip.length && !hp.split.length, JSON.stringify(hp));
    await shot('page-' + wd + (dk ? '-dark' : ''));
    const steps = await ev(`${H}document.querySelector('#view-kanji [data-action=kanji-lesson][data-kanji="1"]').click();await S(200);const out=[];const SEL='#lesson-dialog button';
      const m=t=>{${TAP}out.push([t,document.getElementById('lesson-dialog').scrollWidth,bad]);};m('learn');
      const s=K.numTest.session();for(let i=0;i<5;i++)await answer(true);const seen=new Set();
      while(!s.completed&&seen.size<4){const q=cur();if(!seen.has(q.direction)){seen.add(q.direction);m(q.direction);}await answer(true);}
      document.querySelector('#lesson-content [data-action=exit]')&&document.querySelector('#lesson-content [data-action=exit]').click();await S(50);const dc=document.querySelector('#lesson-content [data-action=discard]');if(dc)dc.click();await S(100);
      return out;`);
    ok(tag + ': танилцах карт ба 4 төрлийн асуулт — хэвтээ гүйлт 0, товч 44px+', steps.length === 5 && steps.every(([, dw, b]) => dw <= wd && !b.length), JSON.stringify(steps.filter(([, dw, b]) => dw > wd || b.length).concat([['n', steps.length]])));
    await ev(`document.querySelector('#view-kanji [data-action=kanji-lesson][data-kanji="2"]').click();`); await sleep(250);
    await shot('learn-' + wd + (dk ? '-dark' : ''));
    await ev(`document.querySelector('#lesson-content [data-action=exit]').click();await new Promise(r=>setTimeout(r,50));document.querySelector('#lesson-content [data-action=discard]').click();`); await sleep(100);
  }

  console.log('\n[6] Консол');
  ok('барьсангүй уналт гараагүй', errs.length === 0, errs.slice(0, 3).join(' | '));

  console.log('\n' + '─'.repeat(50));
  console.log('tsever: ' + good + '   unasan: ' + bad + '\nzurag: ' + OUT);
  if (fails.length) { console.log('\nUNASAN:'); fails.forEach(x => console.log('  · ' + x)); }
  try { ws.close(); } catch (e) {}
  chrome.kill();
  process.exit(bad ? 1 : 0);
})().catch(e => { console.log('ALDAA: ' + e.message); process.exit(2); });
