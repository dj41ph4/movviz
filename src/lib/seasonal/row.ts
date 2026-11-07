import { discoverByFilters } from "@/lib/metadata/tmdb";
import { filterSuggestable } from "@/lib/metadata/suggestable";
import type { MetaSearchResult } from "@/lib/metadata/types";
import { activeSeason, seasonDef, type SeasonId } from "./calendar";

const ROW_SIZE = 20;
const MEMO_TTL_MS = 6 * 60 * 60_000;
const memo = new Map<string, { at: number; results: MetaSearchResult[] }>();

function interleave<T>(first: T[], second: T[]): T[] {
  const mixed: T[] = [];
  for (let i = 0; i < Math.max(first.length, second.length); i++) {
    if (first[i]) mixed.push(first[i]);
    if (second[i]) mixed.push(second[i]);
  }
  return mixed;
}

/** Titres de la saison (films et séries mêlés, populaires d'abord). Vide hors saison. */
export async function seasonalTitles(season: SeasonId): Promise<MetaSearchResult[]> {
  const hit = memo.get(season);
  if (hit && Date.now() - hit.at < MEMO_TTL_MS) return hit.results;
  const keywords = seasonDef(season).keywords;
  const [movies, series] = await Promise.all([
    discoverByFilters("movie", { sort: "popularity.desc", keywords, minVotes: 30 }, 1).catch(() => null),
    discoverByFilters("series", { sort: "popularity.desc", keywords, minVotes: 15 }, 1).catch(() => null),
  ]);
  const keep = (list: MetaSearchResult[] | undefined) => filterSuggestable((list ?? []).filter((r) => !!r.posterPath));
  const results = interleave(keep(movies?.results), keep(series?.results)).slice(0, ROW_SIZE);
  if (results.length > 0) memo.set(season, { at: Date.now(), results });
  return results;
}

/** Rangée `seasonal:<id>` pour la date donnée, ou null hors saison / sans résultat. */
export async function buildSeasonalRow(now: Date): Promise<{ key: string; season: SeasonId; results: MetaSearchResult[] } | null> {
  const season = activeSeason(now);
  if (!season) return null;
  const results = await seasonalTitles(season);
  return results.length > 0 ? { key: `seasonal:${season}`, season, results } : null;
}
