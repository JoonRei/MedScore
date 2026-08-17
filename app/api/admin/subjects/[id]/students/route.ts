import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

function uniqueIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(Boolean).map(String))];
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await getAdminUser()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  try {
    const body = await request.json();
    const addIds = uniqueIds(body.addIds);
    const removeIds = uniqueIds(body.removeIds);
    const total = Number.isFinite(Number(body.total)) ? Number(body.total) : null;
    const overlap = addIds.some((studentId) => removeIds.includes(studentId));

    if (overlap) {
      return NextResponse.json({ error: "The roster update contains conflicting student changes." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const writes: PromiseLike<{ error: any }>[] = [];

    if (addIds.length) {
      writes.push(
        supabase
          .from("enrollments")
          .upsert(
            addIds.map((studentId) => ({ subject_id: id, student_id: studentId })),
            { onConflict: "student_id,subject_id", ignoreDuplicates: true }
          )
      );
    }

    if (removeIds.length) {
      writes.push(
        supabase
          .from("enrollments")
          .delete()
          .eq("subject_id", id)
          .in("student_id", removeIds)
      );
    }

    const results = await Promise.all(writes);
    const writeError = results.find((result) => result.error)?.error;
    if (writeError) throw writeError;

    return NextResponse.json({
      ok: true,
      added: addIds.length,
      removed: removeIds.length,
      total,
    });
  } catch {
    return NextResponse.json({ error: "Unable to update the subject roster." }, { status: 500 });
  }
}
