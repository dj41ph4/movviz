import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { enqueueJob, isJobCancelled, isSourceActive } from "@/lib/jobs/queue";
import { probeAllLibraryMovies, probeAllLibrarySeries } from "@/lib/playback/engine/probeLibrary";

export const dynamic = "force-dynamic";

const SOURCE_ID_MOVIES = "media-probe-library-movies";
const SOURCE_ID_SERIES = "media-probe-library-series";

/** Manual "probe the whole library with ffprobe" trigger — queued like every
 *  other bulk background action (see search-missing/route.ts for the exact
 *  same shape). `kind=series` runs the episode walker instead of the movie
 *  one — separate sourceId so a movie scan and a series scan can run
 *  independently without blocking each other. */
export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const kind = req.nextUrl.searchParams.get("kind") === "series" ? "series" : "movies";
  const sourceId = kind === "series" ? SOURCE_ID_SERIES : SOURCE_ID_MOVIES;
  if (isSourceActive(sourceId)) return NextResponse.json({ queued: true });

  // TODO_POST_MOTEUR_LECTURE.md item 2 — "force" bypasses the cache
  // entirely (re-probes every file); the default already behaves as an
  // incremental scan since getOrProbeMediaDescriptor skips anything whose
  // path/size/mtime hasn't changed since it was last probed.
  const force = req.nextUrl.searchParams.get("force") === "1";
  const label =
    kind === "series"
      ? force
        ? "Analyse complète des séries"
        : "Analyse technique des séries"
      : force
        ? "Analyse complète de la bibliothèque"
        : "Analyse technique de la bibliothèque";

  enqueueJob(
    "mediaProbe",
    label,
    1,
    async (setProgress, ctx) =>
      kind === "series"
        ? probeAllLibrarySeries((current, total) => setProgress(current, total), {
            shouldCancel: () => isJobCancelled(ctx.jobId),
            force,
          })
        : probeAllLibraryMovies((current, total) => setProgress(current, total), {
            shouldCancel: () => isJobCancelled(ctx.jobId),
            force,
          }),
    sourceId
  );
  return NextResponse.json({ queued: true });
}
