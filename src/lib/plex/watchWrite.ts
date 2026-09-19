import { loadPlexConfig, savePlexConfig } from "./store";
import { setPlexWatched, setPlexRating, deletePlexItem, getPlexOnDeck, getPlexServerAccessToken, getServerIdentity, switchPlexHomeUser, removePlexFromContinueWatching, type PlexOnDeckItem, getPlexViewState } from "./client";
import { getMovieByTmdbId, getSeriesByTmdbId } from "@/lib/library/store";
import { recordSearchLog } from "@/lib/diagnostic/searchLog";
import type { User } from "@/lib/auth/types";
import type { PlexServerConfig } from "./types";
import { updateUser, getUserById } from "@/lib/auth/store";
import { updateUserMediaSyncState, getPendingSyncStates } from "@/lib/userContext/syncState";
import { mediaStateKey } from "@/lib/userContext/reconcile";
import { getCurrentWatchState } from "@/lib/userContext/watchBridge";
import { resolvePlexUserContext } from "./plexUserContext";
import { upsertObservedState } from "./plexObservedState";

const PLEX_WATCHED_SYNC_TARGET = "plex";
const PLEX_WATCHED_SYNC_FIELD = "watched";

/** user_media_sync_state existait déjà (watchlist Plex entrante) mais aucun
 *  scrobble/unscrobble sortant n'y écrivait — §26-29, §56-57 du plan de
 *  centralisation watched : PENDING avant la tentative, SYNCED/ERROR après,
 *  jamais l'inverse (un échec Plex ne doit jamais annuler la décision
 *  locale déjà appliquée par applyWatchDecision, juste rester visible pour
 *  un retry futur). */
function recordPlexWatchedSync(userId: string, stateKey: string, ok: boolean, error?: string): void {
  updateUserMediaSyncState({
    userId, stateKey, field: PLEX_WATCHED_SYNC_FIELD, target: PLEX_WATCHED_SYNC_TARGET,
    capability: ok ? "SYNCED" : "ERROR",
    ackAt: ok ? Date.now() : null,
    error: ok ? null : (error ?? "push failed"),
  });
}

// §58-59 du plan de finalisation : une décision qui vient de Plex (ou d'un
// rattrapage legacy sans vraie intention utilisateur) ne doit jamais
// redéclencher un export VERS Plex — sinon boucle Plex -> Movviz -> Plex
// inutile. Seules les décisions d'origine réellement locale méritent une
// propagation sortante.
const PLEX_PROPAGATED_SOURCES = new Set(["movviz_manual", "movviz_playback", "external_import", "ai"]);
export function shouldPropagateWatchedToPlex(source: string): boolean {
  return PLEX_PROPAGATED_SOURCES.has(source);
}

/**
 * Outbox durable (phase 6 du plan de finalisation, 2026-09) : marque PENDING
 * AVANT toute tentative réseau (§48 — jamais après), pour qu'un crash ou une
 * panne Plex entre la décision locale acceptée et l'appel réseau laisse
 * quand même une trace retryable par le scheduler, au lieu de perdre
 * silencieusement l'export si le processus fire-and-forget qui suit ne va
 * jamais au bout.
 */
export function markPlexWatchedOutboxPending(userId: string, mediaType: "movie" | "episode", tmdbId: number, seasonNumber?: number, episodeNumber?: number): void {
  const stateKey = mediaStateKey(userId, mediaType, tmdbId, seasonNumber, episodeNumber);
  updateUserMediaSyncState({ userId, stateKey, field: PLEX_WATCHED_SYNC_FIELD, target: PLEX_WATCHED_SYNC_TARGET, capability: "PENDING", observedAt: Date.now() });
}

