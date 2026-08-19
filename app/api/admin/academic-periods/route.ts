import { NextResponse } from "next/server";
import { getAdminWorkspaceContext } from "@/lib/admin-workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import { TERMS } from "@/lib/constants";

function normalizeAcademicYear(value: unknown) {
  const match = String(value || "").trim().match(/^(\d{4})\s*[-–]\s*(\d{4})$/);
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (end !== start + 1) return null;
  return `${start}-${end}`;
}

export async function POST(request: Request) {
  const context = await getAdminWorkspaceContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const academicYear = normalizeAcademicYear(body.academicYear);
    const term = String(body.term || "");
    if (!academicYear || !TERMS.includes(term as (typeof TERMS)[number])) {
      return NextResponse.json({ error: "Use an academic year like 2026-2027 and choose a valid semester." }, { status: 400 });
    }

    const db = createAdminClient();
    const { data: existing, error: lookupError } = await db.from("academic_periods").select("id,is_active")
      .eq("owner_id", context.workspace.id).eq("academic_year", academicYear).eq("term", term).maybeSingle();
    if (lookupError) throw lookupError;
    if (existing) return NextResponse.json({ error: "That academic period already exists for this Admin account." }, { status: 409 });

    const { count } = await db.from("academic_periods").select("id", { count: "exact", head: true }).eq("owner_id", context.workspace.id);
    const shouldActivate = !count;
    const { data, error } = await db.from("academic_periods").insert({ owner_id: context.workspace.id, academic_year: academicYear, term, is_active: shouldActivate }).select("id,owner_id,academic_year,term,is_active").single();
    if (error) throw error;
    return NextResponse.json({ ok: true, period: data });
  } catch {
    return NextResponse.json({ error: "Unable to create academic period." }, { status: 500 });
  }
}
