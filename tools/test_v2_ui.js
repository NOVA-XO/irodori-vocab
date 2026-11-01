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

  console.log('\n[C] Хичээл — сурах карт ба асуулт');
  await ev("location.hash='learn';"); await sleep(300);
  await ev("document.querySelector('[data-action=start]').click();"); await sleep(400);
  ok('сурах картад өргөн товч', await ev("return !!document.querySelector('.learn-card .audio-button-wide')"));
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
  await shot('lesson-quiz-checked-1400');
  await ev("document.querySelector('[data-action=exit]').click();"); await sleep(150);
  await ev("document.querySelector('[data-action=discard]').click();"); await sleep(200);

  console.log('\n[D] Синкийн цонх — нэвтрээгүй');
  await ev("document.getElementById('open-sync-top').click();"); await sleep(300);
  ok('цонх нээгдэв (толгойн avatar-аар)', await ev("return document.getElementById('sync-dialog').open"));
  ok('Google товч бий, идэвхтэй', await ev("const b=document.querySelector('.google-signin');return !!b&&!b.disabled"));
  ok('нууц код хэсэг ХААЛТТАЙ (details), шошго «Өөр сонголт»', await ev("const d=document.querySelector('details.sync-code-section');return d&&!d.open&&/Өөр сонголт/.test(d.textContent)"));
  ok('кодын талбар бий, type=text', await ev("const i=document.getElementById('sync-code');return !!i&&i.type==='text'&&!i.disabled"));
  ok('цонхны товч бүр 44px+', (await ev(TAP)).length === 0, JSON.stringify(await ev(TAP)).slice(0, 300));
  await shot('sync-anon-1400');
  await ev("document.querySelector('[data-action=sync-close]').click();");

  console.log('\n[E] Синкийн цонх — Google-ээр нэвтэрсэн (хуурамч сешн, expires хол)');
  const fake = JSON.stringify({ access_token: 'x.y.z', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 86400, user: { email: 'bat@example.com', name: 'Бат Болд', avatar: null } });
  await ev("localStorage.setItem('koto-auth'," + JSON.stringify(fake) + ");");
  await nav(SITE);
  ok('mode=user', await ev("return window.KOTO.mode()==='user'"), await ev("return window.KOTO.mode()"));
  ok('толгойн avatar = нэрийн эхний үсэг «Б»', await ev("return document.getElementById('open-sync-top').textContent.trim()==='Б'"), await ev("return document.getElementById('open-sync-top').textContent.trim()"));
  await ev("document.getElementById('open-sync-top').click();"); await sleep(300);
  ok('бүртгэлийн карт: нэр, имэйл', await ev("const c=document.querySelector('.account-card');return !!c&&/Бат Болд/.test(c.textContent)&&/bat@example.com/.test(c.textContent)"));
  ok('Google товч АЛГА', await ev("return !document.querySelector('.google-signin')"));
  ok('кодын хэсэг идэвхгүй (fieldset disabled, «Идэвхгүй»)', await ev("const f=document.querySelector('.sync-code-fields');const d=document.querySelector('details.sync-code-section');return f&&f.disabled&&/Идэвхгүй/.test(d.textContent)"));
  ok('«Гарах» товч бий', await ev("return !!document.querySelector('[data-action=sign-out]')"));
  await shot('sync-user-1400');
  // Зурагтай хувилбар
  await ev("document.querySelector('[data-action=sync-close]').click();");
  await ev("const a=JSON.parse(localStorage.getItem('koto-auth'));a.user.avatar='https://127.0.0.1:1/x.png';localStorage.setItem('koto-auth',JSON.stringify(a));");
  await nav(SITE);
  ok('зурагтай бол толгойд <img>, ард нь үсэг', await ev("const b=document.getElementById('open-sync-top');return !!b.querySelector('img')&&b.textContent.trim()==='Б'"));
  ok('http:// зураг НЯЦААГДАНА (зөвхөн https)', await ev("const a=JSON.parse(localStorage.getItem('koto-auth'));a.user.avatar='http://evil/x.png';localStorage.setItem('koto-auth',JSON.stringify(a));return true;") && (await nav(SITE), await ev("return !document.getElementById('open-sync-top').querySelector('img')")));
  await ev("document.getElementById('open-sync-top').click();"); await sleep(300);
  await ev("document.querySelector('[data-action=sign-out]').click();"); await sleep(1200);
  ok('Гарах → Google товч буцаж ирнэ, толгой わ', await ev("return !!document.querySelector('.google-signin')&&document.getElementById('open-sync-top').textContent.trim()==='わ'&&window.KOTO.mode()!=='user'"));
  await ev("document.querySelector('[data-action=sync-close]').click();");

  console.log('\n[F] Бараан сэдэв');
  await dark(true); await nav(SITE); await sleep(300);
  const bg = await ev("return getComputedStyle(document.body).backgroundColor");
  ok('body дэвсгэр бараан', bg === 'rgb(18, 26, 22)', bg);
  ok('карт бараан, бичиг цайвар', await ev("const c=document.querySelector('.unit-card');const s=getComputedStyle(c);return s.backgroundColor==='rgb(27, 39, 32)'&&getComputedStyle(document.body).color==='rgb(237, 243, 233)'"), await ev("return getComputedStyle(document.querySelector('.unit-card')).backgroundColor+' / '+getComputedStyle(document.body).color"));
  ok('mascot-ийн сүүдэр бараан болов', await ev("const e=document.querySelector('.hero-art svg ellipse');return getComputedStyle(e).fill==='rgb(12, 22, 11)'"), await ev("return getComputedStyle(document.querySelector('.hero-art svg ellipse')).fill"));
  await shot('home-dark-1400');
  await ev("location.hash='words';"); await sleep(300); await shot('words-dark-1400');
  await ev("document.getElementById('open-sync-top').click();"); await sleep(300);
  ok('Google товч бараан сэдэвт ЦАГААН хэвээр', await ev("return getComputedStyle(document.querySelector('.google-signin')).backgroundColor==='rgb(255, 255, 255)'"));
  await shot('sync-dark-1400');
  await ev("document.querySelector('[data-action=sync-close]').click();");
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
  await ev("document.getElementById('open-sync-top').click();"); await sleep(300); await shot('sync-390');
  ok('390: синк цонхны товч бүр 44px+', (await ev(TAP)).length === 0, JSON.stringify(await ev(TAP)).slice(0, 400));
  await ev("document.querySelector('[data-action=sync-close]').click();");
  await ev("location.hash='learn';"); await sleep(200);
  await ev("document.querySelector('[data-action=start]').click();"); await sleep(400); await shot('lesson-390');
  ok('390: хичээл дотор хэвтээ гүйлт байхгүй', await ev("const d=document.getElementById('lesson-dialog');return d.scrollWidth<=390"), await ev("return document.getElementById('lesson-dialog').scrollWidth"));
  await ev("document.querySelector('[data-action=exit]').click();"); await sleep(150); await ev("document.querySelector('[data-action=discard]').click();");
  await size(320, 700, true); await nav(SITE); await sleep(300);
  ok('320: хэвтээ гүйлт байхгүй', await ev("return document.documentElement.scrollWidth<=320"), await ev("return document.documentElement.scrollWidth"));
  await shot('home-320');
  await dark(true); await ev("location.hash='words';"); await sleep(300); await shot('words-dark-320');

  console.log('\n[H] Консол');
  ok('барьсангүй уналт гараагүй (' + errs.length + ')', errs.length === 0, errs.join(' | ').slice(0, 400));
  console.log('\n──────────────\ntsever: ' + good + '   unasan: ' + bad + '\nzurag: ' + OUT);
  ws.close(); chrome.kill(); process.exit(bad ? 1 : 0);
})().catch(e => { console.log('ALDAA', e && e.message); process.exit(2); });
