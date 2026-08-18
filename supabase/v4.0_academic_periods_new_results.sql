-- MedScores V4.0 migration
-- Run once in Supabase SQL Editor before deploying V4.0.

create table if not exists public.academic_periods (
  id uuid primary key default gen_random_uuid(),
  academic_year text not null,
  term text not null check (term in ('1st Semester', '2nd Semester', 'Summer')),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (academic_year, term)
);

create unique index if not exists academic_periods_one_active_idx
  on public.academic_periods ((is_active))
  where is_active = true;

alter table public.academic_periods enable row level security;

-- Bring existing subject periods into the managed list without changing subject records.
insert into public.academic_periods (academic_year, term, is_active)
select distinct academic_year, term, false
from public.subjects
where coalesce(trim(academic_year), '') <> ''
  and term in ('1st Semester', '2nd Semester', 'Summer')
on conflict (academic_year, term) do nothing;

-- If no active period exists yet, use the period from the most recently created subject.
do $$
begin
  if not exists (select 1 from public.academic_periods where is_active = true) then
    update public.academic_periods
    set is_active = true
    where id = (
      select ap.id
      from public.academic_periods ap
      join public.subjects s
        on s.academic_year = ap.academic_year
       and s.term = ap.term
      order by s.created_at desc nulls last, ap.created_at desc
      limit 1
    );
  end if;
end $$;

alter table public.assessments
  add column if not exists released_at timestamptz;

update public.assessments
set released_at = coalesce(released_at, updated_at, created_at)
where status = 'published' and released_at is null;

create table if not exists public.student_result_views (
  student_id uuid not null references public.students(id) on delete cascade,
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (student_id, assessment_id)
);

create index if not exists student_result_views_student_idx
  on public.student_result_views(student_id);

alter table public.student_result_views enable row level security;

-- Academic data remains accessible only through authenticated Next.js server routes
-- that use the server-only Supabase secret key. No anon/authenticated RLS policies are added.
