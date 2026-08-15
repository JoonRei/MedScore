import { PageHeader } from "@/components/PageHeader";
import { StudentResultsClient, type StudentResultRow } from "@/components/StudentResultsClient";
import { requireStudent } from "@/lib/student-session";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function Page() {
  const { student } = await requireStudent();
  const { data } = await createAdminClient()
    .from("scores")
    .select("score,assessments!inner(id,title,assessment_type,assessment_date,total_score,status,subjects(name))")
    .eq("student_id", student.id)
    .eq("assessments.status", "published")
    .order("created_at", { ascending: false });

  const rows: StudentResultRow[] = (data || []).map((item: any) => {
    const assessment = Array.isArray(item.assessments) ? item.assessments[0] : item.assessments;
    const subject = Array.isArray(assessment?.subjects) ? assessment.subjects[0] : assessment?.subjects;
    return { id: assessment.id, title: assessment.title, type: assessment.assessment_type, date: assessment.assessment_date, total: Number(assessment.total_score), score: Number(item.score), subject: subject?.name || "Subject" };
  });

  return <><PageHeader eyebrow="Academic records" title="Results" description="Your history of available assessment scores."/><StudentResultsClient rows={rows} /></>;
}
