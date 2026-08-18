import { PageHeader } from "@/components/PageHeader";
import { StudentResultsClient, type StudentResultRow } from "@/components/StudentResultsClient";
import { requireStudent } from "@/lib/student-session";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function Page() {
  const { student } = await requireStudent();
  const { data } = await createAdminClient()
    .from("scores")
    .select("score,result_status,assessments!inner(id,title,assessment_type,assessment_date,total_score,passing_score,doctor_name,status,subjects(name))")
    .eq("student_id", student.id)
    .eq("assessments.status", "published")
    .order("created_at", { ascending: false });

  const rows: StudentResultRow[] = (data || []).map((item: any) => {
    const assessment = Array.isArray(item.assessments) ? item.assessments[0] : item.assessments;
    const subject = Array.isArray(assessment?.subjects) ? assessment.subjects[0] : assessment?.subjects;
    return {
      id: assessment.id,
      title: assessment.title,
      type: assessment.assessment_type,
      date: assessment.assessment_date,
      total: Number(assessment.total_score),
      score: item.score == null ? null : Number(item.score),
      passing: assessment.passing_score == null ? null : Number(assessment.passing_score),
      status: item.result_status === "absent" ? "absent" : "scored",
      doctor: assessment.doctor_name || null,
      subject: subject?.name || "Subject",
    };
  });

  return <><PageHeader eyebrow="Academic records" title="Results" description="Your assessment history in one organized view."/><StudentResultsClient rows={rows} /></>;
}
