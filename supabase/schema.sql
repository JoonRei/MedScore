create extension if not exists pgcrypto;
create extension if not exists citext;

create table if not exists public.admin_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext not null unique,
  display_name text not null,
  role text not null default 'member' check (role in ('owner', 'member')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.admin_profiles(id) on delete restrict,
  student_number text unique,
  first_name text not null,
  last_name text not null,
  code_name citext not null unique,
  pin_hash text not null,
  year_level text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.admin_profiles(id) on delete restrict,
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
  doctor_name text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (passing_score is null or (passing_score >= 0 and passing_score <= total_score))
);

create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  score numeric(10,2) check (score >= 0),
  result_status text not null default 'scored' check (result_status in ('scored', 'absent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(assessment_id, student_id),
  check ((result_status = 'scored' and score is not null) or (result_status = 'absent' and score is null))
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

create table if not exists public.academic_periods (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.admin_profiles(id) on delete cascade,
  academic_year text not null,
  term text not null check (term in ('1st Semester', '2nd Semester', 'Summer')),
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists academic_periods_owner_period_idx on public.academic_periods(owner_id, academic_year, term);
create unique index if not exists academic_periods_one_active_per_owner_idx on public.academic_periods(owner_id) where is_active = true;

create table if not exists public.student_result_views (
  student_id uuid not null references public.students(id) on delete cascade,
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (student_id, assessment_id)
);

create table if not exists public.student_passkeys (
  credential_id text primary key,
  student_id uuid not null references public.students(id) on delete cascade,
  webauthn_user_id text not null,
  public_key text not null,
  counter bigint not null default 0,
  device_type text,
  backed_up boolean not null default false,
  transports text[],
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create table if not exists public.student_webauthn_challenges (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  purpose text not null check (purpose in ('register', 'authenticate')),
  challenge text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_students_owner on public.students(owner_id);
create index if not exists idx_subjects_owner on public.subjects(owner_id);
create index if not exists idx_academic_periods_owner on public.academic_periods(owner_id);
create index if not exists idx_enrollments_student on public.enrollments(student_id);
create index if not exists idx_enrollments_subject on public.enrollments(subject_id);
create index if not exists idx_assessments_subject on public.assessments(subject_id);
create index if not exists idx_assessments_status on public.assessments(status);
create index if not exists idx_scores_student on public.scores(student_id);
create index if not exists idx_scores_assessment on public.scores(assessment_id);
create index if not exists idx_student_sessions_hash on public.student_sessions(token_hash);
create index if not exists idx_student_sessions_expiry on public.student_sessions(expires_at);
create index if not exists idx_student_result_views_student on public.student_result_views(student_id);
create index if not exists idx_student_passkeys_student on public.student_passkeys(student_id);
create index if not exists idx_student_webauthn_challenges_student on public.student_webauthn_challenges(student_id);
create index if not exists idx_student_webauthn_challenges_expiry on public.student_webauthn_challenges(expires_at);

alter table public.admin_profiles enable row level security;
alter table public.students enable row level security;
alter table public.subjects enable row level security;
alter table public.enrollments enable row level security;
alter table public.assessments enable row level security;
alter table public.scores enable row level security;
alter table public.student_sessions enable row level security;
alter table public.student_login_attempts enable row level security;
alter table public.academic_periods enable row level security;
alter table public.student_result_views enable row level security;
alter table public.student_passkeys enable row level security;
alter table public.student_webauthn_challenges enable row level security;

-- Intentionally no anon/authenticated academic data policies. All reads/writes are
-- authorized by Next.js server routes using the server-only Supabase secret key.

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
create trigger students_touch_updated_at before update on public.students for each row execute function public.touch_updated_at();
drop trigger if exists assessments_touch_updated_at on public.assessments;
create trigger assessments_touch_updated_at before update on public.assessments for each row execute function public.touch_updated_at();
drop trigger if exists scores_touch_updated_at on public.scores;
create trigger scores_touch_updated_at before update on public.scores for each row execute function public.touch_updated_at();
drop trigger if exists admin_profiles_touch_updated_at on public.admin_profiles;
create trigger admin_profiles_touch_updated_at before update on public.admin_profiles for each row execute function public.touch_updated_at();
