import type { User } from "@/lib/auth/types";
import { getWatchStatus, clearWatchStatusForUser } from "@/lib/plex/watchStore";
import { listAllPlaybackProgress, resetPlaybackForUser } from "@/lib/playback/progressStore";
import { resetWatchContextForUser } from "@/lib/userContext/watchReset";
import { getCanonicalWatchStatus } from "@/lib/userContext/watchBridge";
import { getMovieByTmdbId, getSeriesByTmdbId } from "@/lib/library/store";
import { getAllObservedStates } from "@/lib/plex/plexObservedState";
import { loadPlexConfig } from "@/lib/plex/store";
import { resolvePlexUserContext } from "@/lib/plex/plexUserContext";
import {
  batchPlexViewState,
  getLibrarySections,
  getPlexOnDeck,
  getSectionWatchActivity,
  getPlexWatchlist,
  removePlexFromContinueWatching,
  removePlexWatchlistItem,
  setPlexRating,
  setPlexWatched,
  type PlexWatchActivityItem,
} from "@/lib/plex/client";
import { clearWatchlistForUser } from "@/lib/watchlist/store";
import { getAllRatings, resetAiProfileForUser } from "@/lib/ai/tasteProfile";
import { clearAiMemoryForUser } from "@/lib/ai/memory";
import { clearAiSession } from "@/lib/ai/store";
import { invalidateTasteCachesForUser } from "@/lib/userContext/taste";
import { mapWithConcurrency } from "@/lib/concurrency";
import { recordSearchLog } from "@/lib/diagnostic/searchLog";
import { emitWatchChanged } from "@/lib/events/watchEvents";
import { getWatchReset, setWatchReset, updateWatchResetPlex, type WatchResetRecord } from "./resetFloor";

/**
 * « Effacer la lecture » (profil) : le profil redevient vierge, dans Movviz
 * puis dans Plex. Le compte lui-même (nom, photo, mot de passe, réglages)
 * reste. Chaque étape est bornée à ce profil :
 * - Movviz : vus, reprises, historique, liste, notes, goûts et mémoire IA,
 *   conversation avec l'assistant, de ce seul userId ;
 * - Plex : uniquement avec le jeton serveur PERSONNEL de ce profil
 *   (resolvePlexUserContext, jamais de repli sur le jeton propriétaire). Un
 *   unscrobble Plex ne change que le compte qui l'envoie : les vues des
 *   autres comptes du serveur ne peuvent pas être touchées. Pareil pour les
 *   notes (/:/rate) et la watchlist Plex (jeton de compte de ce profil).
 */

/** Mot à retaper (ou à valider) à la 2e confirmation, sur tous les clients. */
export const WATCH_RESET_CONFIRM_WORD = "EFFACER";

const g = globalThis as typeof globalThis & { __movvizWatchResetRunning?: Set<string> };
function running(): Set<string> {
  return (g.__movvizWatchResetRunning ??= new Set());
}

export interface WatchResetResult {
  resetAt: number;
  cleared: { movies: number; episodes: number; history: number; resumes: number; watchlist: number; ratings: number };
  plex: NonNullable<WatchResetRecord["plex"]>;
}

interface PlexTargets {
  shows: Set<string>;
  items: Set<string>;
  /** Titres notés dans Movviz : la note Plex correspondante est effacée. */
  rated: Set<string>;
  /** Clés Discover des éléments de la liste, à retirer de la watchlist Plex. */
  watchlist: Set<string>;
}

/** Clés Plex que Movviz connaît pour ce profil, relevées AVANT l'effacement
 *  local : elles complètent le scan Plex (un compte partagé peut lire des
 *  compteurs de vues peu fiables dans les listes de bibliothèque). */
function localPlexTargets(userId: string): PlexTargets {
  const targets: PlexTargets = { shows: new Set(), items: new Set(), rated: new Set(), watchlist: new Set() };
  const canonical = getCanonicalWatchStatus(userId);
  const legacy = getWatchStatus(userId);
  const movies = new Set([...(canonical?.movies ?? []), ...(legacy?.movies ?? [])]);
  const series = new Set([...(canonical?.episodes ?? []), ...(legacy?.episodes ?? [])].map((e) => e.tmdbId));
  for (const tmdbId of movies) {
    const key = getMovieByTmdbId(tmdbId)?.plexRatingKey;
    if (key) targets.items.add(key);
  }
  for (const tmdbId of series) {
    const key = getSeriesByTmdbId(tmdbId)?.plexRatingKey;
    if (key) targets.shows.add(key);
  }
  for (const rating of getAllRatings(userId)) {
    const key = (rating.type === "movie" ? getMovieByTmdbId(rating.tmdbId) : getSeriesByTmdbId(rating.tmdbId))?.plexRatingKey;
    if (key) targets.rated.add(key);
  }
  for (const progress of listAllPlaybackProgress(userId)) {
    if (/^\d+$/.test(progress.ratingKey)) targets.items.add(progress.ratingKey);
  }
  for (const observed of getAllObservedStates()) {
    if (observed.userId === userId && (observed.state === "WATCHED" || (observed.viewOffset ?? 0) > 0)) targets.items.add(observed.ratingKey);
  }
  return targets;
}

