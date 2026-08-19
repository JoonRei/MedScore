import { PageHeader } from "@/components/PageHeader";
import { ChangePinForm } from "@/components/ChangePinForm";
import { PwaInstall } from "@/components/PwaInstall";
import { StudentPasskeySettings } from "@/components/StudentPasskeySettings";
import { requireStudent } from "@/lib/student-session";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function Page() {
  const { student } = await requireStudent();
  const { count } = await createAdminClient()
    .from("student_passkeys")
    .select("credential_id", { count: "exact", head: true })
    .eq("student_id", student.id);

  return <>
    <PageHeader eyebrow="Account" title="Settings" description="Manage your sign-in and app access." />
    <section className="panel student-settings-compact settings-compact-panel">
      <div className="student-settings-items">
        <StudentPasskeySettings count={count || 0} />
        <div className="student-settings-row student-pin-settings-row">
          <div className="student-settings-copy"><h3>Change PIN</h3><p>Update your 4 to 6 digit sign-in PIN.</p></div>
          <div className="student-pin-form"><ChangePinForm /></div>
        </div>
        <PwaInstall compact />
      </div>
    </section>
  </>;
}
