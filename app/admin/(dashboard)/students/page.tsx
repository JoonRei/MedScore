import { PageHeader } from "@/components/PageHeader";
import { StudentsClient, type StudentRow } from "@/components/StudentsClient";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminWorkspace } from "@/lib/admin-workspace";

export default async function StudentsPage() {
  const context = await requireAdminWorkspace();
  const db = createAdminClient();

  let subjectsQuery = db.from("subjects").select("id,name,code,year_level").eq("owner_id", context.workspace.id).eq("is_archived", false).order("name");
  if (context.period) subjectsQuery = subjectsQuery.eq("academic_year", context.period.academic_year).eq("term", context.period.term);

  const { data: subjects } = await subjectsQuery;

  const subjectIds = (subjects || []).map((subject: any) => subject.id);
  const { data: enrollmentRows } = subjectIds.length
    ? await db.from("enrollments").select("student_id,subject_id").in("subject_id", subjectIds)
    : { data: [] as any[] };

  let studentRows: any[] = [];
  if (context.period) {
    const { data: membershipRows } = await db
      .from("student_period_memberships")
      .select("student_id,year_level")
      .eq("period_id", context.period.id);

    // Semester enrollment is also a recovery source for legacy students. This keeps
    // older rosters visible even when the first membership backfill was incomplete.
    const membershipIds = new Set((membershipRows || []).map((row: any) => row.student_id));
    const enrolledIds = [...new Set((enrollmentRows || []).map((row: any) => row.student_id))];
    const missingMembershipIds = enrolledIds.filter((id) => !membershipIds.has(id));
    let recoveredRows: Array<{ id: string; year_level: string }> = [];

    if (missingMembershipIds.length) {
      const { data: recoveredStudents } = await db
        .from("students")
        .select("id,year_level")
        .eq("owner_id", context.workspace.id)
        .in("id", missingMembershipIds);
      recoveredRows = (recoveredStudents || []) as Array<{ id: string; year_level: string }>;
      if (recoveredRows.length) {
        await db.from("student_period_memberships").upsert(
          recoveredRows.map((student) => ({ student_id: student.id, period_id: context.period!.id, year_level: student.year_level })),
          { onConflict: "student_id,period_id", ignoreDuplicates: true },
        );
      }
    }

    const semesterYearMap = new Map<string, string>();
    for (const row of membershipRows || []) semesterYearMap.set(row.student_id, row.year_level);
    for (const row of recoveredRows) semesterYearMap.set(row.id, row.year_level);
    const currentStudentIds = [...new Set([...membershipIds, ...enrolledIds])];

    if (currentStudentIds.length) {
      const { data } = await db
        .from("students")
        .select("id,first_name,last_name,student_number,code_name,year_level,is_active")
        .eq("owner_id", context.workspace.id)
        .in("id", currentStudentIds)
        .order("last_name");
      studentRows = (data || []).map((student: any) => ({ ...student, year_level: semesterYearMap.get(student.id) || student.year_level }));
    }
  } else {
    const { data } = await db
      .from("students")
      .select("id,first_name,last_name,student_number,code_name,year_level,is_active")
      .eq("owner_id", context.workspace.id)
      .order("last_name");
    studentRows = data || [];
  }

  const enrollmentMap = new Map<string, Array<{ subject_id: string }>>();
  for (const enrollment of enrollmentRows || []) {
    const list = enrollmentMap.get(enrollment.student_id) || [];
    list.push({ subject_id: enrollment.subject_id });
    enrollmentMap.set(enrollment.student_id, list);
  }

  const students = studentRows.map((student: any) => ({ ...student, enrollments: enrollmentMap.get(student.id) || [] }));

  return <>
    <PageHeader eyebrow="Access management" title="Students" description="Create student accounts, assign code names and manage subject enrollment."/>
    <StudentsClient
      students={students as StudentRow[]}
      subjects={(subjects || []) as any[]}
      periods={context.periods.map((period) => ({ id: period.id, academic_year: period.academic_year, term: period.term }))}
      selectedPeriodId={context.selectedPeriodId}
    />
  </>;
}
