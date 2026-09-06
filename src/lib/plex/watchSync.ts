import { loadPlexConfig } from "./store";
import { getAccountHistory, batchTmdbIds, getLocalAccounts, getPlexAccount, getPlexHomeUsers } from "./client";
import { saveWatchStatus, getWatchStatus, type RecentWatch } from "./watchStore";
import { recordSearchLog } from "@/lib/diagnostic/searchLog";
import { refreshLegacyUserContext } from "@/lib/userContext/bootstrap";
import { recordUserContextEvent } from "@/lib/userContext/ingest";
import type { User } from "@/lib/auth/types";

/**
 * Read this user's own watch state directly from Plex.
 *
 * Previously scanned each account's own library sections/episode lists
 * using THEIR OWN plexToken (or the admin token + X-Plex-Profile for a
 * Home-managed user), relying on `viewCount` in the response to know what
 * they'd watched. Confirmed live and against Plex's own documented
 * behavior: `viewCount` on those endpoints always reflects the SERVER
 * OWNER's own view state, no matter which valid account's token
 * authenticates the request — several friend accounts, each carrying a
 * genuinely distinct plexId and token (verified), all came back with the
 * exact same counts as the admin. Not a Movviz identity bug — a real Plex
 * API limitation on that endpoint.
 *
 * Now uses Plex's session-history endpoint instead
 * (`getAccountHistory`/`/status/sessions/history/all`), which DOES track
 * per-account viewing — but only when queried with the admin/owner token
 * and filtered by `accountID`, never the target account's own token. Works
 * identically for friend accounts and Home-managed profiles alike (no more
 * two separate code paths), keyed purely by the account's Plex id.
 *
 * Every internal Plex call still fails silently in client.ts, so a
 * transient network/auth hiccup previously looked identical to "watched
 * nothing" — this function now treats an empty history result as "couldn't
 * reach this account's Plex data" and never overwrites whatever was
 * already saved, and every attempt — success or failure — logs a line to
 * the diagnostic log (Réglages → Journaux) tagged `plex.watchSync`.
 */
