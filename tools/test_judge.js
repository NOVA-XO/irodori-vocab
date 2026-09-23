/* Ярианы үнэлгээний ЧАНАРЫГ хэмжих — АЛТАН ЖАГСААЛТ.
 *
 * Энэ нь CI-ийн тест БИШ: сүлжээ шаардана, LLM-ийн квот иддэг, хариу нь
 * бүрэн тогтвортой биш. Тиймээс гараар ажиллуулна:
 *
 *     node tools/test_judge.js            # амьд функц рүү
 *     node tools/test_judge.js --local    # зөвхөн аппын локал алгоритм
 *
 * Зорилго: «аль нийлүүлэгчийг үндсэн болгох вэ», «заавар сайжирсан уу»
 * гэдгийг МАРКЕТИНГААР биш, өөрсдийн өгөгдлөөр шийдэх.
 */
'use strict';
const fs = require('fs');

const URL = process.env.JUDGE_URL
  || (() => {
    const s = fs.readFileSync('sync-config.js', 'utf8');
    const u = (s.match(/url:\s*'([^']+)'/) || [])[1] || '';
    return u.replace(/\/+$/, '') + '/functions/v1/judge';
  })();

/* [асуулт, загвар хариулт, зорилтот бүтэц, сонссон, ХҮЛЭЭЖ БУЙ зэрэг]
 * Хүлээж буй зэргийг БАГШИЙН нүдээр тавив: сурагч энэ хариултыг хэлэхэд
 * багш «зөв», «ойролцоо», «өөр» гэсэн алины аль нь гэж хэлэх вэ. */
const GOLD = [
  ['ペンを借りたいです。何と言いますか。', 'ペンを貸してください。', 'てください',
   'ペンをかしてください', 'ok'],
  ['ペンを借りたいです。何と言いますか。', 'ペンを貸してください。', 'てください',
   'ペンをかして', 'near'],
  ['毎朝何時に起きますか。', '六時に起きます。', '時間',
   'はい、ろくじにおきます', 'ok'],
  ['毎朝何時に起きますか。', '六時に起きます。', '時間',
   'ろくじです', 'near'],
  ['毎朝何時に起きますか。', '六時に起きます。', '時間',
   'すしがすきです', 'off'],
  ['どんな食べ物が好きですか。', 'すしが好きです。', '好きです',
   'すしがすきです', 'ok'],
  ['どんな食べ物が好きですか。', 'すしが好きです。', '好きです',
   'すし', 'near'],
  ['朝、先生に会いました。何と言いますか。', 'おはようございます。', 'あいさつ',
   'おはようございます', 'ok'],
  ['朝、先生に会いました。何と言いますか。', 'おはようございます。', 'あいさつ',
   'こんばんは', 'off'],
  ['温泉に入りたいですか。', '温泉に入りたいです。', 'たいです',
   'おんせんにはいりたいです', 'ok'],
  ['温泉に入りたいですか。', '温泉に入りたいです。', 'たいです',
   'おんせんにはいります', 'near'],
  ['家族は何人ですか。', 'よにんです。', '家族',
   'よにんかぞくです', 'ok'],
];

const post = (q, model, key, heard, modelKana) =>
  fetch(URL + '?debug=1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q, model, key, heard, modelKana: modelKana || '' }),
  }).then(r => r.json()).catch(e => ({ error: String(e.message) }));

(async () => {
  console.log('хаяг:', URL);
  console.log('');
  let ok = 0, near = 0;
  const bySrc = {};
  for (const [q, model, key, heard, want] of GOLD) {
    const r = await post(q, model, key, heard);
    const got = r.band || ('ERR ' + JSON.stringify(r.tried || r.error || r));
    const hit = got === want;
    if (hit) ok++;
    // Зэргэлдээ зэрэг (ok<->near, near<->off) нь бүтэн алдаа биш
    else if ((got === 'ok' && want === 'near') || (got === 'near' && want === 'ok')
          || (got === 'near' && want === 'off') || (got === 'off' && want === 'near')) near++;
    if (r.src) bySrc[r.src] = (bySrc[r.src] || 0) + 1;
    const pad = (t, n) => (t + ' '.repeat(n)).slice(0, n);
    console.log((hit ? '✓ ' : '✗ ') + pad(heard, 22) + ' хүлээсэн ' + pad(want, 5)
      + ' -> ' + got + (r.missing && r.missing.length ? ' (' + r.missing.join(',') + ')' : ''));
    await new Promise(r2 => setTimeout(r2, 1500));     // квотыг өршөө
  }
  console.log('');
  console.log('ЯГ таарсан: %d/%d (%d%%) · зэргэлдээ: %d · нийлүүлэгч: %s',
    ok, GOLD.length, Math.round(100 * ok / GOLD.length), near,
    JSON.stringify(bySrc));
})();
