/* Хариулт шалгагчийн ТЕСТ.
 *
 * Үг бүрийн ӨӨРИЙНХ нь ромажиг «хэрэглэгчийн бичсэн» гэж өгөөд, апп зөв
 * гэж хүлээн авах эсэхийг шалгана. Мөн кана уншлагыг нь латин руу буцааж
 * бичих боломжтой эсэхийг (toKana -> normKana таарч байгаа эсэх) шалгана.
 *
 * Ажиллуулах:  node tools/test_answers.js
 */
const fs = require('fs');
const path = require('path');

// app.js-ийг браузергүйгээр ачаална: DOM-той хэсгийг таслаад зөвхөн
// хөрвүүлэгч ба шалгагчийг авна.
const src = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const cut = src.indexOf('/* ══════════════════════ 3.');
const head = src.slice(0, cut);
// app.js нь хувилбараа өөрийн <script src> хаягаас уншдаг тул `document`
// хэрэгтэй. Браузергүй орчинд хуурамчаар өгнө.
const mod = {};
new Function('exports', 'document', head + '\nexports.toKana=toKana;exports.normKana=normKana;' +
  'exports.normRomaji=normRomaji;exports.answerSet=answerSet;exports.checkTyped=checkTyped;')(
  mod, { currentScript: null });

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'vocab.json'), 'utf8'));
const items = data.items;

let romajiOk = 0, kanaOk = 0, noKana = 0, fails = [];
for (const it of items) {
  if (!it.kana) { noKana++; }
  // Хос хэлбэртэй бичлэг («kuru / kimas») дээр хэрэглэгч НЭГ хэлбэрийг бичнэ,
  // бүтнээр нь биш. Тиймээс хэсэг тус бүрээр шалгана.
  const parts = (it.romaji || '').split(/[／/]/).map(s => s.trim()).filter(Boolean);
  const byRomaji = parts.length > 0 && parts.every(p => mod.checkTyped(p, it));
  if (byRomaji) romajiOk++;

  // кана уншлагыг латинаар бичих боломжтой юу: kana -> (гар аргаар биш)
  // энд зөвхөн normKana(kana) нь answerSet дотор байгаа эсэхийг шалгана
  const set = mod.answerSet(it);
  const k = mod.normKana((it.kana || '').split(/[／/]/)[0]);
  if (k && set.has(k)) kanaOk++;

  if (it.romaji && !byRomaji && it.kana) fails.push(it);
}

console.log('items          ', items.length);
console.log('romaji accepted', romajiOk, '(' + (100 * romajiOk / items.length).toFixed(1) + '%)');
console.log('kana in answers', kanaOk, '(' + (100 * kanaOk / items.length).toFixed(1) + '%)');
console.log('no kana        ', noKana);
console.log('romaji rejected', fails.length);

// Хөрвүүлэгчийн шууд тест
const cases = [
  ['namae', 'なまえ'], ['konnichiwa', 'こんにちは'], ['shitsureeshimasu', 'しつれえしまむ'],
  ['gakkou', 'がっこう'], ['kippu', 'きっぷ'], ['purezento', 'ぷれぜんと'],
  ['tenpura', 'てんぷら'], ['ryokoo', 'りょこお'], ['jitensha', 'じてんしゃ'],
  ['fuyu', 'ふゆ'], ['chotto', 'ちょっと'], ['nihongo', 'にほんご'],
];
console.log('\n-- toKana --');
for (const [inp, want] of cases) {
  const got = mod.toKana(inp);
  console.log((got === want ? 'ok  ' : 'DIFF') + '  ' + inp.padEnd(18) + got + (got === want ? '' : '   want ' + want));
}

fs.writeFileSync(path.join(__dirname, 'rejected.json'),
  JSON.stringify(fails.slice(0, 60), null, 1), 'utf8');
