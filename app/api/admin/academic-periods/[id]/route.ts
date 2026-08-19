import { NextResponse } from "next/server";
import { getAdminWorkspaceContext } from "@/lib/admin-workspace";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAdminWorkspaceContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const body = await request.json();
    if (body.isActive !== true) return NextResponse.json({ error: "Unsupported update." }, { status: 400 });
    const db = createAdminClient();
    const { data: target, error: lookupError } = await db.from("academic_periods").select("id").eq("id", id).eq("owner_id", context.workspace.id).maybeSingle();
    if (lookupError) throw lookupError;
    if (!target) return NextResponse.json({ error: "Academic period not found." }, { status: 404 });

    const { error: clearError } = await db.from("academic_periods").update({ is_active: false }).eq("owner_id", context.workspace.id).eq("is_active", true);
    if (clearError) throw clearError;
    const { error } = await db.from("academic_periods").update({ is_active: true }).eq("id", id).eq("owner_id", context.workspace.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to change the current academic period." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAdminWorkspaceContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const db = createAdminClient();
    const { data: period, error: lookupError } = await db.from("academic_periods").select("id,academic_year,term,is_active").eq("id", id).eq("owner_id", context.workspace.id).maybeSingle();
    if (lookupError) throw lookupError;
    if (!period) return NextResponse.json({ error: "Academic period not found." }, { status: 404 });
    if (period.is_active) return NextResponse.json({ error: "Set another academic period as current before removing this one." }, { status: 400 });

    const { count, error: subjectError } = await db.from("subjects").select("id", { count: "exact", head: true })
      .eq("owner_id", context.workspace.id).eq("academic_year", period.academic_year).eq("term", period.term);
    if (subjectError) throw subjectError;
    if (count) return NextResponse.json({ error: "This period is already used by subjects and cannot be removed." }, { status: 400 });

    const { error } = await db.from("academic_periods").delete().eq("id", id).eq("owner_id", context.workspace.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to remove academic period." }, { status: 500 });
  }
}