export async function syncUserWatchStatus(user: User) {
  const cfg = loadPlexConfig();
  if (!cfg.hostname || !cfg.adminToken) return;

  // Bug fix (confirmed live — "chaque profil doit être indépendant"):
  // `plexManagedUserId` is set by the admin's "assign a Plex Home profile"
  // flow (PlexSettings.tsx → /api/plex/assign-profile) for a Movviz account
  // that isn't its own separate Plex.tv login — it never HAD a `plexId` of
  // its own. This function only ever read `plexId`, so every Home-managed
  // profile silently never synced at all (this branch returned immediately,
  // no error, no log) — their "regardé" state simply never populated from
  // Plex. Both fields are the same kind of value (a numeric Plex account id,
  // confirmed via getPlexHomeUsers/PlexSettings.tsx assigning `homeUsers[].id`
  // straight into `plexManagedUserId`), so either one works here.
  const rawAccountId = user.plexId ?? user.plexManagedUserId;
  const cloudAccountId = rawAccountId ? Number(rawAccountId) : null;
  if (cloudAccountId == null || Number.isNaN(cloudAccountId)) return;

  // accountID is in the PMS-local id space, not the plex.tv id space.  It is
  // tempting to use the cloud id for external friends, but that only happens
  // to work on some servers.  Resolve every profile through the local account
  // table, otherwise a coincidental id can import somebody else's history.
  // Privacy wins over a best-effort sync: without an exact identity match we
  // leave this Movviz profile untouched.
  const isOwner = !!user.plexToken && user.plexToken === cfg.adminToken;
  const isHomeManaged = !!user.plexManagedUserId;
  const plexUsername = isOwner
    ? (await getPlexAccount(cfg.clientId, cfg.adminToken))?.username ?? null
    : isHomeManaged
      ? (await getPlexHomeUsers(cfg.adminToken)).find((h) => h.id === user.plexManagedUserId)?.title ?? null
      : user.plexToken
        ? (await getPlexAccount(cfg.clientId, user.plexToken))?.username ?? null
        : null;
  const match = plexUsername
    ? (await getLocalAccounts(cfg, cfg.adminToken)).find((a) => a.name.trim().toLocaleLowerCase() === plexUsername.trim().toLocaleLowerCase())
    : undefined;
  if (!match) {
    recordSearchLog(
      "warn",
      "plex.watchSync",
      `${user.username} (plexId:${cloudAccountId}): profil Plex non résolu de façon certaine — aucune vue Plex importée, données Movviz conservées.`
    );
    return;
  }
  const accountId = match.id;

  try {
    const historyResult = await getAccountHistory(cfg, cfg.adminToken, accountId);
    const history = historyResult.entries;

    if (history.length === 0) {
      const previous = getWatchStatus(user.id);
      const rejected = historyResult.rejectedForeignEntries + historyResult.rejectedUnattributedEntries;
      // A response containing another account's events is positive evidence
      // of a Plex-side scope failure.  Do NOT clear the aggregate status:
      // it also contains views made locally in Movviz and has no source bit
      // on legacy rows.  Ignoring this import is the only safe operation.
      if (rejected > 0) {
        recordSearchLog(
          "warn",
          "plex.watchSync",
          `${user.username} (plexId:${accountId}): ${rejected} événement(s) Plex non attribuables/rejeté(s) — import ignoré, données de ce profil Movviz conservées.`
        );
        return;
      }
      recordSearchLog(
        "warn",
        "plex.watchSync",
        `${user.username} (plexId:${accountId}): aucun historique Plex retourné — sync ignorée, données précédentes conservées (${previous ? `${previous.movies.length} films / ${previous.episodes.length} épisodes` : "aucune donnée existante"})`
      );
      return;
    }

    const movieRatingKeys = [...new Set(history.filter((h) => h.type === "movie").map((h) => h.ratingKey))];
    const episodeEntries = history.filter((h) => h.type === "episode" && h.grandparentRatingKey);
    const showRatingKeys = [...new Set(episodeEntries.map((h) => h.grandparentRatingKey!))];

    const [movieInfo, showInfo] = await Promise.all([
      batchTmdbIds(cfg, cfg.adminToken, movieRatingKeys),
      batchTmdbIds(cfg, cfg.adminToken, showRatingKeys),
    ]);

    const movies = [
      ...new Set(
        movieRatingKeys
          .map((k) => movieInfo.get(k)?.tmdbId)
          .filter((id): id is number => id != null)
      ),
    ];

    const episodeMap = new Map<string, { tmdbId: number; season: number; episode: number }>();
    for (const e of episodeEntries) {
      const tmdbId = showInfo.get(e.grandparentRatingKey!)?.tmdbId;
      if (tmdbId == null || e.season == null || e.episode == null) continue;
      episodeMap.set(`${tmdbId}.${e.season}.${e.episode}`, { tmdbId, season: e.season, episode: e.episode });
    }
    const episodes = [...episodeMap.values()];

    // "Quoi + quand" : recent keeps the last watched entries with their real
    // timestamps from Plex history (newest first), merged with any direct
    // Movviz playback entries so nothing previously recorded is lost.
    const plexRecent: RecentWatch[] = history
      .map((h): RecentWatch | null => {
        if (h.type === "movie") {
          const tmdbId = movieInfo.get(h.ratingKey)?.tmdbId;
          if (tmdbId == null || !h.viewedAt) return null;
          return { tmdbId, type: "movie", title: h.title ?? "", at: h.viewedAt };
        }
        if (h.type === "episode" && h.grandparentRatingKey) {
          const tmdbId = showInfo.get(h.grandparentRatingKey)?.tmdbId;
          if (tmdbId == null || !h.viewedAt) return null;
          return { tmdbId, type: "series", title: h.grandparentTitle ?? "", at: h.viewedAt };
        }
        return null;
      })
      .filter((r): r is RecentWatch => r != null);

    // The timeline is append-only and timestamped at its real Plex event
    // time. This is what lets a Plex view from yesterday sit correctly
    // between Movviz views from two days ago and today on every client.
    for (const h of history) {
      if (!h.viewedAt) continue;
      if (h.type === "movie") {
        const tmdbId = movieInfo.get(h.ratingKey)?.tmdbId;
        if (tmdbId == null) continue;
        recordUserContextEvent({ userId: user.id, eventType: "watched_marked", source: "plex_history", sourceEventId: `plex:${accountId}:${h.ratingKey}:${h.viewedAt}`, tmdbId, mediaType: "movie", title: h.title ?? null, ratingKey: h.ratingKey, occurredAt: h.viewedAt });
      } else if (h.grandparentRatingKey) {
        const tmdbId = showInfo.get(h.grandparentRatingKey)?.tmdbId;
        if (tmdbId == null || h.season == null || h.episode == null) continue;
        recordUserContextEvent({ userId: user.id, eventType: "watched_marked", source: "plex_history", sourceEventId: `plex:${accountId}:${h.ratingKey}:${h.viewedAt}`, tmdbId, mediaType: "episode", title: h.title ?? h.grandparentTitle ?? null, ratingKey: h.ratingKey, seasonNumber: h.season, episodeNumber: h.episode, occurredAt: h.viewedAt });
      }
    }

    const previous = getWatchStatus(user.id);
    const merged = new Map<string, RecentWatch>();
    for (const r of [...(previous?.recent ?? []), ...plexRecent]) {
      const key = `${r.tmdbId}.${r.type}`;
      const prior = merged.get(key);
      if (!prior || r.at > prior.at) merged.set(key, r);
    }
    const recent = [...merged.values()].sort((a, b) => b.at - a.at).slice(0, 30);

    // Plex is an optional peer, never a replacement for Movviz. Its history
    // has no reliable "unwatched" tombstone, so importing it must only add
    // known views and must never erase a newer local view.
    const mergedMovies = [...new Set([...(previous?.movies ?? []), ...movies])];
    const episodeKey = (e: { tmdbId: number; season: number; episode: number }) => `${e.tmdbId}.${e.season}.${e.episode}`;
    const mergedEpisodes = [...new Map([...(previous?.episodes ?? []), ...episodes].map((e) => [episodeKey(e), e])).values()];
    saveWatchStatus({ userId: user.id, movies: mergedMovies, episodes: mergedEpisodes, recent, updatedAt: Date.now() });
    // saveWatchStatus() only writes the legacy JSON store; it never touches
    // the unified Context Engine (unlike setWatchedMovies/setWatchedEpisodes).
    // Force an immediate mirror so the AI's SQL-backed context reflects a
    // real-time Plex sync right away instead of waiting up to 5 minutes for
    // the next lazy refreshLegacyUserContext() call from buildUsageProfile().
    refreshLegacyUserContext(user.id, true);
    // Bug fix ("0 épisode(s) vu(s)" confirmed live for every synced account
    // while movies worked fine): rejectedUnattributedEntries and
    // rejectedMalformedEpisodeEntries were both computed by getAccountHistory
    // but never surfaced here — a systematic drop of every episode-typed
    // history entry looked identical to "this user genuinely watched zero
    // episodes". Both counters, plus one raw sample of a dropped episode
    // entry, are now visible so the actual cause (this Plex server's history
    // endpoint not populating accountID/parentIndex/index the way expected)
    // can be read straight from the log instead of guessed at.
    const rejectionParts = [
      historyResult.rejectedForeignEntries ? `${historyResult.rejectedForeignEntries} autre(s) compte(s) rejeté(s)` : null,
      historyResult.rejectedUnattributedEntries ? `${historyResult.rejectedUnattributedEntries} sans accountID rejeté(s)` : null,
      historyResult.rejectedMalformedEpisodeEntries ? `${historyResult.rejectedMalformedEpisodeEntries} épisode(s) mal formé(s) rejeté(s)` : null,
    ].filter((p): p is string => p != null);
    // Unconditional (not just "if rejected > 0" like the parts above): the
    // only way to tell "Plex sent zero episode events for this account" from
    // "Plex sent some, they all got filtered downstream" — see
    // totalEpisodeTypeSeen's own comment in client.ts.
    recordSearchLog(
      "info",
      "plex.watchSync",
      `${user.username} (plexId:${accountId}): synchronisé — ${movies.length} film(s) vu(s), ${episodes.length} épisode(s) vu(s), ${recent.length} entrée(s) récente(s) datée(s) (${history.length} événement(s) vérifié(s), ${historyResult.totalEpisodeTypeSeen} événement(s) épisode brut(s) reçu(s) de Plex${rejectionParts.length ? `, ${rejectionParts.join(", ")}` : ""})`
    );
    if (historyResult.sampleMalformedEpisode) {
      recordSearchLog(
        "warn",
        "plex.watchSync",
        `${user.username}: exemple d'épisode rejeté (champs bruts Plex) — ${JSON.stringify(historyResult.sampleMalformedEpisode)}`
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "erreur inconnue";
    recordSearchLog(
      "error",
      "plex.watchSync",
      `${user.username} (plexId:${accountId}): échec de synchronisation — ${msg} — données précédentes conservées`
    );
  }
}

type WatchSyncGate = Map<string, { at: number; promise: Promise<void> }>;

function syncGate(): WatchSyncGate {
  const root = globalThis as typeof globalThis & { __movvizWatchSyncGate?: WatchSyncGate };
  return (root.__movvizWatchSyncGate ??= new Map());
}

/**
 * Freshness gate for interactive clients.  The scheduler remains the
 * background safety net, but opening Movviz now pulls the current Plex
 * profile immediately.  The gate is keyed by Movviz user id — never by a
 * shared Plex server — so two profiles can neither wait on nor receive each
 * other's state.
 */
export async function syncUserWatchStatusIfDue(user: User, minIntervalMs = 30_000): Promise<void> {
  const gate = syncGate();
  const current = gate.get(user.id);
  const now = Date.now();
  if (current && now - current.at < minIntervalMs) return current.promise;
  const promise = syncUserWatchStatus(user).catch(() => undefined);
  gate.set(user.id, { at: now, promise });
  await promise;
}
