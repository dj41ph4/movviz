"use client";
import { useEffect, useRef } from "react";
import { mutate } from "swr";

const BACKOFF_MIN_MS = 1000;
const BACKOFF_MAX_MS = 30_000;

const EVENT_MUTATIONS: Record<string, string[]> = {
  library: [
    "/api/library/movies",
    "/api/library/series",
    "/api/interface/dashboard",
    "/api/interface/library-status",
    "/api/activity/v2?tab=wanted",
    "/api/requests",
  ],
  download: ["/api/engine/torrents", "/api/activity/v2?tab=queue", "/api/interface/summary"],
  request: ["/api/requests", "/api/interface/summary"],
  notification: ["/api/notifications", "/api/interface/summary"],
  user: ["/api/users", "/api/interface/summary"],
  activity: ["/api/activity", "/api/activity/v2?tab=history", "/api/activity/v2?tab=failures", "/api/activity/v2?tab=unlinked"],
};

let globalRetryMs = BACKOFF_MIN_MS;
let globalReconnectTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleReconnect(connect: () => void) {
  if (globalReconnectTimer) clearTimeout(globalReconnectTimer);
  globalReconnectTimer = setTimeout(() => {
    globalRetryMs = Math.min(globalRetryMs * 2, BACKOFF_MAX_MS);
    connect();
  }, globalRetryMs);
}

/**
 * Opens a single SSE connection to /api/events and triggers SWR revalidation
 * on the relevant keys for each event type. Mount once at the app root —
 * every consumer benefiting from an SSE-affected key gets instant updates
 * without polling. Reconnects with exponential backoff on failure.
 *
 * `enabled` (default true) lets a caller skip connecting — e.g. AppShell
 * calls this unconditionally (every hook must run on every render, login
 * page included, or React throws "rendered more hooks than previous render"
 * the moment currentUser flips from unauthenticated to authenticated
 * mid-session) but still shouldn't open an SSE connection while signed out.
 */
export function useLibrarySSE(enabled = true) {
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!enabled) return;
    function connect() {
      esRef.current?.close();

      const es = new EventSource("/api/events");
      esRef.current = es;

      es.onopen = () => {
        globalRetryMs = BACKOFF_MIN_MS;
      };

      for (const [channel, keys] of Object.entries(EVENT_MUTATIONS)) {
        es.addEventListener(channel, () => {
          for (const key of keys) mutate(key);
        });
      }

      es.onerror = () => {
        es.close();
        scheduleReconnect(connect);
      };
    }

    connect();
    return () => {
      if (globalReconnectTimer) clearTimeout(globalReconnectTimer);
      esRef.current?.close();
    };
  }, [enabled]);
}
