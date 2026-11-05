/* v2 (KOTO) — харагдаж буй БҮХ бичгийн WCAG контрастыг хуудас бүрээр хэмжинэ.
 *
 * ЯАГААД: өнгийг токеноор сольсны дараа (11-05, colorhunt-ын палет) аль нэг
 * хуучин хатуу өнгө шинэ дэвсгэр дээр уншигдахгүй үлдэж болно. Тест нь цөөн
 * сонгосон товчийг шалгадаг; энэ нь DOM-ын бичигтэй элемент бүрийг.
 *
 * Арга: бичигтэй элемент бүрийн `color`-ыг эцгүүдийн дэвсгэрийн ДАВХАРГАТАЙ
 * (alpha-г нийлүүлж) харьцуулна. Шаардлага 4.5, том бичиг (≥ 24px, эсвэл
 * ≥ 18.66px тод) 3. `background-image`-тэй эцэг (градиент, зураг) — тооцох
 * боломжгүй тул тусад нь «img» гэж жагсаана, нүдээр шалгана.
 *
 * Хуудас: Сурах зам, Үгийн сан, Давтлага, Тоглоом, Ханз, Ахиц, хичээлийн
 * эхний карт, хариултын «зөв» ба «буруу» төлөв — гэрэлтэй ба бараан.
 *
 *     python -m http.server 8765 --bind 127.0.0.1     (репогийн үндсээс)
 *     node tools/check_v2_contrast.js                  → 0 бол цэвэр
 */
'use strict';
const { spawn } = require('child_process');
const http = require('http');
const DBG = 9236;
const SITE = process.env.SITE_V2 || 'http://127.0.0.1:8765/v2/';
const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = (path, method) => new Promise((res, rej) => {
  const req = http.request({ host: '127.0.0.1', port: DBG, path, method: method || 'GET' },
    r => { let b = ''; r.on('data', c => b += c); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); });
  req.on('error', rej); req.end();
});

/* Хуудсан дотор ажиллах хэмжигч. `scope` доторх бичигтэй элемент бүр. */
const AUDIT = scope => `
  const rgba=c=>{const n=(c.match(/[0-9.]+/g)||[]).map(Number);if(c.startsWith('color('))return [n[0]*255,n[1]*255,n[2]*255,n.length>3?n[3]:1];return [n[0],n[1],n[2],n.length>3?n[3]:1];};
  const over=(top,bot)=>{const a=top[3];return [top[0]*a+bot[0]*(1-a),top[1]*a+bot[1]*(1-a),top[2]*a+bot[2]*(1-a),1];};
  const L=c=>{const v=c.slice(0,3).map(x=>{x/=255;return x<=0.03928?x/12.92:Math.pow((x+0.055)/1.055,2.4);});return 0.2126*v[0]+0.7152*v[1]+0.0722*v[2];};
  const ratio=(a,b)=>{const x=L(a),y=L(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);};
  function bgOf(el){const layers=[];let img=false;for(let e=el;e;e=e.parentElement){const s=getComputedStyle(e);if(s.backgroundImage&&s.backgroundImage!=='none')img=true;const c=rgba(s.backgroundColor);if(c[3]>0){layers.push(c);if(c[3]>=1)break;}}
    let acc=[255,255,255,1];for(let i=layers.length-1;i>=0;i--)acc=over(layers[i],acc);return {bg:acc,img};}
  const out=[];const seen=new Set();
  for(const el of document.querySelectorAll(${JSON.stringify(scope)})){
    if(![...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))continue;
    const r=el.getBoundingClientRect();if(r.width<1||r.height<1)continue;
    const s=getComputedStyle(el);if(s.visibility==='hidden'||+s.opacity===0)continue;
    let hid=false;for(let e=el;e;e=e.parentElement){if(e.hidden||getComputedStyle(e).display==='none'||+getComputedStyle(e).opacity===0){hid=true;break;}}if(hid)continue;
    const {bg,img}=bgOf(el);const fg=over(rgba(s.color),bg);const k=ratio(fg,bg);
    const px=parseFloat(s.fontSize),big=px>=24||(px>=18.66&&+s.fontWeight>=700);/* <progress>/<meter> доторх бичиг хөтөчид харагддаггүй (нөөц) — харагдах нь зурвас: график 3:1. */const graphic=el.tagName==='PROGRESS'||el.tagName==='METER';const need=big||graphic?3:4.5;
    const cls=(el.className&&el.className.baseVal!==undefined?el.className.baseVal:el.className)||'';
    const key=el.tagName+'.'+cls+'|'+s.color+'|'+bg.map(Math.round).join(',');
    if(seen.has(key))continue;seen.add(key);
    if(img)out.push({kind:'img',el:(el.tagName+'.'+cls).slice(0,50),text:el.textContent.trim().slice(0,24),k:Math.round(k*100)/100});
    else if(k<need)out.push({kind:'fail',el:(el.tagName+'.'+cls).slice(0,50),text:el.textContent.trim().slice(0,24),k:Math.round(k*100)/100,need,fg:s.color,bg:'rgb('+bg.slice(0,3).map(Math.round).join(',')+')'});
  }
  return out;`;

