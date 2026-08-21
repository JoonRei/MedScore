import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

type StudentIdentity = { id: string; owner_id: string };

export type StudentNotification = {
  id: string;
  title: string;
  type: string;
  subject: string;
  releasedAt: string;
  resultStatus: string;
  isUnread: boolean;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export async function getActiveSubjectIds(student: StudentIdentity) {
  const db = createAdminClient();
  const [{ data: activePeriod }, { data: enrollments, error: enrollmentError }] = await Promise.all([
    db.from("academic_periods")
      .select("academic_year,term")
      .eq("owner_id", student.owner_id)
      .eq("is_active", true)
      .maybeSingle(),
    db.from("enrollments")
      .select("subject_id,subjects!inner(id,academic_year,term,is_archived)")
      .eq("student_id", student.id),
  ]);

  if (enrollmentError) throw enrollmentError;

  return Array.from(new Set((enrollments || []).flatMap((row: any) => {
    const subject = one<any>(row.subjects);
    if (!subject || subject.is_archived) return [];
    if (activePeriod && (subject.academic_year !== activePeriod.academic_year || subject.term !== activePeriod.term)) return [];
    return [String(row.subject_id)];
  })));
}

export async function loadReleasedNotifications(
  student: StudentIdentity,
  options: { unreadOnly?: boolean; after?: string; limit?: number; subjectIds?: string[] } = {},
): Promise<StudentNotification[]> {
  const db = createAdminClient();
  const subjectIds = options.subjectIds ?? await getActiveSubjectIds(student);
  if (!subjectIds.length) return [];

  let query = db
    .from("assessments")
    .select("id,title,assessment_type,released_at,subject_id,subjects!inner(name),scores!inner(student_id,result_status)")
    .in("subject_id", subjectIds)
    .eq("status", "published")
    .eq("scores.student_id", student.id)
    .not("released_at", "is", null)
    .order("released_at", { ascending: false })
    .limit(options.limit ?? 24);

  if (options.after) query = query.gt("released_at", options.after);

  const { data, error } = await query;
  if (error) throw error;

  let items: StudentNotification[] = (data || []).map((row: any) => {
    const subject = one<any>(row.subjects);
    const score = one<any>(row.scores);
    return {
      id: String(row.id),
      title: String(row.title || "Assessment"),
      type: String(row.assessment_type || "Assessment"),
      subject: String(subject?.name || "Subject"),
      releasedAt: String(row.released_at),
      resultStatus: String(score?.result_status || "not_entered"),
      isUnread: true,
    } satisfies StudentNotification;
  });

  if (!items.length) return items;

  const { data: views, error: viewsError } = await db
    .from("student_result_views")
    .select("assessment_id,viewed_at")
    .eq("student_id", student.id)
    .in("assessment_id", items.map((item) => item.id));

  if (viewsError) throw viewsError;
  const viewMap = new Map((views || []).map((view: any) => [String(view.assessment_id), String(view.viewed_at)]));

  items = items.map((item) => {
    const viewedAt = viewMap.get(item.id);
    const isUnread = !viewedAt || new Date(viewedAt).getTime() < new Date(item.releasedAt).getTime();
    return { ...item, isUnread };
  });

  return options.unreadOnly ? items.filter((item) => item.isUnread) : items;
}
