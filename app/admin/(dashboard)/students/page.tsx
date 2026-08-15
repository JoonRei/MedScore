import { PageHeader } from "@/components/PageHeader";
import { StudentsClient, type StudentRow } from "@/components/StudentsClient";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";

export default async function StudentsPage() {
  await requireAdmin();
  const supabase = createAdminClient();
  const [{ data: students }, { data: subjects }] = await Promise.all([
    supabase.from("students").select("id,first_name,last_name,student_number,code_name,year_level,section,is_active,enrollments(subject_id)").order("last_name"),
    supabase.from("subjects").select("id,name,code,year_level").eq("is_archived", false).order("name"),
  ]);

  return (
    <>
      <PageHeader eyebrow="Access management" title="Students" description="Create private student accounts, assign code names and manage access without displaying PINs."/>
      <StudentsClient students={(students || []) as StudentRow[]} subjects={(subjects || []) as any[]} />
    </>
  );
}
