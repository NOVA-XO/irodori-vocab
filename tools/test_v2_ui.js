/* v2 (KOTO) — ШИНЭ UI-ийн тест: дуудлагын товч, Google-ийн нэвтрэлтийн
 * төлөвүүд, бараан сэдэв, 44px дарах талбай, утасны өргөн.
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
  ok('сурах карт: тоглож байхад дүрс үндсэн өнгө (--lime токен, 11-05g «Кофе» #74512d), карт .playing', lt.btnBg === 'rgb(116, 81, 45)' && lt.card, JSON.stringify(lt));
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
  ok('body дэвсгэр бараан (#241a12, «Кофе»)', bg === 'rgb(36, 26, 18)', bg);
  ok('карт бараан, бичиг цайвар', await ev("const c=document.querySelector('.unit-card');const s=getComputedStyle(c);return s.backgroundColor==='rgb(48, 34, 24)'&&getComputedStyle(document.body).color==='rgb(248, 244, 225)'"), await ev("return getComputedStyle(document.querySelector('.unit-card')).backgroundColor+' / '+getComputedStyle(document.body).color"));
  ok('mascot-ийн сүүдэр бараан болов', await ev("const e=document.querySelector('.hero-art svg ellipse');return getComputedStyle(e).fill==='rgb(22, 15, 9)'"), await ev("return getComputedStyle(document.querySelector('.hero-art svg ellipse')).fill"));
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

  console.log('\n[H] Консол');
  ok('барьсангүй уналт гараагүй (' + errs.length + ')', errs.length === 0, errs.join(' | ').slice(0, 400));
  console.log('\n──────────────\ntsever: ' + good + '   unasan: ' + bad + '\nzurag: ' + OUT);
  ws.close(); chrome.kill(); process.exit(bad ? 1 : 0);
})().catch(e => { console.log('ALDAA', e && e.message); process.exit(2); });
