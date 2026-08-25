import { getWatchStatus } from "@/lib/plex/watchStore";
import { getAllRatings } from "@/lib/ai/tasteProfile";
import { loadMovies, loadSeries } from "@/lib/library/store";
import { getMovie, getSeries, getMovieRecommendations, getTvRecommendations } from "@/lib/metadata/tmdb";
import { buildTasteVector } from "@/lib/ai/contrastiveProfile";
import { getCachedMoodProfile, getOrAnalyzeMoodProfile, moodSimilarity } from "@/lib/ai/titleAnalysis";
import { loadAiConfig } from "@/lib/ai/store";
import { filterSuggestable } from "@/lib/metadata/suggestable";
import { mapWithConcurrency } from "@/lib/concurrency";
import type { MetaSearchResult } from "@/lib/metadata/types";

/**
 * "Because you watched/liked X" — a Discover row anchored on the single
 * title the user is most engaged with (not a blend of many seeds, unlike
 * getRecommendations() in engine.ts), going deeper than flat TMDb genre
 * matching the way the user asked for ("parce que vous avez regardé Solo
 * Leveling -> d'autre manga du genre, plus profond dans le style"). See
 * docs/netflix-personalization-research.md for the Netflix reference this
 * was modeled on (reformulated, never copied) and the full architecture
 * audit this module builds directly on top of.
 */

export type BecauseVerb = "watched" | "liked";

export interface AnchorSelection {
  tmdbId: number;
  title: string;
  verb: BecauseVerb;
}

export interface BecauseYouWatchedRow {
  key: string;
  results: MetaSearchResult[];
  meta: { anchorTmdbId: number; anchorTitle: string; verb: BecauseVerb };
}

const MOOD_CANDIDATE_LIMIT = 8;
const MOOD_ANALYSIS_CONCURRENCY = 3;
const MOOD_BUDGET_MS = 4000;
const ANCHOR_SCORE_WEIGHT = 0.4;

/**
 * Series: the tmdbId with the most watched episodes — a real frequency
 * signal, unlike movies (getWatchStatus only tracks watched/not-watched for
 * those, see docs/netflix-personalization-research.md §5.a). Ties broken by
 * the most recent `recent` entry, then lowest tmdbId — deterministic, never
 * Math.random(). Even a single watched episode of a single series is
 * already a usable signal (same policy documented in engine.ts's own
 * "même un seul titre vu... graine réelle" comment) — no minimum-count gate.
 */
function pickSeriesAnchor(userId: string): AnchorSelection | null {
  const status = getWatchStatus(userId);
  if (!status || status.episodes.length === 0) return null;

  const counts = new Map<number, number>();
  for (const ep of status.episodes) counts.set(ep.tmdbId, (counts.get(ep.tmdbId) ?? 0) + 1);
  const maxCount = Math.max(...counts.values());
  const tied = [...counts.keys()].filter((id) => counts.get(id) === maxCount);

  let winner: number;
  if (tied.length === 1) {
    winner = tied[0];
  } else {
    const recentIndex = new Map((status.recent ?? []).map((r, i) => [r.tmdbId, i]));
    winner = tied
      .slice()
      .sort((a, b) => {
        const ra = recentIndex.get(a) ?? Infinity;
        const rb = recentIndex.get(b) ?? Infinity;
        if (ra !== rb) return ra - rb;
        return a - b;
      })[0];
  }

  const recentTitle = status.recent?.find((r) => r.tmdbId === winner)?.title;
  const title = recentTitle ?? loadSeries().find((s) => s.tmdbId === winner)?.title;
  if (!title) return null;
  return { tmdbId: winner, title, verb: "watched" };
}

/**
 * Movies: explicit rating >=4 (the strongest, most deliberate signal — an
 * "inferred" rating never promotes to "liked") beats plain watch history;
 * otherwise the most recently watched movie; otherwise the last movie ever
 * recorded as watched. No signal at all -> null, no row (never forced).
 */
