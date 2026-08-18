import { NextResponse } from "next/server";
import { getStudentSession } from "@/lib/student-session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getStudentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const db = createAdminClient();
    const { data: score, error: scoreError } = await db.from("scores")
      .select("assessment_id,assessments!inner(status)")
      .eq("assessment_id", id)
      .eq("student_id", session.student.id)
      .maybeSingle();
    if (scoreError) throw scoreError;
    const assessment = score && (Array.isArray((score as any).assessments) ? (score as any).assessments[0] : (score as any).assessments);
    if (!score || assessment?.status !== "published") return NextResponse.json({ error: "Result not found." }, { status: 404 });

    const { error } = await db.from("student_result_views").upsert({
      student_id: session.student.id,
      assessment_id: id,
      viewed_at: new Date().toISOString(),
    }, { onConflict: "student_id,assessment_id" });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to update result status." }, { status: 500 });
  }
}
