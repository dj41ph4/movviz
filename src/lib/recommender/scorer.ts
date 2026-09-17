import type { CandidateEvidence } from "@/lib/recommender/evidence";
import { bestSingleRelation, multiSeedConsensus } from "@/lib/recommender/evidence";
import { audienceSignal } from "@/lib/recommender/audienceSignal";

export type ReasonCode =
  | "MULTI_SEED_MATCH"
  | "RELATED_TO_HIGH_CONFIDENCE_SEED"
  | "KEYWORD_AFFINITY"
  | "GENRE_AFFINITY"
  | "FAVORITE_PERSON";

export interface ScoreBreakdown {
  relation: number;
  consensus: number;
  explicitTaste: number;
  keywords: number;
  people: number;
  genre: number;
  qualityPrior: number;
  popularityPrior: number;
}

export interface ScoredCandidate {
  score: number;
  breakdown: ScoreBreakdown;
  reasonCodes: ReasonCode[];
}

export interface ScorerInput {
  evidence: CandidateEvidence;
  /** Similarité de mood contrastive, déjà bornée [-1, 1] par l'appelant. */
  tasteVector: number;
  genreAffinity: number;
  keywordAffinity: number;
  personAffinity: number;
}

// Popularité/qualité TMDb ne doivent jamais, à eux seuls, faire battre un
// titre fortement relié à plusieurs seeds (§20/§41 du plan) — d'où des
// poids délibérément faibles ici comparés à relation/consensus/goût.
const WEIGHTS = {
  relation: 0.24,
  consensus: 0.2,
  explicitTaste: 0.1,
  genre: 0.12,
  keywords: 0.13,
  people: 0.08,
  qualityPrior: 0.07,
  popularityPrior: 0.06,
} as const;

/**
 * Scorer pur et déterministe : mêmes entrées -> même sortie, testable sans
 * réseau ni base de données. C'est la seule fonction qui décide du
 * classement final ; elle ne connaît ni TMDb ni la base utilisateur.
 */
export function scoreCandidate(input: ScorerInput): ScoredCandidate {
  const { evidence } = input;
  const relation = bestSingleRelation(evidence);
  const consensus = multiSeedConsensus(evidence);
  const explicitTaste = Math.max(0, Math.min(1, input.tasteVector));
  const genre = Math.max(0, Math.min(1, input.genreAffinity));
  const keywords = Math.max(0, Math.min(1, input.keywordAffinity));
  const people = Math.max(0, Math.min(1, input.personAffinity));
  const qualityPrior = Math.min(evidence.item.rating ?? 0, 10) / 10;
  const popularityPrior = audienceSignal(evidence.item);

  const score =
    relation * WEIGHTS.relation
    + consensus * WEIGHTS.consensus
    + explicitTaste * WEIGHTS.explicitTaste
    + genre * WEIGHTS.genre
    + keywords * WEIGHTS.keywords
    + people * WEIGHTS.people
    + qualityPrior * WEIGHTS.qualityPrior
    + popularityPrior * WEIGHTS.popularityPrior;

  const reasonCodes: ReasonCode[] = [];
  if (evidence.distinctSeedCount >= 2) reasonCodes.push("MULTI_SEED_MATCH");
  if (evidence.sources.some((s) => s.seedWeight >= 0.7)) reasonCodes.push("RELATED_TO_HIGH_CONFIDENCE_SEED");
  if (keywords >= 0.3) reasonCodes.push("KEYWORD_AFFINITY");
  if (genre >= 0.3) reasonCodes.push("GENRE_AFFINITY");
  if (people > 0) reasonCodes.push("FAVORITE_PERSON");

  return {
    score,
    breakdown: { relation, consensus, explicitTaste, keywords, people, genre, qualityPrior, popularityPrior },
    reasonCodes,
  };
}
