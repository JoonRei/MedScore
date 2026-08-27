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

function formatGrade(value: unknown, digits: unknown) {
  const number = finiteNumber(value);
  const places = Math.min(2, Math.max(0, Math.trunc(finiteNumber(digits, 0))));
  return number.toFixed(places);
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
      <header className="page-header student-grades-header-v423 student-grades-header-v435">
        <div>
          <span className="eyebrow">Released grades</span>
          <h1>Term Grades</h1>
          <p>View your released grades by subject and grading period.</p>
        </div>
        <Link href="/student/results" className="button button-secondary button-sm">Assessment results</Link>
      </header>

      <div className="student-term-grades-v423 student-term-grades-v435">
        {grades.map((row: any) => {
          const subject = row.subject;
          const scheme = row.scheme;
          const breakdown = Array.isArray(row.breakdown) ? row.breakdown : [];
          const period = periodLabel(scheme?.grading_period);
          const trackName = String(scheme?.track_name || "Subject grade");
          const isMainGrade = trackName === "Subject grade";
          const gradeLabel = isMainGrade ? `${period} Grade` : trackName;
          const releaseDate = formatReleasedDate(row.released_at);
          const roundingDigits = scheme?.rounding_digits ?? 0;

          return (
            <details className="student-term-grade-card-v423 student-period-grade-card-v427 student-term-grade-card-v435" key={row.id}>
              <summary className="student-term-grade-summary-v435">
                <div className="student-term-grade-copy-v423 student-term-grade-copy-v435">
                  <div className="student-term-grade-badges-v435">
                    <span className="student-term-grade-code-v435">{subject?.code || "Subject"}</span>
                    <span className="student-term-grade-period-v435">{period}</span>
                    {!isMainGrade ? <span className="student-term-grade-type-v435">{trackName}</span> : null}
                  </div>
                  <h2>{subject?.name || "Subject"}</h2>
                  <p>{[subject?.academic_year, subject?.term].filter(Boolean).join(" · ") || "Released academic grade"}</p>
                </div>

                <div className="student-term-grade-value-v423 student-term-grade-value-v435">
                  <span>{gradeLabel}</span>
                  <strong>{formatGrade(row.term_grade, roundingDigits)}</strong>
                  <small>Released {releaseDate}</small>
                </div>
              </summary>

              <div className="student-term-grade-breakdown-v423 student-base40-breakdown-v426 student-hierarchy-breakdown-v427 student-term-grade-details-v435">
                <div className="student-term-grade-details-head-v435">
                  <div>
                    <span>Grade details</span>
                    <strong>{breakdown.length} {breakdown.length === 1 ? "component" : "components"}</strong>
                  </div>
                  <div>
                    <span>Overall performance</span>
                    <strong>{finiteNumber(row.raw_percentage).toFixed(2)}%</strong>
                  </div>
                </div>

                <div className="student-term-grade-components-v435">
                  {breakdown.map((component: any, index: number) => {
                    const earned = finiteNumber(component.earned);
                    const possible = finiteNumber(component.possible);
                    const percentage = finiteNumber(component.percentage);
                    const grade = componentGrade(component);
                    const weight = finiteNumber(component.weight);
                    const weighted = contribution(component);
                    const children = Array.isArray(component.subcomponents) ? component.subcomponents : [];

                    return (
                      <section className="student-term-grade-component-v435" key={`${row.id}-${component.componentId || index}`}>
                        <div className="student-term-grade-component-head-v435">
                          <strong>{component.name || "Component"}</strong>
                          <span>{formatScore(weight)}% of grade</span>
                        </div>

                        {children.length ? (
                          <div className="student-term-grade-subcomponents-v435">
                            {children.map((child: any, childIndex: number) => (
                              <div className="student-term-grade-subcomponent-v435" key={`${row.id}-${child.componentId || childIndex}`}>
                                <div>
                                  <strong>{child.name || "Subcomponent"}</strong>
                                  <small>{formatScore(child.earned)} / {formatScore(child.possible)}</small>
                                </div>
                                <div>
                                  <span>{formatScore(child.weight)}%</span>
                                  <strong>{finiteNumber(child.percentage).toFixed(2)}%</strong>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}

                        <div className="student-term-grade-metrics-v435">
                          <div>
                            <span>Score</span>
                            <strong>{formatScore(earned)} / {formatScore(possible)}</strong>
                          </div>
                          <div>
                            <span>Performance</span>
                            <strong>{percentage.toFixed(2)}%</strong>
                          </div>
                          <div>
                            <span>Grade</span>
                            <strong>{grade.toFixed(2)}</strong>
                          </div>
                          <div>
                            <span>Weighted</span>
                            <strong>{weighted.toFixed(2)}</strong>
                          </div>
                        </div>
                      </section>
                    );
                  })}
                </div>

                <div className="student-term-grade-final-v435">
                  <div>
                    <span>Released grade</span>
                    <strong>{gradeLabel}</strong>
                  </div>
                  <strong>{formatGrade(row.term_grade, roundingDigits)}</strong>
                </div>

                <p className="student-term-grade-note-v423 student-term-grade-note-v435">Assessment scores remain available separately in Results.</p>
              </div>
            </details>
          );
        })}

        {!grades.length && (
          <div className="student-term-grades-empty-v435">
            <EmptyState title="No released term grades" description="Your Prelim, Midterm, or Finals grades will appear here after your instructor releases them." />
          </div>
        )}
      </div>
    </>
  );
}
