import { PageHeader } from "@/components/PageHeader";
import { StudentNotificationsPage } from "@/components/StudentNotificationsPage";
import { requireStudent } from "@/lib/student-session";
import { loadReleasedNotifications } from "@/lib/student-notifications";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NotificationsPage() {
  const session = await requireStudent();
  const items = await loadReleasedNotifications(session.student, { unreadOnly: false, limit: 40 });
  return <>
    <PageHeader eyebrow="Student portal" title="Notifications" description="Review newly released assessment results and unread updates." />
    <StudentNotificationsPage initialItems={items} />
  </>;
}
