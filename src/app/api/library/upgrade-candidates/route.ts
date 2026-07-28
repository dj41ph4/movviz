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
const g = globalThis as typeof globalThis & {
  __movvizUpgradeCandidatesCache?: { result: Result; computedAt: number };
  __movvizUpgradeCandidatesInFlight?: Promise<Result>;
};

async function computeCached(): Promise<Result> {
  const cached = g.__movvizUpgradeCandidatesCache;
  if (cached && Date.now() - cached.computedAt < CACHE_TTL_MS) return cached.result;
  if (g.__movvizUpgradeCandidatesInFlight) return g.__movvizUpgradeCandidatesInFlight;

  const run = (async () => {
    // Sequential, not Promise.all — each of these already fires its own
    // sequential indexer searches for its live-fallback subset; running both
    // at once would double the concurrent request stream hitting the same
    // indexers instead of keeping a single paced stream.
    const candidates = await findUpgradeCandidates();
    const episodeCandidates = await findEpisodeUpgradeCandidates();
    const result = { candidates, episodeCandidates };
    g.__movvizUpgradeCandidatesCache = { result, computedAt: Date.now() };
    return result;
  })();
  g.__movvizUpgradeCandidatesInFlight = run;
  try {
    return await run;
  } finally {
    g.__movvizUpgradeCandidatesInFlight = undefined;
  }
}

/** Read-only — never grabs anything. See searchAndReplace.ts / searchAndReplaceSeries.ts for the comparison logic. */
export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { candidates, episodeCandidates } = await computeCached();
  return NextResponse.json({ candidates, episodeCandidates });
}
