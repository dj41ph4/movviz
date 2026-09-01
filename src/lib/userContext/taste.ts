import { getMovieByTmdbId, getSeriesByTmdbId } from "@/lib/library/store";
import { getWatchStatus } from "@/lib/plex/watchStore";
import { getDetail } from "@/lib/metadata/tmdb";
import { mapWithConcurrency } from "@/lib/concurrency";
import { getUnifiedUserKnowledge } from "./knowledge";
import { getRecentViewedTitles } from "./query";

export interface EvidenceTasteTrait {
  key: string;
  label: string;
  confidence: number;
  evidenceCount: number;
  strength: number;
  source: "computed_genre" | "computed_person" | "context_insight" | "explicit_fact";
}

/** Best matching computed-genre trait's strength×confidence for a set of
 *  genre NAMES (fr-FR, matching whatever getComputedGenreTraits() itself
 *  keys on) — 0 when there's no trait for any of them. Shared middleware
 *  between every consumer that ranks TMDb candidates against the SQL
 *  context (recommendationScore.ts for AI chat, recommender/engine.ts for
 *  "Suggestions pour vous") so the notion of "genre affinity" — and its
 *  0..~0.96 ceiling (confidence alone caps at 0.96, see
 *  getComputedGenreTraits) — stays defined in exactly one place. */
export function matchGenreAffinity(genreNames: string[], traits: Map<string, EvidenceTasteTrait>): number {
  let best = 0;
  for (const genre of genreNames) {
    const trait = traits.get(`genre:${genre.trim().toLocaleLowerCase("fr")}`);
    if (trait) best = Math.max(best, trait.strength * trait.confidence);
  }
  return best;
}

interface GenreEvidence {
  genre: string;
  works: Set<string>;
  ratingTotal: number;
  ratingCount: number;
  positiveFeedback: number;
  negativeFeedback: number;
  requests: number;
  /** Distinct titles opened (title_viewed) but not necessarily
   *  watched/rated/requested — the "interested but hasn't committed yet"
   *  signal, see the weighting note in getComputedGenreTraits below. */
  views: Set<string>;
}

function genresFor(tmdbId: number, type: "movie" | "series"): string[] {
  const item = type === "movie" ? getMovieByTmdbId(tmdbId) : getSeriesByTmdbId(tmdbId);
  const genres = item && Array.isArray((item as { genres?: string[] }).genres)
    ? (item as { genres: string[] }).genres
    : [];
  return genres.filter((genre) => typeof genre === "string" && genre.trim().length > 0);
}

function getOrCreate(map: Map<string, GenreEvidence>, genre: string): GenreEvidence {
  const key = genre.trim().toLocaleLowerCase("fr");
  let evidence = map.get(key);
  if (!evidence) {
    evidence = {
      genre: genre.trim(),
      works: new Set(),
      ratingTotal: 0,
      ratingCount: 0,
      positiveFeedback: 0,
      negativeFeedback: 0,
      requests: 0,
      views: new Set(),
    };
    map.set(key, evidence);
  }
  return evidence;
}

/**
 * Deterministic taste evidence derived from real Movviz activity. A genre is
 * never labelled "liked" from views alone: without positive ratings/feedback
 * the wording stays deliberately factual ("regarde souvent").
 */
