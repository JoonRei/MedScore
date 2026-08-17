-- MedScores V2.0 migration
-- Run once in Supabase SQL Editor before deploying V2.0.

alter table public.assessments
  add column if not exists doctor_name text;

alter table public.scores
  alter column score drop not null;

alter table public.scores
  add column if not exists result_status text not null default 'scored';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'scores_result_status_check'
      and conrelid = 'public.scores'::regclass
  ) then
    alter table public.scores
      add constraint scores_result_status_check
      check (result_status in ('scored', 'absent'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'scores_status_value_check'
      and conrelid = 'public.scores'::regclass
  ) then
    alter table public.scores
      add constraint scores_status_value_check
      check (
        (result_status = 'scored' and score is not null)
        or (result_status = 'absent' and score is null)
      );
  end if;
end $$;