/**
 * Movviz → Plex (demande explicite user — "bidirectionnel"). Push a
 * watched/unwatched change made IN MOVVIZ (manual toggle, or a future
 * Netflix import) out to this Movviz user's own Plex account, using
 * client.ts's setPlexWatched (real scrobble/unscrobble API).
 *
 * Only ever called from the WRITE paths a user (or an import) actually
 * triggers (watch/toggle route) — never from watchSync.ts's own Plex→Movviz
 * read, which is what keeps this one-directional-per-event instead of an
 * infinite mirror: a status Movviz just learned FROM Plex is never pushed
 * BACK to Plex, only a status Movviz itself just changed.
 *
 * No-op, silently, when: Plex isn't configured, this Movviz user never
 * linked a Plex account, or the item hasn't been through a Plex library
 * sync yet (no known ratingKey) — never blocks or breaks the local toggle
 * either way (callers fire-and-forget this).
 */
export function resolveToken(user: User, cfg: { adminToken: string | null }): { token: string } | null {
  // Never fall back to an account token or `X-Plex-Profile` here.  Those
  // credentials are not a reliable PMS identity and were the source of the
  // cross-profile history/resume leak.  Calls that can await use
  // `resolvePlexServerAuth`, which exchanges the account token for the real
  // server-scoped token first.
  if (user.plexServerToken) return { token: user.plexServerToken };
  if (user.role === "admin" && user.plexToken && user.plexToken === cfg.adminToken) return { token: user.plexToken };
  return null;
}

export interface PlexServerAuth {
  token: string;
  source: "owner" | "account" | "managed";
}

function isOwnerAccount(user: User, cfg: PlexServerConfig) {
  return user.role === "admin" && !!cfg.adminToken && user.plexToken === cfg.adminToken;
}

async function ensureMachineIdentifier(cfg: PlexServerConfig): Promise<string | null> {
  if (cfg.machineIdentifier) return cfg.machineIdentifier;
  const machineIdentifier = await getServerIdentity(cfg);
  if (!machineIdentifier) return null;
  savePlexConfig({ ...cfg, machineIdentifier });
  return machineIdentifier;
}

/**
 * Obtain an actual PMS credential for this Movviz user.  Plex account tokens
 * identify a plex.tv session, not necessarily a media-server profile; Home
 * profiles additionally require `/home/users/{id}/switch`, then a resources
 * exchange for this specific server.  Persisting only the resulting
 * server-scoped token avoids an extra plex.tv round-trip on every card row.
 */
export async function resolvePlexServerAuth(user: User, cfg: PlexServerConfig): Promise<PlexServerAuth | null> {
  if (!cfg.hostname) return null;
  if (isOwnerAccount(user, cfg) && cfg.adminToken) return { token: cfg.adminToken, source: "owner" };
  if (user.plexServerToken) return { token: user.plexServerToken, source: user.plexManagedUserId ? "managed" : "account" };
  if (!cfg.adminToken) return null;

  const machineIdentifier = await ensureMachineIdentifier(cfg);
  if (!machineIdentifier) return null;

  let accountToken = user.plexToken;
  let source: PlexServerAuth["source"] = "account";
  if (!accountToken && user.plexManagedUserId) {
    accountToken = await switchPlexHomeUser(cfg.clientId, cfg.adminToken, user.plexManagedUserId);
    source = "managed";
  }
  if (!accountToken) return null;

  const serverToken = await getPlexServerAccessToken(cfg.clientId, accountToken, machineIdentifier);
  if (!serverToken) {
    recordSearchLog(
      "warn",
      "plex.profileAuth",
      `${user.username}: Plex n'a pas fourni de jeton d'accès pour ce serveur — données Plex personnelles ignorées, données Movviz locales conservées.`
    );
    return null;
  }
  updateUser(user.id, { plexServerToken: serverToken });
  return { token: serverToken, source };
}

