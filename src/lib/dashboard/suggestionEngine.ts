/**
 * Dashboard Cinematic Hero — candidate selection + scoring. Explicitly not
 * an AI/ML system: a deterministic, explainable pipeline over data Movviz
 * already has (library, TMDb cache, Plex watch status, release calendar).
 *
 * Two separate concerns kept deliberately apart:
 * - POOLS decide WHICH candidates make the cut, in a fixed priority order
 *   (confirmed by the user: personalized suggestions first, everything else
 *   keeps its original order). `buildHeroCandidates` accumulates across
 *   pools until `targetCount` is reached — it never stops after a single
 *   pool that falls short (a brand-new install has nothing in pools 1-2,
 *   and must still fall through to library/discovery pools).
 * - SCORE explains WHY a candidate is shown, computed the same way
 *   regardless of originating pool, so "Pourquoi ce contenu ?" is never a
 *   black box — every candidate gets a full reasons list, matched or not.
 */

import { getRecommendations } from "@/lib/recommender/engine";
import { getWatchStatus } from "@/lib/plex/watchStore";
import { getStatusTransitions } from "@/lib/library/statusTransitions";
import { loadMovies, loadSeries } from "@/lib/library/store";
import { loadRequests } from "@/lib/requests/store";
import { getDetail, trending } from "@/lib/metadata/tmdb";
import { daysUntil } from "@/lib/library/releaseSchedule";
import { mapWithConcurrency } from "@/lib/concurrency";
import type { LibraryFile, LibraryMovie, LibrarySeries, LibraryStatus } from "@/lib/library/types";
import type { MetaDetail } from "@/lib/metadata/types";

export const HERO_POOL_IDS = [
  "personalized",
  "unwatchedLibrary",
  "recentlyAdded",
  "upcoming",
  "recentActivity",
  "discovery",
] as const;
export type HeroPoolId = (typeof HERO_POOL_IDS)[number];

export interface HeroCandidateRef {
  tmdbId: number;
  type: "movie" | "series";
  poolId: HeroPoolId;
  /** Library status at selection time, or null when the candidate isn't owned (pure TMDb suggestion/discovery). */
  libraryStatus: LibraryStatus | null;
  /** Days until release, when the pool already knows it (upcoming pool) — avoids recomputing after enrichment. */
  daysUntilRelease: number | null;
}

export interface SuggestionScore {
  genreMatch: number;
  directorMatch: number;
  actorMatch: number;
  requestBonus: number;
  ratingBonus: number;
  recencyBonus: number;
  availabilityBonus: number;
  qualityBonus: number;
  languageBonus: number;
  preferenceBonus: number;
  total: number;
  /**
   * Translation keys, never literal text — the reasons are rendered by the
   * dashboard UI via `t("dashboard.hero.reasons." + key, params)`, so a
   * German or Dutch interface sees a real translation instead of a French
   * string leaking out of the backend. `params` carries the one bit of
   * per-candidate detail (matched genre names) needed for interpolation.
   */
  reasons: { key: string; matched: boolean; params?: Record<string, string> }[];
}

export interface HeroSlide {
  poolId: HeroPoolId;
  libraryStatus: LibraryStatus | null;
  daysUntilRelease: number | null;
  /** Reuses the exact same MediaBadges/buildMediaBadgeItems visual language as the library — no second badge system. Null when the title isn't owned yet. */
  libraryFile: LibraryFile | null;
  detail: MetaDetail;
  score: SuggestionScore;
}

interface TasteProfile {
  topGenres: string[];
  topDirectors: string[];
  topActors: string[];
}

const TASTE_SAMPLE_SIZE = 12;

