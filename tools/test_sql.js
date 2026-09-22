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
  await db.exec("create role anon nologin; create role authenticated nologin;");
  // Supabase нь public схемийн ШИНЭ хүснэгтэд anon-д SELECT/INSERT/…
  // эрхийг АНХДАГЧААР өгдөг. Хамгаалалт нь зөвхөн RLS-д тулгуурладаг —
  // тиймээс тэр нөхцлийг ЯГ дуурайна, эс тэгвэл RLS-гүй ч тест тэнцэнэ.
  await db.exec("grant usage on schema public to anon; " +
    "alter default privileges in schema public grant all on tables to anon;");

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

  // 200-аас олон түлхүүр -> 200 л
  const many = {};
  for (let i = 0; i < 260; i++) many['Q' + i] = [D0, 1, 1];
  await putEx('memberT00003', 'Их', { mica: '5173' }, many);
  const cnt = (await one("select (select count(*) from jsonb_object_keys(exam)) as n from public.members where member='memberT00003'")).n;
  ok('хариулт 200 хүртэл хязгаарлагдана', Number(cnt) === 200, String(cnt));
  // Хэт их өдөр/хичээл -> хязгаарлагдана, алдаа өгөхгүй
  await putEx('memberT00004', 'Хэт', { mica: '5173' }, { S01: [9e15, 5, 9e15] });
  const hx = (await one("select exam from public.members where member='memberT00004'")).exam;
  ok('хэт их тоо -> хязгаарлагдана (алдаагүй)', JSON.stringify(hx.S01) === '[100000,1,100]',
    JSON.stringify(hx));

  const fns = (await one("select count(*) as n from pg_proc where proname = 'member_put'")).n;
  ok('member_put ГАНЦ хувилбартай (хуучин гарын үсэг устсан)', Number(fns) === 1, String(fns));
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

  console.log('\n' + '─'.repeat(50));
  console.log('цэвэр: ' + pass + '   унасан: ' + fail);
  if (fail) { console.log('\nУНАСАН:'); fails.forEach(x => console.log('  · ' + x)); }
  await db.close();
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(2); });
