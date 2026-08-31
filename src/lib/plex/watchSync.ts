import { loadPlexConfig } from "./store";
import { getAccountHistory, batchTmdbIds, getLocalAccounts, getPlexAccount, getPlexHomeUsers } from "./client";
import { saveWatchStatus, getWatchStatus, type RecentWatch } from "./watchStore";
import { recordSearchLog } from "@/lib/diagnostic/searchLog";
import { refreshLegacyUserContext } from "@/lib/userContext/bootstrap";
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

  // Bug fix (confirmed live via the diagnostic log — the owner and every
  // Home-managed profile got "aucun historique Plex retourné" on literally
  // every single sync cycle, while externally-shared friend accounts always
  // worked): getAccountHistory's accountID filter is keyed to the PMS's own
  // LOCAL accounts table (small sequential integers, owner conventionally
  // id 1), not to the plex.tv CLOUD id stored in plexId/plexManagedUserId.
  // Friends authenticate against the server with their own real plex.tv
  // token, so Plex happens to register them locally under that same id —
  // the owner and Home-managed profiles (PMS-local-only, no token of their
  // own) never do. Resolve the real local id by matching Plex username for
  // those two cases only; friends keep their already-correct cloud id.
  const isOwner = !!user.plexToken && user.plexToken === cfg.adminToken;
  const isHomeManaged = !!user.plexManagedUserId;
  let accountId = cloudAccountId;
  if (isOwner || isHomeManaged) {
    const plexUsername = isOwner
      ? (await getPlexAccount(cfg.clientId, cfg.adminToken))?.username ?? null
      : (await getPlexHomeUsers(cfg.adminToken)).find((h) => h.id === user.plexManagedUserId)?.title ?? null;
    const match = plexUsername
      ? (await getLocalAccounts(cfg, cfg.adminToken)).find((a) => a.name.toLowerCase() === plexUsername.toLowerCase())
      : undefined;
    // No match found: fall back to the (known-wrong) cloud id rather than
    // skip the sync outright — same "no history, keep previous data"
    // outcome as before for a case this fix doesn't cover yet, instead of
    // a new silent failure mode.
    if (match) accountId = match.id;
  }

  try {
    const historyResult = await getAccountHistory(cfg, cfg.adminToken, accountId);
    const history = historyResult.entries;

    if (history.length === 0) {
      const previous = getWatchStatus(user.id);
      const rejected = historyResult.rejectedForeignEntries + historyResult.rejectedUnattributedEntries;
      // A response containing only another account's events is positive
      // evidence of a Plex-side scope failure.  Clear the previously imported
      // state rather than leave the owner's watched history visible forever.
      // Local playback/reprise lives in progressStore and is not touched.
      if (rejected > 0 && previous) {
        saveWatchStatus({ userId: user.id, movies: [], episodes: [], recent: [], updatedAt: Date.now() });
        recordSearchLog(
          "warn",
          "plex.watchSync",
          `${user.username} (plexId:${accountId}): ${rejected} événement(s) Plex d'un autre compte rejeté(s) — état Plex importé vidé, progression Movviz conservée.`
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

    const previous = getWatchStatus(user.id);
    const merged = new Map<string, RecentWatch>();
    for (const r of [...(previous?.recent ?? []), ...plexRecent]) merged.set(`${r.tmdbId}.${r.type}`, r);
    const recent = [...merged.values()].sort((a, b) => b.at - a.at).slice(0, 30);

    saveWatchStatus({ userId: user.id, movies, episodes, recent, updatedAt: Date.now() });
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
    recordSearchLog(
      "info",
      "plex.watchSync",
      `${user.username} (plexId:${accountId}): synchronisé — ${movies.length} film(s) vu(s), ${episodes.length} épisode(s) vu(s), ${recent.length} entrée(s) récente(s) datée(s) (${history.length} événement(s) vérifié(s)${rejectionParts.length ? `, ${rejectionParts.join(", ")}` : ""})`
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
