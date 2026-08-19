import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { EmptyState } from "@/components/EmptyState";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/utils";
import { requireAdminWorkspace } from "@/lib/admin-workspace";

export default async function AdminOverviewPage() {
  const context = await requireAdminWorkspace();
  const db = createAdminClient();

  let subjectQuery = db.from("subjects").select("id").eq("owner_id", context.workspace.id).eq("is_archived", false);
  if (context.period) subjectQuery = subjectQuery.eq("academic_year", context.period.academic_year).eq("term", context.period.term);
  const studentCountQuery = context.period
    ? db.from("student_period_memberships")
        .select("student_id,students!inner(id,owner_id,is_active)", { count: "exact", head: true })
        .eq("period_id", context.period.id)
        .eq("students.owner_id", context.workspace.id)
        .eq("students.is_active", true)
    : db.from("students").select("id", { count: "exact", head: true }).eq("owner_id", context.workspace.id).eq("is_active", true);
  const [{ count: studentCount }, { data: subjectRows }] = await Promise.all([
    studentCountQuery,
    subjectQuery,
  ]);
  const subjectIds = (subjectRows || []).map((row: any) => row.id);

  let assessmentRows: any[] = [];
  if (subjectIds.length) {
    const { data } = await db.from("assessments").select("id,title,assessment_type,assessment_date,total_score,status,subjects(name,code)").in("subject_id", subjectIds).order("assessment_date", { ascending: false });
    assessmentRows = data || [];
  }
  const assessmentIds = assessmentRows.map((row) => row.id);
  let scoreCount = 0;
  if (assessmentIds.length) {
    const { count } = await db.from("scores").select("id", { count: "exact", head: true }).in("assessment_id", assessmentIds);
    scoreCount = count || 0;
  }
  const recent = assessmentRows.slice(0, 6);

  return <>
    <PageHeader eyebrow="Admin workspace" title="Academic performance at a glance" description="Manage student access, organize subjects, encode assessment scores and release results when they are ready." action={<Link className="button button-primary" href="/admin/assessments">New assessment</Link>} />
    <div className="grid grid-4">
      <StatCard label="Active students" value={studentCount || 0} note="Included this semester" />
      <StatCard label="Active subjects" value={subjectIds.length} note="Current academic offerings" />
      <StatCard label="Assessments" value={assessmentRows.length} note="Draft, released and archived" />
      <StatCard label="Result entries" value={scoreCount} note="Scores and did-not-take entries" />
    </div>
    <section className="panel section-gap">
      <div className="panel-header"><div><h2>Recent assessments</h2><p>Your latest recorded assessment activity.</p></div><Link href="/admin/assessments" className="button button-secondary button-sm">View all</Link></div>
      {!recent.length ? <EmptyState title="No assessments yet" description="Create a subject first, then add your first quiz, exam or other assessment."/> : <div className="table-wrap responsive-table-wrap"><table className="responsive-table"><thead><tr><th>Assessment</th><th>Subject</th><th>Date</th><th>Total</th><th>Status</th></tr></thead><tbody>{recent.map((row: any) => { const subject = Array.isArray(row.subjects) ? row.subjects[0] : row.subjects; return <tr key={row.id}><td data-label="Assessment"><div className="cell-title"><strong>{row.title}</strong><small>{row.assessment_type}</small></div></td><td data-label="Subject">{subject?.name || "—"}</td><td data-label="Date">{formatDate(row.assessment_date)}</td><td data-label="Total" className="numeric">{row.total_score}</td><td data-label="Status"><span className={`badge ${row.status === "published" ? "badge-green" : row.status === "archived" ? "badge-gray" : "badge-purple"}`}>{row.status === "published" ? "Released" : row.status.charAt(0).toUpperCase() + row.status.slice(1)}</span></td></tr>; })}</tbody></table></div>}
    </section>
  </>;
}
