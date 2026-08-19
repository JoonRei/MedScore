import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getAdminWorkspaceContext } from "@/lib/admin-workspace";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAdminWorkspaceContext(); if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const { pin } = await request.json(); const value = String(pin || ""); if (!/^\d{4,6}$/.test(value)) return NextResponse.json({ error: "PIN must contain 4 to 6 digits." }, { status: 400 });
    const db = createAdminClient(); const { data: student } = await db.from("students").select("id").eq("id", id).eq("owner_id", context.workspace.id).maybeSingle(); if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });
    const pinHash = await bcrypt.hash(value, 12); const { error } = await db.from("students").update({ pin_hash: pinHash }).eq("id", id).eq("owner_id", context.workspace.id); if (error) throw error;
    await Promise.all([db.from("student_sessions").delete().eq("student_id", id), db.from("student_passkeys").delete().eq("student_id", id)]); return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Unable to reset PIN." }, { status: 500 }); }
}
