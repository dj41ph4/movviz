import type { AiRecommendation } from "@/lib/ai/types";
import type { CriteriaRequest } from "@/lib/ai/criteriaRequest";
import { discoverByFilters, getTitleOriginCountries } from "@/lib/metadata/tmdb";
import type { MetaSearchResult } from "@/lib/metadata/types";
import { getMovieByTmdbId, getSeriesByTmdbId } from "@/lib/library/store";
import { mapWithConcurrency } from "@/lib/concurrency";

type Locale = "fr" | "en" | "it" | "nl" | "de";

const MAX_PAGES = 4;
const VERIFY_CONCURRENCY = 6;
// Un cinéma de niche a peu de votes : assez pour écarter une fiche à une seule
// note à 10/10 (The Easter Sunday Massacre), pas assez pour exclure le belge.
const BEST_VOTE_FLOOR = 15;

export interface CriteriaResult {
  cards: AiRecommendation[];
  /** Candidats TMDb examinés (avant vérification du pays). */
  examined: number;
}

function inLibrary(r: Pick<MetaSearchResult, "type" | "tmdbId">): boolean {
  return r.type === "movie" ? !!getMovieByTmdbId(r.tmdbId) : !!getSeriesByTmdbId(r.tmdbId);
}

/** TMDb filtre déjà par pays d'origine et par date ; on revérifie quand même
 *  le pays dans la fiche complète (production_countries) pour ne jamais
 *  présenter un titre hors critère, et la date sur la date de sortie réelle. */
async function matches(r: MetaSearchResult, request: CriteriaRequest): Promise<boolean> {
  const date = r.releaseDate ?? "";
  if (request.from && (!date || date < request.from)) return false;
  if (request.to && (!date || date > request.to)) return false;
  if (request.countries.length === 0) return true;
  try {
    const countries = await getTitleOriginCountries(r.type, r.tmdbId);
    return request.countries.some((code) => countries.includes(code));
  } catch {
    return false;
  }
}

async function searchOneType(type: "movie" | "series", request: CriteriaRequest): Promise<{ kept: MetaSearchResult[]; examined: number }> {
  const kept: MetaSearchResult[] = [];
  let examined = 0;
  const filters = {
    sort: request.best ? "vote_average.desc" : "popularity.desc",
    originCountries: request.countries.length ? request.countries : undefined,
    releasedAfter: request.from,
    releasedBefore: request.to,
    voteCountFloor: BEST_VOTE_FLOOR,
    minVotes: BEST_VOTE_FLOOR,
  };
  for (let page = 1; page <= MAX_PAGES && kept.length < request.count; page++) {
    const res = await discoverByFilters(type, filters, page);
    if (!res.results.length) break;
    examined += res.results.length;
    const verdicts = await mapWithConcurrency(res.results, VERIFY_CONCURRENCY, (r) => matches(r, request));
    res.results.forEach((r, i) => { if (verdicts[i] && !kept.some((k) => k.tmdbId === r.tmdbId)) kept.push(r); });
    if (page >= res.totalPages) break;
  }
  return { kept, examined };
}

/** Exécute la demande sur les vraies données TMDb : jamais la mémoire du modèle. */
export async function searchByCriteria(request: CriteriaRequest): Promise<CriteriaResult> {
  const types: Array<"movie" | "series"> = request.scope === "all" ? ["movie", "series"] : [request.scope];
  const parts = await Promise.all(types.map((t) => searchOneType(t, request)));
  let pool = parts.flatMap((p) => p.kept);
  pool = request.best ? pool.sort((a, b) => b.rating - a.rating) : pool.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
  const cards: AiRecommendation[] = pool.slice(0, request.count).map((r) => ({
    title: r.title,
    year: r.year ?? undefined,
    type: r.type,
    tmdbId: r.tmdbId,
    overview: r.overview,
    posterPath: r.posterPath,
    rating: r.rating,
    inLibrary: inLibrary(r),
  }));
  return { cards, examined: parts.reduce((n, p) => n + p.examined, 0) };
}

function formatDay(date: string, locale: Locale): string {
  const text = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
  return locale === "fr" ? text.replace(/^1 /, "1er ") : text;
}

function countryName(code: string, locale: Locale): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** La ligne au-dessus des cartes : uniquement des faits vérifiés (critères
 *  réellement appliqués, nombre trouvé), jamais une phrase du modèle. */
