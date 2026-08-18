import { PageHeader } from "@/components/PageHeader";
import { ChangePinForm } from "@/components/ChangePinForm";
import { PwaInstall } from "@/components/PwaInstall";
import { requireStudent } from "@/lib/student-session";

export default async function Page() {
  await requireStudent();
  return <>
    <PageHeader eyebrow="Account" title="Settings" description="Manage your PIN and install MedScores on this device." />
    <div className="panel">
      <div className="settings-list student-settings-list"><PwaInstall /></div>
      <div className="panel-header settings-pin-header"><div><h2>Change PIN</h2><p>Use 4 to 6 digits. Your current PIN is never displayed.</p></div></div>
      <ChangePinForm />
    </div>
  </>;
}
