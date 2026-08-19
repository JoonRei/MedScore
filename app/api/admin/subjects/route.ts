import { NextResponse } from "next/server";
import { getAdminWorkspaceContext } from "@/lib/admin-workspace";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const context = await getAdminWorkspaceContext(); if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json(); const name = String(body.name || "").trim(); const yearLevel = String(body.yearLevel || "").trim(); const periodId = String(body.periodId || "").trim();
    if (!name || !yearLevel || !periodId) return NextResponse.json({ error: "Complete all required fields." }, { status: 400 });
    const db = createAdminClient(); const { data: period, error: periodError } = await db.from("academic_periods").select("academic_year,term").eq("id", periodId).eq("owner_id", context.workspace.id).maybeSingle();
    if (periodError) throw periodError; if (!period) return NextResponse.json({ error: "Choose a valid academic period for this Admin account." }, { status: 400 });
    const { error } = await db.from("subjects").insert({ owner_id: context.workspace.id, name, code: String(body.code || "").trim() || null, year_level: yearLevel, term: period.term, academic_year: period.academic_year }); if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Unable to create subject." }, { status: 500 }); }
}
