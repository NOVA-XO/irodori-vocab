/* Хариулт шалгагчийн ТЕСТ — ГУРВАН номд бүгдэд.
 *
 * Хоёр зүйлийг шалгана:
 *   1. Ромажи хүлээн авах — үг бүрийн ӨӨРИЙНХ нь ромажиг «хэрэглэгчийн
 *      бичсэн» гэж өгөөд апп зөв гэж хүлээж авах эсэх.
 *      入門-д л хамаарна: 初級1/2-ын PDF-д ромажи багана БАЙХГҮЙ.
 *   2. Кана хүлээн авах — үгийн кана уншлага answerSet дотор байгаа эсэх.
 *      Гурван номд бүгдэд хамаарна, «гараар бичих» дасгалын үндэс нь энэ.
 *
 * Ажиллуулах:  node tools/test_answers.js
 * Гаралт нь тэг биш бол (алдаа) shell-д 1 буцаана — CI-д хэрэглэж болно.
 */
const fs = require('fs');
const path = require('path');

// app.js-ийг браузергүйгээр ачаална: DOM-той хэсгийг таслаад зөвхөн
// хөрвүүлэгч ба шалгагчийг авна.
const src = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const cut = src.indexOf('/* ══════════════════════ 3.');
if (cut < 0) {
  console.error('app.js-ийн 3-р хэсгийн зааг олдсонгүй — тестийг шинэчлэх шаардлагатай.');
  process.exit(2);
}
const head = src.slice(0, cut);
// app.js нь хувилбараа өөрийн <script src> хаягаас уншдаг тул `document`
// хэрэгтэй. Браузергүй орчинд хуурамчаар өгнө.
const mod = {};
new Function('exports', 'document', head + '\nexports.toKana=toKana;exports.normKana=normKana;' +
  'exports.normRomaji=normRomaji;exports.answerSet=answerSet;exports.checkTyped=checkTyped;')(
  mod, { currentScript: null });

const BOOKS = [
  { name: '入門  ', file: 'vocab.json', romaji: true },
  { name: '初級1 ', file: 'vocab-el1.json', romaji: false },
  { name: '初級2 ', file: 'vocab-el2.json', romaji: false },
  { name: 'N5   ', file: 'vocab-n5.json', romaji: false },
];

let bad = 0;
const rejected = [];
console.log('ном      үг    кана хүлээв      ромажи хүлээв     уншлагагүй');

for (const b of BOOKS) {
  const p = path.join(__dirname, '..', 'data', b.file);
  if (!fs.existsSync(p)) { console.log(b.name + '  (файл алга: ' + b.file + ')'); continue; }
  const items = JSON.parse(fs.readFileSync(p, 'utf8')).items;

  let romajiOk = 0, kanaOk = 0, noKana = 0, romajiHave = 0;
  for (const it of items) {
    if (!it.kana) noKana++;

    // Хос хэлбэртэй бичлэг («kuru／kimasu») дээр хэрэглэгч НЭГ хэлбэрийг
    // бичнэ, бүтнээр нь биш. Тиймээс хэсэг тус бүрээр шалгана.
    const parts = (it.romaji || '').split(/[／/]/).map(s => s.trim()).filter(Boolean);
    if (parts.length) {
      romajiHave++;
      if (parts.every(p2 => mod.checkTyped(p2, it))) romajiOk++;
      else if (it.kana) rejected.push({ book: b.file, id: it.id, jp: it.jp, romaji: it.romaji });
    }

    // Кана уншлага answerSet дотор байгаа эсэх — «гараар бичих»-ийн үндэс.
    const set = mod.answerSet(it);
    const k = mod.normKana((it.kana || '').split(/[／/]/)[0]);
    if (k && set.has(k)) kanaOk++;
  }

  const pct = (a, n) => n ? (100 * a / n).toFixed(1) + '%' : '—';
  console.log(b.name + ' ' + String(items.length).padStart(5)
    + '   ' + String(kanaOk).padStart(5) + ' ' + pct(kanaOk, items.length).padStart(7)
    + '   ' + String(romajiOk).padStart(5) + ' ' + pct(romajiOk, romajiHave).padStart(7)
    + '      ' + noKana);

  // Кана хүлээлт 99%-аас доош бол жинхэнэ регресс.
  if (items.length && kanaOk / items.length < 0.99) bad++;
  if (b.romaji && romajiHave && romajiOk / romajiHave < 0.99) bad++;
}

