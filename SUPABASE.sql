-- ═══════════════════════════════════════════════════════════════════════
--  irodori-vocab — явц синкдэх хамгийн бага схем
--  Supabase → SQL Editor → энэ бүхнийг наагаад RUN
-- ═══════════════════════════════════════════════════════════════════════
--
--  ЗАРЧИМ
--  · Хувийн мэдээлэл ХАДГАЛАХГҮЙ — и-мэйл ч, нэр ч үгүй.
--    Зөвхөн санамсаргүй код ба «аль үгийг хэдэн удаа давтсан» гэсэн тоо.
--  · Хүснэгт рүү ШУУД хандахыг хаана. Хэрэв анон түлхүүрээр шууд
--    `select * from progress` хийж чаддаг байсан бол хэн ч БҮХ хүний
--    мөрийг татаж авах байсан. Тиймээс зөвхөн доорх хоёр функцээр,
--    кодоо мэдэж байж хандана.

create table if not exists public.progress (
  code       text primary key,
  data       jsonb       not null,
  updated_at timestamptz not null default now()
);

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

  insert into public.progress (code, data, updated_at)
  values (p_code, '{}'::jsonb, now())
  on conflict (code) do nothing;

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
