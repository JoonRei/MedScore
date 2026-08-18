import { PageHeader } from "@/components/PageHeader";
import { StudentResultsClient, type StudentResultRow } from "@/components/StudentResultsClient";
import { requireStudent } from "@/lib/student-session";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function Page() {
  const { student } = await requireStudent();
  const db = createAdminClient();
  const [{ data }, { data: views }] = await Promise.all([
    db.from("scores")
      .select("score,result_status,assessments!inner(id,title,assessment_type,assessment_date,total_score,passing_score,doctor_name,status,released_at,subjects(name))")
      .eq("student_id", student.id)
      .eq("assessments.status", "published")
      .order("created_at", { ascending: false }),
    db.from("student_result_views").select("assessment_id,viewed_at").eq("student_id", student.id),
  ]);
  const viewMap = new Map((views || []).map((view: any) => [view.assessment_id, view.viewed_at]));

  const rows: StudentResultRow[] = (data || []).map((item: any) => {
    const assessment = Array.isArray(item.assessments) ? item.assessments[0] : item.assessments;
    const subject = Array.isArray(assessment?.subjects) ? assessment.subjects[0] : assessment?.subjects;
    const viewedAt = viewMap.get(assessment.id) as string | undefined;
    const releasedAt = assessment.released_at as string | null;
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
      isNew: Boolean(releasedAt && (!viewedAt || new Date(viewedAt).getTime() < new Date(releasedAt).getTime())),
    };
  });

  return <>
    <PageHeader eyebrow="Student Portal" title="Results" description="Review your released assessment scores and result status." />
    <StudentResultsClient rows={rows} />
  </>;
}