/**
 * Built from a small sample of what THIS user has actually watched (via
 * their own per-user Plex watch status — see getWatchStatus) — genres come
 * cheap (already stored per `LibraryMovie`/`LibrarySeries`); director/actor
 * affinity needs full TMDb detail, so it's bounded to a handful of titles
 * instead of the whole library (stays cheap, uses the same cached
 * `getDetail` every detail page already calls).
 *
 * Deliberately never falls back to "whatever's in the shared library" once
 * this user has any real watch history — that would leak another
 * household member's taste (whoever added those titles) into this user's
 * own suggestions. The shared-library fallback only kicks in for a brand
 * new profile with zero watch history yet, so it still gets a non-empty
 * taste profile instead of no personalization at all.
 */
async function buildTasteProfile(movies: LibraryMovie[], series: LibrarySeries[], userId: string, locale?: string): Promise<TasteProfile> {
  const status = getWatchStatus(userId);
  const watchedMovieIds = new Set(status?.movies ?? []);
  const watchedSeriesIds = new Set((status?.episodes ?? []).map((e) => e.tmdbId));
  const hasPersonalSignal = watchedMovieIds.size > 0 || watchedSeriesIds.size > 0;

  const genreSource = hasPersonalSignal
    ? [...movies, ...series].filter((m) => watchedMovieIds.has(m.tmdbId) || watchedSeriesIds.has(m.tmdbId))
    : [...movies, ...series];

  const genreCounts = new Map<string, number>();
  for (const m of genreSource) {
    for (const g of m.genres) genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
  }
  const topGenres = [...genreCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([g]) => g);

  const movieSampleSource = hasPersonalSignal
    ? movies.filter((m) => watchedMovieIds.has(m.tmdbId))
    : movies.filter((m) => m.status === "available");
  const sample = [...movieSampleSource]
    .sort((a, b) => b.addedAt - a.addedAt)
    .slice(0, TASTE_SAMPLE_SIZE);

  const details = await mapWithConcurrency(sample, 4, async (m) => {
    try {
      return await getDetail("movie", m.tmdbId, locale);
    } catch {
      return null;
    }
  });

  const directorCounts = new Map<string, number>();
  const actorCounts = new Map<string, number>();
  for (const d of details) {
    if (!d) continue;
    for (const c of d.crew) if (c.job === "Director") directorCounts.set(c.name, (directorCounts.get(c.name) ?? 0) + 1);
    for (const a of d.cast.slice(0, 5)) actorCounts.set(a.name, (actorCounts.get(a.name) ?? 0) + 1);
  }
  const topDirectors = [...directorCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n]) => n);
  const topActors = [...actorCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([n]) => n);

  return { topGenres, topDirectors, topActors };
}

