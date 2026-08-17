import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { EmptyState } from "@/components/EmptyState";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/utils";
import { requireAdmin } from "@/lib/admin-auth";

export default async function AdminOverviewPage() {
  await requireAdmin();
  const supabase = createAdminClient();
  const [students, subjects, assessments, scores, recent] = await Promise.all([
    supabase.from("students").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("subjects").select("id", { count: "exact", head: true }).eq("is_archived", false),
    supabase.from("assessments").select("id", { count: "exact", head: true }),
    supabase.from("scores").select("id", { count: "exact", head: true }),
    supabase.from("assessments").select("id,title,assessment_type,assessment_date,total_score,status,subjects(name,code)").order("assessment_date", { ascending: false }).limit(6),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Admin workspace"
        title="Academic performance at a glance"
        description="Manage student access, organize subjects, encode assessment scores and release results when they are ready."
        action={<Link className="button button-primary" href="/admin/assessments">New assessment</Link>}
      />
      <div className="grid grid-4">
        <StatCard label="Active students" value={students.count || 0} note="Student accounts" />
        <StatCard label="Active subjects" value={subjects.count || 0} note="Current academic offerings" />
        <StatCard label="Assessments" value={assessments.count || 0} note="Draft, released and archived" />
        <StatCard label="Result entries" value={scores.count || 0} note="Scores and did-not-take entries" />
      </div>

      <section className="panel section-gap">
        <div className="panel-header">
          <div><h2>Recent assessments</h2><p>Your latest recorded assessment activity.</p></div>
          <Link href="/admin/assessments" className="button button-secondary button-sm">View all</Link>
        </div>
        {!recent.data?.length ? <EmptyState title="No assessments yet" description="Create a subject first, then add your first quiz, exam or other assessment."/> : (
          <div className="table-wrap responsive-table-wrap">
            <table className="responsive-table">
              <thead><tr><th>Assessment</th><th>Subject</th><th>Date</th><th>Total</th><th>Status</th></tr></thead>
              <tbody>
                {recent.data.map((row: any) => {
                  const subject = Array.isArray(row.subjects) ? row.subjects[0] : row.subjects;
                  return <tr key={row.id}>
                    <td data-label="Assessment"><div className="cell-title"><strong>{row.title}</strong><small>{row.assessment_type}</small></div></td>
                    <td data-label="Subject">{subject?.name || "—"}</td>
                    <td data-label="Date">{formatDate(row.assessment_date)}</td>
                    <td data-label="Total" className="numeric">{row.total_score}</td>
                    <td data-label="Status"><span className={`badge ${row.status === "published" ? "badge-green" : row.status === "archived" ? "badge-gray" : "badge-purple"}`}>{row.status === "published" ? "Released" : row.status.charAt(0).toUpperCase() + row.status.slice(1)}</span></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
