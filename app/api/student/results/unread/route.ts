import { NextResponse } from "next/server";
import { getStudentSession } from "@/lib/student-session";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET() {
  const session = await getStudentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = createAdminClient();
    const { student } = session;
    const { data: activePeriod } = await db.from("academic_periods")
      .select("academic_year,term")
      .eq("owner_id", student.owner_id)
      .eq("is_active", true)
      .maybeSingle();

    const [{ data: scores, error: scoresError }, { data: views, error: viewsError }] = await Promise.all([
      db.from("scores")
        .select("assessment_id,assessments!inner(id,title,assessment_type,status,released_at,subjects(name,term,academic_year))")
        .eq("student_id", student.id)
        .eq("assessments.status", "published"),
      db.from("student_result_views")
        .select("assessment_id,viewed_at")
        .eq("student_id", student.id),
    ]);

    if (scoresError) throw scoresError;
    if (viewsError) throw viewsError;

    const viewMap = new Map<string, string>((views || []).map((view: any) => [String(view.assessment_id), String(view.viewed_at || "")] as [string, string]));
    const items = (scores || []).flatMap((row: any) => {
      const assessment = Array.isArray(row.assessments) ? row.assessments[0] : row.assessments;
      const subject = Array.isArray(assessment?.subjects) ? assessment.subjects[0] : assessment?.subjects;
      if (!assessment?.id || !assessment?.released_at) return [];
      if (activePeriod && (subject?.academic_year !== activePeriod.academic_year || subject?.term !== activePeriod.term)) return [];

      const viewedAt = viewMap.get(String(assessment.id));
      const isUnread = !viewedAt || new Date(viewedAt).getTime() < new Date(String(assessment.released_at)).getTime();
      if (!isUnread) return [];

      return [{
        id: String(assessment.id),
        title: String(assessment.title || ""),
        subject: String(subject?.name || ""),
        type: String(assessment.assessment_type || ""),
        releasedAt: String(assessment.released_at),
      }];
    });

    return NextResponse.json({ items }, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (error) {
    console.error("student unread result lookup failed", error);
    return NextResponse.json({ error: "Unable to check new results." }, { status: 503 });
  }
}
