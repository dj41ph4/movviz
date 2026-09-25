import { getWatchStatus, recordWatched, setWatchedEpisodes, setWatchedMovies } from "@/lib/plex/watchStore";
import { knownEpisodes } from "@/lib/watch/aggregation";
import { getWatchedTitles } from "@/lib/recommender/watchedTitles";
import { getUserWatchHistory } from "@/lib/userContext/history";
import { loadMovies, loadSeries } from "@/lib/library/store";
import { invalidatePersonTraitCache } from "@/lib/userContext/taste";
import { triggerIncrementalContextIfDue } from "./contextBuilder";

export type SeenKey = `${"movie" | "series"}:${number}`;

/**
 * What the assistant must treat as « déjà vu » — the same definition as
 * « Sélection pour vous » (watchedTitles.ts: titles marked watched + the
 * whole playback history) plus the recent-watch log. A series counts as
 * seen as soon as the user started it: proposing a show they are already
 * watching (or dropped) is not a discovery. The old rule only excluded a
 * series once EVERY known episode was watched, so any ongoing show
 * (Chainsaw Man, Jujutsu Kaisen…) came back in every recommendation.
 */
export function getSeenKeys(userId: string): Set<SeenKey> {
  const keys = new Set<SeenKey>();
  for (const tmdbId of getWatchedTitles(userId, "movie").keys()) keys.add(`movie:${tmdbId}`);
  for (const tmdbId of getWatchedTitles(userId, "series").keys()) keys.add(`series:${tmdbId}`);
  for (const recent of getWatchStatus(userId)?.recent ?? []) keys.add(`${recent.type}:${recent.tmdbId}`);
  return keys;
}

/** Titles of everything seen, most recent first — handed to the model so a
 *  suggestion written in plain text (not only the recommendation cards,
 *  which the code filters itself) never proposes something already seen. */
export function getSeenTitles(userId: string, limit = 200): string[] {
  const titles = new Map<string, { title: string; at: number }>();
  const put = (key: string, title: string | null | undefined, at: number) => {
    if (!title) return;
    const prev = titles.get(key);
    if (!prev || at > prev.at) titles.set(key, { title, at });
  };
  try {
    // One query per type: the history is capped at 200 rows and counts every
    // episode, so a single query would bury the films under a few series.
    for (const mediaType of ["movie", "series"] as const) {
      for (const item of getUserWatchHistory({ userId, mediaType, limit: 200 })) put(`${item.mediaType}:${item.tmdbId}`, item.title, item.watchedAt);
    }
  } catch {
    /* historique indisponible */
  }
  for (const recent of getWatchStatus(userId)?.recent ?? []) put(`${recent.type}:${recent.tmdbId}`, recent.title, recent.at);
  const seen = getSeenKeys(userId);
  const movieTitles = new Map(loadMovies().map((m) => [m.tmdbId, m.title]));
  const seriesTitles = new Map(loadSeries().map((s) => [s.tmdbId, s.title]));
  for (const key of seen) {
    if (titles.has(key)) continue;
    const [type, id] = key.split(":");
    put(key, type === "movie" ? movieTitles.get(Number(id)) : seriesTitles.get(Number(id)), 0);
  }
  return [...titles.values()].sort((a, b) => b.at - a.at).slice(0, limit).map((t) => t.title);
}

/**
 * « Déjà vu » from the assistant (card button, « mets-le en vu », « j'ai
 * déjà tout vu »): a film is marked watched; a series has every episode the
 * library knows marked watched, and is always logged in the recent watches
 * so it is excluded even when it is not in the library.
 */
export function markSeen(userId: string, ref: { tmdbId: number; type: "movie" | "series"; title: string }): void {
  if (ref.type === "movie") {
    setWatchedMovies(userId, [ref.tmdbId], true, ref.title, undefined, "ai");
  } else {
    const episodes = knownEpisodes(ref.tmdbId).map((e) => ({ tmdbId: ref.tmdbId, season: e.season, episode: e.episode }));
    if (episodes.length) setWatchedEpisodes(userId, episodes, true, ref.title, "ai");
    else recordWatched(userId, { tmdbId: ref.tmdbId, type: "series", title: ref.title, at: Date.now() });
  }
  invalidatePersonTraitCache(userId);
  triggerIncrementalContextIfDue(userId).catch(() => {});
}
