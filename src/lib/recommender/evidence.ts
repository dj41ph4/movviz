import type { MetaSearchResult } from "@/lib/metadata/types";
import type { Seed } from "@/lib/recommender/seedBuilder";

export type RelationKind = "tmdb_recommendation" | "tmdb_similar";

export interface RelationSource {
  kind: RelationKind;
  seedTmdbId: number;
  seedWeight: number;
  /** 0-based position in the source TMDb page — un candidat en position 0
   *  est un vote plus fort qu'un candidat en position 19. */
  sourceRank: number;
}

export interface CandidateEvidence {
  item: MetaSearchResult;
  sources: RelationSource[];
  distinctSeedCount: number;
}

// TMDb /recommendations est un signal comportemental ("les autres
// spectateurs de ce titre ont aussi regardé"), /similar est un signal de
// contenu (genres/mots-clés) — les deux sont de vrais votes, mais
// /recommendations est historiquement le bloc que la fiche affiche comme
// "les similaires" et s'est révélé le plus fiable dans l'audit (§5 du plan).
// Poids réglable ici plutôt qu'éparpillé — c'est la base d'un futur
// benchmark A/B (Phase 9), pas une valeur figée définitivement.
export const RELATION_KIND_WEIGHT: Record<RelationKind, number> = {
  tmdb_recommendation: 1,
  tmdb_similar: 0.85,
};

function rankDecay(rank: number): number {
  return 1 / (1 + rank * 0.12);
}

/**
 * Un candidat présent cinq fois n'est pas cinq titres : c'est un titre avec
 * cinq preuves. Cette fonction fusionne toutes les occurrences d'un même
 * tmdbId (recommendations + similar + filmographie de personne favorite)
 * en une seule entrée qui garde la trace de chaque seed d'origine.
 */
export function aggregateCandidateEvidence(
  hits: Array<{ item: MetaSearchResult; source: RelationSource }>
): Map<number, CandidateEvidence> {
  const byId = new Map<number, CandidateEvidence>();
  for (const { item, source } of hits) {
    const existing = byId.get(item.tmdbId);
    if (existing) {
      existing.sources.push(source);
    } else {
      byId.set(item.tmdbId, { item, sources: [source], distinctSeedCount: 0 });
    }
  }
  for (const evidence of byId.values()) {
    evidence.distinctSeedCount = new Set(evidence.sources.map((s) => s.seedTmdbId)).size;
  }
  return byId;
}

/**
 * Meilleure relation individuelle d'un candidat vers un seed : le terme
 * "relationToSeeds" du scorer. Ne récompense pas encore l'accord entre
 * plusieurs seeds (voir multiSeedConsensus ci-dessous) — juste la preuve la
 * plus forte prise isolément.
 */
export function bestSingleRelation(evidence: CandidateEvidence): number {
  let best = 0;
  for (const s of evidence.sources) {
    const value = RELATION_KIND_WEIGHT[s.kind] * s.seedWeight * rankDecay(s.sourceRank);
    if (value > best) best = value;
  }
  return Math.min(1, best);
}

/**
 * Consensus multi-seed : fonction saturante (jamais une simple somme qui
 * favoriserait indéfiniment un candidat présent 20 fois avec un poids
 * faible sur un candidat présent 2 fois avec un poids fort). 1 seed -> 0,
 * 2 seeds indépendants forts -> boost net, 4+ -> saturation progressive.
 */
export function multiSeedConsensus(evidence: CandidateEvidence): number {
  if (evidence.distinctSeedCount <= 1) return 0;
  const bestPerSeed = new Map<number, number>();
  for (const s of evidence.sources) {
    const value = RELATION_KIND_WEIGHT[s.kind] * s.seedWeight * rankDecay(s.sourceRank);
    const prior = bestPerSeed.get(s.seedTmdbId) ?? 0;
    if (value > prior) bestPerSeed.set(s.seedTmdbId, value);
  }
  const weightedSum = [...bestPerSeed.values()].reduce((a, b) => a + b, 0);
  return 1 - Math.exp(-0.55 * weightedSum);
}

export function seedByTmdbId(seeds: Seed[]): Map<number, Seed> {
  return new Map(seeds.map((s) => [s.tmdbId, s] as const));
}
