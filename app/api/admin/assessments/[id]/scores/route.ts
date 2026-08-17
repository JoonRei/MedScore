import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await getAdminUser()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  try {
    const body = await request.json();
    const rows = Array.isArray(body.scores) ? body.scores : [];
    const db = createAdminClient();
    const { data: assessment } = await db.from("assessments").select("total_score").eq("id", id).single();
    if (!assessment) return NextResponse.json({ error: "Assessment not found." }, { status: 404 });

    const total = Number(assessment.total_score);
    const toDelete: string[] = [];
    const toUpsert: Array<{ assessment_id: string; student_id: string; score: number | null; result_status: "scored" | "absent" }> = [];

    for (const row of rows) {
      const studentId = String(row.studentId || "");
      if (!studentId) continue;
      const status = row.status === "absent" ? "absent" : row.status === "scored" ? "scored" : "unentered";

      if (status === "unentered") {
        toDelete.push(studentId);
        continue;
      }

      if (status === "absent") {
        toUpsert.push({ assessment_id: id, student_id: studentId, score: null, result_status: "absent" });
        continue;
      }

      const score = Number(row.score);
      if (!Number.isFinite(score) || score < 0 || score > total) return NextResponse.json({ error: "A score is outside the valid range." }, { status: 400 });
      toUpsert.push({ assessment_id: id, student_id: studentId, score, result_status: "scored" });
    }

    if (toDelete.length) {
      const { error } = await db.from("scores").delete().eq("assessment_id", id).in("student_id", toDelete);
      if (error) throw error;
    }
    if (toUpsert.length) {
      const { error } = await db.from("scores").upsert(toUpsert, { onConflict: "assessment_id,student_id" });
      if (error) throw error;
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to save scores." }, { status: 500 });
  }
}
