import { PageHeader } from "@/components/PageHeader";
import { StudentSubjectsClient, type StudentSubjectRow } from "@/components/StudentSubjectsClient";
import { requireStudent } from "@/lib/student-session";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function Page() {
  const { student } = await requireStudent();
  const db = createAdminClient();
  const [{ data }, { data: activePeriod }] = await Promise.all([
    db.from("enrollments").select("subjects(id,name,code,term,academic_year)").eq("student_id", student.id),
    db.from("academic_periods").select("academic_year,term").eq("owner_id", student.owner_id).eq("is_active", true).maybeSingle(),
  ]);
  const subjects: StudentSubjectRow[] = (data || []).flatMap((item: any) => {
    const subject = Array.isArray(item.subjects) ? item.subjects[0] : item.subjects;
    if (!subject || (activePeriod && (subject.academic_year !== activePeriod.academic_year || subject.term !== activePeriod.term))) return [];
    return [{ id: subject.id, name: subject.name, code: subject.code, term: subject.term, academicYear: subject.academic_year }];
  });
  return <><PageHeader eyebrow="Academic records" title="Subjects" description="Select a subject to review assessments and results."/><StudentSubjectsClient subjects={subjects} /></>;
}
