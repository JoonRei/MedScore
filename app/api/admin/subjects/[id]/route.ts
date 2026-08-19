import { NextResponse } from "next/server";
import { getAdminWorkspaceContext } from "@/lib/admin-workspace";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAdminWorkspaceContext(); if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); const { id } = await params;
  try {
    const body = await request.json(); const db = createAdminClient(); const { data: owned } = await db.from("subjects").select("id").eq("id", id).eq("owner_id", context.workspace.id).maybeSingle(); if (!owned) return NextResponse.json({ error: "Subject not found." }, { status: 404 });
    const patch: Record<string, unknown> = {}; if (typeof body.isArchived === "boolean") patch.is_archived = body.isArchived;
    const hasDetails = ["name", "code", "yearLevel", "periodId"].some((key) => key in body);
    if (hasDetails) {
      const name = String(body.name || "").trim(); const yearLevel = String(body.yearLevel || "").trim(); const periodId = String(body.periodId || "").trim(); if (!name || !yearLevel || !periodId) return NextResponse.json({ error: "Complete all required fields." }, { status: 400 });
      const { data: period, error: periodError } = await db.from("academic_periods").select("academic_year,term").eq("id", periodId).eq("owner_id", context.workspace.id).maybeSingle(); if (periodError) throw periodError; if (!period) return NextResponse.json({ error: "Choose a valid academic period for this Admin account." }, { status: 400 });
      Object.assign(patch, { name, code: String(body.code || "").trim() || null, year_level: yearLevel, term: period.term, academic_year: period.academic_year });
    }
    if (!Object.keys(patch).length) return NextResponse.json({ ok: true }); const { error } = await db.from("subjects").update(patch).eq("id", id).eq("owner_id", context.workspace.id); if (error) throw error; return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Unable to update subject." }, { status: 500 }); }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAdminWorkspaceContext(); if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); const { id } = await params;
  try { const db = createAdminClient(); const { data, error } = await db.from("subjects").delete().eq("id", id).eq("owner_id", context.workspace.id).select("id").maybeSingle(); if (error) throw error; if (!data) return NextResponse.json({ error: "Subject not found." }, { status: 404 }); return NextResponse.json({ ok: true }); }
  catch { return NextResponse.json({ error: "Unable to delete subject." }, { status: 500 }); }
}
