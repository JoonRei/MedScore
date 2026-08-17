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

    const hasProfile = ["firstName", "lastName", "studentNumber", "codeName", "yearLevel"].some((key) => key in body);
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
    }

    if (Object.keys(patch).length) {
      const { error } = await supabase.from("students").update(patch).eq("id", id);
      if (error) {
        if (error.code === "23505") return NextResponse.json({ error: "That student number or code name is already in use." }, { status: 409 });
        throw error;
      }
    }

    if (Array.isArray(body.subjectIds)) {
      const subjectIds = [...new Set(body.subjectIds.filter(Boolean).map(String))];
      const { data: current, error: currentError } = await supabase.from("enrollments").select("subject_id").eq("student_id", id);
      if (currentError) throw currentError;
      const currentIds = new Set((current || []).map((row) => row.subject_id));
      const nextIds = new Set(subjectIds);
      const toAdd = subjectIds.filter((subjectId) => !currentIds.has(subjectId));
      const toRemove = [...currentIds].filter((subjectId) => !nextIds.has(subjectId));

      if (toAdd.length) {
        const { error } = await supabase.from("enrollments").insert(toAdd.map((subjectId) => ({ student_id: id, subject_id: subjectId })));
        if (error) throw error;
      }
      if (toRemove.length) {
        const { error } = await supabase.from("enrollments").delete().eq("student_id", id).in("subject_id", toRemove);
        if (error) throw error;
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to update student." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("students").delete().eq("id", id).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Student not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to delete student." }, { status: 500 });
  }
}
