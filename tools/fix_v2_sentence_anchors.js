/* v2/sentences.js — тулгуур үгийг (`w`) үгийн сангийн ШИНЭ дараалалд тааруулна.
 *
 * Үгийн дараалал солигдоход (2026-11-25: утгын нэгж → номын хичээл) зарим өгүүлбэрийн үг тулгуурынхаа алхмаас ХОЙНО
 * заагддаг болно. Ийм өгүүлбэрийг «бүх үг нь заагдаж дууссан хамгийн эхний алхам» руу шилжүүлнэ: тулгуур = өгүүлбэрийн
 * хамгийн сүүлд заагддаг үг. Зөв байгаа өгүүлбэрийг ХӨНДӨХГҮЙ. Дүрэм (GRAMMAR, LEMMA, forms) нь тестийнхтэй ИЖИЛ —
 * tools/test_v2_sentences.js-ээс уншина.
 *
 *     node tools/fix_v2_sentence_anchors.js          # засна
 *     node tools/fix_v2_sentence_anchors.js --check  # зөвхөн тайлагнана (засах зүйл байвал exit 1)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'v2', 'sentences.js');
const check = process.argv.includes('--check');

const ctx = { window: {} };
vm.createContext(ctx);
for (const f of ['v2/data.js', 'v2/sentences.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
const DATA = ctx.window.KOTO_DATA, SENT = ctx.window.KOTO_SENTENCES;
const test = fs.readFileSync(path.join(__dirname, 'test_v2_sentences.js'), 'utf8');
const rules = test.slice(test.indexOf('const GRAMMAR'), test.indexOf('/* app.js-тэй ижил'));
const { GRAMMAR, LEMMA, forms } = new Function(rules + '\nreturn { GRAMMAR, LEMMA, forms };')();

const lessons = [];
DATA.units.forEach(u => { for (let c = 0; c * 5 < u.words.length; c++) lessons.push({ id: u.key + '-' + c, words: u.words.slice(c * 5, c * 5 + 5) }); });
const lessonOf = {}, firstAt = {};
lessons.forEach((L, i) => L.words.forEach(w => { lessonOf[w.id] = i; forms(w.jp).forEach(f => { if (!(f in firstAt)) firstAt[f] = { i, id: w.id }; }); }));

const lines = fs.readFileSync(FILE, 'utf8').split('\n');
const rows = lines.map((l, n) => (/^\s*\{w:'[^']+',/.test(l) ? n : -1)).filter(n => n >= 0);
if (rows.length !== SENT.length) { console.error('мөрийн тоо (' + rows.length + ') ≠ өгүүлбэр (' + SENT.length + ')'); process.exit(2); }

let moved = 0, stuck = 0;
SENT.forEach((s, k) => {
  const extra = new Set(s.extra || []);
  const need = s.tokens.filter(t => !GRAMMAR.has(t) && !extra.has(t)).flatMap(t => LEMMA[t] || [t]);
  const missing = need.filter(f => !(f in firstAt));
  if (missing.length) { stuck++; console.log('  ! ' + s.w + ' «' + s.tokens.join(' ') + '» — санд алга: ' + missing.join(',')); return; }
  const last = need.map(f => firstAt[f]).sort((a, b) => b.i - a.i)[0];
  const at = lessonOf[s.w];
  const anchor = at === undefined ? null : lessons[at].words.find(w => w.id === s.w);
  const anchorIn = anchor && forms(anchor.jp).some(f => s.tokens.some(t => t === f || (LEMMA[t] || []).includes(f)));
  if (at !== undefined && at >= last.i && anchorIn) return;                    // зөв — хөндөхгүй
  const n = rows[k], before = lines[n];
  lines[n] = before.replace(/\{w:'[^']+'/, "{w:'" + last.id + "'");
  moved++;
  console.log('  ' + s.w + ' → ' + last.id + ' (' + (at === undefined ? '—' : lessons[at].id) + ' → ' + lessons[last.i].id + ') «' + s.tokens.join(' ') + '»');
});
console.log('шилжүүлэх ' + moved + ' · шийдэгдээгүй ' + stuck + ' · нийт ' + SENT.length);
if (check) process.exit(moved || stuck ? 1 : 0);
if (moved) fs.writeFileSync(FILE, lines.join('\n'));
process.exit(stuck ? 1 : 0);
