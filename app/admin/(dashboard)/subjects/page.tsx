import { PageHeader } from "@/components/PageHeader";
import { SubjectsClient } from "@/components/SubjectsClient";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminWorkspace } from "@/lib/admin-workspace";

export default async function Page() {
  const context = await requireAdminWorkspace();
  const db = createAdminClient();
  let subjectsQuery = db.from("subjects").select("*,enrollments(student_id)").eq("owner_id", context.workspace.id).order("is_archived").order("name");
  if (context.period) subjectsQuery = subjectsQuery.eq("academic_year", context.period.academic_year).eq("term", context.period.term);

  const [{ data: subjects }, { data: periods }] = await Promise.all([
    subjectsQuery,
    db.from("academic_periods").select("id,academic_year,term,is_active").eq("owner_id", context.workspace.id).order("academic_year", { ascending: false }).order("term"),
  ]);

  let students: any[] = [];
  if (context.period) {
    const { data: memberships } = await db.from("student_period_memberships").select("student_id,year_level").eq("period_id", context.period.id);
    const studentIds = [...new Set((memberships || []).map((row: any) => row.student_id))];
    const yearMap = new Map((memberships || []).map((row: any) => [row.student_id, row.year_level]));
    if (studentIds.length) {
      const { data } = await db.from("students").select("id,first_name,last_name,code_name,student_number,year_level,is_active").eq("owner_id", context.workspace.id).in("id", studentIds).order("last_name");
      students = (data || []).map((student: any) => ({ ...student, year_level: yearMap.get(student.id) || student.year_level }));
    }
  } else {
    const { data } = await db.from("students").select("id,first_name,last_name,code_name,student_number,year_level,is_active").eq("owner_id", context.workspace.id).order("last_name");
    students = data || [];
  }

  const activePeriodId = (periods || []).find((period: any) => period.is_active)?.id || context.period?.id || null;

  return <>
    <PageHeader eyebrow="Curriculum" title="Subjects" description="Create subjects, organize the curriculum and update student rosters efficiently." />
    <SubjectsClient subjects={(subjects || []) as any[]} students={students as any[]} periods={(periods || []) as any[]} activePeriodId={activePeriodId} />
  </>;
}
