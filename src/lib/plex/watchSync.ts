import { loadPlexConfig } from "./store";
import { batchTmdbIds } from "./client";
import { getWatchStatus, mergePlexWatchedState } from "./watchStore";
import { recordSearchLog } from "@/lib/diagnostic/searchLog";
import { refreshLegacyUserContext } from "@/lib/userContext/bootstrap";
import { applyWatchDecision, getCurrentWatchState } from "@/lib/userContext/watchBridge";
import type { User } from "@/lib/auth/types";
import { refreshPlexAvatar } from "./avatarSync";
import { resolvePlexUserContext } from "./plexUserContext";
import { pollHistory } from "./plexHistoryObserver";
import { snapshotWatchState, verifyWatchState, diffSnapshots } from "./plexWatchStateObserver";
import { getObservedStatesForUser, setObservedStates, getObservedState, upsertObservedState, replaceObservedStatesForUserServer } from "./plexObservedState";
import { reconcile, applyReconcileDecision } from "./plexReconciler";
import { resolveEpisode } from "./episodeResolver";
import { isCircuitOpen, recordCircuitFailure, recordCircuitSuccess } from "./plexCircuitBreaker";
import { getSeriesByTmdbId, getMovieByTmdbId, findEpisodeByPlexRatingKey } from "@/lib/library/store";
import { withKeyLock } from "@/lib/library/locks";
import { getUserMediaSyncStates, updateUserMediaSyncState } from "@/lib/userContext/syncState";
import { mediaStateKey } from "@/lib/userContext/reconcile";

function getPendingIntentForMedia(
  userId: string,
  canonical: import("./mediaIdentityMap").CanonicalMediaIdentity,
  currentCanonicalState: "watched" | "unwatched" | "unknown",
  currentCanonicalAt: number | null
): { desiredState: "watched" | "unwatched"; revision: number; sourceEventId: string } | null {
  if (currentCanonicalState === "unknown") return null;
  const stateKey =
    canonical.type === "movie"
      ? mediaStateKey(userId, "movie", canonical.tmdbId)
      : mediaStateKey(userId, "episode", (canonical as Extract<import("./mediaIdentityMap").CanonicalMediaIdentity, { type: "episode" }>).tmdbShowId, (canonical as Extract<import("./mediaIdentityMap").CanonicalMediaIdentity, { type: "episode" }>).seasonNumber, (canonical as Extract<import("./mediaIdentityMap").CanonicalMediaIdentity, { type: "episode" }>).episodeNumber);
  const entry = getUserMediaSyncStates(userId).find((e) => e.stateKey === stateKey && e.field === "watched" && e.target === "plex" && (e.capability === "PENDING" || e.capability === "ERROR"));
  if (!entry) return null;
  // Superseded check (§34): if canonical has moved beyond pending's updatedAt, pending is stale
  if (currentCanonicalAt != null && entry.updatedAt < currentCanonicalAt) {
    // Pending is for an older revision – treat as superseded, don't use for ACK
    return null;
  }
  return { desiredState: currentCanonicalState as "watched" | "unwatched", revision: entry.updatedAt, sourceEventId: entry.stateKey };
}

// Per-user sync lock (§94)
const gLock = globalThis as typeof globalThis & { __movvizPlexSyncLocks?: Map<string, boolean> };
function syncLocks(): Map<string, boolean> {
  return (gLock.__movvizPlexSyncLocks ??= new Map());
}

// Snapshot throttle per user (avoid hammering Plex every 30s via watch-status gate)
const gSnapshot = globalThis as typeof globalThis & { __movvizPlexLastSnapshot?: Map<string, number> };
function lastSnapshotMap(): Map<string, number> {
  return (gSnapshot.__movvizPlexLastSnapshot ??= new Map());
}
const SNAPSHOT_MIN_INTERVAL_MS = 30 * 60 * 1000; // 30 min
const HISTORY_TARGETED_VERIFY_LIMIT = 20; // max targeted verifies per history poll to avoid spike

