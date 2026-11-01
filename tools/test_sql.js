/* SUPABASE.sql-ийн ангийн логикийг БОДИТ Postgres дээр шалгана.
 *
 * Ажиллуулах:
 *   npm install --prefix tools/_pg @electric-sql/pglite@0.3   (нэг удаа)
 *   node tools/test_sql.js
 *
 * Яагаад PGlite: Supabase-ийн схемийг гараар SQL Editor-т ажиллуулдаг
 * тул алдаа нь хэрэглэгчийн өмнө л илэрдэг байв. PGlite нь WASM-д
 * хөрвүүлсэн ЖИНХЭНЭ Postgres (plpgsql, jsonb, RLS, security definer
 * бүгд) — сүлжээ, сервер хэрэггүй.
 *
 * Анхаар: PGlite-ийн анхдагч хэрэглэгч нь SUPERUSER — RLS-ийг ТОЙРНО.
 * Тиймээс «шууд хандалт хаалттай» шалгалтыг `set role anon` дор хийнэ.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let PGlite;
for (const p of [path.join(__dirname, '_pg', 'node_modules', '@electric-sql', 'pglite'),
                 '@electric-sql/pglite']) {
  try { ({ PGlite } = require(p)); break; } catch (e) { /* дараагийнх */ }
}
if (!PGlite) {
  console.error('PGlite олдсонгүй: npm install --prefix tools/_pg @electric-sql/pglite@0.3');
  process.exit(2);
}

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, info) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; fails.push(name); console.log('  FAIL ' + name + (info ? '  — ' + info : '')); }
}

