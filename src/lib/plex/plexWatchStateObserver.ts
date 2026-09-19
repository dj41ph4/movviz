import { loadPlexConfig } from "./store";
import { batchPlexViewState, getLibrarySections, getSectionRawItemsAtomic } from "./client";
import type { PlexUserContext } from "./plexUserContext";
import type { PlexObservedState } from "./plexObservedState";
import { getObservedStatesForUser, setObservedStates, getObservedState, replaceObservedStatesForUserServer } from "./plexObservedState";
import { upsertMappings, resolveCanonical } from "./mediaIdentityMap";
import type { CanonicalMediaIdentity } from "./mediaIdentityMap";
import { recordSearchLog } from "@/lib/diagnostic/searchLog";
import { getMovieByTmdbId, getSeriesByTmdbId } from "@/lib/library/store";
import { batchTmdbIds } from "./client";

type SnapshotResult =
  | { ok: true; states: PlexObservedState[]; movieRatingKeys: string[]; showRatingKeys: string[]; episodeRatingKeys: string[] }
  | { ok: false; reason: string };

/**
 * PlexWatchStateObserver (§22-27)
 * Answers: "Quel est maintenant l'état de ce média pour CET utilisateur Plex ?"
 * Uses the user's OWN PMS token (PlexUserContext.serverToken) – never admin fallback.
 * Two strategies tested (see client.ts):
 *  A. batched metadata (batchPlexViewState) – preferred
 *  B. library scan with viewCount filter – fallback/benchmark
 *
 * Snapshot is built FULLY before diff (§95-97): fetch all pages, validate,
 * build complete set, THEN diff.
 */

export async function snapshotWatchState(ctx: PlexUserContext, opts?: { forceSnapshot?: boolean }): Promise<SnapshotResult> {
  const cfg = loadPlexConfig();
  if (!cfg.hostname) return { ok: false, reason: "plex_not_configured" };

  // 1) Discover all ratingKeys for movies + shows via adminToken (just IDs, not view state)
  // We use ctx.serverToken for view state, but need complete library listing.
  // Library listing via ctx.serverToken may be filtered per user (e.g., shared libs) – so we use ctx.serverToken for both listing + view state to keep consistent scope.
  // If user has restricted libraries, they will simply not see those items – correct per §25 (don't interpret missing as unwatched).
  const sections = await getLibrarySections(cfg, ctx.serverToken);
  if (sections.length === 0) {
    // Try admin token for listing if user token returns empty (e.g., friend with no direct section access? Should not happen for HOME)
    const fallback = await getLibrarySections(cfg, cfg.adminToken!);
    if (fallback.length === 0) return { ok: false, reason: "no_sections" };
    // For fallback, we still need view states via user token – but IDs from admin listing may include items user can't see.
    // That's ok: batchPlexViewState will simply not return those (filtered), they won't be marked watched.
    return snapshotViaBatch(ctx, fallback);
  }
  return snapshotViaBatch(ctx, sections);
}

