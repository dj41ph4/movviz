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
 * Two distinct rows per provider — never a per-provider engine, the provider
 * only supplies candidates, Movviz decides both what "new" means and what
 * "for you" means:
 *
 * - "Nouveautés {provider} pour vous" (`providerNew:{id}`) — strictly sorted
 *   by release/air date, most recent first. Nothing re-orders it: date IS
 *   the ranking. Paginates straight through TMDb's own pages, so it goes as
 *   deep as the real catalog does ("infinite slide").
 * - "Suggestion {provider} pour vous" (`providerSuggested:{id}`) — sorted by
 *   the same user-taste machinery as getRecommendations()/becauseYouWatched.ts
 *   (genre affinity, mood/taste vector, rating), release date given NO
 *   weight at all — an old title the user would love outranks a mediocre
 *   new one. Its candidate pool grows on demand as "Voir tout" is scrolled
 *   deeper (see ensurePool), rather than being capped at a fixed size.
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
const ROW_SIZE = 20;
// Safety valve on the "suggestion" pool growth — TMDb's own with_watch_providers
// catalogs run out eventually; this just stops us from hammering it forever
// on a pathological deep-scroll (200 pages/sort would be ~4000 raw titles).
const MAX_POOL_PAGES_PER_SORT = 25;
// Shared across every user — the provider catalog itself doesn't depend on
// who's asking, so 5 profiles browsing the same night grow ONE shared pool,
// not five (plan §17, cache 1).
const POOL_CACHE_TTL = 45 * 60 * 1000;

interface PoolState {
  results: MetaSearchResult[];
  popularPage: number;
  datePage: number;
  popularExhausted: boolean;
  dateExhausted: boolean;
}

