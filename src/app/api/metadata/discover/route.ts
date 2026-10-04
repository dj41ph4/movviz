import { NextRequest, NextResponse } from "next/server";
import { discoverByFilters, getAnimeRow, getTeenRow, resolveWatchRegion } from "@/lib/metadata/tmdb";
import { ANIME_GENRE_ID, TEEN_GENRE_ID } from "@/lib/metadata/genreTaxonomy";
import { requireUser } from "@/lib/auth/guard";
import { getRecommendationPool, recommendationsPending } from "@/lib/recommender/engine";
import { getProviderRelationPool } from "@/lib/recommender/providerRelations";
import { rankPersonalized } from "@/lib/metadata/personalizedSort";
import { filterSuggestable } from "@/lib/metadata/suggestable";

export const dynamic = "force-dynamic";

const PER_PAGE = 20;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") === "series" ? "series" : "movie";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const genre = searchParams.get("genre") ?? undefined;
  // Lecture optionnelle : cette route reste accessible sans session (aucun
  // requireUser bloquant ici avant cette refonte), donc region retombe sur
  // le défaut global si personne n'est connecté, plutôt que d'ajouter une
  // exigence d'auth qui n'existait pas.
  const userId = requireUser(req)?.id ?? "";
  const region = resolveWatchRegion(userId);
  const personalized = searchParams.get("sort") === "for_you";
  if (personalized && !userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sort = personalized ? "popularity.desc" : searchParams.get("sort") ?? undefined;
  const providerId = Number(searchParams.get("watchProvider"));
  const recommendationPool = personalized
    ? (Number.isInteger(providerId) && providerId > 0
      ? getProviderRelationPool(userId, type, providerId, region).then((pool) => ({ results: pool.results, pending: pool.pending }))
      : getRecommendationPool(userId, type).then((results) => ({ results, pending: recommendationsPending(userId) }))).catch(() => ({ results: [], pending: false }))
    : null;
  const filtered = ["genre", "year", "company", "maxRuntime", "minRuntime"].some((key) => !!searchParams.get(key));
  if (recommendationPool && !filtered) {
    const pool = await recommendationPool;
    const results = filterSuggestable(pool.results);
    return NextResponse.json({ results: results.slice((page - 1) * PER_PAGE, page * PER_PAGE), page,
      totalPages: Math.max(1, Math.ceil(results.length / PER_PAGE), pool.pending ? page + 1 : 1) });
  }
  const respond = async (paged: { results: import("@/lib/metadata/types").MetaSearchResult[]; page: number; totalPages: number }) => {
    if (recommendationPool) paged = { ...paged, results: rankPersonalized(paged.results, (await recommendationPool).results) };
    return NextResponse.json(paged);
  };

  // Anime/Teen are synthetic genre ids (genreTaxonomy.ts) — no real TMDb
  // with_genres value exists for either, so they route to the same
  // filtered-fetch helpers the home rows use instead of discoverByFilters.
  // Aligné sur les autres genres : tous les filtres (sort/year/company/
  // watchProvider/durée) sont transmis pour que Tendances (popularity),
  // Top (vote_average) et Nouveautés (date) trient réellement le pool
  // filtré, pas un hardcodé popularity.desc.
  if (genre === ANIME_GENRE_ID || genre === TEEN_GENRE_ID) {
    const extra = {
      sort,
      year: searchParams.get("year") ?? undefined,
      company: searchParams.get("company") ?? undefined,
      watchProvider: searchParams.get("watchProvider") ?? undefined,
      maxRuntime: searchParams.get("maxRuntime") ? Number(searchParams.get("maxRuntime")) || undefined : undefined,
      minRuntime: searchParams.get("minRuntime") ? Number(searchParams.get("minRuntime")) || undefined : undefined,
      region,
    };
    if (genre === ANIME_GENRE_ID) {
      return respond(await getAnimeRow(type, PER_PAGE, undefined, page, extra));
    }
    return respond(await getTeenRow(type, PER_PAGE, undefined, page, extra));
  }

  const paged = await discoverByFilters(
    type,
    {
      genre,
      year: searchParams.get("year") ?? undefined,
      sort,
      company: searchParams.get("company") ?? undefined,
      watchProvider: searchParams.get("watchProvider") ?? undefined,
      maxRuntime: searchParams.get("maxRuntime") ? Number(searchParams.get("maxRuntime")) || undefined : undefined,
      minRuntime: searchParams.get("minRuntime") ? Number(searchParams.get("minRuntime")) || undefined : undefined,
      region,
    },
    page
  );
  return respond(paged);
}
