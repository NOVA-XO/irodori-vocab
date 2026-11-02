/* v2-ийн хичээл бүрийн өгүүлбэр (v2/sentences.js) заасан үгстэйгээ
 * холбоотой эсэх. Хөтөчгүй — `node tools/test_v2_sentences.js`.
 *
 * Хичээл бүрт:
 *   1. өгүүлбэр байна (91/91), илүү түлхүүр байхгүй;
 *   2. тухайн хичээлийн дор хаяж НЭГ үг орно (эзний хүсэлт 2026-11-02:
 *      «сүүлийн өгүүлбэр бүтээх нь өмнөх хичээлтэйгээ холбоотой»);
 *   3. бусад үг нь энэ хичээл хүртэл заагдсан, эсвэл дагавар/です;
 *      ます-ийн хувилбар ба нийлмэл тоог LEMMA-аар задлана;
 *   4. `alts` нь ижил үгсийн өөр дараалал.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const ctx = { window: {} };
vm.createContext(ctx);
for (const f of ['v2/data.js', 'v2/sentences.js'])
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
const DATA = ctx.window.KOTO_DATA;
const SENT = ctx.window.KOTO_SENTENCES;

let good = 0, bad = 0;
function ok(name, pass, detail) {
  if (pass) { good++; console.log('  ok   ' + name); }
  else { bad++; console.log('  FAIL ' + name + (detail ? '  ' + detail : '')); }
}

/* Үргэлж зөвшөөрөгдөх дагавар ба холбох үг. */
const GRAMMAR = new Set(['は', 'が', 'を', 'に', 'で', 'と', 'の', 'も', 'へ', 'から', 'まで', 'か', 'ね', 'よ', 'です', 'でした', 'じゃないです']);
/* ます-ийн хувилбар, нийлмэл тоо → заагдсан байх ёстой үгс. */
const LEMMA = {
  'のみました': ['のみます'],
  'かいました': ['かいます'],
  'のぼりたいです': ['のぼります', 'たいです'],
  'みませんか': ['みます', 'ませんか'],
  'ごにん': ['ご', 'にん'],
  'しちじ': ['しち', 'じ'],
  'せんえん': ['せん', 'えん'],
  'さんびゃくえん': ['さんびゃく', 'えん'],
  'にさつ': ['に', 'さつ'],
  'にせんよねん': ['に', 'せん', 'よん', 'ねん']
};
/* «ぜんぜん～ない», «あまり～ない» → толгой үг (ぜんぜん) ч тооцогдоно. */
const forms = jp => jp.split('／').map(s => s.replace(/^～/, '').replace(/～$/, ''))
  .flatMap(s => s.includes('～') ? [s, s.split('～')[0]] : [s]);
const pattern = jp => jp.startsWith('～');

const lessons = [];
DATA.forEach((topic, t) => {
  for (let c = 0; c * 5 < topic.words.length; c++)
    lessons.push({ id: t + '-' + c, words: topic.words.slice(c * 5, c * 5 + 5) });
});

console.log('\n[1] Хамрах хүрээ');
const missing = lessons.filter(L => !SENT[L.id]).map(L => L.id);
const extraKeys = Object.keys(SENT).filter(k => !lessons.some(L => L.id === k));
ok('хичээл бүрт өгүүлбэр (' + lessons.length + ')', !missing.length, missing.join(' '));
ok('хичээлгүй түлхүүр байхгүй', !extraKeys.length, extraKeys.join(' '));
const seen = new Map(), dup = [];
for (const [id, s] of Object.entries(SENT)) { const k = s.tokens.join(''); if (seen.has(k)) dup.push(seen.get(k) + '=' + id); seen.set(k, id); }
ok('давхардсан өгүүлбэр байхгүй', !dup.length, dup.join(' '));

console.log('\n[2] Хичээл бүрийн өгүүлбэр');
const known = new Set();
const fails = { shape: [], unknown: [], unrelated: [], alts: [], extra: [] };
for (const L of lessons) {
  L.words.forEach(w => forms(w.jp).forEach(f => known.add(f)));
  const s = SENT[L.id];
  if (!s) continue;
  if (typeof s.mn !== 'string' || !s.mn.trim() || !Array.isArray(s.tokens) || s.tokens.length < 3) { fails.shape.push(L.id); continue; }
  const extra = new Set(s.extra || []);
  /* 3. Заагдаагүй үг. */
  const unknown = s.tokens.filter(tok => !GRAMMAR.has(tok) && !extra.has(tok) &&
    !(LEMMA[tok] ? LEMMA[tok].every(f => known.has(f)) : known.has(tok)));
  if (unknown.length) fails.unknown.push(L.id + ':' + unknown.join(','));
  /* `extra` нь үнэхээр санд байхгүй, өгүүлбэрт байгаа үг л байна. */
  for (const e of extra) if (known.has(e) || !s.tokens.includes(e)) fails.extra.push(L.id + ':' + e);
  /* 2. Энэ хичээлийн үг. Дагавар (は, に…) нь зөвхөн «～»-тэй үгэнд тооцогдоно —
     үгүй бол 16-ийн «に» (хоёр) ямар ч өгүүлбэрийн に-ээр «таарна». */
  const joined = s.tokens.join('');
  const related = L.words.some(w => {
    const p = pattern(w.jp);
    return forms(w.jp).some(f =>
      s.tokens.some(tok => (tok === f && (p || !GRAMMAR.has(tok))) || (LEMMA[tok] || []).includes(f)) ||
      (p && f.length >= 3 && joined.includes(f)));
  });
  if (!related) fails.unrelated.push(L.id + ' «' + s.tokens.join(' ') + '» ⟂ ' + L.words.map(w => w.jp).join('・'));
  /* 4. Өөр дараалал. */
  const key = a => [...a].sort().join('|');
  for (const alt of s.alts || [])
    if (key(alt) !== key(s.tokens) || alt.join('|') === s.tokens.join('|')) fails.alts.push(L.id);
}
ok('бүтэц: mn, 3+ үг', !fails.shape.length, fails.shape.join(' '));
ok('өгүүлбэр бүр ТУХАЙН хичээлийн үгтэй', !fails.unrelated.length, '\n       ' + fails.unrelated.join('\n       '));
ok('заагаагүй үг байхгүй (extra-аас бусад)', !fails.unknown.length, fails.unknown.join(' '));
ok('`extra` нь санд байхгүй, өгүүлбэрт орсон үг', !fails.extra.length, fails.extra.join(' '));
ok('`alts` нь ижил үгсийн өөр дараалал', !fails.alts.length, fails.alts.join(' '));
const ex = Object.entries(SENT).filter(([, s]) => s.extra).map(([id, s]) => id + ':' + s.extra.join(','));
ok('`extra` зөвхөн эзний зөвшөөрсөн газар (16-15 うまれました)', ex.join(' ') === '16-15:うまれました', ex.join(' '));

console.log('\n[3] Эзний төрсөн өдөр (2004-09-20)');
const b = SENT['16-15'];
ok('16-15: わたし は にせんよねん くがつ はつか に うまれました',
  b && b.tokens.join(' ') === 'わたし は にせんよねん くがつ はつか に うまれました' && /2004/.test(b.mn) && /9-р сарын 20/.test(b.mn), b && b.mn);

console.log('\n──────────────\nцэвэр: ' + good + '   унасан: ' + bad);
process.exit(bad ? 1 : 0);
