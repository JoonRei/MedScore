import { NextResponse } from "next/server";
import { getAdminWorkspaceContext } from "@/lib/admin-workspace";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const context = await getAdminWorkspaceContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!context.period) return NextResponse.json({ error: "Choose an active semester first." }, { status: 400 });

  try {
    const sourcePeriodId = new URL(request.url).searchParams.get("periodId") || "";
    if (!sourcePeriodId || sourcePeriodId === context.period.id) {
      return NextResponse.json({ error: "Choose a previous semester." }, { status: 400 });
    }

    const db = createAdminClient();
    const { data: sourcePeriod } = await db
      .from("academic_periods")
      .select("id,academic_year,term")
      .eq("id", sourcePeriodId)
      .eq("owner_id", context.workspace.id)
      .maybeSingle();
    if (!sourcePeriod) return NextResponse.json({ error: "Semester not found." }, { status: 404 });

    const [{ data: sourceMemberships }, { data: currentMemberships }] = await Promise.all([
      db.from("student_period_memberships").select("student_id,year_level").eq("period_id", sourcePeriodId),
      db.from("student_period_memberships").select("student_id").eq("period_id", context.period.id),
    ]);

    const currentIds = new Set((currentMemberships || []).map((row: any) => row.student_id));
    const sourceYearMap = new Map((sourceMemberships || []).map((row: any) => [row.student_id, row.year_level]));
    const sourceIds = [...new Set((sourceMemberships || []).map((row: any) => row.student_id))].filter((id) => !currentIds.has(id));
    if (!sourceIds.length) return NextResponse.json({ students: [], sourcePeriod });

    const { data: students, error } = await db
      .from("students")
      .select("id,first_name,last_name,student_number,code_name,year_level,is_active")
      .eq("owner_id", context.workspace.id)
      .in("id", sourceIds)
      .order("last_name");
    if (error) throw error;

    return NextResponse.json({ students: (students || []).map((student: any) => ({ ...student, year_level: sourceYearMap.get(student.id) || student.year_level })), sourcePeriod });
  } catch {
    return NextResponse.json({ error: "Unable to load students from that semester." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getAdminWorkspaceContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!context.period) return NextResponse.json({ error: "Choose an active semester first." }, { status: 400 });

  try {
    const body = await request.json();
    const sourcePeriodId = String(body.sourcePeriodId || "");
    const studentIds = Array.isArray(body.studentIds)
      ? [...new Set(body.studentIds.map(String).filter(Boolean))].slice(0, 1000)
      : [];
    if (!sourcePeriodId || sourcePeriodId === context.period.id || !studentIds.length) {
      return NextResponse.json({ error: "Choose at least one student from a previous semester." }, { status: 400 });
    }

    const db = createAdminClient();
    const { data: sourcePeriod } = await db
      .from("academic_periods")
      .select("id")
      .eq("id", sourcePeriodId)
      .eq("owner_id", context.workspace.id)
      .maybeSingle();
    if (!sourcePeriod) return NextResponse.json({ error: "Semester not found." }, { status: 404 });

    const { data: eligibleRows, error: eligibleError } = await db
      .from("student_period_memberships")
      .select("student_id,year_level,students!inner(owner_id)")
      .eq("period_id", sourcePeriodId)
      .in("student_id", studentIds)
      .eq("students.owner_id", context.workspace.id);
    if (eligibleError) throw eligibleError;

    const eligibleIds = [...new Set((eligibleRows || []).map((row: any) => row.student_id))];
    const eligibleYearMap = new Map((eligibleRows || []).map((row: any) => [row.student_id, row.year_level]));
    if (!eligibleIds.length) return NextResponse.json({ error: "No eligible students were found." }, { status: 400 });

    const rows = eligibleIds.map((studentId) => ({ student_id: studentId, period_id: context.period!.id, year_level: eligibleYearMap.get(studentId) || "1st Year" }));
    const { error } = await db.from("student_period_memberships").upsert(rows, { onConflict: "student_id,period_id", ignoreDuplicates: true });
    if (error) throw error;

    return NextResponse.json({ ok: true, added: eligibleIds.length });
  } catch {
    return NextResponse.json({ error: "Unable to add students to the active semester." }, { status: 500 });
  }
}
