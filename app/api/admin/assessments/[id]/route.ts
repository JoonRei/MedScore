import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await getAdminUser()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const body = await request.json();
    const patch: Record<string, unknown> = {};

    if (body.status !== undefined) {
      if (!["draft", "published", "archived"].includes(body.status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 });
      patch.status = body.status;
    }

    const hasDetails = ["subjectId", "title", "assessmentType", "date", "totalScore", "passingScore"].some((key) => key in body);
    if (hasDetails) {
      const title = String(body.title || "").trim();
      const total = Number(body.totalScore);
      const pass = body.passingScore === "" || body.passingScore == null ? null : Number(body.passingScore);
      if (!body.subjectId || !title || !body.assessmentType || !body.date || !(total > 0) || (pass !== null && (pass < 0 || pass > total))) {
        return NextResponse.json({ error: "Check all required fields and score values." }, { status: 400 });
      }
      patch.subject_id = body.subjectId;
      patch.title = title;
      patch.assessment_type = body.assessmentType;
      patch.assessment_date = body.date;
      patch.total_score = total;
      patch.passing_score = pass;
    }

    if (!Object.keys(patch).length) return NextResponse.json({ ok: true });
    const { error } = await createAdminClient().from("assessments").update(patch).eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to update assessment." }, { status: 500 });
  }
}
