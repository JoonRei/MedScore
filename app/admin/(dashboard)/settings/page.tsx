import { PageHeader } from "@/components/PageHeader";
import { AcademicPeriodsClient } from "@/components/AcademicPeriodsClient";
import { PwaInstall } from "@/components/PwaInstall";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function Page() {
  const user = await requireAdmin();
  const { data: periods } = await createAdminClient().from("academic_periods").select("id,academic_year,term,is_active").order("academic_year", { ascending: false }).order("term");
  return <>
    <PageHeader eyebrow="Configuration" title="Settings" description="Academic periods, installation and core security settings for MedScores." />
    <AcademicPeriodsClient periods={(periods || []) as any[]} />
    <div className="panel settings-panel-compact">
      <div className="settings-list">
        <PwaInstall />
        <div className="settings-row"><div><h3>Administrator</h3><p>Authenticated through Supabase Authentication. Keep only your Admin account there.</p></div><div className="settings-value">{user.email}</div></div>
        <div className="settings-row"><div><h3>Student authentication</h3><p>Code name plus 4–6 digit PIN.</p></div><div className="settings-value">Enabled</div></div>
        <div className="settings-row"><div><h3>Session security</h3><p>Accounts automatically sign out after inactivity; student sessions also have a maximum duration.</p></div><div className="settings-value">15 min inactivity · 12 hr maximum</div></div>
        <div className="settings-row"><div><h3>Failed login protection</h3><p>Temporary lock after repeated incorrect student sign-ins.</p></div><div className="settings-value">5 attempts · 15 minutes</div></div>
        <div className="settings-row"><div><h3>Score visibility</h3><p>Students see only assessment results that have been released.</p></div><div className="settings-value">Draft → Released</div></div>
      </div>
    </div>
  </>;
}