async function snapshotViaBatch(ctx: PlexUserContext, sections: Awaited<ReturnType<typeof getLibrarySections>>): Promise<SnapshotResult> {
  const cfg = loadPlexConfig();
  const allMovieKeys = new Set<string>();
  const allShowKeys = new Set<string>();
  const allEpisodeKeys = new Set<string>(); // will be fetched via allLeaves per show

  // Gather movie and show ratingKeys – atomic per §4
  for (const section of sections) {
    const result = await getSectionRawItemsAtomic(cfg, section.key, ctx.serverToken);
    if (!result.complete) {
      recordSearchLog("warn", "plex.snapshot", `plex.snapshot listing incomplete user=${ctx.movvizUserId} section=${section.key} expected=${result.expectedTotal} received=${result.receivedTotal} error=${result.error ?? "unknown"} – snapshot invalid (§4)`);
      return { ok: false, reason: `listing_incomplete section=${section.key} ${result.error ?? ""}`.trim() };
    }
    for (const it of result.items) {
      if (section.type === "movie") allMovieKeys.add(it.ratingKey);
      else if (section.type === "show") allShowKeys.add(it.ratingKey);
    }
  }

  // For shows, we need episodes leaves – ATOMIC per §3: one failed show invalidates the whole snapshot
  const { mapWithConcurrency } = await import("@/lib/concurrency");
  const showKeyList = [...allShowKeys];
  const episodeKeysByShow = new Map<string, string[]>();
  let episodesFailed: { showKey: string; error: string } | null = null;
  await mapWithConcurrency(showKeyList, 5, async (showKey) => {
    if (episodesFailed) return;
    const { getShowEpisodesAtomic } = await import("./client");
    const result = await getShowEpisodesAtomic(cfg, showKey, ctx.serverToken);
    if (!result.complete) {
      episodesFailed = { showKey, error: result.error ?? "unknown" };
      return;
    }
    const keys = result.items.map((e) => e.ratingKey);
    episodeKeysByShow.set(showKey, keys);
    for (const k of keys) allEpisodeKeys.add(k);
  });
  if (episodesFailed) {
    const f = episodesFailed as { showKey: string; error: string };
    if (f.error.startsWith("plex_auth_failed")) {
      recordSearchLog("error", "plex.snapshot", `plex.snapshot episodes auth failed user=${ctx.movvizUserId} show=${f.showKey} ${f.error}`);
      return { ok: false, reason: `auth_failed:${f.error}` };
    }
    recordSearchLog("warn", "plex.snapshot", `plex.snapshot episodes incomplete user=${ctx.movvizUserId} show=${f.showKey} error=${f.error} – snapshot invalid (§3), no diff/replace/mutation`);
    return { ok: false, reason: `episodes_incomplete show=${f.showKey} ${f.error}` };
  }

  const allRatingKeys = [...allMovieKeys, ...allEpisodeKeys];
  // Show ratingKeys themselves are not watched directly; episodes are. So snapshot only movies + episodes.
  if (allRatingKeys.length === 0) {
    return { ok: true, states: [], movieRatingKeys: [], showRatingKeys: showKeyList, episodeRatingKeys: [] };
  }

  // Batch view state using USER token – atomic per §25-28
  let viewMap: Map<string, import("./client").PlexViewState>;
  try {
    viewMap = await batchPlexViewState(cfg, ctx.serverToken, allRatingKeys);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.startsWith("plex_auth_failed")) {
      recordSearchLog("error", "plex.snapshot", `plex.snapshot auth failed user=${ctx.movvizUserId} ${msg}`);
      return { ok: false, reason: `auth_failed:${msg}` };
    }
    if (msg.startsWith("plex_snapshot_partial")) {
      recordSearchLog("warn", "plex.snapshot", `plex.snapshot partial user=${ctx.movvizUserId} ${msg} – snapshot invalid (§25)`);
      return { ok: false, reason: msg };
    }
    recordSearchLog("warn", "plex.snapshot", `plex.snapshot batch error user=${ctx.movvizUserId} ${msg}`);
    return { ok: false, reason: `batch_error:${msg}` };
  }
  const now = Date.now();
  const states: PlexObservedState[] = [];
  let missingCount = 0;
  for (const rk of allRatingKeys) {
    const vs = viewMap.get(rk);
    if (!vs) {
      // Missing view state for a ratingKey that was in current library listing.
      // Per §23-25, absence of response is UNKNOWN, never UNWATCHED.
      // Counting as UNKNOWN avoids interpreting a fetch gap as a watch transition.
      missingCount++;
      states.push({
        userId: ctx.movvizUserId,
        machineIdentifier: ctx.machineIdentifier,
        ratingKey: rk,
        state: "UNKNOWN",
        observedAt: now,
      });
      continue;
    }
    const watched = (vs.viewCount ?? 0) > 0;
    states.push({
      userId: ctx.movvizUserId,
      machineIdentifier: ctx.machineIdentifier,
      ratingKey: rk,
      state: watched ? "WATCHED" : "UNWATCHED",
      viewCount: vs.viewCount,
      lastViewedAt: vs.lastViewedAt,
      viewOffset: vs.viewOffset,
      observedAt: now,
    });
  }

  // Build mediaIdentityMap entries (best-effort, for resolver)
  try {
    const tmdbMap = await batchTmdbIds(cfg, ctx.serverToken, [...allMovieKeys]);
    const showTmdbMap = await batchTmdbIds(cfg, ctx.serverToken, showKeyList);
    const entries: Parameters<typeof upsertMappings>[0] = [];
    for (const rk of allMovieKeys) {
      const tmdbId = tmdbMap.get(rk)?.tmdbId;
      if (tmdbId != null) entries.push({ machineIdentifier: ctx.machineIdentifier, ratingKey: rk, canonical: { type: "movie", tmdbId }, updatedAt: now });
    }
    // For episodes, we need season/episode mapping – we have eps from getShowEpisodes, but we didn't keep them.
    // Re-fetch mapping via getShowEpisodes already gave us season/episode? We dropped it. To keep simple, we will not map episodes here; observer's reconciler will map via Movviz library's plexRatingKey lookup instead.
    if (entries.length > 0) upsertMappings(entries);
  } catch {
    // non-fatal
  }

  recordSearchLog("info", "plex.snapshot", `plex.snapshot user=${ctx.movvizUserId} server=${ctx.machineIdentifier.slice(0,8)} tokenFp=${ctx.tokenFingerprint} movies=${allMovieKeys.size} shows=${showKeyList.length} episodes=${allEpisodeKeys.size} watchedMovies=${states.filter((s) => s.state === "WATCHED" && allMovieKeys.has(s.ratingKey)).length} watchedEpisodes=${states.filter((s) => s.state === "WATCHED" && allEpisodeKeys.has(s.ratingKey)).length} observed=${states.length}`);

  // Atomic persistence is caller responsibility (§95) – don't auto-persist here.
  // Caller must call setObservedStates(states) only after validate+reconcile.

  return {
    ok: true,
    states,
    movieRatingKeys: [...allMovieKeys],
    showRatingKeys: showKeyList,
    episodeRatingKeys: [...allEpisodeKeys],
  };
}

