import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { findUpgradeCandidates, type UpgradeCandidate } from "@/lib/library/searchAndReplace";
import { findEpisodeUpgradeCandidates, type EpisodeUpgradeCandidate } from "@/lib/library/searchAndReplaceSeries";

export const dynamic = "force-dynamic";

type Result = { candidates: UpgradeCandidate[]; episodeCandidates: EpisodeUpgradeCandidate[] };

// This is a real multi-minute scan (up to 25 movies + 25 episodes falling
// back to live indexer searches each) — the dashboard's "upgradesAvailable"
// row and the manual "Rechercher et remplacer" panel both hit this route,
// and neither one is queued/deduped like every other bulk search action in
// this app (see search-missing's isSourceActive guard). Without a cache and
// an in-flight guard here, opening the panel twice, having the dashboard
// mounted in two tabs, or even just the SWR client retrying could pile up
// several full concurrent scans hammering the indexers and the CPU at once.
// A short cache plus sharing one in-flight computation across concurrent
// callers closes that gap without changing either caller's contract.
const CACHE_TTL_MS = 10 * 60 * 1000;
// Keyed by mode ("live"/"cache") — a cache-only dashboard result must never
// be served to the manual panel (it would silently hide real live-search
// candidates), and vice versa isn't worth serving either (the eager
// dashboard row has no business getting the slow full scan just because
// the panel happened to prime the cache first).
const g = globalThis as typeof globalThis & {
  __movvizUpgradeCandidatesCache?: Map<string, { result: Result; computedAt: number }>;
  __movvizUpgradeCandidatesInFlight?: Map<string, Promise<Result>>;
};
const cacheMap = (g.__movvizUpgradeCandidatesCache ??= new Map());
const inFlightMap = (g.__movvizUpgradeCandidatesInFlight ??= new Map());

async function computeCached(liveSearch: boolean): Promise<Result> {
  const key = liveSearch ? "live" : "cache";
  const cached = cacheMap.get(key);
  if (cached && Date.now() - cached.computedAt < CACHE_TTL_MS) return cached.result;
  const inFlight = inFlightMap.get(key);
  if (inFlight) return inFlight;

  const run = (async () => {
    // Sequential, not Promise.all — each of these already fires its own
    // sequential indexer searches for its live-fallback subset; running both
    // at once would double the concurrent request stream hitting the same
    // indexers instead of keeping a single paced stream.
    const candidates = await findUpgradeCandidates(liveSearch);
    const episodeCandidates = await findEpisodeUpgradeCandidates(liveSearch);
    const result = { candidates, episodeCandidates };
    cacheMap.set(key, { result, computedAt: Date.now() });
    return result;
  })();
  inFlightMap.set(key, run);
  try {
    return await run;
  } finally {
    inFlightMap.delete(key);
  }
}

/** Read-only — never grabs anything. See searchAndReplace.ts / searchAndReplaceSeries.ts
 *  for the comparison logic. `?liveSearch=0` (the dashboard's eager row) skips the
 *  slow per-item live-indexer fallback and stays cache-only/fast; omitting it (the
 *  manual "Rechercher et remplacer" panel) keeps the full live-search behavior. */
export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const liveSearch = req.nextUrl.searchParams.get("liveSearch") !== "0";
  const { candidates, episodeCandidates } = await computeCached(liveSearch);
  return NextResponse.json({ candidates, episodeCandidates });
}
