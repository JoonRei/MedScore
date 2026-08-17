import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  if (!await getAdminUser()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    if (!body.subjectId || !body.title || !body.assessmentType || !body.date || !body.totalScore) return NextResponse.json({ error: "Complete required fields." }, { status: 400 });
    const total = Number(body.totalScore);
    const pass = body.passingScore === "" || body.passingScore == null ? null : Number(body.passingScore);
    if (!(total > 0) || (pass !== null && (pass < 0 || pass > total))) return NextResponse.json({ error: "Check total and passing scores." }, { status: 400 });
    const doctorName = String(body.doctorName || "").trim() || null;
    const { error } = await createAdminClient().from("assessments").insert({
      subject_id: body.subjectId,
      title: String(body.title).trim(),
      assessment_type: body.assessmentType,
      assessment_date: body.date,
      total_score: total,
      passing_score: pass,
      doctor_name: doctorName,
      status: "draft",
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to create assessment." }, { status: 500 });
  }
}
