import { PageHeader } from "@/components/PageHeader";
import { StudentResultsClient, type StudentResultRow } from "@/components/StudentResultsClient";
import { requireStudent } from "@/lib/student-session";
import { createAdminClient } from "@/lib/supabase/admin";

type AggregateScoreRow = {
  assessment_id: string;
  student_id: string;
  score: number | null;
  result_status: string | null;
};

function buildClassStats(rows: AggregateScoreRow[]) {
  // One student should contribute exactly one score to the class comparison.
  // This protects the distribution from duplicate score rows for the same
  // student/assessment while keeping legitimate identical class scores intact.
  const scoreByStudent = new Map<string, number>();

  for (const row of rows) {
    if (row.result_status === "absent" || row.score == null) continue;
    const value = Number(row.score);
    if (!Number.isFinite(value)) continue;

    const studentId = String(row.student_id || "").trim();
    if (!studentId) continue;
    scoreByStudent.set(studentId, value);
  }

  const values = Array.from(scoreByStudent.values());
  if (!values.length) return null;

  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    low: Math.min(...values),
    mean: Number((total / values.length).toFixed(1)),
    high: Math.max(...values),
    count: values.length,
  };
}

export default async function Page({ searchParams }: { searchParams: Promise<{ assessment?: string }> }) {
  const params = await searchParams;
  const { student } = await requireStudent();
  const db = createAdminClient();
  const [{ data }, { data: views }, { data: activePeriod }] = await Promise.all([
    db.from("scores")
      .select("score,result_status,assessments!inner(id,title,assessment_type,assessment_date,total_score,passing_score,doctor_name,status,released_at,subjects(name,term,academic_year))")
      .eq("student_id", student.id)
      .eq("assessments.status", "published")
      .order("created_at", { ascending: false }),
    db.from("student_result_views").select("assessment_id,viewed_at").eq("student_id", student.id),
    db.from("academic_periods").select("academic_year,term").eq("owner_id", student.owner_id).eq("is_active", true).maybeSingle(),
  ]);

  const viewMap = new Map((views || []).map((view: any) => [view.assessment_id, view.viewed_at]));

  const baseRows: StudentResultRow[] = (data || []).flatMap((item: any) => {
    const assessment = Array.isArray(item.assessments) ? item.assessments[0] : item.assessments;
    const subject = Array.isArray(assessment?.subjects) ? assessment.subjects[0] : assessment?.subjects;
    if (!assessment || (activePeriod && (subject?.academic_year !== activePeriod.academic_year || subject?.term !== activePeriod.term))) return [];
    const viewedAt = viewMap.get(assessment.id) as string | undefined;
    const releasedAt = assessment.released_at as string | null;
    return [{
      id: assessment.id,
      title: assessment.title,
      type: assessment.assessment_type,
      date: assessment.assessment_date,
      total: Number(assessment.total_score),
      score: item.score == null ? null : Number(item.score),
      passing: assessment.passing_score == null ? null : Number(assessment.passing_score),
      status: item.result_status === "absent" ? "absent" : item.result_status === "scored" && item.score != null ? "scored" : "not_entered",
      doctor: assessment.doctor_name || null,
      subject: subject?.name || "Subject",
      isNew: Boolean(releasedAt && (!viewedAt || new Date(viewedAt).getTime() < new Date(releasedAt).getTime())),
      classStats: null,
    }];
  });

  const assessmentIds = Array.from(new Set(baseRows.map((row) => row.id)));
  const statsByAssessment = new Map<string, ReturnType<typeof buildClassStats>>();

  if (assessmentIds.length) {
    // Read each assessment exactly the same way the Admin score-entry page does.
    // This keeps every Low / Mean / High calculation isolated to one assessment
    // and avoids any cross-assessment aggregation ambiguity.
    const statsResults = await Promise.all(
      assessmentIds.map(async (assessmentId) => {
        const { data: scoreRows, error } = await db
          .from("scores")
          .select("assessment_id,student_id,score,result_status")
          .eq("assessment_id", assessmentId);

        return {
          assessmentId,
          rows: (scoreRows || []) as AggregateScoreRow[],
          error,
        };
      })
    );

    for (const result of statsResults) {
      if (result.error) {
        console.error(
          `student results: class score query failed for assessment ${result.assessmentId}`,
          result.error
        );
        continue;
      }

      statsByAssessment.set(result.assessmentId, buildClassStats(result.rows));
    }
  }

  const rows = baseRows.map((row) => ({
    ...row,
    classStats: statsByAssessment.get(row.id) ?? null,
  }));

  return <>
    <PageHeader eyebrow="Student Portal" title="Results" description="Review your released assessment scores and result status." />
    <StudentResultsClient rows={rows} initialOpenId={String(params.assessment || "")} />
  </>;
}
