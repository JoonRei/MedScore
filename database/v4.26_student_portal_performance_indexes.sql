-- MedScores V4.80
-- Student Portal concurrency indexes.
-- Safe to run more than once.

create index if not exists idx_student_sessions_token_hash_expires
  on public.student_sessions (token_hash, expires_at);

create index if not exists idx_enrollments_student_subject
  on public.enrollments (student_id, subject_id);

create index if not exists idx_enrollments_subject_student
  on public.enrollments (subject_id, student_id);

create index if not exists idx_scores_student_assessment
  on public.scores (student_id, assessment_id);

create index if not exists idx_scores_assessment_student
  on public.scores (assessment_id, student_id);

create index if not exists idx_student_result_views_student_assessment
  on public.student_result_views (student_id, assessment_id);

create index if not exists idx_assessments_subject_status_released
  on public.assessments (subject_id, status, released_at desc);

create index if not exists idx_academic_periods_owner_active
  on public.academic_periods (owner_id, is_active);
