import { discoverByFilters, getAnimeRow, type DiscoverFilters, type PagedResults } from "@/lib/metadata/tmdb";
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
 *
 * Qualité : chaque catégorie impose un nombre minimum de votes TMDb, pour
 * qu'une rangée « grand public » ne remonte jamais un titre confidentiel. Les
 * productions coréennes, japonaises ou françaises ont leurs rangées dédiées
 * au lieu de s'imposer dans les Nouveautés.
 */

/** Filtres d'un côté (films ou séries) d'une rangée — sous-ensemble de DiscoverFilters. */
type Side = Pick<DiscoverFilters,
  "genre" | "sort" | "company" | "keywords" | "originalLanguage" | "originCountries" |
  "minVotes" | "releasedAfter" | "releasedBefore" | "minRuntime" | "maxRuntime"> | null;

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
  /** Rangée propre à certaines plateformes (ex. Marvel sur Disney+). */
  providers?: number[];
}

const POPULAR = "popularity.desc";
const DISNEY_PLUS = 337;
const NETFLIX = 8;

/** Productions occidentales — « Nouveautés » met en avant ce que le public
 *  européen et américain attend, pas une série populaire au Japon ou en Corée. */
const WESTERN = ["US", "GB", "FR", "CA", "DE", "IT", "ES", "BE", "IE", "AU", "NL", "SE", "DK", "NO", "CH"];

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

/** Les deux côtés avec le même filtre (genre propre à chaque côté ensuite). */
const both = (side: NonNullable<Side>, movie: Partial<NonNullable<Side>> = {}, series: Partial<NonNullable<Side>> = {}) =>
  ({ movie: { ...side, ...movie }, series: { ...side, ...series } });

