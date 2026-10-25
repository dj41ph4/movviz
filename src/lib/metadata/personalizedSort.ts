/** Rerank an already-filtered catalogue page without adding out-of-filter
 * titles or changing its pagination. Unknown titles keep their stable order. */
export function rankPersonalized<T extends { tmdbId: number }>(catalogue: T[], recommended: { tmdbId: number }[]): T[] {
  const positions = new Map(recommended.map((item, index) => [item.tmdbId, index]));
  return [...catalogue].sort((a, b) => (positions.get(a.tmdbId) ?? Infinity) - (positions.get(b.tmdbId) ?? Infinity));
}

/**
 * Affinité de genre déduite du panel de recommandations de l'utilisateur
 * (déjà calculé, en mémoire) : chaque genre pèse sa fréquence dans le panel.
 * Sert à réordonner un catalogue de complément sans aucun appel réseau.
 */
export function genreAffinityFrom(pool: { genreIds?: number[] }[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const item of pool) for (const id of item.genreIds ?? []) counts.set(id, (counts.get(id) ?? 0) + 1);
  const max = Math.max(1, ...counts.values());
  return new Map([...counts].map(([id, n]) => [id, n / max]));
}

/** Réordonne un catalogue par affinité de genre (moyenne des genres du titre),
 *  la popularité TMDb départageant à affinité proche. Les titres du panel
 *  personnel restent devant (rankPersonalized). */
export function rankByTaste<T extends { tmdbId: number; genreIds?: number[]; popularity?: number }>(
  catalogue: T[],
  affinity: Map<number, number>,
): T[] {
  if (affinity.size === 0) return catalogue;
  const maxPop = Math.max(1, ...catalogue.map((item) => item.popularity ?? 0));
  const score = (item: T) => {
    const ids = item.genreIds ?? [];
    const taste = ids.length ? ids.reduce((sum, id) => sum + (affinity.get(id) ?? 0), 0) / ids.length : 0;
    return taste * 0.75 + ((item.popularity ?? 0) / maxPop) * 0.25;
  };
  return catalogue.map((item) => ({ item, s: score(item) })).sort((a, b) => b.s - a.s).map(({ item }) => item);
}
