import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { ScoreEntryClient } from "@/components/ScoreEntryClient";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminWorkspace } from "@/lib/admin-workspace";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const context = await requireAdminWorkspace();
  const { id } = await params;
  const db = createAdminClient();
  let query = db.from("assessments").select("*,subjects!inner(name,code,owner_id,academic_year,term)").eq("id", id).eq("subjects.owner_id", context.workspace.id);
  if (context.period) query = query.eq("subjects.academic_year", context.period.academic_year).eq("subjects.term", context.period.term);
  const { data: assessment } = await query.maybeSingle();
  if (!assessment) notFound();

  const [{ data: enrollments }, { data: scores }] = await Promise.all([
    db.from("enrollments").select("students!inner(id,first_name,last_name,student_number,code_name,owner_id)").eq("subject_id", assessment.subject_id).eq("students.owner_id", context.workspace.id),
    db.from("scores").select("student_id,score,result_status").eq("assessment_id", id),
  ]);
  const scoreMap = new Map((scores || []).map((item: any) => [item.student_id, item]));
  const students = (enrollments || []).map((item: any) => Array.isArray(item.students) ? item.students[0] : item.students).filter(Boolean).sort((a: any, b: any) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name)).map((student: any) => { const entry: any = scoreMap.get(student.id); return { ...student, score: entry?.score ?? null, result_status: entry?.result_status ?? null }; });
  const subject = Array.isArray(assessment.subjects) ? assessment.subjects[0] : assessment.subjects;
  return <><PageHeader eyebrow={subject?.name || "Assessment"} title="Enter scores" description="Record scores, mark students who did not take the assessment, and save whenever needed." /><ScoreEntryClient assessment={{ ...assessment, subjectName: subject?.name || "Subject", subjectCode: subject?.code || null }} students={students} /></>;
}
