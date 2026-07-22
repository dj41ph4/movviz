import { NextRequest, NextResponse } from "next/server";
import { searchFromCache } from "@/lib/indexers/rssCache";
import { MOVIE_CATEGORY_IDS, TV_CATEGORY_IDS } from "@/lib/indexers/categories";
import { loadIndexers } from "@/lib/indexers/store";
import { withoutRateLimited, countNewlyRateLimited } from "@/lib/indexers/rateLimit";
import { searchIndexer, searchMovie, sanitizeQuery } from "@/lib/indexers/torznab";
import { recordSearchLog } from "@/lib/diagnostic/searchLog";
import type { IndexerRelease } from "@/lib/indexers/types";
import type { MediaType } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Manual search — reads from the RSS cache first (instant), and for an
 * actual typed query (not the query-less "recent releases" browse) falls
 * back to a live direct search when the cache comes up empty. The cache only
 * holds the ~100-150 latest releases across all indexers, so anything not
 * extremely recent never appears there — same gap fixed for auto-grab in
 * autoGrab.ts/autoGrabSeries.ts, applied here too since this is a separate
 * code path that reads the cache on its own.
 */
export async function GET(req: NextRequest) {
  const qRaw = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  // When search is launched from a specific title (its own card/detail page,
  // not the free-text /search box), refTitle is the clean title alone —
  // `q` is that SAME title with the year (movies) or a season/episode code
  // (series) appended, e.g. "“Hurlevent” 2026" or "9-1-1 S09". Confirmed
  // live: sending that combined text as the actual search query returns
  // ZERO results even when the release plainly exists — the title alone
  // finds it fine. So the clean title, not `q`, is what actually gets
  // searched; `q` still gets sanitized in case no refTitle was given (a
  // freeform query typed directly into /search).
  const refTitle = req.nextUrl.searchParams.get("refTitle")?.trim();
  const q = sanitizeQuery(refTitle || qRaw);
  const category = req.nextUrl.searchParams.get("category") as MediaType | null;
  const recent = req.nextUrl.searchParams.get("recent") === "1";
  const enabled = loadIndexers().filter((i) => i.enabled);
  // ID-based search params (from a known movie/series detail page)
  const tmdbIdParam = req.nextUrl.searchParams.get("tmdbId");
  const imdbIdParam = req.nextUrl.searchParams.get("imdbId");
  const tmdbId = tmdbIdParam ? Number(tmdbIdParam) : null;
  const yearParam = req.nextUrl.searchParams.get("year");
  const year = yearParam ? Number(yearParam) : null;

  if (enabled.length === 0) {
    return NextResponse.json({ configured: false, releases: [], queried: 0, errors: [] });
  }

  const scope = category === "movie" ? MOVIE_CATEGORY_IDS : category === "series" ? TV_CATEGORY_IDS : undefined;
  const releases = searchFromCache(scope);

  let filtered = releases.filter((r) => r.score >= 10);

  if (recent) {
    filtered.sort(
      (a, b) => new Date(b.publishDate ?? 0).getTime() - new Date(a.publishDate ?? 0).getTime()
    );
    filtered = filtered.slice(0, 200);
    return NextResponse.json({ configured: true, queried: enabled.length, releases: filtered, errors: [] });
  }

  if (q) {
    const lower = q.toLowerCase();
    filtered = filtered.filter((r) => r.title.toLowerCase().includes(lower));
  }
  filtered.sort((a, b) => b.score - a.score);

  if (q && filtered.length === 0) {
    const configuredIndexers = enabled.filter((i) => i.protocol === "torrent");
    const indexers = withoutRateLimited(configuredIndexers);
    const alreadyLimited = configuredIndexers.length - indexers.length;
    if (indexers.length > 0) {
      // When the movie/series is known (tmdbId from the detail page), use
      // ID-based search (t=movie&tmdbid=XXX) — far more accurate than a
      // text-only query, especially for titles with accents or special chars
      // like "Team Démolition" where text search returns nothing.
      const directResults = await Promise.all(
        indexers.map((ix) =>
          (category === "movie" && tmdbId
            ? searchMovie(ix, { title: refTitle || qRaw, year, tmdbId, imdbId: imdbIdParam }, scope)
            : searchIndexer(ix, q, scope)
          ).catch(() => [] as IndexerRelease[])
        )
      );
      const newlyLimited = countNewlyRateLimited(indexers);
      const direct = directResults.flat().filter((r) => r.score >= 10);
      const lower = q.toLowerCase();
      filtered = direct
        .filter((r) => r.title.toLowerCase().includes(lower))
        .sort((a, b) => b.score - a.score);
      if (filtered.length === 0) {
        if (newlyLimited > 0) {
          recordSearchLog("warn", "manual_search.fallback_rate_limited", `"${q}" — 0 résultat : ${newlyLimited} indexeur(s) ont répondu 429 (rate-limité) pendant cette recherche, pas forcément "rien trouvé"`);
        } else {
          recordSearchLog("info", "manual_search.fallback_empty", `"${q}" — recherche directe: ${directResults.flat().length} brut(s), 0 résultat après filtrage${alreadyLimited > 0 ? ` (${alreadyLimited} indexeur(s) déjà rate-limité(s), exclu(s))` : ""}`);
        }
      } else {
        recordSearchLog("info", "manual_search.fallback_match", `"${q}" — ${filtered.length} résultat(s) via recherche directe`);
      }
    } else {
      recordSearchLog("warn", "manual_search.no_indexers_available", `"${q}" — aucun indexeur disponible : tous rate-limités (${alreadyLimited}/${configuredIndexers.length})`);
    }
  }

  return NextResponse.json({
    configured: true,
    queried: enabled.length,
    releases: filtered,
    errors: [],
  });
}