function poolCache() {
  return getCache("providerSuggestedPool", POOL_CACHE_TTL);
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

function dateSortFor(type: "movie" | "series"): string {
  return type === "movie" ? "primary_release_date.desc" : "first_air_date.desc";
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

// ---------------------------------------------------------------------------
// "Nouveautés {provider} pour vous" — pure chronological, real TMDb pages.
// ---------------------------------------------------------------------------

export async function buildProviderNewRow(
  userId: string,
  type: "movie" | "series",
  providerId: number,
  originCountries?: string[]
): Promise<ProviderPersonalizedRow | null> {
  const providerName = providerNameFor(providerId);
  if (!providerName) return null;

  const excluded = excludedTmdbIds(type, userId);
  const page1 = await discoverByFilters(type, { watchProvider: String(providerId), sort: dateSortFor(type), originCountries }, 1);
  const results = filterSuggestable(page1.results.filter((c) => !excluded.has(c.tmdbId)));
  if (results.length === 0) return null;

  return { key: `providerNew:${providerId}`, results: results.slice(0, ROW_SIZE), meta: { providerId, providerName } };
}

/** "Voir tout" — one real TMDb page per requested page, in the same date
 *  order. Genuinely infinite: totalPages comes straight from TMDb, not a
 *  pre-fetched pool, so it goes exactly as deep as the provider's real
 *  catalog for this type/region. A page can come back with fewer than 20
 *  post-filter results — same accepted trade-off as the existing
 *  "upcoming"/"newSeries" rows elsewhere in this file's siblings. */
export async function getProviderNewPage(
  userId: string,
  type: "movie" | "series",
  providerId: number,
  page: number,
  originCountries?: string[]
): Promise<{ results: MetaSearchResult[]; page: number; totalPages: number; meta: { providerId: number; providerName: string } } | null> {
  const providerName = providerNameFor(providerId);
  if (!providerName) return null;

  const excluded = excludedTmdbIds(type, userId);
  const raw = await discoverByFilters(type, { watchProvider: String(providerId), sort: dateSortFor(type), originCountries }, page);
  const results = filterSuggestable(raw.results.filter((c) => !excluded.has(c.tmdbId)));
  return { results, page: raw.page, totalPages: raw.totalPages, meta: { providerId, providerName } };
}

// ---------------------------------------------------------------------------
// "Suggestion {provider} pour vous" — taste-ranked, release date irrelevant.
// ---------------------------------------------------------------------------

/**
 * Grows a shared candidate pool for one provider until it holds at least
 * `minCount` raw titles (or both sorts are exhausted) — alternating
 * popularity and date pages so the pool stays broad rather than exhausting
 * one sort before touching the other. Monotonic: a later call with a bigger
 * `minCount` only ever fetches the NEW pages it's missing, never re-fetches
 * what a previous call already merged in. This is what makes "Voir tout"
 * scroll deep without capping the pool at a fixed size up front (plan's
 * "infinite slide" — as far as the real catalog goes, not an artificial
 * page 5 wall).
 */
async function ensurePool(
  type: "movie" | "series",
  providerId: number,
  originCountries: string[] | undefined,
  minCount: number
): Promise<PoolState> {
  const cacheKey = `${type}:${providerId}:${(originCountries ?? []).join(",")}`;
  const state: PoolState = poolCache().get<PoolState>(cacheKey) ?? {
    results: [],
    popularPage: 0,
    datePage: 0,
    popularExhausted: false,
    dateExhausted: false,
  };

  const dateSort = dateSortFor(type);
  while (
    state.results.length < minCount
    && (!state.popularExhausted || !state.dateExhausted)
    && state.popularPage < MAX_POOL_PAGES_PER_SORT
    && state.datePage < MAX_POOL_PAGES_PER_SORT
  ) {
    if (!state.popularExhausted) {
      const nextPage = state.popularPage + 1;
      const res = await discoverByFilters(type, { watchProvider: String(providerId), sort: "popularity.desc", originCountries }, nextPage);
      state.popularPage = nextPage;
      if (res.results.length === 0 || nextPage >= res.totalPages) state.popularExhausted = true;
      state.results = dedupe([...state.results, ...res.results]);
    }
    if (state.results.length >= minCount) break;
    if (!state.dateExhausted) {
      const nextPage = state.datePage + 1;
      const res = await discoverByFilters(type, { watchProvider: String(providerId), sort: dateSort, originCountries }, nextPage);
      state.datePage = nextPage;
      if (res.results.length === 0 || nextPage >= res.totalPages) state.dateExhausted = true;
      state.results = dedupe([...state.results, ...res.results]);
    }
  }

  poolCache().set(cacheKey, state);
  return state;
}

/**
 * Rank candidates against the user's existing taste signals — identical
 * ingredients to getRecommendations() (engine.ts): cache-only mood/taste
 * vector (never triggers a fresh LLM analysis, plan §10) plus the SQL
 * context engine's genre affinity, which promotes a candidate ahead of pure
 * popularity when the match is strong (plan §9 — "le ranking fournisseur
 * est secondaire"). Deliberately no recency term at all: the user asked for
 * this row to ignore release date entirely ("peu importe le temps de
 * sortie") — that's the whole point of it existing separately from
 * "Nouveautés".
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
      (Math.min(item.rating ?? 0, 10) / 10) * 0.40
      + Math.max(0, taste) * 0.35
      + Math.min(affinity, 1) * 0.25;
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

export async function buildProviderSuggestedRow(
  userId: string,
  type: "movie" | "series",
  providerId: number,
  originCountries?: string[]
): Promise<ProviderPersonalizedRow | null> {
  const providerName = providerNameFor(providerId);
  if (!providerName) return null;

  // A bit more than one row's worth so ranking has real choice even on the
  // very first load.
  const pool = await ensurePool(type, providerId, originCountries, ROW_SIZE * 2);
  if (pool.results.length === 0) return null;

  const excluded = excludedTmdbIds(type, userId);
  const ranked = await rankForUser(userId, type, pool.results, excluded);
  if (ranked.length === 0) return null;

  return { key: `providerSuggested:${providerId}`, results: ranked.slice(0, ROW_SIZE), meta: { providerId, providerName } };
}

/** One "new" + one "suggested" row per V1 provider (plan §28, extended per
 *  user request into two rows instead of one) — home-page callers spread
 *  this into their rows array, exactly like any other editorial extra. */
export async function buildProviderPersonalizedRows(
  userId: string,
  type: "movie" | "series",
  originCountries?: string[]
): Promise<ProviderPersonalizedRow[]> {
  const rows = await Promise.all(
    PERSONALIZED_DISCOVER_PROVIDERS.flatMap((p) => [
      buildProviderSuggestedRow(userId, type, p.id, originCountries).catch(() => null),
      buildProviderNewRow(userId, type, p.id, originCountries).catch(() => null),
    ])
  );
  return rows.filter((r): r is ProviderPersonalizedRow => r !== null);
}

/** "Voir tout" pagination for the "suggestion" row — grows the shared pool
 *  (see ensurePool) to cover the requested page, then re-ranks it fresh
 *  every time (cheap: no LLM call, cache-only mood lookups, plan §10) rather
 *  than caching a stale ranked slice that could desync from a pool that's
 *  still growing underneath it. `totalPages` claims "one more" until the
 *  pool is actually exhausted, which is what lets the client's infinite
 *  scroll keep requesting deeper pages. */
export async function getProviderSuggestedPage(
  userId: string,
  type: "movie" | "series",
  providerId: number,
  page: number,
  originCountries?: string[]
): Promise<{ results: MetaSearchResult[]; page: number; totalPages: number; meta: { providerId: number; providerName: string } } | null> {
  const providerName = providerNameFor(providerId);
  if (!providerName) return null;

  const pool = await ensurePool(type, providerId, originCountries, page * ROW_SIZE);
  const excluded = excludedTmdbIds(type, userId);
  const ranked = await rankForUser(userId, type, pool.results, excluded);

  const exhausted = pool.popularExhausted && pool.dateExhausted;
  const totalPages = exhausted ? Math.max(1, Math.ceil(ranked.length / ROW_SIZE)) : page + 1;
  const results = ranked.slice((page - 1) * ROW_SIZE, page * ROW_SIZE);
  return { results, page, totalPages, meta: { providerId, providerName } };
}
