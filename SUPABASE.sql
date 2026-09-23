-- ═══════════════════════════════════════════════════════════════════════
--  irodori-vocab — явц синкдэх хамгийн бага схем
--  Supabase → SQL Editor → энэ бүхнийг наагаад RUN
-- ═══════════════════════════════════════════════════════════════════════
--
--  ЗАРЧИМ
--  · Хувийн мэдээлэл ХАДГАЛАХГҮЙ — и-мэйл ч, нэр ч үгүй.
--    Зөвхөн санамсаргүй код ба «аль үгийг хэдэн удаа давтсан» гэсэн тоо.
--    ҮЛ ХАМААРАХ ГАНЦ ЗҮЙЛ: АНГИд элссэн хүний НЭР (доорх «АНГИ» хэсэг).
--    «Бусад» гэж сонгосон хүний нэр төхөөрөмжөөс гарахгүй.
--  · Хүснэгт рүү ШУУД хандахыг хаана. Хэрэв анон түлхүүрээр шууд
--    `select * from progress` хийж чаддаг байсан бол хэн ч БҮХ хүний
--    мөрийг татаж авах байсан. Тиймээс зөвхөн доорх хоёр функцээр,
--    кодоо мэдэж байж хандана.

create table if not exists public.progress (
  code       text primary key,
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  -- ШИНЭ кодыг цаг тутам тоолоход. `updated_at` нь синк тутам хөдөлдөг
  -- тул «энэ мөр саяхан ҮҮССЭН үү» гэдгийг хэлж чадахгүй.
  created_at timestamptz not null default now()
);
-- Байгаа санд багана нэмнэ (хүснэгт аль хэдийн үүссэн бол).
alter table public.progress add column if not exists created_at timestamptz not null default now();
create index if not exists progress_created_idx on public.progress (created_at);

-- RLS-ийг асаагаад ямар ч policy бичихгүй  =>  шууд хандалт бүрэн хаагдана.
alter table public.progress enable row level security;

-- ── Явц татах: код таарвал л буцаана ────────────────────────────────────
create or replace function public.get_progress(p_code text)
returns jsonb
language sql
security definer                    -- RLS-ийг тойрч, зөвхөн энэ логикоор
set search_path = public
as $$
  select data from public.progress where code = p_code;
$$;

-- ── Явц хадгалах: байхгүй бол үүсгэж, байвал шинэчилнэ ──────────────────
-- Урьд нь ДАРЖ бичдэг байв. Хоёр төхөөрөмж зэрэг нийлүүлэхэд хоёулаа
-- ИЖИЛ хуучин хуулбарыг уншиж, өөрсдийнхөө нэмээд буцааж бичдэг тул
-- СҮҮЛИЙНХ нь эхнийхийн шинэ картыг бүрэн устгадаг байсан.
--
-- Дүрэм нь клиентийн `mergeProgress()`-той ИЖИЛ: илүү олон удаа
-- давтсан (`n`) нь ялна; тэнцвэл илүү өндөр хайрцаг (`b`).
--
-- `for update` мөрийн түгжээ нь зэрэг дуудалтыг дараалалд оруулна.
-- Буцаах төрөл өөрчлөгдсөн (void → jsonb) тул хуучныг УНАГААНА.
-- Тоог jsonb-ээс АЮУЛГҮЙ гаргана. `(v ->> 'n')::int` нь `{"n":"abc"}`
-- гэсэн хорлонтой ачаалал дээр бүх гүйлгээг унагадаг.
create or replace function public.jnum(v jsonb)
returns numeric
language sql
immutable
as $jn$
  select case when jsonb_typeof(v) = 'number' then v::text::numeric else 0 end;
$jn$;

drop function if exists public.put_progress(text, jsonb);

