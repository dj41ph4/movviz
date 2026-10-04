/** Rerank an already-filtered catalogue page without adding out-of-filter
 * titles or changing its pagination. Unknown titles keep their stable order. */
export function rankPersonalized<T extends { tmdbId: number }>(catalogue: T[], recommended: { tmdbId: number }[]): T[] {
  const positions = new Map(recommended.map((item, index) => [item.tmdbId, index]));
  return [...catalogue].sort((a, b) => (positions.get(a.tmdbId) ?? Infinity) - (positions.get(b.tmdbId) ?? Infinity));
}
