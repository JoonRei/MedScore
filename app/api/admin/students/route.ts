import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getAdminUser } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeCodeName } from "@/lib/utils";

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const firstName = String(body.firstName || "").trim();
    const lastName = String(body.lastName || "").trim();
    const studentNumber = String(body.studentNumber || "").trim() || null;
    const codeName = normalizeCodeName(String(body.codeName || ""));
    const pin = String(body.pin || "");
    const yearLevel = String(body.yearLevel || "").trim();
    const section = String(body.section || "").trim() || null;
    const subjectIds = Array.isArray(body.subjectIds) ? body.subjectIds.filter(Boolean) : [];

    if (!firstName || !lastName || !yearLevel || !/^[A-Za-z0-9_-]{4,30}$/.test(codeName) || !/^\d{4,6}$/.test(pin)) {
      return NextResponse.json({ error: "Please complete all required fields correctly." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const pinHash = await bcrypt.hash(pin, 12);
    const { data: student, error } = await supabase
      .from("students")
      .insert({
        first_name: firstName,
        last_name: lastName,
        student_number: studentNumber,
        code_name: codeName,
        pin_hash: pinHash,
        year_level: yearLevel,
        section,
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "That student number or code name is already in use." }, { status: 409 });
      throw error;
    }

    if (subjectIds.length) {
      const rows = subjectIds.map((subjectId: string) => ({ student_id: student.id, subject_id: subjectId }));
      const { error: enrollError } = await supabase.from("enrollments").insert(rows);
      if (enrollError) throw enrollError;
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to create student." }, { status: 500 });
  }
}
