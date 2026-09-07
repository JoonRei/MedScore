import { EmptyState } from "@/components/EmptyState";
import { StudentTermGradesClient } from "@/components/StudentTermGradesClient";
import { requireStudent } from "@/lib/student-session";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { student } = await requireStudent();
  const db = createAdminClient();

  const [{ data: combinedRows, error: combinedError }, { data: legacyRows, error: legacyError }] = await Promise.all([
    db.from("released_subject_term_grades")
      .select("id,subject_id,grading_period,raw_percentage,term_grade,rounding_digits,breakdown,released_at")
      .eq("student_id", student.id)
      .eq("owner_id", student.owner_id)
      .order("released_at", { ascending: false }),
    db.from("released_term_grades")
      .select("id,scheme_id,subject_id,raw_percentage,term_grade,breakdown,released_at")
      .eq("student_id", student.id)
      .eq("owner_id", student.owner_id)
      .order("released_at", { ascending: false }),
  ]);

  if (combinedError) throw combinedError;
  if (legacyError) throw legacyError;

  const combined = combinedRows || [];
  const legacy = legacyRows || [];
  const subjectIds = Array.from(new Set(
    [...combined, ...legacy].map((row: any) => String(row.subject_id || "")).filter(Boolean),
  ));
  const legacySchemeIds = Array.from(new Set(legacy.map((row: any) => String(row.scheme_id || "")).filter(Boolean)));

  let subjects: any[] = [];
  let legacySchemes: any[] = [];

  if (subjectIds.length) {
    const { data, error: subjectsError } = await db
      .from("subjects")
      .select("id,name,code,term,academic_year")
      .eq("owner_id", student.owner_id)
      .in("id", subjectIds);
    if (subjectsError) throw subjectsError;
    subjects = data || [];
  }

  if (legacySchemeIds.length) {
    const { data, error: schemesError } = await db
      .from("grade_schemes")
      .select("id,grading_period,track_name,rounding_digits")
      .eq("owner_id", student.owner_id)
      .in("id", legacySchemeIds);
    if (schemesError) throw schemesError;
    legacySchemes = data || [];
  }

  const subjectById = new Map(subjects.map((row: any) => [String(row.id), row]));
  const schemeById = new Map(legacySchemes.map((row: any) => [String(row.id), row]));
  const combinedKeys = new Set(
    combined.map((row: any) => `${String(row.subject_id || "")}|${String(row.grading_period || "prelim")}`),
  );

  const combinedGrades = combined.map((row: any) => ({
    ...row,
    scheme_id: null,
    subject: subjectById.get(String(row.subject_id || "")) || null,
    scheme: {
      id: null,
      grading_period: String(row.grading_period || "prelim"),
      track_name: "Subject grade",
      rounding_digits: Number(row.rounding_digits) || 0,
    },
    is_combined: true,
  }));

  // Keep previously released single-track grades visible until a combined release
  // exists for the same subject and grading period.
  const legacyGrades = legacy.flatMap((row: any) => {
    const scheme = schemeById.get(String(row.scheme_id || "")) || null;
    const key = `${String(row.subject_id || "")}|${String(scheme?.grading_period || "prelim")}`;
    if (combinedKeys.has(key)) return [];
    return [{
      ...row,
      subject: subjectById.get(String(row.subject_id || "")) || null,
      scheme,
      is_combined: false,
    }];
  });

  const grades = [...combinedGrades, ...legacyGrades].sort(
    (a: any, b: any) => new Date(String(b.released_at || 0)).getTime() - new Date(String(a.released_at || 0)).getTime(),
  );

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
