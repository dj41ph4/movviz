import { eventBus } from "@/lib/events/EventBus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * SSE endpoint — streams `library` events as they happen. The client hook
 * (useLibrarySSE) connects here and revalidates SWR keys on each event so
 * status badges update in real time without polling.
 */
export async function GET() {
  const encoder = new TextEncoder();
  let cleanup: (() => void) | undefined;
  let keepAlive: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      cleanup = eventBus.on((event) => {
        const data = JSON.stringify(event);
        controller.enqueue(encoder.encode(`event: library\ndata: ${data}\n\n`));
      });
      keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          clearInterval(keepAlive);
        }
      }, 20_000);
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
