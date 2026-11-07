import { discoverByFilters } from "@/lib/metadata/tmdb";
import { filterSuggestable } from "@/lib/metadata/suggestable";
import type { MetaSearchResult } from "@/lib/metadata/types";
import { activeSeason, seasonDef, type SeasonId, type SeasonSettings } from "./calendar";

const ROW_SIZE = 60;
/** Rien de plus ancien : une rangée d'événement doit sentir le récent. */
const RELEASED_AFTER = "1980-01-01";
const PAGES = 2;
const MEMO_TTL_MS = 6 * 60 * 60_000;
const memo = new Map<string, { at: number; results: MetaSearchResult[] }>();

/** Plusieurs listes mêlées à tour de rôle, sans doublon (la première liste gagne). */
function roundRobin<T extends { tmdbId: number; type: string }>(lists: T[][]): T[] {
  const seen = new Set<string>();
  const mixed: T[] = [];
  for (let i = 0; i < Math.max(0, ...lists.map((l) => l.length)); i++) {
    for (const list of lists) {
      const item = list[i];
      if (!item) continue;
      const key = `${item.type}:${item.tmdbId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      mixed.push(item);
    }
  }
  return mixed;
}

/**
 * Une page de titres de la fête : les sorties les plus récentes, les mieux notés
 * et les plus tendance, films et séries, mêlés à tour de rôle.
 */
export async function seasonalPage(season: SeasonId, type: "movie" | "series", page: number): Promise<{ results: MetaSearchResult[]; totalPages: number }> {
  const keywords = seasonDef(season).keywords;
  const minVotes = type === "movie" ? 30 : 15;
  const [recent, best, popular] = await Promise.all([
    discoverByFilters(type, { sort: "primary_release_date.desc", keywords, minVotes, releasedAfter: RELEASED_AFTER }, page).catch(() => null),
    discoverByFilters(type, { sort: "vote_average.desc", keywords, voteCountFloor: minVotes * 2, releasedAfter: RELEASED_AFTER }, page).catch(() => null),
    discoverByFilters(type, { sort: "popularity.desc", keywords, minVotes, releasedAfter: RELEASED_AFTER }, page).catch(() => null),
  ]);
  const keep = (r: { results: MetaSearchResult[] } | null) => filterSuggestable((r?.results ?? []).filter((x) => !!x.posterPath));
  return {
    results: roundRobin([keep(recent), keep(popular), keep(best)]),
    totalPages: Math.max(1, ...[recent, best, popular].map((r) => r?.totalPages ?? 1)),
  };
}

/** Titres de la rangée pour un type (sans doublon). Les clients mêlent films et séries eux-mêmes. */
export async function seasonalTitles(season: SeasonId, type: "movie" | "series"): Promise<MetaSearchResult[]> {
  const memoKey = `${season}:${type}`;
  const hit = memo.get(memoKey);
  if (hit && Date.now() - hit.at < MEMO_TTL_MS) return hit.results;
  const pages = await Promise.all(Array.from({ length: PAGES }, (_, i) => seasonalPage(season, type, i + 1)));
  const results = roundRobin(pages.map((p) => p.results)).slice(0, ROW_SIZE);
  if (results.length > 0) memo.set(memoKey, { at: Date.now(), results });
  return results;
}

/** Rangée `seasonal:<id>` pour la date donnée, ou null hors fête / sans résultat. */
export async function buildSeasonalRow(now: Date, type: "movie" | "series", settings?: SeasonSettings): Promise<{ key: string; season: SeasonId; results: MetaSearchResult[] } | null> {
  const season = activeSeason(now, settings);
  if (!season) return null;
  const results = await seasonalTitles(season, type);
  return results.length > 0 ? { key: `seasonal:${season}`, season, results } : null;
}