export function getComputedGenreTraits(userId: string, limit = 5): EvidenceTasteTrait[] {
  const watch = getWatchStatus(userId);
  const knowledge = getUnifiedUserKnowledge(userId);
  const genres = new Map<string, GenreEvidence>();
  const watchedWorks = new Set<string>();

  for (const tmdbId of watch?.movies ?? []) {
    const workKey = `movie:${tmdbId}`;
    watchedWorks.add(workKey);
    for (const genre of genresFor(tmdbId, "movie")) getOrCreate(genres, genre).works.add(workKey);
  }

  const watchedSeries = new Set((watch?.episodes ?? []).map((episode) => episode.tmdbId));
  for (const tmdbId of watchedSeries) {
    const workKey = `series:${tmdbId}`;
    watchedWorks.add(workKey);
    for (const genre of genresFor(tmdbId, "series")) getOrCreate(genres, genre).works.add(workKey);
  }

  for (const rating of knowledge.ratings) {
    for (const genre of genresFor(rating.tmdbId, rating.type)) {
      const evidence = getOrCreate(genres, genre);
      evidence.ratingTotal += rating.rating;
      evidence.ratingCount += 1;
    }
  }

  for (const feedback of knowledge.feedback) {
    for (const genre of genresFor(feedback.tmdbId, feedback.type)) {
      const evidence = getOrCreate(genres, genre);
      if (feedback.liked) evidence.positiveFeedback += 1;
      else evidence.negativeFeedback += 1;
    }
  }

  for (const request of knowledge.requests) {
    if (request.tmdbId == null || !request.type) continue;
    for (const genre of genresFor(request.tmdbId, request.type)) getOrCreate(genres, genre).requests += 1;
  }

  // Views (title_viewed) — "opened the fiche" is real interest, but weaker
  // than actually watching/rating/reacting to something, and a lot noisier
  // than a request too (browsing idly vs. a deliberate ask). 90-day window:
  // recent browsing should count, an open from eight months ago shouldn't
  // still be nudging today's suggestions.
  const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
  for (const viewed of getRecentViewedTitles(userId, Date.now() - NINETY_DAYS_MS, 200)) {
    const workKey = `${viewed.mediaType}:${viewed.tmdbId}`;
    for (const genre of genresFor(viewed.tmdbId, viewed.mediaType)) getOrCreate(genres, genre).views.add(workKey);
  }

  const totalWorks = Math.max(1, watchedWorks.size);
  return [...genres.values()]
    .map((evidence): EvidenceTasteTrait | null => {
      const averageRating = evidence.ratingCount > 0 ? evidence.ratingTotal / evidence.ratingCount : null;
      const evidenceCount = evidence.works.size + evidence.ratingCount + evidence.positiveFeedback + evidence.negativeFeedback + evidence.requests + evidence.views.size;
      if (evidenceCount < 4 || (evidence.works.size < 3 && evidence.ratingCount < 2 && evidence.positiveFeedback < 2)) return null;

      const exposure = evidence.works.size / totalWorks;
      const ratingLift = averageRating == null ? 0 : Math.max(-1, Math.min(1, (averageRating - 3) / 2));
      const feedbackLift = Math.max(-0.2, Math.min(0.2, (evidence.positiveFeedback - evidence.negativeFeedback) * 0.04));
      // "Souvent on me demande de dl des films/séries qui ne sont pas pour
      // moi" (confirmed live) — a request is weak, noisy evidence of MY
      // taste specifically, capped hard at +0.1 regardless of how many
      // requests land in this genre (unlike every other term, this one
      // deliberately does NOT scale with count past the cap).
      const requestLift = Math.min(0.1, evidence.requests * 0.025);
      // Views matter more than requests (confirmed live) but still can't
      // rival actually watching something — capped at +0.2, roughly a
      // seventh of exposure's own ceiling (1.45 at full library share).
      const viewLift = Math.min(0.2, evidence.views.size * 0.02);
      const strength = Math.max(0, Math.min(1, exposure * 1.45 + Math.max(0, ratingLift) * 0.3 + feedbackLift + requestLift + viewLift));
      const confidence = Math.max(0.5, Math.min(0.96,
        0.42 + Math.min(0.32, evidenceCount * 0.035) + Math.min(0.14, evidence.ratingCount * 0.025) + Math.min(0.08, evidence.positiveFeedback * 0.02)
      ));

      const label = averageRating != null && averageRating >= 4
        ? `forte affinité avec le genre « ${evidence.genre} » (note moyenne ${averageRating.toFixed(1)}/5)`
        : evidence.positiveFeedback >= 2 && evidence.positiveFeedback > evidence.negativeFeedback
          ? `réagit positivement aux recommandations du genre « ${evidence.genre} »`
          : `regarde régulièrement des contenus du genre « ${evidence.genre} »`;

      return {
        key: `genre:${evidence.genre.toLocaleLowerCase("fr")}`,
        label,
        confidence,
        evidenceCount,
        strength,
        source: "computed_genre",
      };
    })
    .filter((trait): trait is EvidenceTasteTrait => trait !== null)
    .sort((a, b) => (b.strength * b.confidence) - (a.strength * a.confidence) || b.evidenceCount - a.evidenceCount)
    .slice(0, Math.max(1, Math.min(10, limit)));
}

