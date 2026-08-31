import { getMovieByTmdbId, getSeriesByTmdbId } from "@/lib/library/store";
import { getWatchStatus } from "@/lib/plex/watchStore";
import { getUnifiedUserKnowledge } from "./knowledge";

export interface EvidenceTasteTrait {
  key: string;
  label: string;
  confidence: number;
  evidenceCount: number;
  strength: number;
  source: "computed_genre" | "context_insight" | "explicit_fact";
}

interface GenreEvidence {
  genre: string;
  works: Set<string>;
  ratingTotal: number;
  ratingCount: number;
  positiveFeedback: number;
  negativeFeedback: number;
  requests: number;
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

  const totalWorks = Math.max(1, watchedWorks.size);
  return [...genres.values()]
    .map((evidence): EvidenceTasteTrait | null => {
      const averageRating = evidence.ratingCount > 0 ? evidence.ratingTotal / evidence.ratingCount : null;
      const evidenceCount = evidence.works.size + evidence.ratingCount + evidence.positiveFeedback + evidence.negativeFeedback + evidence.requests;
      if (evidenceCount < 4 || (evidence.works.size < 3 && evidence.ratingCount < 2 && evidence.positiveFeedback < 2)) return null;

      const exposure = evidence.works.size / totalWorks;
      const ratingLift = averageRating == null ? 0 : Math.max(-1, Math.min(1, (averageRating - 3) / 2));
      const feedbackLift = Math.max(-0.2, Math.min(0.2, (evidence.positiveFeedback - evidence.negativeFeedback) * 0.04));
      const strength = Math.max(0, Math.min(1, exposure * 1.45 + Math.max(0, ratingLift) * 0.3 + feedbackLift));
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

const EXPLICIT_PREFERENCE_RE = /\b(?:adore|aime|pr[ée]f[èe]re|fan|d[ée]teste|n['’ ]aime pas|pr[ée]f[ée]rence forte|mettrais?\s+[1-5]\s*\/\s*5|m[ée]rite\s+[1-5]\s*\/\s*5)\b/i;

/**
 * Traits safe enough to expose to the dialogue layer for personalization.
 * No joke text is generated here: this only supplies evidence-backed facts
 * or tendencies. Personality remains the Dialogue Engine's responsibility.
 */
export function getBanterTraits(userId: string, limit = 5): EvidenceTasteTrait[] {
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

export function formatTasteEvidenceContext(userId: string, limit = 5): string {
  const traits = getBanterTraits(userId, limit);
  if (!traits.length) return "";
  return traits.map((trait) => `${trait.label} [confiance ${Math.round(trait.confidence * 100)}%, preuves ${trait.evidenceCount}, source ${trait.source}]`).join(" ; ");
}
