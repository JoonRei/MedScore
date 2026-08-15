import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getAdminUser } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const { pin } = await request.json();
    const value = String(pin || "");
    if (!/^\d{4,6}$/.test(value)) return NextResponse.json({ error: "PIN must contain 4 to 6 digits." }, { status: 400 });
    const supabase = createAdminClient();
    const pinHash = await bcrypt.hash(value, 12);
    const { error } = await supabase.from("students").update({ pin_hash: pinHash }).eq("id", id);
    if (error) throw error;
    await supabase.from("student_sessions").delete().eq("student_id", id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to reset PIN." }, { status: 500 });
  }
}
