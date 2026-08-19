import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeCodeName } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const codeName = normalizeCodeName(String(body.codeName || ""));
    if (!/^[A-Za-z0-9_-]{4,30}$/.test(codeName)) return NextResponse.json({ enabled: false });

    const db = createAdminClient();
    const { data: student } = await db
      .from("students")
      .select("id,is_active")
      .eq("code_name", codeName)
      .maybeSingle();
    if (!student?.is_active) return NextResponse.json({ enabled: false });

    const { count, error } = await db
      .from("student_passkeys")
      .select("credential_id", { count: "exact", head: true })
      .eq("student_id", student.id);
    if (error) throw error;
    return NextResponse.json({ enabled: Boolean(count) });
  } catch {
    return NextResponse.json({ enabled: false });
  }
}
