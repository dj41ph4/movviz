import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { searchAllMissing, type SearchMissingScope } from "@/lib/library/searchMissing";
import { enqueueJob, isSourceActive } from "@/lib/jobs/queue";

export const dynamic = "force-dynamic";

/** Manual "search everything missing" trigger — queued like every other bulk search action. */
export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (isSourceActive("search-all-missing")) return NextResponse.json({ queued: true });

  const rawScope = req.nextUrl.searchParams.get("scope");
  const scope: SearchMissingScope = rawScope === "movie" || rawScope === "series" ? rawScope : "all";
  const label = scope === "movie"
    ? "Recherche des films manquants"
    : scope === "series"
      ? "Recherche des épisodes manquants"
      : "Recherche de tout ce qui est manquant";

  enqueueJob(
    "qualityUpgrade",
    label,
    1,
    async (setProgress) => {
      await searchAllMissing((current, total) => setProgress(current, total), scope);
    },
    "search-all-missing"
  );
  return NextResponse.json({ queued: true });
}