interface PersonEvidence {
  id: number;
  name: string;
  role: "cast" | "director";
  works: Set<string>;
  positiveCount: number;
  negativeCount: number;
}

interface PersonTarget {
  tmdbId: number;
  type: "movie" | "series";
  /** null = plain watch, no explicit rating/feedback either way — still
   *  real recurrence evidence ("regarder beaucoup de films avec le même
   *  acteur", confirmed live as its own qualifying signal), just weaker
   *  than an explicit vote. */
  sentiment: boolean | null;
}

export interface FavoritePerson {
  id: number;
  name: string;
  role: "cast" | "director";
  strength: number;
  confidence: number;
  worksCount: number;
  /** Whether this person qualified via an explicit rating/vote (label can
   *  honestly say "bien noté") or purely by recurring across watched titles
   *  with no vote either way (label says "revient souvent" instead). */
  hasExplicitSignal: boolean;
}

// Only the lead cast counts — a background extra in a loved film shouldn't
// register the same as its star. TMDb's own cast array is already sorted by
// billing order.
const PERSON_CAST_TOP_N = 6;
// Bounded cost: fetching getDetail() per title is one TMDb call each (cached
// after the first time — see tmdbGet's own cache layer), but this runs on
// every taste computation, so the SOURCE list itself must stay small. Rated/
// liked titles are naturally a small, curated subset of a user's full watch
// history (this user: 91 watched movies, but far fewer explicitly rated) —
// unlike getComputedGenreTraits, which is free (genres already live on the
// local library item, no fetch needed at all).
const PERSON_DETAIL_FETCH_LIMIT = 70;
const PERSON_CACHE_TTL_MS = 60 * 60 * 1000;

const favoritePeopleCache = new Map<string, { people: FavoritePerson[]; expiresAt: number }>();

/** Called right after a new rating/feedback is recorded (tasteProfile.ts) —
 *  without this, a stale cache computed BEFORE a "j'adore Jim Carrey"-style
 *  rating could keep hiding that person for up to PERSON_CACHE_TTL_MS,
 *  confirmed live as the scenario actually being tested. */
export function invalidatePersonTraitCache(userId: string): void {
  favoritePeopleCache.delete(userId);
}

/**
 * Actor/director affinity core — the counterpart to getComputedGenreTraits
 * for "j'adore Jim Carrey" (confirmed live: rating two of his films 5/5 alone
 * did nothing for his OTHER films — genre affinity only sees "Comédie",
 * nothing ties the two ratings to the person himself). Sourced from rated
 * (≥4, or ≤2 for the negative side) and 👍/👎'd titles only — the same
 * "explicit, curated signal" restraint recommendationScore.ts's own
 * dislikedExactKeys/tasteVector already apply, not the full watch history
 * (which has no cast data locally and would mean dozens of TMDb fetches on
 * every computation). Cached per user for PERSON_CACHE_TTL_MS since this is
 * the one trait source here that actually costs network calls. Two thin
 * views sit on top of this one computation: getComputedPersonTraits()
 * (EvidenceTasteTrait, for chat/context display) and getFavoritePeople()
 * (raw id/name, for recommender/engine.ts to actually fetch each person's
 * filmography and inject it as candidates — a label alone can't do that).
 */