export async function pushMovieWatchedToPlex(user: User, tmdbId: number, watched: boolean): Promise<void> {
  const stateKey = mediaStateKey(user.id, "movie", tmdbId);
  const cfg = loadPlexConfig();
  // §60 du plan : ce film n'a pas de plexRatingKey pour l'instant — pas
  // une vraie erreur, juste une synchro bibliothèque pas encore passée.
  // ERROR retryable (pas UNSUPPORTED) : le scheduler retente et réussira
  // dès que plex-library-sync aura peuplé plexRatingKey.
  const movie = getMovieByTmdbId(tmdbId);
  if (!movie?.plexRatingKey) {
    recordPlexWatchedSync(user.id, stateKey, false, "no plexRatingKey yet");
    return;
  }
  if (!cfg.hostname) {
    updateUserMediaSyncState({ userId: user.id, stateKey, field: PLEX_WATCHED_SYNC_FIELD, target: PLEX_WATCHED_SYNC_TARGET, capability: "UNSUPPORTED", error: "Plex non configuré" });
    return;
  }
  const auth = await resolvePlexServerAuth(user, cfg);
  if (!auth) {
    updateUserMediaSyncState({ userId: user.id, stateKey, field: PLEX_WATCHED_SYNC_FIELD, target: PLEX_WATCHED_SYNC_TARGET, capability: "UNSUPPORTED", error: "identité Plex non résolue pour ce compte" });
    return;
  }

  const ok = await setPlexWatched(cfg, auth.token, movie.plexRatingKey, watched);
  if (!ok) {
    recordPlexWatchedSync(user.id, stateKey, false, "plex scrobble HTTP failed");
    recordSearchLog("warn", "plex.watchWrite", `${user.username} (plexId:${user.plexId ?? user.plexManagedUserId ?? "?"}, ${auth.source}) — « ${movie.title} » ${watched ? "marqué vu" : "marqué non vu"} sur Plex : échec`);
    return;
  }
  // Targeted verification after HTTP 200 (§82) – a 200 is not proof alone
  let verified = false;
  try {
    const ctxRes = await resolvePlexUserContext(user.id);
    if (ctxRes.ok) {
      const obs = await getPlexViewState(cfg, ctxRes.ctx.serverToken, movie.plexRatingKey);
      if (obs) {
        upsertObservedState({
          userId: user.id,
          machineIdentifier: ctxRes.ctx.machineIdentifier,
          ratingKey: movie.plexRatingKey,
          state: (obs.viewCount ?? 0) > 0 ? "WATCHED" : "UNWATCHED",
          viewCount: obs.viewCount,
          lastViewedAt: obs.lastViewedAt,
          viewOffset: obs.viewOffset,
          observedAt: Date.now(),
        });
        verified = (obs.viewCount > 0) === watched;
      }
    }
  } catch {
    // verification best-effort
  }
  if (verified) {
    recordPlexWatchedSync(user.id, stateKey, true);
    recordSearchLog("info", "plex.watchWrite", `${user.username} (plexId:${user.plexId ?? user.plexManagedUserId ?? "?"}, ${auth.source}) — « ${movie.title} » ${watched ? "marqué vu" : "marqué non vu"} sur Plex : ok (vérifié)`);
  } else {
    // Keep PENDING for retry – don't mark SYNCED until verified (§82)
    updateUserMediaSyncState({ userId: user.id, stateKey, field: PLEX_WATCHED_SYNC_FIELD, target: PLEX_WATCHED_SYNC_TARGET, capability: "PENDING", error: "en attente de vérification ciblée" });
    recordSearchLog("warn", "plex.watchWrite", `${user.username} (plexId:${user.plexId ?? user.plexManagedUserId ?? "?"}, ${auth.source}) — « ${movie.title} » ${watched ? "marqué vu" : "marqué non vu"} sur Plex : HTTP ok mais vérification différée (retry)`);
  }
}

export async function pushRatingToPlex(user: User, tmdbId: number, type: "movie" | "series", stars: number | null, at?: number): Promise<void> {
  const cfg = loadPlexConfig();
  if (!cfg.hostname) return;
  const auth = await resolvePlexServerAuth(user, cfg);
  if (!auth) return;
  const media = type === "movie" ? getMovieByTmdbId(tmdbId) : getSeriesByTmdbId(tmdbId);
  if (!media?.plexRatingKey) return;
  const ok = await setPlexRating(cfg, auth.token, media.plexRatingKey, stars == null ? 0 : stars * 2, at);
  recordSearchLog(ok ? "info" : "warn", "plex.ratingSync", `${user.username} — « ${media.title} » rating ${stars == null ? "effacé" : `${stars}/5`} sur Plex : ${ok ? "ok" : "échec"}`);
}