/**
 * Targeted verification for one ratingKey (ACK path after scrobble/unscrobble, or history trigger).
 */
export async function verifyWatchState(ctx: PlexUserContext, ratingKey: string): Promise<PlexObservedState | null> {
  const cfg = loadPlexConfig();
  const viewMap = await batchPlexViewState(cfg, ctx.serverToken, [ratingKey]);
  const vs = viewMap.get(ratingKey);
  if (!vs) return null;
  const watched = (vs.viewCount ?? 0) > 0;
  return {
    userId: ctx.movvizUserId,
    machineIdentifier: ctx.machineIdentifier,
    ratingKey,
    state: watched ? "WATCHED" : "UNWATCHED",
    viewCount: vs.viewCount,
    lastViewedAt: vs.lastViewedAt,
    viewOffset: vs.viewOffset,
    observedAt: Date.now(),
  };
}

/**
 * Diff previous snapshot vs new snapshot – returns transitions.
 * Caller must have ensured snapshot was complete (atomic).
 */
export type WatchDiff = {
  watchedNow: Set<string>;
  unwatchedNow: Set<string>;
  newWatched: string[]; // absent -> present
  newUnwatched: string[]; // present -> absent
};

export function diffSnapshots(previous: Map<string, PlexObservedState>, current: PlexObservedState[]): WatchDiff {
  const currentMap = new Map(current.map((s) => [s.ratingKey, s]));
  const previousWatched = new Set<string>();
  for (const [rk, st] of previous) if (st.state === "WATCHED") previousWatched.add(rk);
  const watchedNow = new Set<string>();
  const unwatchedNow = new Set<string>();
  for (const st of current) {
    if (st.state === "WATCHED") watchedNow.add(st.ratingKey);
    else if (st.state === "UNWATCHED") unwatchedNow.add(st.ratingKey);
    // UNKNOWN is ignored – not watched nor unwatched, prevents false UNWATCHED (§24)
  }

  const newWatched: string[] = [];
  const newUnwatched: string[] = [];
  for (const rk of watchedNow) if (!previousWatched.has(rk)) newWatched.push(rk);
  // Only count as newUnwatched if previous was WATCHED and current is explicitly UNWATCHED (not UNKNOWN/missing)
  for (const rk of previousWatched) {
    const cur = currentMap.get(rk);
    if (cur?.state === "UNWATCHED") newUnwatched.push(rk);
    // If cur is UNKNOWN or missing (MEDIA_MISSING), do not count as UNWATCHED (§30)
  }

  return { watchedNow, unwatchedNow, newWatched, newUnwatched };
}

