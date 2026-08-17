import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Leaderboard } from "@/components/Leaderboard";
import { requireStudent } from "@/lib/student-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate, formatPercent, percent, weightedPercent } from "@/lib/utils";

export default async function Page() {
  const { student } = await requireStudent();
  const db = createAdminClient();
  const [{ data: enrollments }, { data: scores }] = await Promise.all([
    db.from("enrollments").select("subjects(id,name,code,term,academic_year)").eq("student_id", student.id),
    db.from("scores")
      .select("score,result_status,assessments!inner(id,title,assessment_type,total_score,passing_score,assessment_date,doctor_name,status,subjects(id,name,code))")
      .eq("student_id", student.id)
      .eq("assessments.status", "published")
      .order("created_at", { ascending: false }),
  ]);

  const rows = (scores || []).map((row: any) => {
    const assessment = Array.isArray(row.assessments) ? row.assessments[0] : row.assessments;
    const subject = Array.isArray(assessment?.subjects) ? assessment.subjects[0] : assessment?.subjects;
    return { ...row, assessment, subject };
  }).filter((row: any) => row.assessment);

  const scoredRows = rows.filter((row: any) => row.result_status !== "absent" && row.score !== null && row.score !== undefined);
  const absentCount = rows.filter((row: any) => row.result_status === "absent").length;
  const overallAverage = weightedPercent(scoredRows.map((row: any) => ({ score: Number(row.score), total: Number(row.assessment.total_score) })));
  const percentages = scoredRows.map((row: any) => percent(Number(row.score), Number(row.assessment.total_score)));
  const highest = percentages.length ? Math.max(...percentages) : null;
  const gradedForPassing = scoredRows.filter((row: any) => row.assessment.passing_score !== null && row.assessment.passing_score !== undefined);
  const passed = gradedForPassing.filter((row: any) => Number(row.score) >= Number(row.assessment.passing_score)).length;
  const passingRate = gradedForPassing.length ? (passed / gradedForPassing.length) * 100 : null;
  const categories = ["Quiz", "Long Exam", "Pre-Test", "Post-Test"];
  return (
    <>
      <PageHeader eyebrow="Student Portal" title={`Welcome, ${student.code_name}`} description="Your current academic performance at a glance." />

      <div className="student-dashboard-top">
        <div className="performance-hero compact-performance-hero">
          <div className="performance-hero-top">
            <div>
              <div className="label">Overall performance</div>
              <div className="big">{scoredRows.length ? formatPercent(overallAverage) : "—"}</div>
              <p>{scoredRows.length ? `Based on ${scoredRows.length} scored result${scoredRows.length === 1 ? "" : "s"}.` : "Your performance summary will appear as scores are added."}</p>
            </div>
            <span className="badge badge-purple hero-year-badge">{student.year_level}</span>
          </div>
          <div className="progress"><span style={{ width: `${scoredRows.length ? Math.min(overallAverage, 100) : 0}%` }} /></div>
        </div>

        <div className="student-metric-grid">
          <div className="student-metric"><span>Subjects</span><strong>{enrollments?.length || 0}</strong><small>currently enrolled</small></div>
          <div className="student-metric"><span>Results</span><strong>{rows.length}</strong><small>{absentCount ? `${absentCount} did not take` : "recorded entries"}</small></div>
          <div className="student-metric"><span>Highest score</span><strong>{highest === null ? "—" : formatPercent(highest)}</strong><small>best percentage</small></div>
          <div className="student-metric"><span>Passing rate</span><strong>{passingRate === null ? "—" : formatPercent(passingRate)}</strong><small>{gradedForPassing.length ? `${passed} of ${gradedForPassing.length} passed` : "no passing score set"}</small></div>
        </div>
      </div>

      <Leaderboard />

      <section className="dashboard-section section-gap">
        <div className="panel-header compact-section-header"><div><h2>Assessment overview</h2><p>Performance across common assessment types.</p></div></div>
        <div className="category-grid refined-category-grid">
          {categories.map((category) => {
            const categoryRows = scoredRows.filter((row: any) => row.assessment.assessment_type === category);
            const value = categoryRows.length ? weightedPercent(categoryRows.map((row: any) => ({ score: Number(row.score), total: Number(row.assessment.total_score) }))) : null;
            return <div className="category-card refined-category-card" key={category}><span>{category}</span><strong>{value === null ? "—" : formatPercent(value)}</strong><small>{categoryRows.length} scored result{categoryRows.length === 1 ? "" : "s"}</small></div>;
          })}
        </div>
      </section>

      <section className="dashboard-section section-gap">
        <div className="panel-header compact-section-header"><div><h2>Your subjects</h2><p>Select a subject to review its assessments and performance.</p></div><Link className="button button-secondary button-sm" href="/student/subjects" prefetch>View all</Link></div>
        <div className="subject-list dashboard-subject-list">
          {(enrollments || []).slice(0, 6).map((item: any) => {
            const subject = Array.isArray(item.subjects) ? item.subjects[0] : item.subjects;
            const subjectRows = scoredRows.filter((row: any) => row.subject?.id === subject?.id);
            const subjectAverage = weightedPercent(subjectRows.map((row: any) => ({ score: Number(row.score), total: Number(row.assessment.total_score) })));
            return (
              <Link className="subject-card" href={`/student/subjects/${subject.id}`} prefetch key={subject.id}>
                <div className="subject-card-top"><span className="subject-code">{(subject.code || subject.name).slice(0, 3).toUpperCase()}</span><span className="subject-term">{subject.term}</span></div>
                <h3>{subject.name}</h3>
                <p>{subject.code || "College of Medicine"} · {subject.academic_year}</p>
                <div className="subject-card-bottom"><div><small>Performance</small><strong>{subjectRows.length ? formatPercent(subjectAverage) : "—"}</strong></div><small>{subjectRows.length} scored result{subjectRows.length === 1 ? "" : "s"}</small></div>
              </Link>
            );
          })}
        </div>
        {!(enrollments || []).length && <EmptyState title="No subjects assigned" description="Your subjects will appear after they are assigned to your account." />}
      </section>

      <section className="dashboard-section section-gap">
        <div className="panel-header compact-section-header"><div><h2>Recent results</h2><p>Your latest assessment entries.</p></div><Link className="button button-secondary button-sm" href="/student/results" prefetch>All results</Link></div>
        <div className="result-list compact-result-list">
          {rows.slice(0, 5).map((row: any) => {
            const absent = row.result_status === "absent";
            return (
              <div className={`result-card ${absent ? "is-absent" : ""}`} key={row.assessment.id}>
                <div className="result-main"><div className="meta"><span>{row.subject?.name}</span><span>·</span><span>{formatDate(row.assessment.assessment_date)}</span></div><h3>{row.assessment.title}</h3><p>{row.assessment.assessment_type}{row.assessment.doctor_name ? ` · ${row.assessment.doctor_name}` : ""}</p></div>
                <div className="result-score">{absent ? <><strong>Did not take</strong><small>No score recorded</small></> : <><strong>{row.score} / {row.assessment.total_score}</strong><small>{formatPercent(percent(Number(row.score), Number(row.assessment.total_score)))}</small></>}</div>
              </div>
            );
          })}
          {!rows.length && <EmptyState title="No results yet" description="Your scores will appear here when they are ready." />}
        </div>
      </section>
    </>
  );
}
