import { PageHeader } from "@/components/PageHeader";
import { AssessmentsClient } from "@/components/AssessmentsClient";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminWorkspace } from "@/lib/admin-workspace";

export default async function Page() {
  const context = await requireAdminWorkspace();
  const db = createAdminClient();
  let assessmentsQuery = db.from("assessments")
    .select("*,subjects!inner(id,name,code,owner_id,academic_year,term,enrollments(student_id)),scores(student_id,result_status)")
    .eq("subjects.owner_id", context.workspace.id)
    .order("assessment_date", { ascending: false });
  let subjectsQuery = db.from("subjects").select("id,name").eq("owner_id", context.workspace.id).eq("is_archived", false).order("name");
  if (context.period) {
    assessmentsQuery = assessmentsQuery.eq("subjects.academic_year", context.period.academic_year).eq("subjects.term", context.period.term);
    subjectsQuery = subjectsQuery.eq("academic_year", context.period.academic_year).eq("term", context.period.term);
  }
  const [{ data: assessments }, { data: subjects }] = await Promise.all([assessmentsQuery, subjectsQuery]);
  return <>
    <PageHeader eyebrow="Scores" title="Assessments" description="Create quizzes, long exams, pre-tests, post-tests, term exams and other assessment types." />
    <AssessmentsClient assessments={(assessments || []) as any[]} subjects={(subjects || []) as any[]} />
  </>;
}
