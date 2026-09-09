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