async function main() {
  const db = new PGlite();
  // Supabase-д байдаг хоёр үүрэг. SQL нь `grant ... to anon` хийдэг.
  await db.exec("create role anon nologin; create role authenticated nologin; " +
    // Edge Function (ярианы үнэлгээ) нь ҮҮГЭЭР дуудна. Үүнгүй бол
    // `grant … to service_role` мөр унаж, бүтэн SQL ажиллахгүй.
    "create role service_role nologin;");
  // Supabase нь public схемийн ШИНЭ хүснэгтэд anon-д SELECT/INSERT/…
  // эрхийг АНХДАГЧААР өгдөг. Хамгаалалт нь зөвхөн RLS-д тулгуурладаг —
  // тиймээс тэр нөхцлийг ЯГ дуурайна, эс тэгвэл RLS-гүй ч тест тэнцэнэ.
  /* `authenticated`-д ч эрхийг өгнө: Supabase нь public схемийн шинэ
     хүснэгтэд ХОЁР үүрэгт анхдагчаар эрх өгдөг. Үүнгүй бол «шууд
     бичилт няцаагдав» гэсэн шалгуур RLS-ийн ачаар БИШ, зүгээр л
     эрхгүйн улмаас тэнцэж, хуурамч баталгаа гарах байв. */
  /* ФУНКЦЭД ч default privileges — Supabase нь `public` схемийн ШИНЭ
     функцэд `anon`/`authenticated`-д эрхийг ТУСГАЙЛАН өгдөг. Үүнгүй бол
     `revoke all … from public` нь эрхийг хассан ГЭЖ харагдаж, «anon
     дуудаж чадахгүй» гэсэн шалгуур хуурамчаар тэнцэнэ. Амьд серверт
     `judge_gate` нь ийм учраас нээлттэй байв. */
  await db.exec("grant usage on schema public to anon, authenticated; " +
    "alter default privileges in schema public grant all on tables to anon, authenticated; " +
    "alter default privileges in schema public grant all on functions to anon, authenticated;");

  /* Supabase-ийн `auth` схемийн ЖИЖИГ дуураймал. PGlite нь цэвэр
     Postgres тул `auth.users` ба `auth.uid()` байхгүй — тэднийг
     хэрэглэдэг `koto_user` хэсэг унах байв.

     `auth.uid()` нь бодитоор JWT-ийн `sub`-ыг уншдаг. Дуураймал нь
     ИЖИЛ GUC-ээс (`request.jwt.claim.sub`) уншина, тиймээс тестэд
     `set request.jwt.claim.sub = '<uuid>'` гэж хэрэглэгч сэлгэж болно.
     Хоосон бол null — яг нэвтрээгүй үеийн зан төлөв. */
  await db.exec(
    "create schema if not exists auth;" +
    "create table if not exists auth.users (id uuid primary key);" +
    "create or replace function auth.uid() returns uuid language sql stable as $$" +
    "  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;" +
    "grant usage on schema auth to anon, authenticated;");

  const sql = fs.readFileSync(path.join(ROOT, 'SUPABASE.sql'), 'utf8');
  const q1 = (s, p) => db.query(s, p).then(r => r.rows);
  const one = async (s, p) => (await q1(s, p))[0];

  console.log('\n[1] Бүтэн SUPABASE.sql — хоёр удаа (давтагдахад тэсвэртэй)');
  let e1 = null, e2 = null;
  try { await db.exec(sql); } catch (e) { e1 = e.message; }
  ok('эхний ажиллуулалт алдаагүй', !e1, e1);
  try { await db.exec(sql); } catch (e) { e2 = e.message; }
  ok('ХОЁР ДАХЬ ажиллуулалт алдаагүй', !e2, e2);

  // ТЕСТИЙН код — жинхэнэ код энд БИЧИГДЭХГҮЙ.
  await db.exec("insert into public.classes (id, name, code, sort) values " +
    "('mica','MICA','5173',1), ('c2','2-р анги','8264',2);");

  const join = (c, k) => one('select public.class_join($1,$2) as s', [c, k]).then(r => r.s);
  const put = (m, n, cls, extra) => one(
    'select public.member_put($1,$2,$3::jsonb,$4,$5,$6,$7,$8) as r',
    [m, n, JSON.stringify(cls)].concat(extra || [0, 0, 0, 0, null])).then(r => r.r);
  const roster = (c, k, m) => one('select public.class_roster($1,$2,$3) as r', [c, k, m || null]).then(r => r.r);
  const resetFails = () => db.exec("update public.classes set fails = 0, fail_from = now()");

  console.log('\n[2] class_list — нэр л, код ГАРАХГҮЙ');
  const list = (await one('select public.class_list() as l')).l;
  ok('хоёр анги, эрэмбээрээ', list.length === 2 && list[0].id === 'mica' && list[1].id === 'c2',
    JSON.stringify(list));
  ok('КОД буцахгүй', !JSON.stringify(list).includes('5173') && list.every(x => !('code' in x)),
    JSON.stringify(list));

  console.log('\n[3] class_join');
  ok('зөв код -> ok', await join('mica', '5173') === 'ok');
  ok('буруу код -> bad', await join('mica', '0000') === 'bad');
  ok('хоосон код -> bad', await join('mica', '') === 'bad');
  ok('null код -> bad', await join('mica', null) === 'bad');
  ok('зай бүхий зөв код -> ok (btrim)', await join('mica', ' 5173 ') === 'ok');
  ok('байхгүй анги -> none', await join('zzz', '5173') === 'none');
  ok('нэг ангийн код нөгөөд ХҮЧИНГҮЙ', await join('c2', '5173') === 'bad');
  await resetFails();

  console.log('\n[4] member_put — гишүүнчлэл');
  let r = await put('memberAAAA01', 'Бат', { mica: '5173' }, [12, 3, 5, 2, 20000]);
  ok('зөв кодоор бүртгэгдэнэ', r.mica === 'ok', JSON.stringify(r));
  let row = await one("select * from public.members where member='memberAAAA01'");
  ok('мөр үүссэн, нэр/тоо зөв', row && row.name === 'Бат' && row.seen === 12 &&
    row.learned === 3 && row.today === 5 && row.streak === 2 && row.day === 20000,
    JSON.stringify(row));
  ok('ангиуд = {mica}', row && JSON.stringify(row.classes) === '["mica"]', JSON.stringify(row && row.classes));

  r = await put('memberAAAA01', 'Бат', { mica: '5173', c2: '9999' });
  row = await one("select * from public.members where member='memberAAAA01'");
  ok('нэг нь буруу код -> ЗӨВХӨН зөв анги хадгалагдана',
    r.mica === 'ok' && r.c2 === 'bad' && JSON.stringify(row.classes) === '["mica"]',
    JSON.stringify(r) + ' ' + JSON.stringify(row.classes));

  r = await put('memberAAAA01', 'Бат', { mica: '5173', c2: '8264' });
  row = await one("select * from public.members where member='memberAAAA01'");
  ok('ХОЁР ангид зэрэг', row.classes.length === 2 &&
    row.classes.includes('mica') && row.classes.includes('c2'), JSON.stringify(row.classes));

  r = await put('memberAAAA01', 'Бат', {});
  row = await one("select * from public.members where member='memberAAAA01'");
  ok('«Бусад» (ангигүй) -> НЭР серверээс УСТАНА', !row, JSON.stringify(row));

  r = await put('memberAAAA01', '   ', { mica: '5173' });
  row = await one("select * from public.members where member='memberAAAA01'");
  ok('хоосон нэр -> хадгалахгүй', !row, JSON.stringify(row));

  await put('memberAAAA01', 'Х'.repeat(90), { mica: '5173' }, [-5, 5000000, -1, 7, 1]);
  row = await one("select * from public.members where member='memberAAAA01'");
  ok('нэр 40 тэмдэгтээр таслагдана', row && row.name.length === 40, row && row.name.length);
  ok('тоо хязгаарлагдана (сөрөг -> 0, их -> дээд)',
    row && row.seen === 0 && row.learned === 1000000 && row.today === 0,
    JSON.stringify(row));
  // int32-оос ИХ тоо нь функцэд хүрэхээс ӨМНӨ төрлийн шалгалтаар
  // няцаагдана (PostgREST 400 буцаана). Юу ч бичигдэхгүй байх ёстой.
  let big = 'ok';
  try { await put('memberBIG0001', 'Том', { mica: '5173' }, [0, 9e9, 0, 0, 1]); }
  catch (e) { big = e.code || 'ERR'; }
  row = await one("select * from public.members where member='memberBIG0001'");
  ok('int32-оос их тоо -> АЛДАА, мөр үүсэхгүй', big === '22003' && !row, big);

  r = await put('short', 'Бат', { mica: '5173' });
  ok('богино member id няцаагдана', r && r.error === 'bad member', JSON.stringify(r));
  r = await put('memberBBBB02', 'Болд', 'not an object');
  row = await one("select * from public.members where member='memberBBBB02'");
  ok('p_classes объект биш -> хадгалахгүй', !row, JSON.stringify(r));
  await resetFails();

  console.log('\n[5] class_roster');
  await db.exec("delete from public.members");
  await put('memberAAAA01', 'Бат',  { mica: '5173' }, [10, 2, 3, 1, 20000]);
  await put('memberBBBB02', 'Болд', { mica: '5173' }, [30, 9, 0, 0, 19990]);
  await put('memberCCCC03', 'Цэцэг', { c2: '8264' }, [50, 20, 8, 4, 20000]);

  let ro = await roster('mica', '0000', 'memberAAAA01');
  ok('буруу код -> гишүүн ГАРАХГҮЙ', ro.status === 'bad' && !ro.rows, JSON.stringify(ro));
  ro = await roster('mica', '5173', 'memberAAAA01');
  ok('зөв код -> ok', ro.status === 'ok' && ro.name === 'MICA', JSON.stringify(ro));
  ok('ЗӨВХӨН тухайн ангийн гишүүд (2)', ro.rows.length === 2 &&
    !ro.rows.some(x => x.name === 'Цэцэг'), JSON.stringify(ro.rows));
  ok('тогтсоноор эрэмбэлэгдсэн', ro.rows[0].name === 'Болд' && ro.rows[1].name === 'Бат',
    JSON.stringify(ro.rows));
  ok('«me» зөвхөн өөрийн мөрөнд', ro.rows.filter(x => x.me).length === 1 &&
    ro.rows.find(x => x.me).name === 'Бат', JSON.stringify(ro.rows));
  ok('бусдын member id БУЦАХГҮЙ', !JSON.stringify(ro).includes('memberBBBB02') &&
    ro.rows.every(x => !('member' in x)), JSON.stringify(ro));
  ok('ангийн КОД буцахгүй', !JSON.stringify(ro).includes('5173'));
  ro = await roster('mica', '5173');
  ok('member-гүй дуудалтад «me» нэг ч үгүй', ro.rows.every(x => !x.me), JSON.stringify(ro.rows));
  await resetFails();

  console.log('\n[6] Таах оролдлогын хязгаар — цагт 50');
  for (let i = 0; i < 50; i++) await join('mica', String(1000 + i));
  ok('50 буруугийн дараа -> locked', await join('mica', '1999') === 'locked');
  ok('түгжигдсэн үед ЗӨВ код ч -> locked', await join('mica', '5173') === 'locked');
  ro = await roster('mica', '5173', 'memberAAAA01');
  ok('түгжигдсэн үед roster гишүүн гаргахгүй', ro.status === 'locked' && !ro.rows, JSON.stringify(ro));
  r = await put('memberAAAA01', 'Бат', { mica: '5173' });
  ok('түгжигдсэн үед member_put бүртгэхгүй', r.mica === 'locked', JSON.stringify(r));
  ok('НӨГӨӨ анги түгжигдээгүй', await join('c2', '8264') === 'ok');
  await db.exec("update public.classes set fail_from = now() - interval '2 hours' where id='mica'");
  ok('1 цагийн дараа -> дахин ok', await join('mica', '5173') === 'ok');
  const f = await one("select fails from public.classes where id='mica'");
  ok('цонх солигдоход тоолуур 0', f.fails === 0, JSON.stringify(f));
  await resetFails();

  console.log('\n[7] Анги тутамд 200 гишүүн');
  await db.exec("delete from public.members");
  await db.exec("insert into public.members (member, name, classes) " +
    "select 'fake' || lpad(g::text, 8, '0'), 'x', '{mica}' from generate_series(1, 200) g");
  r = await put('memberNEW0001', 'Шинэ', { mica: '5173' });
  row = await one("select * from public.members where member='memberNEW0001'");
  ok('201 дэх гишүүн -> full, бүртгэгдэхгүй', r.mica === 'full' && !row, JSON.stringify(r));
  r = await put('fake00000001', 'x2', { mica: '5173' });
  ok('БАЙГАА гишүүн шинэчлэгдэнэ (өөрийгөө тоолохгүй)', r.mica === 'ok', JSON.stringify(r));
  await db.exec("delete from public.members");
  await resetFails();

  console.log('\n[9] Даалгавар — L1–L8-аас 20 өөр асуулт');
  await db.exec("delete from public.members");
  await db.exec(`update public.classes set task =
    '{"lessons":[1,2,3,4,5,6,7,8],"n":20,"since":"2026-09-22"}' where id = 'mica'`);
  const D0 = (await one("select ('2026-09-22'::date - '1970-01-01'::date) as d")).d;
  const putEx = (m, n, cls, exam) => one(
    'select public.member_put($1,$2,$3::jsonb,0,0,0,0,$4,$5::jsonb) as r',
    [m, n, JSON.stringify(cls), D0, exam === null ? null : JSON.stringify(exam)]).then(r => r.r);

  const cl = (await one('select public.class_list() as l')).l;
  ok('class_list даалгаврыг буцаана (MICA-д, Наран-д үгүй)',
    cl.find(c => c.id === 'mica').task && cl.find(c => c.id === 'mica').task.n === 20
      && cl.find(c => c.id === 'c2').task === null, JSON.stringify(cl));

  await putEx('memberT00001', 'Бат', { mica: '5173', c2: '8264' }, {
    'S01-01': [D0, 1, 1],          // тоологдоно, чадсан
    'S03-02': [D0 + 1, 0, 3],      // тоологдоно, чадаагүй
    'S08-05': [D0, 1, 8],          // тоологдоно, чадсан (L8 — хил)
    'S02-01': [D0 - 1, 1, 2],      // since-ээс ӨМНӨ — тоологдохгүй
    'S09-01': [D0, 1, 9],          // L9 — даалгаварт хамаарахгүй
    'bad key!': [D0, 1, 1],        // буруу түлхүүр — хаягдана
    'S04-01': 'not an array',      // буруу утга — хаягдана
    'S05-01': ['x', 'y', 'z'],     // тоо биш — 0 болно (L0 тул тоологдохгүй)
  });
  await putEx('memberT00002', 'Болд', { mica: '5173' }, {});
  ro = await roster('mica', '5173', 'memberT00001');
  const rb = ro.rows.find(x => x.name === 'Бат'), rd = ro.rows.find(x => x.name === 'Болд');
  ok('roster даалгаврыг буцаана', ro.task && ro.task.n === 20, JSON.stringify(ro.task));
  ok('task_n = 3 (since-ээс өмнөх, L9, буруу мөр ТООЛОГДОХГҮЙ)', rb && rb.task_n === 3, JSON.stringify(rb));
  ok('task_ok = 2 (чадсан)', rb && rb.task_ok === 2, JSON.stringify(rb));
  ok('хариулаагүй гишүүн -> 0', rd && rd.task_n === 0 && rd.task_ok === 0, JSON.stringify(rd));
  ok('ТҮҮХИЙ хариулт roster-д БУЦАХГҮЙ (ангийнхан бие биеийн хариултыг харахгүй)',
    !JSON.stringify(ro).includes('S01-01') && ro.rows.every(x => !('exam' in x)), JSON.stringify(ro));
  const stored = (await one("select exam from public.members where member='memberT00001'")).exam;
  ok('буруу түлхүүр/утга ХАДГАЛАГДААГҮЙ', !('bad key!' in stored) && !('S04-01' in stored),
    JSON.stringify(stored));
  ok('тоо биш утга 0 болж хадгалагдсан', JSON.stringify(stored['S05-01']) === '[0,0,0]',
    JSON.stringify(stored['S05-01']));

  ro = await roster('c2', '8264', 'memberT00001');
  ok('даалгаваргүй анги -> task null, task_n null', ro.task === null &&
    ro.rows.every(x => x.task_n === null), JSON.stringify(ro));

  // Хуучин клиент (p_exam илгээхгүй) — байгаа хариултыг ДАРЖ БИЧИХГҮЙ
  await one("select public.member_put('memberT00001','Бат','{\"mica\":\"5173\"}'::jsonb,1,1,1,1,1) as r");
  ro = await roster('mica', '5173', 'memberT00001');
  ok('хуучин клиентын дуудлага (8 параметр) хариултыг УСТГАХГҮЙ',
    ro.rows.find(x => x.name === 'Бат').task_n === 3, JSON.stringify(ro.rows));

  // 600-аас олон түлхүүр -> 600 л. Хязгаар нь SUPABASE.sql-ийн `limit 600`
  // (入門 180 + 初級1 180 + 初級2 180 = 540 + зай). Тэр тоог сольвол ЭНД ч зас.
  const many = {};
  for (let i = 0; i < 700; i++) many['Q' + i] = [D0, 1, 1];
  await putEx('memberT00003', 'Их', { mica: '5173' }, many);
  const cnt = (await one("select (select count(*) from jsonb_object_keys(exam)) as n from public.members where member='memberT00003'")).n;
  ok('хариулт 600 хүртэл хязгаарлагдана', Number(cnt) === 600, String(cnt));
  // Хэт их өдөр/хичээл -> хязгаарлагдана, алдаа өгөхгүй
  await putEx('memberT00004', 'Хэт', { mica: '5173' }, { S01: [9e15, 5, 9e15] });
  const hx = (await one("select exam from public.members where member='memberT00004'")).exam;
  ok('хэт их тоо -> хязгаарлагдана (алдаагүй)', JSON.stringify(hx.S01) === '[100000,1,100]',
    JSON.stringify(hx));

  const fns = (await one("select count(*) as n from pg_proc where proname = 'member_put'")).n;
  ok('member_put ГАНЦ хувилбартай (хуучин гарын үсэг устсан)', Number(fns) === 1, String(fns));
  await db.exec("delete from public.members");
  await resetFails();

  console.log('\n[12] Шалгалтын хариулт — ДАРЖ БИЧИХГҮЙ, УУСГАНА');
  /* Утас, компьютер нэг мөр хуваалцдаг ба хариултын түүх нь төхөөрөмж
     тус бүрд байдаг. Дарж бичвэл нөгөө дээрээ хийсэн ажил АЛГА БОЛНО
     (бодит тохиолдол: компьютер дээр 20 хийсэн, утас 0-оор дарсан). */
  await db.exec("delete from public.members");
  const D1 = (await one("select ('2026-09-22'::date - '1970-01-01'::date) as d")).d;
  let mx = await putEx('memberX00001', 'Бат', { mica: '5173' },
    { A1: [D1, 1, 1], A2: [D1, 1, 2] });
  ok('эхний төхөөрөмжийн хариулт хадгалагдана',
    Object.keys(mx.exam || {}).length === 2, JSON.stringify(mx.exam));
  // Хоёр дахь төхөөрөмж ХООСОН түүхтэй — хуучныг устгах ЁСГҮЙ
  mx = await putEx('memberX00001', 'Бат', { mica: '5173' }, {});
  let ex = (await one("select exam from public.members where member='memberX00001'")).exam;
  ok('ХООСОН түүхтэй төхөөрөмж хуучныг УСТГАХГҮЙ',
    Object.keys(ex).length === 2, JSON.stringify(ex));
  ok('уусгасан хариултыг клиентэд БУЦААНА',
    mx.exam && Object.keys(mx.exam).length === 2, JSON.stringify(mx.exam));
  // Өөр асуулт хийсэн төхөөрөмж — НЭГДЭНЭ
  await putEx('memberX00001', 'Бат', { mica: '5173' }, { A3: [D1, 1, 3] });
  ex = (await one("select exam from public.members where member='memberX00001'")).exam;
  ok('өөр асуулт хийсэн төхөөрөмж НЭМЭГДЭНЭ (3)',
    Object.keys(ex).sort().join() === 'A1,A2,A3', JSON.stringify(ex));
  // Ижил асуулт — СҮҮЛИЙН өдрийнх ялна
  await putEx('memberX00001', 'Бат', { mica: '5173' }, { A1: [D1 + 2, 0, 1] });
  ex = (await one("select exam from public.members where member='memberX00001'")).exam;
  ok('ижил асуултад СҮҮЛИЙН өдрийн хариулт ялна',
    JSON.stringify(ex.A1) === JSON.stringify([D1 + 2, 0, 1]), JSON.stringify(ex.A1));
  await putEx('memberX00001', 'Бат', { mica: '5173' }, { A1: [D1 - 5, 1, 1] });
  ex = (await one("select exam from public.members where member='memberX00001'")).exam;
  ok('ХУУЧИН өдрийн хариулт шинийг дарахгүй',
    JSON.stringify(ex.A1) === JSON.stringify([D1 + 2, 0, 1]), JSON.stringify(ex.A1));
  // «Явцыг устгах» (p_wipe) — УУСГАХГҮЙ, дарж бичнэ
  const wipe = (m, n, cls, exam) => one(
    'select public.member_put($1,$2,$3::jsonb,0,0,0,0,null,$4::jsonb,0,true) as r',
    [m, n, JSON.stringify(cls), JSON.stringify(exam)]).then(r => r.r);
  await wipe('memberX00001', 'Бат', { mica: '5173' }, {});
  ex = (await one("select exam from public.members where member='memberX00001'")).exam;
  ok('«Явцыг устгах» -> хариулт СЕРВЕРЭЭС ч устана',
    Object.keys(ex).length === 0, JSON.stringify(ex));
  await putEx('memberX00001', 'Бат', { mica: '5173' }, { B1: [D1, 1, 1] });
  ex = (await one("select exam from public.members where member='memberX00001'")).exam;
  ok('устгасны дараа дахин хуримтлагдана', Object.keys(ex).join() === 'B1', JSON.stringify(ex));

  // Хуучин клиент (p_exam = null) — огт хөндөхгүй
  await one("select public.member_put('memberX00001','Бат','{\"mica\":\"5173\"}'::jsonb,1,1,1,1,1) as r");
  ex = (await one("select exam from public.members where member='memberX00001'")).exam;
  ok('хуучин клиент (p_exam null) хариултыг хөндөхгүй',
    Object.keys(ex).join() === 'B1', JSON.stringify(ex));
  await db.exec("delete from public.members");
  await resetFails();

  console.log('\n[13] Даалгаврын ТӨРӨЛ — асуулт · үг · ханз');
  await db.exec("delete from public.members");
  await db.exec("update public.classes set tcode = '246802' where id = 'mica'");
  const tset2 = (c, code, les, n, days, since, kind, src) => one(
    'select public.task_set($1,$2,$3::jsonb,$4,$5,$6,$7,$8) as r',
    [c, code, JSON.stringify(les), n, days, since, kind, src]).then(r => r.r);

  let tk3 = await tset2('mica', '246802', [1, 2], 20, 7, '2026-09-20', 'word', 'n5');
  ok('төрөл ба эх сурвалж хадгалагдана',
    tk3.task.kind === 'word' && tk3.task.src === 'n5', JSON.stringify(tk3.task));
  ok('task_set хурууны хээг буцаана', /^[0-9a-f]{32}$/.test(tk3.task_v || ''), tk3.task_v);
  const V = tk3.task_v;
  const cl3 = (await one('select public.class_list() as l')).l;
  ok('class_list хурууны хээг буцаана',
    cl3.find(c => c.id === 'mica').task_v === V, JSON.stringify(cl3[0]));

  // Үг/ханзны тоог КЛИЕНТ илгээнэ
  const putT = (m, tasks) => one(
    'select public.member_put($1,$2,$3::jsonb,0,0,0,0,null,null,0,false,$4::jsonb) as r',
    [m, 'Бат', JSON.stringify({ mica: '5173' }), JSON.stringify(tasks)]).then(r => r.r);
  await putT('memberK00001', { mica: { n: 12, v: V } });
  let ro3 = await roster('mica', '5173', 'memberK00001');
  ok('клиентийн илгээсэн тоо жагсаалтад гарна',
    ro3.rows[0].task_n === 12 && ro3.rows[0].task_ok === null, JSON.stringify(ro3.rows[0]));

  // Багш даалгавраа СОЛИВОЛ хуучин тоо ХҮЧИНГҮЙ
  const tk4 = await tset2('mica', '246802', [1, 2, 3], 20, 7, '2026-09-20', 'word', 'n5');
  ro3 = await roster('mica', '5173', 'memberK00001');
  ok('даалгавар солигдвол хуучин тоо ХҮЧИНГҮЙ (null)',
    tk4.task_v !== V && ro3.rows[0].task_n === null, JSON.stringify(ro3.rows[0]));
  await putT('memberK00001', { mica: { n: 3, v: tk4.task_v } });
  ro3 = await roster('mica', '5173', 'memberK00001');
  ok('шинэ хээтэй тоо дахин гарна', ro3.rows[0].task_n === 3, JSON.stringify(ro3.rows[0]));

  // ШАЛГАЛТЫН даалгаварт сервер өөрөө боддог
  await tset2('mica', '246802', [1], 20, 7, '2026-09-20', 'exam', 'book');
  ro3 = await roster('mica', '5173', 'memberK00001');
  ok('шалгалтын төрөлд СЕРВЕР боддог (клиентийн тоо хэрэглэгдэхгүй)',
    ro3.rows[0].task_n === 0, JSON.stringify(ro3.rows[0]));

  const bad3 = await tset2('mica', '246802', [1], 20, 7, '2026-09-20', 'zzz', 'zzz');
  ok('буруу төрөл/эх сурвалж -> exam/book',
    bad3.task.kind === 'exam' && bad3.task.src === 'book', JSON.stringify(bad3.task));
  await db.exec("delete from public.members");
  await db.exec("update public.classes set task = null");
  await resetFails();


  console.log('\n[11] Нэр нийлүүлэх — хамгийн СҮҮЛД ЗАССАН нь ялна');
  await db.exec("delete from public.members");
  const putN = (m, n, at) => one(
    'select public.member_put($1,$2,$3::jsonb,0,0,0,0,null,null,$4) as r',
    [m, n, JSON.stringify({ mica: '5173' }), at]).then(r => r.r);

  let n1 = await putN('memberN00001', 'Өлзийбаяр', 1000);
  ok('эхний бичилт — нэр хадгалагдаж БУЦААНА',
    n1.name === 'Өлзийбаяр' && n1.mica === 'ok', JSON.stringify(n1));
  n1 = await putN('memberN00001', 'Admin', 500);
  ok('ХУУЧИН засвар (бага `name_at`) дарж бичихгүй; шинэ нэрийг буцаана',
    n1.name === 'Өлзийбаяр', JSON.stringify(n1));
  n1 = await putN('memberN00001', 'Admin', 2000);
  ok('ШИНЭ засвар дарна', n1.name === 'Admin', JSON.stringify(n1));
  n1 = await putN('memberN00001', 'Хуучин апп', 0);
  ok('ХУУЧИН клиент (name_at = 0) хэзээ ч дарахгүй', n1.name === 'Admin', JSON.stringify(n1));
  // Хуучин гарын үсэг (10 биш 9 параметр) УСТСАН — хоёр функц зэрэгцвэл
  // PostgREST аль нь гэдгийг ялгаж чадахгүй.
  const fn2 = (await one("select count(*) as n from pg_proc where proname = 'member_put'")).n;
  ok('member_put ганц хувилбартай хэвээр', Number(fn2) === 1, String(fn2));
  const nat = (await one("select name_at from public.members where member='memberN00001'")).name_at;
  ok('`name_at` нь ХАМГИЙН ИХ утгыг барина', Number(nat) === 2000, String(nat));
  await db.exec("delete from public.members");
  await resetFails();

  console.log('\n[10] Багш — тусдаа код, даалгавар тавих, ХУГАЦАА');
  await db.exec("delete from public.members");
  await db.exec("update public.classes set tcode = '246802' where id = 'mica'");
  await db.exec("update public.classes set tcode = null, task = null where id = 'c2'");
  const tset = (c, code, les, n, days, since) => one(
    'select public.task_set($1,$2,$3::jsonb,$4,$5,$6) as r',
    [c, code, les === null ? null : JSON.stringify(les), n, days, since || null]).then(r => r.r);

  ok('багшийн код -> «teacher» (сурагчийнхаас ӨӨР)',
    await join('mica', '246802') === 'teacher' && await join('mica', '5173') === 'ok');
  ok('багшийн код НӨГӨӨ ангид хүчингүй', await join('c2', '246802') === 'bad');
  await resetFails();

  let t = await tset('mica', '5173', [1, 2], 20, 3);
  ok('СУРАГЧИЙН кодоор даалгавар тавьж ЧАДАХГҮЙ («denied», бичигдэхгүй)',
    t.status === 'denied' && !t.task, JSON.stringify(t));
  t = await tset('mica', '0000', [1, 2], 20, 3);
  ok('буруу кодоор тавьж чадахгүй', t.status === 'bad', JSON.stringify(t));
  await resetFails();

  t = await tset('mica', '246802', [3, 1, 2, 2, 999, 0], 20, 3, '2026-09-20');
  ok('багш даалгавар тавина; хичээл цэгцлэгдэж давхардал арилна',
    t.status === 'ok' && JSON.stringify(t.task.lessons) === '[1,2,3]', JSON.stringify(t));
  ok('хугацаа: until = since + days', t.task.since === '2026-09-20' &&
    t.task.until === '2026-09-23' && t.task.days === 3, JSON.stringify(t.task));
  t = await tset('mica', '246802', [1], 9999, 9999, 'муу огноо');
  ok('тоо ба хоног хязгаарлагдана, буруу огноо -> өнөөдөр',
    t.task.n === 100 && t.task.days === 60 && /^\d{4}-\d{2}-\d{2}$/.test(t.task.since),
    JSON.stringify(t.task));

  // Хугацааны цонх: since..until
  await db.exec("update public.classes set task = " +
    "'{\"lessons\":[1],\"n\":20,\"since\":\"2026-09-20\",\"until\":\"2026-09-23\",\"days\":3}' " +
    "where id = 'mica'");
  const D = async iso => (await one("select ($1::date - '1970-01-01'::date) as d", [iso])).d;
  const [dIn, dBefore, dAfter, dLast] =
    [await D('2026-09-21'), await D('2026-09-19'), await D('2026-09-24'), await D('2026-09-23')];
  await putEx('memberW00001', 'Цаг', { mica: '5173' }, {
    'A1': [dIn, 1, 1],        // хугацаанд — тоологдоно
    'A2': [dLast, 1, 1],      // ЯГ сүүлийн өдөр — тоологдоно
    'A3': [dBefore, 1, 1],    // эхлэхээс өмнө — үгүй
    'A4': [dAfter, 1, 1],     // ДУУССАНЫ дараа — үгүй
  });
  ro = await roster('mica', '5173', 'memberW00001');
  ok('хугацаанд багтсан хариулт л тоологдоно (2)',
    ro.rows[0].task_n === 2, JSON.stringify(ro.rows[0]));
  ro = await roster('mica', '246802', null);
  ok('БАГШ жагсаалтыг харна', ro.status === 'ok' && ro.role === 'teacher' && ro.rows.length === 1,
    JSON.stringify({ s: ro.status, r: ro.role, n: ro.rows.length }));
  ro = await roster('mica', '5173', 'memberW00001');
  ok('сурагчийн role = ok', ro.role === 'ok', JSON.stringify(ro.role));

  // Багш ЖАГСААЛТАД ОРОХГҮЙ: багшийн кодоор гишүүн үүсэхгүй
  let rr = await putEx('memberTEACH01', 'Багш', { mica: '246802' }, {});
  const trow = await one("select * from public.members where member='memberTEACH01'");
  ok('багшийн кодоор ГИШҮҮН үүсэхгүй (жагсаалтад гарахгүй)',
    rr.mica === 'teacher' && !trow, JSON.stringify(rr));

  t = await tset('mica', '246802', [], 20, 3);
  const tk2 = (await one("select task from public.classes where id='mica'")).task;
  ok('хоосон хичээл -> даалгавар УСТАНА', t.status === 'ok' && tk2 === null, JSON.stringify(t));
  await db.exec("delete from public.members");
  await resetFails();

  console.log('\n[8] anon эрх — хүснэгт рүү ШУУД хандах ХААЛТТАЙ');
  await put('memberAAAA01', 'Бат', { mica: '5173' });
  await db.exec('set role anon');
  const direct = async s => { try { return (await q1(s)).length; } catch (e) { return 'ERR:' + e.message.slice(0, 40); } };
  const m1 = await direct('select * from public.members');
  const c1 = await direct('select * from public.classes');
  ok('anon: members шууд SELECT -> 0 мөр', m1 === 0, String(m1));
  ok('anon: classes шууд SELECT -> 0 мөр (КОД задрахгүй)', c1 === 0, String(c1));
  let upd = 'ok';
  try { await db.exec("update public.classes set code='0000'"); } catch (e) { upd = 'ERR'; }
  const back = await (async () => { await db.exec('reset role'); return one("select code from public.classes where id='mica'"); })();
  ok('anon: кодыг шууд СОЛИЖ чадахгүй', back.code === '5173', JSON.stringify(back) + ' ' + upd);
  await db.exec('set role anon');
  let rpcOk = null;
  try { rpcOk = (await one("select public.class_join('mica','5173') as s")).s; } catch (e) { rpcOk = 'ERR:' + e.message; }
  ok('anon: class_join RPC дуудаж чадна', rpcOk === 'ok', rpcOk);
  let rosterOk = null;
  try { rosterOk = (await one("select public.class_roster('mica','5173') as r")).r.status; } catch (e) { rosterOk = 'ERR:' + e.message; }
  ok('anon: class_roster RPC дуудаж чадна', rosterOk === 'ok', rosterOk);
  await db.exec('reset role');
  await db.exec('set role authenticated');
  let authCall = 'ok';
  try { await one("select public.class_join('mica','5173') as s"); } catch (e) { authCall = 'denied'; }
  ok('эрх олгоогүй үүрэг функцийг дуудаж чадахгүй (revoke from public)', authCall === 'denied', authCall);
  await db.exec('reset role');

  console.log('\n[9] Ярианы үнэлгээний квот — judge_bump');
  /* Санах ойн тоолуур АЖИЛЛАХГҮЙ байсан (Deno Deploy олон изолят) тул
     тоолуур өгөгдлийн санд шилжсэн. Энд логикийг нь шалгана. */
  const bump = async (k, cap) =>
    (await one("select public.judge_bump('" + k + "', " + cap + ") as b")).b;

  let over = null;
  for (let i = 1; i <= 3; i++) over = await bump('d:zz1', 3);
  ok('хязгаарын ДОТОР -> false', over === false, JSON.stringify(over));
  ok('хязгаараас ХЭТРЭХЭД -> true', (await bump('d:zz1', 3)) === true, '4 дэх дуудалт');
  ok('хэтэрсний дараа ч true хэвээр', (await bump('d:zz1', 3)) === true, '5 дахь');

  // Өөр төхөөрөмж НӨЛӨӨЛӨХГҮЙ — нэг ангийн 200 сурагч нэг Wi-Fi дээр
  ok('ӨӨР түлхүүр тусдаа тоологдоно', (await bump('d:zz2', 3)) === false, 'zz2');

  // Цонх дуусахад ТЭГЛЭГДЭНЭ
  await db.exec("update public.judge_hits set win = now() - interval '2 hours' where k = 'd:zz1'");
  ok('1 цагийн дараа тоолуур тэглэгдэнэ', (await bump('d:zz1', 3)) === false, 'цонх шинэчлэв');
  const jn = (await one("select n from public.judge_hits where k='d:zz1'")).n;
  ok('тэглэгдсэний дараа тоо = 1', jn === 1, String(jn));

  // Буруу оролт нь ХОРИГЛОХГҮЙ (сурах үйл явц зогсохгүй)
  ok('cap = 0 -> хориглохгүй (буруу оролт)', (await bump('d:zz3', 0)) === false, 'cap 0');
  const longK = 'd:' + 'x'.repeat(80);
  ok('хэт урт түлхүүр -> хориглохгүй', (await bump(longK, 1)) === false, 'урт түлхүүр');

  // judge_gate — хоёр хязгаарыг нэг дуудалтаар
  const gate = async (dev, ip, cd, ci) =>
    (await one("select public.judge_gate('" + dev + "','" + ip + "'," + cd + "," + ci + ") as g")).g;
  ok('чөлөөтэй үед хоосон мөр', (await gate('g1', '1.1.1.1', 5, 9)) === '', 'эхний');
  for (let i = 0; i < 5; i++) await gate('g1', '1.1.1.1', 5, 99);
  ok('ТӨХӨӨРӨМЖ хэтрэхэд -> device', (await gate('g1', '1.1.1.1', 5, 99)) === 'device', 'dev cap');
  ok('ӨӨР төхөөрөмж ижил IP-ээс чөлөөтэй (нэг ангийн Wi-Fi)',
    (await gate('g2', '1.1.1.1', 5, 99)) === '', 'өөр төхөөрөмж');
  for (let i = 0; i < 99; i++) await gate('g3', '2.2.2.2', 999, 40);
  ok('IP-ийн ДЭЭД хаалт ажиллана -> ip', (await gate('g4', '2.2.2.2', 999, 40)) === 'ip', 'ip cap');

  // anon энэ функцийг дуудаж БОЛОХГҮЙ — эс тэгвэл бусдын тоолуурыг
  // үлээлгэж, тэднийг хааж чадна
  await db.exec('set role anon');
  let anonBump = 'ok';
  try { await one("select public.judge_bump('d:zz9', 5) as b"); }
  catch (e) { anonBump = 'denied'; }
  ok('anon: judge_bump дуудаж ЧАДАХГҮЙ', anonBump === 'denied', anonBump);
  let anonGate = 'ok';
  try { await one("select public.judge_gate('x','y',5,9) as g"); }
  catch (e) { anonGate = 'denied'; }
  ok('anon: judge_gate дуудаж ЧАДАХГҮЙ', anonGate === 'denied', anonGate);
  let anonRead = 'ok';
  try {
    const rows = await q1('select * from public.judge_hits');
    anonRead = rows.length === 0 ? 'denied' : 'ХАРАВ:' + rows.length;
  } catch (e) { anonRead = 'denied'; }
  ok('anon: judge_hits хүснэгтийг уншиж ЧАДАХГҮЙ', anonRead === 'denied', anonRead);
  await db.exec('reset role');

  console.log('\n[KOTO] v2-ийн ахицын синк — уусгалт');
  /* Уусгалт нь ХОЁР ТӨХӨӨРӨМЖ дээрх ахицыг алдалгүй нийлүүлэх ёстой.
     Хамгийн хортой алдаа нь дарж бичих: сурагчийн XP, дуусгасан
     хичээл, давталтын хуваарь арилна. */
  const C = 'kototest1234';
  const A = {
    version: 1, xp: 120, completed: ['t0-l0', 't0-l1'],
    // Хэлбэр нь аппын `finishLesson()`-ийнх: passes/weak/due/last.
    // 2026-11-01 хүртэл энд `step` байсан — апп хэзээ ч бичдэггүй талбар
    // тул тест уусгалтын алдааг (STATE №33) хуурамчаар тэнцүүлж байв.
    words: { w1: { passes: 2, weak: false, due: '2026-11-01', last: '2026-10-29' },
             w2: { passes: 0, weak: true,  due: '2026-10-24', last: '2026-10-23' },
             w4: { passes: 3, weak: false, due: '2026-10-29', last: '2026-10-22' },
             w5: { passes: 3, weak: false, due: '2026-11-05', last: '2026-10-29' } },
    days: { '2026-10-23': ['w1', 'w2'] }, selectedTopic: 3,
  };
  const B = {
    version: 1, xp: 80, completed: ['t0-l1', 't0-l2'],
    words: { w1: { passes: 0, weak: true,  due: '2026-10-24', last: '2026-10-23' },
             w3: { passes: 1, weak: false, due: '2026-10-30', last: '2026-10-29' },
             w4: { passes: 1, weak: false, due: '2026-11-02', last: '2026-11-01' },
             w5: { passes: 0, weak: true,  due: '2026-11-02', last: '2026-11-01' } },
    days: { '2026-10-23': ['w3'], '2026-10-24': ['w1'] }, selectedTopic: 7,
  };
  const putK = (c, d) => one('select public.koto_put($1,$2::jsonb) as d', [c, JSON.stringify(d)]);
  const getK = c => one('select public.koto_get($1) as d', [c]);

  const k1 = await putK(C, A);
  ok('KOTO: шинэ код бичигдэв', k1 && k1.d && k1.d.xp === 120, JSON.stringify(k1 && k1.d));
  const k2 = await putK(C, B);
  const m = k2 && k2.d;
  ok('XP — ИХ нь ялна (120 vs 80)', m && m.xp === 120, JSON.stringify(m && m.xp));
  ok('дуусгасан хичээл — НЭГДЭЛ (3 ширхэг)',
    m && Array.isArray(m.completed) && m.completed.length === 3
      && ['t0-l0', 't0-l1', 't0-l2'].every(x => m.completed.includes(x)),
    JSON.stringify(m && m.completed));
  const W = (m && m.words) || {};
  /* w1: B-ийн алдалт ХУУЧИН (10-23), A сүүлд зөв (10-29) -> A-ийн passes 2. */
  ok('үгийн хуваарь — хуучин алдалт шинэ ахицыг ДАРАХГҮЙ (w1 passes 2)',
    W.w1 && W.w1.passes === 2 && W.w1.weak === false, JSON.stringify(W.w1));
  /* w4 = №33-ын яг тохиолдол: A 3 удаа зөв (хугацаа хэтэрсэн), B өнөөдөр
     анх удаа зөв. Хуучин дүрэм `due` хожуугаар B-г авч passes 1 болгодог байв. */
  ok('№33: 3 удаа зөв хариулсан ахиц УХРАХГҮЙ (w4 passes 3, due 11-02)',
    W.w4 && W.w4.passes === 3 && W.w4.due === '2026-11-02' && W.w4.last === '2026-11-01',
    JSON.stringify(W.w4));
  /* w5: A 3 удаа зөв, гэвч B ӨНӨӨДӨР алдсан -> сурагч мартсан, B ялна. */
  ok('саяхан МАРТСАН нь ялна (w5 weak, маргааш давтана)',
    W.w5 && W.w5.weak === true && W.w5.passes === 0 && W.w5.due === '2026-11-02',
    JSON.stringify(W.w5));
  ok('нөгөө төхөөрөмжийн ШИНЭ үг хадгалагдана (w2, w3)',
    W.w2 && W.w3 && Object.keys(W).sort().join() === 'w1,w2,w3,w4,w5', JSON.stringify(Object.keys(W)));
  ok('өдрийн ахиц — НЭГДЭЛ (10-23-д w1,w2,w3)',
    m && m.days && Array.isArray(m.days['2026-10-23'])
      && m.days['2026-10-23'].length === 3
      && Array.isArray(m.days['2026-10-24']),
    JSON.stringify(m && m.days));
  ok('selectedTopic — ИРСЭН нь (UI-ийн сүүлийн сонголт)',
    m && m.selectedTopic === 7, JSON.stringify(m && m.selectedTopic));
  const k3 = await getK(C);
  ok('koto_get нь уусгасан үр дүнг буцаана',
    k3 && JSON.stringify(k3.d) === JSON.stringify(m), 'get≠put');

  // Хязгаарууд — анон түлхүүр публик тул эдгээр нь цорын ганц хаалт.
  const bad = async (d, c) => {
    try { await putK(c || C, d); return 'ОРЛОО'; } catch (e) { return 'хаав'; }
  };
  ok('богино код (8-аас бага) няцаагдана', await bad(A, 'short') === 'хаав');
  ok('урт код (64-өөс их) няцаагдана',
    await bad(A, 'x'.repeat(65)) === 'хаав');
  let badType = 'ОРЛОО';
  try { await one("select public.koto_put($1,'[]'::jsonb) as d", [C]); }
  catch (e) { badType = 'хаав'; }
  ok('объект БИШ өгөгдөл няцаагдана', badType === 'хаав');
  // Хорлонтой төрөл: {"xp":"abc"} нь `::numeric` хөрвүүлэлтийг унагаж
  // БҮХ гүйлгээг тасалдаг байв — `jnum` түүнийг 0 болгоно.
  const k4 = await putK(C, Object.assign({}, A, { xp: 'abc' }));
  ok('хорлонтой төрөл (xp:"abc") гүйлгээг унагахгүй',
    k4 && k4.d && Number(k4.d.xp) === 120, JSON.stringify(k4 && k4.d && k4.d.xp));

  await db.exec("set role anon");
  let kRead = 'ОРЛОО';
  try {
    const rows = await q1('select * from public.koto');
    kRead = rows.length === 0 ? 'denied' : 'ХАРАВ:' + rows.length;
  } catch (e) { kRead = 'denied'; }
  ok('anon: koto хүснэгтийг ШУУД уншиж ЧАДАХГҮЙ (RLS)', kRead === 'denied', kRead);
  await db.exec('reset role');

  {
  /* 432 үг (17 сэдэв) нь өмнөх `limit 400`-аас хэтэрсэн — илүүдэл нь
     серверт чимээгүй хаягдах байв. */
  const many = {};
  for (let i = 0; i < 450; i++) many['16:' + i] = { passes: 1, weak: false, due: '2026-11-02', last: '2026-11-01' };
  const big = await one('select public.koto_merge($1::jsonb, $2::jsonb) as d',
    [JSON.stringify({ words: many }), JSON.stringify({ words: {} })]);
  ok('450 үг уусгалтад ХАЯГДАХГҮЙ (өмнө limit 400)',
    big && big.d && Object.keys(big.d.words).length === 450, big && big.d && Object.keys(big.d.words).length);

  /* Клиент ба сервер нэг дүрэмтэй байх ёстой — тэд салж явбал синк
     бүр нэг талын ахицыг өөрчилнө. Аппын ЖИНХЭНЭ `kotoMerge`-ийг
     `v2/app.js`-ээс ачаалж, SQL-тэй санамсаргүй өгөгдөл дээр тулгана.
     Мэдэгдэж буй, зориуд хамруулаагүй зөрүү (эвдэрсэн өгөгдөл л):
     бүхэл бус `selectedTopic`, `completed` дахь тоо, хоосон өдрийн массив. */
  const appSrc = fs.readFileSync(path.join(ROOT, 'v2', 'app.js'), 'utf8');
  const kmSrc = appSrc.slice(appSrc.indexOf('  function kotoMerge(a, b) {'),
    appSrc.indexOf('\n  }\n', appSrc.indexOf('  function kotoMerge(a, b) {')) + 4);
  const clientMerge = new Function(kmSrc + '; return kotoMerge;')();
  let seed = 20261101;
  const rnd = n => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  const pick = arr => arr[rnd(arr.length)];
  const DATES = [undefined, '', '2026-10-22', '2026-10-29', '2026-11-01', '2026-11-02', '2026-11-05'];
  const rec = () => {
    const r = {};
    const p = pick([undefined, 0, 1, 2, 3, 4, '3']); if (p !== undefined) r.passes = p;
    const w = pick([undefined, true, false, 'true']); if (w !== undefined) r.weak = w;
    const d = pick(DATES); if (d !== undefined) r.due = d;
    const l = pick(DATES); if (l !== undefined) r.last = l;
    if (rnd(9) === 0) return pick([7, 'x', null, []]);
    return r;
  };
  const side = () => {
    const words = {};
    for (let i = 0; i < 6; i++) if (rnd(3)) words['w' + i] = rec();
    const days = {};
    for (const d of ['2026-10-31', '2026-11-01']) if (rnd(2)) days[d] = ['w' + rnd(6), 'w' + rnd(6)];
    return { version: 1, xp: rnd(500), completed: ['0-' + rnd(4), '1-' + rnd(4)], words, days, selectedTopic: rnd(17) };
  };
  const canon = v => {
    if (Array.isArray(v)) return v.map(canon);
    if (v && typeof v === 'object') {
      const o = {};
      for (const k of Object.keys(v).sort()) o[k] = canon(v[k]);
      return o;
    }
    return v;
  };
  const norm = s => {
    const c = JSON.parse(JSON.stringify(s));
    c.completed = (c.completed || []).slice().sort();
    for (const k of Object.keys(c.days || {})) c.days[k] = c.days[k].slice().sort();
    return JSON.stringify(canon(c));
  };
  let diff = 0, firstDiff = '';
  for (let i = 0; i < 300; i++) {
    const x = side(), y = side();
    const s = await one('select public.koto_merge($1::jsonb, $2::jsonb) as d', [JSON.stringify(x), JSON.stringify(y)]);
    const cs = norm(clientMerge(x, y)), ss = norm(s.d);
    if (cs !== ss) { diff++; if (!firstDiff) firstDiff = JSON.stringify({ x: x.words, y: y.words }) + '\n  client ' + cs + '\n  server ' + ss; }
  }
  ok('клиент kotoMerge ↔ SQL koto_merge: 300 санамсаргүй тохиолдол ИЖИЛ (зөрүү ' + diff + ')', diff === 0, firstDiff.slice(0, 900));
  }

  console.log('\n[KOTO-USER] Google-ээр нэвтэрсэн хэрэглэгчийн ахиц');
  /* Нууц кодын зам нь кодыг мэдсэн хэнд ч нээлттэй. Энэ зам нь
     JWT-ийн sub-аар уягдана: хоёр хэрэглэгч ОГТ харилцан харагдахгүй
     байх ёстой. Мөн уусгалт нь кодын замтай ЯГ ИЖИЛ үр дүн гаргах
     ёстой — үгүй бол аль замаар синк хийснээс хамаарч ахиц зөрнө. */
  const U1 = '11111111-1111-1111-1111-111111111111';
  const U2 = '22222222-2222-2222-2222-222222222222';
  await db.exec("insert into auth.users (id) values ('" + U1 + "'),('" + U2 +
    "') on conflict do nothing;");
  const asUser = u => db.exec("set role authenticated; " +
    "set request.jwt.claim.sub = '" + u + "';");
  const putU = d => one('select public.koto_user_put($1::jsonb) as d', [JSON.stringify(d)]);

  // Нэвтрээгүй: JWT-ийн sub хоосон.
  await db.exec("set role authenticated; set request.jwt.claim.sub = '';");
  let nosign = 'ok';
  try { await putU(A); } catch (e) { nosign = 'denied'; }
  ok('KOTO-USER: нэвтрээгүй бол бичилт няцаана', nosign === 'denied', nosign);

  await asUser(U1);
  const ua = await putU(A);
  ok('KOTO-USER: U1-ийн ахиц бичигдэв', ua && ua.d && ua.d.xp === 120,
    JSON.stringify(ua && ua.d));
  const ub = await putU(B);
  // `m` нь ДЭЭР нууц кодын замаар гарсан ижил A+B-ийн уусгалт.
  ok('KOTO-USER: уусгалт нууц кодын замтай ЯГ ИЖИЛ',
    JSON.stringify(ub && ub.d) === JSON.stringify(m),
    JSON.stringify(ub && ub.d) + ' vs ' + JSON.stringify(m));
  const ug = await one('select public.koto_user_get() as d');
  ok('KOTO-USER: U1 өөрийн ахицыг татав', ug && ug.d && ug.d.xp === 120,
    JSON.stringify(ug && ug.d));

  await asUser(U2);
  const u2g = await one('select public.koto_user_get() as d');
  ok('KOTO-USER: U2 нь U1-ийн ахицыг ХАРАХГҮЙ', u2g && u2g.d === null,
    JSON.stringify(u2g && u2g.d));
  const u2rows = await q1('select user_id from public.koto_user');
  ok('KOTO-USER: шууд select нь ЗӨВХӨН өөрийн мөрийг (policy)',
    u2rows.length === 0, 'мөр=' + u2rows.length);

  // Бичих policy ЗОРИУД байхгүй — шууд бичилт уусгалтыг тойрох байв.
  let wrIns = 'ok';
  try {
    await db.exec("insert into public.koto_user (user_id, data) values ('" + U2 +
      "', '{\"xp\":9999}'::jsonb)");
  } catch (e) { wrIns = 'denied'; }
  ok('KOTO-USER: ШУУД insert няцаана (уусгалтыг тойрохгүй)', wrIns === 'denied', wrIns);

  await asUser(U1);
  let wrUpd = 'ok';
  try {
    await db.exec("update public.koto_user set data = '{\"xp\":9999}'::jsonb");
  } catch (e) { wrUpd = 'denied'; }
  const stillU1 = await one('select public.koto_user_get() as d');
  ok('KOTO-USER: ШУУД update нь ахицыг дарж бичихгүй',
    wrUpd === 'denied' || (stillU1 && stillU1.d && stillU1.d.xp === 120),
    wrUpd + ' xp=' + JSON.stringify(stillU1 && stillU1.d && stillU1.d.xp));

  await db.exec("reset role; set role anon; set request.jwt.claim.sub = '" + U1 + "';");
  let anonGet = 'ok', anonPut = 'ok';
  try { await one('select public.koto_user_get() as d'); } catch (e) { anonGet = 'denied'; }
  try { await putU(A); } catch (e) { anonPut = 'denied'; }
  ok('KOTO-USER: anon нь koto_user_get-ийг дуудаж ЧАДАХГҮЙ', anonGet === 'denied', anonGet);
  ok('KOTO-USER: anon нь koto_user_put-ийг дуудаж ЧАДАХГҮЙ', anonPut === 'denied', anonPut);

  /* ДОТООД функцүүд — аппын клиент тэднийг ХЭЗЭЭ Ч дуудахгүй.
     `revoke … from public` нь Supabase-д ХҮРЭЛЦЭХГҮЙ: шинэ функцэд
     `anon`/`authenticated`-д эрх ТУСГАЙЛАН өгөгддөг тул тэднээс ч
     нэрлэж хасах ёстой. Амьд серверт `judge_gate` яг ийм учраас
     нээлттэй байв — доорх шалгуурууд тэр олдворын регресс. */
  const closed = [
    ['jnum', "select public.jnum('1'::jsonb)"],
    ['koto_merge', "select public.koto_merge('{}'::jsonb,'{}'::jsonb)"],
    ['koto_merge_word', "select public.koto_merge_word('{}'::jsonb,'{}'::jsonb)"],
    ['koto_merge_words', "select public.koto_merge_words('{}'::jsonb,'{}'::jsonb)"],
    ['koto_merge_days', "select public.koto_merge_days('{}'::jsonb,'{}'::jsonb)"],
  ];
  for (const role of ['anon', 'authenticated']) {
    await db.exec('reset role; set role ' + role + ';');
    for (const [name, sql] of closed) {
      let st = 'ok';
      try { await one(sql + ' as d'); } catch (e) { st = 'denied'; }
      ok('ДОТООД: ' + role + ' нь ' + name + '-ийг дуудаж ЧАДАХГҮЙ', st === 'denied', st);
    }
  }
  /* Edge Function-ий зам нь АЖИЛЛАСАН ЗАЛГАА байх ёстой. Дээрх
     хаалтууд `service_role`-ийг хөндвөл ярианы үнэлгээ чимээгүй
     эвдэрнэ — хэрэглэгч «үнэлгээ ажиллахгүй» гэж мэдэхээс өмнө
     квотын хамгаалалт бүхэлдээ fail-open болно. */
  await db.exec('reset role; set role service_role;');
  let svcGate = 'denied';
  try {
    const g = await one("select public.judge_gate('zz-dev', '', 1000, 1000) as d");
    svcGate = g && g.d === '' ? 'ok' : 'unexpected:' + JSON.stringify(g && g.d);
  } catch (e) { svcGate = 'denied'; }
  ok('service_role нь judge_gate-ийг дуудаж ЧАДНА (Edge Function)', svcGate === 'ok', svcGate);
  await db.exec("reset role; set request.jwt.claim.sub = '';");

  console.log('\n' + '─'.repeat(50));
  console.log('цэвэр: ' + pass + '   унасан: ' + fail);
  if (fail) { console.log('\nУНАСАН:'); fails.forEach(x => console.log('  · ' + x)); }
  await db.close();
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(2); });
