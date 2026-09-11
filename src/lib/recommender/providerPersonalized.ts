import { discoverByFilters, getDetail, getGenres } from "@/lib/metadata/tmdb";
import { getWatchStatus } from "@/lib/plex/watchStore";
import { loadMovies, loadSeries } from "@/lib/library/store";
import { buildTasteVector } from "@/lib/ai/contrastiveProfile";
import { getCachedMoodProfile, getOrAnalyzeMoodProfile, moodSimilarity } from "@/lib/ai/titleAnalysis";
import { loadAiConfig } from "@/lib/ai/store";
import { filterSuggestable } from "@/lib/metadata/suggestable";
import { getFeedback } from "@/lib/ai/tasteProfile";
import { getComputedGenreTraits, getFavoriteKeywords, matchGenreAffinity, matchKeywordAffinity } from "@/lib/userContext/taste";
import { STREAMING_PLATFORMS } from "@/lib/metadata/curated";
import { getCache } from "@/lib/cache/registry";
import { mapWithConcurrency } from "@/lib/concurrency";
import type { MetaSearchResult } from "@/lib/metadata/types";
import { audienceSignal } from "@/lib/recommender/audienceSignal";

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

const ROW_SIZE = 20;
// A provider's TMDb catalog is mostly titles nobody has ever analyzed before
// (obscure regional content, one-off specials — unlike getRecommendations()'s
// pool, which is TMDb's own "similar to what you watched" and so overlaps
// heavily with titles the mood cache already has from other features). Left
// cache-only, `taste` silently stayed 0 for nearly every candidate, so
// ranking collapsed to rating+affinity — not wrong, but far less precise
// than it should be. Same bounded "deepen" pattern as becauseYouWatched.ts:
// analyze the user's own taste-vector similarity for just the top few
// candidates, raced against a hard budget so a cold cache never delays the
// row; on timeout the cheap rank ships as-is and analysis keeps running in
// the background for next time.
const MOOD_CANDIDATE_LIMIT = 12;
const MOOD_ANALYSIS_CONCURRENCY = 3;
const MOOD_BUDGET_MS = 4000;
const DEEPEN_WEIGHT = 0.3;
// Une seule page TMDb (20 titres) ne représente pas le catalogue d'une
// plateforme : c'était la cause directe des rails Suggestions/Nouveautés
// presque identiques. On démarre sur un bassin large, puis « Voir tout »
// continue de l'étendre sans plafond artificiel bas.
const INITIAL_SUGGESTION_POOL_SIZE = ROW_SIZE * 8;
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
  /** Première page strictement chronologique : réservée au rail Nouveautés,
   * afin qu'une suggestion ne réaffiche pas les mêmes titres récents. */
  newestIds: number[];
  popularPage: number;
  datePage: number;
  popularExhausted: boolean;
  dateExhausted: boolean;
}

function poolCache() {
  // v2 invalide les petits bassins construits par la première implémentation.
  return getCache("providerSuggestedPool:v2", POOL_CACHE_TTL);
}

/** Never cache an empty first load. `discoverByFilters` deliberately
 * degrades upstream TMDb failures to an empty page; treating that as an
 * exhausted catalog poisoned Netflix/Prime/Disney rows for the whole TTL. */
export function providerPoolIsCacheable(state: Pick<PoolState, "results">): boolean {
  return state.results.length > 0;
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
    newestIds: [],
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
      if (nextPage === 1) state.newestIds = res.results.map((item) => item.tmdbId);
      state.results = dedupe([...state.results, ...res.results]);
    }
  }

  if (providerPoolIsCacheable(state)) {
    poolCache().set(cacheKey, state);
  } else {
    // Restore a retryable state for the next request. An actually empty
    // provider page is cheap to recheck; a 45-minute false empty is not.
    state.popularPage = 0;
    state.datePage = 0;
    state.popularExhausted = false;
    state.dateExhausted = false;
  }
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
function timeout(ms: number): Promise<"timeout"> {
  return new Promise((resolve) => setTimeout(() => resolve("timeout"), ms));
}