(async () => {
  const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + DBG, '--no-first-run', '--disable-gpu',
    '--mute-audio', '--window-size=1400,900', '--user-data-dir=' + require('os').tmpdir() + '\\kotocon-' + Date.now(), 'about:blank'], { stdio: 'ignore' });
  let tab = null;
  for (let i = 0; i < 60 && !tab; i++) { try { tab = await getJSON('/json/new?' + encodeURIComponent(SITE), 'PUT'); } catch (e) { await sleep(250); } }
  if (!tab) { console.log('Chrome нээгдсэнгүй'); chrome.kill(); process.exit(2); }
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const w = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && w.has(m.id)) { const x = w.get(m.id); w.delete(m.id); m.error ? x.rej(new Error(JSON.stringify(m.error))) : x.res(m.result); } };
  const send = (method, params) => new Promise((res, rej) => { const i = ++id; w.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  await send('Runtime.enable'); await send('Page.enable');
  const ev = async expr => {
    const r = await send('Runtime.evaluate', { expression: '(async()=>{' + expr + '})()', awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300));
    return r.result.value;
  };
  const nav = async () => { await send('Page.navigate', { url: SITE }); for (let i = 0; i < 40; i++) { await sleep(150); try { if (await ev('return !!window.KOTO')) break; } catch (e) {} } await sleep(400); };
  /* Ахиц ба ханзын түүхтэй төлөв: график, ахицын зурвас, давтлагын тоо ХООСОН биш харагдана. */
  const SEED = `const d=n=>{const t=new Date();t.setDate(t.getDate()+n);return t.toISOString().slice(0,10);};const ws=window.KOTO.words();const words={},days={},xpd={};
    for(let n=-40;n<=0;n++){if(n%3){days[d(n)]=[ws[-n].id];xpd[d(n)]={a1:[60,180,320,540][(-n)%4]};}}
    ws.slice(0,60).forEach((w,i)=>{words[w.id]={passes:i%4,weak:i%7===0,due:d(i%3-1),last:d(-1),attempts:3,misses:i%7===0?1:0};});
    localStorage.setItem('koto-irodori-v1',JSON.stringify({version:1,xp:2400,completed:['A1-01-0','A1-01-1','A1-01-2'],words,kana:{},days,xpd,selectedTopic:0}));return true;`;

  let fails = 0, imgs = 0;
  const report = (where, list) => {
    for (const x of list) {
      if (x.kind === 'fail') { fails++; console.log(`  FAIL ${where}  ${x.k} < ${x.need}  ${x.el}  «${x.text}»  ${x.fg} / ${x.bg}`); }
      else { imgs++; if (process.env.SHOW_IMG) console.log(`  img  ${where}  ${x.k}  ${x.el}  «${x.text}»`); }
    }
  };
  for (const dark of [false, true]) {
    const theme = dark ? 'бараан' : 'гэрэлтэй';
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }] });
    await nav(); await ev(SEED); await nav();
    for (const v of ['learn', 'words', 'review', 'games', 'kanji', 'profile']) {
      await ev(`location.hash='${v}';return true;`); await sleep(450);
      report(theme + ' ' + v, await ev(AUDIT(`#view-${v} *, .sidebar *, .topbar *, .page-footer *, .skip`)));
    }
    /* Хэл сонгогч (11-05f): нээлттэй жагсаалт. */
    await ev(`location.hash='learn';document.getElementById('language-trigger').click();await new Promise(r=>setTimeout(r,200));return true;`);
    report(theme + ' хэл сонгогч', await ev(AUDIT('#language-popover *, #language-trigger *')));
    await ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));return true;`);
    /* Хичээл: эхний карт, дараа нь асуулт бүрд санамсаргүй хариулт — «зөв», «буруу» хоёуланг үзтэл. */
    await ev(`location.hash='learn';return true;`); await sleep(300);
    await ev(`document.querySelector('.node-button:not(:disabled)').click();return true;`); await sleep(500);
    report(theme + ' хичээл', await ev(AUDIT('#lesson-dialog *')));
    const seen = { ok: false, bad: false };
    for (let step = 0; step < 40 && !(seen.ok && seen.bad); step++) {
      const st = await ev(`const c=[...document.querySelectorAll('#lesson-dialog .choice')];const fb=document.querySelector('#lesson-dialog .feedback');
        if(fb)return fb.classList.contains('incorrect')?'bad':'ok';
        if(c.length){c[Math.floor(Math.random()*c.length)].click();await new Promise(r=>setTimeout(r,120));}
        const b=document.querySelector('#lesson-dialog .lesson-bottom .primary-btn');if(b&&!b.disabled)b.click();await new Promise(r=>setTimeout(r,250));
        const f2=document.querySelector('#lesson-dialog .feedback');return f2?(f2.classList.contains('incorrect')?'bad':'ok'):'';`);
      if (st && !seen[st]) { seen[st] = true; report(theme + ' хариулт-' + (st === 'ok' ? 'зөв' : 'буруу'), await ev(AUDIT('#lesson-dialog *'))); }
      if (st) await ev(`const b=document.querySelector('#lesson-dialog .lesson-bottom .primary-btn');if(b)b.click();await new Promise(r=>setTimeout(r,250));return true;`);
    }
    if (!seen.ok || !seen.bad) console.log(`  анхаар: ${theme} — хариултын төлөв бүрэн үзэгдсэнгүй (${JSON.stringify(seen)})`);
    await ev(`const d=document.getElementById('lesson-dialog');if(d.open)d.close();return true;`);
  }
  console.log(`\nконтраст: унасан ${fails} · градиент/зурагтай дэвсгэр ${imgs} (SHOW_IMG=1 — жагсаана, нүдээр)`);
  try { ws.close(); } catch (e) {}
  chrome.kill();
  process.exit(fails ? 1 : 0);
})();
