-- MedScores V4.1 migration
-- Run once in Supabase SQL Editor after the V4.0 migration.
-- Adds multi-user workspaces, per-workspace academic periods, and student passkeys.

create table if not exists public.admin_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext not null unique,
  display_name text not null,
  role text not null default 'member' check (role in ('owner', 'member')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.admin_profiles (id, email, display_name, role, is_active)
select
  u.id,
  lower(coalesce(u.email, '')),
  coalesce(nullif(split_part(coalesce(u.email, ''), '@', 1), ''), 'Administrator'),
  'member',
  true
from auth.users u
where coalesce(u.email, '') <> ''
on conflict (id) do update set email = excluded.email;

-- Existing MedScores installations had one Supabase Auth Admin account.
-- Give the earliest existing account ownership for the initial migration.
do $$
declare
  bootstrap_owner uuid;
begin
  select id into bootstrap_owner from auth.users order by created_at asc nulls last limit 1;
  if bootstrap_owner is not null and not exists (select 1 from public.admin_profiles where role = 'owner') then
    update public.admin_profiles set role = 'owner' where id = bootstrap_owner;
  end if;
end $$;

alter table public.students add column if not exists owner_id uuid references public.admin_profiles(id) on delete restrict;
alter table public.subjects add column if not exists owner_id uuid references public.admin_profiles(id) on delete restrict;
alter table public.academic_periods add column if not exists owner_id uuid references public.admin_profiles(id) on delete cascade;

-- Preserve all existing records by assigning them to the original/earliest Admin workspace.
do $$
declare
  bootstrap_owner uuid;
begin
  select id into bootstrap_owner from public.admin_profiles order by (role = 'owner') desc, created_at asc limit 1;
  if bootstrap_owner is not null then
    update public.students set owner_id = bootstrap_owner where owner_id is null;
    update public.subjects set owner_id = bootstrap_owner where owner_id is null;
    update public.academic_periods set owner_id = bootstrap_owner where owner_id is null;
  end if;
end $$;

alter table public.students alter column owner_id set not null;
alter table public.subjects alter column owner_id set not null;
alter table public.academic_periods alter column owner_id set not null;

-- V4.0 periods were globally unique/current. V4.1 makes those rules workspace-specific.
alter table public.academic_periods drop constraint if exists academic_periods_academic_year_term_key;
drop index if exists academic_periods_one_active_idx;
create unique index if not exists academic_periods_owner_period_idx
  on public.academic_periods (owner_id, academic_year, term);
create unique index if not exists academic_periods_one_active_per_owner_idx
  on public.academic_periods (owner_id)
  where is_active = true;

create index if not exists students_owner_idx on public.students(owner_id);
create index if not exists subjects_owner_idx on public.subjects(owner_id);
create index if not exists academic_periods_owner_idx on public.academic_periods(owner_id);

-- Student passkeys / platform authenticators.
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

create index if not exists student_passkeys_student_idx on public.student_passkeys(student_id);

create table if not exists public.student_webauthn_challenges (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  purpose text not null check (purpose in ('register', 'authenticate')),
  challenge text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists student_webauthn_challenges_student_idx on public.student_webauthn_challenges(student_id);
create index if not exists student_webauthn_challenges_expiry_idx on public.student_webauthn_challenges(expires_at);

alter table public.admin_profiles enable row level security;
alter table public.student_passkeys enable row level security;
alter table public.student_webauthn_challenges enable row level security;

-- Keep academic data server-only. No anon/authenticated RLS data policies are added.

create or replace function public.touch_admin_profile_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists admin_profiles_touch_updated_at on public.admin_profiles;
create trigger admin_profiles_touch_updated_at
before update on public.admin_profiles
for each row execute function public.touch_admin_profile_updated_at();
