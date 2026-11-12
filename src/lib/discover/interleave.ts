/**
 * Découverte › Tout : mélange films et séries une carte sur deux, au lieu de poser
 * toutes les séries après tous les films (elles finissaient au fond du carrousel).
 *
 * Chaque liste garde son propre classement ; on alterne film, série, film, série…
 * Quand l'un des deux types est épuisé, le reste de l'autre suit. Un même titre
 * n'apparaît qu'une fois.
 */
export interface InterleavableTitle {
  tmdbId: number;
  type: "movie" | "series";
  seriesPart?: string;
}

const keyOf = (item: InterleavableTitle) => `${item.type}:${item.tmdbId}${item.seriesPart ? `:${item.seriesPart}` : ""}`;

export function interleaveMoviesAndSeries<T extends InterleavableTitle>(movies: readonly T[], series: readonly T[]): T[] {
  const out: T[] = [];
  const seen = new Set<string>();
  const push = (item: T | undefined) => {
    if (!item) return;
    const key = keyOf(item);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(item);
  };
  const longest = Math.max(movies.length, series.length);
  for (let i = 0; i < longest; i++) {
    push(movies[i]);
    push(series[i]);
  }
  return out;
}
