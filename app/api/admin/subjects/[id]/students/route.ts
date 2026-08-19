import { NextResponse } from "next/server";
import { getAdminWorkspaceContext } from "@/lib/admin-workspace";
import { createAdminClient } from "@/lib/supabase/admin";

function uniqueIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(Boolean).map(String))];
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAdminWorkspaceContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const body = await request.json();
    const addIds = uniqueIds(body.addIds);
    const removeIds = uniqueIds(body.removeIds);
    const total = Number.isFinite(Number(body.total)) ? Number(body.total) : null;
    if (addIds.some((studentId) => removeIds.includes(studentId))) return NextResponse.json({ error: "The roster update contains conflicting student changes." }, { status: 400 });

    const db = createAdminClient();
    let subjectQuery = db.from("subjects").select("id").eq("id", id).eq("owner_id", context.workspace.id);
    if (context.period) subjectQuery = subjectQuery.eq("academic_year", context.period.academic_year).eq("term", context.period.term);
    const { data: subject } = await subjectQuery.maybeSingle();
    if (!subject) return NextResponse.json({ error: "Subject not found." }, { status: 404 });
    const allIds = [...new Set([...addIds, ...removeIds])];
    if (allIds.length) {
      const { data: ownedStudents } = await db.from("students").select("id").eq("owner_id", context.workspace.id).in("id", allIds);
      if ((ownedStudents || []).length !== allIds.length) return NextResponse.json({ error: "One or more students are not available for this account." }, { status: 400 });
      if (context.period) {
        const { data: memberships } = await db.from("student_period_memberships").select("student_id").eq("period_id", context.period.id).in("student_id", allIds);
        if ((memberships || []).length !== allIds.length) return NextResponse.json({ error: "One or more students are not included in the active semester." }, { status: 400 });
      }
    }

    const writes: PromiseLike<{ error: any }>[] = [];
    if (addIds.length) writes.push(db.from("enrollments").upsert(addIds.map((studentId) => ({ subject_id: id, student_id: studentId })), { onConflict: "student_id,subject_id", ignoreDuplicates: true }));
    if (removeIds.length) writes.push(db.from("enrollments").delete().eq("subject_id", id).in("student_id", removeIds));
    const results = await Promise.all(writes); const writeError = results.find((result) => result.error)?.error; if (writeError) throw writeError;
    return NextResponse.json({ ok: true, added: addIds.length, removed: removeIds.length, total });
  } catch { return NextResponse.json({ error: "Unable to update the subject roster." }, { status: 500 }); }
}