async function computeFavoritePeople(userId: string): Promise<FavoritePerson[]> {
  const cached = favoritePeopleCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.people;

  const knowledge = getUnifiedUserKnowledge(userId);
  const targetMap = new Map<string, PersonTarget>();
  for (const r of knowledge.ratings) {
    if (r.rating === 3) continue;
    targetMap.set(`${r.type}:${r.tmdbId}`, { tmdbId: r.tmdbId, type: r.type, sentiment: r.rating >= 4 });
  }
  for (const f of knowledge.feedback) {
    const key = `${f.type}:${f.tmdbId}`;
    if (!targetMap.has(key)) targetMap.set(key, { tmdbId: f.tmdbId, type: f.type, sentiment: f.liked });
  }
  // Plain watch recurrence — "le fait de regarder beaucoup de films avec le
  // même acteur" (confirmed live), independent of ever rating/voting on
  // anything. Only added where budget remains after the (usually much
  // smaller) explicit-signal list above, since every one of these is a
  // getDetail() fetch too.
  const watch = getWatchStatus(userId);
  for (const tmdbId of watch?.movies ?? []) {
    const key = `movie:${tmdbId}`;
    if (!targetMap.has(key)) targetMap.set(key, { tmdbId, type: "movie", sentiment: null });
  }
  for (const tmdbId of new Set((watch?.episodes ?? []).map((e) => e.tmdbId))) {
    const key = `series:${tmdbId}`;
    if (!targetMap.has(key)) targetMap.set(key, { tmdbId, type: "series", sentiment: null });
  }

  const targets = [...targetMap.values()].slice(0, PERSON_DETAIL_FETCH_LIMIT);
  const people = new Map<string, PersonEvidence>();

  await mapWithConcurrency(targets, 4, async (target) => {
    const detail = await getDetail(target.type, target.tmdbId).catch(() => null);
    if (!detail) return;
    const workKey = `${target.type}:${target.tmdbId}`;
    const credit = (id: number, name: string, role: "cast" | "director") => {
      const key = `${role}:${id}`;
      let evidence = people.get(key);
      if (!evidence) {
        evidence = { id, name, role, works: new Set(), positiveCount: 0, negativeCount: 0 };
        people.set(key, evidence);
      }
      evidence.works.add(workKey);
      if (target.sentiment === true) evidence.positiveCount += 1;
      else if (target.sentiment === false) evidence.negativeCount += 1;
      // sentiment === null (plain watch): counts toward works/recurrence
      // only, no explicit vote either way.
    };
    for (const c of detail.cast.slice(0, PERSON_CAST_TOP_N)) credit(c.id, c.name, "cast");
    for (const c of detail.crew) if (c.job === "Director") credit(c.id, c.name, "director");
  });

  const favorites = [...people.values()]
    .map((evidence): FavoritePerson | null => {
      const net = evidence.positiveCount - evidence.negativeCount;
      // An explicit net-negative vote excludes the person outright, however
      // often they otherwise recur — this is the one case where the label
      // ("apprécie particulièrement X") would be actively wrong to show.
      if (net < 0) return null;
      // Qualifies either on pure recurrence (3+ appearances, no vote needed
      // — mirrors getComputedGenreTraits' own works.size<3 bootstrap) OR on
      // an explicit net-positive vote even with fewer appearances (a single
      // 5★ carries more signal than a single incidental watch).
      if (evidence.works.size < 3 && net < 1) return null;
      const strength = Math.max(0, Math.min(1, 0.25 + evidence.works.size * 0.15 + net * 0.08));
      const confidence = Math.max(0.5, Math.min(0.95, 0.45 + Math.min(0.3, evidence.works.size * 0.06) + Math.min(0.15, net * 0.03)));
      return { id: evidence.id, name: evidence.name, role: evidence.role, strength, confidence, worksCount: evidence.works.size, hasExplicitSignal: net > 0 };
    })
    .filter((f): f is FavoritePerson => f !== null)
    .sort((a, b) => (b.strength * b.confidence) - (a.strength * a.confidence) || b.worksCount - a.worksCount)
    .slice(0, 10);

  favoritePeopleCache.set(userId, { people: favorites, expiresAt: Date.now() + PERSON_CACHE_TTL_MS });
  return favorites;
}

/** Raw favorite people (id/name/role/strength) — for a consumer that needs
 *  to actually DO something with the person (recommender/engine.ts fetching
 *  their filmography), not just display a sentence. */
export async function getFavoritePeople(userId: string, limit = 3): Promise<FavoritePerson[]> {
  return (await computeFavoritePeople(userId)).slice(0, limit);
}

