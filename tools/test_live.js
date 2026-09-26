/* ТАРСАН сайтыг шалгана — «локал дээр ажиллаж байсан» нь хангалтгүй.
 *
 *     node tools/test_live.js
 *     TEST_SITE=http://localhost:8765/ node tools/test_live.js
 *
 * Юу барих гэсэн вэ:
 *   · хувилбарын зөрүү (`?v=` ба `sw.js` дахь VERSION) — офлайн кэш
 *     хуучин файл өгөх хамгийн түгээмэл шалтгаан,
 *   · тараагдаагүй эсвэл замаа алдсан файл (404),
 *   · өгөгдлийн файл дутуу тарсан (тоо зөрөх),
 *   · API түлхүүр санамсаргүй хөтөч рүү орсон,
 *   · Supabase-ийн RPC унасан, эсвэл хүснэгт нээлттэй болсон.
 *
 * Аппын ЗАН ТӨЛӨВийг шалгадаггүй — түүнд `test_ui.js` байна (тэр ч
 * амьд хаяг дээр ажиллана: `TEST_URL=<хаяг> node tools/test_ui.js`;
 * гэхдээ §2-ын `isDevHost` шалгуур зөвхөн localhost дээр тэнцэнэ).
 */
'use strict';

const SITE = (process.env.TEST_SITE || 'https://nova-xo.github.io/irodori-vocab/')
  .replace(/\/*$/, '/');
const bust = u => SITE + u + (u.indexOf('?') < 0 ? '?t=' : '&t=') + Date.now();

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, info) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else {
    fail++; fails.push(name + (info ? '  — ' + info : ''));
    console.log('  FAIL ' + name + (info ? '  — ' + info : ''));
  }
}

const getText = u => fetch(u).then(r => r.text()).catch(() => '');
const getJSON = u => fetch(u).then(r => r.json()).catch(() => null);
const status = u => fetch(u).then(r => r.status).catch(() => 0);

/** Өгөгдлийн файлууд нь хоёр хэлбэртэй: массив, эсвэл `{items|map|ids}`. */
function rows(d) {
  if (!d) return null;
  if (Array.isArray(d)) return d;
  for (const k of ['items', 'map', 'ids']) {
    if (d[k]) return Array.isArray(d[k]) ? d[k] : Object.keys(d[k]);
  }
  return null;
}

(async () => {
  console.log('сайт: ' + SITE + '\n');
  console.log('[1] Хувилбарын нийцэл');
  const html = await getText(bust('index.html'));
  const sw = await getText(bust('sw.js'));
  if (!html || !sw) {
    console.log('  FAIL сайт хүрэхгүй байна');
    process.exit(2);
  }
  const vHtml = [...new Set([...html.matchAll(/\?v=([0-9a-z-]+)/g)].map(m => m[1]))];
  const vSw = (sw.match(/const VERSION = '([^']+)'/) || [])[1];
  ok('index.html дахь ?v= бүгд ИЖИЛ', vHtml.length === 1, JSON.stringify(vHtml));
  ok('sw.js VERSION нь index.html-тэй таарна', vHtml[0] === vSw,
    'html=' + vHtml[0] + ' sw=' + vSw);
  console.log('       хувилбар: ' + vSw);

  console.log('\n[2] Лавласан файлууд хүрэх эсэх');
  const refs = [...new Set([...html.matchAll(/(?:href|src)="([^"#][^"]*)"/g)]
    .map(m => m[1]).filter(u => !/^(https?:|data:|mailto:)/.test(u)))];
  const bad = [];
  for (const u of refs) {
    const s = await status(SITE + u);
    if (s !== 200) bad.push(u + ' -> ' + s);
  }
  ok('index.html лавласан ' + refs.length + ' файл бүгд 200', bad.length === 0,
    bad.slice(0, 4).join(' | '));
  const swFiles = [...new Set([...sw.matchAll(/'([^']+\.(?:js|css|html|json|woff2?))'/g)]
    .map(m => m[1]))].filter(f => !/^https?:/.test(f));
  const swBad = [];
  for (const f of swFiles.slice(0, 30)) {
    const s = await status(SITE + f.replace(/^\.\//, ''));
    if (s !== 200) swBad.push(f + ' -> ' + s);
  }
  ok('sw.js кэшлэх файлууд хүрнэ', swBad.length === 0, swBad.slice(0, 3).join(' | '));

  console.log('\n[3] Өгөгдөл бүрэн тарсан эсэх');
  const NEED = {
    'data/vocab.json': 1232, 'data/vocab-el1.json': 1192,
    'data/vocab-el2.json': 1786, 'data/vocab-n5.json': 2077,
    'data/exam-starter.json': 180, 'data/grammar-starter.json': 18,
    'data/kanji-emoji.json': 144,
  };
  for (const [f, n] of Object.entries(NEED)) {
    const r = rows(await getJSON(bust(f)));
    ok(f + ' = ' + n, r && r.length === n, r ? 'бодит: ' + r.length : 'ачаалагдсангүй');
  }
  const ex = await getJSON(bust('data/exam-starter.json'));
  const flagged = ex && ex.items.filter(x => x.free === 0 || x.free === 1).length;
  const nFree = ex && ex.items.filter(x => x.free === 1).length;
  ok('шалгалтын асуулт бүр free тэмдэгтэй', flagged === 180, String(flagged));
  ok('чөлөөт асуулт 100..160 (хувийн хариулт)',
    nFree >= 100 && nFree <= 160, String(nFree));
  const gr = await getJSON(bust('data/grammar-starter.json'));
  const drills = gr && rows(gr).reduce((a, p) => a + (p.q || p.drills || []).length, 0);
  ok('дүрмийн дасгал 360', drills === 360, String(drills));
  const au = await getJSON(bust('data/audio.json'));
  const ids = rows(au) || [];
  ok('audio.json бичлэгтэй', ids.length > 1000, 'бичлэг: ' + ids.length);
  const aBad = [];
  for (const id of [...ids.slice(0, 6), ...ids.slice(-3)]) {
    const s = await status(SITE + 'audio/' + id + '.mp3');
    if (s !== 200) aBad.push(id + ' -> ' + s);
  }
  ok('дууны файл хүрнэ (эхний 6 + сүүлийн 3)', aBad.length === 0, aBad.join(' | '));

  console.log('\n[4] Түлхүүр хөтөч рүү ОРООГҮЙ эсэх');
  const app = await getText(bust('app.js'));
  ok('app.js-д LLM-ийн түлхүүр байхгүй',
    app.indexOf('gsk_') < 0 && app.indexOf('AIza') < 0);
  ok('app.js-д service_role түлхүүр байхгүй',
    !/service_role|SERVICE_ROLE/.test(app));

  console.log('\n[5] Supabase — RPC ба хүснэгтийн хаалт');
  const cfg = await getText(bust('sync-config.js'));
  const url = (cfg.match(/url:\s*'([^']+)'/) || [])[1];
  const key = (cfg.match(/key:\s*'([^']+)'/) || [])[1];
  if (!url || !key) {
    ok('sync-config.js уншигдана', false, 'синк тохируулаагүй — §5 алгаслаа');
  } else {
    const base = url.replace(/\/+$/, '');
    const hdr = { 'Content-Type': 'application/json', apikey: key,
                  Authorization: 'Bearer ' + key };
    const rpc = fn => fetch(base + '/rest/v1/rpc/' + fn,
      { method: 'POST', headers: hdr, body: '{}' })
      .then(async r => ({ s: r.status, b: await r.text() }))
      .catch(e => ({ s: 0, b: e.message }));
    const tbl = t => fetch(base + '/rest/v1/' + t + '?select=*', { headers: hdr })
      .then(async r => ({ s: r.status, b: await r.text() }))
      .catch(e => ({ s: 0, b: e.message }));

    const us = await rpc('usage_stats');
    ok('usage_stats RPC ажиллана', us.s === 200, us.s + ' ' + us.b.slice(0, 70));
    if (us.s === 200) console.log('       ' + us.b.slice(0, 150));
    const cl = await rpc('class_list');
    ok('class_list RPC ажиллана', cl.s === 200, cl.s + ' ' + cl.b.slice(0, 60));
    ok('class_list ангийн КОД задруулахгүй', !/"code"/.test(cl.b), cl.b.slice(0, 70));
    for (const t of ['classes', 'members', 'progress', 'devices', 'judge_hits']) {
      const r = await tbl(t);
      const closed = r.s >= 400 || r.b.trim() === '[]';
      const missing = /42P01|PGRST205|does not exist/.test(r.b);
      ok(t + ' хүснэгт рүү ШУУД хандахад мөр гарахгүй'
        + (missing ? ' (хүснэгт хараахан үүсээгүй)' : ''),
        closed, r.s + ' ' + r.b.slice(0, 60));
    }
  }

  console.log('\n' + '─'.repeat(52));
  console.log('цэвэр: ' + pass + '   унасан: ' + fail);
  if (fails.length) { console.log('\nУНАСАН:'); fails.forEach(f => console.log('  · ' + f)); }
  process.exit(fail ? 1 : 0);
})();
