create extension if not exists pgcrypto;
create extension if not exists citext;

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  student_number text unique,
  first_name text not null,
  last_name text not null,
  code_name citext not null unique,
  pin_hash text not null,
  year_level text not null,
  section text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text,
  year_level text not null,
  term text not null,
  academic_year text not null,
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(student_id, subject_id)
);

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  title text not null,
  assessment_type text not null,
  assessment_date date not null,
  total_score numeric(10,2) not null check (total_score > 0),
  passing_score numeric(10,2),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (passing_score is null or (passing_score >= 0 and passing_score <= total_score))
);

create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  score numeric(10,2) not null check (score >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(assessment_id, student_id)
);

create table if not exists public.student_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.student_login_attempts (
  identifier citext primary key,
  attempts integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists idx_enrollments_student on public.enrollments(student_id);
create index if not exists idx_enrollments_subject on public.enrollments(subject_id);
create index if not exists idx_assessments_subject on public.assessments(subject_id);
create index if not exists idx_assessments_status on public.assessments(status);
create index if not exists idx_scores_student on public.scores(student_id);
create index if not exists idx_scores_assessment on public.scores(assessment_id);
create index if not exists idx_student_sessions_hash on public.student_sessions(token_hash);
create index if not exists idx_student_sessions_expiry on public.student_sessions(expires_at);

alter table public.students enable row level security;
alter table public.subjects enable row level security;
alter table public.enrollments enable row level security;
alter table public.assessments enable row level security;
alter table public.scores enable row level security;
alter table public.student_sessions enable row level security;
alter table public.student_login_attempts enable row level security;

-- Intentionally no anon/authenticated data policies. All academic reads/writes are
-- authorized by Next.js server routes using the server-only Supabase secret key.
-- Keep only the administrator account in Supabase Authentication > Users. Students use the separate code-name + PIN system.

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists students_touch_updated_at on public.students;
create trigger students_touch_updated_at
before update on public.students
for each row execute function public.touch_updated_at();

drop trigger if exists assessments_touch_updated_at on public.assessments;
create trigger assessments_touch_updated_at
before update on public.assessments
for each row execute function public.touch_updated_at();

drop trigger if exists scores_touch_updated_at on public.scores;
create trigger scores_touch_updated_at
before update on public.scores
for each row execute function public.touch_updated_at();
