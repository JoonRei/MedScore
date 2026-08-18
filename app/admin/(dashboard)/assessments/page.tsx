import { PageHeader } from "@/components/PageHeader";
import { AssessmentsClient } from "@/components/AssessmentsClient";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";

export default async function Page() {
  await requireAdmin();
  const db = createAdminClient();
  const [{ data: assessments }, { data: subjects }] = await Promise.all([
    db.from("assessments")
      .select("*,subjects(id,name,code,enrollments(student_id)),scores(student_id,result_status)")
      .order("assessment_date", { ascending: false }),
    db.from("subjects").select("id,name").eq("is_archived", false).order("name"),
  ]);
  return <>
    <PageHeader eyebrow="Scores" title="Assessments" description="Create quizzes, long exams, pre-tests, post-tests, term exams and other assessment types." />
    <AssessmentsClient assessments={(assessments || []) as any[]} subjects={(subjects || []) as any[]} />
  </>;
}
