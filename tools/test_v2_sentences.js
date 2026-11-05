/* v2-ийн хичээлийн өгүүлбэр (v2/sentences.js) заасан үгстэйгээ
 * холбоотой эсэх. Хөтөчгүй — `node tools/test_v2_sentences.js`.
 *
 * 2026-11-05-аас өгүүлбэр бүр ТУЛГУУР үгтэй (`w`) — тэр үгийг заадаг хичээлд гарна
 * (үгийн сан 3 түвшин, утгын нэгжээр дахин эрэмбэлэгдсэн). Өгүүлбэр бүрт:
 *   1. тулгуур нь санд байгаа үг, 91 өгүүлбэр хэвээр, давхардалгүй;
 *   2. тулгуурын хичээлийн дор хаяж НЭГ үг орно (эзний хүсэлт 2026-11-02:
 *      «сүүлийн өгүүлбэр бүтээх нь өмнөх хичээлтэйгээ холбоотой»), тулгуур өөрөө ч орно;
 *   3. бусад үг нь тэр хичээл хүртэл заагдсан, эсвэл дагавар/です;
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

/* app.js-тэй ижил: нэгж бүр 5 үгийн хичээлүүдэд. */
const lessons = [];
DATA.units.forEach(u => {
  for (let c = 0; c * 5 < u.words.length; c++)
    lessons.push({ id: u.key + '-' + c, words: u.words.slice(c * 5, c * 5 + 5) });
});
const lessonOf = {};
lessons.forEach((L, i) => L.words.forEach(w => { lessonOf[w.id] = i; }));

console.log('\n[1] Хамрах хүрээ');
ok('өгүүлбэр 91 (2026-11-05-ны шилжүүлэлтээр алдагдаагүй)', Array.isArray(SENT) && SENT.length === 91, Array.isArray(SENT) ? SENT.length : typeof SENT);
const noAnchor = SENT.filter(s => !(s.w in lessonOf)).map(s => s.w + ' «' + s.tokens.join(' ') + '»');
ok('тулгуур үг бүр санд байна', !noAnchor.length, noAnchor.join(' '));
const seen = new Map(), dup = [];
for (const s of SENT) { const k = s.tokens.join(''); if (seen.has(k)) dup.push(k); seen.set(k, 1); }
ok('давхардсан өгүүлбэр байхгүй', !dup.length, dup.join(' '));
const byLesson = {};
for (const s of SENT) if (s.w in lessonOf) (byLesson[lessonOf[s.w]] = byLesson[lessonOf[s.w]] || []).push(s);

console.log('\n[2] Өгүүлбэр бүр тулгуурынхаа хичээлд');
const known = new Set();
const fails = { shape: [], unknown: [], unrelated: [], alts: [], extra: [] };
for (let i = 0; i < lessons.length; i++) {
  const L = lessons[i];
  L.words.forEach(w => forms(w.jp).forEach(f => known.add(f)));
  for (const s of byLesson[i] || []) {
  if (typeof s.mn !== 'string' || !s.mn.trim() || !Array.isArray(s.tokens) || s.tokens.length < 3) { fails.shape.push(L.id); continue; }
  /* Тулгуур өөрөө өгүүлбэрт: шууд эсвэл LEMMA-аар (ごにん → ご). */
  const anchor = L.words.find(w => w.id === s.w);
  const anchorIn = anchor && forms(anchor.jp).some(f => s.tokens.some(tok => tok === f || (LEMMA[tok] || []).includes(f)));
  if (!anchorIn) fails.unrelated.push(L.id + ' тулгуур ' + s.w + ' «' + s.tokens.join(' ') + '»-д алга');
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
}
ok('бүтэц: mn, 3+ үг', !fails.shape.length, fails.shape.join(' '));
ok('өгүүлбэр бүр ТУХАЙН хичээлийн үгтэй', !fails.unrelated.length, '\n       ' + fails.unrelated.join('\n       '));
ok('заагаагүй үг байхгүй (extra-аас бусад)', !fails.unknown.length, fails.unknown.join(' '));
ok('`extra` нь санд байхгүй, өгүүлбэрт орсон үг', !fails.extra.length, fails.extra.join(' '));
ok('`alts` нь ижил үгсийн өөр дараалал', !fails.alts.length, fails.alts.join(' '));
const BIRTH = 'わたし は にせんよねん くがつ はつか に うまれました';
const ex = SENT.filter(s => s.extra).map(s => s.tokens.join(' ') + ':' + s.extra.join(','));
ok('`extra` зөвхөн эзний зөвшөөрсөн газар (төрсөн өдөр — うまれました)', ex.join(' ') === BIRTH + ':うまれました', ex.join(' '));

console.log('\n[3] Эзний төрсөн өдөр (2004-09-20)');
const b = SENT.find(s => s.tokens.join(' ') === BIRTH);
ok('төрсөн өдрийн өгүүлбэр: ' + BIRTH,
  b && b.tokens.join(' ') === 'わたし は にせんよねん くがつ はつか に うまれました' && /2004/.test(b.mn) && /9-р сарын 20/.test(b.mn), b && b.mn);

console.log('\n──────────────\nцэвэр: ' + good + '   унасан: ' + bad);
process.exit(bad ? 1 : 0);
