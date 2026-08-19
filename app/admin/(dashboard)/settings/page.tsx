import { PageHeader } from "@/components/PageHeader";
import { AcademicPeriodsClient } from "@/components/AcademicPeriodsClient";
import { PwaInstall } from "@/components/PwaInstall";
import { requireAdminWorkspace } from "@/lib/admin-workspace";

export default async function Page() {
  const context = await requireAdminWorkspace();
  return <>
    <PageHeader eyebrow="Configuration" title="Settings" description="Manage your MedScores preferences and access." />
    <div className="settings-page-stack">
      <AcademicPeriodsClient periods={context.periods} selectedPeriodId={context.selectedPeriodId} />
      <section className="panel settings-compact-panel">
        <div className="settings-compact-list">
          <div className="settings-compact-row"><div><h3>Admin account</h3><p>{context.profile.display_name}</p></div><strong>{context.profile.email}</strong></div>
          <PwaInstall />
          <div className="settings-compact-row"><div><h3>Auto sign-out</h3><p>Protects the account after inactivity.</p></div><strong>15 minutes</strong></div>
        </div>
      </section>
    </div>
  </>;
}
