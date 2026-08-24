/**
 * Next.js instrumentation hook. `register()` runs exactly once when the server
 * process starts — the ideal place to boot the download engine so that, on a
 * machine reboot, the service starts the web app AND brings the auto-start
 * download instances online in a single chain.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startEventLoopMonitor } = await import("@/lib/eventLoopMonitor");
    startEventLoopMonitor();

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

    // Real gap found during the playback engine audit (TODO_POST_MOTEUR_LECTURE.md
    // §5): neither ffmpeg engine (Plex remux, local) had a process-exit
    // cleanup hook — a container restart/redeploy left any in-flight ffmpeg
    // child process running orphaned, still holding the source file open
    // and burning CPU on hardware that (per the DS923+ investigation,
    // 2026-08-24) has very little to spare. Best-effort SIGTERM to every
    // tracked session on shutdown; deliberately does NOT call process.exit()
    // itself — that stays Next.js's own responsibility, this only makes sure
    // ffmpeg doesn't outlive it. Guarded against double-registration on dev
    // hot-reload, same pattern as __movvizFetchPatched above.
    const g2 = globalThis as typeof globalThis & { __movvizShutdownHooksInstalled?: boolean };
    if (!g2.__movvizShutdownHooksInstalled) {
      g2.__movvizShutdownHooksInstalled = true;
      const shutdown = async (signal: string) => {
        try {
          const { stopAllLocalSessions } = await import("@/lib/playback/engine/localExecutor");
          stopAllLocalSessions();
        } catch { /* module not loaded yet — nothing to stop */ }
        try {
          const { stopAllRemuxSessions } = await import("@/lib/playback/ffmpeg/remuxSession");
          stopAllRemuxSessions();
        } catch { /* module not loaded yet — nothing to stop */ }
        console.log(`[shutdown] ${signal} reçu — sessions ffmpeg actives arrêtées`);
      };
      process.on("SIGTERM", () => void shutdown("SIGTERM"));
      process.on("SIGINT", () => void shutdown("SIGINT"));
    }

    // Explicit user request (2026-08-24): the server capability benchmark
    // should run automatically right after an update installs, not only
    // when someone remembers to click the manual button in Réglages →
    // Performance. shouldAutoRunBenchmark() compares the last result's
    // recorded app version against the current one — true on first boot
    // ever, or right after ANY version bump, Windows one-click installer or
    // Docker/NAS image re-pull alike (both just end in a fresh process
    // boot). Fire-and-forget: the real encode profiles take a few seconds
    // each on capable hardware but could take much longer on the exact
    // weak servers this benchmark exists for — never block server startup
    // on it.
    //
    // 60s delay before firing — confirmed live on the real production
    // DS923+ (2026-08-24): the very first auto-run, firing immediately
    // after a fresh deploy, measured 0.53x/0.40x; a clean manual re-run
    // moments later (container fully settled) measured 1.10x/0.96x on the
    // exact same hardware for the exact same profiles — the immediate
    // reading was contaminated by the container's own startup load (this
    // same boot sequence's other tasks, Next.js warming up, etc.), not a
    // real hardware number. A short wait lets that settle first.
    const { shouldAutoRunBenchmark, runServerBenchmark } = await import("@/lib/playback/engine/serverBenchmark");
    if (shouldAutoRunBenchmark()) {
      setTimeout(() => {
        runServerBenchmark()
          .then((r) => console.log(`[benchmark] auto-run après mise à jour terminé (${r.profiles.length} profil(s))`))
          .catch((e: unknown) => console.error(`[benchmark] auto-run après mise à jour échoué: ${(e as Error)?.message ?? e}`));
      }, 60_000).unref();
    }
  }
}
