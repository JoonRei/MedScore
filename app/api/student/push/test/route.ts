import { NextResponse } from "next/server";
import { getStudentSession } from "@/lib/student-session";
import { sendTestPush } from "@/lib/push-notifications";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return origin === new URL(request.url).origin;
}

export async function POST(request: Request) {
  const session = await getStudentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request." }, { status: 403 });

  try {
    const body = await request.json().catch(() => ({}));
    const endpoint = String(body?.endpoint || "").trim();
    if (!endpoint) return NextResponse.json({ error: "This device is not connected to notifications." }, { status: 400 });
    const result = await sendTestPush(session.student.id, endpoint);
    if (!result.sent) {
      const message = result.reason === "unconfigured"
        ? "Phone notifications need the one-time notification setup first."
        : result.reason === "missing"
          ? "This device needs to reconnect to phone notifications."
          : "The test notification could not be delivered.";
      return NextResponse.json({ error: message }, { status: 503 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("student push test failed", error);
    return NextResponse.json({ error: "The test notification could not be delivered." }, { status: 500 });
  }
}
