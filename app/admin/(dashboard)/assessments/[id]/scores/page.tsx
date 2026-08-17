import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { ScoreEntryClient } from "@/components/ScoreEntryClient";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const db = createAdminClient();
  const { data: assessment } = await db.from("assessments").select("*,subjects(name,code)").eq("id", id).single();
  if (!assessment) notFound();

  const [{ data: enrollments }, { data: scores }] = await Promise.all([
    db.from("enrollments").select("students(id,first_name,last_name,student_number,code_name)").eq("subject_id", assessment.subject_id),
    db.from("scores").select("student_id,score,result_status").eq("assessment_id", id),
  ]);

  const scoreMap = new Map((scores || []).map((item: any) => [item.student_id, item]));
  const students = (enrollments || [])
    .map((item: any) => Array.isArray(item.students) ? item.students[0] : item.students)
    .filter(Boolean)
    .sort((a: any, b: any) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name))
    .map((student: any) => {
      const entry: any = scoreMap.get(student.id);
      return { ...student, score: entry?.score ?? null, result_status: entry?.result_status ?? null };
    });

  const subject = Array.isArray(assessment.subjects) ? assessment.subjects[0] : assessment.subjects;
  return <>
    <PageHeader eyebrow={subject?.name || "Assessment"} title="Enter scores" description="Record scores, mark students who did not take the assessment, and save whenever needed." />
    <ScoreEntryClient assessment={{ ...assessment, subjectName: subject?.name || "Subject", subjectCode: subject?.code || null }} students={students} />
  </>;
}