export function scoreCandidate(
  detail: MetaDetail,
  candidate: Pick<HeroCandidateRef, "libraryStatus" | "type" | "tmdbId">,
  ctx: { taste: TasteProfile; locale?: string; recentlyActiveTmdbIds: Set<number>; requestedKeys: Set<string> }
): SuggestionScore {
  const reasons: SuggestionScore["reasons"] = [];

  const matchedGenres = detail.genres.filter((g) => ctx.taste.topGenres.includes(g));
  const genreMatch = matchedGenres.length > 0 ? Math.min(1, matchedGenres.length / 3) : 0;
  reasons.push({
    key: "genreMatch",
    matched: genreMatch > 0,
    params: matchedGenres.length > 0 ? { genres: matchedGenres.slice(0, 2).join(", ") } : undefined,
  });

  const director = detail.crew.find((c) => c.job === "Director");
  const directorMatch = director && ctx.taste.topDirectors.includes(director.name) ? 1 : 0;
  reasons.push({ key: "directorMatch", matched: directorMatch > 0 });

  const matchedActor = detail.cast.slice(0, 5).find((a) => ctx.taste.topActors.includes(a.name));
  const actorMatch = matchedActor ? 1 : 0;
  reasons.push({ key: "actorMatch", matched: actorMatch > 0 });

  // Someone in the household explicitly asked for this — the strongest kind
  // of signal there is, stronger than any inferred taste match. Deliberately
  // shared across every profile (not just whoever requested it): a title the
  // household asked for is worth surfacing to everyone, same as "recently
  // added"/"upcoming" already are.
  const requestBonus = ctx.requestedKeys.has(`${candidate.type}:${candidate.tmdbId}`) ? 1 : 0;
  reasons.push({ key: "requestBonus", matched: requestBonus > 0 });

  const ratingBonus = Math.min(Math.max(detail.rating, 0), 10) / 10;
  reasons.push({ key: "ratingBonus", matched: ratingBonus >= 0.7 });

  const releaseYear = detail.year ?? (detail.releaseDateFull ? new Date(detail.releaseDateFull).getFullYear() : null);
  const yearsSinceRelease = releaseYear ? new Date().getFullYear() - releaseYear : null;
  const recencyBonus = yearsSinceRelease === null ? 0 : Math.max(0, Math.min(1, 1 - yearsSinceRelease / 10));
  reasons.push({ key: "recencyBonus", matched: recencyBonus >= 0.5 });

  const availabilityBonus = candidate.libraryStatus === "available" ? 1 : 0;
  reasons.push({ key: "availabilityBonus", matched: availabilityBonus > 0 });

  const qualityBonus = ctx.recentlyActiveTmdbIds.has(detail.tmdbId) ? 1 : 0;
  reasons.push({ key: "qualityBonus", matched: qualityBonus > 0 });

  const preferredLang = (ctx.locale ?? "fr").slice(0, 2);
  const languageBonus = detail.originalLanguage === preferredLang ? 1 : 0;
  reasons.push({ key: "languageBonus", matched: languageBonus > 0 });

  const preferenceBonus = 0;
  reasons.push({ key: "preferenceBonus", matched: false });

  // Priority order (confirmed by the user): (1) personal taste from actual
  // views + household requests, by far the biggest share; (2) TMDb rating;
  // (3) how recent the release is. Everything else (already-owned, a recent
  // quality bump, original-language match) stays informational — visible in
  // "Pourquoi ce contenu ?" but no longer meaningfully swaying the ranking.
  const total =
    genreMatch * 0.28 + directorMatch * 0.14 + actorMatch * 0.14 + requestBonus * 0.14
    + ratingBonus * 0.2
    + recencyBonus * 0.1;

  return {
    genreMatch, directorMatch, actorMatch, requestBonus, ratingBonus, recencyBonus,
    availabilityBonus, qualityBonus, languageBonus, preferenceBonus, total, reasons,
  };
}

export interface HeroContentMixOptions {
  /** Titles already in the library — unwatched, recently added, upcoming, recent activity. */
  includeOwned: boolean;
  /** Titles NOT in the library — personalized TMDb suggestions and discovery. */
  includeUnowned: boolean;
}

/**
 * Cheap, pool-priority-ordered candidate refs — no TMDb detail fetches yet.
 * Owned and unowned pools are gathered separately, then composed so a large
 * library never silently crowds out every "not yet owned" suggestion: with
 * both `includeOwned`/`includeUnowned` on (the default), at least half the
 * slate is reserved for unowned content whenever any exists, instead of
 * treating discovery as a last-resort fallback only reached once every
 * owned pool has been exhausted.
 */
/**
 * Deterministic per-day, per-user shuffle — pools with no inherent
 * meaningful order (personalized recs, discovery/trending, unwatched
 * library) always surfaced their same first N items forever, since nothing
 * ever reordered them (confirmed live: the same 2-3 titles pinned at the
 * top of the Hero indefinitely). Seeded on the calendar day so the
 * selection rotates once every 24h instead of on every page load (which
 * would make the carousel jump around within a single session) — pools
 * that already carry real chronological meaning (recentlyAdded, upcoming,
 * recentActivity) are deliberately left untouched.
 */
