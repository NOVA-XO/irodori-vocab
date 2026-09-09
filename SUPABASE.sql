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
create or replace function public.put_progress(p_code text, p_data jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.progress (code, data, updated_at)
  values (p_code, p_data, now())
  on conflict (code) do update
    set data = excluded.data, updated_at = now();
$$;

-- Анон хэрэглэгчид ЗӨВХӨН энэ хоёр функцийг дуудах эрх өгнө.
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
  select count(*) into n
    from public.feedback
   where meta->>'dev' = p_dev
     and created_at > now() - interval '10 minutes';
  if n >= 3 then
    raise exception 'too many';
  end if;

  insert into public.feedback (kind, body, contact, meta)
  values (p_kind,
          left(p_body, 2000),
          nullif(left(coalesce(p_contact, ''), 120), ''),
          coalesce(p_meta, '{}'::jsonb) || jsonb_build_object('dev', p_dev))
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

-- Апп нээгдэх бүрд нэг удаа дуудна.
create or replace function public.ping(p_dev text)
returns void
language plpgsql
security definer
set search_path = public
as $pg$
begin
  if p_dev is null or length(p_dev) not between 8 and 64 then
    return;
  end if;
  insert into public.devices (dev) values (p_dev)
  on conflict (dev) do update
    set last_seen = now(), opens = public.devices.opens + 1;

  insert into public.visits (day, opens) values (current_date, 1)
  on conflict (day) do update set opens = public.visits.opens + 1;
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
    'feedback',      (select count(*) from public.feedback)
  );
$us$;

revoke all on function public.ping(text) from public;
revoke all on function public.usage_stats() from public;
grant execute on function public.ping(text) to anon;
grant execute on function public.usage_stats() to anon;
