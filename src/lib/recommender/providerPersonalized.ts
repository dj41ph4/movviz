import { discoverByFilters, getGenres } from "@/lib/metadata/tmdb";
import { getWatchStatus } from "@/lib/plex/watchStore";
import { loadMovies, loadSeries } from "@/lib/library/store";
import { buildTasteVector } from "@/lib/ai/contrastiveProfile";
import { getCachedMoodProfile, moodSimilarity } from "@/lib/ai/titleAnalysis";
import { filterSuggestable } from "@/lib/metadata/suggestable";
import { getFeedback } from "@/lib/ai/tasteProfile";
import { getComputedGenreTraits, matchGenreAffinity } from "@/lib/userContext/taste";
import { STREAMING_PLATFORMS } from "@/lib/metadata/curated";
import { getCache } from "@/lib/cache/registry";
import type { MetaSearchResult } from "@/lib/metadata/types";

/**
 * "Nouveautés {provider} pour vous" — provider candidates ranked by the same
 * user-taste machinery as getRecommendations()/becauseYouWatched.ts (genre
 * affinity, mood/taste vector, rating, recency), never a separate
 * per-provider engine. The provider only supplies the candidate pool; Movviz
 * decides the order. See docs/movviz-personalization plan for the design
 * this implements ("les plateformes fournissent les candidats, Movviz
 * connaît l'utilisateur, le moteur existant décide de l'ordre").
 */

export interface ProviderPersonalizedRow {
  key: string;
  results: MetaSearchResult[];
  meta: { providerId: number; providerName: string };
}

// V1 scope only (see plan §28) — Netflix, Disney+, Prime Video, in the
// order they should render. Extending to Apple TV+/Max/Crunchyroll later is
// just adding an id here; no new logic. IDs are the SAME curated list the
// "Plateformes" tile row already uses (src/lib/metadata/curated.ts) — never
// a second provider mapping.
const PERSONALIZED_PROVIDER_IDS = [8, 337, 119];

export const PERSONALIZED_DISCOVER_PROVIDERS = PERSONALIZED_PROVIDER_IDS
  .map((id) => STREAMING_PLATFORMS.find((p) => p.id === id))
  .filter((p): p is { id: number; name: string } => !!p);

const GENRE_AFFINITY_PROMOTE_THRESHOLD = 0.95;
// Shared across every user — the provider catalog itself doesn't depend on
// who's asking, so 5 profiles browsing the same night make ONE set of TMDb
// calls, not five (plan §17, cache 1).
const POOL_CACHE_TTL = 45 * 60 * 1000;
// Per-user ranked order — cheap to recompute but no reason to on every SWR
// refresh (plan §17, cache 2).
const RANK_CACHE_TTL = 15 * 60 * 1000;
const ROW_SIZE = 20;

function poolCache() {
  return getCache("providerPersonalizedPool", POOL_CACHE_TTL);
}
function rankCache() {
  return getCache("providerPersonalizedRanked", RANK_CACHE_TTL);
}

export function providerNameFor(providerId: number): string | null {
  return STREAMING_PLATFORMS.find((p) => p.id === providerId)?.name ?? null;
}

function dedupe(list: MetaSearchResult[]): MetaSearchResult[] {
  const seen = new Set<number>();
  const out: MetaSearchResult[] = [];
  for (const item of list) {
    if (seen.has(item.tmdbId)) continue;
    seen.add(item.tmdbId);
    out.push(item);
  }
  return out;
}

// Same exclusion policy as becauseYouWatched.ts/engine.ts — owned, watched,
// and 👎'd titles never enter a "for you" rail. A film genuinely already
// watched is excluded; a series is only excluded per the existing
// completion logic baked into getWatchStatus (a single watched episode does
// NOT mark the whole series consumed — see [[feedback-dto-audit-against-server]]
// era lesson, still respected here since this reuses the same store).
function excludedTmdbIds(type: "movie" | "series", userId: string): Set<number> {
  const owned = (type === "movie" ? loadMovies() : loadSeries()).map((m) => m.tmdbId);
  const status = getWatchStatus(userId);
  const watched = type === "movie" ? (status?.movies ?? []) : [...new Set((status?.episodes ?? []).map((e) => e.tmdbId))];
  const disliked = getFeedback(userId).filter((f) => !f.liked && f.type === type).map((f) => f.tmdbId);
  return new Set([...owned, ...watched, ...disliked]);
}

/**
 * Candidate pool for one provider — "recent/current on this provider", not
 * a precise catalog-entry date (TMDb can't say when Netflix actually added a
 * title, only what's currently available there — see plan §5, deliberately
 * not solved with a scraper). Popularity + recency sort, 2 pages max, so
 * this stays cheap even before the per-user rank cache kicks in (plan §18).
 */
async function getProviderCandidatePool(
  type: "movie" | "series",
  providerId: number,
  originCountries?: string[]
): Promise<MetaSearchResult[]> {
  const cacheKey = `${type}:${providerId}:${(originCountries ?? []).join(",")}`;
  const cached = poolCache().get<MetaSearchResult[]>(cacheKey);
  if (cached) return cached;

  const dateSort = type === "movie" ? "primary_release_date.desc" : "first_air_date.desc";
  const [popular1, popular2, recent1] = await Promise.all([
    discoverByFilters(type, { watchProvider: String(providerId), sort: "popularity.desc", originCountries }, 1),
    discoverByFilters(type, { watchProvider: String(providerId), sort: "popularity.desc", originCountries }, 2),
    discoverByFilters(type, { watchProvider: String(providerId), sort: dateSort, originCountries }, 1),
  ]);
  const merged = dedupe([...popular1.results, ...recent1.results, ...popular2.results]);
  poolCache().set(cacheKey, merged);
  return merged;
}

