import { loadPlexConfig } from "./store";
import { batchTmdbIds, plexTimeToMs } from "./client";
import { recordSearchLog } from "@/lib/diagnostic/searchLog";
import { refreshLegacyUserContext } from "@/lib/userContext/bootstrap";
import { getCurrentWatchState } from "@/lib/userContext/watchBridge";
import type { User } from "@/lib/auth/types";
import { refreshPlexAvatar } from "./avatarSync";
import { resolvePlexUserContext } from "./plexUserContext";
import { pollHistory, getHistoryCursor, setHistoryCursor } from "./plexHistoryObserver";
import { snapshotWatchState, verifyWatchState, diffSnapshots } from "./plexWatchStateObserver";
import { getObservedStatesForUser, setObservedStates, getObservedState, upsertObservedState, replaceObservedStatesForUserServer } from "./plexObservedState";
import { reconcile, applyReconcileDecision } from "./plexReconciler";
import { resolveEpisode, resolveMovie } from "./episodeResolver";
import { isCircuitOpen, recordCircuitFailure, recordCircuitSuccess } from "./plexCircuitBreaker";
import { getSeriesByTmdbId, getMovieByTmdbId, findEpisodeByPlexRatingKey } from "@/lib/library/store";
import { withKeyLock } from "@/lib/library/locks";
import { getUserMediaSyncStates, updateUserMediaSyncState } from "@/lib/userContext/syncState";
import { mediaStateKey } from "@/lib/userContext/reconcile";
import { getBootstrapState, ensureBootstrapPending, startBootstrap, updateBootstrapProgress, completeBootstrap } from "./plexHistoryBootstrap";
import { formatCanonical } from "./mediaIdentityMap";

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

