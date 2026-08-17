-- MedScores V1.9
-- Optional cleanup for existing projects. The application no longer reads or writes this field.
alter table public.students drop column if exists section;
