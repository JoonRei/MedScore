import "server-only";
import webpush from "web-push";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function pushConfig() {
  try {
    const publicKey = String(process.env.VAPID_PUBLIC_KEY || "").trim();
    const privateKey = String(process.env.VAPID_PRIVATE_KEY || "").trim();
    const adminEmail = String(process.env.ADMIN_EMAIL || "").trim();
    const subject = String(process.env.VAPID_SUBJECT || (adminEmail ? `mailto:${adminEmail}` : "mailto:admin@example.com")).trim();
    if (!publicKey || !privateKey) return null;
    webpush.setVapidDetails(subject, publicKey, privateKey);
    return { publicKey };
  } catch (error) {
    // A push configuration problem must never break score release itself.
    console.error("student push configuration failed", error);
    return null;
  }
}

export function getPushPublicKey() {
  return pushConfig()?.publicKey || "";
}

type StoredSubscription = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
  assessmentId?: string | null;
  releasedAt?: string | null;
};

type DeliveryResult =
  | { ok: true }
  | { ok: false; reason: "unconfigured" | "expired" | "delivery" };

async function deliver(subscription: StoredSubscription, payload: PushPayload): Promise<DeliveryResult> {
  const config = pushConfig();
  if (!config) return { ok: false, reason: "unconfigured" };

  try {
    await webpush.sendNotification({
      endpoint: String(subscription.endpoint),
      keys: { p256dh: String(subscription.p256dh), auth: String(subscription.auth) },
    }, JSON.stringify(payload), {
      // A push provider only needs to acknowledge the message here. Do not let a
      // slow provider keep an assessment-release request open indefinitely.
      timeout: 5000,
      TTL: 60 * 60 * 24,
      urgency: "high",
    });
    return { ok: true };
  } catch (error: any) {
    const status = Number(error?.statusCode || 0);
    if (status === 404 || status === 410) return { ok: false, reason: "expired" };
    console.error("student push delivery failed", {
      status: status || null,
      endpointHost: (() => {
        try { return new URL(String(subscription.endpoint)).host; } catch { return "unknown"; }
      })(),
      message: error instanceof Error ? error.message : String(error || "Unknown push error"),
    });
    return { ok: false, reason: "delivery" };
  }
}

export async function sendTestPush(studentId: string, endpoint: string) {
  if (!pushConfig()) return { sent: false, reason: "unconfigured" };
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("student_push_subscriptions")
      .select("id,endpoint,p256dh,auth")
      .eq("student_id", studentId)
      .eq("endpoint", endpoint)
      .maybeSingle();
    if (error || !data) return { sent: false, reason: "missing" };

    const result = await deliver(data as StoredSubscription, {
      title: "MedScores notifications are ready",
      body: "This is a phone notification test. New score releases will appear here automatically.",
      url: "/student/notifications",
      tag: "medscores-notification-test",
    });
    if (!result.ok && result.reason === "expired") {
      await db.from("student_push_subscriptions").delete().eq("id", data.id);
    }
    return { sent: result.ok, reason: result.ok ? null : result.reason };
  } catch (error) {
    console.error("student push test dispatch failed", error);
    return { sent: false, reason: "delivery" };
  }
}

async function dispatchAssessmentReleasePush(assessmentId: string, ownerId: string) {
  try {
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

    const { data: subscriptions, error: subscriptionsError } = await db
      .from("student_push_subscriptions")
      .select("id,student_id,endpoint,p256dh,auth")
      .eq("owner_id", ownerId)
      .in("student_id", studentIds);
    if (subscriptionsError || !subscriptions?.length) {
      if (subscriptionsError) console.error("student push subscription lookup failed", subscriptionsError);
      return { sent: 0, skipped: false };
    }

    const subjectName = String(subject?.name || "Subject");
    const assessmentTitle = String((assessment as any).title || "Assessment");
    const releasedAt = String((assessment as any).released_at || new Date().toISOString());
    const payload: PushPayload = {
      title: "New score released",
      body: `${subjectName} · ${assessmentTitle}\nYour result is ready to view.`,
      url: `/student/results?assessment=${encodeURIComponent(String((assessment as any).id))}`,
      tag: `medscores-result-${String((assessment as any).id)}-${releasedAt}`,
      assessmentId: String((assessment as any).id),
      releasedAt,
    };

    const outcomes = await Promise.allSettled(subscriptions.map(async (row: any) => {
      const result = await deliver(row as StoredSubscription, payload);
      if (!result.ok && result.reason === "expired") {
        await db.from("student_push_subscriptions").delete().eq("id", row.id);
      }
      return result;
    }));

    const sent = outcomes.reduce((count, outcome) => {
      if (outcome.status === "fulfilled" && outcome.value.ok) return count + 1;
      return count;
    }, 0);
    return { sent, skipped: false };
  } catch (error) {
    console.error("student score-release push dispatch failed", error);
    return { sent: 0, skipped: false };
  }
}

export async function sendAssessmentReleasePush(assessmentId: string, ownerId: string) {
  // Releasing scores is the primary mutation. Push delivery is secondary work and
  // must not delay the Server Action response or its cache/router refresh. Next.js
  // `after()` keeps the Vercel invocation alive after the response is sent so the
  // notification can still be dispatched without sitting in the critical path.
  try {
    after(async () => {
      await dispatchAssessmentReleasePush(assessmentId, ownerId);
    });
    return { sent: 0, skipped: false };
  } catch (error) {
    // This helper is expected to run inside a Server Action/Route Handler. If it is
    // ever invoked outside a request context, fail closed rather than letting push
    // interfere with score release.
    console.error("student push scheduling failed", error);
    return { sent: 0, skipped: false };
  }
}