/** "Retirer de la liste Reprendre" (Reprendre row's own dropdown, confirmed
 *  live) — Plex's real removeFromContinueWatching action, distinct from
 *  scrobbling: drops the item off On Deck without marking it watched, so a
 *  later real play starts over instead of resuming or counting as a rewatch. */
export async function removeFromContinueWatchingOnPlex(user: User, ratingKey: string): Promise<boolean> {
  const cfg = loadPlexConfig();
  if (!cfg.hostname) return false;
  const auth = await resolvePlexServerAuth(user, cfg);
  if (!auth) return false;
  const ok = await removePlexFromContinueWatching(cfg, auth.token, ratingKey);
  recordSearchLog(
    ok ? "info" : "warn",
    "plex.watchWrite",
    `${user.username} (plexId:${user.plexId ?? user.plexManagedUserId ?? "?"}, ${auth.source}) — retrait de "Continuer à regarder" (ratingKey:${ratingKey}) sur Plex : ${ok ? "ok" : "échec"}`
  );
  return ok;
}

/**
 * Best-effort: asks Plex to delete its own reference to an item permanently
 * removed from Movviz's trash, so Plex's own library sync (syncMovieSection)
 * doesn't re-add it the next time it scans and still sees it. Never throws,
 * never blocks the caller's local deletion on failing.
 */
export async function deleteItemFromPlex(user: User, ratingKey: string): Promise<boolean> {
  const cfg = loadPlexConfig();
  if (!cfg.hostname) return false;
  const auth = await resolvePlexServerAuth(user, cfg);
  if (!auth) return false;
  const ok = await deletePlexItem(cfg, auth.token, ratingKey);
  recordSearchLog(
    ok ? "info" : "warn",
    "plex.trashDelete",
    `${user.username} — suppression Plex de ratingKey ${ratingKey} (corbeille vidée) : ${ok ? "ok" : "échec"}`
  );
  return ok;
}

/**
 * Continue Watching / on-deck data, always read through a real PMS token.
 * A second, per-item comparison against the owner's On Deck is retained as a
 * fail-closed guard for an expired/broken scoped token: Plex must never turn
 * the server owner's position into another Movviz user's resume position.
 */
export async function getVerifiedOnDeck(user: User, cfg: PlexServerConfig): Promise<PlexOnDeckItem[]> {
  const auth = await resolvePlexServerAuth(user, cfg);
  if (!auth) return [];
  const items = await getPlexOnDeck(cfg, auth.token);
  if (auth.source === "owner" || !cfg.adminToken) return items;

  const ownerItems = await getPlexOnDeck(cfg, cfg.adminToken);
  const ownerPositions = new Set(ownerItems.map((i) => `${i.ratingKey}:${i.viewOffset}:${i.duration}`));
  const verified = items.filter((i) => !ownerPositions.has(`${i.ratingKey}:${i.viewOffset}:${i.duration}`));
  if (verified.length !== items.length) {
    recordSearchLog(
      "warn",
      "plex.onDeckLeak",
      `${user.username} (${auth.source}) : ${items.length - verified.length} position(s) identique(s) au compte propriétaire rejetée(s) — reprise Movviz locale conservée.`
    );
  }
  return verified;
}