/* Хөрвүүлэгчийн шууд тест.
 *
 * toKana нь ДУУДЛАГЫН дагуу хөрвүүлдэг, БИЧЛЭГИЙН дагуу биш:
 *   konnichiwa -> こんにちわ   (こんにちは гэж бичдэг ч «ва» гэж дуудна)
 *   …shimasu   -> …します
 * Хэрэглэгчид ямар ч байсан зөв гэж тооцогдоно — тэр нь checkTyped-ын
 * ажил, доор тусад нь шалгасан. Энд зөвхөн хөрвүүлэлтийг шалгана.
 * (Өмнө нь энэ хүснэгтэд «こんにちは» ба «しつれえしまむ» гэсэн БУРУУ
 *  хүлээлт бичигдсэн байсан — «しまむ» гэдэг үг ч байхгүй.)
 */
const cases = [
  ['namae', 'なまえ'], ['konnichiwa', 'こんにちわ'], ['shitsureeshimasu', 'しつれえします'],
  ['gakkou', 'がっこう'], ['kippu', 'きっぷ'], ['purezento', 'ぷれぜんと'],
  ['tenpura', 'てんぷら'], ['ryokoo', 'りょこお'], ['jitensha', 'じてんしゃ'],
  ['fuyu', 'ふゆ'], ['chotto', 'ちょっと'], ['nihongo', 'にほんご'],
];
console.log('\n-- toKana --');
let diff = 0;
for (const [inp, want] of cases) {
  const got = mod.toKana(inp);
  if (got !== want) diff++;
  console.log((got === want ? 'ok  ' : 'DIFF') + '  ' + inp.padEnd(18) + got
    + (got === want ? '' : '   want ' + want));
}
if (diff) bad++;

/* Хэрэглэгчийн бичсэнийг ХҮЛЭЭЖ АВАХ эсэх — жинхэнэ ажиллагаа нь энэ.
 *
 * Гурван бүлэг тохиолдол:
 *   は/わ ба い/え зөрүү — бичлэг нь дуудлагаасаа өөр үгс.
 *   Хаалт    — «おはよう（ございます）» дээр хаалтын дотрыг бичихгүй ч зөв.
 *   ō-ийн хоёр бичлэг — ном «oo» гэж бичдэг, хэрэглэгч «ou» гэж бичиж мэднэ.
 *
 * Хаалт БАЙХГҮЙ үгэнд («ありがとうございます») дутуу бичихийг татгалзах нь
 * ЗӨВ — тиймээс тэр нь энэ жагсаалтад байхгүй. */
console.log('\n-- checkTyped --');
const accept = [
  ['こんにちは', 'konnichiwa'], ['こんにちは', 'konnichiha'],
  ['しつれいします', 'shitsureeshimasu'], ['しつれいします', 'shitsureishimasu'],
  ['おはよう（ございます）', 'ohayoo'], ['おはよう（ございます）', 'ohayou'],
  ['おはよう（ございます）', 'ohayoogozaimasu'],
  ['（どうも）ありがとう', 'arigatoo'], ['（どうも）ありがとう', 'doomoarigatoo'],
  ['ありがとうございます', 'arigatoogozaimasu'],
];
const all = BOOKS.map(b => path.join(__dirname, '..', 'data', b.file))
  .filter(fs.existsSync)
  .flatMap(p2 => JSON.parse(fs.readFileSync(p2, 'utf8')).items);
for (const [kana, typed] of accept) {
  const it = all.find(x => x.kana === kana);
  if (!it) { console.log('SKIP  ' + kana + ' — сан дотор алга'); continue; }
  const ok = mod.checkTyped(typed, it);
  if (!ok) bad++;
  console.log((ok ? 'ok  ' : 'FAIL') + '  ' + typed.padEnd(20) + '-> ' + kana);
}

fs.writeFileSync(path.join(__dirname, 'rejected.json'),
  JSON.stringify(rejected.slice(0, 80), null, 1), 'utf8');
console.log('\nтатгалзсан ромажи: ' + rejected.length + '  (tools/rejected.json)');
console.log(bad ? 'АЛДАА: ' + bad + ' шалгуур хангасангүй' : 'бүх шалгуур хангалттай');
process.exit(bad ? 1 : 0);
