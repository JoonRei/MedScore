import { PageHeader } from "@/components/PageHeader";
import { StudentSubjectsClient, type StudentSubjectRow } from "@/components/StudentSubjectsClient";
import { requireStudent } from "@/lib/student-session";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function Page() {
  const { student } = await requireStudent();
  const { data } = await createAdminClient().from("enrollments").select("subjects(id,name,code,term,academic_year)").eq("student_id", student.id);
  const subjects: StudentSubjectRow[] = (data || []).map((item: any) => {
    const subject = Array.isArray(item.subjects) ? item.subjects[0] : item.subjects;
    return { id: subject.id, name: subject.name, code: subject.code, term: subject.term, academicYear: subject.academic_year };
  });
  return <><PageHeader eyebrow="Academic records" title="Subjects" description="Open a subject to review released assessments and results."/><StudentSubjectsClient subjects={subjects} /></>;
}
