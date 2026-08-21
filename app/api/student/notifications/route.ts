import { NextResponse } from "next/server";
import { getStudentSession } from "@/lib/student-session";
import { loadReleasedNotifications } from "@/lib/student-notifications";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const session = await getStudentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const notifications = await loadReleasedNotifications(session.student, { unreadOnly: true, limit: 20 });
    return NextResponse.json({ notifications }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("student notifications: load failed", error);
    return NextResponse.json({ error: "Unable to load notifications." }, { status: 500 });
  }
}
