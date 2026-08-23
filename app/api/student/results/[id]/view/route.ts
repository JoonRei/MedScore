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
  context: { params: Promise<{ id: string }> },
) {
  const session = await getStudentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request." }, { status: 403 });

  const { id: rawAssessmentId } = await context.params;
  const assessmentId = String(rawAssessmentId || "").trim();
  if (!assessmentId) return NextResponse.json({ error: "Assessment is required." }, { status: 400 });

  try {
    const db = createAdminClient();

    const { data: score, error: scoreError } = await db
      .from("scores")
      .select("assessment_id")
      .eq("student_id", session.student.id)
      .eq("assessment_id", assessmentId)
      .maybeSingle();

    if (scoreError) throw scoreError;
    if (!score) return NextResponse.json({ error: "Result not found." }, { status: 404 });

    const viewedAt = new Date().toISOString();

    // Update every existing row first. This also repairs older installations that
    // may contain duplicate student_result_views rows for the same assessment.
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
        // Another tab may have inserted the row between UPDATE and INSERT.
        const { error: retryError } = await db
          .from("student_result_views")
          .update({ viewed_at: viewedAt })
          .eq("student_id", session.student.id)
          .eq("assessment_id", assessmentId);
        if (retryError) throw insertError;
      }
    }

    revalidatePath("/student");
    revalidatePath("/student/results");
    revalidatePath("/student/notifications");

    return NextResponse.json(
      { ok: true, assessmentId, viewedAt },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    );
  } catch (error) {
    console.error("student result view save failed", error);
    return NextResponse.json({ error: "Unable to update result read status." }, { status: 500 });
  }
}