export async function pushEpisodesWatchedToPlex(
  user: User,
  entries: { tmdbId: number; season: number; episode: number }[],
  watched: boolean
): Promise<void> {
  const cfg = loadPlexConfig();
  // §61 du plan : aligner sur pushMovieWatchedToPlex — un échec structurel
  // (Plex non configuré / identité non résolue) marque chaque entrée
  // UNSUPPORTED au lieu de disparaître silencieusement sans aucune trace.
  if (!cfg.hostname) {
    for (const e of entries) updateUserMediaSyncState({ userId: user.id, stateKey: mediaStateKey(user.id, "episode", e.tmdbId, e.season, e.episode), field: PLEX_WATCHED_SYNC_FIELD, target: PLEX_WATCHED_SYNC_TARGET, capability: "UNSUPPORTED", error: "Plex non configuré" });
    return;
  }
  const auth = await resolvePlexServerAuth(user, cfg);
  if (!auth) {
    for (const e of entries) updateUserMediaSyncState({ userId: user.id, stateKey: mediaStateKey(user.id, "episode", e.tmdbId, e.season, e.episode), field: PLEX_WATCHED_SYNC_FIELD, target: PLEX_WATCHED_SYNC_TARGET, capability: "UNSUPPORTED", error: "identité Plex non résolue pour ce compte" });
    return;
  }

  const bySeries = new Map<number, { season: number; episode: number }[]>();
  for (const e of entries) {
    const list = bySeries.get(e.tmdbId) ?? [];
    list.push(e);
    bySeries.set(e.tmdbId, list);
  }

  for (const [tmdbId, eps] of bySeries) {
    const series = getSeriesByTmdbId(tmdbId);
    if (!series) {
      // Série pas encore importée dans la bibliothèque Movviz : retryable,
      // pas un échec permanent (alignement épisode/film, §61).
      for (const e of eps) recordPlexWatchedSync(user.id, mediaStateKey(user.id, "episode", tmdbId, e.season, e.episode), false, "série pas encore dans la bibliothèque");
      continue;
    }
    let ok = 0;
    let fail = 0;
    // Prepare context for targeted verification (best-effort)
    let verifyCtx: Awaited<ReturnType<typeof resolvePlexUserContext>> | null = null;
    try { verifyCtx = await resolvePlexUserContext(user.id); } catch { verifyCtx = null; }
    for (const e of eps) {
      const season = series.seasons.find((s) => s.seasonNumber === e.season);
      const episode = season?.episodes.find((ep) => ep.episodeNumber === e.episode);
      const stateKey = mediaStateKey(user.id, "episode", tmdbId, e.season, e.episode);
      if (!episode?.plexRatingKey) {
        fail++;
        recordPlexWatchedSync(user.id, stateKey, false, "no plexRatingKey yet");
        continue;
      }
      const result = await setPlexWatched(cfg, auth.token, episode.plexRatingKey, watched);
      if (!result) {
        fail++;
        recordPlexWatchedSync(user.id, stateKey, false, "plex scrobble HTTP failed");
        continue;
      }
      // Targeted verification (§82)
      let verified = false;
      if (verifyCtx?.ok) {
        try {
          const obs = await getPlexViewState(cfg, verifyCtx.ctx.serverToken, episode.plexRatingKey);
          if (obs) {
            upsertObservedState({
              userId: user.id,
              machineIdentifier: verifyCtx.ctx.machineIdentifier,
              ratingKey: episode.plexRatingKey,
              state: (obs.viewCount ?? 0) > 0 ? "WATCHED" : "UNWATCHED",
              viewCount: obs.viewCount,
              lastViewedAt: obs.lastViewedAt,
              viewOffset: obs.viewOffset,
              observedAt: Date.now(),
            });
            verified = (obs.viewCount > 0) === watched;
          }
        } catch { /* best-effort */ }
      }
      if (verified) {
        recordPlexWatchedSync(user.id, stateKey, true);
        ok++;
      } else {
        updateUserMediaSyncState({ userId: user.id, stateKey, field: PLEX_WATCHED_SYNC_FIELD, target: PLEX_WATCHED_SYNC_TARGET, capability: "PENDING", error: "en attente de vérification ciblée" });
        // Count as pending retry, not immediate fail – but for log we count as fail for now and retry will handle
        ok++;
      }
    }
    recordSearchLog(
      fail === 0 ? "info" : "warn",
      "plex.watchWrite",
      `${user.username} (plexId:${user.plexId ?? user.plexManagedUserId ?? "?"}, ${auth.source}) — « ${series.title} » : ${ok} épisode(s) ${watched ? "marqué(s) vu(s)" : "marqué(s) non vu(s)"} sur Plex, ${fail} échec(s)/pas encore synchronisable(s)`
    );
  }
}