/**
 * Rank candidates against the user's existing taste signals — identical
 * ingredients to getRecommendations() (engine.ts): cache-only mood/taste
 * vector (never triggers a fresh LLM analysis, plan §10) plus the SQL
 * context engine's genre affinity, which promotes a candidate ahead of pure
 * popularity when the match is strong (plan §9 — "le ranking fournisseur
 * est secondaire").
 */
async function rankForUser(
  userId: string,
  type: "movie" | "series",
  candidates: MetaSearchResult[],
  excluded: Set<number>
): Promise<MetaSearchResult[]> {
  const filtered = filterSuggestable(candidates.filter((c) => !excluded.has(c.tmdbId)));
  if (filtered.length === 0) return filtered;

  const tasteVector = buildTasteVector(userId);
  const genreTraits = new Map(getComputedGenreTraits(userId, 10).map((t) => [t.key, t] as const));
  const genreNameById = genreTraits.size ? new Map((await getGenres(type)).map((g) => [g.id, g.name] as const)) : new Map<number, string>();

  const scored = filtered.map((item) => {
    let taste = 0;
    if (tasteVector) {
      const mood = getCachedMoodProfile(type, item.tmdbId)?.categories;
      if (mood) {
        taste = (moodSimilarity(tasteVector.liked, mood) - moodSimilarity(tasteVector.disliked, mood)) * tasteVector.confidence;
      }
    }
    const genreNames = genreNameById.size
      ? (item.genreIds ?? []).map((id) => genreNameById.get(id)).filter((n): n is string => !!n)
      : [];
    const affinity = genreNames.length ? matchGenreAffinity(genreNames, genreTraits) : 0;
    const composite =
      (Math.min(item.rating ?? 0, 10) / 10) * 0.35
      + (Math.min(Math.max((item.year ?? 2000) - 2000, 0), 30) / 30) * 0.25
      + Math.max(0, taste) * 0.25
      + Math.min(affinity, 1) * 0.15;
    return { item, affinity, composite };
  });

  scored.sort((a, b) => {
    const aPromoted = a.affinity >= GENRE_AFFINITY_PROMOTE_THRESHOLD;
    const bPromoted = b.affinity >= GENRE_AFFINITY_PROMOTE_THRESHOLD;
    if (aPromoted !== bPromoted) return aPromoted ? -1 : 1;
    return b.composite - a.composite;
  });
  return scored.map((s) => s.item);
}

async function getRankedForUser(
  userId: string,
  type: "movie" | "series",
  providerId: number,
  originCountries?: string[]
): Promise<MetaSearchResult[]> {
  const pool = await getProviderCandidatePool(type, providerId, originCountries);
  if (pool.length === 0) return [];

  const cacheKey = `${userId || ""}:${type}:${providerId}`;
  const cached = rankCache().get<MetaSearchResult[]>(cacheKey);
  if (cached) return cached;

  const excluded = excludedTmdbIds(type, userId);
  const ranked = await rankForUser(userId, type, pool, excluded);
  rankCache().set(cacheKey, ranked);
  return ranked;
}

export async function buildProviderPersonalizedRow(
  userId: string,
  type: "movie" | "series",
  providerId: number,
  originCountries?: string[]
): Promise<ProviderPersonalizedRow | null> {
  const providerName = providerNameFor(providerId);
  if (!providerName) return null;

  const ranked = await getRankedForUser(userId, type, providerId, originCountries);
  if (ranked.length === 0) return null;

  return {
    key: `providerPersonalized:${providerId}`,
    results: ranked.slice(0, ROW_SIZE),
    meta: { providerId, providerName },
  };
}

/** One row per V1 provider (plan §28) — home-page callers just spread this
 *  into their rows array, exactly like any other editorial extra. */
export async function buildProviderPersonalizedRows(
  userId: string,
  type: "movie" | "series",
  originCountries?: string[]
): Promise<ProviderPersonalizedRow[]> {
  const rows = await Promise.all(
    PERSONALIZED_DISCOVER_PROVIDERS.map((p) =>
      buildProviderPersonalizedRow(userId, type, p.id, originCountries).catch(() => null)
    )
  );
  return rows.filter((r): r is ProviderPersonalizedRow => r !== null);
}

/** "Voir tout" pagination counterpart — same ranked pool as the home row,
 *  sliced client-side rather than re-querying TMDb per page (plan §16: the
 *  ranking must never regress to raw TMDb order on page 2+). */
export async function getProviderPersonalizedPage(
  userId: string,
  type: "movie" | "series",
  providerId: number,
  page: number,
  originCountries?: string[]
): Promise<{ results: MetaSearchResult[]; page: number; totalPages: number; meta: { providerId: number; providerName: string } } | null> {
  const providerName = providerNameFor(providerId);
  if (!providerName) return null;

  const ranked = await getRankedForUser(userId, type, providerId, originCountries);
  const totalPages = Math.max(1, Math.ceil(ranked.length / ROW_SIZE));
  const results = ranked.slice((page - 1) * ROW_SIZE, page * ROW_SIZE);
  return { results, page, totalPages, meta: { providerId, providerName } };
}
