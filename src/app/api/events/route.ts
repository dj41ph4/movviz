import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { eventBus } from "@/lib/events/EventBus";
import type { AppEvent } from "@/lib/events/EventBus";
import { ensureDownloadWatcher } from "@/lib/events/downloadWatcher";
import { getMovie, getSeries } from "@/lib/library/store";

/** What a device needs to act on a library change without re-reading the
 *  whole library: which title (TMDb id) and whether it is playable now. */
function withTitleState(event: AppEvent): object {
  if (event.type === "movie_updated") {
    const movie = getMovie(event.movieId);
    return movie ? { ...event, mediaType: "movie", tmdbId: movie.tmdbId, status: movie.status } : event;
  }
  if (event.type === "series_updated") {
    const series = getSeries(event.seriesId);
    if (!series) return event;
    let availableEpisodes = 0;
    for (const season of series.seasons) for (const episode of season.episodes) if (episode.status === "available") availableEpisodes++;
    return { ...event, mediaType: "series", tmdbId: series.tmdbId, availableEpisodes };
  }
  return event;
}

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
  watch_changed: "watch",
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
        // A user's views and resume positions go to that user's devices only.
        if (event.type === "watch_changed" && event.userId !== user.id) return;
        const channel = EVENT_SSE_CHANNEL[event.type];
        const data = JSON.stringify(channel === "library" ? withTitleState(event) : event);
        try {
          controller.enqueue(encoder.encode(`event: ${channel}\ndata: ${data}\n\n`));
        } catch {
          // client disconnected
        }
      });
      // A device is listening: the server now reports download changes itself.
      ensureDownloadWatcher();
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
