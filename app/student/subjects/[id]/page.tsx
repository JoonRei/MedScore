import { notFound } from "next/navigation";
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

  const [{ data: subject }, { data: assessments }, { data: activePeriod }] = await Promise.all([
    db.from("subjects").select("*").eq("id", id).single(),
    db.from("assessments").select("id,title,assessment_type,assessment_date,total_score,passing_score,doctor_name").eq("subject_id", id).eq("status", "published").order("assessment_date", { ascending: false }),
    db.from("academic_periods").select("academic_year,term").eq("owner_id", student.owner_id).eq("is_active", true).maybeSingle(),
  ]);
  if (!subject || (activePeriod && (subject.academic_year !== activePeriod.academic_year || subject.term !== activePeriod.term))) notFound();

  const ids = (assessments || []).map((item: any) => item.id);
  const { data: scoreRows } = ids.length ? await db.from("scores").select("assessment_id,score,result_status").eq("student_id", student.id).in("assessment_id", ids) : { data: [] as any[] };
  const scoreMap = new Map((scoreRows || []).map((item: any) => [item.assessment_id, item]));

  return <>
    <header className="student-subject-detail-header-v448">
      <div className="student-subject-detail-meta-v448">
        <span className="student-subject-detail-code-v448">{subject.code || "Subject"}</span>
        <span>{subject.term}</span>
      </div>
      <h1>{subject.name}</h1>
      <p>{subject.academic_year}</p>
    </header>

    <section className="student-subject-assessments-v448">
      <div className="student-section-heading-v448">
        <h2>Assessments</h2>
        <p>Your released assessment entries for this subject.</p>
      </div>
      <div className="student-subject-assessment-list-v448">
        {(assessments || []).map((assessment: any) => {
          const entry: any = scoreMap.get(assessment.id);
          const absent = entry?.result_status === "absent";
          const score = entry?.score;
          const hasScore = score !== null && score !== undefined;
          const hasPassing = assessment.passing_score !== null && assessment.passing_score !== undefined;
          const passed = hasScore && hasPassing && Number(score) >= Number(assessment.passing_score);
          const status = absent ? "Did not take" : !hasScore ? "Not recorded" : hasPassing ? (passed ? "Passed" : "Below passing") : "Recorded";

          return <article className={`student-subject-assessment-card-v448${absent ? " is-absent" : ""}`} key={assessment.id}>
            <div className="student-subject-assessment-copy-v448">
              <div className="student-subject-assessment-meta-v448">
                <span>{assessment.assessment_type}</span>
                <time dateTime={assessment.assessment_date}>{formatDate(assessment.assessment_date)}</time>
              </div>
              <h3>{assessment.title}</h3>
              <p>{assessment.doctor_name || (absent ? "Did not take" : "Assessment result")}</p>
            </div>
            <div className="student-subject-assessment-score-v448">
              <span>{absent ? "Result" : "Score"}</span>
              <strong>{absent || !hasScore ? "—" : `${score} / ${assessment.total_score}`}</strong>
              <small className={passed ? "is-pass" : hasScore && hasPassing ? "is-below" : ""}>{status}</small>
            </div>
          </article>;
        })}
        {!(assessments || []).length && <EmptyState title="No results yet" description="Results for this subject will appear here when they are ready." />}
      </div>
    </section>
  </>;
}