/**
 * Full user rescan (idempotent, per §27, §40-42) – builds validated snapshot, reconciles to canonical, replaces observed, rebuilds projections.
 */
export async function fullRescanUser(ctx: PlexUserContext): Promise<{ ok: boolean; watchedCount: number; unwatchedCount: number; error?: string }> {
  const previous = getObservedStatesForUser(ctx.movvizUserId, ctx.machineIdentifier);
  const snapshot = await snapshotWatchState(ctx);
  if (!snapshot.ok) return { ok: false, watchedCount: 0, unwatchedCount: 0, error: snapshot.reason };
  const diff = diffSnapshots(previous, snapshot.states);
  // Vraie convergence §3: comparer chaque média mappable Plex vs canonical, pas seulement newWatched/newUnwatched
  let reconciled = 0;
  const allMappable = snapshot.states.filter((s) => s.state !== "UNKNOWN");
  for (const observed of allMappable) {
    const rk = observed.ratingKey;
    // Resolve canonical via library store (best-effort)
    let canonical: import("./mediaIdentityMap").CanonicalMediaIdentity | null = null;
    if (snapshot.movieRatingKeys.includes(rk)) {
      const tmdbMap = await batchTmdbIds(loadPlexConfig(), ctx.serverToken, [rk]);
      const tmdbId = tmdbMap.get(rk)?.tmdbId;
      if (tmdbId) canonical = { type: "movie", tmdbId };
    } else if (snapshot.episodeRatingKeys.includes(rk)) {
      const hit = (await import("@/lib/library/store")).findEpisodeByPlexRatingKey(rk);
      if (hit) canonical = { type: "episode", tmdbShowId: hit.series.tmdbId, seasonNumber: hit.season.seasonNumber, episodeNumber: hit.episode.episodeNumber };
    }
    if (!canonical) continue;
    const { getCurrentWatchState } = await import("@/lib/userContext/watchBridge");
    const curState = getCurrentWatchState({
      userId: ctx.movvizUserId,
      tmdbId: canonical.type === "movie" ? canonical.tmdbId : canonical.tmdbShowId,
      mediaType: canonical.type === "movie" ? "movie" : "episode",
      seasonNumber: canonical.type === "episode" ? (canonical as Extract<import("./mediaIdentityMap").CanonicalMediaIdentity, { type: "episode" }>).seasonNumber : undefined,
      episodeNumber: canonical.type === "episode" ? (canonical as Extract<import("./mediaIdentityMap").CanonicalMediaIdentity, { type: "episode" }>).episodeNumber : undefined,
    });
    // Skip if already converged (Plex state == canonical) – true idempotence §41
    const plexWatched = observed.state === "WATCHED" ? "watched" : "unwatched";
    if (plexWatched === curState) continue;
    const { withUserContextDb } = await import("@/lib/userContext/database");
    const canonicalAt: number | null = withUserContextDb((db) => {
      const key = canonical!.type === "movie" ? `${ctx.movvizUserId}:movie:${(canonical as { tmdbId: number }).tmdbId}` : `${ctx.movvizUserId}:episode:${(canonical as { tmdbShowId: number }).tmdbShowId}:${(canonical as { seasonNumber: number }).seasonNumber}:${(canonical as { episodeNumber: number }).episodeNumber}`;
      const row = db.prepare("SELECT watched_updated_at FROM user_media_state WHERE state_key = ?").get(key) as { watched_updated_at: number | null } | undefined;
      return row?.watched_updated_at ?? null;
    }, null);
    const { reconcile, applyReconcileDecision } = await import("./plexReconciler");
    const { getUserMediaSyncStates } = await import("@/lib/userContext/syncState");
    const { mediaStateKey } = await import("@/lib/userContext/reconcile");
    const stateKey =
      canonical.type === "movie"
        ? mediaStateKey(ctx.movvizUserId, "movie", canonical.tmdbId)
        : mediaStateKey(ctx.movvizUserId, "episode", (canonical as Extract<import("./mediaIdentityMap").CanonicalMediaIdentity, { type: "episode" }>).tmdbShowId, (canonical as Extract<import("./mediaIdentityMap").CanonicalMediaIdentity, { type: "episode" }>).seasonNumber, (canonical as Extract<import("./mediaIdentityMap").CanonicalMediaIdentity, { type: "episode" }>).episodeNumber);
    const syncEntry = getUserMediaSyncStates(ctx.movvizUserId).find((e) => e.stateKey === stateKey && e.field === "watched" && e.target === "plex" && (e.capability === "PENDING" || e.capability === "ERROR"));
    // Revision-only superseded check (§4): pendingRevision vs canonicalRevision, never vs timestamp
    const canonicalRevision: number | null = withUserContextDb((db) => {
      const key2 = canonical!.type === "movie" ? `${ctx.movvizUserId}:movie:${(canonical as { tmdbId: number }).tmdbId}` : `${ctx.movvizUserId}:episode:${(canonical as { tmdbShowId: number }).tmdbShowId}:${(canonical as { seasonNumber: number }).seasonNumber}:${(canonical as { episodeNumber: number }).episodeNumber}`;
      const row = db.prepare("SELECT watched_revision FROM user_media_state WHERE state_key = ?").get(key2) as { watched_revision: number | null } | undefined;
      return row?.watched_revision ?? null;
    }, null);
    let pendingIntent: { desiredState: "watched" | "unwatched"; revision: number; sourceEventId: string } | null = null;
    if (syncEntry && curState !== "unknown") {
      if (syncEntry.revision != null && canonicalRevision != null) {
        if (syncEntry.revision >= canonicalRevision) {
          pendingIntent = { desiredState: ((syncEntry.desiredState as "watched" | "unwatched" | null) ?? (curState as "watched" | "unwatched")), revision: syncEntry.revision, sourceEventId: syncEntry.stateKey };
        }
        // else SUPERSEDED → null
      } else if (syncEntry.revision == null) {
        pendingIntent = { desiredState: ((syncEntry.desiredState as "watched" | "unwatched" | null) ?? (curState as "watched" | "unwatched")), revision: syncEntry.updatedAt, sourceEventId: syncEntry.stateKey };
      } else {
        pendingIntent = { desiredState: ((syncEntry.desiredState as "watched" | "unwatched" | null) ?? (curState as "watched" | "unwatched")), revision: syncEntry.revision, sourceEventId: syncEntry.stateKey };
      }
    }
    const res = reconcile({
      userId: ctx.movvizUserId,
      canonicalIdentity: canonical,
      ratingKey: rk,
      machineIdentifier: ctx.machineIdentifier,
      currentCanonicalState: curState as "watched" | "unwatched" | "unknown",
      currentCanonicalAt: canonicalAt,
      previousPlexObserved: previous.get(rk) ?? null,
      currentPlexObserved: observed,
      pendingIntent,
      isBaseline: !previous.has(rk),
      mode: "AUTHORITATIVE_RESCAN",
    });
    if (res.shouldApply && res.newCanonicalState) {
      const ok = applyReconcileDecision(
        {
          userId: ctx.movvizUserId,
          canonicalIdentity: canonical,
          ratingKey: rk,
          machineIdentifier: ctx.machineIdentifier,
          currentCanonicalState: curState as "watched" | "unwatched" | "unknown",
          currentCanonicalAt: canonicalAt,
          previousPlexObserved: previous.get(rk) ?? null,
          currentPlexObserved: observed,
          pendingIntent,
          isBaseline: !previous.has(rk),
          mode: "AUTHORITATIVE_RESCAN",
        },
        res,
        null
      );
      if (ok) reconciled++;
    }
  }
  // Atomic replace only after reconcile (§29)
  replaceObservedStatesForUserServer(ctx.movvizUserId, ctx.machineIdentifier, snapshot.states);
  recordSearchLog("info", "plex.snapshot", `plex.snapshot fullRescan user=${ctx.movvizUserId} newWatched=${diff.newWatched.length} newUnwatched=${diff.newUnwatched.length} reconciled=${reconciled} totalWatched=${diff.watchedNow.size}`);
  // Refresh projections if any reconciled
  if (reconciled > 0) {
    const { refreshLegacyUserContext } = await import("@/lib/userContext/bootstrap");
    refreshLegacyUserContext(ctx.movvizUserId, true);
  }
  return { ok: true, watchedCount: diff.watchedNow.size, unwatchedCount: diff.unwatchedNow.size };
}
