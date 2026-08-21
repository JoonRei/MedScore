import { getStudentSession } from "@/lib/student-session";
import { getActiveSubjectIds, loadReleasedNotifications } from "@/lib/student-notifications";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

const POLL_MS = 2200;
const STREAM_LIFETIME_MS = 26000;

export async function GET(request: Request) {
  const session = await getStudentSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const encoder = new TextEncoder();
  const requestedSince = new URL(request.url).searchParams.get("since");
  const resumeFrom = request.headers.get("last-event-id") || requestedSince;
  let cursor = resumeFrom && !Number.isNaN(new Date(resumeFrom).getTime())
    ? new Date(resumeFrom).toISOString()
    : new Date().toISOString();

  let subjectIds: string[] = [];
  try {
    subjectIds = await getActiveSubjectIds(session.student);
  } catch (error) {
    console.error("student notification stream: subjects failed", error);
    return new Response("Unable to start live updates", { status: 500 });
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let interval: ReturnType<typeof setInterval> | null = null;
      let lifetime: ReturnType<typeof setTimeout> | null = null;
      let polling = false;
      let closed = false;
      const delivered = new Set<string>();

      const send = (text: string) => {
        if (!closed) controller.enqueue(encoder.encode(text));
      };

      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (interval) clearInterval(interval);
        if (lifetime) clearTimeout(lifetime);
        try { controller.close(); } catch { /* stream already closed */ }
      };

      const poll = async () => {
        if (closed || polling || !subjectIds.length) return;
        polling = true;
        try {
          const items = await loadReleasedNotifications(session.student, {
            after: cursor,
            limit: 12,
            subjectIds,
          });
          const ordered = [...items].sort((a, b) => new Date(a.releasedAt).getTime() - new Date(b.releasedAt).getTime());
          for (const item of ordered) {
            if (delivered.has(item.id)) continue;
            delivered.add(item.id);
            cursor = new Date(Math.max(new Date(cursor).getTime(), new Date(item.releasedAt).getTime())).toISOString();
            send(`id: ${item.releasedAt}\nevent: score_release\ndata: ${JSON.stringify(item)}\n\n`);
          }
        } catch (error) {
          console.error("student notification stream: poll failed", error);
        } finally {
          polling = false;
        }
      };

      send("retry: 1800\n\n");
      send(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`);
      void poll();
      interval = setInterval(() => void poll(), POLL_MS);
      lifetime = setTimeout(cleanup, STREAM_LIFETIME_MS);
      request.signal.addEventListener("abort", cleanup, { once: true });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
