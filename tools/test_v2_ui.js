/* v2 (KOTO) — ШИНЭ UI-ийн тест: дуудлагын товч, Google-ийн нэвтрэлтийн
 * төлөвүүд, бараан сэдэв, 44px дарах талбай, утасны өргөн, өнгөний сэдэв ба горим ([T]).
 *
 * `test_v2.js`-ээс ТУСДАА: тэр нь синкийн уусгалт ба хадгалалтыг шалгана,
 * энэ нь Astra (gpt-6-astra)-ийн гаргасан UI-г Claude хянах дүрмийн
 * (CLAUDE.md) биелэлт — нэг удаагийн хяналт биш, регрессийн тест.
 *
 * ЯАГААД screenshot авдаг: тоо «44px байна» гэж хэлнэ, «гоё байна» гэж
 * хэлэхгүй. Зургууд нь %TEMP%\koto-ui-shots\ дотор үлдэнэ — нүдээр хар.
 *
 * УРХИ: headless Chrome нь Windows-ийн системийн сэдвийг ӨВЛӨНӨ. Систем
 * бараан бол «гэрэлтэй» гэж бодсон зураг бүр бараан гарна (STATE.md §2.85).
 * Тиймээс сэдвийг `Emulation.setEmulatedMedia`-аар ҮРГЭЛЖ тодорхой заана.
 *
 * Google-ээр нэвтэрсэн төлөвийг ХУУРАМЧ сешнээр (localStorage `koto-auth`,
 * `expires_at` хол ирээдүйд) шалгана — refresh явахгүй тул сервер хэрэггүй.
 *
 * Ажиллуулах:
 *     python -m http.server 8765 --bind 127.0.0.1     (репогийн үндсээс)
 *     node tools/test_v2_ui.js
 */
'use strict';
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const DBG = 9234;
const SITE = process.env.SITE_V2 || 'http://127.0.0.1:8765/v2/';
const CHROME = process.env.CHROME
  || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT = require('os').tmpdir() + '\\koto-ui-shots\\';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let bad = 0, good = 0;