function sortScored<T extends { affinity: number; composite: number }>(scored: T[]): T[] {
  return scored.sort((a, b) => b.composite - a.composite);
}

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
  const favoriteKeywords = await getFavoriteKeywords(userId);
  const keywordDetails = new Map<number, string[]>();
  await mapWithConcurrency(filtered.slice(0, 40), 5, async (item) => {
    const detail = await getDetail(type, item.tmdbId).catch(() => null);
    if (detail) keywordDetails.set(item.tmdbId, detail.keywords);
  });

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
    const keywordAffinity = matchKeywordAffinity(keywordDetails.get(item.tmdbId) ?? [], favoriteKeywords);
    const composite =
      Math.max(0, taste) * 0.25
      + Math.min(affinity, 1) * 0.22
      + keywordAffinity * 0.18
      + audienceSignal(item) * 0.25
      + (Math.min(item.rating ?? 0, 10) / 10) * 0.15;
    return { item, affinity, composite };
  });

  sortScored(scored);

  const config = loadAiConfig();
  if (!config.enabled || !tasteVector) return scored.map((s) => s.item);

  // Cheap pass above already used whatever mood profiles happened to be
  // cached; this deepens just the current top slice — analyzing the whole
  // pool would be slow and mostly wasted on candidates that will never
  // reach the visible row anyway.
  const top = scored.slice(0, MOOD_CANDIDATE_LIMIT);
  const deepen = async (): Promise<Map<number, number> | null> => {
    const bonuses = new Map<number, number>();
    await mapWithConcurrency(top, MOOD_ANALYSIS_CONCURRENCY, async ({ item }) => {
      const profile = await getOrAnalyzeMoodProfile(config, type, item.tmdbId, item.title, item.overview);
      if (!profile) return;
      const t = (moodSimilarity(tasteVector.liked, profile.categories) - moodSimilarity(tasteVector.disliked, profile.categories)) * tasteVector.confidence;
      bonuses.set(item.tmdbId, Math.max(0, t));
    });
    return bonuses;
  };

  // Same hard-guarantee reasoning as becauseYouWatched.ts: deepen() keeps
  // running after a timeout loss (landing in the permanent mood cache for
  // next time), so this catch guards against an unhandled rejection on the
  // losing side of the race rather than betting deepen() never throws.
  const deepenPromise = deepen().catch(() => null);
  const outcome = await Promise.race([deepenPromise, timeout(MOOD_BUDGET_MS)]);
  if (outcome === "timeout" || outcome === null) return scored.map((s) => s.item);

  const reranked = sortScored(
    top.map((s) => ({ ...s, composite: s.composite + (outcome.get(s.item.tmdbId) ?? 0) * DEEPEN_WEIGHT }))
  );
  return [...reranked, ...scored.slice(MOOD_CANDIDATE_LIMIT)].map((s) => s.item);
}

export async function buildProviderSuggestedRow(
  userId: string,
  type: "movie" | "series",
  providerId: number,
  originCountries?: string[]
): Promise<ProviderPersonalizedRow | null> {
  const providerName = providerNameFor(providerId);
  if (!providerName) return null;

  // Un vrai échantillon de catalogue plutôt que les deux premières pages :
  // le classement a assez de matière pour refléter les goûts, y compris sur
  // des titres plus anciens. Les nouveautés de la première page date sont
  // volontairement réservées à leur propre rail.
  const pool = await ensurePool(type, providerId, originCountries, INITIAL_SUGGESTION_POOL_SIZE);
  if (pool.results.length === 0) return null;

  const excluded = excludedTmdbIds(type, userId);
  const newestIds = new Set(pool.newestIds);
  const ranked = await rankForUser(userId, type, pool.results.filter((item) => !newestIds.has(item.tmdbId)), excluded);
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
  originCountries?: string[],
  sort: "personalized" | "rating" | "date" = "personalized"
): Promise<{ results: MetaSearchResult[]; page: number; totalPages: number; meta: { providerId: number; providerName: string } } | null> {
  const providerName = providerNameFor(providerId);
  if (!providerName) return null;
  if (sort === "date") return getProviderNewPage(userId, type, providerId, page, originCountries);

  const pool = await ensurePool(type, providerId, originCountries, page * ROW_SIZE);
  const excluded = excludedTmdbIds(type, userId);
  const newestIds = new Set(pool.newestIds);
  const candidates = pool.results.filter((item) => !newestIds.has(item.tmdbId));
  const ranked = sort === "rating"
    ? filterSuggestable(candidates.filter((item) => !excluded.has(item.tmdbId))).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.popularity ?? 0) - (a.popularity ?? 0))
    : await rankForUser(userId, type, candidates, excluded);

  const exhausted = pool.popularExhausted && pool.dateExhausted;
  const totalPages = exhausted ? Math.max(1, Math.ceil(ranked.length / ROW_SIZE)) : page + 1;
  const results = ranked.slice((page - 1) * ROW_SIZE, page * ROW_SIZE);
  return { results, page, totalPages, meta: { providerId, providerName } };
}
