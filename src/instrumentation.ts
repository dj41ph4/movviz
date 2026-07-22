/**
 * Next.js instrumentation hook. `register()` runs exactly once when the server
 * process starts — the ideal place to boot the download engine so that, on a
 * machine reboot, the service starts the web app AND brings the auto-start
 * download instances online in a single chain.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { recordPerf, perfLabel } = await import("@/lib/perf");

    // Time every OUTBOUND fetch the server makes (TMDb, Plex, indexers,
    // engine…) — hidden latency in an API route almost always turns out to
    // be one of these. Guarded against double-patching on dev hot reload.
    const g = globalThis as typeof globalThis & { __movvizFetchPatched?: boolean };
    if (!g.__movvizFetchPatched) {
      g.__movvizFetchPatched = true;
      const origFetch = globalThis.fetch;
      globalThis.fetch = async (input, init) => {
        const url =
          typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        const start = performance.now();
        try {
          const res = await origFetch(input, init);
          recordPerf({
            t: Date.now(),
            kind: "outbound",
            label: perfLabel(url),
            ms: Math.round(performance.now() - start),
            status: res.status,
          });
          return res;
        } catch (e) {
          recordPerf({
            t: Date.now(),
            kind: "outbound",
            label: perfLabel(url),
            ms: Math.round(performance.now() - start),
            status: null,
          });
          throw e;
        }
      };
    }

    const { reconcileStaleSearches } = await import("@/lib/library/reconcileStaleSearches");
    reconcileStaleSearches();

    const { bootstrapEngine } = await import("@/lib/engine/bootstrap");
    await bootstrapEngine();

    const { bootstrapResolver } = await import("@/lib/resolver/bootstrap");
    await bootstrapResolver();

    // Seed the RSS cache on boot so searches work immediately instead of
    // returning nothing until the first scheduled refresh (every 6h).
    // This runs BEFORE startScheduler so the cache is warm before any
    // scheduler task (which may also call refreshRssCache) fires.
    // Rate limits are cleared both before and after: at boot there are
    // never stale limits (in-memory only, wiped on restart), but if this
    // refresh itself gets 429'd it must not lock out the indexer for the
    // next 10 minutes — the cooldown would make every subsequent RSS scan
    // (and therefore every search) useless until it expires.
    const { clearAllRateLimits } = await import("@/lib/indexers/rateLimit");
    clearAllRateLimits();
    const { refreshRssCache: bootRefreshRss } = await import("@/lib/indexers/rssCache");
    const { recordSearchLog: logBoot } = await import("@/lib/diagnostic/searchLog");
    const bootResult = await bootRefreshRss().catch((e: unknown) => {
      logBoot("error", "boot.rss_refresh_failed", `Refresh boot échoué: ${(e as Error)?.message ?? e}`);
      return null;
    });
    if (bootResult) {
      logBoot("info", "boot.rss_refresh_done", `Cache RSS amorcé au boot: ${bootResult.fetched} release(s)`);
    }
    clearAllRateLimits();

    const { startScheduler } = await import("@/lib/scheduler/engine");
    startScheduler();
  }
}