function ok(name, pass, extra) {
  if (pass) { good++; console.log('  ok   ' + name + (extra ? '  (' + extra + ')' : '')); }
  else { bad++; console.log('  FAIL ' + name + (extra ? '  ' + extra : '')); }
}
function getJSON(path, method) {
  return new Promise((res, rej) => {
    const req = http.request({ host: '127.0.0.1', port: DBG, path, method: method || 'GET' },
      r => { let b = ''; r.on('data', c => b += c); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); });
    req.on('error', rej); req.end();
  });
}
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + DBG,
    '--no-first-run', '--disable-gpu', '--mute-audio', '--window-size=1400,900',
    '--autoplay-policy=no-user-gesture-required',
    '--user-data-dir=' + require('os').tmpdir() + '\\kotorev-' + Date.now(), 'about:blank'], { stdio: 'ignore' });
  let tab = null;
  for (let i = 0; i < 60 && !tab; i++) { try { tab = await getJSON('/json/new?' + encodeURIComponent(SITE), 'PUT'); } catch (e) { await sleep(250); } }
  if (!tab) { console.log('Chrome neegdsengui'); chrome.kill(); process.exit(2); }
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const w = new Map(); const errs = []; const reqs = [];
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && w.has(m.id)) { const x = w.get(m.id); w.delete(m.id); m.error ? x.rej(new Error(JSON.stringify(m.error))) : x.res(m.result); }
    if (m.method === 'Runtime.exceptionThrown') { const d = m.params.exceptionDetails; errs.push(String((d.exception || {}).description || d.text).slice(0, 200)); }
    if (m.method === 'Network.requestWillBeSent') reqs.push(m.params.request.url);
  };
  const send = (method, params) => new Promise((res, rej) => { const i = ++id; w.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  await send('Runtime.enable'); await send('Network.enable'); await send('Page.enable');
  const ev = async expr => {
    const r = await send('Runtime.evaluate', { expression: '(async()=>{' + expr + '})()', awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300));
    return r.result.value;
  };
  const shot = async name => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(OUT + name + '.png', Buffer.from(r.data, 'base64')); };
  const nav = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 40; i++) { await sleep(150); try { if (await ev('return !!window.KOTO')) break; } catch (e) {} } await sleep(400); };
  const dark = on => send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: on ? 'dark' : 'light' }] });
  const size = (wd, ht, mobile) => send('Emulation.setDeviceMetricsOverride', { width: wd, height: ht, deviceScaleFactor: 1, mobile: !!mobile });
  /* 11-01-ээс avatar нь ахицын хуудас нээнэ; 11-05-аас бүртгэл (нэвтрэх/гарах) тэр хуудасны картад. */
  const openAccount = async () => {
    await ev("document.getElementById('open-sync-top').click();"); await sleep(250);
    await ev("const c=document.querySelector('#view-profile .p-account');if(c)c.scrollIntoView({block:'center'});"); await sleep(150);
  };
  /* Товчны бичиг ба (тунгалаг бол эцгийн) дэвсгэрийн WCAG контраст. */
  const CONTRAST = sel => `const b=document.querySelector(${JSON.stringify(sel)});if(!b)return 0;
    const rgb=c=>{const n=(c.match(/[0-9.]+/g)||[]).map(Number);return c.startsWith('color(')?n.slice(0,3).map(x=>x*255):n.slice(0,3);};
    const alpha=c=>{const n=(c.match(/[0-9.]+/g)||[]).map(Number);return c.startsWith('rgba')?n[3]:c.startsWith('color(')&&n.length>3?n[3]:1;};
    let e=b,bg=getComputedStyle(e).backgroundColor;while(e&&alpha(bg)===0){e=e.parentElement;bg=e?getComputedStyle(e).backgroundColor:'rgb(255,255,255)';}
    const L=c=>{const v=rgb(c).map(x=>{x/=255;return x<=0.03928?x/12.92:Math.pow((x+0.055)/1.055,2.4);});return 0.2126*v[0]+0.7152*v[1]+0.0722*v[2];};
    const a=L(getComputedStyle(b).color),d=L(bg);return Math.round(100*(Math.max(a,d)+0.05)/(Math.min(a,d)+0.05))/100;`;
  const TAP = `const bad=[];for(const b of document.querySelectorAll('button')){const r=b.getBoundingClientRect();if(!r.width&&!r.height)continue;if(r.width<44||r.height<44)bad.push((b.className||b.id||b.tagName).toString().slice(0,40)+' '+Math.round(r.width)+'x'+Math.round(r.height));}return bad;`;

  await dark(false);   // OS-ийн сэдвийг ӨВЛӨХГҮЙ (§2.85)
  await nav(SITE);
  console.log('\n[A] Ачаалалт, гадаад хүсэлт');
  ok('KOTO ачаалагдав', await ev('return !!window.KOTO'));
  const ext = reqs.filter(u => !u.startsWith('http://127.0.0.1') && !u.startsWith('data:'));
  ok('гадаад хүсэлт ЗӨВХӨН Supabase (фонт татахгүй)', ext.every(u => u.includes('supabase.co')), ext.filter(u => !u.includes('supabase.co')).join(' '));
  ok('толгойн avatar товч = わ, зураггүй', await ev("const b=document.getElementById('open-sync-top');return b&&b.tagName==='BUTTON'&&b.textContent.trim()==='わ'&&!b.querySelector('img')"));
  await shot('home-light-1400');

  console.log('\n[B] Үгийн сан — дуудлагын товч');
  await ev("location.hash='words';"); await sleep(300);
  const nCard = await ev("return document.querySelectorAll('.word-card').length");
  const nAu = await ev("return document.querySelectorAll('.word-card [data-au-for]').length");
  const nAll = await ev("return window.KOTO.words().length");
  ok('карт бүрд товч (' + nCard + '/' + nAu + ' / ' + nAll + ')', nCard === nAll && nAu === nAll);
  ok('товч бүр 44px+', (await ev(TAP)).length === 0, JSON.stringify(await ev(TAP)).slice(0, 300));
  await shot('words-light-1400');
  const firstId = await ev("return document.querySelector('.word-card [data-au-for]').dataset.auFor");
  await ev("document.querySelector('.word-card [data-au-for]').click();"); await sleep(120);
  const playing = await ev("return window.KOTO.playing()");
  const cls = await ev("return document.querySelector('.word-card [data-au-for]').classList.contains('playing')");
  ok('дарахад .playing + KOTO.playing()=id', playing === firstId && cls, playing + ' ' + cls);
  await shot('words-playing-1400');
  await sleep(2500);
  ok('бичлэг дуусахад .playing арилна', await ev("return window.KOTO.playing()===null&&!document.querySelector('.playing')"), await ev("return String(window.KOTO.playing())"));
  ok('тоглуулсан файл = audio/<au>.mp3', reqs.some(u => /\/audio\/[A-Za-z0-9-]+\.mp3$/.test(u)), reqs.filter(u => u.includes('/audio/')).slice(-1)[0]);
  /* Карт бүхэлдээ дарагдана (эзний хүсэлт 11-01). Дээрх товчны шалгуур нь
     давхар тоглохгүйг ч барина: товч ба карт хоёулаа ажиллавал toggle-оор
     шууд зогсож, playing=null болно. */
  const cardTap = await ev(`const c=document.querySelectorAll('.word-card')[1];c.querySelector('.word-meaning').click();await new Promise(r=>setTimeout(r,120));
    return {want:c.dataset.auFor,got:window.KOTO.playing(),say:c.classList.contains('say-card'),cardPlaying:c.classList.contains('playing')}`);
  ok('үгийн карт: утга дээр дарахад тухайн үг тоглоно, карт .playing', cardTap.say && !!cardTap.want && cardTap.got === cardTap.want && cardTap.cardPlaying, JSON.stringify(cardTap));
  const stopped = await ev(`document.querySelectorAll('.word-card')[1].querySelector('.word-topic').click();return window.KOTO.playing()`);
  ok('үгийн карт: дахин дарахад зогсоно', stopped === null, String(stopped));

  console.log('\n[C] Хичээл — сурах карт ба асуулт');
  await ev("location.hash='learn';"); await sleep(300);
  await ev("document.querySelector('[data-action=start]').click();"); await sleep(400);
  const lc = await ev(`const c=document.querySelector('.learn-card'),b=c.querySelector(':scope > .card-audio[data-action=say]');
    const cr=c.getBoundingClientRect(),br=b?b.getBoundingClientRect():null;
    return {wide:!!c.querySelector('.audio-button-wide'),corner:!!b,say:c.classList.contains('say-card'),dx:br?Math.round(cr.right-br.right):null,dy:br?Math.round(br.top-cr.top):null,cursor:getComputedStyle(c).cursor}`);
  ok('сурах карт: «Сонсох» өргөн товчгүй, дүрс картын эхэнд, карт .say-card', !lc.wide && lc.corner && lc.say, JSON.stringify(lc));
  ok('сурах карт: дүрс ДЭЭД БАРУУН буланд', lc.dx >= 0 && lc.dx <= 32 && lc.dy >= 0 && lc.dy <= 32, JSON.stringify(lc));
  ok('say-card: cursor:pointer (iOS Safari үүнгүй бол click өгөхгүй)', lc.cursor === 'pointer', lc.cursor);
  const lt = await ev(`const c=document.querySelector('.learn-card');c.querySelector('.learn-kana').click();await new Promise(r=>setTimeout(r,400));
    return {want:c.dataset.auFor,got:window.KOTO.playing(),btnBg:getComputedStyle(c.querySelector('.card-audio')).backgroundColor,card:c.classList.contains('playing')}`);
  ok('сурах карт: кана дээр дарахад тоглоно', !!lt.want && lt.got === lt.want, JSON.stringify(lt));
  /* `.learn-card .speak-button.audio-button` (0,3,0) нь `.audio-button.playing`
     (0,2,0)-ийн лайм дэвсгэрийг дардаг байв — Astra олов. */
  ok('сурах карт: тоглож байхад дүрс ЛАЙМ (--lime, 11-05h анхны ногоон), карт .playing', lt.btnBg === 'rgb(184, 239, 88)' && lt.card, JSON.stringify(lt));
  await ev("if(window.KOTO.playing())document.querySelector('.learn-card').click();");
  ok('хичээл доторх товч бүр 44px+', (await ev(TAP)).length === 0, JSON.stringify(await ev(TAP)).slice(0, 300));
  await shot('lesson-learn-1400');
  // 5 сурах карт → эхний асуулт
  for (let i = 0; i < 5; i++) { await ev("document.querySelector('[data-action=next]').click();"); await sleep(150); }
  const isFwd = await ev("return !!document.querySelector('.quiz-prompt-card [lang=ja]')");
  const hasBtn = await ev("return !!document.querySelector('.quiz-prompt-card [data-au-for]')");
  ok('асуулт: япон→монгол бол товчтой, монгол→япон бол ШАЛГАХААС ӨМНӨ товчгүй', isFwd === hasBtn, 'forward=' + isFwd + ' btn=' + hasBtn);
  await ev("document.querySelector('.choice').click();"); await sleep(100);
  await ev("document.querySelector('[data-action=check]').click();"); await sleep(250);
  ok('шалгасны дараа товч ҮРГЭЛЖ бий', await ev("return !!document.querySelector('.quiz-prompt-card [data-au-for]')"));
  const qt = await ev(`const c=document.querySelector('.quiz-prompt-card');c.querySelector('.exercise-prompt').click();await new Promise(r=>setTimeout(r,120));const r={want:c.dataset.auFor,got:window.KOTO.playing()};if(r.got)c.click();return r;`);
  ok('асуултын карт: шалгасны дараа картыг дарахад тоглоно', !!qt.want && qt.got === qt.want, JSON.stringify(qt));
  await shot('lesson-quiz-checked-1400');
  /* Монгол→япон асуултыг шалгахаас өмнө олж, картыг дарна — дуудлага нь
     хариулт тул тоглох ЁСГҮЙ. */
  const mnq = await ev(`const S=ms=>new Promise(r=>setTimeout(r,ms));
    for(let i=0;i<40;i++){
      const q=document.querySelector('.quiz-prompt-card');
      if(q&&q.querySelector('.mn-prompt')&&!document.querySelector('.lesson-bottom.is-correct,.lesson-bottom.is-incorrect')){
        const s=window.KOTO.numTest.session(),id=s.queue[s.pos].word.id;
        q.querySelector('.exercise-prompt').click();q.click();await S(100);
        return {found:true,say:q.classList.contains('say-card'),au:q.hasAttribute('data-au-for'),playing:window.KOTO.playing(),id};}
      const nx=document.querySelector('[data-action=next]');if(nx&&!nx.disabled){nx.click();await S(80);continue;}
      const ch=document.querySelector('.choice:not([disabled])');if(ch){ch.click();document.querySelector('[data-action=check]').click();await S(80);continue;}
      const tk=[...document.querySelectorAll('.token-bank .token:not(.used):not([disabled])')];if(tk.length){tk.forEach(t=>t.click());const c=document.querySelector('[data-action=check]');if(c)c.click();await S(80);continue;}
      break;}
    return {found:false};`);
  ok('монгол→япон асуулт: шалгахаас өмнө карт дарахад ТОГЛОХГҮЙ', mnq.found && !mnq.say && !mnq.au && mnq.playing !== mnq.id, JSON.stringify(mnq));
  await ev("document.querySelector('[data-action=exit]').click();"); await sleep(150);
  await ev("document.querySelector('[data-action=discard]').click();"); await sleep(200);

  console.log('\n[D] Бүртгэлийн карт — нэвтрээгүй (11-05: зөвхөн Google, нууц кодгүй)');
  await openAccount();
  ok('ахицын хуудсанд «Ахицын хадгалалт» карт, «Нэвтрэх» товч идэвхтэй', await ev("const c=document.querySelector('#view-profile .p-account');const b=c&&c.querySelector('[data-action=google-in]');return !!b&&!b.disabled&&b.textContent.trim()==='Нэвтрэх'&&/Ахицын хадгалалт/.test(c.textContent)"));
  ok('нууц кодын талбар, синкийн цонх, «Нэвтрэлт ба синк» АЛГА', await ev("return !document.querySelector('#sync-code,.sync-code-section,#sync-dialog,[data-action=sync-open]')&&!/синк/i.test(document.getElementById('view-profile').textContent)"));
  ok('хажуугийн цэс: «Нэвтрэх · Google бүртгэлээр» → google-in', await ev("const b=document.getElementById('open-sync');return b.dataset.action==='google-in'&&!b.dataset.view&&!b.disabled&&/Нэвтрэх/.test(b.textContent)&&/Google бүртгэлээр/.test(b.textContent)"));
  const cIn = await ev(CONTRAST('#view-profile .p-account [data-action=google-in]'));
  ok('гэрэлтэй: «Нэвтрэх» контраст ≥ 4.5', cIn >= 4.5, String(cIn));
  ok('ахицын хуудасны товч бүр 44px+', (await ev(TAP)).length === 0, JSON.stringify(await ev(TAP)).slice(0, 300));
  await shot('account-anon-1400');

  console.log('\n[E] Бүртгэлийн карт — Google-ээр нэвтэрсэн (хуурамч сешн, expires хол)');
  const fake = JSON.stringify({ access_token: 'x.y.z', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 86400, user: { email: 'bat@example.com', name: 'Бат Болд', avatar: null } });
  await ev("localStorage.setItem('koto-auth'," + JSON.stringify(fake) + ");");
  await nav(SITE);
  ok('mode=user', await ev("return window.KOTO.mode()==='user'"), await ev("return window.KOTO.mode()"));
  ok('толгойн avatar = нэрийн эхний үсэг «Б»', await ev("return document.getElementById('open-sync-top').textContent.trim()==='Б'"), await ev("return document.getElementById('open-sync-top').textContent.trim()"));
  ok('хажуугийн цэс: «Миний бүртгэл · Нэвтэрсэн» → ахицын хуудас', await ev("const b=document.getElementById('open-sync');return b.dataset.view==='profile'&&!b.dataset.action&&/Миний бүртгэл/.test(b.textContent)&&/Нэвтэрсэн/.test(b.textContent)"));
  await openAccount();
  ok('бүртгэлийн карт: «Миний бүртгэл», нэр, имэйл, үсэг «Б»', await ev("const c=document.querySelector('#view-profile .p-account');return !!c&&/Миний бүртгэл/.test(c.textContent)&&/Бат Болд/.test(c.textContent)&&/bat@example.com/.test(c.textContent)&&c.querySelector('.avatar-fallback').textContent.trim()==='Б'"));
  ok('avatar-ын дугуй картын дэвсгэрээс ялгарна (ижил `--soft` байсан — Claude-ийн хяналт)', await ev("const c=document.querySelector('#view-profile .p-account'),a=c.querySelector('.account-avatar');return getComputedStyle(a).backgroundColor!==getComputedStyle(c).backgroundColor"));
  ok('«Нэвтрэх» товч АЛГА (хуудас ба цэсэнд)', await ev("return !document.querySelector('[data-action=google-in]')"));
  ok('«Гарах» товч бий, 44px+', await ev("const b=document.querySelector('.p-account [data-action=sign-out]');const r=b&&b.getBoundingClientRect();return !!b&&r.width>=44&&r.height>=44"));
  await shot('account-user-1400');
  // Зурагтай хувилбар
  await ev("const a=JSON.parse(localStorage.getItem('koto-auth'));a.user.avatar='https://127.0.0.1:1/x.png';localStorage.setItem('koto-auth',JSON.stringify(a));");
  await nav(SITE);
  ok('зурагтай бол толгойд <img>, ард нь үсэг', await ev("const b=document.getElementById('open-sync-top');return !!b.querySelector('img')&&b.textContent.trim()==='Б'"));
  await openAccount();
  ok('зурагтай бол картад ч <img>', await ev("return !!document.querySelector('.p-account .account-avatar img')"));
  ok('http:// зураг НЯЦААГДАНА (зөвхөн https)', await ev("const a=JSON.parse(localStorage.getItem('koto-auth'));a.user.avatar='http://evil/x.png';localStorage.setItem('koto-auth',JSON.stringify(a));return true;") && (await nav(SITE), await ev("return !document.getElementById('open-sync-top').querySelector('img')")));
  await openAccount();
  ok('http:// — картад ч <img> алга', await ev("return !document.querySelector('.p-account .account-avatar img')"));
  await ev("document.querySelector('.p-account [data-action=sign-out]').click();"); await sleep(1200);
  ok('Гарах → картад «Нэвтрэх» буцаж ирнэ, толгой わ, цэс «Нэвтрэх»', await ev("return !!document.querySelector('.p-account [data-action=google-in]')&&document.getElementById('open-sync-top').textContent.trim()==='わ'&&window.KOTO.mode()!=='user'&&document.getElementById('open-sync').dataset.action==='google-in'"));
  ok('Гарсны дараа фокус шинэ «Нэвтрэх» дээр (body руу унахгүй — Astra-гийн хяналт)', await ev("return document.activeElement===document.querySelector('#view-profile .p-account [data-action=google-in]')"), await ev("const a=document.activeElement;return a?(a.tagName+' '+(a.dataset.action||a.id||'')):'null'"));

  console.log('\n[F] Бараан сэдэв');
  await dark(true); await nav(SITE); await sleep(300);
  const bg = await ev("return getComputedStyle(document.body).backgroundColor");
  ok('body дэвсгэр бараан (#18221d, ногоон)', bg === 'rgb(24, 34, 29)', bg);
  ok('карт бараан, бичиг цайвар', await ev("const c=document.querySelector('.unit-card');const s=getComputedStyle(c);return s.backgroundColor==='rgb(33, 47, 39)'&&getComputedStyle(document.body).color==='rgb(237, 243, 233)'"), await ev("return getComputedStyle(document.querySelector('.unit-card')).backgroundColor+' / '+getComputedStyle(document.body).color"));
  ok('mascot-ийн сүүдэр бараан болов', await ev("const e=document.querySelector('.hero-art svg ellipse');return getComputedStyle(e).fill==='rgb(12, 22, 11)'"), await ev("return getComputedStyle(document.querySelector('.hero-art svg ellipse')).fill"));
  await shot('home-dark-1400');
  await ev("location.hash='words';"); await sleep(300); await shot('words-dark-1400');
  await openAccount();
  const cDark = await ev(CONTRAST('#view-profile .p-account [data-action=google-in]'));
  ok('бараан: «Нэвтрэх» контраст ≥ 4.5, карт цагаан биш', cDark >= 4.5 && await ev("return getComputedStyle(document.querySelector('.p-account')).backgroundColor!=='rgb(255, 255, 255)'"), String(cDark));
  await shot('account-dark-1400');
  await ev("location.hash='learn';"); await sleep(200);
  await ev("document.querySelector('[data-action=start]').click();"); await sleep(400); await shot('lesson-dark-1400');
  await ev("document.querySelector('[data-action=exit]').click();"); await sleep(150); await ev("document.querySelector('[data-action=discard]').click();");
  await dark(false);

  console.log('\n[G] Утас 390 ба 320');
  await size(390, 844, true); await nav(SITE); await sleep(300);
  ok('390: хэвтээ гүйлт БАЙХГҮЙ', await ev("return document.documentElement.scrollWidth<=390"), await ev("return document.documentElement.scrollWidth"));
  ok('390: нүүрний товч бүр 44px+', (await ev(TAP)).length === 0, JSON.stringify(await ev(TAP)).slice(0, 400));
  await shot('home-390');
  await ev("location.hash='words';"); await sleep(300);
  ok('390: үгийн сангийн товч бүр 44px+', (await ev(TAP)).length === 0, JSON.stringify(await ev(TAP)).slice(0, 400));
  await shot('words-390');
  await openAccount(); await shot('account-390');
  ok('390: ахицын хуудасны товч бүр 44px+, «Нэвтрэх» бүтэн өргөн', (await ev(TAP)).length === 0 && await ev("const b=document.querySelector('.p-account [data-action=google-in]'),c=b.parentElement;return b.getBoundingClientRect().width>=c.clientWidth-60"), JSON.stringify(await ev(TAP)).slice(0, 400));
  ok('390: хэвтээ гүйлт БАЙХГҮЙ (ахицын хуудас)', await ev("return document.documentElement.scrollWidth<=390"), await ev("return document.documentElement.scrollWidth"));
  await ev("location.hash='learn';"); await sleep(200);
  await ev("document.querySelector('[data-action=start]').click();"); await sleep(400); await shot('lesson-390');
  ok('390: хичээл дотор хэвтээ гүйлт байхгүй', await ev("const d=document.getElementById('lesson-dialog');return d.scrollWidth<=390"), await ev("return document.getElementById('lesson-dialog').scrollWidth"));
  await ev("document.querySelector('[data-action=exit]').click();"); await sleep(150); await ev("document.querySelector('[data-action=discard]').click();");
  await size(320, 700, true); await nav(SITE); await sleep(300);
  ok('320: хэвтээ гүйлт байхгүй', await ev("return document.documentElement.scrollWidth<=320"), await ev("return document.documentElement.scrollWidth"));
  await shot('home-320');
  await dark(true); await ev("location.hash='words';"); await sleep(300); await shot('words-dark-320');

  console.log('\n[G2] Хариултын самбар утсан дээр (хурдан засвар)');
  /* Өмнө 390×844-д 4 дэх сонголт sticky самбарын ард дарагддаг, retry-chip-ийн
     дүрс текстийн дээр тусдаа мөрөнд унадаг байв. Самбарын өнгө ::before-ийн
     box-shadow-оор бүтэн өргөнд сунадаг тул border-top нь 820px хэрчим болж
     харагдаж байсан — өнгөт төлөвт хүрээгүй байх ёстой. */
  const TO_QUIZ = `const S=ms=>new Promise(r=>setTimeout(r,ms));
    location.hash='learn';await S(200);document.querySelector('[data-action=start]').click();await S(300);
    for(let i=0;i<10&&!document.querySelector('.choice');i++){document.querySelector('[data-action=next]').click();await S(80);}
    return !!document.querySelector('.choice');`;
  const WRONG = `const S=ms=>new Promise(r=>setTimeout(r,ms));const s=window.KOTO.numTest.session(),q=s.queue[s.pos];
    [...document.querySelectorAll('.choice')].find(b=>b.textContent.trim().indexOf(q.correct)<0).click();await S(30);
    document.querySelector('[data-action=check]').click();await S(250);`;
  const LEAVE = "document.querySelector('[data-action=exit]').click();await new Promise(r=>setTimeout(r,150));document.querySelector('[data-action=discard]').click();";
  await dark(false); await size(390, 844, true); await nav(SITE); await sleep(300);
  ok('390: асуулт хүртэл явав', await ev(TO_QUIZ));
  const FIT = "const c=[...document.querySelectorAll('.choice')];return {n:c.length,last:Math.round(c[c.length-1].getBoundingClientRect().bottom),panel:Math.round(document.querySelector('.lesson-bottom').getBoundingClientRect().top)}";
  const fit = await ev(FIT);
  ok('390: 4 сонголт бүгд доод самбараас ДЭЭР харагдана', fit.n === 4 && fit.last <= fit.panel, JSON.stringify(fit));
  await ev(WRONG);
  const fit2 = await ev(FIT);
  ok('390: шалгасны дараа (самбар томорсон) ч 4 сонголт харагдана', fit2.n === 4 && fit2.last <= fit2.panel, JSON.stringify(fit2));
  const pan = await ev("const b=document.querySelector('.lesson-bottom'),s=getComputedStyle(b),p=getComputedStyle(b,'::before');return {cls:b.className,bt:s.borderTopWidth,bg:s.backgroundColor,shadow:p.boxShadow}");
  ok('390: буруу хариултын самбар — дээд хүрээгүй, дэвсгэр нь бүтэн өргөнд сунана',
    /\bis-incorrect\b/.test(pan.cls) && pan.bt === '0px' && pan.shadow.indexOf(pan.bg) === 0, JSON.stringify(pan));
  const chip = await ev("const e=document.querySelector('.retry-chip');if(!e)return null;const b=e.getBoundingClientRect(),i=e.querySelector('svg').getBoundingClientRect();return {h:Math.round(b.height),inTop:Math.round(i.top-b.top),inBot:Math.round(b.bottom-i.bottom)}");
  ok('390: «+N давтах» нэг мөрөнд, дүрс тэмдэг дотроо', chip && chip.h < 32 && chip.inTop >= 0 && chip.inBot >= 0, JSON.stringify(chip));
  await shot('lesson-incorrect-390');
  await ev(LEAVE);
  await size(320, 640, true); await nav(SITE); await sleep(300);
  const ov = await ev(`const S=ms=>new Promise(r=>setTimeout(r,ms));location.hash='learn';await S(200);document.querySelector('[data-action=start]').click();await S(300);
    const out=[];for(let i=0;i<5;i++){const c=document.querySelector('.learn-card');if(!c)break;const b=c.querySelector('.card-audio').getBoundingClientRect(),k=c.querySelector('.learn-kana');
      const r=document.createRange();r.selectNodeContents(k);for(const t of r.getClientRects())if(t.right>b.left&&t.left<b.right&&t.bottom>b.top&&t.top<b.bottom)out.push(k.textContent);
      document.querySelector('[data-action=next]').click();await S(80);}
    return out;`);
  ok('320: сурах картын кана булангийн дүрстэй ДАВХЦАХГҮЙ (5 үг)', ov.length === 0, JSON.stringify(ov));
  await ev(LEAVE);
  await ev(TO_QUIZ); await ev(WRONG);
  const cont = await ev("const r=document.querySelector('.lesson-bottom .primary-btn').getBoundingClientRect();return {top:Math.round(r.top),bottom:Math.round(r.bottom),vh:innerHeight}");
  ok('320×640: шалгасны дараа «Үргэлжлүүлэх» дэлгэцэнд бүтэн харагдана', cont.bottom <= cont.vh && cont.top >= 0, JSON.stringify(cont));
  await shot('lesson-incorrect-320');
  await ev(LEAVE);

  console.log('\n[I] Ахицын хуудас (Astra-гийн загвар, 11-01)');
  /* Бодит харагдахын тулд 60 хоногийн түүх: өдрийн XP, сүүлийн 9 хоногт
     streak, хуучин XP-гүй идэвхтэй өдөр (legacy), үзсэн үг ба катакана. */
  const SEED = `const t=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ulaanbaatar',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const d=n=>{const x=new Date(t+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10);};
    const days={},xpd={},words={},kana={},ws=window.KOTO.words();
    for(let n=-60;n<=0;n++){if(n>-9||(n*7)%5===0){days[d(n)]=[ws[(-n)%40].id];if(n>-45)xpd[d(n)]={a1:[60,180,320,540,100][(-n)%5]};}}
    ws.slice(0,40).forEach((w,i)=>{words[w.id]={passes:i%4,weak:i%7===0,due:d(i%3),last:d(-1),attempts:3,misses:i%7===0?1:0};});
    window.KOTO.profile.kana().slice(0,12).forEach((k,i)=>{kana[k.id]={passes:i%4,weak:i===3,due:d(1),last:d(-1)};});
    localStorage.setItem('koto-irodori-v1',JSON.stringify({version:1,xp:5230,completed:['0-0','0-1','0-2','1-0'],words,kana,days,xpd,selectedTopic:0}));
    localStorage.removeItem('koto-script');location.hash='profile';`;
  const PCHECK = `const v=document.getElementById('view-profile'),sc=document.getElementById('profile-heat-scroll');
    const cols=[...v.querySelectorAll('.heat-grid .heat-col')],last=cols[cols.length-1];const sr=sc?sc.getBoundingClientRect():null,lr=last?last.getBoundingClientRect():null;
    const bad=[];for(const b of v.querySelectorAll('button')){const r=b.getBoundingClientRect();if(!r.width&&!r.height)continue;if(r.width<44||r.height<44)bad.push((b.className||b.dataset.action||'').toString().slice(0,30)+' '+Math.round(r.width)+'x'+Math.round(r.height));}
    return {shown:!v.hidden,cells:v.querySelectorAll('.heat-grid .heat-cell').length,cols:cols.length,page:document.documentElement.scrollWidth,vw:innerWidth,
      lastVisible:!!(sr&&lr&&lr.right<=sr.right+1&&lr.left>=sr.left-1),scrolled:sc?Math.round(sc.scrollLeft):null,max:sc?sc.scrollWidth-sc.clientWidth:null,small:bad,
      kana:v.querySelectorAll('[data-action=kana-lesson]').length,seg:v.querySelectorAll('[data-action=script]').length,sync:!!v.querySelector('.p-account [data-action=google-in],.p-account [data-action=sign-out]'),
      legacy:v.querySelectorAll('.heat-grid .heat-cell[data-legacy]').length,...HEATX()};
    function HEATX(){const dr=v.querySelector('.heat-days').getBoundingClientRect(),tr=v.querySelector('.heat-timeline').getBoundingClientRect();
      const lb=[...v.querySelectorAll('.heat-month b:not(.is-cut)')].map(b=>({t:b.textContent.trim(),r:b.getBoundingClientRect()}));
      const clash=[];for(let i=1;i<lb.length;i++)if(lb[i].r.left<lb[i-1].r.right+2)clash.push(lb[i-1].t+'|'+lb[i].t);
      const under=lb.filter(x=>x.r.left<dr.right-1).map(x=>x.t),past=lb.filter(x=>x.r.right>tr.right+1).map(x=>x.t);
      const rgb=c=>{const n=(c.match(/[0-9.]+/g)||[]).map(Number);return c.startsWith('color(')?n.slice(0,3).map(x=>x*255):n.slice(0,3);};
      const col=[0,1,2,3,4].map(k=>rgb(getComputedStyle(v.querySelector('.p-heat-scale .heat-cell[data-level="'+k+'"]')).backgroundColor));
      const dist=(x,y)=>Math.round(Math.hypot(x[0]-y[0],x[1]-y[1],x[2]-y[2]));
      const kg=v.querySelector('.p-kana-groups'),kb=[...v.querySelectorAll('.p-kana-group[open] .p-kana-lesson')].map(b=>Math.round(b.getBoundingClientRect().left));
      return {labels:lb.length,clash,under,past,daysIn:dr.left>=sr.left-1&&dr.right<=sr.right,gap0:dist(col[0],col[1]),gapMin:Math.min(...[1,2,3].map(k=>dist(col[k],col[k+1]))),
        kanaH:Math.round(kg.getBoundingClientRect().height),kanaCols:new Set(kb).size};}`;
  const toProfile = async () => { await nav(SITE); await ev("location.hash='profile'"); await sleep(500); };
  await size(1400, 900, false); await dark(false); await nav(SITE); await ev(SEED); await toProfile();
  const p1 = await ev(PCHECK);
  ok('1400: хуудас, 53×7 нүд, 21 катакана хичээл, бичгийн 2 товч, синкийн товч, legacy нүд',
    p1.shown && p1.cells === 371 && p1.cols === 53 && p1.kana === 21 && p1.seg === 2 && p1.sync && p1.legacy > 0, JSON.stringify(p1));
  ok('1400: хэвтээ гүйлт 0, товч бүр 44px+', p1.page <= 1400 && p1.small.length === 0, JSON.stringify({ page: p1.page, small: p1.small }));
  /* 11-01-ний нүдээр хийсэн хяналт: «10-р са11-р сар» давхцал, 1–2-р шат хоосон нүднээс ялгагдахгүй. */
  ok('1400: сарын шошго давхцахгүй, графикаас хальж гарахгүй; хоосон→1-р шат ялгарна (RGB зай ≥65), хөрш шат ≥40',
    p1.labels >= 8 && !p1.clash.length && !p1.under.length && !p1.past.length && p1.gap0 >= 65 && p1.gapMin >= 40, JSON.stringify({ labels: p1.labels, clash: p1.clash, under: p1.under, past: p1.past, gap0: p1.gap0, gapMin: p1.gapMin }));
  await shot('profile-1400');
  for (const [w, h, dk] of [[390, 844, false], [390, 844, true], [320, 640, false]]) {
    await size(w, h, true); await dark(dk); await toProfile();
    const pm = await ev(PCHECK);
    const tag = w + (dk ? ' бараан' : '');
    ok(tag + ': хуудасны хэвтээ гүйлт 0, товч бүр 44px+', pm.page <= w && pm.small.length === 0, JSON.stringify({ page: pm.page, small: pm.small }));
    ok(tag + ': график хамгийн сүүлийн долоо хоног руу гүйлгэгдсэн', pm.lastVisible && pm.max > 0 && Math.abs(pm.scrolled - pm.max) <= 1, JSON.stringify({ lastVisible: pm.lastVisible, scrolled: pm.scrolled, max: pm.max }));
    ok(tag + ': гарагийн багана гүйлгэсэн ч харагдана, сарын шошго давхцахгүй/хагас тасрахгүй, XP-ийн шат ялгарна',
      pm.daysIn && pm.labels >= 2 && !pm.clash.length && !pm.under.length && !pm.past.length && pm.gap0 >= 65 && pm.gapMin >= 40, JSON.stringify({ daysIn: pm.daysIn, labels: pm.labels, clash: pm.clash, under: pm.under, past: pm.past, gap0: pm.gap0, gapMin: pm.gapMin }));
    ok(tag + ': катаканы хичээл 2 баганаар, хэсэг ≤ 900px (өмнө 1742)', pm.kanaCols === 2 && pm.kanaH <= 900, JSON.stringify({ kanaCols: pm.kanaCols, kanaH: pm.kanaH }));
    await shot('profile-' + w + (dk ? '-dark' : ''));
  }
  /* Бичиг солиход: фокус сонгосон товч дээр, графикийн гүйлт хэвээр. */
  await size(390, 844, true); await dark(false); await toProfile();
  const sw = await ev(`const S=ms=>new Promise(r=>setTimeout(r,ms));const sc=document.getElementById('profile-heat-scroll');sc.scrollLeft=120;await S(50);const before=Math.round(sc.scrollLeft);
    const b=document.querySelector('#view-profile [data-action=script][data-script=kanji]');b.focus();b.click();await S(200);
    const sc2=document.getElementById('profile-heat-scroll'),ae=document.activeElement;
    return {before,after:Math.round(sc2.scrollLeft),focus:ae&&ae.dataset?ae.dataset.script:null,pressed:document.querySelector('#view-profile [data-action=script][data-script=kanji]').getAttribute('aria-pressed'),script:window.KOTO.profile.script()};`);
  ok('бичиг солиход: шинэ товч aria-pressed, фокус түүн дээр, графикийн гүйлт хэвээр',
    sw.script === 'kanji' && sw.pressed === 'true' && sw.focus === 'kanji' && sw.before === 120 && sw.after === 120, JSON.stringify(sw));
  /* Sticky гарагийн багана (z-index 1) графикийн дотор талын хүрээг халхалдаг байв → хүрээ гадна талд. */
  const fo = await ev(`const sc=document.getElementById('profile-heat-scroll');sc.focus();const cs=getComputedStyle(sc);
    return {fv:sc.matches(':focus-visible'),style:cs.outlineStyle,offset:parseFloat(cs.outlineOffset)};`);
  ok('графикийн фокус хүрээ sticky гарагийн баганын доор орохгүй (offset ≥ 0)', fo.fv && fo.style === 'solid' && fo.offset >= 0, JSON.stringify(fo));
  /* Ханзын горимд 320-д хичээл: ruby гарна, хэвтээ гүйлт 0. */
  await size(320, 640, true); await nav(SITE); await sleep(300);
  /* Ханзтай үг ихтэй эхний хичээл (2026-11-05-аас нэгж нь өгөгдлөөс; сонголт `koto-v2-unit`-д). */
  await ev(`const V=window.KOTO.vocab,L=V.lessons().find(l=>l.chunk===0&&l.words.filter(w=>w.kj).length>=4);localStorage.setItem('koto-v2-unit',V.units()[L.topic].key);localStorage.setItem('koto-test-kl',L.id);`); await nav(SITE); await sleep(300);
  const kl = await ev(`const S=ms=>new Promise(r=>setTimeout(r,ms));location.hash='learn';await S(200);document.querySelector('[data-action=start][data-lesson="'+localStorage.getItem('koto-test-kl')+'"]').click();await S(400);
    const out=[];for(let i=0;i<5;i++){const c=document.querySelector('.learn-card');if(!c)break;out.push({ruby:!!c.querySelector('ruby.jp-face'),dw:document.getElementById('lesson-dialog').scrollWidth});document.querySelector('[data-action=next]').click();await S(80);}
    return out;`);
  ok('320 ханзын горим: сурах картад ruby, хичээлд хэвтээ гүйлт 0', kl.some(x => x.ruby) && kl.every(x => x.dw <= 320), JSON.stringify(kl));
  await shot('lesson-kanji-320');
  await ev(LEAVE);
  await ev(`localStorage.removeItem('koto-script');`);

  console.log('\n[J] Хэл сонгогч (11-05f: туг → Япон; Хятад/Солонгос/Англи «Тун удахгүй»)');
  const LANG = `const b=document.getElementById('language-trigger'),p=document.getElementById('language-popover');const r=b.getBoundingClientRect();
    const o=[...p.querySelectorAll('.language-option')];const pr=p.hidden?null:p.getBoundingClientRect();const ae=document.activeElement;
    return {exp:b.getAttribute('aria-expanded'),hidden:p.hidden,bw:Math.round(r.width),bh:Math.round(r.height),
      label:getComputedStyle(b.querySelector('.language-trigger-label')).display,n:o.length,
      cur:o.filter(x=>x.getAttribute('aria-current')==='true').map(x=>x.dataset.language).join(),
      soon:o.filter(x=>x.getAttribute('aria-disabled')==='true'&&/Тун удахгүй/.test(x.textContent)).map(x=>x.dataset.language).join(),
      flags:o.filter(x=>{const s=x.querySelector('svg.language-flag');return s&&s.getBoundingClientRect().width>=20;}).length,
      rows:o.map(x=>Math.round(x.getBoundingClientRect().height)),
      box:pr?[Math.round(pr.left),Math.round(pr.top),Math.round(pr.right),Math.round(pr.bottom)]:null,vw:innerWidth,vh:innerHeight,
      page:document.documentElement.scrollWidth,below:pr?pr.top>=r.bottom:null,
      focus:ae===b?'trigger':(ae&&ae.dataset&&ae.dataset.language)||''};`;
  const lclick = sel => ev(`document.querySelector(${JSON.stringify(sel)}).click();await new Promise(r=>setTimeout(r,150));return true;`);
  const lesc = () => ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await new Promise(r=>setTimeout(r,100));return true;`);
  for (const [w, h, dk, tag] of [[1400, 900, false, '1400'], [1400, 900, true, '1400-dark'], [390, 844, false, '390'], [320, 640, false, '320']]) {
    await size(w, h, w < 700); await dark(dk); await nav(SITE); await sleep(200);
    const a = await ev(LANG);
    ok(tag + ': туг товч ≥44px, хаалттай, ' + (w < 700 ? '«Япон хэл» бичиг нуугдсан' : '«Япон хэл» бичигтэй'),
      a.bw >= 44 && a.bh >= 44 && a.exp === 'false' && a.hidden && (w < 700 ? a.label === 'none' : a.label !== 'none'), JSON.stringify(a));
    await lclick('#language-trigger');
    const o = await ev(LANG);
    ok(tag + ': нээгдэнэ — 4 хэл, 4 туг, Япон идэвхтэй ба фокустай, бусад 3 «Тун удахгүй», мөр ≥44px, товчны доор, дэлгэцэнд багтана',
      o.exp === 'true' && !o.hidden && o.n === 4 && o.flags === 4 && o.cur === 'ja' && o.soon === 'zh,ko,en' && o.focus === 'ja'
        && o.rows.every(x => x >= 44) && o.below && o.box[0] >= 0 && o.box[2] <= o.vw && o.box[3] <= o.vh && o.page <= o.vw, JSON.stringify(o));
    const cs = [await ev(CONTRAST('.language-option[data-language="zh"]')), await ev(CONTRAST('.language-soon')), await ev(CONTRAST('.language-option[data-language="ja"]'))];
    ok(tag + ': контраст ≥ 4.5 («Тун удахгүй» мөр, шошго, идэвхтэй мөр)', cs.every(x => x >= 4.5), cs.join(' / '));
    await shot('lang-' + tag);
    if (tag === '1400') {
      await lclick('.language-option[data-language="zh"]');
      const z = await ev(LANG);
      ok('«Тун удахгүй» дарахад юу ч болохгүй (нээлттэй, Япон идэвхтэй хэвээр)', z.exp === 'true' && !z.hidden && z.cur === 'ja', JSON.stringify(z));
      await lesc();
      const e = await ev(LANG);
      ok('Esc → хаагдана, фокус туг товч руу буцна', e.exp === 'false' && e.hidden && e.focus === 'trigger', JSON.stringify(e));
      await lclick('#language-trigger');
      await ev(`document.querySelector('.page-title').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));await new Promise(r=>setTimeout(r,100));return true;`);
      const g = await ev(LANG);
      ok('гадна дарвал хаагдана', g.exp === 'false' && g.hidden, JSON.stringify(g));
      await lclick('#language-trigger');
      await lclick('.language-option[data-language="ja"]');
      const j = await ev(LANG);
      ok('Япон дээр дарвал хаагдана, фокус туг товч руу', j.exp === 'false' && j.hidden && j.focus === 'trigger', JSON.stringify(j));
      await lclick('#language-trigger');
      const ft = await ev(`document.getElementById('language-trigger').focus();await new Promise(r=>setTimeout(r,50));const a=!document.getElementById('language-popover').hidden;
        document.querySelector('.nav-item').focus();await new Promise(r=>setTimeout(r,80));return {openOnTrigger:a,closed:document.getElementById('language-popover').hidden};`);
      ok('фокус товч руу шилжихэд нээлттэй, цэс рүү гарахад хаагдана (Shift+Tab ×2 — Astra-гийн хяналт)', ft.openOnTrigger && ft.closed, JSON.stringify(ft));
      await lclick('#language-trigger'); await lclick('#language-trigger');
      const t = await ev(LANG);
      ok('туг товчийг дахин дарвал хаагдана', t.exp === 'false' && t.hidden, JSON.stringify(t));
    } else {
      await lesc();
    }
  }
  await size(1400, 900, false); await dark(false);

  console.log('\n[K] Үгийн аймгийн товчнууд (11-05, загвар — Astra)');
  await size(1400, 900, false); await dark(false); await nav(SITE);
  await ev(`const W=window.KOTO.words(),d=new Date().toISOString().slice(0,10),words={};
    W.filter(w=>w.p==='verb').slice(0,7).forEach(w=>words[w.id]={passes:1,weak:false,due:d,last:d,attempts:1,misses:0});
    W.filter(w=>w.p==='adj').slice(0,3).forEach(w=>words[w.id]={passes:1,weak:false,due:d,last:d,attempts:1,misses:0});
    localStorage.setItem('koto-irodori-v1',JSON.stringify({version:1,xp:0,completed:[],words,kana:{},days:{},xpd:{},selectedTopic:0}));
    localStorage.removeItem('koto-game-pos');return true;`);
  await nav(SITE);
  const kw = await ev(`location.hash='words';await new Promise(r=>setTimeout(r,300));const v=document.getElementById('view-words');
    const W=window.KOTO_DATA.units.flatMap(u=>u.words),nVerb=W.filter(w=>w.p==='verb').length;
    const chips=[...v.querySelectorAll('[data-action=word-pos]')];const verb=chips.find(b=>b.dataset.pos==='verb');
    const nums=chips.filter(b=>b.dataset.pos!=='all').map(b=>+b.querySelector('.pos-n').textContent);
    verb.click();await new Promise(r=>setTimeout(r,200));const t1=document.getElementById('word-result-count').textContent,cards=v.querySelectorAll('#word-results .word-card').length;
    const pressed=chips.filter(b=>b.getAttribute('aria-pressed')==='true').map(b=>b.dataset.pos).join();
    const chk=chips.filter(b=>getComputedStyle(b.querySelector('.pos-check')).display!=='none').map(b=>b.dataset.pos).join(),lab=verb.getAttribute('aria-label');
    chips[0].click();await new Promise(r=>setTimeout(r,200));const t2=document.getElementById('word-result-count').textContent;
    const small=chips.filter(b=>{const r=b.getBoundingClientRect();return r.height<44;}).length;
    return {n:chips.length,sum:nums.reduce((a,b)=>a+b,0),nVerb,t1,cards,pressed,chk,lab,t2,small};`);
  ok('Үгийн сан: «Бүгд» + 6 ангилал, тоо нийлбэр 2994; «Үйл үг» → зөвхөн үйл үг (тоо өгөгдөлтэй тэнцүү), «Бүгд» → буцна; ≥44px',
    kw.n === 7 && kw.sum === 2994 && kw.t1 === kw.nVerb + ' үг, хэллэг' && kw.cards === kw.nVerb && kw.pressed === 'verb' && kw.t2 === '2994 үг, хэллэг' && kw.small === 0, JSON.stringify(kw));
  ok('Үгийн сан: ✓ зөвхөн сонгосон товчинд; уншигчийн нэр «Үйл үг. Нийт N үг, хэллэг.»',
    kw.chk === 'verb' && kw.lab === 'Үйл үг. Нийт ' + kw.nVerb + ' үг, хэллэг.', JSON.stringify({ chk: kw.chk, lab: kw.lab }));
  await shot('pos-words-1400');
  const kr = await ev(`location.hash='review';await new Promise(r=>setTimeout(r,300));const v=document.getElementById('view-review');
    const b=[...v.querySelectorAll('[data-action=pos-practice]')];const st=k=>{const x=b.find(y=>y.dataset.pos===k);return x?{d:x.disabled,n:x.querySelector('.pos-n').textContent,p:x.hasAttribute('aria-pressed'),go:x.querySelector('.pos-verb').textContent,lab:x.getAttribute('aria-label')}:null;};
    const r={n:b.length,verb:st('verb'),adj:st('adj'),noun:st('noun'),heading:/Ангиллаар давтах/.test(v.textContent)};
    b.find(y=>y.dataset.pos==='adj').click();await new Promise(r=>setTimeout(r,400));
    const s=window.KOTO.numTest.session();r.open=document.getElementById('lesson-dialog').open;r.kinds=[...new Set(s.words.map(w=>w.p))].join();r.n2=s.words.length;
    r.meta=(document.querySelector('#lesson-dialog .lesson-meta')||{}).textContent||'';
    document.getElementById('lesson-dialog').close();return r;`);
  ok('Давтлага: «Ангиллаар давтах» 6 товч (сонголт биш — aria-pressed-гүй), үзсэн тоотой (үйл 7, тэмдэг 3), үзээгүй нь идэвхгүй; «Тэмдэг нэр» → 3 тэмдэг нэрээр дасгал',
    kr.n === 6 && kr.heading && kr.verb.n === '7' && !kr.verb.d && !kr.verb.p && kr.adj.n === '3' && kr.noun.d && kr.open && kr.kinds === 'adj' && kr.n2 === 3 && /Тэмдэг нэр/.test(kr.meta), JSON.stringify(kr));
  ok('Давтлага: хавтан бүр «Давтах», үзээгүй нь «Үзээгүй»; уншигчийн нэр «Үйл үг. Үзсэн 7 үг, хэллэг. Давтах. 5 үгтэй…»',
    kr.verb.go === 'Давтах' && kr.noun.go === 'Үзээгүй' && kr.verb.lab === 'Үйл үг. Үзсэн 7 үг, хэллэг. Давтах. 5 үгтэй давтлага эхлүүлэх.' && /Үзээгүй\.$/.test(kr.noun.lab),
    JSON.stringify({ verb: kr.verb, noun: kr.noun }));
  await nav(SITE);
  const kg = await ev(`location.hash='games';await new Promise(r=>setTimeout(r,300));const v=()=>document.getElementById('view-games');
    const pick=async k=>{v().querySelector('[data-action=game-pos][data-pos="'+k+'"]').click();await new Promise(r=>setTimeout(r,250));};
    const allReady=!!v().querySelector('[data-action=game][data-game=shoot]');
    await pick('adj');const adjMsg=(v().querySelector('.empty-state h2')||{}).textContent||'',adjLocked=!v().querySelector('[data-action=game][data-game=shoot]');
    const focus=document.activeElement&&document.activeElement.dataset.pos;
    await pick('verb');const verbReady=!!v().querySelector('[data-action=game][data-game=shoot]');
    const saved=localStorage.getItem('koto-game-pos');await pick('all');
    return {allReady,adjMsg,adjLocked,focus,verbReady,saved};`);
  ok('Тоглоом: «Тэмдэг нэр» (3 үг) → «Дахиад 3 «Тэмдэг нэр» үг…», «Үйл үг» (7) → нээлттэй, сонголт хадгалагдана, дарсны дараа фокус товч дээрээ',
    kg.allReady && kg.adjLocked && /Дахиад 3 «Тэмдэг нэр» үг/.test(kg.adjMsg) && kg.focus === 'adj' && kg.verbReady && kg.saved === 'verb', JSON.stringify(kg));
  await shot('pos-games-1400');
  await size(390, 844, true); await nav(SITE);
  const k3 = await ev(`location.hash='words';await new Promise(r=>setTimeout(r,300));const c=[...document.querySelectorAll('#view-words [data-action=word-pos]')];
    const page1=document.documentElement.scrollWidth,small=c.filter(b=>b.getBoundingClientRect().height<44).length;location.hash='review';await new Promise(r=>setTimeout(r,300));
    const t=[...document.querySelectorAll('#view-review [data-action=pos-practice]')],cols=new Set(t.map(b=>Math.round(b.getBoundingClientRect().left))).size;
    return {page:Math.max(page1,document.documentElement.scrollWidth),vw:innerWidth,small,tiles:t.length,cols,tsmall:t.filter(b=>b.getBoundingClientRect().height<44).length};`);
  ok('390: ангиллын товчнууд хэвтээ гүйлтгүй, ≥44px; Давтлагын 6 хавтан 2 баганаар', k3.page <= k3.vw && k3.small === 0 && k3.tiles === 6 && k3.cols === 2 && k3.tsmall === 0, JSON.stringify(k3));
  await shot('pos-words-390');
  await ev(`localStorage.removeItem('koto-irodori-v1');localStorage.removeItem('koto-game-pos');return true;`);
  await size(1400, 900, false);

  console.log('\n[T] Сэдэв: өнгө × горим (11-05j)');
  /* Статик: styles.css-ийн var(--p-*) бүр :root-д тодорхойлогдсон, 4 сэдвийн блок ИЖИЛ токентой — шинэ өнгө нэмээд
     нэг сэдэвт мартвал тэр сэдэвт тухайн дүрэм чимээгүй алга болно (CSS хувьсагч тодорхойгүй = unset). */
  const TCSS = fs.readFileSync(__dirname + '/../v2/themes.css', 'utf8'), SCSS = fs.readFileSync(__dirname + '/../v2/styles.css', 'utf8');
  const tblock = sel => { const i = TCSS.indexOf(sel + ' {'); return i < 0 ? null : new Set(TCSS.slice(i, TCSS.indexOf('}', i)).match(/--p-[\w-]+(?=:)/g) || []); };
  const tb = { green: tblock(':root'), pink: tblock(':root[data-palette="pink"]'), coffee: tblock(':root[data-palette="coffee"]'), blue: tblock(':root[data-palette="blue"]') };
  const used = new Set((SCSS.match(/var\(--p-[\w-]+\)/g) || []).map(v => v.slice(4, -1)));
  const tmiss = Object.entries(tb).map(([k, s]) => [k, s ? [...tb.green].filter(n => !s.has(n)).length + [...s].filter(n => !tb.green.has(n)).length : -1]).filter(([, n]) => n);
  const undef = [...used].filter(n => !tb.green.has(n));
  ok('Статик: 4 сэдвийн блок ижил ' + tb.green.size + ' токентой, styles.css-ийн ' + used.size + ' var(--p-*) бүгд тодорхойлогдсон',
    tb.green.size >= 200 && !tmiss.length && !undef.length, JSON.stringify({ tmiss, undef: undef.slice(0, 5) }));
  /* Сэдэв солигдсоны дараа 300 мс хүлээнэ: `.primary-btn`-д `transition: background .15s` — шууд уншвал хуучин өнгө.
     Хүлээгдэх утга тест дотроо (themes.css-ээс уншихгүй): ногоон лайм b8ef58, ягаан fab2d6 (эзэн), ягааны дэвсгэр
     f4eff2 / 281d25 (11-06: хурц цагаанаас бүдэг), кофегийн шар товч e3b35e, цэнхэр бараан дэвсгэр 1a2532, кофегийн бараан номын хуудас 302218. */
  await dark(false); await nav(SITE);
  await ev(`localStorage.removeItem('koto-theme');return true;`); await nav(SITE);
  const T_STYLE = `const cs=s=>getComputedStyle(document.querySelector(s));
    const S=()=>({pal:document.documentElement.dataset.palette,th:document.documentElement.getAttribute('data-theme'),
      body:cs('body').backgroundColor,mark:cs('.brand-mark').backgroundColor,scheme:cs(':root').colorScheme,
      shadow:cs('.hero-art .m-shadow').fill,page1:cs('.hero-art .m-page1').fill,body2:cs('.hero-art .m-body').fill,
      hero:cs('.hero .primary-btn').backgroundColor,meta:[...document.querySelectorAll('meta[name=theme-color]')].map(m=>m.content).join(' '),
      saved:localStorage.getItem('koto-theme')});`;
  const t0 = await ev(T_STYLE + `const b=document.getElementById('theme-trigger');return {...S(),exp:b.getAttribute('aria-expanded'),api:!!window.KOTO_THEME};`);
  ok('Анхдагч: Ногоон · Автомат (data-palette="green", data-theme алга), лого лайм, хөтчийн мөр лайм',
    t0.api && t0.pal === 'green' && t0.th === null && t0.mark === 'rgb(184, 239, 88)' && t0.meta === '#b8ef58 #b8ef58' && t0.exp === 'false' && t0.saved === null, JSON.stringify(t0));
  /* 11-06a (эзэн): товч дээр бичиг/палитрын дүрс биш ОДООГИЙН өнгөний дээж. Дээж CSS-ээс — JS хүлээвэл ачаалахад ногоон гялсхийнэ. */
  const ts = await ev(`const b=document.getElementById('theme-trigger'),g=()=>getComputedStyle(b.querySelector('.theme-swatch')).backgroundImage,W=()=>new Promise(r=>setTimeout(r,60)),out={text:b.textContent.trim(),old:!!b.querySelector('.theme-icon,.theme-trigger-label'),chev:!!b.querySelector('.theme-chevron'),pal:{}};
    for(const [p,c,n] of [['pink','rgb(250, 178, 214)','Ягаан'],['coffee','rgb(248, 244, 225)','Кофе'],['blue','rgb(219, 226, 239)','Цэнхэр'],['green','rgb(184, 239, 88)','Ногоон']]){KOTO_THEME.set({palette:p});await W();out.pal[p]=g().includes(c)&&b.getAttribute('aria-label')==='Өнгө солих. Одоо: '+n+'.'&&b.title===b.getAttribute('aria-label');}
    document.documentElement.dataset.palette='coffee';out.cssOnly=g().includes('rgb(248, 244, 225)');document.documentElement.dataset.palette='green';
    out.region=document.getElementById('theme-popover').getAttribute('aria-label');return out;`);
  ok('Товч: бичиггүй, chevron-той; дээж ба уншигчийн нэр 4 өнгө бүрд зөв («Өнгө солих. Одоо: Ягаан.»); дээж зөвхөн CSS-ээр; «Сэдэв» үг алга',
    ts.text === '' && !ts.old && ts.chev && ts.pal.pink && ts.pal.coffee && ts.pal.blue && ts.pal.green && ts.cssOnly && ts.region === 'Өнгө солих', JSON.stringify(ts));
  const tk = await ev(`const num=c=>(c.match(/[0-9.]+/g)||[]).map(Number),lin=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);},L=c=>{const n=num(c);return 0.2126*lin(n[0])+0.7152*lin(n[1])+0.0722*lin(n[2]);},cr=(a,b)=>{const x=L(a),y=L(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);};
    const b=document.getElementById('theme-trigger'),sw=b.querySelector('.theme-swatch'),ch=b.querySelector('.theme-chevron'),W=()=>new Promise(r=>setTimeout(r,300));let min=99,at='';
    for(const palette of ['green','pink','coffee','blue'])for(const mode of ['light','dark'])for(const open of ['false','true']){KOTO_THEME.set({palette,mode});b.setAttribute('aria-expanded',open);await W();const bg=getComputedStyle(b).backgroundColor,v=Math.min(cr(getComputedStyle(sw).borderTopColor,bg),cr(getComputedStyle(ch).stroke,bg));if(v<min){min=v;at=palette+' '+mode+' '+open;}}
    b.setAttribute('aria-expanded','false');KOTO_THEME.set({palette:'green',mode:'auto'});await W();return {min:+min.toFixed(2),at};`);
  ok('Дээжийн хүрээ ба chevron ≥ 3:1 — 4 өнгө × гэрэлтэй/бараан, хаалттай/нээлттэй (кофены цайвар дээж цайвар дэвсгэрт)', tk.min >= 3, JSON.stringify(tk));
  const t1 = await ev(`document.getElementById('theme-trigger').click();await new Promise(r=>setTimeout(r,200));const p=document.getElementById('theme-popover');
    const r=n=>[...p.querySelectorAll('input[name='+n+']')].map(i=>i.value+(i.checked?'*':'')).join(',');
    return {open:!p.hidden,exp:document.getElementById('theme-trigger').getAttribute('aria-expanded'),pal:r('koto-palette'),mode:r('koto-mode'),
      legends:[...p.querySelectorAll('legend')].map(l=>l.textContent).join('/'),focus:document.activeElement&&document.activeElement.value};`);
  ok('Сонгогч: нээгдэнэ (aria-expanded), «Өнгө» 4 · «Горим» 3 радио, одоогийнх тэмдэглэгдсэн, фокус сонгосон өнгөн дээр',
    t1.open && t1.exp === 'true' && t1.pal === 'green*,pink,coffee,blue' && t1.mode === 'light,dark,auto*' && t1.legends === 'Өнгө/Горим' && t1.focus === 'green', JSON.stringify(t1));
  const t2 = await ev(`document.querySelector('#theme-popover input[value=pink]').closest('label').click();await new Promise(r=>setTimeout(r,200));` + T_STYLE + `return {...S(),open:!document.getElementById('theme-popover').hidden};`);
  ok('Ягаан: тэр дор нь солигдоно — лого fab2d6, дэвсгэр f4eff2, маскот ягаан, хадгалагдсан, поповер нээлттэй хэвээр',
    t2.pal === 'pink' && t2.mark === 'rgb(250, 178, 214)' && t2.body === 'rgb(244, 239, 242)' && t2.body2 === 'rgb(250, 178, 214)' && t2.open &&
    t2.saved === '{"palette":"pink","mode":"auto"}' && t2.meta === '#f4eff2 #281d25', JSON.stringify(t2));
  const t3 = await ev(`document.querySelector('#theme-popover input[value=dark]').closest('label').click();await new Promise(r=>setTimeout(r,200));` + T_STYLE + `return S();`);
  ok('Бараан (төхөөрөмж гэрэлтэй байхад): data-theme="dark", дэвсгэр 281d25, color-scheme dark, маскотын сүүдэр 140c11',
    t3.th === 'dark' && t3.body === 'rgb(40, 29, 37)' && t3.scheme === 'dark' && t3.shadow === 'rgb(20, 12, 17)' && t3.meta === '#281d25 #281d25', JSON.stringify(t3));
  await nav(SITE);
  const t4 = await ev(T_STYLE + `return S();`);
  ok('Дахин ачаалахад Ягаан · Бараан хэвээр', t4.pal === 'pink' && t4.th === 'dark' && t4.body === 'rgb(40, 29, 37)', JSON.stringify(t4));
  const t4b = await ev(`return document.getElementById('theme-trigger').getAttribute('aria-label');`);
  ok('Дахин ачаалахад уншигчийн нэр анхнаасаа одоогийн өнгөтэй', t4b === 'Өнгө солих. Одоо: Ягаан.', t4b);
  await dark(true);
  const t5 = await ev(`KOTO_THEME.set({mode:'light'});` + T_STYLE + `const a=S();KOTO_THEME.set({mode:'auto'});const b=S();KOTO_THEME.set({mode:'light'});KOTO_THEME.set({mode:'auto'});return {light:a,auto:b,again:S().body};`);
  ok('Төхөөрөмж бараан: «Гэрэлтэй» → f4eff2, «Автомат» → 281d25 (media нөхцөл анхных руугаа сэргэнэ, давтахад ч)',
    t5.light.body === 'rgb(244, 239, 242)' && t5.light.scheme === 'light' && t5.auto.body === 'rgb(40, 29, 37)' && t5.auto.th === null && t5.again === 'rgb(40, 29, 37)', JSON.stringify(t5));
  const t6 = await ev(`const W=()=>new Promise(r=>setTimeout(r,300));KOTO_THEME.set({palette:'blue'});await W();` + T_STYLE + `const b=S();KOTO_THEME.set({palette:'coffee'});await W();const c=S();KOTO_THEME.set({palette:'green'});await W();const g=S();return {b,c,g};`);
  ok('Цэнхэр бараан 1a2532 · Кофе бараан: номын хуудас 302218, шар товч e3b35e · Ногоон бараан: маскотын сүүдэр 0c160b',
    t6.b.body === 'rgb(26, 37, 50)' && t6.c.page1 === 'rgb(48, 34, 24)' && t6.c.hero === 'rgb(227, 179, 94)' && t6.g.shadow === 'rgb(12, 22, 11)' && t6.g.body === 'rgb(24, 34, 29)', JSON.stringify(t6));
  await dark(false);
  const t7 = await ev(`const W=()=>new Promise(r=>setTimeout(r,300));KOTO_THEME.set({palette:'coffee'});await W();` + T_STYLE + `const c=S();KOTO_THEME.set({palette:'green'});await W();const g=S();return {c:c.hero,g:g.hero};`);
  ok('Гэрэлтэй: кофегийн гол товч шар e3b35e, ногоонд бараан 22352c (тусгай дүрэм зөвхөн тухайн сэдэвт)',
    t7.c === 'rgb(227, 179, 94)' && t7.g === 'rgb(34, 53, 44)', JSON.stringify(t7));
  await nav(SITE);
  const t8 = await ev(`const b=document.getElementById('theme-trigger'),p=document.getElementById('theme-popover'),lb=document.getElementById('language-trigger'),lp=document.getElementById('language-popover');
    const W=ms=>new Promise(r=>setTimeout(r,ms));b.click();await W(150);
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await W(100);const esc=p.hidden&&document.activeElement===b;
    b.click();await W(150);lb.click();await W(150);const swap=p.hidden&&!lp.hidden&&b.getAttribute('aria-expanded')==='false';
    b.click();await W(150);const swap2=lp.hidden&&!p.hidden;
    document.querySelector('.nav-item[data-view=words]').focus();await W(100);const tab=p.hidden;return {esc,swap,swap2,tab};`);
  ok('Escape → хаагдаж фокус товч руу; хэл ↔ сэдэв сонгогч зэрэг нээгдэхгүй; фокус гадагш гарвал хаагдана',
    t8.esc && t8.swap && t8.swap2 && t8.tab, JSON.stringify(t8));
  await size(390, 844, true); await nav(SITE);
  const t9 = await ev(`const b=document.getElementById('theme-trigger');const r=b.getBoundingClientRect();b.click();await new Promise(r=>setTimeout(r,200));
    const p=document.getElementById('theme-popover').getBoundingClientRect(),small=[...document.querySelectorAll('#theme-popover .theme-choice')].filter(c=>c.getBoundingClientRect().height<44).length;
    return {w:r.width,h:r.height,in:p.left>=0&&p.right<=innerWidth&&p.top>=0&&p.bottom<=innerHeight,page:document.documentElement.scrollWidth,vw:innerWidth,small};`);
  ok('390: товч ≥ 44×44, поповер дэлгэц дотор, сонголт бүр ≥ 44px, хэвтээ гүйлтгүй',
    t9.w >= 44 && t9.h >= 44 && t9.in && t9.small === 0 && t9.page <= t9.vw, JSON.stringify(t9));
  await shot('theme-390-picker');
  /* Astra-гийн хяналт (11-05j): хуруугаар 2× томруулахад поповер ХАРАГДАХ талбай (visualViewport) дотор, өнгө 1 баганаар
     (2 баганаар 163px-д үсэг бүр мөр болж байв). */
  await ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));return true;`);
  await send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 }); await sleep(300);
  const tz = await ev(`document.getElementById('theme-trigger').click();await new Promise(r=>setTimeout(r,300));const v=visualViewport,p=document.getElementById('theme-popover').getBoundingClientRect();
    const ch=[...document.querySelectorAll('#theme-popover .theme-palette-choice')];
    return {scale:v.scale,in:p.left>=v.offsetLeft-1&&p.right<=v.offsetLeft+v.width+1&&p.top>=v.offsetTop-1&&p.bottom<=v.offsetTop+v.height+1,
      tall:ch.filter(c=>c.getBoundingClientRect().height>46).length,pop:[p.left,p.top,p.width,p.height].map(Math.round),vv:[v.offsetLeft,v.offsetTop,v.width,v.height].map(Math.round)};`);
  ok('390, 2× томруулсан: поповер харагдах талбай дотор, өнгөний сонголт бүр нэг мөр', tz.scale === 2 && tz.in && tz.tall === 0, JSON.stringify(tz));
  await ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));return true;`);
  await send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });
  const tc = await ev(`KOTO_THEME.set({palette:'pink',mode:'dark'});const before=document.documentElement.dataset.palette;
    localStorage.clear();window.dispatchEvent(new StorageEvent('storage',{key:null}));
    return {before,after:document.documentElement.dataset.palette,th:document.documentElement.getAttribute('data-theme'),get:JSON.stringify(KOTO_THEME.get())};`);
  ok('Өөр табад localStorage.clear() (storage event key=null) → энд ч Ногоон · Автомат', tc.before === 'pink' && tc.after === 'green' && tc.th === null && tc.get === '{"palette":"green","mode":"auto"}', JSON.stringify(tc));
  /* 11-06 (эзэн): гэрэлтэйн хурц цагааныг бүдгэрүүлж, бараан дэвсгэрийг цайруулав. Хуудас + карт (өмнө `background:white` шууд бичигдсэн .topic-card, .kana-sticker ч) — 8 хувилбар бүгд. */
  await size(1400, 900, false); await nav(SITE);
  const tsurf = await ev(`const X={'green-light':['rgb(241, 244, 239)','rgb(250, 251, 248)'],'green-dark':['rgb(24, 34, 29)','rgb(33, 47, 39)'],'pink-light':['rgb(244, 239, 242)','rgb(251, 248, 250)'],'pink-dark':['rgb(40, 29, 37)','rgb(51, 36, 46)'],
      'coffee-light':['rgb(241, 237, 218)','rgb(249, 246, 236)'],'coffee-dark':['rgb(43, 32, 24)','rgb(55, 41, 30)'],'blue-light':['rgb(239, 240, 242)','rgb(245, 245, 246)'],'blue-dark':['rgb(26, 37, 50)','rgb(35, 50, 70)']},bad=[];
    const bgOf=s=>getComputedStyle(document.querySelector(s)).backgroundColor;
    for(const k in X){const [palette,mode]=k.split('-');KOTO_THEME.set({palette,mode});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      if(bgOf('body')!==X[k][0])bad.push(k+' body '+bgOf('body'));for(const s of ['.unit-card','.topic-card:not(.selected)','.kana-sticker','.side-card'])if(bgOf(s)!==X[k][1])bad.push(k+' '+s+' '+bgOf(s));}
    KOTO_THEME.set({palette:'green',mode:'auto'});return bad;`);
  ok('Гадарга 4 өнгө × 2 горим: цэвэр цагаан алга, бараан цайвардсан; шууд бичигдсэн white үлдээгүй (.topic-card, .kana-sticker)', tsurf.length === 0, tsurf.join(' | '));
  await size(320, 700, true); await nav(SITE);
  const t320 = await ev(`const r=document.getElementById('theme-trigger').getBoundingClientRect(),top=document.querySelector('.topbar').getBoundingClientRect();return {w:r.width,h:r.height,right:r.right,vw:innerWidth,page:document.documentElement.scrollWidth,top:top.height};`);
  ok('320: дээжтэй товч ≥ 44×44, дэлгэц дотор, дээд мөр нэг эгнээ (< 90px), хэвтээ гүйлтгүй', t320.w >= 44 && t320.h >= 44 && t320.right <= t320.vw && t320.page <= t320.vw && t320.top < 90, JSON.stringify(t320));
  await ev(`localStorage.removeItem('koto-theme');return true;`);
  await size(1400, 900, false); await dark(false);

  console.log('\n[W] Үгийн карт: давтсан өдрийн зураас (11-06, эзэн B; загвар — Astra)');
  /* Хүлээлт тест дотроо. 8 үг: 12 өдөр бататгасан · 12 өдөр алдсан · 5 өдөр бататгасан · 3 өдөр · 1 өдөр (нэг өдөрт давхар) ·
     бүртгэлтэй түүхгүй · бүртгэлгүй түүхтэй · шинэ. */
  await dark(false); await nav(SITE);
  const W_SEED = `const W=window.KOTO.words().slice(0,8),d=n=>{const t=new Date();t.setDate(t.getDate()-n);return t.toISOString().slice(0,10);},t=d(0),rec=(p,weak)=>({passes:p,weak,due:t,last:t,attempts:3,misses:weak?1:0});
    const words={[W[0].id]:rec(9,false),[W[1].id]:rec(0,true),[W[2].id]:rec(3,false),[W[3].id]:rec(2,false),[W[4].id]:rec(1,false),[W[5].id]:rec(1,false)},days={};
    const add=(n,id)=>{(days[d(n)]=days[d(n)]||[]).push(id);};
    for(let i=1;i<=12;i++){add(i,W[0].id);add(i,W[1].id);}for(let i=1;i<=5;i++)add(i,W[2].id);for(let i=1;i<=3;i++)add(i,W[3].id);add(1,W[4].id);add(1,W[4].id);add(2,W[6].id);
    localStorage.setItem('koto-irodori-v1',JSON.stringify({version:1,xp:0,completed:[],words,kana:{},days,xpd:{},selectedTopic:0}));localStorage.removeItem('koto-word-pos');return true;`;
  await ev(W_SEED); await nav(SITE);
  const wc = await ev(`location.hash='words';await new Promise(r=>setTimeout(r,500));
    return [...document.querySelectorAll('#view-words .word-card')].slice(0,8).map(c=>{const b=c.querySelector('.word-days-bar'),s=c.querySelector('.word-status'),d=c.querySelector('.word-days');
      return {days:d?d.textContent.trim():null,level:b?b.dataset.level:null,w:b?b.getBoundingClientRect().width:0,bg:b?getComputedStyle(b).backgroundColor:null,hid:b?b.getAttribute('aria-hidden'):null,st:s.textContent.trim(),cls:[...s.classList].filter(x=>x!=='word-status').join()};});`);
  const wx = [['12 өдөр давтсан', '4', 'Бататгасан', 'is-strong'], ['12 өдөр давтсан', '4', 'Дахин бататгана', 'is-weak'], ['5 өдөр давтсан', '3', 'Бататгасан', 'is-strong'], ['3 өдөр давтсан', '2', 'Үзсэн үг', ''],
    ['1 өдөр давтсан', '1', 'Үзсэн үг', ''], ['1 өдөр давтсан', '1', 'Үзсэн үг', ''], [null, null, 'Шинэ үг', ''], [null, null, 'Шинэ үг', '']];
  const wbad = wx.map((x, i) => [i, wc[i].days === x[0] && wc[i].level === x[1] && wc[i].st === x[2] && wc[i].cls === x[3]]).filter(([, g]) => !g).map(([i]) => i);
  ok('Бичиг ба шат: 12/5/3/1 өдөр → шат 4/3/2/1; нэг өдөрт давхар → 1; түүхгүй бүртгэлтэй → 1; бүртгэлгүй → «Шинэ үг», зураасгүй', wbad.length === 0, JSON.stringify({ wbad, wc: wc.map(c => [c.days, c.level, c.st]) }));
  ok('Зураасны урт шатаар өснө (12 < 24 < 36 < 48), уншигчид нуугдсан — тоо нь бичгээр', wc[4].w === 12 && wc[3].w === 24 && wc[2].w === 36 && wc[0].w === 48 && wc[0].hid === 'true', JSON.stringify(wc.map(c => c.w)));
  ok('Нэг алдсанаас өнгө унахгүй: 12 өдөр зөв ба 12 өдөр алдсан үгийн зураас ИЖИЛ; ногоон шат 1 лайм, шат 4 бараан', wc[0].bg === wc[1].bg && wc[0].bg === 'rgb(42, 87, 68)' && wc[4].bg === 'rgb(184, 239, 88)', JSON.stringify([wc[0].bg, wc[1].bg, wc[4].bg]));
  const wk = await ev(`const num=c=>(c.match(/[0-9.]+/g)||[]).map(Number),lin=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);},L=c=>{const n=num(c);return 0.2126*lin(n[0])+0.7152*lin(n[1])+0.0722*lin(n[2]);},cr=(a,b)=>{const x=L(a),y=L(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);};
    const c=document.querySelector('#view-words .word-card'),b=c.querySelector('.word-days-bar'),sw=[];let min=99,at='';
    for(const palette of ['green','pink','coffee','blue'])for(const mode of ['light','dark']){KOTO_THEME.set({palette,mode});await new Promise(r=>setTimeout(r,300));const v=cr(getComputedStyle(b).borderTopColor,getComputedStyle(c).backgroundColor);if(v<min){min=v;at=palette+' '+mode;}if(palette==='pink'&&mode==='light')sw.push(getComputedStyle(b).backgroundColor);}
    KOTO_THEME.set({palette:'green',mode:'auto'});return {min:+min.toFixed(2),at,pink:sw[0]};`);
  ok('Зураасны хүрээ ≥ 3:1 — 4 өнгө × гэрэлтэй/бараан; ягаанд шат 4 ягаан сэдвийн өнгөтэй', wk.min >= 3 && wk.pink === 'rgb(77, 32, 54)', JSON.stringify(wk));
  /* 11-06: 2994 карт зэрэг transition хийж дэлгэц 1.4–3.6 сек гацдаг байв (0.2 сек болов) — хугацаа биш, шалтгааныг шалгана. */
  const wn = await ev(`const c=document.querySelector('#view-words .word-card'),raf=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    KOTO_THEME.set({palette:'green',mode:'light'});await raf();await new Promise(r=>setTimeout(r,300));
    KOTO_THEME.set({palette:'pink',mode:'dark'});const now=getComputedStyle(c).backgroundColor,anim=document.getAnimations().length,on=document.documentElement.classList.contains('theme-switching');
    await raf();const off=document.documentElement.classList.contains('theme-switching'),anim2=document.getAnimations().length;KOTO_THEME.set({palette:'green',mode:'auto'});await raf();return {now,anim,on,off,anim2};`);
  ok('Өнгө солих мөчид карт хөдөлгөөн хийхгүй: шууд эцсийн өнгө, анги дараагийн кадрт авагдана, дараа нь ч хөдөлгөөн эхлэхгүй',
    wn.now === 'rgb(51, 36, 46)' && wn.anim === 0 && wn.on && !wn.off && wn.anim2 === 0, JSON.stringify(wn));
  await shot('word-days-1400');
  for (const [wd, ht] of [[390, 844], [320, 700]]) {
    await size(wd, ht, true); await nav(SITE);
    const wm = await ev(`location.hash='words';await new Promise(r=>setTimeout(r,500));const c=[...document.querySelectorAll('#view-words .word-card')].slice(0,8),out=c.filter(x=>[...x.querySelectorAll('.word-days,.word-status')].some(e=>e.getBoundingClientRect().right>x.getBoundingClientRect().right+0.5)).length;
      return {page:document.documentElement.scrollWidth,vw:innerWidth,out,cards:c.length};`);
    ok(wd + ': зураас ба шошго карт дотор, хэвтээ гүйлтгүй', wm.page <= wm.vw && wm.out === 0 && wm.cards === 8, JSON.stringify(wm));
    if (wd === 390) await shot('word-days-390');
  }
  await size(1400, 900, false);
  await ev(`localStorage.removeItem('koto-irodori-v1');localStorage.removeItem('koto-theme');return true;`);

  console.log('\n[H] Консол');
  ok('барьсангүй уналт гараагүй (' + errs.length + ')', errs.length === 0, errs.join(' | ').slice(0, 400));
  console.log('\n──────────────\ntsever: ' + good + '   unasan: ' + bad + '\nzurag: ' + OUT);
  ws.close(); chrome.kill(); process.exit(bad ? 1 : 0);
})().catch(e => { console.log('ALDAA', e && e.message); process.exit(2); });
