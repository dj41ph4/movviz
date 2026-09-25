import { getWatchStatus } from "@/lib/plex/watchStore";
import { getCanonicalWatchStatus } from "@/lib/userContext/watchBridge";
import { getAllRatings } from "@/lib/ai/tasteProfile";
import { getFeedback } from "@/lib/ai/tasteProfile";
import { getWatchedTitles } from "@/lib/recommender/watchedTitles";

export type SeedReason =
  | "explicit_high_rating"
  | "liked_feedback"
  | "series_engagement"
  | "recent_watch"
  | "plain_watch";

export interface Seed {
  tmdbId: number;
  weight: number; // 0..1 — how strongly this title represents the user's taste
  reasons: SeedReason[];
}

const RECENT_WATCH_WINDOW_MS = 45 * 24 * 60 * 60 * 1000; // 45 jours
// Un titre revu/apprécié à fond représente le goût de l'utilisateur bien
// mieux qu'un titre juste coché "vu" — un moteur qui pondère les deux
// pareil (état actuel avant cette refonte) laisse un film détesté-mais-vu
// peser aussi lourd qu'un 5★ dans le choix des candidats.
const MAX_SEEDS = 20;

/**
 * Construit les seeds pondérés d'un utilisateur : chaque titre vu ne
 * représente pas également le goût. Une note explicite forte, un like, ou
 * un fort engagement série pèsent plus qu'un simple visionnage. Une note
 * basse (<=2) ou un 👎 explicite exclut le titre comme seed (il reste
 * cependant exclu des candidats via la logique d'exclusion existante,
 * indépendamment de cette fonction).
 */
export function buildSeeds(userId: string, type: "movie" | "series"): Seed[] {
  const canonical = getCanonicalWatchStatus(userId);
  const legacy = getWatchStatus(userId);
  // Canonical is source of truth (§69) – JSON fallback only when engine unavailable
  const movies = canonical ? canonical.movies : (legacy?.movies ?? []);
  const episodes = canonical ? canonical.episodes : (legacy?.episodes ?? []);
  const movieWatchedAt: Record<string, number> | undefined = legacy?.movieWatchedAt;
  const hasAny = movies.length > 0 || episodes.length > 0;
  if (!hasAny && !legacy) return [];
  if (!hasAny && legacy && movies.length === 0 && episodes.length === 0) return [];

  const ratings = new Map(
    getAllRatings(userId)
      .filter((r) => r.type === type && r.active !== false)
      .map((r) => [r.tmdbId, r] as const)
  );
  const feedback = new Map(
    getFeedback(userId)
      .filter((f) => f.type === type)
      .map((f) => [f.tmdbId, f] as const)
  );

  const now = Date.now();

  const seriesEpisodeCount = new Map<number, number>();
  const seriesLatestAt = new Map<number, number>();
  if (type === "series") {
    for (const ep of episodes) {
      seriesEpisodeCount.set(ep.tmdbId, (seriesEpisodeCount.get(ep.tmdbId) ?? 0) + 1);
      if (ep.at) {
        const cur = seriesLatestAt.get(ep.tmdbId) ?? 0;
        if (ep.at > cur) seriesLatestAt.set(ep.tmdbId, ep.at);
      }
    }
  }

  // + historique de lecture : un titre lancé sans être marqué « vu » dit
  // aussi quelque chose des goûts (watchedTitles.ts).
  const allWatched = getWatchedTitles(userId, type);
  const watchedIds: number[] = [...new Set([
    ...(type === "movie" ? movies : [...seriesEpisodeCount.keys()]),
    ...allWatched.keys(),
  ])];

  const seeds: Seed[] = [];
  for (const tmdbId of watchedIds) {
    const rating = ratings.get(tmdbId);
    const vote = feedback.get(tmdbId);

    // Négatif explicite -> jamais un seed positif, quel que soit le reste.
    if (rating && rating.rating <= 2) continue;
    if (vote && !vote.liked) continue;

    const reasons: SeedReason[] = [];
    let weight = 0.3; // "simplement vu" — base faible mais non nulle

    if (rating) {
      // rating 3 -> +0.1, rating 4 -> +0.3, rating 5 -> +0.5, pondéré par confiance.
      const ratingBoost = Math.max(0, (rating.rating - 2) / 3) * 0.5 * rating.confidence;
      if (rating.rating >= 4) reasons.push("explicit_high_rating");
      weight += ratingBoost;
    }
    if (vote?.liked) {
      weight += 0.25;
      reasons.push("liked_feedback");
    }
    if (type === "series") {
      const episodes = seriesEpisodeCount.get(tmdbId) ?? 0;
      // Saturant : quelques épisodes suffisent à distinguer une série
      // suivie d'une série simplement démarrée, sans qu'une série de 200
      // épisodes n'écrase tout le reste.
      const engagement = Math.min(0.25, (Math.log1p(episodes) / Math.log1p(15)) * 0.25);
      if (episodes >= 3) reasons.push("series_engagement");
      weight += engagement;
    }
    // Recency boost – films via movieWatchedAt, séries via latest episode at (§62, §86)
    let watchedAt: number | undefined;
    if (type === "movie") watchedAt = movieWatchedAt?.[String(tmdbId)];
    else watchedAt = seriesLatestAt.get(tmdbId);
    watchedAt = watchedAt || allWatched.get(tmdbId) || undefined;
    if (watchedAt && now - watchedAt <= RECENT_WATCH_WINDOW_MS) {
      weight += 0.1;
      reasons.push("recent_watch");
    }
    if (reasons.length === 0) reasons.push("plain_watch");

    seeds.push({ tmdbId, weight: Math.min(1, weight), reasons });
  }

  return seeds.sort((a, b) => b.weight - a.weight).slice(0, MAX_SEEDS);
}
