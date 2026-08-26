import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getStudentSession } from "@/lib/student-session";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET() {
  const session = await getStudentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = createAdminClient();
    const [{ data: assessments, error: assessmentsError }, { data: scores, error: scoresError }, { data: termGrades, error: termGradesError }] = await Promise.all([
      db.from("assessments")
        .select("id,status,released_at,subject_id,subjects!inner(owner_id)")
        .eq("subjects.owner_id", session.student.owner_id),
      db.from("scores")
        .select("assessment_id,score,result_status,assessments!inner(id,status,released_at)")
        .eq("student_id", session.student.id),
      db.from("released_term_grades")
        .select("id,subject_id,raw_percentage,term_grade,released_at,updated_at")
        .eq("student_id", session.student.id)
        .eq("owner_id", session.student.owner_id),
    ]);

    if (assessmentsError) throw assessmentsError;
    if (scoresError) throw scoresError;
    if (termGradesError) throw termGradesError;

    const assessmentSnapshot = (assessments || [])
      .map((row: any) => ({
        id: String(row.id || ""),
        status: String(row.status || ""),
        releasedAt: String(row.released_at || ""),
        subjectId: String(row.subject_id || ""),
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

    const scoreSnapshot = (scores || [])
      .map((row: any) => ({
        assessmentId: String(row.assessment_id || ""),
        score: row.score ?? null,
        resultStatus: String(row.result_status || ""),
        assessmentStatus: String((Array.isArray(row.assessments) ? row.assessments[0] : row.assessments)?.status || ""),
        releasedAt: String((Array.isArray(row.assessments) ? row.assessments[0] : row.assessments)?.released_at || ""),
      }))
      .sort((a, b) => a.assessmentId.localeCompare(b.assessmentId));


    const termGradeSnapshot = (termGrades || [])
      .map((row: any) => ({
        id: String(row.id || ""),
        subjectId: String(row.subject_id || ""),
        rawPercentage: row.raw_percentage ?? null,
        termGrade: row.term_grade ?? null,
        releasedAt: String(row.released_at || ""),
        updatedAt: String(row.updated_at || ""),
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

    const signature = createHash("sha256")
      .update(JSON.stringify({ assessments: assessmentSnapshot, scores: scoreSnapshot, termGrades: termGradeSnapshot }))
      .digest("base64url")
      .slice(0, 32);

    return NextResponse.json({
      signature,
      assessmentIds: assessmentSnapshot.map((row) => row.id),
      scoreAssessmentIds: scoreSnapshot.map((row) => row.assessmentId),
    }, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (error) {
    console.error("student live sync status failed", error);
    return NextResponse.json({ error: "Unable to check for portal updates." }, { status: 503 });
  }
}
