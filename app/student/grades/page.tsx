import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { requireStudent } from "@/lib/student-session";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function finiteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatScore(value: unknown) {
  const number = finiteNumber(value);
  return Number.isInteger(number) ? String(number) : number.toFixed(2);
}

function formatReleasedDate(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return "—";

  const date = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? new Date(`${text}T00:00:00`)
    : new Date(text);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function periodLabel(value: unknown) {
  const period = String(value || "prelim");
  return period === "midterm" ? "Midterm" : period === "finals" ? "Finals" : "Prelim";
}

function componentGrade(component: any) {
  const explicit = Number(component?.componentGrade);
  if (Number.isFinite(explicit)) return explicit;
  const percentage = Math.min(100, Math.max(0, finiteNumber(component?.percentage)));
  return 40 + percentage * 0.6;
}

function contribution(component: any) {
  const explicit = Number(component?.contribution);
  if (Number.isFinite(explicit)) return explicit;
  return componentGrade(component) * (finiteNumber(component?.weight) / 100);
}

export default async function Page() {
  const { student } = await requireStudent();
  const db = createAdminClient();
  const { data: releasedRows, error } = await db
    .from("released_term_grades")
    .select("id,scheme_id,subject_id,raw_percentage,term_grade,breakdown,released_at")
    .eq("student_id", student.id)
    .eq("owner_id", student.owner_id)
    .order("released_at", { ascending: false });

  if (error) throw error;

  const rows = releasedRows || [];
  const subjectIds = Array.from(new Set(rows.map((row: any) => String(row.subject_id || "")).filter(Boolean)));
  const schemeIds = Array.from(new Set(rows.map((row: any) => String(row.scheme_id || "")).filter(Boolean)));

  let subjects: any[] = [];
  let schemes: any[] = [];

  if (subjectIds.length) {
    const { data, error: subjectsError } = await db
      .from("subjects")
      .select("id,name,code,term,academic_year")
      .eq("owner_id", student.owner_id)
      .in("id", subjectIds);
    if (subjectsError) throw subjectsError;
    subjects = data || [];
  }

  if (schemeIds.length) {
    const { data, error: schemesError } = await db
      .from("grade_schemes")
      .select("id,grading_period,track_name,rounding_digits")
      .eq("owner_id", student.owner_id)
      .in("id", schemeIds);
    if (schemesError) throw schemesError;
    schemes = data || [];
  }

  const subjectById = new Map(subjects.map((row: any) => [String(row.id), row]));
  const schemeById = new Map(schemes.map((row: any) => [String(row.id), row]));
  const grades = rows.map((row: any) => ({
    ...row,
    subject: subjectById.get(String(row.subject_id || "")) || null,
    scheme: schemeById.get(String(row.scheme_id || "")) || null,
  }));

  return (
    <>
      <header className="page-header student-grades-header-v423">
        <div>
          <span className="eyebrow">Released academic grades</span>
          <h1>Term Grades</h1>
          <p>Your released Prelim, Midterm, and Finals grades appear here. Some subjects may show separate lecture or clinical grades.</p>
        </div>
        <Link href="/student/results" className="button button-secondary button-sm">Assessment results</Link>
      </header>

      <div className="student-term-grades-v423">
        {(grades || []).map((row: any) => {
          const subject = row.subject;
          const scheme = row.scheme;
          const breakdown = Array.isArray(row.breakdown) ? row.breakdown : [];
          const period = periodLabel(scheme?.grading_period);
          const trackName = String(scheme?.track_name || "Subject grade");
          const gradeLabel = trackName === "Subject grade" ? `${period} Grade` : `${period} · ${trackName}`;

          return (
            <details className="student-term-grade-card-v423 student-period-grade-card-v427" key={row.id}>
              <summary>
                <div className="student-term-grade-copy-v423">
                  <span>{subject?.code || subject?.term || "Academic grade"}</span>
                  <h2>{subject?.name || "Subject"}</h2>
                  <p>{[period, trackName !== "Subject grade" ? trackName : null, subject?.academic_year, subject?.term].filter(Boolean).join(" · ")}</p>
                </div>
                <div className="student-term-grade-value-v423"><span>{gradeLabel}</span><strong>{Number(row.term_grade)}</strong><small>Released {formatReleasedDate(row.released_at)}</small></div>
              </summary>

              <div className="student-term-grade-breakdown-v423 student-base40-breakdown-v426 student-hierarchy-breakdown-v427">
                <div className="student-term-grade-raw-v423"><span>Overall performance</span><strong>{finiteNumber(row.raw_percentage).toFixed(2)}%</strong></div>

                {breakdown.map((component: any, index: number) => {
                  const earned = finiteNumber(component.earned);
                  const possible = finiteNumber(component.possible);
                  const percentage = finiteNumber(component.percentage);
                  const grade = componentGrade(component);
                  const weight = finiteNumber(component.weight);
                  const weighted = contribution(component);
                  const children = Array.isArray(component.subcomponents) ? component.subcomponents : [];

                  return (
                    <div className="student-term-grade-component-v423 student-base40-component-v426 student-hierarchy-component-v427" key={`${row.id}-${component.componentId || index}`}>
                      <div className="student-base40-component-head-v426"><strong>{component.name || "Component"}</strong><span>{weight}% weight</span></div>

                      {children.length ? (
                        <div className="student-subcomponents-v427">
                          {children.map((child: any, childIndex: number) => (
                            <div className="student-subcomponent-v427" key={`${row.id}-${child.componentId || childIndex}`}>
                              <div><strong>{child.name || "Subcomponent"}</strong><small>{formatScore(child.earned)} / {formatScore(child.possible)}</small></div>
                              <span><small>{finiteNumber(child.weight)}% weight</small><strong>{finiteNumber(child.percentage).toFixed(2)}%</strong></span>
                            </div>
                          ))}
                          <div className="student-parent-performance-v427"><span>Performance</span><strong>{percentage.toFixed(2)}%</strong></div>
                        </div>
                      ) : (
                        <div className="student-base40-metrics-v426">
                          <span><small>Score</small><strong>{formatScore(earned)} / {formatScore(possible)}</strong></span>
                          <span><small>Performance</small><strong>{percentage.toFixed(2)}%</strong></span>
                          <span><small>Grade</small><strong>{grade.toFixed(2)}</strong></span>
                          <span><small>Weighted</small><strong>{weighted.toFixed(2)}</strong></span>
                        </div>
                      )}

                      {children.length ? (
                        <div className="student-base40-metrics-v426 student-parent-metrics-v427">
                          <span><small>Performance</small><strong>{percentage.toFixed(2)}%</strong></span>
                          <span><small>Grade</small><strong>{grade.toFixed(2)}</strong></span>
                          <span><small>Weighted</small><strong>{weighted.toFixed(2)}</strong></span>
                        </div>
                      ) : null}
                    </div>
                  );
                })}

                <div className="student-base40-final-v426"><span><strong>Released {gradeLabel}</strong><small>{trackName}</small></span><strong>{finiteNumber(row.term_grade).toFixed(Number.isInteger(finiteNumber(row.term_grade)) ? 0 : 2)}</strong></div>
                <p className="student-term-grade-note-v423">This is your released grade for this period. Assessment scores are shown separately.</p>
              </div>
            </details>
          );
        })}
        {!grades?.length && <EmptyState title="No released term grades" description="Your Prelim, Midterm, or Finals grades will appear here after your instructor completes and releases them." />}
      </div>
    </>
  );
}
