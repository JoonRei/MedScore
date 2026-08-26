import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { requireStudent } from "@/lib/student-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

function finiteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatScore(value: unknown) {
  const number = finiteNumber(value);
  return Number.isInteger(number) ? String(number) : number.toFixed(2);
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
  const { data: grades, error } = await db
    .from("released_term_grades")
    .select("id,raw_percentage,term_grade,breakdown,released_at,subjects(name,code,term,academic_year)")
    .eq("student_id", student.id)
    .eq("owner_id", student.owner_id)
    .order("released_at", { ascending: false });

  if (error) throw error;

  return (
    <>
      <header className="page-header student-grades-header-v423">
        <div>
          <span className="eyebrow">Released academic grades</span>
          <h1>Term Grades</h1>
          <p>Term grades are calculated separately from individual assessment scores using your subject’s configured weighted components.</p>
        </div>
        <Link href="/student/results" className="button button-secondary button-sm">Assessment results</Link>
      </header>

      <div className="student-term-grades-v423">
        {(grades || []).map((row: any) => {
          const subject = Array.isArray(row.subjects) ? row.subjects[0] : row.subjects;
          const breakdown = Array.isArray(row.breakdown) ? row.breakdown : [];
          return (
            <details className="student-term-grade-card-v423" key={row.id}>
              <summary>
                <div className="student-term-grade-copy-v423">
                  <span>{subject?.code || subject?.term || "Term grade"}</span>
                  <h2>{subject?.name || "Subject"}</h2>
                  <p>{subject?.academic_year ? `${subject.academic_year}${subject?.term ? ` · ${subject.term}` : ""}` : subject?.term || ""}</p>
                </div>
                <div className="student-term-grade-value-v423"><span>Term grade</span><strong>{Number(row.term_grade)}</strong><small>Released {formatDate(row.released_at)}</small></div>
              </summary>
              <div className="student-term-grade-breakdown-v423 student-base40-breakdown-v426">
                <div className="student-term-grade-raw-v423"><span>Raw weighted performance</span><strong>{finiteNumber(row.raw_percentage).toFixed(2)}%</strong></div>
                <div className="student-base40-heading-v426">
                  <strong>Base-40 calculation</strong>
                  <span>Each component is converted first, then its weight is applied.</span>
                </div>
                {breakdown.map((component: any, index: number) => {
                  const earned = finiteNumber(component.earned);
                  const possible = finiteNumber(component.possible);
                  const percentage = finiteNumber(component.percentage);
                  const grade = componentGrade(component);
                  const weight = finiteNumber(component.weight);
                  const weighted = contribution(component);
                  return (
                    <div className="student-term-grade-component-v423 student-base40-component-v426" key={`${row.id}-${component.componentId || index}`}>
                      <div className="student-base40-component-head-v426">
                        <strong>{component.name || "Component"}</strong>
                        <span>{weight}% weight</span>
                      </div>
                      <div className="student-base40-metrics-v426">
                        <span><small>Subtotal</small><strong>{formatScore(earned)} / {formatScore(possible)}</strong></span>
                        <span><small>Raw</small><strong>{percentage.toFixed(2)}%</strong></span>
                        <span><small>Base-40</small><strong>{grade.toFixed(2)}</strong></span>
                        <span><small>Contribution</small><strong>{weighted.toFixed(2)}</strong></span>
                      </div>
                    </div>
                  );
                })}
                <div className="student-base40-final-v426">
                  <span><strong>Released Term Grade</strong><small>Sum of the weighted Base-40 component contributions</small></span>
                  <strong>{finiteNumber(row.term_grade).toFixed(Number.isInteger(finiteNumber(row.term_grade)) ? 0 : 2)}</strong>
                </div>
                <p className="student-term-grade-note-v423">The term grade is a released academic grade. It is not the same as an individual assessment score.</p>
              </div>
            </details>
          );
        })}
        {!grades?.length && <EmptyState title="No released term grades" description="Your term grades will appear here after your instructor completes and releases them." />}
      </div>
    </>
  );
}