create or replace function public.put_progress(p_code text, p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $pp$
declare
  v_old jsonb;
  res   jsonb;
  n_new int;
begin
  -- ── Хэмжээ ба хэлбэрийн хязгаар ─────────────────────────────────
  -- Анон түлхүүр нь ПУБЛИК тул эдгээр нь цорын ганц хаалт. Хязгааргүй
  -- үед хэн ч дурын кодоор дурын хэмжээний өгөгдөл бичиж сангийн
  -- багтаамжийг дүүргэх боломжтой байсан.
  if p_code is null or length(p_code) not between 8 and 64 then
    raise exception 'bad code';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'bad data';
  end if;

  select count(*) into n_new from jsonb_object_keys(p_data);
  -- Бодит дээд хэмжээ: 6287 үг + 1187 ханз + 107 кана ≈ 7600.
  if n_new > 20000 then
    raise exception 'too many cards';
  end if;
  if pg_column_size(p_data) > 4194304 then          -- 4 МБ
    raise exception 'payload too big';
  end if;

  -- ШИНЭ код үү? Анон түлхүүрээр санамсаргүй кодоор хязгааргүй мөр
  -- үүсгэж санг дүүргэх боломжтой байв. Цагт 200 шинэ кодоор хязгаарлана
  -- — байгаа кодын шинэчлэлт (синк тутам) хамаарахгүй.
  if not exists (select 1 from public.progress where code = p_code) then
    if (select count(*) from public.progress
          where created_at > now() - interval '1 hour') >= 200 then
      raise exception 'rate limited';
    end if;
    insert into public.progress (code, data, updated_at, created_at)
    values (p_code, '{}'::jsonb, now(), now())
    on conflict (code) do nothing;
  end if;

  select data into v_old from public.progress where code = p_code for update;
  v_old := coalesce(v_old, '{}'::jsonb);

  -- ── Уусгалт: НЭГ илэрхийлэл ────────────────────────────────────
  -- Урьд нь түлхүүр бүрд `jsonb_set()` дуудаж давтдаг байв. `jsonb_set`
  -- нь бүх баримтыг ДАХИН угсардаг тул O(n²) болж, 2000 картад 13.2
  -- СЕКУНД авдаг байсан (бодитоор хэмжив).
  --
  -- Одоо зөвхөн ЯЛАХ бичлэгийг цуглуулаад `||`-оор нэг удаа нийлүүлнэ:
  -- баруун тал нь давамгайлдаг тул үлдсэн нь хуучнаараа үлдэнэ.
  select v_old || coalesce(jsonb_object_agg(t.k, p_data -> t.k), '{}'::jsonb)
    into res
  from jsonb_object_keys(p_data) as t(k)
  where v_old -> t.k is null
     or jnum(p_data -> t.k -> 'n') >  jnum(v_old -> t.k -> 'n')
     or (jnum(p_data -> t.k -> 'n') =  jnum(v_old -> t.k -> 'n')
         and jnum(p_data -> t.k -> 'b') > jnum(v_old -> t.k -> 'b'));

  update public.progress set data = res, updated_at = now() where code = p_code;
  return res;                      -- клиент энээс буцааж уусгана
end;
$pp$;

-- ─────────────────────────────────────────────────────────────────────
--  Явцыг УСТГАХ (2026-09-22 нэмэгдэв)
--
--  `put_progress` нь сервер дээр УУСГАДАГ (`v_old || winners`) тул
--  хоосон өгөгдөл түлхэх нь үүлний хуулбарыг цэвэрлэдэггүй. Иймд
--  аппын «Явцыг устгах» товч нь локалыг л устгаад, дараагийн синк нь
--  бүгдийг БУЦААЖ ТАТДАГ байв — товч нь үнэхээр ажиллахгүй.
--
--  Энэ функц нь тухайн кодын мөрийг бүрэн устгана. Хувийн мэдээлэл
--  гарахгүй: код мэддэг хүн зөвхөн ӨӨРИЙН мөрийг устгана.
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.wipe_progress(p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $wp$
begin
  if p_code is null or length(p_code) not between 8 and 64 then
    raise exception 'bad code';
  end if;
  delete from public.progress where code = p_code;
end;
$wp$;

revoke all on function public.wipe_progress(text) from public;
grant execute on function public.wipe_progress(text) to anon;

-- Анон хэрэглэгчид ЗӨВХӨН энэ хоёр функцийг дуудах эрх өгнө.
revoke all on function public.jnum(jsonb) from public;
revoke all on function public.get_progress(text) from public;
revoke all on function public.put_progress(text, jsonb) from public;
grant execute on function public.get_progress(text) to anon;
grant execute on function public.put_progress(text, jsonb) to anon;

-- ── Шалгах ─────────────────────────────────────────────────────────────
-- select public.put_progress('test-code', '{"L01-001":{"b":1}}'::jsonb);
-- select public.get_progress('test-code');     -- {"L01-001": {"b": 1}}
-- select public.get_progress('buruu-code');    -- null
-- select * from public.progress;               -- SQL Editor-т харагдана,
--                                              -- анон түлхүүрээр бол ҮГҮЙ.


-- ═══════════════════════════════════════════════════════════════════════
--  САНАЛ ХҮСЭЛТ  →  GitHub Issue
-- ═══════════════════════════════════════════════════════════════════════
--  Апп нь мөрийг ЭНД хийнэ. `.github/workflows/feedback-to-issues.yml`
--  нэрийн GitHub Action 30 минут тутам шинэ мөрийг уншиж Issue үүсгэнэ.
--
--  Яагаад шууд GitHub API руу залгадаггүй вэ: тэр нь токен шаарддаг ба
--  статик сайтад тавьсан токеныг хэн ч хулгайлж, репод дураараа бичих
--  болно. Тиймээс токен нь ЗӨВХӨН GitHub Secrets дотор, сервер талд байна.

create table if not exists public.feedback (
  id         bigint generated always as identity primary key,
  kind       text        not null,
  body       text        not null,
  contact    text,
  meta       jsonb       not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  issue_no   int                        -- Action бөглөнө; null = хүлээгдэж буй
);

alter table public.feedback enable row level security;

create index if not exists feedback_pending_idx
  on public.feedback (created_at) where issue_no is null;
-- Нийт хязгаарыг тоолоход: `created_at > now() - interval '10 minutes'`.
create index if not exists feedback_time_idx on public.feedback (created_at);

-- Анон хэрэглэгч зөвхөн ЭНЭ функцээр бичнэ. Уншиж чадахгүй.
create or replace function public.add_feedback(
  p_kind text, p_body text, p_contact text, p_meta jsonb, p_dev text)
returns bigint
language plpgsql
security definer
set search_path = public
as $fb$
declare
  n int;
  new_id bigint;
begin
  if p_kind not in ('bug', 'idea', 'other') then
    raise exception 'bad kind';
  end if;
  if length(coalesce(p_body, '')) < 3 then
    raise exception 'too short';
  end if;

  -- СПАМААС сэргийлнэ: нэг төхөөрөмж 10 минутад 3-аас олон илгээхгүй.
  --
  -- ГЭХДЭЭ `p_dev` нь КЛИЕНТЭЭС ирдэг тул дурын утга өгөөд энэ хаалтыг
  -- тойрч болно. Мөр бүр GitHub Issue болдог учир энэ нь репог үерлүүлэх
  -- боломж байв. Тиймээс ХОЁР ДАХЬ, НИЙТ хязгаар нэмнэ: `p_dev`-ээс үл
  -- хамааран 10 минутад 20-оос олон мөр орохгүй.
  select count(*) into n
    from public.feedback
   where meta->>'dev' = p_dev
     and created_at > now() - interval '10 minutes';
  if n >= 3 then
    raise exception 'too many';
  end if;

  select count(*) into n
    from public.feedback
   where created_at > now() - interval '10 minutes';
  if n >= 20 then
    raise exception 'rate limited';
  end if;

  insert into public.feedback (kind, body, contact, meta)
  values (p_kind,
          left(p_body, 2000),
          nullif(left(coalesce(p_contact, ''), 120), ''),
          -- `p_meta` нь урьд нь ХЯЗГААРГҮЙ jsonb байв: `p_body` нь 2000
          -- тэмдэгтээр тайрагддаг ч мета талбараар дурын хэмжээний
          -- өгөгдөл шургуулж болно.
          (case when p_meta is null or jsonb_typeof(p_meta) <> 'object'
                  or pg_column_size(p_meta) > 4096
                then '{}'::jsonb else p_meta end)
          || jsonb_build_object('dev', left(coalesce(p_dev, ''), 64)))
  returning id into new_id;
  return new_id;
end;
$fb$;

revoke all on function public.add_feedback(text, text, text, jsonb, text) from public;
grant execute on function public.add_feedback(text, text, text, jsonb, text) to anon;


-- ═══════════════════════════════════════════════════════════════════════
--  ХЭРЭГЛЭЭНИЙ ТОО
-- ═══════════════════════════════════════════════════════════════════════
--  Хувийн мэдээлэл ХАДГАЛАХГҮЙ: төхөөрөмжийн санамсаргүй id, огноо, тоо.
--  IP ч, хэрэглэгчийн агент ч бичихгүй.

create table if not exists public.devices (
  dev        text primary key,
  first_seen timestamptz not null default now(),
  last_seen  timestamptz not null default now(),
  opens      int         not null default 1
);

create table if not exists public.visits (
  day    date primary key,
  opens  int not null default 0
);

alter table public.devices enable row level security;
alter table public.visits  enable row level security;

-- Цаг тутмын шинэ төхөөрөмжийн хязгаарыг хурдан тоолоход.
create index if not exists devices_first_seen_idx on public.devices (first_seen);

-- ─────────────────────────────────────────────────────────────────────
--  Хэрэглээний ГҮН  (2026-09-11 нэмэгдэв)
--
--  «Хэдэн хүн орсон» ба «хэр их хэрэглэж байна» хоёр ТЭС ӨӨР асуулт.
--  Эхнийхэд `opens` хариулдаг байв; хоёр дахийг хэмжих өгөгдөл ОГТ
--  байгаагүй — аппыг нээгээд шууд хаасан хүн, 300 карт давтсан хүн
--  хоёр яг ИЖИЛ мөр үлдээдэг байсан.
--
--  Тиймээс гурван ТОО нэмнэ. Хувийн мэдээлэл нэмэгдэхгүй: АЛЬ үг
--  гэдгийг биш, зөвхөн хэдийг гэдгийг бичнэ.
--
--  `days` багана НЭМЭХГҮЙ — ping өдөрт нэг удаа явдаг тул одоо байгаа
--  `opens` нь өөрөө «хэдэн өдөр идэвхтэй байсан» гэсэн тоо мөн.
alter table public.devices add column if not exists cards   int not null default 0;
alter table public.devices add column if not exists answers int not null default 0;
alter table public.devices add column if not exists learned int not null default 0;

-- Гарын үсэг өөрчлөгдөж байгаа тул хуучныг унагана. `create or replace`
-- нь өөр аргументтай функцийг ЗЭРЭГЦЭЭ үүсгэдэг бөгөөд тэр үед PostgREST
-- аль нь гэдгийг ялгаж чадахгүй алдаа өгнө.
-- Кэшлэгдсэн хуучин клиент зөвхөн `p_dev` илгээсэн ч шинэ функц
-- default-аар хүлээж авах тул тэдний ping тасрахгүй.
drop function if exists public.ping(text);

-- Апп нээгдэх бүрд нэг удаа дуудна (`p_bump` = true).
-- Дасгал дууссаны дараа тоог л шинэчилнэ (`p_bump` = false) — тэр үед
-- нээлт НЭМЭГДЭХГҮЙ. Үүнгүй бол анх орсон өдрөө л суудаг хүний бүх
-- давталт бүртгэлгүй үлдэнэ: өдрийн эхний ping нь хоосон тоо илгээгээд,
-- дараа нь дахин илгээх боломж гарахгүй.
create or replace function public.ping(
  p_dev     text,
  p_cards   int     default null,
  p_answers int     default null,
  p_learned int     default null,
  p_bump    boolean default true)
returns void
language plpgsql
security definer
set search_path = public
as $pg$
declare
  -- Анон түлхүүрээр дуудагддаг тул тоог хязгаарлана: хэн нэг нь
  -- 10^12 бичээд нийлбэрийг утгагүй болгох боломжгүй байх ёстой.
  c int := least(greatest(coalesce(p_cards,   0), 0), 1000000);
  a int := least(greatest(coalesce(p_answers, 0), 0), 1000000);
  l int := least(greatest(coalesce(p_learned, 0), 0), 1000000);
  bump int := case when coalesce(p_bump, true) then 1 else 0 end;
  n_hour int;
begin
  if p_dev is null or length(p_dev) not between 8 and 64 then
    return;
  end if;

  -- ШИНЭ төхөөрөмжийн урсгалыг хязгаарлана. `p_dev` нь клиентээс ирдэг
  -- тул хэн ч санамсаргүй утга дамжуулж тоог хязгааргүй хөөрөгдөх,
  -- улмаар сангийн мөрийг үржүүлэх боломжтой байв.
  --
  -- Цагт 200 — бодит байдалд өдөрт 30 орчим шинэ төхөөрөмж байсан тул
  -- жинхэнэ хэрэглэгчид хэзээ ч энэ таазанд хүрэхгүй.
  if not exists (select 1 from public.devices where dev = p_dev) then
    select count(*) into n_hour from public.devices
     where first_seen > now() - interval '1 hour';
    if n_hour >= 200 then
      return;                          -- чимээгүй буцна, алдаа өгөхгүй
    end if;
  end if;

  insert into public.devices (dev, opens, cards, answers, learned)
  values (p_dev, bump, c, a, l)
  on conflict (dev) do update
    set last_seen = now(),
        opens     = public.devices.opens + bump,
        -- ХАМГИЙН ИХ утгыг барина. Явц ачаалагдахаас өмнө ping явбал 0
        -- ирж, хуримтлагдсан тоог тэглэх эрсдэлтэй; мөн хэрэглэгч
        -- явцаа арилгавал өмнөх хөдөлмөр тооноос алга болох ёсгүй.
        cards     = greatest(public.devices.cards,   c),
        answers   = greatest(public.devices.answers, a),
        learned   = greatest(public.devices.learned, l);

  if bump = 1 then
    insert into public.visits (day, opens) values (current_date, 1)
    on conflict (day) do update set opens = public.visits.opens + 1;
  end if;
end;
$pg$;

-- Зөвхөн НИЙЛБЭР тоо буцаана — хэний ч мөр гарахгүй.
create or replace function public.usage_stats()
returns jsonb
language sql
security definer
set search_path = public
as $us$
  select jsonb_build_object(
    'devices',       (select count(*) from public.devices),
    'opens',         (select coalesce(sum(opens), 0) from public.visits),
    'today_opens',   (select coalesce(opens, 0) from public.visits where day = current_date),
    'active_7d',     (select count(*) from public.devices where last_seen > now() - interval '7 days'),
    'feedback',      (select count(*) from public.feedback),

    -- ── ГҮН: «хэр их хэрэглэж байна» ──────────────────────────────
    -- `returned` нь хамгийн чухал ганц тоо: хоёр дахь өдөр эргэж
    -- ирсэн төхөөрөмж. Давтлагын апп-д эргэж ирэхгүй бол утгагүй.
    'returned',      (select count(*) from public.devices where opens > 1),
    'studied',       (select count(*) from public.devices where answers > 0),
    'answers',       (select coalesce(sum(answers), 0) from public.devices),
    'learned',       (select coalesce(sum(learned), 0) from public.devices),
    -- Дундаж биш ДУНДАЖИЙН МЕДИАН: нэг хүн 500 карт хийвэл дундаж
    -- бүгдийг нь сайхан харагдуулна, медиан харагдуулахгүй.
    'med_answers',   (select coalesce(round(percentile_cont(0.5)
                        within group (order by answers)), 0)
                      from public.devices where answers > 0),
    'buckets',       (select jsonb_build_object(
                        'n0',   count(*) filter (where answers = 0),
                        'n1',   count(*) filter (where answers between 1 and 19),
                        'n20',  count(*) filter (where answers between 20 and 99),
                        'n100', count(*) filter (where answers >= 100))
                      from public.devices)
  );
$us$;

revoke all on function public.ping(text, int, int, int, boolean) from public;
revoke all on function public.usage_stats() from public;
grant execute on function public.ping(text, int, int, int, boolean) to anon;
grant execute on function public.usage_stats() to anon;

-- ─────────────────────────────────────────────────────────────────────
--  Хэрэглээний ЗАДАРГАА (2026-09-10 нэмэгдэв)
--
--  `usage_stats()` нь зөвхөн нийт тоо буцаадаг тул «хэдэн ШИНЭ хүн
--  орсон бэ» гэдгийг ялгах боломжгүй байв — хөгжүүлэлтийн тест ба
--  жинхэнэ зочин хоёр нэг тоонд нийлдэг. Энэ функц нь цаг тутмын
--  задаргааг өгнө: тестийн цонхыг хасаад тоолж болно.
--
--  Хувийн мэдээлэл гарахгүй: төхөөрөмжийн id БУЦААХГҮЙ, зөвхөн тоо.
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.usage_days()
returns jsonb
language sql
security definer
set search_path = public
as $ud$
  select jsonb_build_object(
    'tz', 'Asia/Ulaanbaatar',
    'new_by_hour', (
      select coalesce(jsonb_agg(jsonb_build_object('h', h, 'n', n) order by h), '[]'::jsonb)
      from (
        select to_char(first_seen at time zone 'Asia/Ulaanbaatar', 'MM-DD HH24') as h,
               count(*) as n
        from public.devices
        where first_seen > now() - interval '30 days'
        group by 1
      ) t
    ),
    'opens_by_day', (
      select coalesce(jsonb_agg(jsonb_build_object('d', day, 'n', opens) order by day), '[]'::jsonb)
      from public.visits
      where day > current_date - 30
    )
  );
$ud$;

revoke all on function public.usage_days() from public;
grant execute on function public.usage_days() to anon;

-- ═══════════════════════════════════════════════════════════════════════
--  АНГИ  (2026-09-22 нэмэгдэв)
-- ═══════════════════════════════════════════════════════════════════════
--  Багш даалгавар өгөөд сурагчид хийж байгаа эсэхийг харах зорилготой.
--
--  ЗАРЧМЫН ӨӨРЧЛӨЛТ. Энэ файлын эхэнд «нэр ч үгүй» гэж бичсэн. Анги нь
--  НЭР хадгална — гэхдээ ЗӨВХӨН ангид элссэн хүнийх. «Бусад» гэж
--  сонгосон хүний нэр төхөөрөмжөөс ГАРАХГҮЙ: `member_put` нь ангигүй
--  хүний мөрийг хадгалахын оронд УСТГАНА.
--
--  ХАМГААЛАЛТ. Репо ба сайт хоёулаа нийтэд нээлттэй, нэвтрэлт байхгүй
--  (зөвхөн анон түлхүүр). Тиймээс анги бүр 4 оронтой КОДтой:
--    · Код нь энэ файлд БИЧИГДЭХГҮЙ — репо нийтэд нээлттэй. Репогийн
--      гадна хадгалж (`00-admin/secrets/`), SQL Editor-т гараар оруулна.
--    · 4 орон = 10 000 хувилбар — таахад амархан. Тиймээс анги тус бүрд
--      буруу оролдлогыг ЦАГТ 50-аар хязгаарлана (дунджаар ~100 цаг
--      таана). Хүрвэл тухайн анги
--      1 цаг ТҮГЖИГДЭНЭ (зөв кодыг ч хүлээж авахгүй) — эс тэгвэл
--      түгжээг зөв таамаглалаар «тойрох» боломжтой болно.
--    · Үнэ: IP-гүй тул халдагч болон жинхэнэ сурагчийг ялгахгүй. Хэн
--      нэгэн зориуд 50 удаа буруу оруулбал анги 1 цаг хаагдана.
--      Жижиг ангийн хэрэгсэлд хүлээн зөвшөөрөх эрсдэл.
--    · Яагаад 20 биш 50: багш кодоо сольход анги бүх сурагчийн апп
--      ХУУЧИН кодоор нэг удаа оролдоно (клиент татгалзсан кодыг дахин
--      илгээхгүй). 30 сурагчтай ангид 20 нь шууд түгжих байв.
--    · Хүснэгт рүү шууд хандах ХААЛТТАЙ (RLS, policy байхгүй). Код ба
--      гишүүний id хэзээ ч клиент рүү буцахгүй.
--
--  ТАНИХ ТЭМДЭГ. `member` нь клиентийн санамсаргүй id — `devices.dev`-ээс
--  ТУСДАА. Хэрэглээний нэргүй тоог нэртэй холбохгүйн тулд.
--  Хязгаар: нэг хүн хоёр төхөөрөмжөөр орвол хоёр мөр болно.

create table if not exists public.classes (
  id        text primary key,               -- 'mica', 'c2' — клиент үүгээр ялгана
  name      text not null,                  -- дэлгэцэнд гарах нэр
  code      text not null,                  -- 4 орон; энэ файлд БИЧИГДЭХГҮЙ
  sort      int  not null default 0,
  fails     int  not null default 0,        -- одоогийн цонхны буруу оролдлого
  fail_from timestamptz not null default now()
);

create table if not exists public.members (
  member     text primary key,
  name       text   not null,
  classes    text[] not null default '{}',
  seen       int    not null default 0,     -- үзсэн үг
  learned    int    not null default 0,     -- тогтсон үг (хайрцаг >= 3)
  today      int    not null default 0,     -- `day` өдөр судалсан өөр үг
  streak     int    not null default 0,
  day        int,                           -- клиентийн өдрийн дугаар (today())
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.classes enable row level security;
alter table public.members enable row level security;
create index if not exists members_classes_idx on public.members using gin (classes);

-- ── ДААЛГАВАР (2026-09-22 нэмэгдэв) ─────────────────────────────────────
-- Анги бүр НЭГ даалгавартай байж болно:
--   {"lessons":[1..8], "n":20, "since":"2026-09-22", "until":"2026-09-25", "days":3}
-- = L1–L8-ын шалгалтын асуултаас 20 ӨӨР асуулт хариулах. ЗӨВХӨН
-- `since`..`until` хоорондох хариулт тоологдоно — хугацаа дуусахад хувь
-- ЗОГСОНО (хэрэглэгчийн шийдвэр). `until` байхгүй бол хугацаагүй.
-- Багш аппаасаа `task_set`-ээр тавина. Нууц биш — `class_list` буцаана.
alter table public.classes add column if not exists task jsonb;
-- Багшийн код — сурагчийнхаас ТУСДАА, 6 оронтой (2026-09-23). Багш үүгээр
-- жагсаалтыг харах ба ДААЛГАВАР тавих эрхтэй. Багш жагсаалтад ОРОХГҮЙ:
-- `member_put` нь зөвхөн 'ok' (сурагчийн код) үед мөр үүсгэнэ.
alter table public.classes add column if not exists tcode text;
-- Гишүүний шалгалтын хариулт: {"S01-01": [өдөр, чадсан 0/1, хичээл], …}.
-- ДАРЖ БИЧИХГҮЙ, УУСГАНА (`progress`-той ижил зарчим). Утас, компьютер
-- нэг мөр хуваалцдаг ба хариултын түүх нь төхөөрөмж тус бүрд байдаг тул
-- дарж бичвэл нөгөө дээрээ хийсэн ажил АЛГА БОЛНО. Түлхүүр тутамд
-- СҮҮЛИЙН өдрийнхийг авна.
-- Асуулт тутамд СҮҮЛИЙН хариулт. ТҮҮХИЙГЭЭР нь клиент рүү буцаахгүй —
-- ангийнхан бие биеийн аль асуултад юу гэж хариулсныг харахгүй;
-- `class_roster` зөвхөн ТООГ бодож буцаана.
alter table public.members add column if not exists exam jsonb not null default '{}'::jsonb;
-- Нэрийг ХЭЗЭЭ зассаныг (клиентийн цаг, мс). Утас, компьютер нэг мөр
-- хуваалцдаг тул аль нь бичихээс хамаарч нэр ээлжлэн солигддог байв.
-- Одоо хамгийн СҮҮЛД ЗАССАН нэр ялна — дараалал хамаарахгүй.
alter table public.members add column if not exists name_at bigint not null default 0;

-- ── Кодыг шалгах — БҮХ ангийн хандалт энэ ганц газраар дамжина ─────────
-- Буцаах утга: 'ok' | 'teacher' | 'bad' | 'locked' | 'none'. Клиентэд «түгжигдсэн»
-- гэдгийг «буруу»-гаас ялгаж хэлэх нь чухал — эс тэгвэл сурагч зөв
-- кодоо дахин дахин оруулж, «буруу» гэж сонсоод будилна.
create or replace function public.class_join(p_class text, p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $cj$
declare
  c public.classes%rowtype;
begin
  -- `for update` — зэрэг оролдлогууд тоолуурыг зөв нэмэхийн тулд.
  select * into c from public.classes where id = p_class for update;
  if not found then
    return 'none';
  end if;
  if c.fail_from < now() - interval '1 hour' then
    update public.classes set fails = 0, fail_from = now() where id = p_class;
    c.fails := 0;
  end if;
  if c.fails >= 50 then
    return 'locked';
  end if;
  if p_code is not null and btrim(p_code) = c.code then
    return 'ok';
  end if;
  -- Багшийн код. Ижил таах хязгаарт хамаарна.
  if p_code is not null and c.tcode is not null and btrim(p_code) = c.tcode then
    return 'teacher';
  end if;
  update public.classes set fails = fails + 1 where id = p_class;
  return 'bad';
end;
$cj$;

-- ── Ангийн жагсаалт — нэр л; код, гишүүн ГАРАХГҮЙ ──────────────────────
create or replace function public.class_list()
returns jsonb
language sql
stable
security definer
set search_path = public
as $cl$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'task', task)
                            order by sort, id), '[]'::jsonb)
  from public.classes;
$cl$;

-- ── Гишүүнчлэл ба тоо хадгалах ──────────────────────────────────────────
-- `p_classes` = {"mica": "1234", "c2": "5678"} — анги бүрийн КОД.
-- Зөвхөн код нь ТААРСАН ангид бүртгэнэ. Буцаах утга нь анги тус бүрийн
-- төлөв ({"mica":"ok","c2":"bad"}) — клиент түүгээр аль код нь хүчингүй
-- болсныг мэднэ.
-- Ангигүй үлдвэл (эсвэл нэр хоосон) мөрийг УСТГАНА — «Бусад»-ын нэр
-- серверт үлдэх ёсгүй.
-- Параметр нэмэгдсэн тул хуучин гарын үсгийг УНАГААНА — эс тэгвэл хоёр
-- функц зэрэгцэж, PostgREST аль нь гэдгийг ялгаж чадахгүй (ping-д ч ийм
-- байсан). `p_exam` нь default-тай тул кэшлэгдсэн ХУУЧИН клиент тасрахгүй.
drop function if exists public.member_put(text, text, jsonb, int, int, int, int, int);
drop function if exists public.member_put(text, text, jsonb, int, int, int, int, int, jsonb);
drop function if exists public.member_put(text, text, jsonb, int, int, int, int, int, jsonb, bigint);

create or replace function public.member_put(
  p_member  text,
  p_name    text,
  p_classes jsonb,
  p_seen    int default 0,
  p_learned int default 0,
  p_today   int default 0,
  p_streak  int default 0,
  p_day     int default null,
  p_exam    jsonb default null,
  p_name_at bigint default 0,
  -- «Явцыг устгах» — уусгахгүй, ДАРЖ бичнэ. Үүнгүй бол хэрэглэгч явцаа
  -- устгасан ч ангид хуучин хувь нь үлдэж, хоёр өөр тоо харагдана.
  p_wipe    boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $mp$
declare
  ok  text[] := '{}';
  res jsonb  := '{}'::jsonb;
  k   text;
  st  text;
  nm  text   := left(btrim(coalesce(p_name, '')), 40);
  cap int;
  ex  jsonb  := null;                   -- null = хуучин клиент, байгааг хадгална
  cur jsonb;                            -- серверт байгаа хариулт (уусгана)
  nat bigint := least(greatest(coalesce(p_name_at, 0), 0), 4102444800000);
  eff text;                             -- эцсийн нэр — клиент үүнийг аваад тавина
begin
  if p_member is null or length(p_member) not between 8 and 64 then
    return jsonb_build_object('error', 'bad member');
  end if;

  if jsonb_typeof(p_classes) = 'object' then
    for k in select jsonb_object_keys(p_classes) loop
      st := public.class_join(k, p_classes ->> k);
      if st = 'ok' then
        -- Анги тутамд 200 гишүүн. Кодтой хүн санамсаргүй id-гаар
        -- хуурамч гишүүн үржүүлэхээс хамгаална.
        select count(*) into cap from public.members
         where k = any(classes) and member <> p_member;
        if cap >= 200 then
          st := 'full';
        else
          ok := ok || k;
        end if;
      end if;
      res := res || jsonb_build_object(k, st);
    end loop;
  end if;

  if cardinality(ok) = 0 or nm = '' then
    delete from public.members where member = p_member;
    return res;
  end if;

  -- Мөрийг түгжинэ: хоёр төхөөрөмж ЗЭРЭГ илгээвэл уншаад бичих хооронд
  -- нөгөөгийнх алга болно.
  select exam into cur from public.members where member = p_member for update;

  -- Шалгалтын хариултыг ЦЭВЭРЛЭЖ хадгална: 200 хүртэл түлхүүр, id-ийн
  -- хэлбэр, [өдөр, 0/1, хичээл] — бүгд хязгаарлагдсан бүхэл тоо.
  -- Анон түлхүүрээр дуудагддаг тул хорлонтой ачааллыг ЭНД зогсооно;
  -- `class_roster` энэ өгөгдөл дээр төрөл хөрвүүлдэг.
  if jsonb_typeof(p_exam) = 'object' then
    select coalesce(jsonb_object_agg(e.key, jsonb_build_array(
             least(greatest(public.jnum(e.value -> 0), 0), 100000)::int,
             case when public.jnum(e.value -> 1) > 0 then 1 else 0 end,
             least(greatest(public.jnum(e.value -> 2), 0), 100)::int)), '{}'::jsonb)
      into ex
      from (select * from jsonb_each(p_exam) limit 200) e
     where e.key ~ '^[A-Za-z0-9_-]{1,16}$' and jsonb_typeof(e.value) = 'array';

    -- УУСГАНА: асуулт тутамд СҮҮЛИЙН өдрийн хариултыг авна. 400 түлхүүр
    -- хүртэл — сан 100 асуулттай тул энэ нь хэтрэхгүй.
    -- `p_wipe` үед уусгахгүй: ирсэн зүйл нь ЭЦСИЙН утга.
    if coalesce(p_wipe, false) then
      cur := '{}'::jsonb;
    end if;
    -- Багана нь plpgsql-ийн `k` хувьсагчтай мөргөлдөхгүй нэртэй байна.
    select coalesce(jsonb_object_agg(qk, qv), '{}'::jsonb) into ex from (
      select coalesce(o.key, n.key) as qk,
             case
               when o.value is null then n.value
               when n.value is null then o.value
               when public.jnum(n.value -> 0) >= public.jnum(o.value -> 0) then n.value
               else o.value
             end as qv
        from jsonb_each(coalesce(cur, '{}'::jsonb)) o
        full join jsonb_each(ex) n on o.key = n.key
       limit 400) m2;
  end if;

  insert into public.members as m
    (member, name, classes, seen, learned, today, streak, day, exam, name_at)
  values
    (p_member, nm, ok,
     least(greatest(coalesce(p_seen,    0), 0), 1000000),
     least(greatest(coalesce(p_learned, 0), 0), 1000000),
     least(greatest(coalesce(p_today,   0), 0), 100000),
     least(greatest(coalesce(p_streak,  0), 0), 100000),
     p_day, coalesce(ex, '{}'::jsonb), nat)
  on conflict (member) do update
    -- Нэрийг зөвхөн ШИНЭ засвар дарна. Хуучин клиент (`name_at` = 0)
    -- хэзээ ч дарж бичихгүй — эс тэгвэл шинэ нэр буцаад алга болно.
    set name = case when nat >= m.name_at then excluded.name else m.name end,
        name_at = greatest(m.name_at, nat),
        classes = excluded.classes,
        seen = excluded.seen, learned = excluded.learned,
        today = excluded.today, streak = excluded.streak,
        day = excluded.day, updated_at = now(),
        -- `p_exam` илгээгээгүй (хуучин клиент) бол байгааг ДАРЖ БИЧИХГҮЙ.
        exam = coalesce(ex, m.exam)
  returning m.name into eff;
  -- Хүчинтэй нэрийг буцаана: нөгөө төхөөрөмж дээр шинэ нэр тавьсан бол
  -- энэ клиент түүнийг аваад өөр дээрээ тавина.
  res := res || jsonb_build_object('name', eff);
  -- Уусгасан хариултыг БУЦААНА: нөгөө төхөөрөмж дээр хийсэн ажил энэ
  -- төхөөрөмж дээр ч харагдах ёстой (шалгалтын дэлгэцийн явц).
  if ex is not null then
    res := res || jsonb_build_object('exam', ex);
  end if;
  return res;
end;
$mp$;

-- ── Ангийн гишүүдийн явц ────────────────────────────────────────────────
-- Код буруу/түгжигдсэн бол гишүүн огт гарахгүй. `me` нь зөвхөн тухайн
-- хүний мөрийг тэмдэглэнэ — бусдын `member` id буцахгүй.
-- `today`/`streak` нь `day` өдрийнх: хуучирсан эсэхийг клиент өөрийн
-- өдрийн дугаартай тулгаж шийднэ (сервер UTC, хэрэглэгч UTC+8).
create or replace function public.class_roster(p_class text, p_code text,
                                               p_member text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $cr$
declare
  st    text := public.class_join(p_class, p_code);
  tk    jsonb;
  les   int[] := '{}';
  since date  := '1970-01-01';
  upto  date  := 'infinity';
begin
  -- Сурагч ба БАГШ хоёулаа жагсаалтыг харна. Багш өөрөө жагсаалтад
  -- ордоггүй тул түүнд зөвхөн харах эрх.
  if st <> 'ok' and st <> 'teacher' then
    return jsonb_build_object('status', st);
  end if;
  select task into tk from public.classes where id = p_class;
  if jsonb_typeof(tk) = 'object' then
    if jsonb_typeof(tk -> 'lessons') = 'array' then
      les := array(select public.jnum(x)::int from jsonb_array_elements(tk -> 'lessons') x);
    end if;
    if coalesce(tk ->> 'since', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      since := (tk ->> 'since')::date;
    end if;
    -- ХУГАЦАА: `until`-ээс хойшхи хариулт тоологдохгүй — хувь зогсоно.
    if coalesce(tk ->> 'until', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      upto := (tk ->> 'until')::date;
    end if;
  else
    tk := null;
  end if;
  -- `task_n` — даалгаврын хичээлээс `since`-ээс хойш хариулсан ӨӨР асуулт;
  -- `task_ok` — тэдгээрийн «чадсан». Түүхий хариулт БУЦАХГҮЙ.
  -- `day` нь клиентийн өдрийн дугаар (1970-01-01-ээс хойш) тул огноо
  -- болгож `since`-тэй тулгана.
  return jsonb_build_object(
    'status', 'ok',
    'role', st,
    'name', (select name from public.classes where id = p_class),
    'task', tk,
    'rows', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'name', m.name, 'seen', m.seen, 'learned', m.learned,
               'today', m.today, 'streak', m.streak, 'day', m.day,
               'me', m.member = p_member,
               'task_n', case when tk is null then null else (
                 select count(*) from jsonb_each(m.exam) e
                  where public.jnum(e.value -> 2)::int = any(les)
                    and ('1970-01-01'::date + public.jnum(e.value -> 0)::int)
                        between since and upto) end,
               'task_ok', case when tk is null then null else (
                 select count(*) from jsonb_each(m.exam) e
                  where public.jnum(e.value -> 2)::int = any(les)
                    and ('1970-01-01'::date + public.jnum(e.value -> 0)::int)
                        between since and upto
                    and public.jnum(e.value -> 1) > 0) end)
             order by m.learned desc, m.seen desc, m.name), '[]'::jsonb)
      from public.members m
      where p_class = any(m.classes)
    ));
end;
$cr$;

-- ── Даалгавар тавих — ЗӨВХӨН багш ──────────────────────────────────────
-- `p_lessons` хоосон бол даалгаврыг УСТГАНА.
-- `p_since` нь БАГШИЙН орон нутгийн огноо (сервер UTC тул өөрөө бодохгүй).
-- `until = since + days`. Хугацаа дуусахад хувь зогсоно.
create or replace function public.task_set(
  p_class   text,
  p_tcode   text,
  p_lessons jsonb   default null,
  p_n       int     default 20,
  p_days    int     default 7,
  p_since   text    default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $ts$
declare
  st  text := public.class_join(p_class, p_tcode);
  les int[] := '{}';
  d0  date;
  nn  int := least(greatest(coalesce(p_n, 20), 1), 100);
  dd  int := least(greatest(coalesce(p_days, 7), 1), 60);
  tk  jsonb;
begin
  -- Сурагчийн код нь 'ok' буцаадаг — ТҮҮНИЙГ амжилттай гэж ойлгож
  -- болохгүй тул 'denied' болгож ялгана (тест барив).
  if st <> 'teacher' then
    return jsonb_build_object('status', case when st = 'ok' then 'denied' else st end);
  end if;
  if jsonb_typeof(p_lessons) = 'array' then
    select array(select distinct public.jnum(x)::int
                   from jsonb_array_elements(p_lessons) x
                  where public.jnum(x) between 1 and 99
                  order by 1)
      into les;
  end if;
  if coalesce(cardinality(les), 0) = 0 then
    update public.classes set task = null where id = p_class;
    return jsonb_build_object('status', 'ok', 'task', null);
  end if;
  if coalesce(p_since, '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    d0 := p_since::date;
  else
    d0 := current_date;
  end if;
  tk := jsonb_build_object(
    'lessons', to_jsonb(les), 'n', nn, 'days', dd,
    'since', to_char(d0, 'YYYY-MM-DD'),
    'until', to_char(d0 + dd, 'YYYY-MM-DD'));
  update public.classes set task = tk where id = p_class;
  return jsonb_build_object('status', 'ok', 'task', tk);
end;
$ts$;

revoke all on function public.class_join(text, text)  from public;
revoke all on function public.class_list()            from public;
revoke all on function public.member_put(text, text, jsonb, int, int, int, int, int, jsonb, bigint, boolean) from public;
revoke all on function public.class_roster(text, text, text) from public;
grant execute on function public.class_join(text, text)  to anon;
grant execute on function public.class_list()            to anon;
grant execute on function public.member_put(text, text, jsonb, int, int, int, int, int, jsonb, bigint, boolean) to anon;
grant execute on function public.class_roster(text, text, text) to anon;
revoke all on function public.task_set(text, text, jsonb, int, int, text) from public;
grant execute on function public.task_set(text, text, jsonb, int, int, text) to anon;
