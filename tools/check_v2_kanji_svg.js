/* v2 ханзны SVG-г ЭХТЭЙ нь пикселээр тулгах (хөтөч, CDP) — татсны дараа нэг удаа:
 *     node tools/check_v2_kanji_svg.js --old <Commons-ийн кэш> --vg <KanjiVG-ийн кэш>
 * (кэш — `fetch_v2_kanji_old.py --cache`, `fetch_v2_kanjivg.py --cache`-ийн хавтас)
 *
 * Яагаад: цэвэрлэгээний 4 алдааг (11-04) бүтцийн тест БАРИАГҮЙ, зөвхөн энэ барив —
 *   transform-ийг тоймлож 0.065 → 0.1 (91 файл 1.5 дахин томорсон), «1.54-0.04» ба «22.99.04»-ийн
 *   тусгаарлагч алга болж тоо нийлсэн, KanjiVG-ийн харьцангуй «c»-ийн алдаа хуримтлагдсан (7%).
 * Шалгуур: 160×160-д зурж, бэх (alpha>127) зөрсөн пиксел / эхийн бэх.
 *   Commons: ≤ 2% (2 оронтой тоймлол, ирмэгийн сүүдэр) · KanjiVG: 0 (эхээр нь хадгална).
 */
'use strict';
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const DBG = 9257;
const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const OLD = arg('--old'), VG = arg('--vg');
if (!OLD && !VG) { console.log('node tools/check_v2_kanji_svg.js --old <кэш> --vg <кэш>'); process.exit(2); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = (p, m) => new Promise((res, rej) => {
  const q = http.request({ host: '127.0.0.1', port: DBG, path: p, method: m || 'GET' }, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); });
  q.on('error', rej); q.end();
});
const raw = fs.readFileSync(path.join(ROOT, 'v2/kanji.js'), 'utf8');
const K = JSON.parse(raw.slice(raw.indexOf('['), raw.lastIndexOf(']') + 1));
const ids = Object.fromEntries(K.map(k => [k.c, k.id]));
const sets = [];
if (OLD) {
  const tsv = fs.readFileSync(path.join(ROOT, 'tools/v2_kanji_old.tsv'), 'utf8').split('\n').filter(l => l && !l.startsWith('#')).map(l => l.split('\t'));
  let missing = 0;
  const pairs = tsv.map(([c, , kind, file]) => {
    const name = [...file].map(ch => ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')).join('_');
    if (!fs.existsSync(path.join(OLD, name))) { missing++; return null; }
    return { key: c + '-' + kind, a: fs.readFileSync(path.join(OLD, name), 'utf8'), b: fs.readFileSync(path.join(ROOT, 'v2/kanji-old', ids[c] + '-' + kind + '.svg'), 'utf8') };
  }).filter(Boolean);
  sets.push({ name: 'Commons (эртний бичиг)', pairs, limit: 0.02, missing });
}
if (VG) {
  const mk = list => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 109 109"><g fill="none" stroke="#000" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' + list.map(d => '<path d="' + d + '"/>').join('') + '</g></svg>';
  const pairs = K.map(k => {
    const orig = fs.readFileSync(path.join(VG, k.c.codePointAt(0).toString(16).padStart(5, '0') + '.svg'), 'utf8');
    const vg = JSON.parse(fs.readFileSync(path.join(ROOT, 'v2/kanji-vg', k.id + '.json'), 'utf8'));
    return { key: k.c, a: mk([...orig.matchAll(/<path[^>]*?\sd="([^"]*)"/g)].map(m => m[1])), b: mk(vg.s.map(x => x[0])) };
  });
  sets.push({ name: 'KanjiVG (зурлага)', pairs, limit: 0.005, missing: 0 });
}
(async () => {
  const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + DBG, '--no-first-run', '--disable-gpu',
    '--user-data-dir=' + require('os').tmpdir() + '\\kotosvg-' + Date.now(), 'about:blank'], { stdio: 'ignore' });
  let tab = null;
  for (let i = 0; i < 60 && !tab; i++) { try { tab = await getJSON('/json/new?about:blank', 'PUT'); } catch (e) { await sleep(250); } }
  if (!tab) { console.log('Chrome neegdsengui'); chrome.kill(); process.exit(2); }
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise(r => { ws.onopen = r; });
  let id = 0; const w = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && w.has(m.id)) { w.get(m.id)(m.result); w.delete(m.id); } };
  const send = (method, params) => new Promise(r => { const i = ++id; w.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const win = (await send('Runtime.evaluate', { expression: 'window' })).result.objectId;
  const fn = `async (pairs)=>{const N=160,load=s=>new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(s);});
    const px=async s=>{const im=await load(s),c=document.createElement('canvas');c.width=c.height=N;const x=c.getContext('2d');x.drawImage(im,0,0,N,N);return x.getImageData(0,0,N,N).data;};
    const out=[];for(const p of pairs){const A=await px(p.a),B=await px(p.b);let d=0,ink=0;for(let i=3;i<A.length;i+=4){const a=A[i]>127,b=B[i]>127;if(a)ink++;if(a!==b)d++;}out.push([p.key,ink,d]);}return out;}`;
  let bad = 0;
  for (const s of sets) {
    const r = await send('Runtime.callFunctionOn', { functionDeclaration: fn, objectId: win, arguments: [{ value: s.pairs }], awaitPromise: true, returnByValue: true });
    const rows = r.result.value.map(([k, ink, d]) => [k, ink ? d / ink : (d ? 1 : 0), ink]).sort((x, y) => y[1] - x[1]);
    const over = rows.filter(x => x[1] > s.limit || !x[2]);
    bad += over.length;
    console.log(`${over.length ? 'FAIL' : 'ok  '} ${s.name}: ${rows.length} хос${s.missing ? ` (кэшид алга ${s.missing})` : ''} · хамгийн их зөрүү ${(rows[0][1] * 100).toFixed(2)}% (${rows[0][0]}) · босго ${s.limit * 100}% · хэтэрсэн ${over.length}${over.length ? ': ' + over.slice(0, 8).map(x => x[0]).join(' ') : ''}`);
  }
  ws.close(); chrome.kill(); process.exit(bad ? 1 : 0);
})().catch(e => { console.log('ALDAA ' + e.message); process.exit(2); });
