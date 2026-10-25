import { discoverByFilters, getAnimeRow, type PagedResults } from "@/lib/metadata/tmdb";
import type { MetaSearchResult } from "@/lib/metadata/types";
import { filterSuggestable } from "@/lib/metadata/suggestable";

/**
 * Catalogue d'une plateforme (Netflix, Disney+…) organisé en rangées par
 * catégorie, films ET séries mélangés — la page « plateforme » des clients
 * Android TV / Android mobile. Chaque rangée est paginée à l'infini (TMDb
 * plafonne à 500 pages) et ouvre la même source en grille via « Voir tout ».
 *
 * Les identifiants de genre diffèrent entre films et séries chez TMDb (pas de
 * « Action » nu côté séries, pas d'« Horreur » du tout) : chaque rangée porte
 * son propre filtre par type, `null` quand le type n'a pas d'équivalent — la
 * rangée ne contient alors que l'autre type.
 */

type Side = { genre?: string; sort?: string } | null;

interface ProviderRowDef {
  key: string;
  label: string;
  /** Critère de mélange films/séries (par défaut : popularité). */
  rank?: "date" | "rating";
  movie: Side;
  series: Side;
  /** Rangées de non-fiction : le filtre « suggérable » (qui écarte
   *  documentaires et émissions) viderait la rangée. */
  nonFiction?: boolean;
  /** Animés : genre synthétique (Animation + langue japonaise). */
  anime?: boolean;
}

const POPULAR = "popularity.desc";

export const PROVIDER_ROWS: ProviderRowDef[] = [
  { key: "trending", label: "Tendances", movie: { sort: POPULAR }, series: { sort: POPULAR } },
  { key: "new", label: "Nouveautés", rank: "date", movie: { sort: "primary_release_date.desc" }, series: { sort: "primary_release_date.desc" } },
  { key: "top", label: "Les mieux notés", rank: "rating", movie: { sort: "vote_average.desc" }, series: { sort: "vote_average.desc" } },
  { key: "action", label: "Action et aventure", movie: { genre: "28|12" }, series: { genre: "10759" } },
  { key: "comedy", label: "Comédies", movie: { genre: "35" }, series: { genre: "35" } },
  { key: "anime", label: "Animés", movie: {}, series: {}, anime: true },
  { key: "animation", label: "Animation", movie: { genre: "16" }, series: { genre: "16" } },
  { key: "scifi", label: "Science-fiction et fantastique", movie: { genre: "878|14" }, series: { genre: "10765" } },
  { key: "crime", label: "Policier et thriller", movie: { genre: "80|53" }, series: { genre: "80|9648" } },
  { key: "drama", label: "Drames", movie: { genre: "18" }, series: { genre: "18" } },
  { key: "family", label: "En famille", movie: { genre: "10751" }, series: { genre: "10751|10762" } },
  { key: "horror", label: "Horreur et frissons", movie: { genre: "27" }, series: null },
  { key: "romance", label: "Romance", movie: { genre: "10749" }, series: { genre: "10766" } },
  { key: "history", label: "Histoire et guerre", movie: { genre: "36|10752" }, series: { genre: "10768" } },
  { key: "western", label: "Western", movie: { genre: "37" }, series: { genre: "37" } },
  { key: "music", label: "Musique", movie: { genre: "10402" }, series: null },
  { key: "documentary", label: "Documentaires", movie: { genre: "99" }, series: { genre: "99" }, nonFiction: true },
  { key: "reality", label: "Téléréalité et émissions", movie: null, series: { genre: "10764|10767" }, nonFiction: true },
];

const TMDB_MAX_PAGES = 500;

export function providerRowDef(key: string): ProviderRowDef | undefined {
  return PROVIDER_ROWS.find((row) => row.key === key);
}

async function fetchSide(
  type: "movie" | "series",
  def: ProviderRowDef,
  side: Side,
  providerId: number,
  region: string,
  page: number,
): Promise<PagedResults> {
  const empty = { results: [], page, totalPages: 0 };
  if (!side) return empty;
  try {
    if (def.anime) {
      return await getAnimeRow(type, 20, undefined, page, { sort: POPULAR, watchProvider: String(providerId), region });
    }
    return await discoverByFilters(type, {
      genre: side.genre,
      sort: side.sort ?? POPULAR,
      watchProvider: String(providerId),
      region,
    }, page);
  } catch {
    return empty;
  }
}

