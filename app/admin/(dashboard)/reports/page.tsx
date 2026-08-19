import { PageHeader } from "@/components/PageHeader";
import { ReportsClient } from "@/components/ReportsClient";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminWorkspace } from "@/lib/admin-workspace";

export default async function Page() {
  const context = await requireAdminWorkspace();
  let query = createAdminClient()
    .from("assessments")
    .select("id,title,assessment_type,assessment_date,total_score,passing_score,doctor_name,status,subjects!inner(name,owner_id,academic_year,term),scores(score,result_status)")
    .eq("status", "published")
    .eq("subjects.owner_id", context.workspace.id)
    .order("assessment_date", { ascending: false });
  if (context.period) query = query.eq("subjects.academic_year", context.period.academic_year).eq("subjects.term", context.period.term);
  const { data } = await query;

  const reports = (data || []).map((assessment: any) => {
    const subject = Array.isArray(assessment.subjects) ? assessment.subjects[0] : assessment.subjects;
    const entries = assessment.scores || [];
    return {
      id: assessment.id,
      title: assessment.title,
      type: assessment.assessment_type,
      date: assessment.assessment_date,
      total: Number(assessment.total_score),
      passing: assessment.passing_score == null ? null : Number(assessment.passing_score),
      doctor: assessment.doctor_name || null,
      subject: subject?.name || "Subject",
      scores: entries.filter((item: any) => item.result_status !== "absent" && item.score != null).map((item: any) => Number(item.score)),
      absent: entries.filter((item: any) => item.result_status === "absent").length,
    };
  });

  return <><PageHeader eyebrow="Analytics" title="Reports" description="Class-level summaries for assessment results."/><ReportsClient reports={reports} /></>;
}