function parseWatchedStateKey(stateKey: string): { userId: string; mediaType: "movie" | "episode"; tmdbId: number; seasonNumber?: number; episodeNumber?: number } | null {
  const parts = stateKey.split(":");
  if (parts.length === 3 && parts[1] === "movie") {
    const tmdbId = Number(parts[2]);
    return Number.isFinite(tmdbId) ? { userId: parts[0], mediaType: "movie", tmdbId } : null;
  }
  if (parts.length === 5 && parts[1] === "episode") {
    const tmdbId = Number(parts[2]);
    const seasonNumber = Number(parts[3]);
    const episodeNumber = Number(parts[4]);
    return Number.isFinite(tmdbId) && Number.isFinite(seasonNumber) && Number.isFinite(episodeNumber)
      ? { userId: parts[0], mediaType: "episode", tmdbId, seasonNumber, episodeNumber }
      : null;
  }
  return null;
}

// Retry minimal (§52 du plan) : pas de retry_count dédié, juste un délai
// minimum depuis la dernière tentative — le scheduler qui appelle ceci
// toutes les minutes (plex-watchlist-sync) fournit déjà un backoff naturel
// tant que l'entrée continue d'échouer.
const OUTBOX_RETRY_MIN_AGE_MS = 60_000;
const OUTBOX_RETRY_BATCH_LIMIT = 200;

/**
 * Filet de sécurité de l'outbox durable (phase 7 du plan de finalisation) :
 * relit chaque entrée PENDING/ERROR de user_media_sync_state (target=plex,
 * field=watched) et retente l'export — mais en lisant l'état CANONIQUE
 * ACTUEL (getCurrentWatchState) au moment du retry, jamais une valeur
 * figée au moment de la décision initiale (§49 : coalescence — si l'état a
 * changé entre-temps, seule la dernière décision compte, pas un rejeu de
 * l'ancienne intention). Appelée depuis la tâche scheduler existante
 * plex-watchlist-sync plutôt que créer une nouvelle boucle (§53-54).
 */
export async function retryPendingPlexWatchedState(): Promise<void> {
  const cfg = loadPlexConfig();
  if (!cfg.hostname) return;
  const before = Date.now() - OUTBOX_RETRY_MIN_AGE_MS;
  const pending = getPendingSyncStates({
    target: PLEX_WATCHED_SYNC_TARGET, field: PLEX_WATCHED_SYNC_FIELD,
    capabilities: ["PENDING", "ERROR"], before, limit: OUTBOX_RETRY_BATCH_LIMIT,
  });
  if (pending.length === 0) return;

  const usersById = new Map<string, User>();
  for (const entry of pending) {
    const parsed = parseWatchedStateKey(entry.stateKey);
    if (!parsed || parsed.userId !== entry.userId) continue;
    let user = usersById.get(parsed.userId);
    if (user === undefined) {
      user = getUserById(parsed.userId) ?? undefined;
      if (user) usersById.set(parsed.userId, user);
    }
    if (!user) continue;

    const current = getCurrentWatchState({
      userId: parsed.userId, tmdbId: parsed.tmdbId, mediaType: parsed.mediaType,
      seasonNumber: parsed.seasonNumber, episodeNumber: parsed.episodeNumber,
    });
    // "unknown" ne devrait pas arriver ici (une entrée PENDING n'existe
    // qu'après une décision acceptée), mais si jamais : on ne retente rien
    // sans une intention canonique réelle à propager (§76 : jamais inventer).
    if (current === "unknown") continue;
    const watched = current === "watched";

    if (parsed.mediaType === "movie") {
      await pushMovieWatchedToPlex(user, parsed.tmdbId, watched).catch(() => {});
    } else {
      await pushEpisodesWatchedToPlex(user, [{ tmdbId: parsed.tmdbId, season: parsed.seasonNumber!, episode: parsed.episodeNumber! }], watched).catch(() => {});
    }
  }
}