/**
 * Mélange films et séries « au mérite », sans jamais les regrouper : à chaque
 * place, la tête de liste la plus forte selon le critère de la rangée
 * (popularité, date de sortie ou note) passe devant — l'ordre suit donc la
 * pertinence réelle plutôt qu'une alternance mécanique. Deux garde-fous :
 * jamais plus de MAX_RUN titres du même type d'affilée, et aucun type ne
 * prend plus de SHARE_SLACK d'avance sur sa part proportionnelle (une liste
 * très populaire ne repousse pas l'autre en fin de rangée).
 */
const MAX_RUN = 2;
const SHARE_SLACK = 0.1;

function rankValue(item: MetaSearchResult, rank: ProviderRowDef["rank"]): number {
  if (rank === "date") {
    const t = item.releaseDate ? Date.parse(item.releaseDate) : NaN;
    return Number.isNaN(t) ? 0 : t;
  }
  if (rank === "rating") return item.rating ?? 0;
  return item.popularity ?? item.rating ?? 0;
}

export function interleaveByMerit(lists: MetaSearchResult[][], rank?: ProviderRowDef["rank"]): MetaSearchResult[] {
  const pools = lists.filter((list) => list.length > 0);
  const taken = pools.map(() => 0);
  const total = pools.reduce((sum, list) => sum + list.length, 0);
  const out: MetaSearchResult[] = [];
  const seen = new Set<string>();
  let lastPool = -1;
  let run = 0;
  for (let placed = 0; placed < total; placed++) {
    const open = pools.map((list, i) => i).filter((i) => taken[i] < pools[i].length);
    if (open.length === 0) break;
    // Un type épuisé alors que l'autre reste : au plus MAX_RUN titres de plus,
    // puis la page s'arrête — la suivante reprend le mélange (pas de traîne
    // « que des films » en fin de rangée).
    if (pools.length > 1 && open.length === 1 && open[0] === lastPool && run >= MAX_RUN) break;
    const progress = (i: number) => (taken[i] + 1) / pools[i].length;
    const allowed = open.filter((i) => {
      if (open.length === 1) return true;
      if (i === lastPool && run >= MAX_RUN) return false;
      const others = open.filter((j) => j !== i);
      return others.every((j) => progress(i) - progress(j) <= SHARE_SLACK + 1 / pools[i].length);
    });
    const candidates = allowed.length > 0 ? allowed : open;
    let best = candidates[0];
    for (const i of candidates) {
      if (rankValue(pools[i][taken[i]], rank) > rankValue(pools[best][taken[best]], rank)) best = i;
    }
    const item = pools[best][taken[best]++];
    const key = `${item.type}:${item.tmdbId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    run = best === lastPool ? run + 1 : 1;
    lastPool = best;
    out.push(item);
  }
  return out;
}

export async function providerRowPage(providerId: number, key: string, page: number, region: string): Promise<PagedResults> {
  const def = providerRowDef(key);
  if (!def) return { results: [], page, totalPages: 0 };
  const [movies, series] = await Promise.all([
    fetchSide("movie", def, def.movie, providerId, region, page),
    fetchSide("series", def, def.series, providerId, region, page),
  ]);
  const clean = (results: MetaSearchResult[]) => def.nonFiction
    ? results.filter((r) => r.rating > 0 || !!r.posterPath)
    : filterSuggestable(results);
  // Une affiche manquante casse une rangée TV : ces titres sont écartés.
  const withArt = (results: MetaSearchResult[]) => clean(results).filter((r) => !!r.posterPath);
  return {
    results: interleaveByMerit([withArt(movies.results), withArt(series.results)], def.rank),
    page,
    totalPages: Math.min(TMDB_MAX_PAGES, Math.max(movies.totalPages, series.totalPages)),
  };
}
