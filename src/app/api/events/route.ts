import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { eventBus } from "@/lib/events/EventBus";
import type { AppEvent } from "@/lib/events/EventBus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const KEEPALIVE_MS = 15_000;

const EVENT_SSE_CHANNEL: Record<AppEvent["type"], string> = {
  movie_updated: "library",
  series_updated: "library",
  download_changed: "download",
  request_updated: "request",
  notification_added: "notification",
  user_updated: "user",
  activity_updated: "activity",
};

export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const encoder = new TextEncoder();
  let cleanup: (() => void) | undefined;
  let keepAlive: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      cleanup = eventBus.on((event) => {
        const channel = EVENT_SSE_CHANNEL[event.type];
        const data = JSON.stringify(event);
        try {
          controller.enqueue(encoder.encode(`event: ${channel}\ndata: ${data}\n\n`));
        } catch {
          // client disconnected
        }
      });
      keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          clearInterval(keepAlive);
        }
      }, KEEPALIVE_MS);
    },
    cancel() {
      cleanup?.();
      clearInterval(keepAlive);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