// Per-user sync lock (§94) + rerunRequested (§18)
const gLock = globalThis as typeof globalThis & { __movvizPlexSyncLocks?: Map<string, boolean>; __movvizPlexRerunRequested?: Set<string> };
function syncLocks(): Map<string, boolean> {
  return (gLock.__movvizPlexSyncLocks ??= new Map());
}
function rerunSet(): Set<string> {
  return (gLock.__movvizPlexRerunRequested ??= new Set());
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
  // Metadata viewCount is documented as server-owner state for non-owner
  // profiles. This guard protects the invariant even if an upstream caller
  // regresses later.
  if (ctx.authSource !== "owner") return { checked: 0, reconciled: 0 };
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

export type PlexWatchTarget =
  | { type: "movie"; tmdbId: number }
  | { type: "episode"; tmdbShowId: number; seasonNumber: number; episodeNumber: number };

export type PlexWatchTargetSyncOutcome =
  | { status: "skipped" | "failed"; reason: string }
  | { status: "observed"; observedState: "WATCHED" | "UNWATCHED"; decision: string; reason: string; applied: boolean };

export type PlexWatchSeriesSyncOutcome =
  | { status: "skipped" | "failed"; reason: string }
  | { status: "observed"; checked: number; watched: number; applied: number };

/**
 * Réconcilie une observation déjà lue dans Plex. Cette portion est partagée
 * par la vérification d'une fiche et par celle d'une série entière : les deux
 * chemins appliquent donc strictement les mêmes règles de fraîcheur/outbox.
 */
async function reconcileTargetObservation(
  user: User,
  ctx: import("./plexUserContext").PlexUserContext,
  canonical: import("./mediaIdentityMap").CanonicalMediaIdentity,
  ratingKey: string,
  observed: import("./plexObservedState").PlexObservedState,
  title: string | null,
): Promise<{ decision: string; reason: string; applied: boolean }> {
  const previous = getObservedState(user.id, ctx.machineIdentifier, ratingKey);
  const currentCanonicalState = getCurrentWatchState({
    userId: user.id,
    tmdbId: canonical.type === "movie" ? canonical.tmdbId : canonical.tmdbShowId,
    mediaType: canonical.type === "movie" ? "movie" : "episode",
    seasonNumber: canonical.type === "episode" ? canonical.seasonNumber : undefined,
    episodeNumber: canonical.type === "episode" ? canonical.episodeNumber : undefined,
  });
  const { withUserContextDb } = await import("@/lib/userContext/database");
  const canonicalAt: number | null = withUserContextDb((db) => {
    const stateKey = canonical.type === "movie"
      ? `${user.id}:movie:${canonical.tmdbId}`
      : `${user.id}:episode:${canonical.tmdbShowId}:${canonical.seasonNumber}:${canonical.episodeNumber}`;
    const row = db.prepare("SELECT watched_updated_at FROM user_media_state WHERE state_key = ?").get(stateKey) as { watched_updated_at: number | null } | undefined;
    return row?.watched_updated_at ?? null;
  }, null);
  const pendingIntent = getPendingIntentForMedia(user.id, canonical, currentCanonicalState as "watched" | "unwatched" | "unknown", canonicalAt);
  const input = {
    userId: user.id,
    canonicalIdentity: canonical,
    ratingKey,
    machineIdentifier: ctx.machineIdentifier,
    currentCanonicalState: currentCanonicalState as "watched" | "unwatched" | "unknown",
    currentCanonicalAt: canonicalAt,
    previousPlexObserved: previous,
    currentPlexObserved: observed,
    pendingIntent,
    isBaseline: !previous,
  } satisfies Parameters<typeof reconcile>[0];
  const result = reconcile(input);
  let applied = false;
  if (result.decision === "ACK_LOCAL_WRITE" && pendingIntent) {
    const stateKey = canonical.type === "movie"
      ? mediaStateKey(user.id, "movie", canonical.tmdbId)
      : mediaStateKey(user.id, "episode", canonical.tmdbShowId, canonical.seasonNumber, canonical.episodeNumber);
    updateUserMediaSyncState({ userId: user.id, stateKey, field: "watched", target: "plex", capability: "SYNCED", ackAt: Date.now(), error: null });
  } else if (result.shouldApply && (applied = applyReconcileDecision(input, result, title))) {
    recordSearchLog("info", "plex.reconciler", `plex.reconciler targeted user=${user.username} ratingKey=${ratingKey} decision=${result.decision} ${result.reason} -> ${result.newCanonicalState}`);
  }
  upsertObservedState(observed);
  return { decision: result.decision, reason: result.reason, applied };
}

/**
 * Vérifie immédiatement UN média affiché à l'utilisateur.
 *
 * Le scan d'historique complet est volontairement borné mais peut être long
 * sur une grosse installation Plex. Il ne doit jamais empêcher la fiche d'un
 * film de refléter un « Marquer comme vu » fait dans Plex : cette lecture est
 * une unique requête metadata sur sa ratingKey connue, sans snapshot global.
 * Elle peut tourner à côté d'un scan général ; une ancienne photo du scan ne
 * réécrit pas le ledger canonique déjà convergé par cette vérification.
 */
export async function syncUserWatchStatusForMedia(user: User, target: PlexWatchTarget): Promise<PlexWatchTargetSyncOutcome> {
  const cfg = loadPlexConfig();
  if (!cfg.hostname || !cfg.adminToken) return { status: "skipped", reason: "plex_not_configured" };

  const ctxRes = await resolvePlexUserContext(user.id);
  if (!ctxRes.ok) {
    recordSearchLog("warn", "plex.watchSync", `plex.watchSync targeted user=${user.username} status=skipped reason=${ctxRes.code}`);
    return { status: "skipped", reason: ctxRes.code };
  }
  const ctx = ctxRes.ctx;
  // A targeted metadata viewCount is reliable only for the owner, exactly as
  // quickVerify/snapshot. Managed/shared profiles continue to use History.
  if (ctx.authSource !== "owner") return { status: "skipped", reason: "unsupported_per_user_viewstate" };

  const canonical: import("./mediaIdentityMap").CanonicalMediaIdentity = target.type === "movie"
    ? { type: "movie", tmdbId: target.tmdbId }
    : { type: "episode", tmdbShowId: target.tmdbShowId, seasonNumber: target.seasonNumber, episodeNumber: target.episodeNumber };
  const { resolveRatingKey } = await import("./mediaIdentityMap");
  let ratingKey = resolveRatingKey(ctx.machineIdentifier, canonical);
  let title: string | null = null;

  // The library key is available immediately after the Plex library sync,
  // even before the identity map has been warmed by a history/snapshot run.
  if (target.type === "movie") {
    const movie = getMovieByTmdbId(target.tmdbId);
    ratingKey ??= movie?.plexRatingKey ?? null;
    title = movie?.title ?? null;
  } else {
    const series = getSeriesByTmdbId(target.tmdbShowId);
    const episode = series?.seasons.find((s) => s.seasonNumber === target.seasonNumber)?.episodes.find((e) => e.episodeNumber === target.episodeNumber);
    ratingKey ??= episode?.plexRatingKey ?? null;
    title = series?.title ?? null;
  }

  // Une fiche Movviz peut arriver avant que la synchronisation de bibliothèque
  // ait enregistré sa ratingKey locale. Ce n'est pas une raison valable pour
  // ignorer son état Plex : résoudre alors CE film par son titre exact dans
  // Plex, puis vérifier que le TMDb retourné est bien celui de la fiche. La
  // seconde condition est indispensable pour ne jamais lier deux homonymes.
  if (!ratingKey && target.type === "movie" && title) {
    try {
      const resolved = await resolveMovie(ctx, {
        type: "movie",
        title,
        Guid: [{ id: `tmdb://${target.tmdbId}` }],
      });
      const resolvedCanonical = resolved.canonical;
      if (resolved.status === "RESOLVED" && resolvedCanonical?.type === "movie" && resolvedCanonical.tmdbId === target.tmdbId && resolved.ratingKey) {
        ratingKey = resolved.ratingKey;
        recordSearchLog("info", "plex.watchSync", `plex.watchSync targeted user=${user.username} canonical=${formatCanonical(canonical)} ratingKey_resolved=${ratingKey} source=${resolved.reason}`);
      } else {
        recordSearchLog("warn", "plex.watchSync", `plex.watchSync targeted user=${user.username} canonical=${formatCanonical(canonical)} status=skipped reason=${resolved.reason}`);
      }
    } catch (error) {
      recordSearchLog("error", "plex.watchSync", `plex.watchSync targeted user=${user.username} canonical=${formatCanonical(canonical)} status=failed phase=resolve_rating_key error=${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (!ratingKey) {
    recordSearchLog("info", "plex.watchSync", `plex.watchSync targeted user=${user.username} canonical=${formatCanonical(canonical)} status=skipped reason=no_rating_key`);
    return { status: "skipped", reason: "no_rating_key" };
  }

  const observed = await verifyWatchState(ctx, ratingKey);
  if (!observed) {
    recordSearchLog("warn", "plex.watchSync", `plex.watchSync targeted user=${user.username} ratingKey=${ratingKey} status=skipped reason=verify_failed`);
    return { status: "skipped", reason: "verify_failed" };
  }

  const result = await reconcileTargetObservation(user, ctx, canonical, ratingKey, observed, title);
  refreshLegacyUserContext(user.id, true);
  return { status: "observed", observedState: observed.state === "WATCHED" ? "WATCHED" : "UNWATCHED", ...result };
}

/**
 * Vérifie tous les épisodes déjà indexés d'une série en appels Plex groupés.
 * Une fiche série ne dépend ainsi ni de la prochaine page de l'historique ni
 * du snapshot global cadencé : Naruto est réconcilié dès son ouverture.
 */
export async function syncUserWatchStatusForSeries(user: User, tmdbShowId: number): Promise<PlexWatchSeriesSyncOutcome> {
  const cfg = loadPlexConfig();
  if (!cfg.hostname || !cfg.adminToken) return { status: "skipped", reason: "plex_not_configured" };
  const ctxRes = await resolvePlexUserContext(user.id);
  if (!ctxRes.ok) return { status: "skipped", reason: ctxRes.code };
  const ctx = ctxRes.ctx;
  if (ctx.authSource !== "owner") return { status: "skipped", reason: "unsupported_per_user_viewstate" };

  const series = getSeriesByTmdbId(tmdbShowId);
  const episodes = series?.seasons.flatMap((season) => season.episodes
    .filter((episode) => Boolean(episode.plexRatingKey))
    .map((episode) => ({ seasonNumber: season.seasonNumber, episodeNumber: episode.episodeNumber, ratingKey: episode.plexRatingKey! }))) ?? [];
  if (episodes.length === 0) return { status: "skipped", reason: "no_library_episode_keys" };

  const { batchPlexViewState } = await import("./client");
  let viewMap: Map<string, import("./client").PlexViewState>;
  try {
    viewMap = await batchPlexViewState(cfg, ctx.serverToken, episodes.map((episode) => episode.ratingKey));
  } catch (error) {
    const reason = error instanceof Error && error.message.startsWith("plex_auth_failed") ? error.message : "verify_failed";
    recordSearchLog("warn", "plex.watchSync", `plex.watchSync series user=${user.username} tmdb=${tmdbShowId} status=failed reason=${reason}`);
    return { status: "failed", reason };
  }

  let checked = 0;
  let watched = 0;
  let applied = 0;
  for (const episode of episodes) {
    const state = viewMap.get(episode.ratingKey);
    if (!state) continue; // réponse Plex incomplète : aucune absence n'est assimilée à « non vu »
    checked++;
    const observed: import("./plexObservedState").PlexObservedState = {
      userId: user.id,
      machineIdentifier: ctx.machineIdentifier,
      ratingKey: episode.ratingKey,
      state: state.viewCount > 0 ? "WATCHED" : "UNWATCHED",
      viewCount: state.viewCount,
      lastViewedAt: state.lastViewedAt,
      viewOffset: state.viewOffset,
      observedAt: Date.now(),
    };
    if (observed.state === "WATCHED") watched++;
    const result = await reconcileTargetObservation(user, ctx, {
      type: "episode",
      tmdbShowId,
      seasonNumber: episode.seasonNumber,
      episodeNumber: episode.episodeNumber,
    }, episode.ratingKey, observed, series?.title ?? null);
    if (result.applied) applied++;
  }
  refreshLegacyUserContext(user.id, true);
  recordSearchLog("info", "plex.watchSync", `plex.watchSync series user=${user.username} tmdb=${tmdbShowId} checked=${checked} watched=${watched} applied=${applied}`);
  return { status: "observed", checked, watched, applied };
}

/**
 * Orchestrateur Plex sync (§55)
 * resolve user → history poll → watch snapshot → reconciliation → diagnostics
 * Never contains business logic inline – delegates to observers & reconciler.
 */
export async function syncUserWatchStatus(user: User, opts?: { forceSnapshot?: boolean }) {
  const lockKey = `plex-sync:${user.id}`;
  if (syncLocks().get(user.id)) {
    rerunSet().add(user.id);
    recordSearchLog("info", "plex.watchSync", `plex.watchSync user=${user.username} status=skipped reason=already_running rerunRequested=true`);
    return;
  }
  syncLocks().set(user.id, true);
  try {
    await withKeyLock(lockKey, async () => doSync(user, opts));
    // RerunRequested (§18): if a trigger arrived while we were running, do one immediate incremental catch-up
    if (rerunSet().has(user.id)) {
      rerunSet().delete(user.id);
      recordSearchLog("info", "plex.watchSync", `plex.watchSync rerun user=${user.username} reason=trigger_during_sync`);
      await withKeyLock(lockKey, async () => doSync(user, { forceSnapshot: false }));
    }
  } finally {
    syncLocks().delete(user.id);
  }
}

async function doSync(user: User, opts?: { forceSnapshot?: boolean }) {
  const syncStartedAt = Date.now();
  let syncPhase = "identity";
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
    syncPhase = "history";
    let bootstrapState = ctx.historyAvailable && ctx.historyAccountId != null
      ? ensureBootstrapPending(user.id, ctx.machineIdentifier)
      : null;
    const bootstrapNeeded = bootstrapState != null && bootstrapState.status !== "COMPLETED";
    let historyRes;
    let incrementalPagesFetched = 0;
    let bootstrapBatchStart = 0;
    let bootstrapBatchCount = 0;
    let bootstrapUpperBound: number | null = null;
    if (bootstrapNeeded && bootstrapState) {
      if (bootstrapState.status === "PENDING") {
        const newest = await pollHistory(ctx, { start: 0, size: 1, sortDirection: "desc" });
        const firstPage = await pollHistory(ctx, { start: 0, size: 100, sortDirection: "asc" });
        bootstrapUpperBound = newest.entries[0]?.viewedAt ?? null;
        bootstrapState = startBootstrap(user.id, ctx.machineIdentifier, firstPage.totalSize, bootstrapUpperBound);
        historyRes = firstPage;
        recordSearchLog("info", "plex.history", `plex.history bootstrap v2 start user=${user.username} sourceTotal=${firstPage.totalSize} upperBound=${bootstrapUpperBound ?? "none"} pageSize=100 sort=asc`);
      } else {
        // Stored before history dates were converted: may still be seconds.
        bootstrapUpperBound = plexTimeToMs(bootstrapState.upperBoundViewedAt) ?? null;
        historyRes = await pollHistory(ctx, { start: bootstrapState.currentStart, size: 100, sortDirection: "asc" });
      }
      bootstrapBatchStart = bootstrapState.currentStart;
      bootstrapBatchCount = historyRes.rawPageCount;
    } else {
      historyRes = await pollHistory(ctx, { start: 0, size: 100, sortDirection: "desc" });
      incrementalPagesFetched = 1;
      const cursor = getHistoryCursor(user.id, ctx.machineIdentifier);
      // Descending pages are read only until the already-committed cursor is
      // reached. This covers bursts larger than one Plex page without ever
      // scanning old history in the normal incremental path.
      if (cursor) {
        const seenAtCursor = new Set(cursor.seenEventKeysAtTimestamp ?? []);
        let page = historyRes;
        let reachedCursor = false;
        while (!reachedCursor && page.hasMore) {
          reachedCursor = page.entries.some((entry) => {
            const at = entry.viewedAt ?? 0;
            const key = entry.ratingKey ?? `nork:${entry.grandparentTitle ?? "?"}:${entry.season ?? "?"}:${entry.episode ?? "?"}:${at}`;
            return at < cursor.lastViewedAt || (at === cursor.lastViewedAt && seenAtCursor.has(key));
          });
          if (reachedCursor) break;
          page = await pollHistory(ctx, { start: page.nextStart, size: 100, sortDirection: "desc" });
          incrementalPagesFetched++;
          historyRes.entries.push(...page.entries);
          historyRes.rawPageCount += page.rawPageCount;
          historyRes.hasMore = page.hasMore;
          historyRes.nextStart = page.nextStart;
        }
      }
    }
    let historyTriggered = 0;
    let historyReconciled = 0;
    let historyResolved = 0;
    let historyUnresolved = 0;
    let historyErrors = 0;
    let historyProcessed = 0;
    let bootstrapCompletedThisRun = false;

    if (historyRes.entries.length > 0) {
      // Bootstrap vs incremental (§ final plan)
      // Deduplicate entries – key by ratingKey when present, else by show+SxxExx (§1)
      const seen = new Set<string>();
      const dedupedAll: (typeof historyRes.entries)[number][] = [];
      for (const e of historyRes.entries) {
        const k = e.ratingKey
          ?? (e.type === "episode"
            ? `episode:${e.grandparentTitle ?? "?"}:${e.season ?? "?"}:${e.episode ?? "?"}`
            : `movie:${e.guid ?? e.title ?? "?"}`);
        if (seen.has(k)) continue;
        seen.add(k);
        dedupedAll.push(e);
      }
      // Bootstrap: treat ALL entries oldest-first in batches, resumable with upperBound; incremental: newest 20
      let entriesToProcess: (typeof historyRes.entries)[number][];
      let bootstrapEligibleTotal = bootstrapState?.expectedTotal ?? 0;
      if (bootstrapNeeded) {
        const recent = await pollHistory(ctx, { start: 0, size: 20, sortDirection: "desc" });
        const pageKeys = new Set(dedupedAll.map((entry) => entry.ratingKey ?? `${entry.type}:${entry.viewedAt}`));
        entriesToProcess = [...recent.entries.filter((entry) => !pageKeys.has(entry.ratingKey ?? `${entry.type}:${entry.viewedAt}`)), ...dedupedAll];
      } else {
        // Incremental: newest first, limit, but respect cursor + seenEventKeys (§17) to avoid re-reading 4641 each poll
        const cursor = getHistoryCursor(user.id, ctx.machineIdentifier);
        const lastAt = cursor?.lastViewedAt ?? 0;
        const seenSet = new Set(cursor?.seenEventKeysAtTimestamp ?? []);
        // Filter to only truly new events (viewedAt > lastAt, or == lastAt but not yet seen)
        const incrementalCandidates = dedupedAll.filter((e) => {
          const at = e.viewedAt ?? 0;
          if (at > lastAt) return true;
          if (at === lastAt) {
            const k = e.ratingKey ?? `nork:${e.grandparentTitle ?? "?"}:${e.season ?? "?"}:${e.episode ?? "?"}:${e.viewedAt ?? "?"}`;
            return !seenSet.has(k);
          }
          return false;
        });
        // If cursor exists and we have candidates, they are already the new ones; otherwise if no cursor (first incremental after bootstrap), use newest 20 as before
        const source = incrementalCandidates.length > 0 ? incrementalCandidates : (cursor ? [] : dedupedAll);
        source.sort((a, b) => (b.viewedAt ?? 0) - (a.viewedAt ?? 0));
        // Pages were bounded at the Plex transport layer and stopped at the
        // cursor above; process every newly discovered event before committing
        // that cursor, otherwise events 21..N would be lost.
        entriesToProcess = source;
        if (cursor && incrementalCandidates.length === 0 && dedupedAll.length > 0) {
          recordSearchLog("info", "plex.history", `plex.history incremental user=${user.username} pagesFetched=${incrementalPagesFetched} rawFetched=${historyRes.rawPageCount} newEvents=0 cursorAdvanced=false`);
        }
      }

      for (const entry of entriesToProcess) {
        try {
        historyProcessed++;
        syncPhase = "history-resolve";
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
            historyUnresolved++;
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
            historyUnresolved++;
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
        historyResolved++;
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
        syncPhase = "history-reconcile";
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
            recordSearchLog("info", "plex.reconciler", `plex.reconciler user=${user.username} ratingKey=${rk} decision=${result.decision} ${result.reason} canonical=${formatCanonical(canonical)}`);
          }
        } else if (result.decision !== "UNCHANGED" && result.decision !== "STALE_OBSERVATION") {
          recordSearchLog("info", "plex.reconciler", `plex.reconciler user=${user.username} ratingKey=${rk} decision=${result.decision} ${result.reason}`);
          if (result.decision !== "BASELINE") upsertObservedState(observed);
        } else {
          // Still update observed state for tracking
          upsertObservedState(observed);
        }
        } catch (error) {
          historyErrors++;
          const stack = error instanceof Error ? error.stack ?? error.message : String(error);
          recordSearchLog("error", "plex.watchSync", `plex.watchSync history entry failed user=${user.username} phase=${syncPhase} entryType=${entry.type} ratingKey=${entry.ratingKey ?? "none"} show=${entry.grandparentTitle ?? "-"} season=${entry.season ?? "-"} episode=${entry.episode ?? "-"} title=${entry.title ?? "-"} error=${stack}`);
          continue;
        }
      }
      recordSearchLog("info", "plex.watchSync", `plex.watchSync history user=${user.username} entries=${historyRes.entries.length} triggered=${historyTriggered} reconciled=${historyReconciled} ${bootstrapNeeded ? `bootstrap batch ${bootstrapBatchStart}-${bootstrapBatchStart + entriesToProcess.length}/${bootstrapEligibleTotal ?? dedupedAll.length} upperBound=${bootstrapUpperBound ?? "?"}` : ""}`);
      // Bootstrap progress persistence – reprenable (§ final plan)
      if (bootstrapNeeded && bootstrapState) {
        const eligibleTotal = bootstrapState.expectedTotal ?? bootstrapEligibleTotal;
        const nextCursor = bootstrapBatchStart + bootstrapBatchCount;
        if (bootstrapBatchCount === 0 || nextCursor >= eligibleTotal) {
          completeBootstrap(user.id, ctx.machineIdentifier);
          bootstrapCompletedThisRun = true;
          if (bootstrapUpperBound != null) {
          setHistoryCursor(user.id, ctx.machineIdentifier, bootstrapUpperBound, []);
          }
          recordSearchLog("info", "plex.history", `plex.history bootstrap completed user=${user.username} total=${dedupedAll.length} eligible=${eligibleTotal} upperBound=${bootstrapUpperBound}`);
        } else {
          updateBootstrapProgress(user.id, ctx.machineIdentifier, bootstrapState.processedEvents + bootstrapBatchCount, bootstrapState.resolvedEvents + historyResolved, bootstrapState.unresolvedEvents + historyUnresolved, nextCursor, bootstrapState.errorEvents + historyErrors, eligibleTotal);
          recordSearchLog("info", "plex.history", `plex.history bootstrap page user=${user.username} sourceStart=${bootstrapBatchStart} rawFetched=${bootstrapBatchCount} processed=${bootstrapBatchCount} resolved=${historyResolved} unresolved=${historyUnresolved} errors=${historyErrors} nextStart=${nextCursor} progress=${nextCursor}/${eligibleTotal}`);
        }
      }

      // Incremental cursor follows only entries that completed their local
      // handling. Replays after a crash are safe through the ledger.
      if (!bootstrapNeeded && entriesToProcess.length > 0) {
        const newest = Math.max(...entriesToProcess.map((entry) => entry.viewedAt ?? 0));
        setHistoryCursor(user.id, ctx.machineIdentifier, newest, entriesToProcess);
      }
    } else if (bootstrapNeeded) {
      // An empty raw source page is a coherent early end (library shrink).
      completeBootstrap(user.id, ctx.machineIdentifier);
      bootstrapCompletedThisRun = true;
      recordSearchLog("info", "plex.history", `plex.history bootstrap completed (empty) user=${user.username}`);
    }

    // 1b) Quick re-check (§5): batch viewCount is owner-only, so only for owner.
    if (ctx.authSource === "owner" && !bootstrapNeeded && shouldQuickVerify(user.id)) {
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
    syncPhase = "snapshot";
    const doSnapshot = ctx.authSource === "owner" && (opts?.forceSnapshot === true || bootstrapCompletedThisRun || (!bootstrapNeeded && shouldSnapshot(user.id)));
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
    } else if (ctx.authSource !== "owner") {
      recordSearchLog("info", "plex.watchSync", `plex.watchSync snapshot skipped user=${user.username} reason=unsupported_non_owner snapshotAvailable=false`);
    } else if (bootstrapNeeded) {
      recordSearchLog("info", "plex.watchSync", `plex.watchSync snapshot skipped user=${user.username} reason=bootstrap_running`);
    } else {
      const last = lastSnapshotMap().get(user.id);
      recordSearchLog("info", "plex.watchSync", `plex.watchSync snapshot skipped user=${user.username} reason=throttled last=${last == null ? "never" : `${Math.round((Date.now() - last) / 60000)}min ago`}`);
    }

    // 3) Single decision chain (§7 plan final): history→resolve→verify→reconcile above,
    // quickVerify recent, snapshot below. No legacy direct-apply fallback – it bypassed
    // verification and used adminToken mapping. If viewCount is per-owner broken on a
    // server, targeted verification will show it in logs rather than silently importing.

    // 4) Outbox ACK is handled in watchWrite retry, not here.

    // 5) Refresh derived context
    refreshLegacyUserContext(user.id, true);

    recordCircuitSuccess(user.id);
    recordSearchLog("info", "plex.watchSync", `plex.watchSync summary user=${user.username} authSource=${ctx.authSource} historyCapability=${ctx.watchImportCapability} snapshotCapability=${ctx.authSource === "owner" ? "AVAILABLE" : "UNAVAILABLE"} bootstrap=${bootstrapNeeded ? "running" : "completed"} pagesFetched=${bootstrapNeeded ? 1 : incrementalPagesFetched} historyReceived=${historyRes.entries.length} historyUnique=${historyRes.entries.length > 0 ? new Set(historyRes.entries.map((entry) => entry.ratingKey ?? `${entry.type}:${entry.grandparentTitle ?? entry.title ?? "?"}:${entry.season ?? ""}:${entry.episode ?? ""}`)).size : 0} historyProcessed=${historyProcessed} historyResolved=${historyResolved} historyUnresolved=${historyUnresolved} historyErrors=${historyErrors} reconciled=${historyReconciled} cursorAdvanced=${!bootstrapNeeded && historyProcessed > 0} durationMs=${Date.now() - syncStartedAt}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack ?? err.message : String(err);
    recordSearchLog("error", "plex.watchSync", `watchSync failed user=${user.username} phase=${syncPhase} error=${msg} stack=${stack} — données précédentes conservées`);
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
