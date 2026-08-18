import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { requireStudent } from "@/lib/student-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/utils";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { student } = await requireStudent();
  const db = createAdminClient();
  const { data: enrollment } = await db.from("enrollments").select("id").eq("student_id", student.id).eq("subject_id", id).maybeSingle();
  if (!enrollment) notFound();

  const [{ data: subject }, { data: assessments }] = await Promise.all([
    db.from("subjects").select("*").eq("id", id).single(),
    db.from("assessments").select("id,title,assessment_type,assessment_date,total_score,passing_score,doctor_name").eq("subject_id", id).eq("status", "published").order("assessment_date", { ascending: false }),
  ]);
  if (!subject) notFound();

  const ids = (assessments || []).map((item: any) => item.id);
  const { data: scoreRows } = ids.length ? await db.from("scores").select("assessment_id,score,result_status").eq("student_id", student.id).in("assessment_id", ids) : { data: [] as any[] };
  const scoreMap = new Map((scoreRows || []).map((item: any) => [item.assessment_id, item]));

  return <><PageHeader eyebrow={subject.code || "Subject"} title={subject.name} description={`${subject.term} · ${subject.academic_year}`} />
    <div className="result-list">
      {(assessments || []).map((assessment: any) => {
        const entry: any = scoreMap.get(assessment.id);
        const absent = entry?.result_status === "absent";
        const score = entry?.score;
        return <div className={`result-card ${absent ? "is-absent" : ""}`} key={assessment.id}>
          <div className="result-main"><div className="meta"><span>{assessment.assessment_type}</span><span>·</span><span>{formatDate(assessment.assessment_date)}</span></div><h3>{assessment.title}</h3><p>{assessment.doctor_name ? assessment.doctor_name : absent ? "Did not take" : score === undefined ? "No score recorded yet" : assessment.passing_score != null ? (Number(score) >= Number(assessment.passing_score) ? "Passed" : "Below passing score") : "Recorded result"}</p></div>
          <div className="result-score">{absent ? <><strong>Did not take</strong><small>No score recorded</small></> : <><strong>{score === undefined ? "—" : `${score} / ${assessment.total_score}`}</strong><small>{score === undefined ? "Not recorded" : assessment.passing_score != null ? (Number(score) >= Number(assessment.passing_score) ? "Passed" : "Below passing score") : "Recorded result"}</small></>}</div>
        </div>;
      })}
      {!(assessments || []).length && <EmptyState title="No results yet" description="Results for this subject will appear here when they are ready." />}
    </div>
  </>;
}
