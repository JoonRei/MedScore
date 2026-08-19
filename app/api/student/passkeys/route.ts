import { NextResponse } from "next/server";
import { getStudentSession } from "@/lib/student-session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE() {
  const session = await getStudentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { student } = session;
  try {
    const db = createAdminClient();
    const { error } = await db.from("student_passkeys").delete().eq("student_id", student.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to disable device sign-in." }, { status: 500 });
  }
}
