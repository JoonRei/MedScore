-- MedScores V4.25 — Weighted grade types + selective final term-grade release
-- Run once in Supabase SQL Editor after v4.24_grading_periods_tracks_subcomponents.sql.

create extension if not exists pgcrypto;

alter table public.grade_schemes
  add column if not exists subject_weight numeric(6,3) not null default 100;

alter table public.grade_schemes
  drop constraint if exists grade_schemes_subject_weight_check;

alter table public.grade_schemes
  add constraint grade_schemes_subject_weight_check
  check (subject_weight >= 0 and subject_weight <= 100);

-- Existing subjects with multiple grade types are rebalanced evenly so their
-- final-grade weights start in a valid 100% state. Admin can then change 50/50
-- to values such as Lecture 70 / Laboratory 30.
with weighted as (
  select
    id,
    count(*) over (partition by owner_id, subject_id, grading_period) as track_count,
    row_number() over (
      partition by owner_id, subject_id, grading_period
      order by track_sort_order, created_at, id
    ) as track_number
  from public.grade_schemes
),
normalized as (
  select
    id,
    track_count,
    track_number,
    round((100.0 / track_count)::numeric, 3) as even_weight
  from weighted
)
update public.grade_schemes as scheme
set subject_weight = case
  when normalized.track_number = normalized.track_count
    then round((100 - normalized.even_weight * (normalized.track_count - 1))::numeric, 3)
  else normalized.even_weight
end
from normalized
where scheme.id = normalized.id;

create table if not exists public.released_subject_term_grades (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  grading_period text not null check (grading_period in ('prelim', 'midterm', 'finals')),
  student_id uuid not null references public.students(id) on delete cascade,
  raw_percentage numeric(7,3) not null check (raw_percentage between 0 and 100),
  term_grade numeric(7,3) not null check (term_grade between 40 and 100),
  rounding_digits smallint not null default 0 check (rounding_digits between 0 and 2),
  breakdown jsonb not null default '[]'::jsonb,
  first_released_at timestamptz not null default now(),
  released_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, subject_id, grading_period, student_id)
);

create table if not exists public.subject_term_grade_release_history (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  grading_period text not null check (grading_period in ('prelim', 'midterm', 'finals')),
  student_id uuid not null references public.students(id) on delete cascade,
  raw_percentage numeric(7,3) not null check (raw_percentage between 0 and 100),
  term_grade numeric(7,3) not null check (term_grade between 40 and 100),
  rounding_digits smallint not null default 0 check (rounding_digits between 0 and 2),
  breakdown jsonb not null default '[]'::jsonb,
  released_at timestamptz not null default now(),
  released_by uuid not null
);

create index if not exists released_subject_term_grades_student_idx
  on public.released_subject_term_grades(student_id, released_at desc);

create index if not exists released_subject_term_grades_subject_period_idx
  on public.released_subject_term_grades(subject_id, grading_period, released_at desc);

create index if not exists subject_term_grade_release_history_student_idx
  on public.subject_term_grade_release_history(student_id, released_at desc);

create index if not exists subject_term_grade_release_history_subject_period_idx
  on public.subject_term_grade_release_history(subject_id, grading_period, released_at desc);

-- These tables stay server-only. MedScores' server routes authenticate the
-- current admin/student and use the server-side admin client.
alter table public.released_subject_term_grades enable row level security;
alter table public.subject_term_grade_release_history enable row level security;

revoke all on public.released_subject_term_grades from anon, authenticated;
revoke all on public.subject_term_grade_release_history from anon, authenticated;

comment on column public.grade_schemes.subject_weight is
  'Weight of this completed grade type in the final subject grade. Grade types within one subject and grading period must total 100%.';

comment on table public.released_subject_term_grades is
  'One released final subject grade per student, subject, and grading period. Breakdown stores the contributing grade types and their components.';
