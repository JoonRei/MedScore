import { PageHeader } from "@/components/PageHeader";
import { ReportsClient } from "@/components/ReportsClient";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";

export default async function Page() {
  await requireAdmin();
  const { data } = await createAdminClient().from("assessments").select("id,title,assessment_type,assessment_date,total_score,passing_score,status,subjects(name),scores(score)").eq("status", "published").order("assessment_date", { ascending: false });
  const reports = (data || []).map((assessment: any) => {
    const subject = Array.isArray(assessment.subjects) ? assessment.subjects[0] : assessment.subjects;
    return { id: assessment.id, title: assessment.title, type: assessment.assessment_type, date: assessment.assessment_date, total: Number(assessment.total_score), passing: assessment.passing_score == null ? null : Number(assessment.passing_score), subject: subject?.name || "Subject", scores: (assessment.scores || []).map((item: any) => Number(item.score)) };
  });
  return <><PageHeader eyebrow="Analytics" title="Reports" description="Class-level summaries for released assessment results."/><ReportsClient reports={reports} /></>;
}