export function isWatchResetRunning(userId: string): boolean {
  return running().has(userId);
}

/**
 * Efface tout de suite le visionnage Movviz du profil, puis lance l'effacement
 * Plex en arrière-plan (un gros serveur peut demander plusieurs minutes :
 * les applis TV/mobile n'attendent pas autant une réponse HTTP). Le résultat
 * Plex se lit ensuite avec getWatchResetStatus.
 */
export function startWatchReset(user: User): WatchResetResult & { done: Promise<void> } {
  if (running().has(user.id)) throw new Error("already_running");
  running().add(user.id);
  try {
    const resetAt = Date.now();
    const targets = localPlexTargets(user.id);
    // La date de remise à zéro est posée en PREMIER : une synchro Plex qui
    // tournerait pendant l'effacement ne peut plus rien réintroduire.
    setWatchReset(user.id, { resetAt, plex: { state: "running" } });

    const json = clearWatchStatusForUser(user.id);
    const resumes = resetPlaybackForUser(user.id);
    const removedFromList = clearWatchlistForUser(user.id, resetAt);
    for (const item of removedFromList) if (item.plexDiscoverRatingKey) targets.watchlist.add(item.plexDiscoverRatingKey);
    const ai = resetAiProfileForUser(user.id);
    clearAiMemoryForUser(user.id);
    clearAiSession(user.id);
    const context = resetWatchContextForUser(user.id, resetAt);
    invalidateTasteCachesForUser(user.id);
    emitWatchChanged(user.id);
    const cleared = {
      movies: json.moviesCleared,
      episodes: json.episodesCleared,
      history: context?.events ?? 0,
      resumes,
      watchlist: removedFromList.length,
      ratings: ai.ratings,
    };
    recordSearchLog("info", "watch.reset", `${user.username} — profil remis à zéro dans Movviz : ${cleared.movies} film(s) et ${cleared.episodes} épisode(s) vus, ${cleared.resumes} reprise(s), ${cleared.watchlist} élément(s) de liste, ${cleared.ratings} note(s), ${ai.feedback} avis et ${ai.facts} fait(s) IA, ${cleared.history} événement(s) d'historique`);

    const done = resetPlexWatchState(user, targets)
      .catch((error): NonNullable<WatchResetRecord["plex"]> => ({
        state: "failed",
        reason: error instanceof Error ? error.message : String(error),
        finishedAt: Date.now(),
      }))
      .then((plex) => {
        updateWatchResetPlex(user.id, plex);
        // Plex vient peut-être de changer « Reprendre » : les appareils relisent.
        emitWatchChanged(user.id);
      })
      .finally(() => running().delete(user.id));
    return { resetAt, cleared, plex: { state: "running" }, done };
  } catch (error) {
    running().delete(user.id);
    throw error;
  }
}

