import { NextResponse } from "next/server";
import { getStudentSession } from "@/lib/student-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPushPublicKey } from "@/lib/push-notifications";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return origin === new URL(request.url).origin;
}

export async function GET() {
  const session = await getStudentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const publicKey = getPushPublicKey();
  return NextResponse.json({ configured: Boolean(publicKey), publicKey }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const session = await getStudentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request." }, { status: 403 });

  try {
    const body = await request.json();
    const subscription = body?.subscription;
    const endpoint = String(subscription?.endpoint || "").trim();
    const p256dh = String(subscription?.keys?.p256dh || "").trim();
    const auth = String(subscription?.keys?.auth || "").trim();
    if (!endpoint || !p256dh || !auth) return NextResponse.json({ error: "Invalid notification subscription." }, { status: 400 });

    const db = createAdminClient();
    const row = {
      student_id: session.student.id,
      owner_id: session.student.owner_id,
      endpoint,
      p256dh,
      auth,
      user_agent: request.headers.get("user-agent") || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await db.from("student_push_subscriptions").upsert(row, { onConflict: "endpoint" });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("student push subscription save failed", error);
    return NextResponse.json({ error: "Unable to enable device notifications." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getStudentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request." }, { status: 403 });

  try {
    const body = await request.json().catch(() => ({}));
    const endpoint = String(body?.endpoint || "").trim();
    if (endpoint) {
      const db = createAdminClient();
      await db.from("student_push_subscriptions").delete().eq("student_id", session.student.id).eq("endpoint", endpoint);
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to disable device notifications." }, { status: 500 });
  }
}
