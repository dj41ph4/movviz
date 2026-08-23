import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { enqueueJob, isJobCancelled, isSourceActive } from "@/lib/jobs/queue";
import { probeAllLibraryMovies } from "@/lib/playback/engine/probeLibrary";

export const dynamic = "force-dynamic";

const SOURCE_ID = "media-probe-library";

/** Manual "probe the whole library with ffprobe" trigger — queued like every
 *  other bulk background action (see search-missing/route.ts for the exact
 *  same shape). */
export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (isSourceActive(SOURCE_ID)) return NextResponse.json({ queued: true });

  enqueueJob(
    "mediaProbe",
    "Analyse technique de la bibliothèque",
    1,
    async (setProgress, ctx) =>
      probeAllLibraryMovies((current, total) => setProgress(current, total), {
        shouldCancel: () => isJobCancelled(ctx.jobId),
      }),
    SOURCE_ID
  );
  return NextResponse.json({ queued: true });
}
