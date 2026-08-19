-- MedScores V4.5 migration
-- Run once after the V4.1 migration.
-- Adds semester-specific student membership without duplicating student accounts.

create table if not exists public.student_period_memberships (
  student_id uuid not null references public.students(id) on delete cascade,
  period_id uuid not null references public.academic_periods(id) on delete cascade,
  year_level text,
  created_at timestamptz not null default now(),
  primary key (student_id, period_id)
);

alter table public.student_period_memberships add column if not exists year_level text;

create index if not exists student_period_memberships_period_idx
  on public.student_period_memberships(period_id);
create index if not exists student_period_memberships_student_idx
  on public.student_period_memberships(student_id);

alter table public.student_period_memberships enable row level security;

-- Preserve existing semester participation by deriving membership from subject enrollment.
insert into public.student_period_memberships (student_id, period_id, year_level)
select distinct e.student_id, p.id, st.year_level
from public.enrollments e
join public.students st on st.id = e.student_id
join public.subjects s on s.id = e.subject_id
join public.academic_periods p
  on p.owner_id = s.owner_id
 and p.academic_year = s.academic_year
 and p.term = s.term
on conflict (student_id, period_id) do nothing;

-- Students with no subject enrollment anywhere stay visible in the active semester
-- so existing standalone accounts are not lost during the transition.
insert into public.student_period_memberships (student_id, period_id, year_level)
select st.id, p.id, st.year_level
from public.students st
join public.academic_periods p
  on p.owner_id = st.owner_id
 and p.is_active = true
where not exists (
  select 1 from public.student_period_memberships m where m.student_id = st.id
)
on conflict (student_id, period_id) do nothing;

update public.student_period_memberships m
set year_level = st.year_level
from public.students st
where st.id = m.student_id and m.year_level is null;

alter table public.student_period_memberships alter column year_level set not null;
