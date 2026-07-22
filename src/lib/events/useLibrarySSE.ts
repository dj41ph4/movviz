"use client";
import { useEffect, useRef } from "react";
import { mutate } from "swr";

const SSE_RECONNECT_MS = 3000;

/**
 * Opens a single SSE connection to /api/events and triggers SWR revalidation
 * on the library keys whenever a library change event arrives. Mount this
 * once at the app root — every consumer of `/api/library/movies` or
 * `/api/library/series` gets the new data immediately.
 */
export function useLibrarySSE() {
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let retryTimer: ReturnType<typeof setTimeout>;

    function connect() {
      esRef.current?.close();

      const es = new EventSource("/api/events");
      esRef.current = es;

      es.addEventListener("library", (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === "movie_updated") mutate("/api/library/movies");
          if (data.type === "series_updated") mutate("/api/library/series");
        } catch {
          // ignore
        }
      });

      es.onerror = () => {
        es.close();
        retryTimer = setTimeout(connect, SSE_RECONNECT_MS);
      };
    }

    connect();
    return () => {
      clearTimeout(retryTimer);
      esRef.current?.close();
    };
  }, []);
}
