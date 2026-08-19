import { NextResponse } from "next/server";
import { getAdminWorkspaceContext } from "@/lib/admin-workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeCodeName } from "@/lib/utils";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAdminWorkspaceContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const body = await request.json();
    const db = createAdminClient();
    const { data: owned } = await db.from("students").select("id").eq("id", id).eq("owner_id", context.workspace.id).maybeSingle();
    if (!owned) return NextResponse.json({ error: "Student not found." }, { status: 404 });
    const patch: Record<string, unknown> = {};
    if (typeof body.isActive === "boolean") patch.is_active = body.isActive;
    const hasProfile = ["firstName", "lastName", "studentNumber", "codeName", "yearLevel"].some((key) => key in body);
    if (hasProfile) {
      const firstName = String(body.firstName || "").trim(); const lastName = String(body.lastName || "").trim(); const codeName = normalizeCodeName(String(body.codeName || "")); const yearLevel = String(body.yearLevel || "").trim();
      if (!firstName || !lastName || !yearLevel || !/^[A-Za-z0-9_-]{4,30}$/.test(codeName)) return NextResponse.json({ error: "Please complete all required fields correctly." }, { status: 400 });
      Object.assign(patch, { first_name: firstName, last_name: lastName, student_number: String(body.studentNumber || "").trim() || null, code_name: codeName, year_level: yearLevel });
    }
    if (Object.keys(patch).length) {
      const { error } = await db.from("students").update(patch).eq("id", id).eq("owner_id", context.workspace.id);
      if (error) { if (error.code === "23505") return NextResponse.json({ error: "That student number or code name is already in use." }, { status: 409 }); throw error; }
    }
    if (hasProfile && context.period) {
      const yearLevel = String(body.yearLevel || "").trim();
      const { error: membershipError } = await db.from("student_period_memberships")
        .update({ year_level: yearLevel })
        .eq("student_id", id)
        .eq("period_id", context.period.id);
      if (membershipError) throw membershipError;
    }
    if (Array.isArray(body.subjectIds)) {
      const subjectIds = [...new Set(body.subjectIds.filter(Boolean).map(String))];
      if (subjectIds.length) {
        let ownedQuery = db.from("subjects").select("id").eq("owner_id", context.workspace.id).in("id", subjectIds);
        if (context.period) ownedQuery = ownedQuery.eq("academic_year", context.period.academic_year).eq("term", context.period.term);
        const { data: ownedSubjects } = await ownedQuery;
        if ((ownedSubjects || []).length !== subjectIds.length) return NextResponse.json({ error: "One or more selected subjects are not available in the active semester." }, { status: 400 });
      }

      let currentQuery = db.from("enrollments")
        .select("subject_id,subjects!inner(owner_id,academic_year,term)")
        .eq("student_id", id)
        .eq("subjects.owner_id", context.workspace.id);
      if (context.period) currentQuery = currentQuery.eq("subjects.academic_year", context.period.academic_year).eq("subjects.term", context.period.term);
      const { data: current, error: currentError } = await currentQuery;
      if (currentError) throw currentError;

      const currentIds = new Set((current || []).map((row: any) => row.subject_id));
      const nextIds = new Set(subjectIds);
      const toAdd = subjectIds.filter((subjectId) => !currentIds.has(subjectId));
      const toRemove = [...currentIds].filter((subjectId) => !nextIds.has(subjectId));
      if (toAdd.length) { const { error } = await db.from("enrollments").insert(toAdd.map((subjectId) => ({ student_id: id, subject_id: subjectId }))); if (error) throw error; }
      if (toRemove.length) { const { error } = await db.from("enrollments").delete().eq("student_id", id).in("subject_id", toRemove); if (error) throw error; }
    }
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Unable to update student." }, { status: 500 }); }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAdminWorkspaceContext(); if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const db = createAdminClient(); const { data, error } = await db.from("students").delete().eq("id", id).eq("owner_id", context.workspace.id).select("id").maybeSingle();
    if (error) throw error; if (!data) return NextResponse.json({ error: "Student not found." }, { status: 404 }); return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Unable to delete student." }, { status: 500 }); }
}
