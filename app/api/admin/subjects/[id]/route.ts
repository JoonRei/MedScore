import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await getAdminUser()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const body = await request.json();
    const patch: Record<string, unknown> = {};
    if (typeof body.isArchived === "boolean") patch.is_archived = body.isArchived;
    const hasDetails = ["name", "code", "yearLevel", "periodId"].some((key) => key in body);
    if (hasDetails) {
      const name = String(body.name || "").trim();
      const yearLevel = String(body.yearLevel || "").trim();
      const periodId = String(body.periodId || "").trim();
      if (!name || !yearLevel || !periodId) return NextResponse.json({ error: "Complete all required fields." }, { status: 400 });
      const db = createAdminClient();
      let period: { academic_year: string; term: string } | null = null;
      if (periodId.startsWith("legacy:")) {
        const [academic_year, term] = periodId.slice(7).split("|");
        if (academic_year && term) period = { academic_year, term };
      } else {
        const result = await db.from("academic_periods").select("academic_year,term").eq("id", periodId).maybeSingle();
        if (result.error) throw result.error;
        period = result.data;
      }
      if (!period) return NextResponse.json({ error: "Choose a valid academic period in Settings." }, { status: 400 });
      patch.name = name;
      patch.code = String(body.code || "").trim() || null;
      patch.year_level = yearLevel;
      patch.term = period.term;
      patch.academic_year = period.academic_year;
    }
    if (!Object.keys(patch).length) return NextResponse.json({ ok: true });
    const { error } = await createAdminClient().from("subjects").update(patch).eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to update subject." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await getAdminUser()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("subjects").delete().eq("id", id).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Subject not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to delete subject." }, { status: 500 });
  }
}
