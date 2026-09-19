import { loadPlexConfig } from "./store";
import { batchTmdbIds } from "./client";
import { recordSearchLog } from "@/lib/diagnostic/searchLog";
import { refreshLegacyUserContext } from "@/lib/userContext/bootstrap";
import { getCurrentWatchState } from "@/lib/userContext/watchBridge";
import type { User } from "@/lib/auth/types";
import { refreshPlexAvatar } from "./avatarSync";
import { resolvePlexUserContext } from "./plexUserContext";
import { pollHistory } from "./plexHistoryObserver";
import { snapshotWatchState, verifyWatchState, diffSnapshots } from "./plexWatchStateObserver";
import { getObservedStatesForUser, setObservedStates, getObservedState, upsertObservedState, replaceObservedStatesForUserServer } from "./plexObservedState";
import { reconcile, applyReconcileDecision } from "./plexReconciler";
import { resolveEpisode, resolveMovie } from "./episodeResolver";
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
  // Revision cleanup (§4 plan final): compare ONLY revision vs revision, never revision vs timestamp.
  // Legacy entries without revision fall back to updatedAt once (migration temporaire).
  const canonicalRevision = getWatchRevisionForMedia(userId, canonical);
  const pendingRevision = entry.revision ?? null;
  const desired = (entry.desiredState as "watched" | "unwatched" | null) ?? (currentCanonicalState as "watched" | "unwatched");
  if (pendingRevision != null && canonicalRevision != null) {
    if (pendingRevision < canonicalRevision) return null; // SUPERSEDED
  } else if (pendingRevision == null) {
    // Legacy migration: no revision stored – use updatedAt vs watched_updated_at once
    if (currentCanonicalAt != null && entry.updatedAt < currentCanonicalAt) return null;
    return { desiredState: desired, revision: entry.updatedAt, sourceEventId: entry.stateKey };
  } else if (canonicalRevision == null) {
    // Canonical has no revision yet (unknown/legacy) – pending is usable
  }
  return { desiredState: desired, revision: pendingRevision ?? entry.updatedAt, sourceEventId: entry.stateKey };
}

