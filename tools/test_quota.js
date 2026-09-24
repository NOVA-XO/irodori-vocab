/* Ярианы үнэлгээний ХЯЗГААР бодитоор ажиллаж байгааг АМЬД шалгана.
 *
 *     node tools/test_quota.js
 *
 * ЯАГААД ГАРААР: амьд Edge Function руу 40+ хүсэлт явуулна. LLM-ийн
 * квот ЗАРЦУУЛАХГҮЙ — хязгаарын шалгалт нь `heard/model`-ийн шалгалтаас
 * ӨМНӨ ажилладаг тул зориуд дутуу бие илгээнэ (LLM рүү хүрэхгүй).
 *
 * ЯАГААД ЭНЭ ТЕСТ БАЙХ ЁСТОЙ: өмнө нь хязгаар кодонд бичигдсэн атлаа
 * ОГТ ажиллахгүй байсан — тоолуур функцийн санах ойд байсан бөгөөд
 * Deno Deploy олон изолят дээр тараадаг тул тус бүрдээ шинээр эхэлдэг
 * байв (150 хүсэлтэд 429 нэг ч гараагүй). «Код байна» гэдэг нь
 * «ажиллаж байна» гэсэн үг БИШ — хэмжиж л мэдэнэ.
 *
 * Хязгаар ажиллахгүй бол эхлээд `SUPABASE.sql`-ийн төгсгөлийн
 * «ЯРИАНЫ ҮНЭЛГЭЭНИЙ КВОТ» хэсгийг Supabase-ийн SQL Editor-т
 * ажиллуулсан эсэхээ шалга (docs/STATE.md §4, асуудал 21).
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const EP = process.env.JUDGE_URL
  || (() => {
    const s = fs.readFileSync(path.join(ROOT, 'sync-config.js'), 'utf8');
    const u = (s.match(/url:\s*'([^']+)'/) || [])[1] || '';
    return u.replace(/\/+$/, '') + '/functions/v1/judge';
  })();

const CAP_DEV = 40;                     // index.ts-тэй ИЖИЛ байх ёстой

let pass = 0, fail = 0;
function ok(name, cond, info) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (info ? '  — ' + info : '')); }
}

/** `heard`/`model` ЗОРИУД дутуу — хязгаар шалгагдаад LLM рүү хүрэхгүй. */
const hit = dev => fetch(EP, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ dev: dev }),
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }))
  .catch(e => ({ status: 0, body: { error: e.message } }));

(async () => {
  console.log('хаяг: ' + EP);
  console.log('');

  const dev = 'zq' + Date.now().toString(36);
  let first429 = 0, scope = '';
  for (let i = 1; i <= CAP_DEV + 6; i++) {
    const r = await hit(dev);
    if (r.status === 429) { first429 = i; scope = r.body.scope || ''; break; }
    if (r.status !== 400) {
      console.log('  санамсаргүй хариу #' + i + ': ' + r.status
        + ' ' + JSON.stringify(r.body));
      break;
    }
  }

  ok('ТӨХӨӨРӨМЖИЙН хязгаар ажиллана', first429 > 0,
    first429 ? '' : 'CAP+6 хүсэлтэд ч 429 гарсангүй — SQL ажиллуулсан уу?');
  ok('хязгаар зөв тоон дээр ажиллана (CAP+1 = ' + (CAP_DEV + 1) + ')',
    first429 === CAP_DEV + 1, 'бодит: ' + (first429 || 'хэзээ ч'));
  ok('429 нь ямар хязгаар болохыг хэлнэ', scope === 'device', 'scope=' + scope);

  // Нэг ангийн ӨӨР сурагч БЛОКЛОГДОХГҮЙ (ижил IP, өөр төхөөрөмж)
  const other = await hit('zq-other-' + Date.now().toString(36));
  ok('ӨӨР төхөөрөмж ижил сүлжээнээс чөлөөтэй (ангийн Wi-Fi)',
    other.status === 400, 'status=' + other.status + ' ' + JSON.stringify(other.body));

  console.log('');
  console.log('─'.repeat(50));
  console.log('цэвэр: ' + pass + '   унасан: ' + fail);
  if (fail) {
    console.log('');
    console.log('Хязгаар ажиллаагүй бол: Supabase -> SQL Editor -> ');
    console.log('SUPABASE.sql-ийн «ЯРИАНЫ ҮНЭЛГЭЭНИЙ КВОТ» хэсгийг ажиллуул.');
  }
  process.exit(fail ? 1 : 0);
})();
