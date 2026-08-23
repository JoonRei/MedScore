import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getStudentSession } from "@/lib/student-session";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return origin === new URL(request.url).origin;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ assessmentId: string }> },
) {
  const session = await getStudentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request." }, { status: 403 });

  const { assessmentId: rawAssessmentId } = await context.params;
  const assessmentId = String(rawAssessmentId || "").trim();
  if (!assessmentId) return NextResponse.json({ error: "Assessment is required." }, { status: 400 });

  try {
    const db = createAdminClient();

    // A student may only acknowledge an assessment for which they actually have a
    // result row. This keeps the read-state endpoint scoped to the signed-in student.
    const { data: score, error: scoreError } = await db
      .from("scores")
      .select("assessment_id")
      .eq("student_id", session.student.id)
      .eq("assessment_id", assessmentId)
      .maybeSingle();

    if (scoreError) throw scoreError;
    if (!score) return NextResponse.json({ error: "Result not found." }, { status: 404 });

    const viewedAt = new Date().toISOString();

    // Update first so this works even on installations that do not have a composite
    // unique constraint for student_id + assessment_id. Insert only when no row exists.
    const { data: updated, error: updateError } = await db
      .from("student_result_views")
      .update({ viewed_at: viewedAt })
      .eq("student_id", session.student.id)
      .eq("assessment_id", assessmentId)
      .select("assessment_id");

    if (updateError) throw updateError;

    if (!updated?.length) {
      const { error: insertError } = await db.from("student_result_views").insert({
        student_id: session.student.id,
        assessment_id: assessmentId,
        viewed_at: viewedAt,
      });

      if (insertError) {
        // A second tab may have inserted the same view between UPDATE and INSERT.
        // Re-run UPDATE so the endpoint remains idempotent in that race.
        const { error: retryError } = await db
          .from("student_result_views")
          .update({ viewed_at: viewedAt })
          .eq("student_id", session.student.id)
          .eq("assessment_id", assessmentId);
        if (retryError) throw insertError;
      }
    }

    // Invalidate every Student surface that derives its New-result state from this table.
    revalidatePath("/student");
    revalidatePath("/student/results");
    revalidatePath("/student/notifications");

    return NextResponse.json({ ok: true, assessmentId, viewedAt }, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (error) {
    console.error("student result view save failed", error);
    return NextResponse.json({ error: "Unable to update result read status." }, { status: 500 });
  }
}