function pickMovieAnchor(userId: string): AnchorSelection | null {
  const explicitLiked = getAllRatings(userId)
    .filter((r) => r.type === "movie" && r.source === "explicit" && r.rating >= 4)
    .sort((a, b) => (b.rating - a.rating) || (b.updatedAt - a.updatedAt))[0];
  if (explicitLiked) return { tmdbId: explicitLiked.tmdbId, title: explicitLiked.title, verb: "liked" };

  const status = getWatchStatus(userId);
  if (!status) return null;

  const recentMovie = status.recent?.find((r) => r.type === "movie");
  if (recentMovie) return { tmdbId: recentMovie.tmdbId, title: recentMovie.title, verb: "watched" };

  const lastWatchedId = status.movies[status.movies.length - 1];
  if (lastWatchedId === undefined) return null;
  const title = loadMovies().find((m) => m.tmdbId === lastWatchedId)?.title;
  if (!title) return null;
  return { tmdbId: lastWatchedId, title, verb: "watched" };
}

export function pickAnchor(userId: string, type: "movie" | "series"): AnchorSelection | null {
  if (!userId) return null;
  return type === "series" ? pickSeriesAnchor(userId) : pickMovieAnchor(userId);
}

function timeout(ms: number): Promise<"timeout"> {
  return new Promise((resolve) => setTimeout(() => resolve("timeout"), ms));
}

/**
 * Cheap base rank (rating + recency + the user's general cache-only taste
 * term — identical mechanism to getRecommendations() in engine.ts:65-83),
 * then a bounded "deepen" pass on only the top candidates: analyze the
 * anchor's mood (or reuse its cache) and up to MOOD_CANDIDATE_LIMIT
 * candidates, and re-rank by similarity to the ANCHOR specifically — this
 * is the actual "deeper than genre, matches this exact title's style" part.
 * Raced against a hard time budget so a cold cache never delays the row
 * beyond MOOD_BUDGET_MS: on timeout the base rank ships as-is and the
 * analysis keeps running in the background, landing in the permanent global
 * mood cache regardless — the next load for this same anchor is instant and
 * already deepened (same self-amortizing property as the rest of the Mood
 * Engine).
 */
async function rankCandidates(
  userId: string,
  type: "movie" | "series",
  anchor: AnchorSelection,
  raw: MetaSearchResult[],
  excluded: Set<number>
): Promise<MetaSearchResult[]> {
  const filtered = filterSuggestable(raw.filter((c) => c.tmdbId !== anchor.tmdbId && !excluded.has(c.tmdbId)));
  if (filtered.length === 0) return filtered;

  const tasteVector = buildTasteVector(userId);
  const scored = filtered.map((item) => {
    let taste = 0;
    if (tasteVector) {
      const mood = getCachedMoodProfile(type, item.tmdbId)?.categories;
      if (mood) {
        taste = (moodSimilarity(tasteVector.liked, mood) - moodSimilarity(tasteVector.disliked, mood)) * tasteVector.confidence;
      }
    }
    const score =
      (Math.min(item.rating ?? 0, 10) / 10) * 0.5
      + (Math.min(Math.max((item.year ?? 2000) - 2000, 0), 30) / 30) * 0.2
      + Math.max(0, taste) * 0.3;
    return { item, score };
  });
  scored.sort((a, b) => b.score - a.score);

  const config = loadAiConfig();
  if (!config.enabled) return scored.map((s) => s.item);

  const top = scored.slice(0, MOOD_CANDIDATE_LIMIT);
  const deepen = async (): Promise<Map<number, number> | null> => {
    const anchorDetail = type === "movie" ? await getMovie(anchor.tmdbId) : await getSeries(anchor.tmdbId);
    if (!anchorDetail) return null;
    const anchorProfile = await getOrAnalyzeMoodProfile(config, type, anchor.tmdbId, anchor.title, anchorDetail.overview, anchorDetail.genres);
    if (!anchorProfile) return null;

    const bonuses = new Map<number, number>();
    await mapWithConcurrency(top, MOOD_ANALYSIS_CONCURRENCY, async ({ item }) => {
      const profile = await getOrAnalyzeMoodProfile(config, type, item.tmdbId, item.title, item.overview);
      if (profile) bonuses.set(item.tmdbId, moodSimilarity(anchorProfile.categories, profile.categories));
    });
    return bonuses;
  };

  // deepen() keeps running after a timeout loss (see doc comment above) — a
  // bare Promise.race never attaches a handler to the losing side, so any
  // eventual rejection would surface as an unhandled rejection. Every piece
  // deepen() calls is documented to degrade to null/never throw, but this
  // catch is a hard guarantee regardless, not a bet on that holding forever.
  const deepenPromise = deepen().catch(() => null);
  const outcome = await Promise.race([deepenPromise, timeout(MOOD_BUDGET_MS)]);
  if (outcome === "timeout" || outcome === null) return scored.map((s) => s.item);

  const reranked = top
    .map((s) => ({ ...s, score: s.score + (outcome.get(s.item.tmdbId) ?? 0) * ANCHOR_SCORE_WEIGHT }))
    .sort((a, b) => b.score - a.score);
  return [...reranked, ...scored.slice(MOOD_CANDIDATE_LIMIT)].map((s) => s.item);
}

