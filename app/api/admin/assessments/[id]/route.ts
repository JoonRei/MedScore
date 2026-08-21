import { NextResponse } from "next/server";
import { getAdminWorkspaceContext } from "@/lib/admin-workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAssessmentReleasePush } from "@/lib/push-notifications";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAdminWorkspaceContext(); if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); const { id } = await params;
  try {
    const body = await request.json(); const db = createAdminClient();
    const { data: owned } = await db.from("assessments").select("id,subjects!inner(owner_id)").eq("id", id).eq("subjects.owner_id", context.workspace.id).maybeSingle(); if (!owned) return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
    const patch: Record<string, unknown> = {};
    if (body.status !== undefined) { if (!["draft", "published", "archived"].includes(body.status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 }); patch.status = body.status; if (body.status === "published") patch.released_at = new Date().toISOString(); }
    const hasDetails = ["subjectId", "title", "assessmentType", "date", "totalScore", "passingScore", "doctorName"].some((key) => key in body);
    if (hasDetails) {
      const title = String(body.title || "").trim(); const total = Number(body.totalScore); const pass = body.passingScore === "" || body.passingScore == null ? null : Number(body.passingScore);
      if (!body.subjectId || !title || !body.assessmentType || !body.date || !(total > 0) || (pass !== null && (pass < 0 || pass > total))) return NextResponse.json({ error: "Check all required fields and score values." }, { status: 400 });
      const { data: subject } = await db.from("subjects").select("id").eq("id", String(body.subjectId)).eq("owner_id", context.workspace.id).maybeSingle(); if (!subject) return NextResponse.json({ error: "Choose a subject from this Admin account." }, { status: 400 });
      Object.assign(patch, { subject_id: subject.id, title, assessment_type: body.assessmentType, assessment_date: body.date, total_score: total, passing_score: pass, doctor_name: String(body.doctorName || "").trim() || null });
    }
    if (!Object.keys(patch).length) return NextResponse.json({ ok: true });
    const { error } = await db.from("assessments").update(patch).eq("id", id);
    if (error) throw error;
    if (body.status === "published") {
      try { await sendAssessmentReleasePush(id, context.workspace.id); } catch (pushError) { console.error("score release push failed", pushError); }
    }
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Unable to update assessment." }, { status: 500 }); }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAdminWorkspaceContext(); if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); const { id } = await params;
  try { const db = createAdminClient(); const { data: assessment, error: lookupError } = await db.from("assessments").select("id,title,subjects!inner(owner_id)").eq("id", id).eq("subjects.owner_id", context.workspace.id).maybeSingle(); if (lookupError) throw lookupError; if (!assessment) return NextResponse.json({ error: "Assessment not found." }, { status: 404 }); const { error } = await db.from("assessments").delete().eq("id", id); if (error) throw error; return NextResponse.json({ ok: true }); }
  catch { return NextResponse.json({ error: "Unable to delete assessment." }, { status: 500 }); }
}
