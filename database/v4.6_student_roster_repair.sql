-- MedScores V4.6 student roster repair
-- Run once after the V4.5 semester-roster update.
-- Restores legacy 1st-semester students without copying old scores or subjects.

create table if not exists public.student_period_memberships (
  student_id uuid not null references public.students(id) on delete cascade,
  period_id uuid not null references public.academic_periods(id) on delete cascade,
  year_level text not null,
  created_at timestamptz not null default now(),
  primary key (student_id, period_id)
);

create index if not exists student_period_memberships_period_idx
  on public.student_period_memberships(period_id);
create index if not exists student_period_memberships_student_idx
  on public.student_period_memberships(student_id);

-- Any student already enrolled in a semester subject belongs to that semester.
insert into public.student_period_memberships (student_id, period_id, year_level)
select distinct e.student_id, p.id, st.year_level
from public.enrollments e
join public.students st on st.id = e.student_id
join public.subjects s on s.id = e.subject_id
join public.academic_periods p
  on p.owner_id = s.owner_id
 and p.academic_year = s.academic_year
 and p.term = s.term
on conflict (student_id, period_id) do update
set year_level = excluded.year_level;

-- The V4.5 first-time backfill could put a legacy student with no subject
-- enrollment into whichever semester happened to be active. If that legacy
-- student has exactly one semester membership and no subject enrollment at all,
-- move that membership to the earliest semester for the same Admin account.
with owner_membership_start as (
  select st.owner_id, min(m.created_at) as first_membership_at
  from public.student_period_memberships m
  join public.students st on st.id = m.student_id
  group by st.owner_id
),
earliest_period as (
  select distinct on (p.owner_id)
    p.owner_id, p.id as period_id
  from public.academic_periods p
  order by
    p.owner_id,
    p.academic_year asc,
    case p.term when '1st Semester' then 1 when '2nd Semester' then 2 else 3 end asc,
    p.created_at asc
),
membership_counts as (
  select student_id, count(*) as membership_count
  from public.student_period_memberships
  group by student_id
)
update public.student_period_memberships m
set period_id = ep.period_id
from public.students st
join owner_membership_start oms on oms.owner_id = st.owner_id
join earliest_period ep on ep.owner_id = st.owner_id
join membership_counts mc on mc.student_id = st.id
where m.student_id = st.id
  and mc.membership_count = 1
  and m.period_id <> ep.period_id
  and st.created_at < oms.first_membership_at
  and not exists (
    select 1 from public.enrollments e where e.student_id = st.id
  )
  and not exists (
    select 1
    from public.student_period_memberships existing
    where existing.student_id = st.id
      and existing.period_id = ep.period_id
  );

-- Final fallback for older standalone students that still have no membership.
with earliest_period as (
  select distinct on (p.owner_id)
    p.owner_id, p.id as period_id
  from public.academic_periods p
  order by
    p.owner_id,
    p.academic_year asc,
    case p.term when '1st Semester' then 1 when '2nd Semester' then 2 else 3 end asc,
    p.created_at asc
)
insert into public.student_period_memberships (student_id, period_id, year_level)
select st.id, ep.period_id, st.year_level
from public.students st
join earliest_period ep on ep.owner_id = st.owner_id
where not exists (
  select 1 from public.student_period_memberships m where m.student_id = st.id
)
on conflict (student_id, period_id) do nothing;
