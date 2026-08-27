-- MedScores V4.24 — Grading periods, optional grade tracks, and optional subcomponents
-- Run AFTER database/v4.23_term_grades.sql.
-- Existing Term Grades configuration is preserved under Prelim / Subject grade.

alter table public.grade_schemes
  add column if not exists grading_period text not null default 'prelim',
  add column if not exists track_key text not null default 'overall',
  add column if not exists track_name text not null default 'Subject grade',
  add column if not exists track_sort_order integer not null default 0;

-- Normalize any rows created by the previous Term Grades version.
update public.grade_schemes
set grading_period = coalesce(nullif(grading_period, ''), 'prelim'),
    track_key = coalesce(nullif(track_key, ''), 'overall'),
    track_name = case when coalesce(nullif(track_name, ''), 'Subject grade') = 'Overall' then 'Subject grade' else coalesce(nullif(track_name, ''), 'Subject grade') end;

alter table public.grade_schemes
  drop constraint if exists grade_schemes_owner_id_subject_id_key;

alter table public.grade_schemes
  drop constraint if exists grade_schemes_grading_period_check;

alter table public.grade_schemes
  add constraint grade_schemes_grading_period_check
  check (grading_period in ('prelim', 'midterm', 'finals'));

create unique index if not exists grade_schemes_owner_subject_period_track_uidx
  on public.grade_schemes(owner_id, subject_id, grading_period, track_key);

create index if not exists grade_schemes_subject_period_idx
  on public.grade_schemes(subject_id, grading_period, track_sort_order);

alter table public.grade_components
  add column if not exists parent_component_id uuid null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'grade_components_parent_component_id_fkey'
  ) then
    alter table public.grade_components
      add constraint grade_components_parent_component_id_fkey
      foreign key (parent_component_id)
      references public.grade_components(id)
      on delete cascade;
  end if;
end $$;

create index if not exists grade_components_parent_idx
  on public.grade_components(parent_component_id, sort_order);

comment on column public.grade_schemes.grading_period is 'prelim, midterm, or finals';
comment on column public.grade_schemes.track_name is 'Optional grading track label such as Lecture / Didactics or Practicals / Clinics. Subject grade is the default single-track label.';
comment on column public.grade_components.parent_component_id is 'Optional one-level subcomponent parent. Null means a top-level grade component.';
