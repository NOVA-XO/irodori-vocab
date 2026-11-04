/* v2-ийн «Ханз» өгөгдөл (v2/kanji.js) — хөтөчгүй шалгалт:
 *     node tools/test_v2_kanji.js
 *
 *   1. jisho.org-ийн жагсаалт (tools/v2_kanji_order.txt): N5 79, N4 166,
 *      давхардалгүй, хоёр түвшин огтлолцохгүй; kanji.js нь ЯГ тэр дараалал;
 *   2. утга, түвшин нь v1-ийн data/kanji.json-оос зөрөөгүй (гараар засаагүй);
 *   3. уншлага: он — катакана, кун — хирагана (окуригана «.»), «-» үлдээгүй;
 *   4. жишээ үг (≤3): тухайн ханзтай, уншлага зөвхөн кана, бичлэг диск дээр.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'v2/kanji.js'), 'utf8'), ctx, { filename: 'v2/kanji.js' });
const K = ctx.window.KOTO_KANJI;
const V1 = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(ROOT, 'data/kanji.json'), 'utf8')).items.map(x => [x.c, x]));
const order = {};
for (const line of fs.readFileSync(path.join(ROOT, 'tools/v2_kanji_order.txt'), 'utf8').split('\n')) {
  if (!line.trim() || line.startsWith('#')) continue;
  const [lv, chars] = line.trim().split(/\s+/);
  order[lv] = [...chars];
}

let good = 0, bad = 0;
function ok(name, pass, detail) {
  if (pass) { good++; console.log('  ok   ' + name); }
  else { bad++; console.log('  FAIL ' + name + (detail ? '  ' + String(detail).slice(0, 500) : '')); }
}

console.log('\n[1] Жагсаалт ба дараалал (jisho.org)');
const n5 = order.N5 || [], n4 = order.N4 || [];
ok('N5 79, N4 166, давхардалгүй, огтлолцохгүй',
  n5.length === 79 && n4.length === 166 && new Set(n5).size === 79 && new Set(n4).size === 166 && !n5.some(c => n4.includes(c)),
  JSON.stringify({ n5: n5.length, n4: n4.length }));
const seq = K.map(k => k.c).join(''), want = n5.join('') + n4.join('');
ok('kanji.js нь jisho-гийн дарааллаар (N5 дараа нь N4), түвшин зөв',
  seq === want && K.every((k, i) => k.n === (i < 79 ? 5 : 4)), seq === want ? '' : 'дараалал зөрсөн');

console.log('\n[2] v1-тэй тулгалт');
const drift = K.filter(k => !V1[k.c] || V1[k.c].mn.trim() !== k.mn || V1[k.c].n !== k.n || V1[k.c].id !== k.id).map(k => k.c);
ok('утга, түвшин, id нь v1-ийн data/kanji.json-тай ижил', !drift.length, drift.join(''));
ok('бүх ханзанд монгол утга, зурлагын тоо', K.every(k => k.mn && k.s > 0), K.filter(k => !k.mn || !(k.s > 0)).map(k => k.c).join(''));

console.log('\n[3] Уншлага');
const KATA = /^[ァ-ヺー]+$/, HIRA = /^[ぁ-ゖー]+(\.[ぁ-ゖー]+)?$/;
const rbad = K.filter(k => !(k.on.length + k.kun.length) || k.on.some(r => !KATA.test(r)) || k.kun.some(r => !HIRA.test(r))).map(k => k.c + ':' + k.on.join(',') + '/' + k.kun.join(','));
ok('он — катакана, кун — хирагана (окуригана «.»), «-» үлдээгүй, ядаж нэг уншлага', !rbad.length, rbad.slice(0, 8).join(' | '));

console.log('\n[4] Жишээ үг');
const KANA = /^[ぁ-ゖァ-ヺー]+$/;
const ex = K.flatMap(k => k.ex.map(e => ({ k, e })));
const ebad = ex.filter(({ k, e }) => !e.jp.includes(k.c) || !KANA.test(e.kana) || /[／～（）()]/.test(e.jp) || !e.mn);
ok('жишээ бүр тухайн ханзтай, уншлага зөвхөн кана, хог тэмдэгтгүй, утгатай (' + ex.length + ')', !ebad.length, ebad.slice(0, 5).map(({ k, e }) => k.c + ':' + e.jp + '/' + e.kana).join(' | '));
const au = ex.filter(({ e }) => !e.au || !fs.existsSync(path.join(ROOT, 'audio', e.au + '.mp3')));
ok('жишээ бүр бичлэгтэй (audio/<au>.mp3 байна)', !au.length, au.slice(0, 5).map(({ e }) => e.jp).join(' '));
const noEx = K.filter(k => !k.ex.length).map(k => k.c).join('');
ok('ханз бүрт ≤3 жишээ; жишээгүй нь 6 (六万答研究洋)', K.every(k => k.ex.length <= 3) && noEx === '六万答研究洋', noEx);

console.log('\n──────────────');
console.log('цэвэр: ' + good + '   унасан: ' + bad);
process.exit(bad ? 1 : 0);