function excludedTmdbIds(type: "movie" | "series", userId: string): Set<number> {
  const owned = (type === "movie" ? loadMovies() : loadSeries()).map((m) => m.tmdbId);
  const status = getWatchStatus(userId);
  const watched = type === "movie" ? (status?.movies ?? []) : status?.episodes.map((e) => e.tmdbId) ?? [];
  return new Set([...owned, ...watched]);
}

// No originCountries param: getMovieRecommendations/getTvRecommendations
// (TMDb's per-title /recommendations endpoint) has no region filter to pass
// one to, unlike the discoverByFilters/browseCategory-backed rows elsewhere
// in this file's callers.
export async function buildBecauseYouWatchedRow(
  userId: string,
  type: "movie" | "series"
): Promise<BecauseYouWatchedRow | null> {
  const anchor = pickAnchor(userId, type);
  if (!anchor) return null;

  const excluded = excludedTmdbIds(type, userId);
  excluded.add(anchor.tmdbId);
  const raw = type === "movie" ? await getMovieRecommendations(anchor.tmdbId) : await getTvRecommendations(anchor.tmdbId);
  const results = await rankCandidates(userId, type, anchor, raw.results, excluded);
  if (results.length === 0) return null;

  return {
    key: `becauseYouWatched:${anchor.tmdbId}`,
    results,
    meta: { anchorTmdbId: anchor.tmdbId, anchorTitle: anchor.title, verb: anchor.verb },
  };
}

/** Resolves the anchor from an id embedded in a "voir tout" row key, not a
 *  fresh pickAnchor() — the id is authoritative for which row this is; a
 *  changed signal since the initial load must never desync the paginated
 *  content from its own label. */
async function resolveAnchorMeta(
  userId: string,
  type: "movie" | "series",
  anchorTmdbId: number
): Promise<AnchorSelection | null> {
  const explicit = getAllRatings(userId).find((r) => r.type === type && r.tmdbId === anchorTmdbId && r.source === "explicit" && r.rating >= 4);
  if (explicit) return { tmdbId: anchorTmdbId, title: explicit.title, verb: "liked" };

  const status = getWatchStatus(userId);
  const recent = status?.recent?.find((r) => r.tmdbId === anchorTmdbId && r.type === type);
  if (recent) return { tmdbId: anchorTmdbId, title: recent.title, verb: "watched" };

  const libraryTitle = (type === "movie" ? loadMovies() : loadSeries()).find((m) => m.tmdbId === anchorTmdbId)?.title;
  if (libraryTitle) return { tmdbId: anchorTmdbId, title: libraryTitle, verb: "watched" };

  const detail = type === "movie" ? await getMovie(anchorTmdbId) : await getSeries(anchorTmdbId);
  if (!detail) return null;
  return { tmdbId: anchorTmdbId, title: detail.title, verb: "watched" };
}

export async function getBecauseYouWatchedPage(
  userId: string,
  type: "movie" | "series",
  anchorTmdbId: number,
  page: number
): Promise<{ results: MetaSearchResult[]; page: number; totalPages: number; meta: { anchorTmdbId: number; anchorTitle: string; verb: BecauseVerb } } | null> {
  const anchor = await resolveAnchorMeta(userId, type, anchorTmdbId);
  if (!anchor) return null;

  const excluded = excludedTmdbIds(type, userId);
  excluded.add(anchor.tmdbId);
  const raw = type === "movie" ? await getMovieRecommendations(anchorTmdbId, page) : await getTvRecommendations(anchorTmdbId, page);
  const results = await rankCandidates(userId, type, anchor, raw.results, excluded);

  return { results, page: raw.page, totalPages: raw.totalPages, meta: { anchorTmdbId, anchorTitle: anchor.title, verb: anchor.verb } };
}
