-- MedScores V4.23 — Term Grades
-- Run once in Supabase SQL Editor before using /admin/grades.

create extension if not exists pgcrypto;

create table if not exists public.grade_schemes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  name text not null default 'Term Grade',
  rounding_digits smallint not null default 0 check (rounding_digits between 0 and 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, subject_id)
);

create table if not exists public.grade_components (
  id uuid primary key default gen_random_uuid(),
  scheme_id uuid not null references public.grade_schemes(id) on delete cascade,
  name text not null,
  weight numeric(6,3) not null check (weight > 0 and weight <= 100),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.grade_component_assessments (
  component_id uuid not null references public.grade_components(id) on delete cascade,
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (component_id, assessment_id),
  unique (assessment_id)
);

create table if not exists public.released_term_grades (
  id uuid primary key default gen_random_uuid(),
  scheme_id uuid not null references public.grade_schemes(id) on delete cascade,
  owner_id uuid not null,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  raw_percentage numeric(7,3) not null check (raw_percentage between 0 and 100),
  term_grade numeric(7,3) not null check (term_grade between 40 and 100),
  breakdown jsonb not null default '[]'::jsonb,
  first_released_at timestamptz not null default now(),
  released_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scheme_id, student_id)
);


create table if not exists public.term_grade_release_history (
  id uuid primary key default gen_random_uuid(),
  scheme_id uuid not null references public.grade_schemes(id) on delete cascade,
  owner_id uuid not null,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  raw_percentage numeric(7,3) not null check (raw_percentage between 0 and 100),
  term_grade numeric(7,3) not null check (term_grade between 40 and 100),
  breakdown jsonb not null default '[]'::jsonb,
  released_at timestamptz not null default now(),
  released_by uuid not null
);

create index if not exists grade_schemes_subject_idx on public.grade_schemes(subject_id);
create index if not exists grade_components_scheme_idx on public.grade_components(scheme_id);
create index if not exists released_term_grades_student_idx on public.released_term_grades(student_id, released_at desc);
create index if not exists released_term_grades_subject_idx on public.released_term_grades(subject_id, released_at desc);
create index if not exists term_grade_release_history_student_idx on public.term_grade_release_history(student_id, released_at desc);

-- These tables are intentionally server-only. MedScores' authenticated server
-- routes verify the admin/student first, then use the existing admin client.
alter table public.grade_schemes enable row level security;
alter table public.grade_components enable row level security;
alter table public.grade_component_assessments enable row level security;
alter table public.released_term_grades enable row level security;
alter table public.term_grade_release_history enable row level security;

revoke all on public.grade_schemes from anon, authenticated;
revoke all on public.grade_components from anon, authenticated;
revoke all on public.grade_component_assessments from anon, authenticated;
revoke all on public.released_term_grades from anon, authenticated;
revoke all on public.term_grade_release_history from anon, authenticated;
