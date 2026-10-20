import { NextRequest, NextResponse } from "next/server";
import { searchMulti, searchTv, searchPeople, tmdbConfigured } from "@/lib/metadata/tmdb";
import { requireUser } from "@/lib/auth/guard";
import { recordUserContextEvent } from "@/lib/userContext/ingest";
import { projectBleachSearchResults } from "@/lib/metadata/bleachPresentation";
import { isBleachSequelTitle } from "@/lib/metadata/bleachEpisodeOrder";
import { findCorrection, hasStrongMatch, learnTitles, warmSearchCorpus } from "@/lib/metadata/searchCorrection";

export const dynamic = "force-dynamic";

/** Best-effort, per-user search signal — hour-bucketed sourceEventId so a
 *  debounced client re-issuing the same query as the user keeps typing (or
 *  SWR revalidating) collapses to one row instead of flooding the ledger. */
function logSearch(userId: string, q: string, resultCount: number): void {
  const hourBucket = Math.floor(Date.now() / 3_600_000);
  recordUserContextEvent({
    userId,
    eventType: "search_performed",
    source: "metadata_search",
    sourceEventId: `search:${userId}:${hourBucket}:${q.toLowerCase()}`,
    numericValue: resultCount,
    textValue: q,
    occurredAt: Date.now(),
  });
}

export async function GET(req: NextRequest) {
  if (!tmdbConfigured()) {
    return NextResponse.json({ configured: false, results: [], page: 1, totalPages: 0 });
  }
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ configured: true, results: [], page: 1, totalPages: 0 });
  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") ?? "1") || 1);
  const type = req.nextUrl.searchParams.get("type");

  if (type === "person") {
    const paged = await searchPeople(q, page);
    return NextResponse.json({ configured: true, ...paged });
  }

  const run = async (query: string) => {
    if (type === "series") return searchTv(query, page);
    const res = await searchMulti(query, page);
    if (type === "movie") res.results = res.results.filter((r) => r.type === "movie");
    return res;
  };
  warmSearchCorpus();
  let paged = await run(q);
  learnTitles(paged.results);
  // Typo tolerance: a weak literal answer is retried with the closest known
  // title, whose results lead; `exact=1` ("Rechercher plutôt …") opts out.
  let correctedQuery: string | null = null;
  if (page === 1 && req.nextUrl.searchParams.get("exact") !== "1" && !hasStrongMatch(q, paged.results)) {
    const correction = findCorrection(q);
    if (correction) {
      const corrected = await run(correction);
      if (corrected.results.length > 0) {
        learnTitles(corrected.results);
        const seen = new Set(corrected.results.map((r) => `${r.type}:${r.tmdbId}`));
        paged = { ...corrected, results: [...corrected.results, ...paged.results.filter((r) => !seen.has(`${r.type}:${r.tmdbId}`))] };
        correctedQuery = correction;
      }
    }
  }
  // Never blocks the response — a user searching while logged out (rare,
  // most routes require auth, this one intentionally doesn't) just doesn't
  // contribute a ledger row.
  const user = requireUser(req);
  if (type !== "movie" && page === 1 && isBleachSequelTitle(q) && !paged.results.some(r => r.type === "series" && r.tmdbId === 30984)) {
    const bleach = (await searchTv("Bleach", 1)).results.find(r => r.tmdbId === 30984);
    if (bleach) paged.results = [bleach, ...paged.results];
  }
  if (req.nextUrl.searchParams.get("partViews") === "1") paged.results = projectBleachSearchResults(paged.results);
  if (user) logSearch(user.id, q, paged.results.length);
  return NextResponse.json({ configured: true, ...paged, correctedQuery });
}
