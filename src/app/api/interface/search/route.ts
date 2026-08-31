import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { libraryFilePaths, loadMovies, loadSeries } from "@/lib/library/store";
import { memoizeByFileMtimes } from "@/lib/fsJsonCache";

export const dynamic = "force-dynamic";

function searchable(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr");
}

export async function GET(req: NextRequest) {
  if (!requireUser(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const query = searchable(req.nextUrl.searchParams.get("q")?.trim() ?? "");
  const requestedLimit = Number(req.nextUrl.searchParams.get("limit") ?? 8);
  const limit = Number.isFinite(requestedLimit) ? Math.min(20, Math.max(1, requestedLimit)) : 8;
  const titles = memoizeByFileMtimes("interface-search-index", libraryFilePaths(), () => [
    ...loadMovies().map((movie) => ({
      id: movie.id,
      title: movie.title,
      year: movie.year,
      type: "movie" as const,
      href: `/title/movie/${movie.tmdbId}`,
    })),
    ...loadSeries().map((series) => ({
      id: series.id,
      title: series.title,
      year: series.year,
      type: "series" as const,
      href: `/title/series/${series.tmdbId}`,
    })),
  ]);

  const matches = query
    ? titles
        .map((title) => {
          const normalizedTitle = searchable(title.title);
          const index = normalizedTitle.indexOf(query);
          return { title, index };
        })
        .filter((entry) => entry.index >= 0)
        .sort((a, b) => a.index - b.index || a.title.title.localeCompare(b.title.title, "fr"))
        .slice(0, limit)
        .map((entry) => entry.title)
    : titles.slice(0, limit);

  return NextResponse.json({ titles: matches }, { headers: { "Cache-Control": "private, no-cache" } });
}