async function resetPlexWatchState(user: User, local: PlexTargets): Promise<NonNullable<WatchResetRecord["plex"]>> {
  const cfg = loadPlexConfig();
  if (!cfg.hostname) return { state: "skipped", reason: "Plex n'est pas configuré sur ce serveur.", finishedAt: Date.now() };
  const ctxRes = await resolvePlexUserContext(user.id);
  if (!ctxRes.ok) {
    return { state: "skipped", reason: "Ce profil n'est pas relié à un compte Plex utilisable : rien n'a été touché dans Plex.", finishedAt: Date.now() };
  }
  const { ctx } = ctxRes;
  const token = ctx.serverToken;
  // Garde-fou : seul le propriétaire du serveur peut agir avec le jeton
  // propriétaire. Sinon on s'arrête plutôt que d'effacer les vues d'un autre.
  if (ctx.authSource !== "owner" && cfg.adminToken && token === cfg.adminToken) {
    return { state: "skipped", reason: "Jeton Plex personnel introuvable pour ce profil : rien n'a été touché dans Plex.", finishedAt: Date.now() };
  }

  const shows = new Set(local.shows);
  const items = new Set(local.items);
  const continueWatching = new Set<string>();
  let scanIncomplete = false;

  const sections = await getLibrarySections(cfg, token);
  if (sections.length === 0) scanIncomplete = true;
  const rated = new Set(local.rated);
  const watchedOrStarted = (item: PlexWatchActivityItem) => item.viewCount > 0 || item.viewOffset > 0 || item.viewedLeafCount > 0;
  for (const section of sections) {
    const found = await getSectionWatchActivity(cfg, token, section.key);
    if (!found) scanIncomplete = true;
    for (const item of found ?? []) {
      if (item.userRating > 0) rated.add(item.ratingKey);
      if (watchedOrStarted(item)) (section.type === "movie" ? items : shows).add(item.ratingKey);
    }
    if (section.type !== "movie") {
      // Épisodes commencés ou notés : l'unscrobble de la série ne remet pas
      // toujours leur position à zéro, et ne touche pas leur note.
      const episodes = await getSectionWatchActivity(cfg, token, section.key, 4);
      if (!episodes) scanIncomplete = true;
      for (const item of episodes ?? []) {
        if (item.viewOffset > 0) items.add(item.ratingKey);
        if (item.userRating > 0) rated.add(item.ratingKey);
      }
    }
  }
  for (const deck of await getPlexOnDeck(cfg, token)) {
    continueWatching.add(deck.ratingKey);
    if (deck.viewOffset > 0) items.add(deck.ratingKey);
  }

  let failed = 0;
  // Unscrobble au niveau série : un seul appel remet tous ses épisodes à
  // « non vu » pour CE compte.
  const unscrobble = async (ratingKey: string) => {
    if (!(await setPlexWatched(cfg, token, ratingKey, false))) failed++;
  };
  await mapWithConcurrency([...shows], 4, unscrobble);
  await mapWithConcurrency([...items], 4, unscrobble);
  await mapWithConcurrency([...continueWatching], 4, async (ratingKey) => {
    if (!(await removePlexFromContinueWatching(cfg, token, ratingKey))) failed++;
  });
  await mapWithConcurrency([...rated], 4, async (ratingKey) => {
    if (!(await setPlexRating(cfg, token, ratingKey, 0))) failed++;
  });
  // Watchlist Plex : propre au compte plex.tv, donc seulement avec le jeton
  // de compte de CE profil (un profil géré sans jeton à lui est sauté).
  let watchlistSkipped = false;
  const ownAccountToken = user.plexToken && (ctx.authSource === "owner" || user.plexToken !== cfg.adminToken) ? user.plexToken : null;
  if (ownAccountToken) {
    const watchlist = new Set(local.watchlist);
    for (const item of await getPlexWatchlist(ownAccountToken)) if (item.discoverRatingKey) watchlist.add(item.discoverRatingKey);
    await mapWithConcurrency([...watchlist], 4, async (key) => {
      if (!(await removePlexWatchlistItem(ownAccountToken, key))) failed++;
    });
  } else if (local.watchlist.size > 0) {
    watchlistSkipped = true;
  }

  // Vérification sur l'état PERSONNEL (endpoint metadata, par compte).
  let remaining = 0;
  let verified = true;
  try {
    const keys = [...new Set([...shows, ...items])];
    const states = await batchPlexViewState(cfg, token, keys);
    for (const state of states.values()) {
      if (state.viewCount > 0 || (state.viewOffset ?? 0) > 0 || (state.viewedLeafCount ?? 0) > 0) remaining++;
    }
  } catch {
    verified = false;
  }
  const cleared = shows.size + items.size;
  const state = remaining === 0 && failed === 0 && verified && !scanIncomplete && !watchlistSkipped ? "done" : "partial";
  const reasons: string[] = [];
  if (failed > 0) reasons.push(`${failed} demande(s) refusée(s) par Plex`);
  if (remaining > 0) reasons.push(`${remaining} titre(s) encore marqué(s) vu ou commencé(s) dans Plex`);
  if (scanIncomplete) reasons.push("une partie de la bibliothèque Plex n'a pas pu être lue");
  if (!verified) reasons.push("la vérification Plex n'a pas pu aboutir");
  if (watchlistSkipped) reasons.push("la watchlist Plex de ce profil n'est pas accessible sans son propre compte Plex");
  recordSearchLog(
    state === "done" ? "info" : "warn",
    "watch.reset",
    `${user.username} (${ctx.authSource}) — profil remis à zéro dans Plex : ${cleared} titre(s)/série(s) vus, ${continueWatching.size} reprise(s), ${rated.size} note(s)${reasons.length ? ` ; ${reasons.join(", ")}` : ""}`,
  );
  return {
    state,
    reason: reasons.length ? `${reasons.join(", ")}. Les anciennes données Plex ne reviendront pas dans Movviz.` : undefined,
    cleared,
    remaining,
    finishedAt: Date.now(),
  };
}

export function getWatchResetStatus(userId: string): (WatchResetRecord & { running: boolean }) | null {
  const record = getWatchReset(userId);
  if (!record) return null;
  return { ...record, running: running().has(userId) };
}
