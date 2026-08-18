import { PageHeader } from "@/components/PageHeader";
import { SubjectsClient } from "@/components/SubjectsClient";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";

export default async function Page() {
  await requireAdmin();
  const supabase = createAdminClient();
  const [{ data: subjects }, { data: students }, { data: periods }] = await Promise.all([
    supabase.from("subjects").select("*,enrollments(student_id)").order("is_archived").order("name"),
    supabase.from("students").select("id,first_name,last_name,code_name,student_number,year_level,is_active").order("last_name"),
    supabase.from("academic_periods").select("id,academic_year,term,is_active").order("academic_year", { ascending: false }).order("term"),
  ]);
  const activePeriodId = (periods || []).find((period: any) => period.is_active)?.id || null;

  return <>
    <PageHeader eyebrow="Curriculum" title="Subjects" description="Create subjects, organize the curriculum and update student rosters efficiently." />
    <SubjectsClient subjects={(subjects || []) as any[]} students={(students || []) as any[]} periods={(periods || []) as any[]} activePeriodId={activePeriodId} />
  </>;
}
