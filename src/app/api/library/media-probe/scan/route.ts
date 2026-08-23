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

  // TODO_POST_MOTEUR_LECTURE.md item 2 — "force" bypasses the cache
  // entirely (re-probes every file); the default already behaves as an
  // incremental scan since getOrProbeMediaDescriptor skips anything whose
  // path/size/mtime hasn't changed since it was last probed.
  const force = req.nextUrl.searchParams.get("force") === "1";
  const label = force ? "Analyse complète de la bibliothèque" : "Analyse technique de la bibliothèque";

  enqueueJob(
    "mediaProbe",
    label,
    1,
    async (setProgress, ctx) =>
      probeAllLibraryMovies((current, total) => setProgress(current, total), {
        shouldCancel: () => isJobCancelled(ctx.jobId),
        force,
      }),
    SOURCE_ID
  );
  return NextResponse.json({ queued: true });
}