function getWatchRevisionForMedia(userId: string, canonical: import("./mediaIdentityMap").CanonicalMediaIdentity): number | null {
  const { withUserContextDb } = require("@/lib/userContext/database") as typeof import("@/lib/userContext/database");
  return withUserContextDb((db) => {
    const key =
      canonical.type === "movie"
        ? `${userId}:movie:${canonical.tmdbId}`
        : `${userId}:episode:${(canonical as Extract<import("./mediaIdentityMap").CanonicalMediaIdentity, { type: "episode" }>).tmdbShowId}:${(canonical as Extract<import("./mediaIdentityMap").CanonicalMediaIdentity, { type: "episode" }>).seasonNumber}:${(canonical as Extract<import("./mediaIdentityMap").CanonicalMediaIdentity, { type: "episode" }>).episodeNumber}`;
    const row = db.prepare("SELECT watched_revision FROM user_media_state WHERE state_key = ?").get(key) as { watched_revision: number | null } | undefined;
    return row?.watched_revision ?? null;
  }, null);
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
const SNAPSHOT_MIN_INTERVAL_MS = 30 * 60 * 1000; // 30 min – full snapshot stays infrequent (§5)
const HISTORY_TARGETED_VERIFY_LIMIT = 20; // max targeted verifies per history poll to avoid spike
const QUICK_VERIFY_MIN_INTERVAL_MS = 2 * 60 * 1000; // 2 min – recent/known media re-check (§5)
const QUICK_VERIFY_LIMIT = 30; // one batched call, cheap

const gQuick = globalThis as typeof globalThis & { __movvizPlexLastQuickVerify?: Map<string, number> };
function lastQuickMap(): Map<string, number> {
  return (gQuick.__movvizPlexLastQuickVerify ??= new Map());
}
function shouldQuickVerify(userId: string): boolean {
  const last = lastQuickMap().get(userId);
  if (!last) return true;
  return Date.now() - last >= QUICK_VERIFY_MIN_INTERVAL_MS;
}

function shouldSnapshot(userId: string, force = false): boolean {
  if (force) return true;
  const last = lastSnapshotMap().get(userId);
  if (!last) return true;
  return Date.now() - last >= SNAPSHOT_MIN_INTERVAL_MS;
}

/**
 * Quick re-check (§5 plan final): re-verify the most recently observed ratingKeys
 * plus any PENDING outbox media, in ONE batched metadata call. Detects manual
 * Plex Mark watched/unwatched within minutes when history carries no event,
 * without rescanning thousands of episodes.
 */
async function quickVerifyKnownMedia(
  user: User,
  ctx: import("./plexUserContext").PlexUserContext
): Promise<{ checked: number; reconciled: number }> {
  const cfg = loadPlexConfig();
  const observed = getObservedStatesForUser(user.id, ctx.machineIdentifier);
  if (observed.size === 0) return { checked: 0, reconciled: 0 };
  // Most recent first
  const recent = [...observed.values()].sort((a, b) => b.observedAt - a.observedAt).slice(0, QUICK_VERIFY_LIMIT);
  // Plus pending outbox ratingKeys not already in the recent set
  const pendingKeys = new Set<string>();
  try {
    const { resolveRatingKey } = await import("./mediaIdentityMap");
    for (const s of getUserMediaSyncStates(user.id)) {
      if (s.field !== "watched" || s.target !== "plex" || (s.capability !== "PENDING" && s.capability !== "ERROR")) continue;
      // stateKey → canonical → ratingKey: parse stateKey (userId:type:tmdb[:s:e])
      const parts = s.stateKey.split(":");
      let canon: import("./mediaIdentityMap").CanonicalMediaIdentity | null = null;
      if (parts.length === 3 && parts[1] === "movie") {
        const tmdb = Number(parts[2]);
        if (Number.isFinite(tmdb)) canon = { type: "movie", tmdbId: tmdb };
      } else if (parts.length === 5 && parts[1] === "episode") {
        const tmdb = Number(parts[2]); const sn = Number(parts[3]); const en = Number(parts[4]);
        if (Number.isFinite(tmdb) && Number.isFinite(sn) && Number.isFinite(en)) canon = { type: "episode", tmdbShowId: tmdb, seasonNumber: sn, episodeNumber: en };
      }
      if (!canon) continue;
      const rk = resolveRatingKey(ctx.machineIdentifier, canon);
      if (rk && !recent.some((r) => r.ratingKey === rk)) pendingKeys.add(rk);
      if (recent.length + pendingKeys.size >= QUICK_VERIFY_LIMIT) break;
    }
  } catch { /* best-effort */ }
  const keys = [...recent.map((r) => r.ratingKey), ...pendingKeys].slice(0, QUICK_VERIFY_LIMIT);
  if (keys.length === 0) return { checked: 0, reconciled: 0 };

  const { batchPlexViewState } = await import("./client");
  const { resolveCanonical } = await import("./mediaIdentityMap");
  let viewMap: Map<string, import("./client").PlexViewState>;
  try {
    viewMap = await batchPlexViewState(cfg, ctx.serverToken, keys);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.startsWith("plex_auth_failed")) throw e;
    // Partial batch → skip quick verify this round (snapshot will handle); never mutate
    return { checked: 0, reconciled: 0 };
  }
  let reconciled = 0;
  let checked = 0;
  for (const rk of keys) {
    const vs = viewMap.get(rk);
    if (!vs) continue; // UNKNOWN – skip, never UNWATCHED
    checked++;
    const cur: import("./plexObservedState").PlexObservedState = {
      userId: user.id,
      machineIdentifier: ctx.machineIdentifier,
      ratingKey: rk,
      state: (vs.viewCount ?? 0) > 0 ? "WATCHED" : "UNWATCHED",
      viewCount: vs.viewCount,
      lastViewedAt: vs.lastViewedAt,
      viewOffset: vs.viewOffset,
      observedAt: Date.now(),
    };
    const previous = getObservedState(user.id, ctx.machineIdentifier, rk);
    if (previous && previous.state === cur.state) {
      upsertObservedState(cur);
      continue;
    }
    // Resolve canonical without extra Plex calls: identity map, then Movviz library
    let canonical: import("./mediaIdentityMap").CanonicalMediaIdentity | null = resolveCanonical(ctx.machineIdentifier, rk);
    let title: string | null = null;
    if (!canonical) {
      const { getMovieByPlexRatingKey } = await import("@/lib/library/store");
      const m = getMovieByPlexRatingKey(rk);
      if (m) { canonical = { type: "movie", tmdbId: m.tmdbId }; title = m.title; }
      else {
        const { findEpisodeByPlexRatingKey } = await import("@/lib/library/store");
        const hit = findEpisodeByPlexRatingKey(rk);
        if (hit) { canonical = { type: "episode", tmdbShowId: hit.series.tmdbId, seasonNumber: hit.season.seasonNumber, episodeNumber: hit.episode.episodeNumber }; title = hit.series.title; }
      }
    }
    if (!canonical) continue;
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
    const pendingIntent = getPendingIntentForMedia(user.id, canonical, currentCanonicalState as "watched" | "unwatched" | "unknown", canonicalAt);
    const result = reconcile({
      userId: user.id,
      canonicalIdentity: canonical,
      ratingKey: rk,
      machineIdentifier: ctx.machineIdentifier,
      currentCanonicalState: currentCanonicalState as "watched" | "unwatched" | "unknown",
      currentCanonicalAt: canonicalAt,
      previousPlexObserved: previous,
      currentPlexObserved: cur,
      pendingIntent,
      isBaseline: !previous,
    });
    if (result.decision === "ACK_LOCAL_WRITE" && pendingIntent) {
      const stateKey =
        canonical.type === "movie"
          ? mediaStateKey(user.id, "movie", canonical.tmdbId)
          : mediaStateKey(user.id, "episode", (canonical as Extract<import("./mediaIdentityMap").CanonicalMediaIdentity, { type: "episode" }>).tmdbShowId, (canonical as Extract<import("./mediaIdentityMap").CanonicalMediaIdentity, { type: "episode" }>).seasonNumber, (canonical as Extract<import("./mediaIdentityMap").CanonicalMediaIdentity, { type: "episode" }>).episodeNumber);
      updateUserMediaSyncState({ userId: user.id, stateKey, field: "watched", target: "plex", capability: "SYNCED", ackAt: Date.now(), error: null });
      recordSearchLog("info", "plex.outbox", `plex.outbox ACK quickVerify user=${user.username} ratingKey=${rk} rev=${pendingIntent.revision} → SYNCED`);
      upsertObservedState(cur);
    } else if (result.shouldApply && result.newCanonicalState) {
      if (applyReconcileDecision(
        {
          userId: user.id,
          canonicalIdentity: canonical,
          ratingKey: rk,
          machineIdentifier: ctx.machineIdentifier,
          currentCanonicalState: currentCanonicalState as "watched" | "unwatched" | "unknown",
          currentCanonicalAt: canonicalAt,
          previousPlexObserved: previous,
          currentPlexObserved: cur,
          pendingIntent,
          isBaseline: !previous,
        },
        result,
        title
      )) {
        reconciled++;
        upsertObservedState(cur);
        recordSearchLog("info", "plex.reconciler", `plex.reconciler quickVerify user=${user.username} ratingKey=${rk} decision=${result.decision} ${result.reason} -> ${result.newCanonicalState}`);
      }
    } else {
      upsertObservedState(cur);
    }
  }
  return { checked, reconciled };
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
      // Deduplicate entries – key by ratingKey when present, else by show+SxxExx (§1)
      const seen = new Set<string>();
      const deduped: (typeof historyRes.entries)[number][] = [];
      for (const e of historyRes.entries) {
        const k = e.ratingKey ?? `nork:${e.grandparentTitle ?? "?"}:${e.season ?? "?"}:${e.episode ?? "?"}:${e.viewedAt ?? "?"}`;
        if (seen.has(k)) continue;
        seen.add(k);
        deduped.push(e);
      }
      const entriesToProcess = deduped.slice(0, HISTORY_TARGETED_VERIFY_LIMIT);

      for (const entry of entriesToProcess) {
        // Resolve canonical FIRST (§1: episode history → resolveEpisode → real ratingKey → verify → reconcile)
        let canonical: { type: "movie"; tmdbId: number } | { type: "episode"; tmdbShowId: number; seasonNumber: number; episodeNumber: number } | null = null;
        let title: string | null = null;
        let verifyKey: string | undefined = entry.ratingKey;
        if (entry.type === "movie") {
          // Resolver film : ratingKey direct, sinon titre exact → vrai ratingKey Plex.
          const movieResolved = await resolveMovie(ctx, {
            ratingKey: entry.ratingKey,
            type: "movie",
            title: entry.title,
            guid: entry.guid,
            Guid: entry.Guid,
          });
          if (movieResolved.status !== "RESOLVED" || !movieResolved.canonical || !movieResolved.ratingKey) {
            recordSearchLog("warn", "plex.watchSync", `plex.watchSync movie unresolved user=${user.username} ratingKey=${entry.ratingKey ?? "none"} title=${entry.title ?? "?"} reason=${movieResolved.reason}`);
            continue;
          }
          canonical = movieResolved.canonical;
          title = entry.title ?? null;
        } else if (entry.type === "episode") {
          const raw = {
            ratingKey: entry.ratingKey,
            type: "episode",
            title: entry.title,
            guid: entry.guid,
            Guid: entry.Guid,
            grandparentTitle: entry.grandparentTitle,
            parentIndex: entry.season,
            index: entry.episode,
            grandparentRatingKey: entry.grandparentRatingKey,
            grandparentKey: entry.grandparentRatingKey ? `/library/metadata/${entry.grandparentRatingKey}` : undefined,
            accountID: entry.accountId,
          };
          const resolved = await resolveEpisode(ctx, raw, { requireRatingKey: true });
          if (resolved.status !== "RESOLVED" || !resolved.canonical) {
            recordSearchLog("warn", "plex.watchSync", `plex.watchSync episode unresolved user=${user.username} ratingKey=${entry.ratingKey ?? "none"} show=${entry.grandparentTitle ?? "?"} S${entry.season ?? "?"}E${entry.episode ?? "?"} reason=${resolved.reason} sample=${JSON.stringify(resolved.sample ?? raw).slice(0,500)}`);
            continue;
          }
          canonical = resolved.canonical;
          title = entry.grandparentTitle ?? entry.title ?? null;
          // Recover the REAL Plex episode ratingKey when the history event lacked one (§1)
          verifyKey = resolved.ratingKey ?? entry.ratingKey;
          const epCanon = canonical.type === "episode" ? canonical : null;
          if (!verifyKey && epCanon) {
            // Last resort: mediaIdentityMap, then Movviz library's known plexRatingKey
            const { resolveRatingKey } = await import("./mediaIdentityMap");
            verifyKey = resolveRatingKey(ctx.machineIdentifier, canonical) ?? undefined;
            if (!verifyKey) {
              const series = getSeriesByTmdbId(epCanon.tmdbShowId);
              const season = series?.seasons.find((s) => s.seasonNumber === epCanon.seasonNumber);
              verifyKey = season?.episodes.find((e) => e.episodeNumber === epCanon.episodeNumber)?.plexRatingKey ?? undefined;
            }
          }
        } else continue;

        if (!canonical) continue;
        if (!verifyKey) {
          recordSearchLog("warn", "plex.watchSync", `plex.watchSync no verifyKey user=${user.username} show=${entry.grandparentTitle ?? "?"} S${entry.season ?? "?"}E${entry.episode ?? "?"} – cannot verify, skipping`);
          continue;
        }
        const rk = verifyKey;
        // For shared/managed, viewCount is owner-only → history is the trigger itself.
        // Never call verifyWatchState to decide WATCHED for those profiles.
        let observed: import("./plexObservedState").PlexObservedState;
        if (ctx.authSource !== "owner") {
          if (entry.viewedAt == null || !Number.isFinite(entry.viewedAt) || entry.viewedAt <= 0) {
            recordSearchLog("warn", "plex.watchSync", `plex.watchSync history without viewedAt user=${user.username} ratingKey=${rk} – skipping (no timestamp)`);
            continue;
          }
          observed = {
            userId: ctx.movvizUserId,
            machineIdentifier: ctx.machineIdentifier,
            ratingKey: rk,
            state: "WATCHED",
            viewCount: 1,
            lastViewedAt: entry.viewedAt,
            observedAt: Date.now(),
          };
        } else {
          const v = await verifyWatchState(ctx, rk);
          if (!v) {
            recordSearchLog("warn", "plex.watchSync", `plex.watchSync history-trigger verify failed user=${user.username} ratingKey=${rk}`);
            continue;
          }
          observed = v;
        }
        historyTriggered++;

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

    // 1b) Quick re-check (§5): batch viewCount is owner-only, so only for owner.
    if (ctx.authSource === "owner" && shouldQuickVerify(user.id)) {
      try {
        const qr = await quickVerifyKnownMedia(user, ctx);
        if (qr.checked > 0) {
          recordSearchLog("info", "plex.watchSync", `plex.watchSync quickVerify user=${user.username} checked=${qr.checked} reconciled=${qr.reconciled}`);
        }
        lastQuickMap().set(user.id, Date.now());
      } catch (e) {
        recordSearchLog("warn", "plex.watchSync", `plex.watchSync quickVerify failed user=${user.username} err=${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // 2) WatchStateObserver snapshot – owner only. Shared/managed have no reliable per-user viewCount.
    const doSnapshot = ctx.authSource === "owner" && shouldSnapshot(user.id, opts?.forceSnapshot);
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

    // 3) Single decision chain (§7 plan final): history→resolve→verify→reconcile above,
    // quickVerify recent, snapshot below. No legacy direct-apply fallback – it bypassed
    // verification and used adminToken mapping. If viewCount is per-owner broken on a
    // server, targeted verification will show it in logs rather than silently importing.

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
