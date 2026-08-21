import { PageHeader } from "@/components/PageHeader";
import { ChangePinForm } from "@/components/ChangePinForm";
import { PwaInstall } from "@/components/PwaInstall";
import { StudentPasskeySettings } from "@/components/StudentPasskeySettings";
import { StudentDeviceNotifications } from "@/components/StudentDeviceNotifications";
import { requireStudent } from "@/lib/student-session";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function Page() {
  const { student } = await requireStudent();
  const { count } = await createAdminClient()
    .from("student_passkeys")
    .select("credential_id", { count: "exact", head: true })
    .eq("student_id", student.id);

  return (
    <>
      <PageHeader eyebrow="Account" title="Settings" description="Manage your sign-in, phone notifications and app access." />

      <div className="student-settings-layout-v419">
        <section className="panel student-setting-card-v419 student-setting-card-fingerprint-v419">
          <StudentPasskeySettings count={count || 0} />
        </section>

        <section className="panel student-setting-card-v419 student-setting-card-notifications-v422">
          <StudentDeviceNotifications />
        </section>

        <section className="panel student-setting-card-v419 student-setting-card-pin-v419">
          <div className="student-setting-card-head-v419">
            <div>
              <span className="student-setting-eyebrow-v419">Security</span>
              <h2>Change PIN</h2>
              <p>Update the 4 to 6 digit PIN used when signing in without fingerprint.</p>
            </div>
          </div>
          <ChangePinForm />
        </section>

        <section className="panel student-setting-card-v419 student-setting-card-install-v419">
          <PwaInstall mode="student-card" />
        </section>
      </div>
    </>
  );
}