function buildRows(): ProviderRowDef[] {
  const recent = isoDaysAgo(180);
  return [
    { key: "trending", label: "Tendances", ...both({ sort: POPULAR, minVotes: 40 }) },
    { key: "new", label: "Nouveautés", ...both({ sort: POPULAR, releasedAfter: recent, originCountries: WESTERN, minVotes: 5 }) },
    { key: "top", label: "Les mieux notés", rank: "rating", ...both({ sort: "vote_average.desc", minVotes: 400 }) },
    // Spécial Disney+ : franchises et studios de la maison.
    { key: "marvel", label: "Univers Marvel", providers: [DISNEY_PLUS], ...both({ company: "420", minVotes: 20 }) },
    { key: "pixar", label: "Pixar", providers: [DISNEY_PLUS], ...both({ company: "3", minVotes: 20 }) },
    { key: "starwars", label: "Star Wars", providers: [DISNEY_PLUS], ...both({ company: "1", minVotes: 20 }) },
    { key: "disneyclassics", label: "Classiques Disney", providers: [DISNEY_PLUS], movie: { company: "6125", minVotes: 50 }, series: null },
    { key: "natgeo", label: "National Geographic", providers: [DISNEY_PLUS], nonFiction: true, ...both({ company: "7521", minVotes: 5 }) },
    // Spécial Netflix : autant de rangées propres que Disney+ (5) — ses créations, Ghibli et
    // les grandes productions étrangères qui font son catalogue.
    { key: "netflixoriginals", label: "Créations Netflix", providers: [NETFLIX], ...both({ company: "178464", minVotes: 5 }) },
    { key: "ghibli", label: "Studio Ghibli", providers: [NETFLIX], movie: { company: "10342", minVotes: 20 }, series: null },
    { key: "spanish", label: "Espagne et Amérique latine", providers: [NETFLIX], ...both({ originalLanguage: "es", minVotes: 30 }) },
    { key: "british", label: "Royaume-Uni", providers: [NETFLIX], ...both({ originCountries: ["GB"], originalLanguage: "en", minVotes: 60 }) },
    { key: "german", label: "Productions allemandes", providers: [NETFLIX], ...both({ originalLanguage: "de", minVotes: 30 }) },
    { key: "action", label: "Action et aventure", ...both({ minVotes: 80 }, { genre: "28|12" }, { genre: "10759" }) },
    { key: "comedy", label: "Comédies", ...both({ genre: "35", minVotes: 60 }) },
    { key: "superhero", label: "Super-héros", ...both({ keywords: "9715", minVotes: 40 }) },
    { key: "scifi", label: "Science-fiction et fantastique", ...both({ minVotes: 60 }, { genre: "878|14" }, { genre: "10765" }) },
    { key: "crime", label: "Policier et thriller", ...both({ minVotes: 60 }, { genre: "80|53" }, { genre: "80|9648" }) },
    { key: "truestory", label: "Inspiré d'une histoire vraie", ...both({ keywords: "9672", minVotes: 40 }) },
    { key: "family", label: "En famille", ...both({ minVotes: 40 }, { genre: "10751" }, { genre: "10751|10762" }) },
    { key: "animation", label: "Animation", ...both({ genre: "16", minVotes: 40 }) },
    { key: "anime", label: "Animés", movie: {}, series: {}, anime: true },
    { key: "drama", label: "Drames", ...both({ genre: "18", minVotes: 80 }) },
    { key: "romcom", label: "Comédies romantiques", movie: { genre: "10749,35", minVotes: 60 }, series: { genre: "35,10766", minVotes: 20 } },
    { key: "horror", label: "Horreur et frissons", movie: { genre: "27", minVotes: 60 }, series: null },
    { key: "french", label: "Films et séries français", ...both({ originalLanguage: "fr", minVotes: 30 }) },
    { key: "korean", label: "Corée : films et K-dramas", ...both({ originalLanguage: "ko", minVotes: 30 }) },
    { key: "short", label: "Moins de 1 h 40", movie: { maxRuntime: 100, minRuntime: 60, minVotes: 150 }, series: null },
    { key: "epic", label: "Grands films (plus de 2 h 30)", movie: { minRuntime: 150, minVotes: 150 }, series: null },
    { key: "y2010", label: "Les années 2010", ...both({ releasedAfter: "2010-01-01", releasedBefore: "2019-12-31", minVotes: 200 }) },
    { key: "y2000", label: "Les années 2000", ...both({ releasedAfter: "2000-01-01", releasedBefore: "2009-12-31", minVotes: 150 }) },
    { key: "y1990", label: "Les années 90", ...both({ releasedAfter: "1990-01-01", releasedBefore: "1999-12-31", minVotes: 120 }) },
    { key: "classics", label: "Grands classiques", movie: { releasedBefore: "1989-12-31", minVotes: 300 }, series: { releasedBefore: "1989-12-31", minVotes: 50 } },
    { key: "history", label: "Histoire et guerre", ...both({ minVotes: 40 }, { genre: "36|10752" }, { genre: "10768" }) },
    { key: "western", label: "Western", ...both({ genre: "37", minVotes: 30 }) },
    { key: "music", label: "Musique et comédies musicales", movie: { genre: "10402", minVotes: 40 }, series: null },
    { key: "documentary", label: "Documentaires", nonFiction: true, ...both({ genre: "99", minVotes: 10 }) },
    { key: "reality", label: "Téléréalité et émissions", nonFiction: true, movie: null, series: { genre: "10764|10767", minVotes: 5 } },
  ];
}

// Recalculé au plus une fois par jour : les dates relatives (Nouveautés)
// glissent sans redémarrage du serveur.
let rowsCache: { day: string; rows: ProviderRowDef[] } | null = null;
function allRows(): ProviderRowDef[] {
  const day = new Date().toISOString().slice(0, 10);
  if (!rowsCache || rowsCache.day !== day) rowsCache = { day, rows: buildRows() };
  return rowsCache.rows;
}

/** Rangées affichées pour une plateforme (les rangées spécifiques en plus). */
export function providerRowsFor(providerId: number | null): { key: string; label: string }[] {
  return allRows()
    .filter((row) => !row.providers || (providerId != null && row.providers.includes(providerId)))
    .map(({ key, label }) => ({ key, label }));
}

const TMDB_MAX_PAGES = 500;
/** Pages TMDb (20 titres) lues par côté pour UNE page de rangée : rangées
 *  plus fournies dès l'arrivée (jusqu'à ~80 titres films + séries). */
const TMDB_PAGES_PER_ROW_PAGE = 2;

