import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getAdminWorkspaceContext } from "@/lib/admin-workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeCodeName } from "@/lib/utils";

export async function POST(request: Request) {
  const context = await getAdminWorkspaceContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const firstName = String(body.firstName || "").trim();
    const lastName = String(body.lastName || "").trim();
    const studentNumber = String(body.studentNumber || "").trim() || null;
    const codeName = normalizeCodeName(String(body.codeName || ""));
    const pin = String(body.pin || "");
    const yearLevel = String(body.yearLevel || "").trim();
    const subjectIds = Array.isArray(body.subjectIds) ? [...new Set(body.subjectIds.filter(Boolean).map(String))] : [];
    if (!firstName || !lastName || !yearLevel || !/^[A-Za-z0-9_-]{4,30}$/.test(codeName) || !/^\d{4,6}$/.test(pin)) return NextResponse.json({ error: "Please complete all required fields correctly." }, { status: 400 });

    const db = createAdminClient();
    if (subjectIds.length) {
      let ownedQuery = db.from("subjects").select("id").eq("owner_id", context.workspace.id).in("id", subjectIds);
      if (context.period) ownedQuery = ownedQuery.eq("academic_year", context.period.academic_year).eq("term", context.period.term);
      const { data: ownedSubjects } = await ownedQuery;
      if ((ownedSubjects || []).length !== subjectIds.length) return NextResponse.json({ error: "One or more selected subjects are not available in the active semester." }, { status: 400 });
    }
    const pinHash = await bcrypt.hash(pin, 12);
    const { data: student, error } = await db.from("students").insert({ owner_id: context.workspace.id, first_name: firstName, last_name: lastName, student_number: studentNumber, code_name: codeName, pin_hash: pinHash, year_level: yearLevel }).select("id").single();
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "That student number or code name is already in use." }, { status: 409 });
      throw error;
    }
    if (context.period) {
      const { error: membershipError } = await db.from("student_period_memberships").insert({ student_id: student.id, period_id: context.period.id, year_level: yearLevel });
      if (membershipError) { await db.from("students").delete().eq("id", student.id).eq("owner_id", context.workspace.id); throw membershipError; }
    }
    if (subjectIds.length) {
      const { error: enrollError } = await db.from("enrollments").insert(subjectIds.map((subjectId) => ({ student_id: student.id, subject_id: subjectId })));
      if (enrollError) { await db.from("students").delete().eq("id", student.id).eq("owner_id", context.workspace.id); throw enrollError; }
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to create student." }, { status: 500 });
  }
}
