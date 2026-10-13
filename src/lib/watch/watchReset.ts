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
  removePlexFromContinueWatching,
  setPlexWatched,
} from "@/lib/plex/client";
import { mapWithConcurrency } from "@/lib/concurrency";
import { recordSearchLog } from "@/lib/diagnostic/searchLog";
import { emitWatchChanged } from "@/lib/events/watchEvents";
import { getWatchReset, setWatchReset, updateWatchResetPlex, type WatchResetRecord } from "./resetFloor";

/**
 * « Effacer la lecture » (profil) : remet le visionnage d'UN profil à zéro,
 * dans Movviz puis dans Plex. Chaque étape est bornée à ce profil :
 * - Movviz : projection JSON, état canonique SQLite, historique de lecture et
 *   positions de reprise de ce seul userId ;
 * - Plex : uniquement avec le jeton serveur PERSONNEL de ce profil
 *   (resolvePlexUserContext, jamais de repli sur le jeton propriétaire). Un
 *   unscrobble Plex ne change que le compte qui l'envoie : les vues des
 *   autres comptes du serveur ne peuvent pas être touchées.
 * Notes, watchlist et goûts IA restent : ce ne sont pas du visionnage.
 */

/** Mot à retaper (ou à valider) à la 2e confirmation, sur tous les clients. */
export const WATCH_RESET_CONFIRM_WORD = "EFFACER";

const g = globalThis as typeof globalThis & { __movvizWatchResetRunning?: Set<string> };
function running(): Set<string> {
  return (g.__movvizWatchResetRunning ??= new Set());
}

export interface WatchResetResult {
  resetAt: number;
  cleared: { movies: number; episodes: number; history: number; resumes: number };
  plex: NonNullable<WatchResetRecord["plex"]>;
}

interface PlexTargets {
  shows: Set<string>;
  items: Set<string>;
}

/** Clés Plex que Movviz connaît pour ce profil, relevées AVANT l'effacement
 *  local : elles complètent le scan Plex (un compte partagé peut lire des
 *  compteurs de vues peu fiables dans les listes de bibliothèque). */
function localPlexTargets(userId: string): PlexTargets {
  const targets: PlexTargets = { shows: new Set(), items: new Set() };
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
    const context = resetWatchContextForUser(user.id, resetAt);
    emitWatchChanged(user.id);
    const cleared = {
      movies: json.moviesCleared,
      episodes: json.episodesCleared,
      history: context?.events ?? 0,
      resumes,
    };
    recordSearchLog("info", "watch.reset", `${user.username} — lecture effacée dans Movviz : ${cleared.movies} film(s), ${cleared.episodes} épisode(s), ${cleared.history} événement(s) d'historique, ${cleared.resumes} reprise(s)`);

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
  for (const section of sections) {
    if (section.type === "movie") {
      const found = await getSectionWatchActivity(cfg, token, section.key);
      if (!found) { scanIncomplete = true; continue; }
      for (const item of found) items.add(item.ratingKey);
    } else {
      const found = await getSectionWatchActivity(cfg, token, section.key);
      if (!found) scanIncomplete = true;
      for (const item of found ?? []) shows.add(item.ratingKey);
      // Épisodes commencés mais pas finis : l'unscrobble de la série ne
      // remet pas toujours leur position à zéro.
      const started = await getSectionWatchActivity(cfg, token, section.key, 4);
      if (!started) scanIncomplete = true;
      for (const item of started ?? []) if (item.viewOffset > 0) items.add(item.ratingKey);
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
  const state = remaining === 0 && failed === 0 && verified && !scanIncomplete ? "done" : "partial";
  const reasons: string[] = [];
  if (failed > 0) reasons.push(`${failed} demande(s) refusée(s) par Plex`);
  if (remaining > 0) reasons.push(`${remaining} titre(s) encore marqué(s) vu ou commencé(s) dans Plex`);
  if (scanIncomplete) reasons.push("une partie de la bibliothèque Plex n'a pas pu être lue");
  if (!verified) reasons.push("la vérification Plex n'a pas pu aboutir");
  recordSearchLog(
    state === "done" ? "info" : "warn",
    "watch.reset",
    `${user.username} (${ctx.authSource}) — lecture effacée dans Plex : ${cleared} titre(s)/série(s), ${continueWatching.size} reprise(s)${reasons.length ? ` ; ${reasons.join(", ")}` : ""}`,
  );
  return {
    state,
    reason: reasons.length ? `${reasons.join(", ")}. Les anciennes vues Plex ne reviendront pas dans Movviz.` : undefined,
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
