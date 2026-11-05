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
  ok('6 дахь цэс «Ханз» идэвхтэй, хуудас: 204 хичээлийн товч (N5 16 + N4 34 + N3 74 + N2 38 + Бусад 42), давтлага үзээгүй үед хаалттай, 1009 ханз',
    pg.shown && pg.nav === 6 && pg.cur && pg.page === 'Ханз' && pg.lessons === 204 && pg.review === true && pg.total === 1009 && pg.levels.join() === 'N5:79,N4:166,N3:367,N2:189,Бусад:208', JSON.stringify(pg));
  await shot('page-1400');
  /* Astra №41 (11-05): 124 товч + 612 хавтан хэт урт — N5 нээлттэй, N4/N3 хаалттай, «Бүх ханз» хаалттай; нээснийг дахин зурахад хадгална. */
  const lv = await ev(`const v=document.getElementById('view-kanji'),L=[...v.querySelectorAll('details.kj-level')];const out={n:L.length,open:L.map(d=>d.dataset.kjLevel+':'+d.open).join(),inv:[...v.querySelectorAll('details.kj-inventory')].map(d=>d.open).join()};
    L[2].open=true;window.KOTO.kanji.data();location.hash='learn';await new Promise(r=>setTimeout(r,150));location.hash='kanji';await new Promise(r=>setTimeout(r,250));
    out.kept=[...document.querySelectorAll('#view-kanji details.kj-level')].map(d=>d.open).join();return out;`);
  ok('түвшин эвхэгддэг: N5 нээлттэй, N4…Бусад хаалттай, «Бүх ханз» хаалттай; N3-ийг нээгээд цэс солиход нээлттэй хэвээр',
    lv.n === 5 && lv.open === '5:true,4:false,3:false,2:false,0:false' && lv.inv === 'false,false,false,false,false' && lv.kept === 'true,false,true,false,false', JSON.stringify(lv));
  /* Номын шүүлтүүр (11-05, эзэн «JLPT + номын шошго»): тестийн өөрийн тодорхойлолт — ханзны b нь тухайн номыг агуулна. */
  const bk = await ev(`const S=ms=>new Promise(r=>setTimeout(r,ms)),v=()=>document.getElementById('view-kanji'),K=window.KOTO_KANJI,byC=Object.fromEntries(K.map(k=>[k.c,k]));
    const vis=()=>[...v().querySelectorAll('[data-action=kanji-lesson]')].filter(b=>!b.hidden);
    const out={chips:[...v().querySelectorAll('[data-action=kj-book]')].map(b=>b.textContent.trim()+':'+b.getAttribute('aria-pressed')).join('|')};
    v().querySelector('[data-action=kj-book][data-kj-book=A1]').click();await S(150);
    const want=window.KOTO.kanji.lessons().filter(l=>l.chars.some(c=>(byC[c.jp].b||[]).includes('A1'))).length;
    out.a1=vis().length;out.want=want;out.ok=vis().every(b=>[...b.querySelectorAll('.p-kana-chars span')].some(x=>(byC[x.textContent].b||[]).includes('A1')));
    out.tiles=[...v().querySelectorAll('.kj-grid li')].filter(li=>!li.hidden).every(li=>(byC[li.querySelector('.kj-tile-char').textContent].b||[]).includes('A1'));
    out.stored=localStorage.getItem('koto-kj-book');out.note=!!v().querySelector('.kj-book-note');out.focus=document.activeElement&&document.activeElement.dataset.kjBook;
    v().querySelector('[data-action=kj-book][data-kj-book=""]').click();await S(150);
    out.all=vis().length;out.cleared=localStorage.getItem('koto-kj-book');return out;`);
  ok('номын шүүлтүүр: 4 чип (Бүгд идэвхтэй); «Суурь шат» → зөвхөн 入門-ийн ханзтай хичээл/ханз, төхөөрөмжид хадгална, фокус хэвээр; «Бүгд» → 204',
    /^Бүгд:true\|Суурь шат:false\|Анхан шат 1:false\|Анхан шат 2:false$/.test(bk.chips) && bk.a1 === bk.want && bk.a1 > 50 && bk.a1 < 204 && bk.ok && bk.tiles &&
      bk.stored === 'A1' && bk.note && bk.focus === 'A1' && bk.all === 204 && bk.cleared === null, JSON.stringify(bk));

  console.log('\n[2] Хичээлийн хуваалт ба асуулт');
  const sp = await ev(`const L=window.KOTO.kanji.lessons();return {n5:L.filter(l=>l.n===5).map(l=>l.chars.length).join(''),n4:L.filter(l=>l.n===4).map(l=>l.chars.length).join(''),n3:L.filter(l=>l.n===3).map(l=>l.chars.length).join(''),
    n2:L.filter(l=>l.n===2).map(l=>l.chars.length).join(''),n0:L.filter(l=>l.n===0).map(l=>l.chars.length).join(''),
    seq:L.flatMap(l=>l.chars.map(c=>c.jp)).join('')===window.KOTO_KANJI.map(k=>k.c).join('')};`);
  ok('N5 16 хичээл (15×5 + 4), N4 34 (30×5 + 4×4), N3 74 (71×5 + 3×4), N2 38 (37×5 + 4), Бусад 42 (40×5 + 2×4) — 1 ханзтай хичээл үгүй; дараалал kanji.js-ийнх',
    sp.n5 === '5'.repeat(15) + '4' && sp.n4 === '5'.repeat(30) + '4444' && sp.n3 === '5'.repeat(71) + '444' && sp.n2 === '5'.repeat(37) + '4' && sp.n0 === '5'.repeat(40) + '44' && sp.seq, JSON.stringify(sp));
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
  ok('1009 ханз × 8 удаа (' + qz.n + ' асуулт): 4 өөр хувилбар, зөв нь 1, хувилбар ижил түвшнээс, уншлага/жишээ зөв (жишээгүй 77-д kw-read алга)',
    qz.nb === 0 && qz.dirs['kj-mn'] === 8072 && qz.dirs['mn-kj'] === 8072 && qz.dirs['kj-read'] === 8072 && qz.dirs['kw-read'] === 7456, JSON.stringify(qz));
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
  ok('утгын хэсэг давхцсан ханз (' + ov.pairs + ' хос, ' + ov.tested + ' ханз × 300) нэг асуултад хамт гарахгүй', ov.pairs === 155 && !ov.bad.length, JSON.stringify(ov));

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

  console.log('\n[6] Ханзны үүсэл (танилцуулга, карт, эртний бичиг)');
  /* Шошгыг тестийн өөрийн тодорхойлолтоор (§2.91) — аппын KJ_ORIGIN_TYPES-ийг ашиглахгүй. */
  const LBL = { pic: 'Зургаас', ind: 'Тэмдгээр', ic: 'Утга нийлсэн', psc: 'Утга + дуу', unk: 'Үүсэл маргаантай' };
  const ANC = { oracle: 'Мэргийн ясны бичиг', bronze: 'Хүрэл бичиг', seal: 'Тамга бичиг' };
  await size(1400, 900, false); await media(false); await nav();
  const intro = await ev(`location.hash='kanji';await new Promise(r=>setTimeout(r,400));const d=document.querySelector('#view-kanji details.kj-origin-intro');
    if(!d)return null;const raw=window.KOTO_KANJI,cnt={};for(const k of raw)cnt[k.o.t]=(cnt[k.o.t]||0)+1;
    const vg0=performance.getEntriesByType('resource').filter(e=>e.name.includes('kanji-vg/')).length;
    const tabs=()=>[...d.querySelectorAll('[data-action=kj-tab]')].map(b=>[b.querySelector('strong').textContent.trim(),b.querySelector('.kj-intro-tab-count').textContent.trim(),b.getAttribute('aria-pressed')]);
    const vis=()=>[...d.querySelectorAll('[data-kj-panel]')].filter(p=>!p.hidden).map(p=>p.dataset.kjPanel+':'+(p.querySelector('.kj-origin-badge')||{}).textContent);
    const out={closed:!d.open,sum:d.querySelector('summary strong').textContent.trim(),cnt,vg0,tabs0:tabs(),vis0:vis(),
      before:!!(d.compareDocumentPosition(document.querySelector('#view-kanji .kj-levels'))&Node.DOCUMENT_POSITION_FOLLOWING)};
    d.open=true;await new Promise(r=>setTimeout(r,80));d.querySelector('[data-kj-tab=psc]').click();await new Promise(r=>setTimeout(r,60));
    out.tabs1=tabs().map(t=>t[2]).join();out.vis1=vis();
    /* 2026-11-05: эх сурвалж/лиценз «Миний → Мэдээлэл» рүү шилжсэн (эзэн: байнга харуулах шаардлагагүй). */
    out.introCredit=/CC BY-SA|Ulrich Apel|ойлгоход туслах/.test(d.textContent);
    location.hash='profile';await new Promise(r=>setTimeout(r,250));
    const inf=document.querySelector('#view-profile #profile-info');out.info=!!inf;
    if(inf){const dd=inf.querySelector('details');out.infoClosed=!dd.open;dd.open=true;
      out.links=[...inf.querySelectorAll('details a')].map(a=>a.target+'|'+a.rel);
      out.src=['Wiktionary','CC BY-SA 4.0','Commons','KanjiVG','Ulrich Apel','CC BY-SA 3.0','The Japan Foundation','KANJIDIC2','VOICEVOX','ойлгоход туслах'].filter(x=>!inf.textContent.includes(x));
      out.privacy=(inf.querySelector('a[href="privacy.html"]')||{}).textContent;}
    location.hash='kanji';await new Promise(r=>setTimeout(r,250));
    const g=document.querySelector('#view-kanji details.kj-gallery');out.gal=!!g;
    if(g){out.galClosed=!g.open;out.groups=[...g.querySelectorAll('.kj-gallery-group')].map(s=>s.querySelectorAll('.kj-gal-item').length).join();
      out.empty=[...g.querySelectorAll('.kj-gal-detail')].every(x=>!x.firstElementChild);out.play=!!g.querySelector('[data-action=game][data-game=kjpic]');
      g.open=true;const it=g.querySelector('.kj-gal-item[data-kj-gal="J-5C71"]');it.open=true;await new Promise(r=>setTimeout(r,400));
      out.toggle=[getComputedStyle(it.querySelector('.kj-gal-show')).display,getComputedStyle(it.querySelector('.kj-gal-hide')).display].join();
      out.open=(it.querySelector('.kj-origin-badge')||{}).textContent;out.openVg=!!it.querySelector('.kj-vg-svg');out.others=[...g.querySelectorAll('.kj-gal-detail')].filter(x=>x.firstElementChild).length;
      out.bad=[...g.querySelectorAll('.kj-gal-item')].filter(x=>!x.querySelector('svg.kj-gal-pic path,svg.kj-gal-pic circle,svg.kj-gal-pic ellipse')||!x.querySelector('.kj-gal-glyph')).length;}
    return out;`);
  const want0 = intro && Object.entries(LBL).map(([t, l]) => [l, intro.cnt[t] + ' ханз', String(t === 'pic')]);
  ok('«Ханз хэрхэн үүссэн бэ?» — хаалттай, хичээлүүдийн өмнө; 5 таб (нэр, тоо нь kanji.js-ээс тестийн тоололоор), эхэнд «Зургаас» л харагдана; хаалттай үед KanjiVG огт татагдахгүй',
    !!intro && intro.closed && intro.before && intro.sum === 'Ханз хэрхэн үүссэн бэ?' && JSON.stringify(intro.tabs0) === JSON.stringify(want0) &&
    intro.vis0.join() === 'pic:' + LBL.pic && intro.vg0 === 0, JSON.stringify(intro));
  ok('таб дарахад тэр самбар л харагдана (дахин зурахгүй), aria-pressed шинэчлэгдэнэ', intro && intro.tabs1 === 'false,false,false,true,false' && intro.vis1.join() === 'psc:' + LBL.psc, JSON.stringify(intro && [intro.tabs1, intro.vis1]));
  ok('эх сурвалж ханзны хуудсанд байхгүй; «Миний → Мэдээлэл» (хаалттай): Irodori, KANJIDIC2, Wiktionary, Commons, KanjiVG, VOICEVOX — холбоос бүр шинэ табд, noopener; нууцлал',
    intro && !intro.introCredit && intro.info && intro.infoClosed && intro.src.length === 0 && intro.links.length >= 8 && intro.links.every(x => /^_blank\|.*noopener/.test(x)) && /Нууцлал/.test(intro.privacy),
    JSON.stringify(intro && { credit: intro.introCredit, info: intro.info, closed: intro.infoClosed, missing: intro.src, links: intro.links }));
  ok('галерей: хаалттай, 52 зураг 4 ангилалд (11 · 20 · 9 · 12), тоглоомын товчтой; нүд бүр зураг+ханзтай; нээх хүртэл дэлгэрэнгүй зурагдахгүй, 山-г нээхэд л үүсэл + KanjiVG',
    intro && intro.gal && intro.galClosed && intro.groups === '11,20,9,12' && intro.empty && intro.play && intro.bad === 0 && intro.open === LBL.pic && intro.openVg && intro.others === 1 && intro.toggle === 'none,inline', JSON.stringify(intro));
  const all = await ev(`const J=window.KOTO.kanji,L=${JSON.stringify(LBL)},A=${JSON.stringify(ANC)},pics=window.KOTO_KANJI_PICS||{},bad=[],box=document.createElement('div');document.body.appendChild(box);
    for(const k of J.list()){box.innerHTML=J.originMarkup(k,{compact:false});const s=box.querySelector('.kj-origin'),o=k.o,e=[],tr=s.querySelector('.kj-origin-track');
      if(s.querySelector('.kj-origin-badge').textContent.trim()!==L[o.t])e.push('badge');
      const anc=[...tr.querySelectorAll('.kj-origin-ancient')];if(anc.length!==(o.a||[]).length)e.push('anc '+anc.length);
      anc.forEach((x,i)=>{if(!x.getAttribute('style').includes('kanji-old/'+k.id+'-'+o.a[i]+'.svg')||!x.closest('figure').textContent.includes(A[o.a[i]]))e.push('ancsrc');});
      const art=tr.querySelector('svg.kj-origin-picture');if(!!art!==!!(o.pc&&pics[k.jp]))e.push('pic');if(art&&!art.getAttribute('aria-label').includes(o.pc))e.push('pc');
      if(art&&tr.firstElementChild.querySelector('svg')!==art)e.push('pic-first');
      if(!tr.querySelector('[data-kj-vg="'+k.id+'"]')||tr.lastElementChild.textContent.indexOf('Одоо')<0)e.push('now');
      if(s.querySelectorAll('.kj-origin-part').length!==(o.p||[]).length)e.push('parts');
      {const r=[...s.querySelectorAll('.kj-origin-role')].map(x=>x.textContent.trim()).filter(t=>t==='УТГА'||t==='ДУУ').join(),w=(o.p||[]).filter(p=>p.r).map(p=>p.r==='s'?'УТГА':'ДУУ').join();if(r!==w)e.push('roles '+r+'/'+w);}
      if(s.querySelectorAll('.kj-origin-match').length!==((o.p||[]).some(p=>p.m)?1:0))e.push('match');
      if((o.p||[]).length&&s.querySelector('.kj-origin-result b').textContent!==(o.old||k.jp))e.push('result');
      if(!s.textContent.includes(o.tx||''))e.push('tx');
      if(!!s.querySelector('.kj-origin-old')!==!!o.old||(o.old&&!s.querySelector('.kj-origin-old').textContent.includes(o.old)))e.push('old');
      if(s.querySelectorAll('.kj-origin-family-row').length!==(o.f||[]).length)e.push('fam');
      if(!!s.querySelector('.kj-origin-disputed')!==(o.t==='unk'))e.push('unk');
      if(!s.querySelector('[data-action=kj-play][data-kj-play=strokes]')||!!s.querySelector('[data-kj-play=evolve]')!==(tr.children.length>1))e.push('play');
      if(e.length)bad.push(k.jp+':'+e.join(','));}
    box.remove();return {n:J.list().length,nb:bad.length,bad:bad.slice(0,8)};`);
  ok('1009 ханз бүрийн карт: шошго, хувьслын бүх үе (файл, нэр), KOTO зураг эхэнд, «Одоо» төгсгөлд KanjiVG-ийн байрлалтай, хэсэг, УТГА/ДУУ, таарц, үр дүн (хуучин хэлбэр 國), тайлбар, гэр бүл, маргаантай, «▶» — өгөгдөлтэй тулгав',
    all.n === 1009 && all.nb === 0, JSON.stringify(all));
  const files = await ev(`const list=window.KOTO.kanji.list().filter(k=>k.o.a).flatMap(k=>k.o.a.map(e=>k.id+'-'+e)),bad=[];
    await Promise.all(list.map(async i=>{const r=await fetch('kanji-old/'+i+'.svg'),t=r.headers.get('content-type')||'';if(!r.ok||!t.includes('svg'))bad.push(i+':'+r.status+':'+t);
      if(!(await new Promise(res=>{const im=new Image();im.onload=()=>res(im.naturalWidth>0);im.onerror=()=>res(false);im.src='kanji-old/'+i+'.svg';})))bad.push(i+' img');}));
    return {n:list.length,bad:bad.slice(0,5)};`);
  ok('эртний бичгийн ' + files.n + ' SVG бүгд ачаалагдана (image/svg+xml, зураг болж задарна)', files.n > 300 && !files.bad.length, JSON.stringify(files));
  const OPEN = c => `const L=window.KOTO.kanji.lessons(),i=L.findIndex(l=>l.chars.some(k=>k.jp==='${c}'));location.hash='kanji';await new Promise(r=>setTimeout(r,150));
    document.querySelector('#view-kanji [data-action=kanji-lesson][data-kanji="'+i+'"]').click();await new Promise(r=>setTimeout(r,250));
    const ss=window.KOTO.numTest.session();while(ss.queue[ss.pos].word.jp!=='${c}'){document.querySelector('#lesson-content [data-action=next]').click();await new Promise(r=>setTimeout(r,60));}
    for(let t=0;t<40&&!document.querySelector('#lesson-content .kj-origin-track .kj-vg-svg');t++)await new Promise(r=>setTimeout(r,50));`;
  const CLOSE = `document.querySelector('#lesson-content [data-action=exit]').click();await new Promise(r=>setTimeout(r,60));const dc=document.querySelector('#lesson-content [data-action=discard]');if(dc)dc.click();await new Promise(r=>setTimeout(r,100));`;
  for (const [wd, ht, dk] of [[390, 844, true], [320, 640, false]]) {
    const tag = wd + (dk ? ' бараан' : '');
    await size(wd, ht, true); await media(dk); await nav();
    const card = await ev(`${OPEN('日')}const s=document.querySelector('#lesson-content .kj-origin'),a=s&&s.querySelector('.kj-origin-track .kj-origin-ancient');
      const rgb=c=>(c.match(/[0-9.]+/g)||[]).map(Number),lum=c=>{const [r,g,b]=rgb(c).map(v=>v/255).map(v=>v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4));return 0.2126*r+0.7152*g+0.0722*b;};
      let el=a,bg='';while(el){const c=getComputedStyle(el).backgroundColor;if(el!==a&&rgb(c).length>=3&&(rgb(c)[3]===undefined||rgb(c)[3]>0)){bg=c;break;}el=el.parentElement;}
      const cs=a&&getComputedStyle(a),fg=cs&&cs.backgroundColor,L1=lum(fg),L2=lum(bg),con=(Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05);
      const out={mask:cs&&String(cs.maskImage||cs.webkitMaskImage).includes('J-65E5-oracle.svg'),fg,bg,con:Math.round(con*10)/10,pic:!!s.querySelector('svg.kj-origin-picture'),
        vg:!!s.querySelector('.kj-origin-track .kj-vg-svg'),over:s.scrollWidth-s.clientWidth,dlg:document.getElementById('lesson-dialog').scrollWidth};
      const tr=s.querySelector('.kj-origin-track'),b=s.getBoundingClientRect(),st=[...tr.querySelectorAll(':scope > .kj-origin-stage')];
      out.stages=st.length;out.inside=st.every(f=>{const r=f.getBoundingClientRect();return r.left>=b.left-1&&r.right<=b.right+1&&r.width>0;});out.trScroll=tr.scrollWidth-tr.clientWidth;${CLOSE}return out;`);
    ok(tag + ': 日-ийн карт — эртний бичиг mask-аар, өнгө нь бичгийн өнгө, ялгарал ≥ 4.5, KOTO зураг, KanjiVG ачаалагдсан, хальдаггүй; 5 үе бүгд гүйлгээгүй картад багтана (Astra №41)',
      card.mask && card.con >= 4.5 && card.pic && card.vg && card.over <= 1 && card.dlg <= wd && card.stages === 5 && card.inside && card.trScroll <= 1, JSON.stringify(card));
    /* 語: KanjiVG-ийн 14 зурлага — эхний 7 нь 言 (УТГА), сүүлийн 7 нь 吾 (ДУУ); өнгө нь ялгаатай ба дэвсгэртэй ялгарна. */
    const vg = await ev(`${OPEN('語')}const s=document.querySelector('#lesson-content .kj-origin'),svg=s.querySelector('.kj-origin-track .kj-vg-svg'),ps=svg?[...svg.querySelectorAll('.kj-vg-stroke')]:[];
      const col=p=>getComputedStyle(p).stroke,out={colored:!!svg&&svg.classList.contains('kj-vg--colored'),n:ps.length,
        s:ps.slice(0,7).every(p=>p.classList.contains('kj-tone-s')),p:ps.slice(7).every(p=>p.classList.contains('kj-tone-p')),diff:ps.length?col(ps[0])!==col(ps[13]):false,
        note:[...s.querySelectorAll('.kj-origin-color-note')].filter(n=>getComputedStyle(n).display!=='none').map(n=>n.className.split(' ').pop())};
      const b=s.querySelector('[data-kj-play=strokes]');b.click();await new Promise(r=>setTimeout(r,80));out.play=s.classList.contains('is-playing-strokes');
      out.anim=getComputedStyle(ps[0]).animationName;const ev2=s.querySelector('[data-kj-play=evolve]');out.evo=!!ev2;
      if(ev2){ev2.click();await new Promise(r=>setTimeout(r,80));out.evolve=s.classList.contains('is-playing-evolve')&&!s.classList.contains('is-playing-strokes');}
      ${CLOSE}return out;`);
    ok(tag + ': 語 — KanjiVG-ийн 14 зурлага, 言 (7) УТГА · 吾 (7) ДУУ өнгөөр ялгаатай, «өнгө нь одоогийн хэсэг» тайлбар; «▶ Зурлага» хөдөлгөөн эхэлнэ',
      vg.colored && vg.n === 14 && vg.s && vg.p && vg.diff && vg.note.join() === 'kj-color-note--mapped' && vg.play && vg.anim !== 'none', JSON.stringify(vg));
    const gk = await ev(`${OPEN('国')}const s=document.querySelector('#lesson-content .kj-origin'),svg=s.querySelector('.kj-origin-track .kj-vg-svg');
      const out={mono:!!svg&&svg.classList.contains('kj-vg--mono'),tones:svg?svg.querySelectorAll('[class*=kj-tone]').length:-1,res:(s.querySelector('.kj-origin-result b')||{}).textContent,
        note:[...s.querySelectorAll('.kj-origin-color-note')].filter(n=>getComputedStyle(n).display!=='none').map(n=>n.className.split(' ').pop()),over:s.scrollWidth-s.clientWidth};${CLOSE}return out;`);
    ok(tag + ': 国 — хэсэг нь хуучин 國-ийнх тул үр дүн 國, ханз нэг өнгөөр (KanjiVG-д 或 алга), «шууд ялгарахгүй» тайлбар, хальдаггүй',
      gk.mono && gk.tones === 0 && gk.res === '國' && gk.note.join() === 'kj-color-note--historical' && gk.over <= 1, JSON.stringify(gk));
  }
  /* Хөдөлгөөнийг хүсэхгүй хэрэглэгч: «▶» дарсан ч хөдөлгөөнгүй (эцсийн төлөв). */
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }); await nav();
  const rm = await ev(`${OPEN('語')}const s=document.querySelector('#lesson-content .kj-origin');s.querySelector('[data-kj-play=strokes]').click();await new Promise(r=>setTimeout(r,80));
    const p=s.querySelector('.kj-origin-track .kj-vg-stroke'),cs=getComputedStyle(p),out={anim:cs.animationName,dur:cs.animationDuration,dash:cs.strokeDashoffset};${CLOSE}return out;`);
  ok('prefers-reduced-motion: «▶» дарсан ч зурлага хөдлөхгүй (эцсийн төлөв харагдана)', (rm.anim === 'none' || /^0s|^1e-/.test(rm.dur)) && !/^1/.test(rm.dash || ''), JSON.stringify(rm));
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });

  console.log('\n[7] «Юуг зурсан бэ?» тоглоом');
  await size(1400, 900, false); await media(false); await nav();
  /* Утгын давхцлыг тестийн өөрийн тодорхойлолтоор (§2.91). */
  const pr = await ev(`const J=window.KOTO.kanji,pool=J.picPool(),bad=[];let n=0;
    const parts=k=>k.mn.split(/[;；,，]/).map(s=>s.trim().toLowerCase()).filter(Boolean),over=(a,b)=>parts(a).some(m=>parts(b).includes(m));
    for(let r=0;r<300;r++){const items=J.picRound();if(items.length!==10||new Set(items.map(i=>i.k.jp)).size!==10)bad.push('round');
      for(const it of items){n++;const o=it.options;if(o.length!==3||new Set(o).size!==3||o.filter(c=>c===it.k.jp).length!==1)bad.push(it.k.jp+' opts');
        for(const c of o){if(c===it.k.jp)continue;const x=pool.find(y=>y.jp===c);if(!x||x.o.g===it.k.o.g||over(x,it.k)||['主火','木来不'].some(g=>g.includes(c)&&g.includes(it.k.jp)))bad.push(it.k.jp+'/'+c);}}}
    return {pool:pool.length,n,bad:[...new Set(bad)].slice(0,6)};`);
  ok('300 тойрог × 10 (' + pr.n + ' асуулт): 52 зурагнаас, тойрогт давхардалгүй, 3 өөр сонголт, зөв нь 1, хуурамч нь ӨӨР ангиллаас (月/夕, 川/水 хамт гарахгүй), утга давхцахгүй, ойролцоо дүрс (主/火, 木/来/不) хамт гарахгүй',
    pr.pool === 52 && pr.n === 3000 && !pr.bad.length, JSON.stringify(pr));
  const gp = await ev(`localStorage.removeItem('koto-games');location.hash='games';await new Promise(r=>setTimeout(r,250));const K=window.KOTO,G=K.games,S=ms=>new Promise(r=>setTimeout(r,ms));
    const btn=document.querySelector('#view-games [data-action=game][data-game=kjpic]'),st0=JSON.stringify(K.state()),out={btn:!!btn,empty:!!document.querySelector('#view-games .empty-state')};
    if(!btn)return out;btn.click();await S(200);const g=G.state(),q=s=>document.querySelector('#game-content '+s);out.open=document.getElementById('game-dialog').open;out.kind=g&&g.kind;
    let it=g.items[0];q('[data-pick="'+it.options.indexOf(it.k.jp)+'"]').click();await S(40);out.s1=[g.score,it.state,!!q('[data-action=kjpic-next]'),!!q('.kj-origin')];
    q('[data-pick="0"]').click();await S(20);out.lock=g.score+'|'+g.total;q('[data-action=kjpic-next]').click();await S(40);
    it=g.items[1];q('[data-pick="'+it.options.findIndex(c=>c!==it.k.jp)+'"]').click();await S(40);out.s2=[g.score,it.state,g.missed.has(it.k.id)];q('[data-action=kjpic-next]').click();await S(40);
    it=g.items[2];q('[data-action=kjpic-skip]').click();await S(40);out.s3=[g.score,it.state];q('[data-action=kjpic-next]').click();await S(40);
    for(let i=3;i<10;i++){it=g.items[i];q('[data-pick="'+it.options.indexOf(it.k.jp)+'"]').click();await S(20);q('[data-action=kjpic-next]').click();await S(30);}
    out.over=g.over;out.score=g.score;out.hits=g.hits+'/'+g.total;out.rec=G.records().kjpic;out.end=(document.getElementById('game-end-title')||{}).textContent;
    out.missed=document.querySelectorAll('#game-content .game-missed li').length;out.same=JSON.stringify(K.state())===st0;
    document.querySelector('#game-content [data-action=game-exit]').click();await S(150);out.card=(document.querySelector('#view-games .game-card--kjpic .game-record')||{}).textContent;return out;`);
  ok('үг цээжлээгүй ч «Юуг зурсан бэ?» нээлттэй; зөв +10 (түгжигдэж, хувьсал гарна), буруу 0 (алдсанд), алгасвал 0; 10-ын дараа дуусч рекорд 80, алдсан 2; ахиц (state) хөндөгдөөгүй',
    gp.btn && gp.empty && gp.open && gp.kind === 'kjpic' && JSON.stringify(gp.s1) === '[10,"ok",true,true]' && gp.lock === '10|1' &&
    JSON.stringify(gp.s2) === '[10,"bad",true]' && JSON.stringify(gp.s3) === '[10,"skip"]' && gp.over && gp.score === 80 && gp.hits === '8/10' &&
    gp.rec === 80 && gp.end === 'Шинэ рекорд!' && gp.missed === 2 && gp.same && /80/.test(gp.card || ''), JSON.stringify(gp));

  for (const [wd, ht, dk] of [[390, 844, true], [320, 640, false]]) {
    await size(wd, ht, true); await media(dk); await nav();
    const lay = await ev(`location.hash='games';await new Promise(r=>setTimeout(r,250));document.querySelector('#view-games [data-action=game][data-game=kjpic]').click();await new Promise(r=>setTimeout(r,250));
      const D=document.getElementById('game-dialog'),m=()=>[D.scrollWidth-D.clientWidth,document.documentElement.scrollWidth];const out={q:m()};
      const g=window.KOTO.games.state(),it=g.items[0];document.querySelector('#game-content [data-pick="'+it.options.findIndex(c=>c!==it.k.jp)+'"]').click();await new Promise(r=>setTimeout(r,500));
      out.a=m();const ops=[...document.querySelectorAll('#game-content .kjpic-opt')].map(b=>b.getBoundingClientRect());out.inside=ops.every(r=>r.left>=0&&r.right<=innerWidth);
      out.keys=document.querySelectorAll('#game-content .kjpic-opt .game-keys').length;out.status=[...document.querySelectorAll('#game-content [role=status]')].map(e=>e.className).join();
      document.querySelector('#game-content [data-action=game-exit]').click();await new Promise(r=>setTimeout(r,150));return out;`);
    ok(wd + (dk ? ' бараан' : '') + ': «Юуг зурсан бэ?» — асуулт ба хариултын дараа хэвтээ гүйлт 0, 3 сонголт дэлгэц дотор; хариулсны дараа «1 2 3» алга, зөвхөн богино мэдэгдлийг зарлана',
      lay.q[0] <= 1 && lay.a[0] <= 1 && lay.q[1] <= wd && lay.a[1] <= wd && lay.inside && lay.keys === 0 && lay.status === 'kjpic-say', JSON.stringify(lay));
  }

  console.log('\n[8] Консол');
  ok('барьсангүй уналт гараагүй', errs.length === 0, errs.slice(0, 3).join(' | '));

  console.log('\n' + '─'.repeat(50));
  console.log('tsever: ' + good + '   unasan: ' + bad + '\nzurag: ' + OUT);
  if (fails.length) { console.log('\nUNASAN:'); fails.forEach(x => console.log('  · ' + x)); }
  try { ws.close(); } catch (e) {}
  chrome.kill();
  process.exit(bad ? 1 : 0);
})().catch(e => { console.log('ALDAA: ' + e.message); process.exit(2); });
