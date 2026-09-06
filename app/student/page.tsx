import { Leaderboard } from "@/components/Leaderboard";
import { StudentWelcomeHeader } from "@/components/StudentWelcomeHeader";
import { requireStudent } from "@/lib/student-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate, scoreFill } from "@/lib/utils";

const categories = ["Quiz", "Long Exam", "Pre-Test", "Post-Test"];

function safeTime(value: unknown) {
  const parsed = value ? new Date(String(value)).getTime() : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

export default async function Page() {
  const { student } = await requireStudent();
  const db = createAdminClient();

  const [{ data: activePeriod }, { data: ownEnrollments }] = await Promise.all([
    db.from("academic_periods")
      .select("academic_year,term")
      .eq("owner_id", student.owner_id)
      .eq("is_active", true)
      .maybeSingle(),
    db.from("enrollments")
      .select("subject_id")
      .eq("student_id", student.id),
  ]);

  const subjectIds = Array.from(new Set((ownEnrollments || []).map((row: any) => String(row.subject_id || "")).filter(Boolean)));

  const [
    { data: scores },
    { data: views },
  ] = await Promise.all([
    db.from("scores")
      .select("score,result_status,assessments!inner(id,title,assessment_type,total_score,passing_score,assessment_date,doctor_name,status,released_at,subjects(id,name,code,term,academic_year))")
      .eq("student_id", student.id)
      .eq("assessments.status", "published")
      .order("created_at", { ascending: false }),
    db.from("student_result_views")
      .select("assessment_id,viewed_at")
      .eq("student_id", student.id),
  ]);

  // Coming up next is assessment-driven rather than score-driven. That means a
  // newly created draft assessment can appear for enrolled students immediately,
  // even before a score row exists. Numerical scores are intentionally not queried.
  let pendingAssessmentRows: any[] = [];
  if (subjectIds.length) {
    const { data: pendingAssessments, error: pendingAssessmentError } = await db
      .from("assessments")
      .select("id,subject_id,title,assessment_type,assessment_date,status,released_at,doctor_name,created_at,subjects!inner(id,name,code,term,academic_year,is_archived)")
      .in("subject_id", subjectIds)
      .order("created_at", { ascending: false });

    if (pendingAssessmentError) {
      console.error("student home: pending assessments query failed", pendingAssessmentError);
    } else {
      pendingAssessmentRows = pendingAssessments || [];
    }
  }

  const viewMap = new Map<string, string>();
  for (const view of views || []) {
    const assessmentId = String((view as any).assessment_id || "");
    const viewedAt = String((view as any).viewed_at || "");
    if (!assessmentId || !viewedAt) continue;
    const previous = viewMap.get(assessmentId);
    if (!previous || safeTime(viewedAt) > safeTime(previous)) {
      viewMap.set(assessmentId, viewedAt);
    }
  }

  const rows = (scores || [])
    .map((row: any) => {
      const assessment = Array.isArray(row.assessments) ? row.assessments[0] : row.assessments;
      const subject = Array.isArray(assessment?.subjects) ? assessment.subjects[0] : assessment?.subjects;
      const viewedAt = assessment ? (viewMap.get(assessment.id) as string | undefined) : undefined;
      const releasedAt = assessment?.released_at as string | null | undefined;
      return {
        ...row,
        assessment,
        subject,
        isNew: Boolean(releasedAt && (!viewedAt || safeTime(viewedAt) < safeTime(releasedAt))),
      };
    })
    .filter(
      (row: any) =>
        row.assessment &&
        Boolean(row.assessment.released_at) &&
        (!activePeriod ||
          (row.subject?.academic_year === activePeriod.academic_year && row.subject?.term === activePeriod.term)),
    )
    .sort((a: any, b: any) => safeTime(b.assessment.released_at) - safeTime(a.assessment.released_at));

  const allPendingRows = pendingAssessmentRows
    .map((assessment: any) => {
      const subject = Array.isArray(assessment?.subjects) ? assessment.subjects[0] : assessment?.subjects;
      return { assessment, subject };
    })
    .filter((row: any) => {
      if (!row.assessment || !row.subject || row.subject.is_archived) return false;
      if (row.assessment.status === "published" && row.assessment.released_at) return false;
      if (activePeriod && (row.subject.academic_year !== activePeriod.academic_year || row.subject.term !== activePeriod.term)) return false;
      return true;
    })
    .sort((a: any, b: any) => {
      const createdDelta = safeTime(b.assessment.created_at) - safeTime(a.assessment.created_at);
      if (createdDelta) return createdDelta;
      return safeTime(b.assessment.assessment_date) - safeTime(a.assessment.assessment_date);
    });

  const pendingRows = allPendingRows.slice(0, 3);

  const scoredRows = rows.filter(
    (row: any) => row.result_status !== "absent" && row.score !== null && row.score !== undefined,
  );
  const absentCount = rows.filter((row: any) => row.result_status === "absent").length;
  const gradedForPassing = scoredRows.filter(
    (row: any) => row.assessment.passing_score !== null && row.assessment.passing_score !== undefined,
  );
  const passed = gradedForPassing.filter(
    (row: any) => Number(row.score) >= Number(row.assessment.passing_score),
  ).length;
  const latest = scoredRows[0] || null;
  const newCount = rows.filter((row: any) => row.isNew).length;

  return (
    <>
      <StudentWelcomeHeader codeName={student.code_name} />

      <section className="performance-hero compact-performance-hero student-v2-hero student-premium-hero-v437 student-latest-result-v438 student-latest-result-v439">
        <div className="performance-hero-top">
          <div>
            <div className="label">Latest result</div>
            <div className="big">{latest ? `${latest.score} / ${latest.assessment.total_score}` : "—"}</div>
            {latest ? (
              <p>{latest.assessment.title} · {latest.subject?.name || "Subject"} · {formatDate(latest.assessment.assessment_date)}</p>
            ) : (
              <p>Your latest score will appear here once an assessment result is released.</p>
            )}
          </div>
          <span className="badge badge-purple hero-year-badge student-year-chip-v437">{student.year_level}</span>
        </div>
        <div className="progress" aria-hidden="true">
          <span style={{ width: `${latest ? scoreFill(Number(latest.score), Number(latest.assessment.total_score)) : 0}%` }} />
        </div>
      </section>

      <section className="student-coming-up-v437 student-coming-up-v438 student-coming-up-v439" aria-labelledby="coming-up-title-v438">
        <div className="student-coming-up-head-v437 student-coming-up-head-v438 student-coming-up-head-v439">
          <div>
            <h2 id="coming-up-title-v438">Coming up next</h2>
            <p>Assessments from your subjects that are not released yet.</p>
          </div>
        </div>

        {pendingRows.length ? (
          <div className="student-coming-up-list-v437 student-coming-up-list-v438 student-coming-up-list-v439">
            {pendingRows.map((row: any) => {
              const draft = row.assessment.status !== "published";
              return (
                <article className="student-coming-up-card-v437 student-coming-up-card-v438 student-coming-up-card-v439" key={row.assessment.id}>
                  <div className="student-coming-up-card-top-v437">
                    <span>{row.subject?.code || row.subject?.name || "Subject"}</span>
                    <strong className={draft ? "is-upcoming" : "is-pending"}>{draft ? "Upcoming" : "Result pending"}</strong>
                  </div>
                  <h3>{row.assessment.title}</h3>
                  <p>{row.subject?.name || "Subject"}</p>
                  <div className="student-coming-up-meta-v437">
                    <span>{row.assessment.assessment_type}</span>
                    <time dateTime={row.assessment.assessment_date}>{formatDate(row.assessment.assessment_date)}</time>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="student-coming-up-empty-v437 student-coming-up-empty-v438 student-coming-up-empty-v439">
            <span aria-hidden="true" />
            <div>
              <strong>Nothing pending right now</strong>
              <p>New draft or unreleased assessments from your subjects will appear here.</p>
            </div>
          </div>
        )}
      </section>

      <div className="student-metric-grid student-v2-metrics student-premium-metrics-v437 student-home-metrics-v438 student-home-metrics-v439">
        <div className="student-metric"><span>Results</span><strong>{rows.length}</strong><small>{scoredRows.length} with scores</small></div>
        <div className="student-metric"><span>Unread</span><strong>{newCount}</strong><small>{newCount ? "waiting for you" : "all caught up"}</small></div>
        <div className="student-metric"><span>Passed</span><strong>{gradedForPassing.length ? `${passed}/${gradedForPassing.length}` : "—"}</strong><small>{gradedForPassing.length ? "with a passing mark" : "no passing mark set"}</small></div>
        <div className="student-metric"><span>Missed</span><strong>{absentCount}</strong><small>{absentCount === 1 ? "assessment" : "assessments"}</small></div>
      </div>

      <Leaderboard />

      <section className="section-gap student-open-section-v442 student-assessment-overview-v442">
        <div className="panel-header compact-section-header student-open-section-head-v442"><div><h2>Assessment overview</h2><p>Your latest score in each common assessment type.</p></div></div>
        <div className="category-grid refined-category-grid student-v2-category-grid student-premium-category-grid-v437 student-premium-category-grid-v438 student-premium-category-grid-v439">
          {categories.map((category) => {
            const categoryRows = scoredRows.filter((row: any) => row.assessment.assessment_type === category);
            const latestCategory = categoryRows[0] || null;
            return (
              <div className="category-card refined-category-card student-v2-category-card" key={category}>
                <span>{category}</span>
                <strong>{latestCategory ? `${latestCategory.score} / ${latestCategory.assessment.total_score}` : "—"}</strong>
                <small>{categoryRows.length} scored result{categoryRows.length === 1 ? "" : "s"}</small>
              </div>
            );
          })}
        </div>
      </section>


    </>
  );
}