function shouldSnapshot(userId: string, force = false): boolean {
  if (force) return true;
  const last = lastSnapshotMap().get(userId);
  if (!last) return true;
  return Date.now() - last >= SNAPSHOT_MIN_INTERVAL_MS;
}

/**
 * Orchestrateur Plex sync (§55)
 * resolve user → history poll → watch snapshot → reconciliation → diagnostics
 * Never contains business logic inline – delegates to observers & reconciler.
 */
export async function syncUserWatchStatus(user: User, opts?: { forceSnapshot?: boolean }) {
  const lockKey = `plex-sync:${user.id}`;
  if (syncLocks().get(user.id)) {
    recordSearchLog("info", "plex.watchSync", `plex.watchSync user=${user.username} status=skipped reason=already_running`);
    return;
  }
  syncLocks().set(user.id, true);
  try {
    await withKeyLock(lockKey, async () => doSync(user, opts));
  } finally {
    syncLocks().delete(user.id);
  }
}

async function doSync(user: User, opts?: { forceSnapshot?: boolean }) {
  const cfg = loadPlexConfig();
  if (!cfg.hostname || !cfg.adminToken) return;
  refreshPlexAvatar(user).catch(() => {});

  if (isCircuitOpen(user.id)) {
    const { circuitDelayMs } = await import("./plexCircuitBreaker");
    const delay = circuitDelayMs(user.id);
    recordSearchLog("warn", "plex.watchSync", `plex.watchSync user=${user.username} status=skipped reason=circuit_open retryIn=${Math.round(delay / 1000)}s`);
    return;
  }

  const ctxRes = await resolvePlexUserContext(user.id);
  if (!ctxRes.ok) {
    recordSearchLog("warn", "plex.watchSync", `${user.username} (movvizId:${user.id}): identité Plex non résolue — ${ctxRes.reason} [${ctxRes.code}] — aucune vue Plex importée`);
    // Don't count as circuit failure if it's identity missing (fail closed, not transient)
    if (ctxRes.code === "TOKEN_FAILED" || ctxRes.code === "SERVER_ID_FAILED") {
      recordCircuitFailure(user.id, ctxRes.reason);
    }
    return;
  }
  const ctx = ctxRes.ctx;

  try {
    // 1) History observer – activity + trigger (§28-29)
    const historyRes = await pollHistory(ctx);
    let historyTriggered = 0;
    let historyReconciled = 0;

    if (historyRes.entries.length > 0) {
      // Deduplicate ratingKeys from history (newest first already, but we verify per key once)
      const byKey = new Map<string, (typeof historyRes.entries)[number]>();
      for (const e of historyRes.entries) byKey.set(e.ratingKey, e);
      // Limit to most recent N to avoid thundering herd on large history
      const keysToVerify = [...byKey.keys()].slice(0, HISTORY_TARGETED_VERIFY_LIMIT);

      // Need TMDb mapping for history entries to build canonical identities
      const movieKeys = keysToVerify.filter((k) => byKey.get(k)?.type === "movie");
      const episodeEntries = keysToVerify.filter((k) => byKey.get(k)?.type === "episode").map((k) => byKey.get(k)!);
      const showKeys = [...new Set(episodeEntries.map((e) => e.grandparentRatingKey).filter(Boolean) as string[])];
      const [movieMap, showMap] = await Promise.all([
        batchTmdbIds(cfg, ctx.serverToken, movieKeys),
        batchTmdbIds(cfg, ctx.serverToken, showKeys),
      ]);

      for (const rk of keysToVerify) {
        const entry = byKey.get(rk)!;
        // Targeted verification: fetch actual current view state for this ratingKey
        const observed = await verifyWatchState(ctx, rk);
        if (!observed) {
          recordSearchLog("warn", "plex.watchSync", `plex.watchSync history-trigger verify failed user=${user.username} ratingKey=${rk}`);
          continue;
        }
        historyTriggered++;

        // Resolve canonical identity
        let canonical: { type: "movie"; tmdbId: number } | { type: "episode"; tmdbShowId: number; seasonNumber: number; episodeNumber: number } | null = null;
        let title: string | null = null;
        if (entry.type === "movie") {
          const tmdbId = movieMap.get(rk)?.tmdbId;
          if (tmdbId == null) continue;
          canonical = { type: "movie", tmdbId };
          title = entry.title ?? null;
        } else if (entry.type === "episode") {
          // Try episodeResolver first for structured pipeline (§34)
          const raw = {
            ratingKey: rk,
            type: "episode",
            grandparentTitle: entry.grandparentTitle,
            parentIndex: entry.season,
            index: entry.episode,
            grandparentRatingKey: entry.grandparentRatingKey,
            grandparentKey: entry.grandparentRatingKey ? `/library/metadata/${entry.grandparentRatingKey}` : undefined,
            accountID: entry.accountId,
          };
          const resolved = await resolveEpisode(ctx, raw);
          if (resolved.status === "RESOLVED" && resolved.canonical) {
            canonical = resolved.canonical as unknown as typeof canonical;
            title = entry.grandparentTitle ?? entry.title ?? null;
          } else {
            // Fallback via showMap + SxxExx
            const showTmdb = entry.grandparentRatingKey ? showMap.get(entry.grandparentRatingKey)?.tmdbId : undefined;
            if (showTmdb != null && entry.season != null && entry.episode != null) {
              canonical = { type: "episode", tmdbShowId: showTmdb, seasonNumber: entry.season, episodeNumber: entry.episode };
              title = entry.grandparentTitle ?? entry.title ?? null;
            } else {
              recordSearchLog("warn", "plex.watchSync", `plex.watchSync episode unresolved user=${user.username} ratingKey=${rk} reason=${resolved.reason} sample=${JSON.stringify(resolved.sample ?? raw).slice(0,500)}`);
              continue;
            }
          }
        } else continue;

        if (!canonical) continue;

        // Reconcile (§40-45)
        const previous = getObservedState(user.id, ctx.machineIdentifier, rk);
        const currentCanonicalState = getCurrentWatchState({
          userId: user.id,
          tmdbId: canonical.type === "movie" ? canonical.tmdbId : canonical.tmdbShowId,
          mediaType: canonical.type === "movie" ? "movie" : "episode",
          seasonNumber: canonical.type === "episode" ? canonical.seasonNumber : undefined,
          episodeNumber: canonical.type === "episode" ? canonical.episodeNumber : undefined,
        });
        // Need watched_updated_at for staleness check – fetch via DB directly? For now use null (conservative)
        // We'll fetch from user_media_state table
        const { withUserContextDb } = await import("@/lib/userContext/database");
        const canonicalAt: number | null = withUserContextDb((db) => {
          const key = canonical!.type === "movie" ? `${user.id}:movie:${(canonical as { tmdbId: number }).tmdbId}` : `${user.id}:episode:${(canonical as { tmdbShowId: number }).tmdbShowId}:${(canonical as { seasonNumber: number }).seasonNumber}:${(canonical as { episodeNumber: number }).episodeNumber}`;
          const row = db.prepare("SELECT watched_updated_at FROM user_media_state WHERE state_key = ?").get(key) as { watched_updated_at: number | null } | undefined;
          return row?.watched_updated_at ?? null;
        }, null);

        const isBaseline = !previous;
        const pendingIntent = getPendingIntentForMedia(user.id, canonical, currentCanonicalState as "watched" | "unwatched" | "unknown", canonicalAt);
        const result = reconcile({
          userId: user.id,
          canonicalIdentity: canonical,
          ratingKey: rk,
          machineIdentifier: ctx.machineIdentifier,
          currentCanonicalState: currentCanonicalState as "watched" | "unwatched" | "unknown",
          currentCanonicalAt: canonicalAt,
          previousPlexObserved: previous,
          currentPlexObserved: observed,
          pendingIntent,
          isBaseline,
        });

        if (result.decision === "ACK_LOCAL_WRITE" && pendingIntent) {
          const stateKey =
            canonical.type === "movie"
              ? mediaStateKey(user.id, "movie", canonical.tmdbId)
              : mediaStateKey(user.id, "episode", (canonical as Extract<import("./mediaIdentityMap").CanonicalMediaIdentity, { type: "episode" }>).tmdbShowId, (canonical as Extract<import("./mediaIdentityMap").CanonicalMediaIdentity, { type: "episode" }>).seasonNumber, (canonical as Extract<import("./mediaIdentityMap").CanonicalMediaIdentity, { type: "episode" }>).episodeNumber);
          updateUserMediaSyncState({ userId: user.id, stateKey, field: "watched", target: "plex", capability: "SYNCED", ackAt: Date.now(), error: null });
          recordSearchLog("info", "plex.outbox", `plex.outbox ACK user=${user.username} ratingKey=${rk} rev=${pendingIntent.revision} → SYNCED`);
          upsertObservedState(observed);
        } else if (result.shouldApply && result.newCanonicalState) {
          const ok = applyReconcileDecision(
            {
              userId: user.id,
              canonicalIdentity: canonical,
              ratingKey: rk,
              machineIdentifier: ctx.machineIdentifier,
              currentCanonicalState: currentCanonicalState as "watched" | "unwatched" | "unknown",
              currentCanonicalAt: canonicalAt,
              previousPlexObserved: previous,
              currentPlexObserved: observed,
              pendingIntent,
              isBaseline,
            },
            result,
            title
          );
          if (ok) {
            historyReconciled++;
            upsertObservedState(observed);
            recordSearchLog("info", "plex.reconciler", `plex.reconciler user=${user.username} ratingKey=${rk} decision=${result.decision} ${result.reason} canonical=${canonical.type}:${canonical.type === "movie" ? (canonical as { tmdbId: number }).tmdbId : (canonical as { tmdbShowId: number }).tmdbShowId}`);
          }
        } else if (result.decision !== "UNCHANGED" && result.decision !== "STALE_OBSERVATION") {
          recordSearchLog("info", "plex.reconciler", `plex.reconciler user=${user.username} ratingKey=${rk} decision=${result.decision} ${result.reason}`);
          if (result.decision !== "BASELINE") upsertObservedState(observed);
        } else {
          // Still update observed state for tracking
          upsertObservedState(observed);
        }
      }
      recordSearchLog("info", "plex.watchSync", `plex.watchSync history user=${user.username} entries=${historyRes.entries.length} triggered=${historyTriggered} reconciled=${historyReconciled}`);
    }

    // 2) WatchStateObserver snapshot (§22-27) – the true WATCHED/UNWATCHED source
    const doSnapshot = shouldSnapshot(user.id, opts?.forceSnapshot);
    if (doSnapshot) {
      const previousMap = getObservedStatesForUser(user.id, ctx.machineIdentifier);
      const snap = await snapshotWatchState(ctx);
      if (!snap.ok) {
        recordSearchLog("warn", "plex.watchSync", `plex.watchSync snapshot failed user=${user.username} reason=${snap.reason}`);
        recordCircuitFailure(user.id, `snapshot failed: ${snap.reason}`);
        // Fallback to legacy history-only path for movies/episodes that were in history but snapshot missed?
        // If snapshot fails, we still have history-triggered reconciliations above – don't clear.
        // Persist history-triggered observed states already done.
        // For atomicity (§96): don't advance snapshot cursor, keep previous.
      } else {
        // Diff (§97: diff only after complete snapshot)
        const diff = diffSnapshots(previousMap, snap.states);
        let snapReconciledWatched = 0;
        let snapReconciledUnwatched = 0;
        // Need to reconcile each transition
        for (const rk of [...diff.newWatched, ...diff.newUnwatched]) {
          const observed = snap.states.find((s) => s.ratingKey === rk);
          if (!observed) continue;
          const isWatched = diff.watchedNow.has(rk);
          // Resolve canonical for this rk – use movieMap/episode lookup
          let canonical: { type: "movie"; tmdbId: number } | { type: "episode"; tmdbShowId: number; seasonNumber: number; episodeNumber: number } | null = null;
          let title: string | null = null;
          // Try movie first
          if (snap.movieRatingKeys.includes(rk)) {
            const tmdbMap = await batchTmdbIds(cfg, ctx.serverToken, [rk]);
            const tmdbId = tmdbMap.get(rk)?.tmdbId;
            if (tmdbId != null) {
              canonical = { type: "movie", tmdbId };
              const movie = getMovieByTmdbId(tmdbId);
              title = movie?.title ?? null;
            }
          }
          if (!canonical && snap.episodeRatingKeys.includes(rk)) {
            const hit = findEpisodeByPlexRatingKey(rk);
            if (hit) {
              canonical = { type: "episode", tmdbShowId: hit.series.tmdbId, seasonNumber: hit.season.seasonNumber, episodeNumber: hit.episode.episodeNumber };
              title = hit.series.title;
            } else {
              // Fallback via resolver – need show title/season/episode – we don't have them from snapshot alone.
              // For snapshot episodes, we have ratingKey but no grandparentTitle; we can fetch via verify? Or skip.
              // For now, try to fetch episode metadata via batchPlexViewState Guid? Not reliable.
              // We'll attempt to resolve via library store's allLeaves that we already have? But snapshot discards that.
              // As fallback, we can fetch show episodes again to find mapping.
              // Simplify: if not in Movviz library, we cannot map to tmdb – skip but log.
              recordSearchLog("warn", "plex.snapshot", `plex.snapshot unmapped episode user=${user.username} ratingKey=${rk} – no Movviz library entry, skipping reconcile`);
              continue;
            }
          }
          if (!canonical) continue;

          const previous = previousMap.get(rk) ?? null;
          const currentCanonicalState = getCurrentWatchState({
            userId: user.id,
            tmdbId: canonical.type === "movie" ? canonical.tmdbId : canonical.tmdbShowId,
            mediaType: canonical.type === "movie" ? "movie" : "episode",
            seasonNumber: canonical.type === "episode" ? canonical.seasonNumber : undefined,
            episodeNumber: canonical.type === "episode" ? canonical.episodeNumber : undefined,
          });
          const { withUserContextDb } = await import("@/lib/userContext/database");
          const canonicalAt: number | null = withUserContextDb((db) => {
            const key = canonical!.type === "movie" ? `${user.id}:movie:${(canonical as { tmdbId: number }).tmdbId}` : `${user.id}:episode:${(canonical as { tmdbShowId: number }).tmdbShowId}:${(canonical as { seasonNumber: number }).seasonNumber}:${(canonical as { episodeNumber: number }).episodeNumber}`;
            const row = db.prepare("SELECT watched_updated_at FROM user_media_state WHERE state_key = ?").get(key) as { watched_updated_at: number | null } | undefined;
            return row?.watched_updated_at ?? null;
          }, null);

          const isBaseline = !previous;
          const pendingIntent = getPendingIntentForMedia(user.id, canonical, currentCanonicalState as "watched" | "unwatched" | "unknown", canonicalAt);
          const result = reconcile({
            userId: user.id,
            canonicalIdentity: canonical,
            ratingKey: rk,
            machineIdentifier: ctx.machineIdentifier,
            currentCanonicalState: currentCanonicalState as "watched" | "unwatched" | "unknown",
            currentCanonicalAt: canonicalAt,
            previousPlexObserved: previous,
            currentPlexObserved: observed,
            pendingIntent,
            isBaseline,
          });

          if (result.decision === "ACK_LOCAL_WRITE" && pendingIntent) {
            const stateKey =
              canonical.type === "movie"
                ? mediaStateKey(user.id, "movie", canonical.tmdbId)
                : mediaStateKey(user.id, "episode", (canonical as Extract<import("./mediaIdentityMap").CanonicalMediaIdentity, { type: "episode" }>).tmdbShowId, (canonical as Extract<import("./mediaIdentityMap").CanonicalMediaIdentity, { type: "episode" }>).seasonNumber, (canonical as Extract<import("./mediaIdentityMap").CanonicalMediaIdentity, { type: "episode" }>).episodeNumber);
            updateUserMediaSyncState({ userId: user.id, stateKey, field: "watched", target: "plex", capability: "SYNCED", ackAt: Date.now(), error: null });
            recordSearchLog("info", "plex.outbox", `plex.outbox ACK snapshot user=${user.username} ratingKey=${rk} rev=${pendingIntent.revision} → SYNCED`);
          } else if (result.shouldApply && result.newCanonicalState) {
            const ok = applyReconcileDecision(
              {
                userId: user.id,
                canonicalIdentity: canonical,
                ratingKey: rk,
                machineIdentifier: ctx.machineIdentifier,
                currentCanonicalState: currentCanonicalState as "watched" | "unwatched" | "unknown",
                currentCanonicalAt: canonicalAt,
                previousPlexObserved: previous,
                currentPlexObserved: observed,
                pendingIntent,
                isBaseline,
              },
              result,
              title
            );
            if (ok) {
              if (result.newCanonicalState === "watched") snapReconciledWatched++;
              else snapReconciledUnwatched++;
              recordSearchLog("info", "plex.reconciler", `plex.reconciler snapshot user=${user.username} ratingKey=${rk} decision=${result.decision} ${result.reason} -> ${result.newCanonicalState}`);
            }
          } else if (result.decision !== "UNCHANGED" && result.decision !== "STALE_OBSERVATION" && result.decision !== "BASELINE") {
            recordSearchLog("info", "plex.reconciler", `plex.reconciler snapshot user=${user.username} ratingKey=${rk} decision=${result.decision} ${result.reason}`);
          }
        }

        // Atomic persistence (§29, §95) – replace observed snapshot atomically
        replaceObservedStatesForUserServer(user.id, ctx.machineIdentifier, snap.states);
        lastSnapshotMap().set(user.id, Date.now());
        recordSearchLog(
          "info",
          "plex.watchSync",
          `plex.watchSync snapshot user=${user.username} movies=${snap.movieRatingKeys.length} episodes=${snap.episodeRatingKeys.length} watchedNow=${diff.watchedNow.size} newWatched=${diff.newWatched.length} newUnwatched=${diff.newUnwatched.length} reconciledWatched=${snapReconciledWatched} reconciledUnwatched=${snapReconciledUnwatched}`
        );
      }
    } else {
      recordSearchLog("info", "plex.watchSync", `plex.watchSync snapshot skipped user=${user.username} reason=throttled last=${Math.round((Date.now() - (lastSnapshotMap().get(user.id) ?? 0)) / 60000)}min ago`);
    }

    // 3) Legacy history-only fallback for environments where snapshot is not yet fully reliable (no Plex server, or viewCount always owner)
    // If we did 0 targeted reconciliations AND 0 snapshot reconciliations, we still want the old behavior of importing history as watched (for backward compat).
    // But new logic already handles history via targeted verification – which requires viewCount to work. If viewCount is broken (always owner), targeted verification will show wrong state.
    // In that case, we need fallback: directly apply history as watched via applyWatchDecision, as before, but ONLY if snapshot was skipped/failed and historyTriggered was 0.
    // To detect viewCount broken, we rely on the diagnosis that snapshot watchedNow equals owner's watched, not user's. That's hard without live test.
    // For now, keep legacy path as fallback when snapshot was throttled and history has entries but reconciled 0.
    if (historyRes.entries.length > 0 && historyTriggered === 0 && !doSnapshot) {
      // Legacy import – preserve old behavior for this edge case
      await legacyHistoryImport(user, ctx, historyRes);
    }

    // 4) Outbox ACK is handled in watchWrite retry, not here.

    // 5) Refresh derived context
    refreshLegacyUserContext(user.id, true);

    recordCircuitSuccess(user.id);
    recordSearchLog("info", "plex.watchSync", `plex.watchSync user=${user.username} done localAccountId=${ctx.localAccountId} server=${ctx.machineIdentifier.slice(0,8)} tokenFp=${ctx.tokenFingerprint}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    recordSearchLog("error", "plex.watchSync", `${user.username} (plexId:${user.plexId ?? user.plexManagedUserId ?? "?"}) : échec de synchronisation — ${msg} — données précédentes conservées`);
    recordCircuitFailure(user.id, msg);
  }
}

async function legacyHistoryImport(user: User, ctx: { localAccountId: number; machineIdentifier: string; tokenFingerprint: string }, historyRes: Awaited<ReturnType<typeof pollHistory>>) {
  const cfg = loadPlexConfig();
  const history = historyRes.entries;
  if (history.length === 0) {
    const previous = getWatchStatus(user.id);
    recordSearchLog("warn", "plex.watchSync", `${user.username} (plexId:${ctx.localAccountId}): aucun historique Plex retourné — sync ignorée, données précédentes conservées (${previous ? `${previous.movies.length} films / ${previous.episodes.length} épisodes` : "aucune donnée existante"})`);
    return;
  }
  const movieRatingKeys = [...new Set(history.filter((h) => h.type === "movie").map((h) => h.ratingKey))];
  const episodeEntries = history.filter((h) => h.type === "episode" && h.grandparentRatingKey);
  const showRatingKeys = [...new Set(episodeEntries.map((h) => h.grandparentRatingKey!))];
  const [movieInfo, showInfo] = await Promise.all([
    batchTmdbIds(cfg, cfg.adminToken!, movieRatingKeys),
    batchTmdbIds(cfg, cfg.adminToken!, showRatingKeys),
  ]);

  const movieStates = new Map<number, { tmdbId: number; title: string; watchedAt: number }>();
  for (const entry of history.filter((item) => item.type === "movie")) {
    const tmdbId = movieInfo.get(entry.ratingKey)?.tmdbId;
    const watchedAt = Number(entry.viewedAt ?? 0);
    if (tmdbId == null || !Number.isFinite(watchedAt) || watchedAt <= 0) continue;
    const prior = movieStates.get(tmdbId);
    if (!prior || watchedAt > prior.watchedAt) movieStates.set(tmdbId, { tmdbId, title: entry.title ?? "", watchedAt });
  }
  const episodeMap = new Map<string, { tmdbId: number; season: number; episode: number; title: string; watchedAt: number }>();
  for (const e of episodeEntries) {
    const tmdbId = showInfo.get(e.grandparentRatingKey!)?.tmdbId;
    const watchedAt = Number(e.viewedAt ?? 0);
    if (tmdbId == null || e.season == null || e.episode == null || !Number.isFinite(watchedAt) || watchedAt <= 0) continue;
    const key = `${tmdbId}.${e.season}.${e.episode}`;
    const prior = episodeMap.get(key);
    if (!prior || watchedAt > prior.watchedAt) episodeMap.set(key, { tmdbId, season: e.season, episode: e.episode, title: e.grandparentTitle ?? e.title ?? "", watchedAt });
  }

  const acceptedMovies = new Map<number, { tmdbId: number; title: string; watchedAt: number }>();
  const acceptedEpisodes = new Map<string, { tmdbId: number; season: number; episode: number; title: string; watchedAt: number }>();
  const orderedHistory = [...history]
    .filter((h) => Number.isFinite(h.viewedAt) && Number(h.viewedAt) > 0)
    .sort((a, b) => Number(a.viewedAt) - Number(b.viewedAt));
  for (const h of orderedHistory) {
    if (h.type === "movie") {
      const tmdbId = movieInfo.get(h.ratingKey)?.tmdbId;
      if (tmdbId == null) continue;
      const result = applyWatchDecision({
        userId: user.id,
        tmdbId,
        mediaType: "movie",
        title: h.title ?? null,
        state: "watched",
        occurredAt: h.viewedAt!,
        source: "plex_history",
        sourceEventId: `plex:${ctx.localAccountId}:${h.ratingKey}:${h.viewedAt}`,
      });
      if (result.accepted) acceptedMovies.set(tmdbId, { tmdbId, title: h.title ?? "", watchedAt: h.viewedAt! });
    } else if (h.grandparentRatingKey) {
      const tmdbId = showInfo.get(h.grandparentRatingKey)?.tmdbId;
      if (tmdbId == null || h.season == null || h.episode == null) continue;
      const result = applyWatchDecision({
        userId: user.id,
        tmdbId,
        mediaType: "episode",
        seasonNumber: h.season,
        episodeNumber: h.episode,
        title: h.title ?? h.grandparentTitle ?? null,
        state: "watched",
        occurredAt: h.viewedAt!,
        source: "plex_history",
        sourceEventId: `plex:${ctx.localAccountId}:${h.ratingKey}:${h.viewedAt}`,
      });
      const key = `${tmdbId}.${h.season}.${h.episode}`;
      if (result.accepted) acceptedEpisodes.set(key, { tmdbId, season: h.season, episode: h.episode, title: h.title ?? h.grandparentTitle ?? "", watchedAt: h.viewedAt! });
    }
  }
  const mergedStatus = mergePlexWatchedState(user.id, [...acceptedMovies.values()], [...acceptedEpisodes.values()]);
  const recent = mergedStatus.recent ?? [];
  refreshLegacyUserContext(user.id, true);
  const rejectionParts = [
    historyRes.rejectedForeign ? `${historyRes.rejectedForeign} autre(s) compte(s) rejeté(s)` : null,
    historyRes.rejectedUnattributed ? `${historyRes.rejectedUnattributed} sans accountID rejeté(s)` : null,
    historyRes.rejectedMalformed ? `${historyRes.rejectedMalformed} épisode(s) mal formé(s) rejeté(s)` : null,
  ].filter((p): p is string => p != null);
  recordSearchLog(
    "info",
    "plex.watchSync",
    `${user.username} (plexId:${ctx.localAccountId}): [legacy fallback] synchronisé — ${acceptedMovies.size} film(s) vu(s), ${acceptedEpisodes.size} épisode(s) vu(s), ${recent.length} entrée(s) récente(s) (${history.length} événement(s) vérifié(s), ${historyRes.totalEpisodeTypeSeen} brut(s)${rejectionParts.length ? `, ${rejectionParts.join(", ")}` : ""})`
  );
}

type WatchSyncGate = Map<string, { at: number; promise: Promise<void> }>;

function syncGate(): WatchSyncGate {
  const root = globalThis as typeof globalThis & { __movvizWatchSyncGate?: WatchSyncGate };
  return (root.__movvizWatchSyncGate ??= new Map());
}

export async function syncUserWatchStatusIfDue(user: User, minIntervalMs = 30_000): Promise<void> {
  const gate = syncGate();
  const current = gate.get(user.id);
  const now = Date.now();
  if (current && now - current.at < minIntervalMs) return current.promise;
  const promise = syncUserWatchStatus(user).catch(() => undefined);
  gate.set(user.id, { at: now, promise });
  await promise;
}

/**
 * Full rescan for one user – idempotent, per §27
 */
export async function fullRescanUserWatchStatus(user: User): Promise<{ ok: boolean; watchedCount?: number; unwatchedCount?: number; error?: string }> {
  const ctxRes = await resolvePlexUserContext(user.id);
  if (!ctxRes.ok) return { ok: false, error: ctxRes.reason };
  const { fullRescanUser } = await import("./plexWatchStateObserver");
  return fullRescanUser(ctxRes.ctx);
}
