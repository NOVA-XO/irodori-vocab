/* Ярианы үнэлгээний ЧАНАРЫГ хэмжих — АЛТАН ЖАГСААЛТ.
 *
 * Хоёр горим:
 *
 *     node tools/test_judge.js            # амьд функц рүү (LLM + нэгтгэл)
 *     node tools/test_judge.js --local    # зөвхөн аппын локал алгоритм
 *
 * `--local` нь сүлжээ, квот, түлхүүр ШААРДАХГҮЙ: `app.js`-ээс үнэлгээний
 * функцуудыг шууд салгаж авч ажиллуулна. Алгоритмыг зассаны дараа
 * регрессийг хэдэн ч удаа шалгаж болно.
 *
 * Анхдагч (амьд) горим нь CI-ийн тест БИШ: сүлжээ шаардана, LLM-ийн квот
 * иддэг, хариу нь бүрэн тогтвортой биш. Тиймээс гараар ажиллуулна.
 *
 * Зорилго: «аль нийлүүлэгчийг үндсэн болгох вэ», «заавар сайжирсан уу»
 * гэдгийг МАРКЕТИНГААР биш, өөрсдийн өгөгдлөөр шийдэх.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const LOCAL = process.argv.includes('--local');
const ROOT = path.join(__dirname, '..');

const URL = process.env.JUDGE_URL
  || (() => {
    const s = fs.readFileSync(path.join(ROOT, 'sync-config.js'), 'utf8');
    const u = (s.match(/url:\s*'([^']+)'/) || [])[1] || '';
    return u.replace(/\/+$/, '') + '/functions/v1/judge';
  })();

/* [асуулт, загвар хариулт, загварын кана, зорилтот бүтэц, сонссон, ХҮЛЭЭЖ БУЙ]
 * Хүлээж буй зэргийг БАГШИЙН нүдээр тавив: сурагч энэ хариултыг хэлэхэд
 * багш «зөв», «ойролцоо», «өөр» гэсэн алины аль нь гэж хэлэх вэ. */
const GOLD = [
  ['ペンを借りたいです。何と言いますか。', 'ペンを貸してください。', 'ペンをかしてください。',
   'てください', 'ペンをかしてください', 'ok'],
  ['ペンを借りたいです。何と言いますか。', 'ペンを貸してください。', 'ペンをかしてください。',
   'てください', 'ペンをかして', 'near'],
  ['毎朝何時に起きますか。', '六時に起きます。', 'ろくじにおきます。', '時間',
   'はい、ろくじにおきます', 'ok'],
  ['毎朝何時に起きますか。', '六時に起きます。', 'ろくじにおきます。', '時間',
   'ろくじです', 'near'],
  ['毎朝何時に起きますか。', '六時に起きます。', 'ろくじにおきます。', '時間',
   'すしがすきです', 'off'],
  ['どんな食べ物が好きですか。', 'すしが好きです。', 'すしがすきです。', '好きです',
   'すしがすきです', 'ok'],
  ['どんな食べ物が好きですか。', 'すしが好きです。', 'すしがすきです。', '好きです',
   'すし', 'near'],
  ['朝、先生に会いました。何と言いますか。', 'おはようございます。', 'おはようございます。',
   'あいさつ', 'おはようございます', 'ok'],
  ['朝、先生に会いました。何と言いますか。', 'おはようございます。', 'おはようございます。',
   'あいさつ', 'こんばんは', 'off'],
  ['温泉に入りたいですか。', '温泉に入りたいです。', 'おんせんにはいりたいです。', 'たいです',
   'おんせんにはいりたいです', 'ok'],
  ['温泉に入りたいですか。', '温泉に入りたいです。', 'おんせんにはいりたいです。', 'たいです',
   'おんせんにはいります', 'near'],
  ['家族は何人ですか。', 'よにんです。', 'よにんです。', '家族',
   'よにんかぞくです', 'ok'],
  /* СӨРӨГ ХЯНАЛТ: огт өөр сэдэв нь ХЭЗЭЭ Ч дээшлэх ёсгүй. Үүнгүй бол
     «бүгдийг ойролцоо гэе» гэсэн хууран мэхлэгч алгоритм ч тэнцэнэ. */
  ['お名前は。', '田中です。', 'たなかです。', '名前', 'きょうはあついです', 'off'],
  ['今何時ですか。', '三時です。', 'さんじです。', '時間', 'わかりません', 'off'],
];

/** `app.js`-ээс үнэлгээний функцуудыг салгаж, Node дотор ажиллуулна. */
function loadLocal() {
  const s = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  const grab = n => {
    const i = s.indexOf('function ' + n + '(');
    if (i < 0) throw new Error('app.js дотор ' + n + ' олдсонгүй');
    let d = 0;
    for (let k = s.indexOf('{', i); k < s.length; k++) {
      if (s[k] === '{') d++;
      else if (s[k] === '}') { d--; if (!d) return s.slice(i, k + 1); }
    }
    throw new Error(n + ' хаагдаагүй');
  };
  const konst = n => {
    const m = s.match(new RegExp('^const ' + n + ' = .*$', 'm'));
    if (!m) throw new Error('app.js дотор ' + n + ' олдсонгүй');
    return m[0];
  };
  const src = [konst('kataToHira'), konst('RB_KANJI'), konst('POLITE_END'), konst('coreOf'), grab('lcsCover'),
    ...['normKana', 'dice2', 'lcsLen', 'judgeSpoken'].map(grab)].join('\n');
  return new Function(src + '\nreturn { judgeSpoken: judgeSpoken };')();
}

const post = (q, model, modelKana, key, heard) =>
  fetch(URL + '?debug=1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q, model, modelKana, key, heard }),
  }).then(r => r.json()).catch(e => ({ error: String(e.message) }));

(async () => {
  const app = LOCAL ? loadLocal() : null;
  console.log(LOCAL ? 'горим: ЛОКАЛ (app.js, сүлжээгүй)' : 'хаяг: ' + URL);
  console.log('');
  let ok = 0, near = 0;
  const bySrc = {};
  for (const [q, model, kana, key, heard, want] of GOLD) {
    let got, miss = [];
    if (LOCAL) {
      got = app.judgeSpoken([heard], { model, modelKana: kana, key }).band;
    } else {
      const r = await post(q, model, kana, key, heard);
      got = r.band || ('ERR ' + JSON.stringify(r.tried || r.error || r));
      miss = r.missing || [];
      if (r.src) bySrc[r.src] = (bySrc[r.src] || 0) + 1;
    }
    const hit = got === want;
    if (hit) ok++;
    // Зэргэлдээ зэрэг (ok<->near, near<->off) нь бүтэн алдаа биш
    else if ((got === 'ok' && want === 'near') || (got === 'near' && want === 'ok')
          || (got === 'near' && want === 'off') || (got === 'off' && want === 'near')) near++;
    const pad = (t, n) => (t + ' '.repeat(n)).slice(0, n);
    console.log((hit ? '✓ ' : '✗ ') + pad(heard, 22) + ' хүлээсэн ' + pad(want, 5)
      + ' -> ' + got + (miss.length ? ' (' + miss.join(',') + ')' : ''));
    if (!LOCAL) await new Promise(r2 => setTimeout(r2, 1500));   // квотыг өршөө
  }
  console.log('');
  console.log('ЯГ таарсан: %d/%d (%d%%) · зэргэлдээ: %d%s',
    ok, GOLD.length, Math.round(100 * ok / GOLD.length), near,
    LOCAL ? '' : ' · нийлүүлэгч: ' + JSON.stringify(bySrc));
})();
