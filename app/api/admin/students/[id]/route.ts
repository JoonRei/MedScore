import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeCodeName } from "@/lib/utils";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  try {
    const body = await request.json();
    const supabase = createAdminClient();
    const patch: Record<string, unknown> = {};

    if (typeof body.isActive === "boolean") patch.is_active = body.isActive;

    const hasProfile = ["firstName", "lastName", "studentNumber", "codeName", "yearLevel", "section"].some((key) => key in body);
    if (hasProfile) {
      const firstName = String(body.firstName || "").trim();
      const lastName = String(body.lastName || "").trim();
      const codeName = normalizeCodeName(String(body.codeName || ""));
      const yearLevel = String(body.yearLevel || "").trim();
      if (!firstName || !lastName || !yearLevel || !/^[A-Za-z0-9_-]{4,30}$/.test(codeName)) {
        return NextResponse.json({ error: "Please complete all required fields correctly." }, { status: 400 });
      }
      patch.first_name = firstName;
      patch.last_name = lastName;
      patch.student_number = String(body.studentNumber || "").trim() || null;
      patch.code_name = codeName;
      patch.year_level = yearLevel;
      patch.section = String(body.section || "").trim() || null;
    }

    if (Object.keys(patch).length) {
      const { error } = await supabase.from("students").update(patch).eq("id", id);
      if (error) {
        if (error.code === "23505") return NextResponse.json({ error: "That student number or code name is already in use." }, { status: 409 });
        throw error;
      }
    }

    if (Array.isArray(body.subjectIds)) {
      const subjectIds = body.subjectIds.filter(Boolean);
      const { error: deleteError } = await supabase.from("enrollments").delete().eq("student_id", id);
      if (deleteError) throw deleteError;
      if (subjectIds.length) {
        const rows = subjectIds.map((subjectId: string) => ({ student_id: id, subject_id: subjectId }));
        const { error } = await supabase.from("enrollments").insert(rows);
        if (error) throw error;
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to update student." }, { status: 500 });
  }
}
