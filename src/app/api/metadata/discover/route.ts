import { NextRequest, NextResponse } from "next/server";
import { discoverByFilters, getAnimeRow, getTeenRow } from "@/lib/metadata/tmdb";
import { ANIME_GENRE_ID, TEEN_GENRE_ID } from "@/lib/metadata/genreTaxonomy";

export const dynamic = "force-dynamic";

const PER_PAGE = 20;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") === "series" ? "series" : "movie";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const genre = searchParams.get("genre") ?? undefined;

  // Anime/Teen are synthetic genre ids (genreTaxonomy.ts) — no real TMDb
  // with_genres value exists for either, so they route to the same
  // filtered-fetch helpers the home rows use instead of discoverByFilters.
  // Aligné sur les autres genres : tous les filtres (sort/year/company/
  // watchProvider/durée) sont transmis pour que Tendances (popularity),
  // Top (vote_average) et Nouveautés (date) trient réellement le pool
  // filtré, pas un hardcodé popularity.desc.
  if (genre === ANIME_GENRE_ID || genre === TEEN_GENRE_ID) {
    const extra = {
      sort: searchParams.get("sort") ?? undefined,
      year: searchParams.get("year") ?? undefined,
      company: searchParams.get("company") ?? undefined,
      watchProvider: searchParams.get("watchProvider") ?? undefined,
      maxRuntime: searchParams.get("maxRuntime") ? Number(searchParams.get("maxRuntime")) || undefined : undefined,
      minRuntime: searchParams.get("minRuntime") ? Number(searchParams.get("minRuntime")) || undefined : undefined,
    };
    if (genre === ANIME_GENRE_ID) {
      return NextResponse.json(await getAnimeRow(type, PER_PAGE, undefined, page, extra));
    }
    return NextResponse.json(await getTeenRow(type, PER_PAGE, undefined, page, extra));
  }

  const paged = await discoverByFilters(
    type,
    {
      genre,
      year: searchParams.get("year") ?? undefined,
      sort: searchParams.get("sort") ?? undefined,
      company: searchParams.get("company") ?? undefined,
      watchProvider: searchParams.get("watchProvider") ?? undefined,
      maxRuntime: searchParams.get("maxRuntime") ? Number(searchParams.get("maxRuntime")) || undefined : undefined,
      minRuntime: searchParams.get("minRuntime") ? Number(searchParams.get("minRuntime")) || undefined : undefined,
    },
    page
  );
  return NextResponse.json(paged);
}
