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
    const hasDetails = ["name", "code", "yearLevel", "term", "academicYear"].some((key) => key in body);
    if (hasDetails) {
      const name = String(body.name || "").trim();
      const yearLevel = String(body.yearLevel || "").trim();
      const term = String(body.term || "").trim();
      const academicYear = String(body.academicYear || "").trim();
      if (!name || !yearLevel || !term || !academicYear) return NextResponse.json({ error: "Complete all required fields." }, { status: 400 });
      patch.name = name;
      patch.code = String(body.code || "").trim() || null;
      patch.year_level = yearLevel;
      patch.term = term;
      patch.academic_year = academicYear;
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
