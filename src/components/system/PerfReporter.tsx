"use client";

import { useEffect } from "react";

/**
 * Times every /api call the browser makes — the latency the user actually
 * feels — and ships batches to /api/perf so the Diagnostics panel can rank
 * the slow endpoints. Mounted once in the root layout; renders nothing.
 */
export function PerfReporter() {
  useEffect(() => {
    const w = window as typeof window & { __movvizPerfPatched?: boolean };
    if (w.__movvizPerfPatched) return;
    w.__movvizPerfPatched = true;

    const orig = window.fetch.bind(window);
    const pending: { t: number; label: string; ms: number; status: number | null }[] = [];

    window.fetch = async (input, init) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      // Only same-origin API calls, and never our own reporting endpoint.
      const isApi = url.startsWith("/api/") && !url.startsWith("/api/perf");
      if (!isApi) return orig(input, init);

      const start = performance.now();
      try {
        const res = await orig(input, init);
        pending.push({ t: Date.now(), label: url, ms: performance.now() - start, status: res.status });
        return res;
      } catch (e) {
        pending.push({ t: Date.now(), label: url, ms: performance.now() - start, status: null });
        throw e;
      }
    };

    const flush = () => {
      if (!pending.length) return;
      const entries = pending.splice(0, pending.length);
      orig("/api/perf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entries }),
        keepalive: true,
      }).catch(() => {});
    };

    const id = setInterval(flush, 5000);
    window.addEventListener("beforeunload", flush);
    return () => {
      clearInterval(id);
      window.removeEventListener("beforeunload", flush);
    };
  }, []);

  return null;
}