function dailySeed(userId: string): number {
  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD, UTC
  let h = 2166136261;
  for (const c of `${day}:${userId}`) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededShuffle<T>(list: T[], seed: number): T[] {
  const out = [...list];
  let s = seed || 1;
  const next = () => {
    // mulberry32
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

async function gatherCandidateRefs(userId: string, targetCount: number, mix: HeroContentMixOptions): Promise<HeroCandidateRef[]> {
  const seed = dailySeed(userId);
/** Dedupes within a single list, preserving first-seen order — called once per list, never re-applied to the same list twice. */
  function dedupe(list: HeroCandidateRef[]): HeroCandidateRef[] {
    const seen = new Set<string>();
    return list.filter((r) => {
      const key = `${r.type}:${r.tmdbId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  const movies = loadMovies();
  const series = loadSeries();
  void series;

  const unownedRefs: HeroCandidateRef[] = [];
  const ownedRefs: HeroCandidateRef[] = [];

  if (mix.includeUnowned) {
    // Pool 1 — priorité 1 (confirmé par l'utilisateur) : suggestions personnalisées.
    // Mélangées (seed du jour) — sans ça, le même sous-ensemble en tête de
    // liste de recommandations restait épinglé indéfiniment.
    const recs = seededShuffle(await getRecommendations(userId, "movie").catch(() => []), seed);
    for (const r of recs) unownedRefs.push({ tmdbId: r.tmdbId, type: "movie", poolId: "personalized", libraryStatus: null, daysUntilRelease: null });

    // Pool 6 — découverte TMDb (plus un simple repli — une vraie source de contenu non possédé).
    const owned = new Set(movies.map((m) => m.tmdbId));
    const trend = await trending("movie", 1, []).catch(() => ({ results: [] }));
    for (const r of seededShuffle(trend.results, seed + 1)) {
      if (owned.has(r.tmdbId)) continue;
      unownedRefs.push({ tmdbId: r.tmdbId, type: "movie", poolId: "discovery", libraryStatus: null, daysUntilRelease: null });
    }
  }

  if (mix.includeOwned) {
    // Pool 2 — jamais regardés dans la bibliothèque. Mélangé (seed du jour) —
    // sinon toujours les mêmes premiers films de la bibliothèque en tête
    // (aucun ordre chronologique naturel ici, contrairement aux pools 3-5).
    const watched = new Set(getWatchStatus(userId)?.movies ?? []);
    const unwatched = seededShuffle(movies.filter((m) => m.status === "available" && !watched.has(m.tmdbId)), seed + 2);
    for (const m of unwatched) {
      ownedRefs.push({ tmdbId: m.tmdbId, type: "movie", poolId: "unwatchedLibrary", libraryStatus: m.status, daysUntilRelease: null });
    }

    // Pool 3 — récemment ajoutés.
    for (const m of [...movies].filter((m) => m.status === "available").sort((a, b) => b.addedAt - a.addedAt)) {
      ownedRefs.push({ tmdbId: m.tmdbId, type: "movie", poolId: "recentlyAdded", libraryStatus: m.status, daysUntilRelease: null });
    }

    // Pool 4 — suivis à sortie prochaine, triés par proximité de date.
    const upcoming = movies
      .filter((m) => m.status === "upcoming")
      .map((m) => ({ m, days: daysUntil(m.vfReleaseDate ?? m.releaseDate) }))
      .filter((x): x is { m: LibraryMovie; days: number } => x.days !== null)
      .sort((a, b) => a.days - b.days);
    for (const { m, days } of upcoming) {
      ownedRefs.push({ tmdbId: m.tmdbId, type: "movie", poolId: "upcoming", libraryStatus: m.status, daysUntilRelease: days });
    }

    // Pool 5 — mouvement récent de la bibliothèque (statut passé à "available"
    // récemment — regroupe premières acquisitions ET mises à jour ; le
    // GrabIntent du LOT 6 permettra plus tard de distinguer précisément une
    // vraie montée en qualité, non fabriqué ici pour rester honnête).
    const byId = new Map(movies.map((m) => [m.id, m] as const));
    const recentAvailable = getStatusTransitions().filter((t) => t.refType === "movie" && t.to === "available").slice(0, 40);
    for (const t of recentAvailable) {
      const movie = byId.get(t.refId);
      if (movie && movie.status === "available") ownedRefs.push({ tmdbId: movie.tmdbId, type: "movie", poolId: "recentActivity", libraryStatus: movie.status, daysUntilRelease: null });
    }
  }

  // Reserve roughly half the slate for unowned content when both are enabled
  // and there's actually something unowned to show — never starves discovery
  // just because the library is large.
  const wantUnowned = mix.includeUnowned && mix.includeOwned ? Math.max(1, Math.ceil(targetCount / 2)) : mix.includeUnowned ? targetCount : 0;
  const unownedDeduped = dedupe(unownedRefs);
  const ownedDeduped = dedupe(ownedRefs);

  const picked: HeroCandidateRef[] = [];
  picked.push(...unownedDeduped.slice(0, wantUnowned));
  picked.push(...ownedDeduped.slice(0, targetCount - picked.length));
  // Either side coming up short (e.g. no unowned suggestions yet on a small
  // library) still gets topped up from whichever pool has more left.
  if (picked.length < targetCount) picked.push(...unownedDeduped.slice(wantUnowned, wantUnowned + (targetCount - picked.length)));
  if (picked.length < targetCount) picked.push(...ownedDeduped.slice(targetCount - picked.length));

  return picked.slice(0, targetCount);
}

/** Builds the Hero's slide list — candidate refs are cheap; only the final selection gets enriched via `getDetail`. */
export async function buildHeroSlides(
  userId: string,
  locale?: string,
  targetCount = 6,
  mix: HeroContentMixOptions = { includeOwned: true, includeUnowned: true },
  youtubeTrailerSearch = false
): Promise<HeroSlide[]> {
  const refs = await gatherCandidateRefs(userId, targetCount, mix.includeOwned || mix.includeUnowned ? mix : { includeOwned: true, includeUnowned: true });
  if (refs.length === 0) return [];

  const [movies, series] = [loadMovies(), loadSeries()];
  const [taste, details] = await Promise.all([
    buildTasteProfile(movies, series, userId, locale),
    mapWithConcurrency(refs, 4, async (ref) => {
      try {
        return await getDetail(ref.type, ref.tmdbId, locale, { youtubeTrailerSearch });
      } catch {
        return null;
      }
    }),
  ]);

  const recentlyActiveTmdbIds = new Set(
    getStatusTransitions()
      .filter((t) => t.refType === "movie" && t.to === "available")
      .map((t) => movies.find((m) => m.id === t.refId)?.tmdbId)
      .filter((id): id is number => typeof id === "number")
  );

  // Household requests are a shared signal (see scoreCandidate) — approved
  // ones only, since a still-pending/declined request isn't a real "someone
  // wanted this" fact yet.
  const requestedKeys = new Set(
    loadRequests()
      .filter((r) => r.status === "approved")
      .map((r) => `${r.type}:${r.tmdbId}`)
  );

  const byTmdbId = new Map(movies.map((m) => [m.tmdbId, m] as const));

  const slides: HeroSlide[] = [];
  refs.forEach((ref, i) => {
    const detail = details[i];
    if (!detail) return;
    const score = scoreCandidate(detail, ref, { taste, locale, recentlyActiveTmdbIds, requestedKeys });
    const libraryFile = ref.type === "movie" ? byTmdbId.get(ref.tmdbId)?.file ?? null : null;
    slides.push({ poolId: ref.poolId, libraryStatus: ref.libraryStatus, daysUntilRelease: ref.daysUntilRelease, libraryFile, detail, score });
  });
  return slides;
}