export function criteriaIntro(request: CriteriaRequest, found: number, owned: number, locale: Locale = "fr"): string {
  const copy = {
    fr: {
      kinds: ["film", "série", "titre"], plural: "s",
      none: "Je n'ai trouvé aucun titre qui respecte ces critères dans TMDb",
      list: (n: number, kind: string, best: boolean) => `${best ? `Les ${n} ${kind} les mieux notés` : `${n} ${kind}`}`,
      from: (d: string) => `sortis depuis le ${d}`, to: (d: string) => `jusqu'au ${d}`, between: (a: string, b: string) => `sortis du ${a} au ${b}`,
      country: (c: string) => `de production ou coproduction : ${c}`,
      fewer: (asked: number) => ` (tu en voulais ${asked}, TMDb n'en a pas davantage dans ces critères)`,
      owned0: " Aucun n'est encore dans ta bibliothèque.", ownedAll: " Tu les as déjà tous.", owned: (n: number) => ` Tu en as déjà ${n} dans ta bibliothèque.`,
    },
    en: {
      kinds: ["movie", "series", "title"], plural: "s",
      none: "I couldn't find any title matching these criteria in TMDb",
      list: (n: number, kind: string, best: boolean) => `${best ? `The ${n} highest-rated ${kind}` : `${n} ${kind}`}`,
      from: (d: string) => `released since ${d}`, to: (d: string) => `up to ${d}`, between: (a: string, b: string) => `released between ${a} and ${b}`,
      country: (c: string) => `production or co-production: ${c}`,
      fewer: (asked: number) => ` (you asked for ${asked}; TMDb has no more matching these criteria)`,
      owned0: " None are in your library yet.", ownedAll: " You already have them all.", owned: (n: number) => ` ${n} are already in your library.`,
    },
    it: {
      kinds: ["film", "serie", "titolo"], plural: "",
      none: "Non ho trovato titoli che rispettino questi criteri su TMDb",
      list: (n: number, kind: string, best: boolean) => `${best ? `I ${n} ${kind} più apprezzati` : `${n} ${kind}`}`,
      from: (d: string) => `usciti dal ${d}`, to: (d: string) => `fino al ${d}`, between: (a: string, b: string) => `usciti tra il ${a} e il ${b}`,
      country: (c: string) => `produzione o coproduzione: ${c}`,
      fewer: (asked: number) => ` (ne volevi ${asked}, TMDb non ne ha altri con questi criteri)`,
      owned0: " Nessuno è ancora nella tua libreria.", ownedAll: " Li hai già tutti.", owned: (n: number) => ` Ne hai già ${n} nella tua libreria.`,
    },
    nl: {
      kinds: ["film", "serie", "titel"], plural: "s",
      none: "Ik vond geen titels die aan deze criteria voldoen op TMDb",
      list: (n: number, kind: string, best: boolean) => `${best ? `De ${n} best beoordeelde ${kind}` : `${n} ${kind}`}`,
      from: (d: string) => `uitgebracht sinds ${d}`, to: (d: string) => `tot ${d}`, between: (a: string, b: string) => `uitgebracht tussen ${a} en ${b}`,
      country: (c: string) => `productie of coproductie: ${c}`,
      fewer: (asked: number) => ` (je vroeg om ${asked}; TMDb heeft er niet meer met deze criteria)`,
      owned0: " Nog geen ervan staat in je bibliotheek.", ownedAll: " Je hebt ze al allemaal.", owned: (n: number) => ` ${n} staan al in je bibliotheek.`,
    },
    de: {
      kinds: ["Film", "Serie", "Titel"], plural: "e",
      none: "Ich habe auf TMDb keine Titel gefunden, die diese Kriterien erfüllen",
      list: (n: number, kind: string, best: boolean) => `${best ? `Die ${n} bestbewerteten ${kind}` : `${n} ${kind}`}`,
      from: (d: string) => `erschienen seit ${d}`, to: (d: string) => `bis ${d}`, between: (a: string, b: string) => `erschienen zwischen ${a} und ${b}`,
      country: (c: string) => `Produktion oder Koproduktion: ${c}`,
      fewer: (asked: number) => ` (du wolltest ${asked}; TMDb hat keine weiteren mit diesen Kriterien)`,
      owned0: " Noch keiner ist in deiner Bibliothek.", ownedAll: " Du hast schon alle.", owned: (n: number) => ` ${n} sind bereits in deiner Bibliothek.`,
    },
  }[locale];
  const parts: string[] = [];
  if (request.from && request.to) parts.push(copy.between(formatDay(request.from, locale), formatDay(request.to, locale)));
  else if (request.from) parts.push(copy.from(formatDay(request.from, locale)));
  else if (request.to) parts.push(copy.to(formatDay(request.to, locale)));
  if (request.countries.length) parts.push(copy.country(request.countries.map((c) => countryName(c, locale)).join(", ")));
  const criteria = parts.join(" — ");
  if (!found) return `${copy.none} (${criteria}).`;
  const kind = copy.kinds[request.scope === "movie" ? 0 : request.scope === "series" ? 1 : 2] + (found > 1 ? copy.plural : "");
  const ownedNote = owned === 0 ? copy.owned0 : owned === found ? copy.ownedAll : copy.owned(owned);
  const shortfall = found < request.count ? copy.fewer(request.count) : "";
  return `${copy.list(found, kind, request.best)} — ${criteria}${shortfall} 🎬${ownedNote}`;
}
