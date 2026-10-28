/** Clear stores that keep account-specific state outside the JSON cache. */
export function clearResetMemory(): void {
  const g = globalThis as unknown as Record<string, unknown>;
  for (const name of ["__movvizSearchLogTimer", "__movvizAiDebugLogTimer", "__movvizAiChatsTimer", "__movvizDecisionLogTimer", "__movvizStatusLogTimer", "__movvizPlexSyncSoonTimer"]) {
    const timer = g[name];
    if (timer) clearTimeout(timer as ReturnType<typeof setTimeout>);
    g[name] = null;
  }
  const watchTimers = g.__movvizWatchEventTimers;
  if (watchTimers instanceof Map) for (const timer of watchTimers.values()) clearTimeout(timer as ReturnType<typeof setTimeout>);
  for (const name of ["__movvizSearchLog", "__movvizAiDebugLog", "__movvizAiChats", "__movvizDecisionLog", "__movvizStatusLog", "__movvizMediaIdentityMap", "__movvizMediaIdentityReverse", "__movvizPlexObservedMap", "__movvizPlexBindings", "__movvizPlexCircuit", "__movvizPlexUserContextCache", "__movvizUserContextProjectionThrottle", "__movvizWatchEventTimers", "__movvizWatchEventLastPlayback", "__movvizPlaybackSessions", "__movvizPlaybackEngineSessions", "__movvizLocalEngineSessions"]) {
    const value = g[name];
    if (Array.isArray(value)) value.length = 0;
    else if (value instanceof Map || value instanceof Set) value.clear();
    else g[name] = undefined;
  }
  g.__movvizPlaybackProgress = undefined;
  g.__movvizQualityUpgradeState = undefined;
  for (const name of ["__movvizTmdbKeyCache", "__movvizMarkerStore", "__movvizQueueSnapshot", "__movvizC411Session", "__movvizPlexLastSnapshot", "__movvizVerifiedOnDeckCache"]) g[name] = undefined;
  for (const name of ["__movvizIndexScan", "__movvizIndexImport"]) {
    const state = g[name] as { movie?: unknown[]; series?: unknown[] } | undefined;
    if (Array.isArray(state?.movie)) state.movie.length = 0;
    if (Array.isArray(state?.series)) state.series.length = 0;
  }
}

/** Long-running work outside the job queue must settle before clearing stores. */
export function resetHasBackgroundActivity(): boolean {
  const g = globalThis as unknown as Record<string, unknown>;
  return Boolean(g.__movvizPlexSyncInFlight || g.__movvizWatchResetRunning || g.__movvizRecoverRunning);
}
