/* v2 (KOTO) — ТОГЛООМЫН тест: буудах, хослуулах, хурдан зөв/буруу.
 *
 * Дүрэм (эзний хүсэлт 2026-11-02): үгс зөвхөн цээжилсэн үгсээс, нэг
 * тоглолтод андуурагдах үг (ижил бичлэг, ижил утга, に «хоёр» ба に
 * дагавар) хамт орохгүй, `state`-д юу ч бичихгүй (XP, streak, давтлага),
 * рекорд `koto-games`-д. Цаг нь тоглоомын алхмаар тул `advance(ms)`-ээр
 * урагшлуулна — бодит хүлээлтгүй.
 *
 * Ажиллуулах:
 *     python -m http.server 8765 --bind 127.0.0.1     (репогийн үндсээс)
 *     node tools/test_v2_games.js
 */
'use strict';
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const DBG = 9241;
const SITE = process.env.SITE_V2 || 'http://127.0.0.1:8765/v2/';
const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT = path.join(require('os').tmpdir(), 'koto-game-shots') + path.sep;
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });

let bad = 0, good = 0;
const fails = [];
function ok(name, pass, extra) {
  if (pass) { good++; console.log('  ok   ' + name); }
  else { bad++; fails.push(name + (extra ? ' — ' + extra : '')); console.log('  FAIL ' + name + (extra ? '  ' + String(extra).slice(0, 400) : '')); }
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
    '--user-data-dir=' + require('os').tmpdir() + '\\kotogames-' + Date.now(), 'about:blank'], { stdio: 'ignore' });
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
  const nav = async () => { await send('Page.navigate', { url: SITE }); for (let i = 0; i < 40; i++) { await sleep(150); try { if (await ev('return !!window.KOTO')) break; } catch (e) {} } await sleep(300); };
  const media = (dark, still) => send('Emulation.setEmulatedMedia', { features: [
    { name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }, { name: 'prefers-reduced-motion', value: still ? 'reduce' : 'no-preference' }] });
  const size = (wd, ht, mobile) => send('Emulation.setDeviceMetricsOverride', { width: wd, height: ht, deviceScaleFactor: 1, mobile: !!mobile });
  const key = async (k, code, vk) => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk, text: k.length === 1 ? k : undefined });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk });
    await sleep(60);
  };
  /* n үгийг цээжилсэн болгоно; ижил канатай үгсийг (に г.м.) заавал оруулна — андуурлын шалгалт. */
  const seed = n => ev(`const ws=window.KOTO.words(),by={};for(const w of ws)(by[w.jp]=by[w.jp]||[]).push(w);
    const dup=Object.values(by).filter(g=>g.length>1).flat(),pick=[...new Set([...dup,...ws].map(w=>w.id))].slice(0,${n});
    const words={};for(const id of pick)words[id]={passes:1,weak:false,due:'2099-01-01',last:'2026-11-01',attempts:1,misses:0};
    localStorage.setItem('koto-irodori-v1',JSON.stringify({version:1,xp:777,completed:['0-0'],words,days:{'2026-11-01':[pick[0]]},kana:{},xpd:{'2026-11-01':{a1:77}},selectedTopic:0}));
    localStorage.removeItem('koto-games');return pick.length;`);
  const G = 'const K=window.KOTO.games,g=K.state();';

  await size(1400, 900, false); await media(false, false); await nav();

  console.log('\n[1] Тоглоомын хуудас');
  await seed(0); await nav();
  const hub0 = await ev(`location.hash='games';await new Promise(r=>setTimeout(r,200));const v=document.getElementById('view-games');
    window.KOTO.games.start('shoot');
    return {nav:document.querySelectorAll('.nav-item').length,navGames:!!document.querySelector('.nav-item[data-view=games][aria-current=page]'),shown:!v.hidden,
      page:document.getElementById('page-name').textContent,cards:v.querySelectorAll('.game-card').length,empty:(v.querySelector('.empty-state h2')||{}).textContent,
      start:!!v.querySelector('.empty-state [data-action=start]'),dialog:document.getElementById('game-dialog').open};`);
  ok('6 цэс (11-04-нөөс «Ханз»), «Тоглоом» идэвхтэй; 0 үгтэй — «Дахиад 6 үг», хичээлийн товч, үгийн тоглоом нээгдэхгүй (зөвхөн «Юуг зурсан бэ?» — 11-04)',
    hub0.nav === 6 && hub0.navGames && hub0.shown && hub0.page === 'Тоглоом' && hub0.cards === 1 && /Дахиад 6 үг/.test(hub0.empty) && hub0.start && !hub0.dialog, JSON.stringify(hub0));
  await seed(4); await nav();
  const hub4 = await ev(`location.hash='games';await new Promise(r=>setTimeout(r,200));const v=document.getElementById('view-games');return {cards:v.querySelectorAll('.game-card').length,empty:(v.querySelector('.empty-state h2')||{}).textContent};`);
  ok('4 үгтэй — «Дахиад 2 үг», үгийн тоглоомын карт алга (зургийнх л)', hub4.cards === 1 && /Дахиад 2 үг/.test(hub4.empty), JSON.stringify(hub4));
  const nSeed = await seed(60); await nav();
  const hub = await ev(`location.hash='games';await new Promise(r=>setTimeout(r,200));const v=document.getElementById('view-games');
    return {cards:[...v.querySelectorAll('.game-card [data-action=game]')].map(b=>b.dataset.game),rec:[...v.querySelectorAll('.game-record')].map(x=>x.textContent.trim()),sub:v.querySelector('.page-subtitle').textContent};`);
  ok('60 үгтэй — 4 тоглоом (буудах, хослуулах, зөв/буруу, юуг зурсан бэ), рекорд алга, «60 үгээсээ»',
    nSeed === 60 && hub.cards.join() === 'shoot,match,tf,kjpic' && hub.rec.every(t => t === 'Рекорд алга') && /60 үгээсээ/.test(hub.sub), JSON.stringify(hub));
  await shot('hub-1400');
  const before = await ev(`return localStorage.getItem('koto-irodori-v1');`);

  console.log('\n[2] Үг сонголт — зөвхөн цээжилсэн, андуурагдахгүй');
  /* Андуурлыг аппын `clash`-аар БИШ, тестийн өөрийн тодорхойлолтоор шалгана — эс бөгөөс эвдэрсэн clash өөрийгөө батална. */
  const sel = await ev(`const K=window.KOTO.games,st=window.KOTO.state(),studied=new Set(Object.keys(st.words)),bad=[];
    const S=K.short,means={};for(const x of window.KOTO.words())(means[x.jp]=means[x.jp]||new Set()).add(S(x));
    const conf=(a,b)=>a.jp===b.jp||S(a)===S(b)||means[a.jp].has(S(b))||means[b.jp].has(S(a));
    const ok3=(list,tag)=>{for(const w of list)if(!studied.has(w.id))bad.push(tag+':unstudied '+w.jp);for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++)if(conf(list[i],list[j]))bad.push(tag+':clash '+list[i].jp+'|'+list[j].jp);};
    const ws=window.KOTO.words(),by={};for(const w of ws)(by[w.jp]=by[w.jp]||[]).push(w);const homo=Object.values(by).filter(g=>g.length>1&&g.every(w=>studied.has(w.id)));
    const homoClash=homo.every(g=>K.clash(g[0],g[1]));
    K.start('shoot');const seen=[],pool=K.state().pool.length;
    for(let i=0;i<300;i++){const g=K.state(),wv=g.wave;ok3(wv.words,'shoot');if(wv.words.filter(x=>x.id===wv.target.id).length!==1)bad.push('target');seen.push(wv.target.id);
      document.querySelector('#game-content [data-lane="'+wv.words.indexOf(wv.target)+'"]').click();K.advance(400);}
    const firstRound=new Set(seen.slice(0,pool)).size;
    K.close();
    let tiles=0;for(let i=0;i<40;i++){K.start('match');const g=K.state();tiles+=g.tiles.length;ok3([...new Map(g.tiles.map(t=>[t.w.id,t.w])).values()],'match');K.close();}
    let tf={t:0,f:0};K.start('tf');K.state().left=1e12;for(let i=0;i<400;i++){const c=K.state().card;if(c.truth){tf.t++;if(c.shown!==c.w)bad.push('tf-true');}else{tf.f++;if(!studied.has(c.shown.id))bad.push('tf-unstudied');if(conf(c.w,c.shown))bad.push('tf-clash '+c.w.jp+'='+K.short(c.shown));}
      document.querySelector('#game-content [data-answer="'+(c.truth?1:0)+'"]').click();K.advance(200);}
    K.close();
    return {bad:bad.slice(0,8),nbad:bad.length,homo:homo.length,homoClash,firstRound,pool,tiles,tf,short:[K.short({mn:'ярианы сэдвийг заана; は-г «wa» гэж'}),K.short({mn:'…-маар байна (үйл үгийн үндсэнд)'}),K.short({mn:'ус'})]};`);
  ok('буудах 300 давалгаа / хослуулах 40 / зөв-буруу 400: бүгд цээжилсэн үг, нэг давалгаанд андуурагдах үг 0, зөв бай яг 1',
    sel.nbad === 0 && sel.tiles === 40 * 12, JSON.stringify(sel));
  ok('ижил канатай үгс (' + sel.homo + ' бүлэг) андуурагдах гэж тооцогдоно; багц нь бүх үгийг давталгүй эргэлдэнэ (' + sel.firstRound + '/' + sel.pool + ')',
    sel.homo >= 1 && sel.homoClash && sel.firstRound === sel.pool, JSON.stringify({ homo: sel.homo, homoClash: sel.homoClash, firstRound: sel.firstRound, pool: sel.pool }));
  ok('зөв-буруу: таарсан ба таараагүй хос хоёулаа гарна (' + sel.tf.t + '/' + sel.tf.f + ')', sel.tf.t > 100 && sel.tf.f > 100, JSON.stringify(sel.tf));
  ok('товч утга: «;»-ээс өмнөх, хаалтгүй', sel.short.join('|') === 'ярианы сэдвийг заана|…-маар байна|ус', JSON.stringify(sel.short));
  /* 11-02: ～ひき «…» болж хоосордог, ～まい/～ほん/～さつ бүгд «… ширхэг», ～ごろ «(цаг: しちじごろ)» хариултыг задалдаг,
     ～にん-ий хаалт доторх «;»-ээр тасарч «… хүн (тоолох нөхцөл» болдог байв. */
  const sm = await ev(`const K=window.KOTO.games,ws=window.KOTO.words(),S=K.short,by={},bad=[];
    for(const w of ws){const s=S(w);if(/[\\u3040-\\u30ff\\u3400-\\u9fff～]/.test(s))bad.push('ja '+w.jp+'→'+s);if(!/[\\p{L}\\p{N}]/u.test(s))bad.push('empty '+w.jp+'→'+s);
      if((s.match(/\\(/g)||[]).length!==(s.match(/\\)/g)||[]).length)bad.push('paren '+w.jp+'→'+s);(by[s]=by[s]||new Set()).add(w.jp);}
    /* 2026-11-05: 3 номын ~3000 үгэнд ижил утгатай өөр үг (すみません/もうしわけありません «уучлаарай») гарцаагүй —
       тэднийг нэг тоглолтод оруулахгүй байх нь gameClash-ийн ажил. Давхцал бүр clash-тай байх ёстой. */
    const groups=Object.entries(by).filter(([m,s])=>s.size>1);
    const dup=groups.filter(([m,s])=>{const g=ws.filter(w=>S(w)===m);return g.some(a=>g.some(b=>a!==b&&a.jp!==b.jp&&!K.clash(a,b)));}).map(([m,s])=>m+'→'+[...s].join('/'));
    const f=jp=>S(ws.find(w=>w.jp===jp));const ichi=ws.find(w=>w.jp==='いちばん'&&S(w)==='хамгийн');
    return {n:ws.length,bad,dup,groups:groups.length,hiki:f('～ひき／びき／ぴき'),goro:f('～ごろ'),nin:f('～にん'),mai:f('～まい'),satsu:f('～さつ'),
      homoUnit:!!ichi&&K.clash(ichi,{jp:'ZZZ',mn:'нэгдүгээр'})&&!K.clash(ichi,{jp:'ZZZ',mn:'ус'})};`);
  ok('товч утга (' + sm.n + ' үг): япон тэмдэгтгүй, үсэгтэй, хаалт тэнцүү; ижил утгатай ' + sm.groups + ' бүлэг бүгд андуурлын хамгаалалттай',
    sm.n === 2994 && !sm.bad.length && !sm.dup.length, JSON.stringify({ bad: sm.bad.slice(0, 6), dup: sm.dup.slice(0, 6) }));
  ok('～ひき «… (жижиг амьтан…)», ～ごろ хариултгүй, ～にん «… хүн», ～まい ≠ ～さつ',
    /жижиг амьтан/.test(sm.hiki) && sm.goro === '… орчим (цаг)' && sm.nin === '… хүн' && sm.mai !== sm.satsu && /ширхэг/.test(sm.mai), JSON.stringify(sm));
  ok('андуурал: いちばん «хамгийн» ба өөр бичлэгтэй «нэгдүгээр» андуурагдана (いちばん-ий 2 дахь утга), «ус» андуурагдахгүй', sm.homoUnit, JSON.stringify(sm.homoUnit));

  console.log('\n[3] Буудах');
  const sh = await ev(`${G}const S=ms=>new Promise(r=>setTimeout(r,ms));K.start('shoot');await S(100);const out={};let s=K.state();
    const lane=()=>K.state().wave.words.indexOf(K.state().wave.target),btn=i=>document.querySelector('#game-content [data-lane="'+i+'"]');
    out.open=document.getElementById('game-dialog').open;out.targets=document.querySelectorAll('.shoot-target').length;
    out.prompt=document.querySelector('.shoot-prompt strong').textContent===K.short(s.wave.target);out.hearts=document.querySelectorAll('.game-heart.is-on').length;
    btn(lane()).click();s=K.state();out.hit={score:s.score,combo:s.combo,cls:btn(s.wave.words.indexOf(s.wave.target)).classList.contains('is-hit'),dur:s.dur};
    K.advance(400);btn(lane()).click();K.advance(400);btn(lane()).click();out.combo3=K.state().score;K.advance(400);
    const wl=[0,1,2].find(i=>i!==lane());btn(wl).click();s=K.state();out.wrong={hearts:s.hearts,combo:s.combo,dis:btn(wl).disabled,cls:btn(wl).classList.contains('is-wrong'),missed:s.missed.has(s.wave.target.id),hud:document.querySelectorAll('.game-heart.is-on').length};
    btn(wl).click();out.wrongTwice=K.state().hearts;
    K.advance(K.state().wave.dur);s=K.state();out.miss={hearts:s.hearts,reveal:!!document.querySelector('.shoot-target.is-reveal'),done:s.wave.done};
    const t0=s.wave.target.id;K.advance(1000);out.next=K.state().wave.target.id!==t0||true;out.waveNew=!K.state().wave.done;
    K.advance(K.state().wave.dur);K.advance(1000);
    out.end={title:(document.getElementById('game-end-title')||{}).textContent,stats:[...document.querySelectorAll('.game-end .result-stat strong')].map(x=>x.textContent),
      missed:document.querySelectorAll('.game-missed li').length,rec:JSON.parse(localStorage.getItem('koto-games')||'{}').shoot,focus:document.activeElement&&document.activeElement.id};
    return out;`);
  ok('эхлэл: цонх нээгдэнэ, 3 бай, утга = зөв байны товч утга, 3 амь', sh.open && sh.targets === 3 && sh.prompt && sh.hearts === 3, JSON.stringify(sh));
  ok('онох: +10, combo 1, бай «is-hit», хурд 8000 → 7520 мс', sh.hit.score === 10 && sh.hit.combo === 1 && sh.hit.cls && sh.hit.dur === 7520, JSON.stringify(sh.hit));
  ok('дараалсан 3 дахь онолт ×2: 10+10+20 = 40', sh.combo3 === 40, String(sh.combo3));
  ok('буруу бай: амь −1, combo 0, бай идэвхгүй, алдсан үгэнд зөв үг; дахин дарахад амь хасагдахгүй',
    sh.wrong.hearts === 2 && sh.wrong.combo === 0 && sh.wrong.dis && sh.wrong.cls && sh.wrong.missed && sh.wrong.hud === 2 && sh.wrongTwice === 2, JSON.stringify(sh.wrong));
  ok('зөв үг газарт хүрвэл амь −1, зөв нь тодорно; 1 сек дараа шинэ давалгаа', sh.miss.hearts === 1 && sh.miss.reveal && sh.miss.done && sh.waveNew, JSON.stringify(sh.miss));
  ok('амь дуусахад дүн: «Шинэ рекорд!» 40 оноо, 3 онолт, рекорд хадгалагдав, алдсан үгс, фокус гарчиг дээр',
    sh.end.title === 'Шинэ рекорд!' && sh.end.stats.join() === '40,3,40' && sh.end.rec === 40 && sh.end.missed >= 1 && sh.end.focus === 'game-end-title', JSON.stringify(sh.end));
  await shot('shoot-end-1400');
  const sh2 = await ev(`${G}document.querySelector('[data-action=game-again]').click();const K2=window.KOTO.games;for(let i=0;i<3;i++){K2.advance(K2.state().wave.dur);K2.advance(1000);}
    return {title:document.getElementById('game-end-title').textContent,rec:JSON.parse(localStorage.getItem('koto-games')).shoot,best:document.querySelectorAll('.game-end .result-stat strong')[2].textContent};`);
  ok('«Дахин тоглох» → 0 оноо: рекорд 40 хэвээр, «Шинэ рекорд» биш', sh2.rec === 40 && sh2.title !== 'Шинэ рекорд!' && sh2.best === '40', JSON.stringify(sh2));
  /* Гарын товч: зөв замын дугаар. */
  await ev(`window.KOTO.games.start('shoot');`); await sleep(100);
  const ln = await ev(`${G}return g.wave.words.indexOf(g.wave.target)+1;`);
  await key(String(ln), 'Digit' + ln, 48 + ln);
  const kb = await ev(`${G}return {score:g.score,hits:g.hits};`);
  ok('гараас ' + ln + ' товч → тэр замыг буудна', kb.score === 10 && kb.hits === 1, JSON.stringify(kb));
  await key('Escape', 'Escape', 27);
  const esc = await ev(`return {open:document.getElementById('game-dialog').open,game:window.KOTO.games.state(),hash:location.hash};`);
  ok('Esc → цонх хаагдана, тоглоом зогсоно, тоглоомын хуудас руу', !esc.open && esc.game === null && esc.hash === '#games', JSON.stringify(esc));
  const rec1 = await ev(`return document.querySelector('.game-card--shoot .game-record').textContent.trim();`);
  ok('хуудсан дээр рекорд: «Рекорд 40 оноо»', rec1 === 'Рекорд 40 оноо', rec1);

  console.log('\n[4] Хослуулах');
  const mt = await ev(`${G}K.start('match');const s=K.state(),t=s.tiles,tile=i=>document.querySelector('#game-content [data-tile="'+i+'"]');const out={};
    out.tiles=t.length;out.sides=t.filter(x=>x.side==='jp').length;out.time=document.getElementById('match-time').textContent;out.started=s.started;
    const a=t.findIndex(x=>x.side==='jp'),b=t.findIndex(x=>x.side==='mn'&&x.w.id!==t[a].w.id),c=t.findIndex((x,i)=>x.side==='jp'&&i!==a);
    tile(a).click();tile(c).click();out.swap={sel:K.state().sel===c,pressed:tile(c).getAttribute('aria-pressed'),other:tile(a).getAttribute('aria-pressed')};
    tile(c).click();out.unsel=K.state().sel;
    tile(a).click();tile(b).click();const s2=K.state();out.wrong={mistakes:s2.mistakes,penalty:s2.penalty,cls:document.querySelectorAll('.match-tile.is-wrong').length,missed:s2.missed.size,started:s2.started};
    tile(a).click();out.locked=K.state().sel;K.advance(500);out.cleared=document.querySelectorAll('.match-tile.is-wrong').length;
    const ids=[...new Set(t.map(x=>x.w.id))];
    for(const id of ids){const j=t.findIndex(x=>x.w.id===id&&x.side==='jp'),m=t.findIndex(x=>x.w.id===id&&x.side==='mn');tile(j).click();tile(m).click();if(id===ids[0])out.pair={done:tile(j).disabled&&tile(m).disabled,hud:document.querySelector('.game-pairs').textContent};}
    const s3=K.state();out.fin={finished:s3.finished,t:s3.t};K.advance(1000);const s4=K.state();out.fin.t2=s4.t;
    out.end={title:(document.getElementById('game-end-title')||{}).textContent,value:s4.result&&s4.result.value,rec:JSON.parse(localStorage.getItem('koto-games')).match,stats:[...document.querySelectorAll('.game-end .result-stat strong')].map(x=>x.textContent)};
    return out;`);
  ok('эхлэл: 12 хавтан (6 япон + 6 монгол), цаг 0.0, дарахаас өмнө цаг явахгүй', mt.tiles === 12 && mt.sides === 6 && mt.time === '0.0' && !mt.started, JSON.stringify(mt));
  ok('ижил талын хоёр дахь хавтан сонголтыг шилжүүлнэ; дахин дарахад цуцлагдана', mt.swap.sel && mt.swap.pressed === 'true' && mt.swap.other === 'false' && mt.unsel === null, JSON.stringify(mt.swap));
  ok('буруу хос: алдаа 1, +1000 мс, хоёр хавтан «is-wrong», 2 алдсан үг; 450 мс хаалттай, дараа нь арилна',
    mt.wrong.mistakes === 1 && mt.wrong.penalty === 1000 && mt.wrong.cls === 2 && mt.wrong.missed === 2 && mt.locked === null && mt.cleared === 0, JSON.stringify(mt));
  ok('зөв хос идэвхгүй болж «1 / 6 хос»', mt.pair.done && mt.pair.hud === '1 / 6 хос', JSON.stringify(mt.pair));
  ok('6 хос дуусахад цаг зогсоно; дүн = цаг + торгууль, рекорд хадгалагдав',
    mt.fin.finished && mt.fin.t2 === mt.fin.t && mt.end.title === 'Шинэ рекорд!' && mt.end.value === Math.round(mt.fin.t + 1000) && mt.end.rec === mt.end.value && mt.end.stats[1] === '1', JSON.stringify(mt.fin) + JSON.stringify(mt.end));
  const mt2 = await ev(`${G}K.start('match');const t=K.state().tiles,tile=i=>document.querySelector('#game-content [data-tile="'+i+'"]');K.state().started=true;K.advance(100);K.advance(100);
    const ids=[...new Set(t.map(x=>x.w.id))];K.state().penalty=99000;for(const id of ids){tile(t.findIndex(x=>x.w.id===id&&x.side==='jp')).click();tile(t.findIndex(x=>x.w.id===id&&x.side==='mn')).click();}K.advance(400);
    return {rec:JSON.parse(localStorage.getItem('koto-games')).match,title:document.getElementById('game-end-title').textContent};`);
  ok('удаан тоглолт рекордыг дарахгүй (бага хугацаа сайн)', mt2.rec === mt.end.rec && mt2.title !== 'Шинэ рекорд!', JSON.stringify(mt2));
  await ev(`window.KOTO.games.close();`);

  console.log('\n[5] Хурдан зөв/буруу');
  const tf = await ev(`${G}K.start('tf');const ans=v=>document.querySelector('#game-content [data-answer="'+(v?1:0)+'"]').click();const out={};let c=K.state().card;
    out.start={left:document.getElementById('tf-left').textContent,jp:!!document.querySelector('.tf-jp'),mn:document.querySelector('.tf-mn').textContent===K.short(c.shown)};
    ans(c.truth);let s=K.state();out.ok={score:s.score,hits:s.hits,total:s.total,cls:!!document.querySelector('.tf-card.is-ok')};ans(!c.truth);out.lockOk=K.state().total;
    K.advance(200);c=K.state().card;out.next=!c.state;
    ans(!c.truth);s=K.state();out.bad={combo:s.combo,cls:!!document.querySelector('.tf-card.is-bad'),reveal:(document.querySelector('.tf-reveal')||{}).textContent,missed:s.missed.has(c.w.id),aria:document.querySelector('[data-answer="1"]').getAttribute('aria-disabled')};
    ans(c.truth);out.lockBad=K.state().total;K.advance(1200);out.after=!K.state().card.state;
    for(let i=0;i<5;i++){const cc=K.state().card;ans(cc.truth);K.advance(200);}out.mult=K.state().score;
    out.left=K.state().left;return out;`);
  ok('эхлэл: 60 сек, япон үг ба (товч) утга', tf.start.left === '60' && tf.start.jp && tf.start.mn, JSON.stringify(tf.start));
  ok('зөв хариулт +10, ногоон; хариулсны дараа давхар дарах тоологдохгүй', tf.ok.score === 10 && tf.ok.hits === 1 && tf.ok.total === 1 && tf.ok.cls && tf.lockOk === 1 && tf.next, JSON.stringify(tf));
  ok('буруу хариулт: combo 0, улаан, зөв утгыг харуулна, алдсан үгэнд; товч aria-disabled, дарах тоологдохгүй',
    tf.bad.combo === 0 && tf.bad.cls && /Зөв утга:|зөв байсан/.test(tf.bad.reveal) && tf.bad.missed && tf.bad.aria === 'true' && tf.lockBad === 2 && tf.after, JSON.stringify(tf.bad));
  ok('5 дараалсан зөв: 10×4 + 20 = 60 → нийт 70', tf.mult === 70, String(tf.mult));
  const ln2 = await ev(`${G}return g.card.truth;`);
  await key(ln2 ? 'ArrowRight' : 'ArrowLeft', ln2 ? 'ArrowRight' : 'ArrowLeft', ln2 ? 39 : 37);
  const tk = await ev(`${G}return {hits:g.hits,state:g.card.state};`);
  ok('гараас ←/→ хариулна', tk.hits === 7 && tk.state === 'ok', JSON.stringify(tk));
  const cap = await ev(`${G}K.stop();K.advance(300);const l0=K.state().left;K.tick(1000);K.tick(61000);const l1=K.state().left;return {l0,l1,d:l0-l1};`);
  ok('rAF-ийн нэг алхам 100 мс-ээр таслагдана (таб нуугдаад буцахад цаг үсрэхгүй)', cap.d === 100, JSON.stringify(cap));
  const tfe = await ev(`${G}K.advance(60000);return {title:(document.getElementById('game-end-title')||{}).textContent,rec:JSON.parse(localStorage.getItem('koto-games')).tf,stats:[...document.querySelectorAll('.game-end .result-stat strong')].map(x=>x.textContent)};`);
  ok('60 сек дуусахад дүн, рекорд хадгалагдав', tfe.title === 'Шинэ рекорд!' && tfe.rec === 90 && tfe.stats[0] === '90' && tfe.stats[1] === '7/8', JSON.stringify(tfe));
  await ev(`window.KOTO.games.close();`);
  /* Дээрх нь advance()-аар; энд БОДИТ rAF цаг явж, бай хөдөлж байгааг. */
  const rt = await ev(`const K=window.KOTO.games,S=ms=>new Promise(r=>setTimeout(r,ms));K.start('shoot');await S(100);const y0=document.querySelector('.shoot-target').style.transform,t0=K.state().wave.t;
    await S(1000);const y1=document.querySelector('.shoot-target').style.transform,d=Math.round(K.state().wave.t-t0);K.close();return {d,moved:y0!==y1};`);
  ok('бодит цаг: 1 сек-д тоглоомын цаг 0.8–1.2 сек урагшилж, бай доош хөдөлнө', rt.d >= 800 && rt.d <= 1200 && rt.moved, JSON.stringify(rt));

  console.log('\n[6] Сурах ахицад нөлөөлөхгүй');
  const after = await ev(`return localStorage.getItem('koto-irodori-v1');`);
  const st = await ev(`const s=window.KOTO.state();return {xp:s.xp,top:document.getElementById('xp').textContent};`);
  ok('бүх тоглолтын дараа ахиц (XP, үг, өдөр, график) БАЙТ БҮРЭЭРЭЭ өөрчлөгдөөгүй', before === after && st.xp === 777 && st.top === '777', JSON.stringify(st));

  console.log('\n[7] Хөдөлгөөнгүй горим');
  await media(false, true); await nav();
  const rm = await ev(`location.hash='games';await new Promise(r=>setTimeout(r,150));${G}K.start('shoot');K.stop();await new Promise(r=>setTimeout(r,50));
    const tr=()=>[...document.querySelectorAll('.shoot-target')].map(e=>e.style.transform).join();const a=tr();K.advance(2000);const b=tr(),f=document.getElementById('shoot-fuse').style.transform;K.close();return {a,b,f};`);
  ok('prefers-reduced-motion: бай хөдлөхгүй, хугацааны зурвас багасна', rm.a === rm.b && rm.a.length > 0 && rm.f === 'scaleX(0.75)', JSON.stringify(rm));
  await media(false, false);

  console.log('\n[8] Зохиомж — 1400 / 390 / 390 бараан / 320');
  const TAP = `const bad=[];for(const b of document.querySelectorAll(SEL)){const r=b.getBoundingClientRect();if(!r.width&&!r.height)continue;if(r.width<44||r.height<44)bad.push((b.className||b.dataset.action||'').toString().slice(0,30)+' '+Math.round(r.width)+'x'+Math.round(r.height));}`;
  for (const [wd, ht, dk] of [[1400, 900, false], [390, 844, false], [390, 844, true], [320, 640, false]]) {
    const tag = wd + (dk ? ' бараан' : '');
    await size(wd, ht, wd < 700); await media(dk, false); await nav();
    const hb = await ev(`location.hash='games';await new Promise(r=>setTimeout(r,250));const SEL='#view-games button, .nav-item';${TAP}
      const clip=[...document.querySelectorAll('.nav-item')].filter(n=>n.offsetParent).flatMap(n=>[...n.querySelectorAll('span:not([data-icon]):not(.nav-count):not(.notification-dot)')].filter(s=>{const r=s.getBoundingClientRect(),b=n.getBoundingClientRect();return r.width&&(r.left<b.left-1||r.right>b.right+1);}).map(s=>s.textContent));
      return {page:document.documentElement.scrollWidth,bad,clip,cards:document.querySelectorAll('.game-card').length};`);
    ok(tag + ': тоглоомын хуудас — хэвтээ гүйлт 0, товч 44px+, цэсний нэр тасрахгүй', hb.page <= wd && !hb.bad.length && !hb.clip.length && hb.cards === 4, JSON.stringify(hb));
    await shot('hub-' + wd + (dk ? '-dark' : ''));
    for (const kind of ['shoot', 'match', 'tf']) {
      const gd = await ev(`window.KOTO.games.start('${kind}');window.KOTO.games.stop();await new Promise(r=>setTimeout(r,120));
        ${kind === 'shoot' ? "window.KOTO.games.advance(2600);" : ''}const SEL='#game-dialog button';${TAP}
        const d=document.getElementById('game-dialog'),ar=document.getElementById('shoot-arena');const out={dw:d.scrollWidth,bad};
        if(ar){const r=ar.getBoundingClientRect();out.arenaBottom=Math.round(r.bottom);out.vh=innerHeight;out.tw=[...document.querySelectorAll('.shoot-target')].map(e=>e.scrollWidth<=e.clientWidth+1);}
        const tl=document.querySelectorAll('.match-tile');if(tl.length){out.over=[...tl].filter(e=>e.scrollHeight>e.clientHeight+2||e.scrollWidth>e.clientWidth+1).length;}
        return out;`);
      ok(tag + ' ' + kind + ': хэвтээ гүйлт 0, товч 44px+' + (kind === 'shoot' ? ', талбар дэлгэцэд бүтэн' : kind === 'match' ? ', хавтангаас бичиг хальгүй' : ''),
        gd.dw <= wd && !gd.bad.length && (kind !== 'shoot' || (gd.arenaBottom <= gd.vh && gd.tw.every(Boolean))) && (kind !== 'match' || gd.over === 0), JSON.stringify(gd));
      await shot(kind + '-' + wd + (dk ? '-dark' : ''));
      await ev(`window.KOTO.games.close();`);
    }
    /* 11-02: дуудлагын товч бичгийн доор урсаж, «Дахин тоглох»-ын margin хөрш товчийг сунгадаг байв. */
    const en = await ev(`const K=window.KOTO.games;K.start('shoot');K.stop();for(let i=0;i<3;i++){K.advance(K.state().wave.dur);K.advance(1000);}await new Promise(r=>setTimeout(r,80));
      const SEL='#game-dialog button';${TAP}const li=document.querySelector('.game-missed li'),sb=li&&li.querySelector('.speak-button');
      const lr=li&&li.getBoundingClientRect(),br=sb&&sb.getBoundingClientRect(),acts=[...document.querySelectorAll('.game-actions > button')].map(b=>Math.round(b.getBoundingClientRect().height));
      return {dw:document.getElementById('game-dialog').scrollWidth,bad,acts,sbIn:!!(lr&&br&&br.right<=lr.right&&br.left>lr.left+lr.width/2&&br.top>=lr.top&&br.bottom<=lr.bottom)};`);
    /* primary 4px / secondary 3px доод хүрээтэй (аппын товчны систем) — 1px зөрүү зөв. */
    ok(tag + ' дүн: хэвтээ гүйлт 0, товч 44px+, дуудлагын товч мөрийн баруун талд, хоёр товч ижил өндөр (±2px)',
      en.dw <= wd && !en.bad.length && en.sbIn && en.acts.length === 2 && Math.abs(en.acts[0] - en.acts[1]) <= 2, JSON.stringify(en));
    await shot('end-' + wd + (dk ? '-dark' : ''));
    await ev(`window.KOTO.games.close();`);
  }

  console.log('\n[9] Консол');
  ok('барьсангүй уналт гараагүй', errs.length === 0, errs.slice(0, 3).join(' | '));

  console.log('\n' + '─'.repeat(50));
  console.log('tsever: ' + good + '   unasan: ' + bad + '\nzurag: ' + OUT);
  if (fails.length) { console.log('\nUNASAN:'); fails.forEach(x => console.log('  · ' + x)); }
  try { ws.close(); } catch (e) {}
  chrome.kill();
  process.exit(bad ? 1 : 0);
})().catch(e => { console.log('ALDAA: ' + e.message); process.exit(2); });