export async function getComputedPersonTraits(userId: string, limit = 5): Promise<EvidenceTasteTrait[]> {
  const favorites = await computeFavoritePeople(userId);
  return favorites.slice(0, limit).map((f) => {
    const plural = f.worksCount > 1 ? "s" : "";
    const label = f.role === "director"
      ? f.hasExplicitSignal
        ? `apprécie les films réalisés par ${f.name} (${f.worksCount} vu${plural}/noté${plural})`
        : `regarde régulièrement des films réalisés par ${f.name} (${f.worksCount} vu${plural})`
      : f.hasExplicitSignal
        ? `apprécie particulièrement ${f.name} comme acteur/actrice (${f.worksCount} film${plural}/série${plural} bien noté${plural})`
        : `revient souvent vers des films/séries avec ${f.name} (${f.worksCount} vu${plural}, sans note explicite)`;
    return {
      key: `person:${f.role}:${f.id}`,
      label,
      confidence: f.confidence,
      evidenceCount: f.worksCount,
      strength: f.strength,
      source: "computed_person" as const,
    };
  });
}

const EXPLICIT_PREFERENCE_RE = /\b(?:adore|aime|pr[ée]f[èe]re|fan|d[ée]teste|n['’ ]aime pas|pr[ée]f[ée]rence forte|mettrais?\s+[1-5]\s*\/\s*5|m[ée]rite\s+[1-5]\s*\/\s*5)\b/i;

/**
 * Traits safe enough to expose to the dialogue layer for personalization.
 * No joke text is generated here: this only supplies evidence-backed facts
 * or tendencies. Personality remains the Dialogue Engine's responsibility.
 */
export async function getBanterTraits(userId: string, limit = 5): Promise<EvidenceTasteTrait[]> {
  const knowledge = getUnifiedUserKnowledge(userId);
  const traits: EvidenceTasteTrait[] = [];

  for (const fact of knowledge.facts) {
    if (/pr[ée]nom/i.test(fact.fact) || !EXPLICIT_PREFERENCE_RE.test(fact.fact)) continue;
    traits.push({
      key: `fact:${fact.fact.toLocaleLowerCase("fr").slice(0, 120)}`,
      label: fact.fact,
      confidence: 1,
      evidenceCount: 1,
      strength: 1,
      source: "explicit_fact",
    });
  }

  for (const insight of knowledge.insights) {
    if (insight.confidence < 0.75 || insight.evidenceCount < 4 || insight.trend === "en_baisse") continue;
    traits.push({
      key: `insight:${insight.text.toLocaleLowerCase("fr").slice(0, 120)}`,
      label: insight.text,
      confidence: insight.confidence,
      evidenceCount: insight.evidenceCount,
      strength: Math.min(1, 0.55 + insight.evidenceCount * 0.035),
      source: "context_insight",
    });
  }

  traits.push(...getComputedGenreTraits(userId, 6));
  traits.push(...(await getComputedPersonTraits(userId, 4)));

  const seen = new Set<string>();
  return traits
    .sort((a, b) => {
      const sourceRank = (source: EvidenceTasteTrait["source"]) => source === "explicit_fact" ? 3 : source === "context_insight" ? 2 : 1;
      return sourceRank(b.source) - sourceRank(a.source) || (b.confidence * b.strength) - (a.confidence * a.strength) || b.evidenceCount - a.evidenceCount;
    })
    .filter((trait) => {
      const normalized = trait.label.toLocaleLowerCase("fr").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
      const signature = normalized.split(" ").slice(0, 8).join(" ");
      if (!signature || seen.has(signature)) return false;
      seen.add(signature);
      return true;
    })
    .slice(0, Math.max(1, Math.min(8, limit)));
}

export async function formatTasteEvidenceContext(userId: string, limit = 5): Promise<string> {
  const traits = await getBanterTraits(userId, limit);
  if (!traits.length) return "";
  return traits.map((trait) => `${trait.label} [confiance ${Math.round(trait.confidence * 100)}%, preuves ${trait.evidenceCount}, source ${trait.source}]`).join(" ; ");
}
