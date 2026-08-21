import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

function pushConfig() {
  const publicKey = String(process.env.VAPID_PUBLIC_KEY || "").trim();
  const privateKey = String(process.env.VAPID_PRIVATE_KEY || "").trim();
  const adminEmail = String(process.env.ADMIN_EMAIL || "").trim();
  const subject = String(process.env.VAPID_SUBJECT || (adminEmail ? `mailto:${adminEmail}` : "mailto:admin@example.com")).trim();
  if (!publicKey || !privateKey) return null;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return { publicKey };
}

export function getPushPublicKey() {
  return pushConfig()?.publicKey || "";
}

export async function sendAssessmentReleasePush(assessmentId: string, ownerId: string) {
  const config = pushConfig();
  if (!config) return { sent: 0, skipped: true };

  const db = createAdminClient();
  const { data: assessment, error: assessmentError } = await db
    .from("assessments")
    .select("id,title,assessment_type,released_at,subject_id,subjects!inner(name,owner_id),scores(student_id,result_status)")
    .eq("id", assessmentId)
    .eq("subjects.owner_id", ownerId)
    .maybeSingle();
  if (assessmentError || !assessment) return { sent: 0, skipped: false };

  const subject = Array.isArray((assessment as any).subjects) ? (assessment as any).subjects[0] : (assessment as any).subjects;
  const scores = Array.isArray((assessment as any).scores) ? (assessment as any).scores : [];
  const studentIds = Array.from(new Set(scores.map((row: any) => String(row.student_id || "")).filter(Boolean)));
  if (!studentIds.length) return { sent: 0, skipped: false };

  const { data: subscriptions } = await db
    .from("student_push_subscriptions")
    .select("id,student_id,endpoint,p256dh,auth")
    .eq("owner_id", ownerId)
    .in("student_id", studentIds);
  if (!subscriptions?.length) return { sent: 0, skipped: false };

  const payload = JSON.stringify({
    title: "New result available",
    body: `${String(subject?.name || "Subject")} · ${String((assessment as any).title || "Assessment")}`,
    url: "/student/notifications",
    assessmentId: String((assessment as any).id),
    releasedAt: String((assessment as any).released_at || new Date().toISOString()),
  });

  let sent = 0;
  await Promise.all(subscriptions.map(async (row: any) => {
    try {
      await webpush.sendNotification({
        endpoint: String(row.endpoint),
        keys: { p256dh: String(row.p256dh), auth: String(row.auth) },
      }, payload, { TTL: 60 * 60 * 12, urgency: "high" });
      sent += 1;
    } catch (error: any) {
      const status = Number(error?.statusCode || 0);
      if (status === 404 || status === 410) {
        await db.from("student_push_subscriptions").delete().eq("id", row.id);
      } else {
        console.error("student push delivery failed", error);
      }
    }
  }));

  return { sent, skipped: false };
}
