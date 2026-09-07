import { EmptyState } from "@/components/EmptyState";
import { StudentTermGradesClient } from "@/components/StudentTermGradesClient";
import { requireStudent } from "@/lib/student-session";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

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
      <header className="page-header student-grades-header-v423 student-grades-header-v435 student-grades-header-v436 student-grades-header-v470">
        <div>
          <span className="eyebrow">Released grades</span>
          <h1>Term Grades</h1>
          <p>View your released grades by subject and grading period.</p>
        </div>
      </header>

      {!grades.length ? (
        <div className="student-term-grades-empty-v435 student-term-grades-empty-v470">
          <EmptyState
            title="No released term grades"
            description="Your Prelim, Midterm, or Finals grades will appear here after your instructor releases them."
          />
        </div>
      ) : (
        <StudentTermGradesClient grades={grades} />
      )}
    </>
  );
}
