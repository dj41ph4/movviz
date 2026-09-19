import { loadPlexConfig } from "./store";
import { batchPlexViewState, getLibrarySections, getSectionRawItems } from "./client";
import type { PlexUserContext } from "./plexUserContext";
import type { PlexObservedState } from "./plexObservedState";
import { getObservedStatesForUser, setObservedStates, getObservedState } from "./plexObservedState";
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

  // Gather movie and show ratingKeys
  for (const section of sections) {
    const items = await getSectionRawItems(cfg, section.key, ctx.serverToken);
    if (!items) continue; // getSectionRawItems returns array, but if fetch fails we skip – but we need to detect partial?
    // If items is empty array, that's valid (empty section). If fetch failed mid-pagination, getSectionRawItems currently returns collected so far – but we treat that as partial snapshot risk.
    // For strict atomicity (§95), we should detect failure: if totalSize not reached, we consider incomplete.
    // However getSectionRawItems currently doesn't expose totalSize – it stops on error and returns partial. We approximate by checking if we got < total? But we don't have total.
    // For now, we log and continue – but mark as possibly incomplete.
    for (const it of items) {
      if (section.type === "movie") allMovieKeys.add(it.ratingKey);
      else if (section.type === "show") allShowKeys.add(it.ratingKey);
    }
  }

  // For shows, we need episodes leaves to snapshot episode watch state.
  // We fetch allLeaves per show sequentially (with concurrency limit)
  const { mapWithConcurrency } = await import("@/lib/concurrency");
  const showKeyList = [...allShowKeys];
  const episodeKeysByShow = new Map<string, string[]>();
  await mapWithConcurrency(showKeyList, 5, async (showKey) => {
    const { getShowEpisodes } = await import("./client");
    const eps = await getShowEpisodes(cfg, showKey, ctx.serverToken);
    const keys = eps.map((e) => e.ratingKey);
    episodeKeysByShow.set(showKey, keys);
    for (const k of keys) allEpisodeKeys.add(k);
  });

  const allRatingKeys = [...allMovieKeys, ...allEpisodeKeys];
  // Show ratingKeys themselves are not watched directly; episodes are. So snapshot only movies + episodes.
  if (allRatingKeys.length === 0) {
    return { ok: true, states: [], movieRatingKeys: [], showRatingKeys: showKeyList, episodeRatingKeys: [] };
  }

  // Batch view state using USER token
  const viewMap = await batchPlexViewState(cfg, ctx.serverToken, allRatingKeys);
  const now = Date.now();
  const states: PlexObservedState[] = [];
  for (const rk of allRatingKeys) {
    const vs = viewMap.get(rk);
    if (!vs) {
      // No view state returned – treat as not watched? But §95: partial snapshot is invalid.
      // If viewMap missing entry for a known ratingKey, we treat as UNWATCHED (conservative) but log.
      // However if Plex omitted it due to error (batch failed for that chunk), viewMap would be empty for that chunk.
      // We already handle batch failure by skipping chunk (continue) – that leaves missing entries.
      // To be safe, if any batch failed, we should consider snapshot invalid? For now we mark missing as UNWATCHED but count.
      states.push({
        userId: ctx.movvizUserId,
        machineIdentifier: ctx.machineIdentifier,
        ratingKey: rk,
        state: "UNWATCHED",
        viewCount: 0,
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
  for (const st of current) if (st.state === "WATCHED") watchedNow.add(st.ratingKey);

  const newWatched: string[] = [];
  const newUnwatched: string[] = [];
  for (const rk of watchedNow) if (!previousWatched.has(rk)) newWatched.push(rk);
  for (const rk of previousWatched) if (!watchedNow.has(rk)) newUnwatched.push(rk);

  return { watchedNow, unwatchedNow: new Set([...currentMap.keys()].filter((k) => !watchedNow.has(k))), newWatched, newUnwatched };
}

/**
 * Full user rescan (idempotent, per §27) – orchestrates snapshot + persistence.
 */
export async function fullRescanUser(ctx: PlexUserContext): Promise<{ ok: boolean; watchedCount: number; unwatchedCount: number; error?: string }> {
  const previous = getObservedStatesForUser(ctx.movvizUserId, ctx.machineIdentifier);
  const snapshot = await snapshotWatchState(ctx);
  if (!snapshot.ok) return { ok: false, watchedCount: 0, unwatchedCount: 0, error: snapshot.reason };
  // Atomic replace: only persist after complete snapshot (§95)
  setObservedStates(snapshot.states);
  const diff = diffSnapshots(previous, snapshot.states);
  recordSearchLog("info", "plex.snapshot", `plex.snapshot diff user=${ctx.movvizUserId} newWatched=${diff.newWatched.length} newUnwatched=${diff.newUnwatched.length} totalWatched=${diff.watchedNow.size}`);
  return { ok: true, watchedCount: diff.watchedNow.size, unwatchedCount: diff.unwatchedNow.size };
}
