import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Leaderboard } from "@/components/Leaderboard";
import { requireStudent } from "@/lib/student-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate, scoreFill } from "@/lib/utils";

const categories = ["Quiz", "Long Exam", "Pre-Test", "Post-Test"];

export default async function Page() {
  const { student } = await requireStudent();
  const db = createAdminClient();
  const { data: activePeriod } = await db.from("academic_periods").select("academic_year,term").eq("owner_id", student.owner_id).eq("is_active", true).maybeSingle();
  const [{ data: scores }, { data: views }] = await Promise.all([
    db.from("scores")
      .select("score,result_status,assessments!inner(id,title,assessment_type,total_score,passing_score,assessment_date,doctor_name,status,released_at,subjects(id,name,code,term,academic_year))")
      .eq("student_id", student.id)
      .eq("assessments.status", "published")
      .order("created_at", { ascending: false }),
    db.from("student_result_views").select("assessment_id,viewed_at").eq("student_id", student.id),
  ]);
  const viewMap = new Map((views || []).map((view: any) => [view.assessment_id, view.viewed_at]));

  const rows = (scores || []).map((row: any) => {
    const assessment = Array.isArray(row.assessments) ? row.assessments[0] : row.assessments;
    const subject = Array.isArray(assessment?.subjects) ? assessment.subjects[0] : assessment?.subjects;
    const viewedAt = assessment ? viewMap.get(assessment.id) as string | undefined : undefined;
    const releasedAt = assessment?.released_at as string | null | undefined;
    return { ...row, assessment, subject, isNew: Boolean(releasedAt && (!viewedAt || new Date(viewedAt).getTime() < new Date(releasedAt).getTime())) };
  }).filter((row: any) => row.assessment && (!activePeriod || (row.subject?.academic_year === activePeriod.academic_year && row.subject?.term === activePeriod.term)));

  const scoredRows = rows.filter((row: any) => row.result_status !== "absent" && row.score !== null && row.score !== undefined);
  const absentCount = rows.filter((row: any) => row.result_status === "absent").length;
  const gradedForPassing = scoredRows.filter((row: any) => row.assessment.passing_score !== null && row.assessment.passing_score !== undefined);
  const passed = gradedForPassing.filter((row: any) => Number(row.score) >= Number(row.assessment.passing_score)).length;
  const latest = scoredRows[0] || null;
  const newCount = rows.filter((row: any) => row.isNew).length;

  return (
    <>
      <PageHeader eyebrow="Student Portal" title={`Welcome, ${student.code_name}`} description="Your latest scores and assessment activity in one place." />

      <div className="student-dashboard-top student-v2-home-top">
        <section className="performance-hero compact-performance-hero student-v2-hero">
          <div className="performance-hero-top">
            <div>
              <div className="label">Latest recorded score</div>
              <div className="big">{latest ? `${latest.score} / ${latest.assessment.total_score}` : "—"}</div>
              {latest ? (
                <p>{latest.assessment.title} · {latest.subject?.name || "Subject"} · {formatDate(latest.assessment.assessment_date)}</p>
              ) : (
                <p>Your latest score will appear here once an assessment result is recorded.</p>
              )}
            </div>
            <span className="badge badge-purple hero-year-badge">{student.year_level}</span>
          </div>
          <div className="progress" aria-hidden="true">
            <span style={{ width: `${latest ? scoreFill(Number(latest.score), Number(latest.assessment.total_score)) : 0}%` }} />
          </div>
        </section>

        <div className="student-metric-grid student-v2-metrics">
          <div className="student-metric"><span>Results</span><strong>{rows.length}</strong><small>{scoredRows.length} with recorded scores</small></div>
          <div className="student-metric"><span>New results</span><strong>{newCount}</strong><small>{newCount ? "not yet opened" : "all caught up"}</small></div>
          <div className="student-metric"><span>Passed</span><strong>{gradedForPassing.length ? `${passed}/${gradedForPassing.length}` : "—"}</strong><small>{gradedForPassing.length ? "assessments with a passing score" : "no passing score set"}</small></div>
          <div className="student-metric"><span>Did not take</span><strong>{absentCount}</strong><small>{rows.length} total recorded entr{rows.length === 1 ? "y" : "ies"}</small></div>
        </div>
      </div>

      <Leaderboard />

      <section className="dashboard-section section-gap student-v2-section">
        <div className="panel-header compact-section-header"><div><h2>Assessment overview</h2><p>Your latest recorded score in each common assessment type.</p></div></div>
        <div className="category-grid refined-category-grid student-v2-category-grid">
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

      <section className="dashboard-section section-gap student-v2-section">
        <div className="panel-header compact-section-header"><div><h2>Recent results</h2><p>Your latest assessment entries and result status.</p></div><Link className="button button-secondary button-sm" href="/student/results" prefetch>All results</Link></div>
        <div className="result-list compact-result-list student-v2-result-list">
          {rows.slice(0, 5).map((row: any) => {
            const absent = row.result_status === "absent";
            const hasPass = row.assessment.passing_score != null;
            const passedRow = !absent && hasPass && Number(row.score) >= Number(row.assessment.passing_score);
            return (
              <div className={`result-card ${absent ? "is-absent" : ""}`} key={row.assessment.id}>
                <div className="result-main"><div className="meta"><span>{row.subject?.name}</span><span>·</span><span>{formatDate(row.assessment.assessment_date)}</span>{row.isNew && <span className="new-result-badge">New</span>}</div><h3>{row.assessment.title}</h3><p>{row.assessment.assessment_type}{row.assessment.doctor_name ? ` · ${row.assessment.doctor_name}` : ""}</p></div>
                <div className="result-score">{absent ? <><strong>Did not take</strong><small>No score recorded</small></> : <><strong>{row.score} / {row.assessment.total_score}</strong><small>{hasPass ? (passedRow ? "Passed" : "Below passing score") : "Recorded result"}</small></>}</div>
              </div>
            );
          })}
          {!rows.length && <EmptyState title="No results yet" description="Your scores will appear here when they are ready." />}
        </div>
      </section>
    </>
  );
}