export function providerRowDef(key: string): ProviderRowDef | undefined {
  return allRows().find((row) => row.key === key);
}

async function fetchSidePage(
  type: "movie" | "series",
  def: ProviderRowDef,
  side: NonNullable<Side>,
  providerId: number,
  region: string,
  tmdbPage: number,
): Promise<PagedResults> {
  if (def.anime) {
    return getAnimeRow(type, 20, undefined, tmdbPage, { sort: POPULAR, watchProvider: String(providerId), region });
  }
  return discoverByFilters(type, { ...side, sort: side.sort ?? POPULAR, watchProvider: String(providerId), region }, tmdbPage);
}

/** Une page de rangée = TMDB_PAGES_PER_ROW_PAGE pages TMDb consécutives d'un côté. */
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
  const first = (page - 1) * TMDB_PAGES_PER_ROW_PAGE + 1;
  const pages = await Promise.all(
    Array.from({ length: TMDB_PAGES_PER_ROW_PAGE }, (_, i) => fetchSidePage(type, def, side, providerId, region, first + i).catch(() => null)),
  );
  const ok = pages.filter((p): p is PagedResults => !!p);
  if (ok.length === 0) return empty;
  const tmdbTotal = Math.max(...ok.map((p) => p.totalPages));
  return {
    results: ok.flatMap((p) => (p.page <= tmdbTotal ? p.results : [])),
    page,
    totalPages: Math.ceil(Math.min(TMDB_MAX_PAGES, tmdbTotal) / TMDB_PAGES_PER_ROW_PAGE),
  };
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

// Cache mémoire des pages de rangée : revenir sur une plateforme, ou rouvrir
// « Voir tout », ne refait aucun appel TMDb pendant ROW_CACHE_TTL_MS.
const ROW_CACHE_TTL_MS = 20 * 60_000;
const ROW_CACHE_MAX = 600;
const rowCache = new Map<string, { at: number; value: Promise<PagedResults> }>();

/**
 * `type` : seulement les films ou seulement les séries de la rangée (page Découverte du bureau, onglets
 * Films / Séries) ; absent = films ET séries mélangés (clients Android, onglet « Tout »).
 */
export function providerRowPage(providerId: number, key: string, page: number, region: string, type?: "movie" | "series"): Promise<PagedResults> {
  const cacheKey = `${providerId}|${key}|${page}|${region}|${type ?? "all"}|${new Date().toISOString().slice(0, 10)}`;
  const hit = rowCache.get(cacheKey);
  if (hit && Date.now() - hit.at < ROW_CACHE_TTL_MS) return hit.value;
  const value = computeProviderRowPage(providerId, key, page, region, type);
  rowCache.set(cacheKey, { at: Date.now(), value });
  // Un échec n'est pas mis en cache.
  value.then((r) => { if (r.results.length === 0 && r.totalPages === 0) rowCache.delete(cacheKey); }, () => rowCache.delete(cacheKey));
  if (rowCache.size > ROW_CACHE_MAX) rowCache.delete(rowCache.keys().next().value!);
  return value;
}

async function computeProviderRowPage(providerId: number, key: string, page: number, region: string, type?: "movie" | "series"): Promise<PagedResults> {
  const def = providerRowDef(key);
  if (!def || (def.providers && !def.providers.includes(providerId))) return { results: [], page, totalPages: 0 };
  const none: PagedResults = { results: [], page, totalPages: 0 };
  const [movies, series] = await Promise.all([
    type === "series" ? none : fetchSide("movie", def, def.movie, providerId, region, page),
    type === "movie" ? none : fetchSide("series", def, def.series, providerId, region, page),
  ]);
  const clean = (results: MetaSearchResult[]) => def.nonFiction
    ? results.filter((r) => r.rating > 0 || !!r.posterPath)
    : filterSuggestable(results);
  // Une affiche manquante casse une rangée TV : ces titres sont écartés.
  const withArt = (results: MetaSearchResult[]) => clean(results).filter((r) => !!r.posterPath);
  return {
    results: interleaveByMerit([withArt(movies.results), withArt(series.results)], def.rank),
    page,
    totalPages: Math.max(movies.totalPages, series.totalPages),
  };
}
