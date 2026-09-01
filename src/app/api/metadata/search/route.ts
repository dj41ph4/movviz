import { NextRequest, NextResponse } from "next/server";
import { searchMulti, searchTv, searchPeople, tmdbConfigured } from "@/lib/metadata/tmdb";
import { requireUser } from "@/lib/auth/guard";
import { recordUserContextEvent } from "@/lib/userContext/ingest";

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

  let paged;
  if (type === "series") {
    paged = await searchTv(q, page);
  } else if (type === "movie") {
    paged = await searchMulti(q, page);
    paged.results = paged.results.filter((r) => r.type === "movie");
  } else {
    paged = await searchMulti(q, page);
  }
  // Never blocks the response — a user searching while logged out (rare,
  // most routes require auth, this one intentionally doesn't) just doesn't
  // contribute a ledger row.
  const user = requireUser(req);
  if (user) logSearch(user.id, q, paged.results.length);
  return NextResponse.json({ configured: true, ...paged });
}
