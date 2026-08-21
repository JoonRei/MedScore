-- MedScores V4.21
-- Device push subscriptions for Student score-release notifications.

create table if not exists public.student_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  owner_id uuid not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_push_subscriptions_student_id_idx
  on public.student_push_subscriptions(student_id);

create index if not exists student_push_subscriptions_owner_id_idx
  on public.student_push_subscriptions(owner_id);

alter table public.student_push_subscriptions enable row level security;

-- MedScores reads/writes this table only from authenticated server routes.
