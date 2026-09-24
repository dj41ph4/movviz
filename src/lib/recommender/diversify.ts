import { RELATION_KIND_WEIGHT, rankDecay, type CandidateEvidence } from "@/lib/recommender/evidence";

/**
 * « Sélection pour vous » doit refléter TOUT ce qui a été vu, pas le titre
 * vu le plus « fort » : un film noté/liké amenait ses 20 similaires en tête
 * et remplissait la moitié de la rangée à lui seul (constaté en direct : 9
 * des 20 films proposés sortaient de la liste des similaires de « 300 »).
 *
 * Re-classement glouton : chaque candidat est rattaché au titre vu qui le
 * soutient le mieux ; chaque suggestion déjà retenue pour ce titre vu
 * diminue le poids de la suivante (DECAY^n). Un titre soutenu par plusieurs
 * titres vus garde son avantage (son score contient déjà le consensus), et
 * un titre sans titre vu d'origine (filmographie d'une personne favorite)
 * n'est jamais pénalisé.
 */
const DECAY = 0.7;
/** Profondeur re-classée : largement au-delà de la rangée et du « Voir tout ». */
const DIVERSIFY_DEPTH = 80;

function dominantSeed(evidence: CandidateEvidence): number | null {
  let best: number | null = null;
  let bestValue = -1;
  for (const s of evidence.sources) {
    const value = RELATION_KIND_WEIGHT[s.kind] * s.seedWeight * rankDecay(s.sourceRank);
    if (value > bestValue) { bestValue = value; best = s.seedTmdbId; }
  }
  return best;
}

export function diversifyBySeed<T extends { score: number; evidence: CandidateEvidence }>(sorted: T[]): T[] {
  const remaining = [...sorted];
  const picked: T[] = [];
  const perSeed = new Map<number, number>();
  const depth = Math.min(DIVERSIFY_DEPTH, remaining.length);
  while (picked.length < depth) {
    let bestIndex = 0;
    let bestAdjusted = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const seed = dominantSeed(remaining[i].evidence);
      const already = seed === null ? 0 : perSeed.get(seed) ?? 0;
      const adjusted = remaining[i].score * Math.pow(DECAY, already);
      if (adjusted > bestAdjusted) { bestAdjusted = adjusted; bestIndex = i; }
    }
    const [chosen] = remaining.splice(bestIndex, 1);
    const seed = dominantSeed(chosen.evidence);
    if (seed !== null) perSeed.set(seed, (perSeed.get(seed) ?? 0) + 1);
    picked.push(chosen);
  }
  return [...picked, ...remaining];
}
