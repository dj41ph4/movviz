"use client";
import { useEffect, useRef } from "react";
import { mutate } from "swr";

const BACKOFF_MIN_MS = 1000;
const BACKOFF_MAX_MS = 30_000;

const EVENT_MUTATIONS: Record<string, string[]> = {
  library: ["/api/library/movies", "/api/library/series", "/api/activity/v2?tab=wanted", "/api/requests"],
  download: ["/api/engine/torrents", "/api/activity/v2?tab=queue"],
  request: ["/api/requests"],
  notification: ["/api/notifications"],
  user: ["/api/users"],
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
 */
export function useLibrarySSE() {
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
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
  }, []);
}