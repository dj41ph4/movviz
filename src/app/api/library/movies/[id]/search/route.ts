import { NextRequest, NextResponse } from "next/server";
import { searchAndGrabMovie } from "@/lib/library/autoGrab";
import { getMovie } from "@/lib/library/store";
import { enqueueJob } from "@/lib/jobs/queue";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/**
 * Manual "search now" trigger — same automation the add flow runs on its
 * own. Searching every configured indexer and grabbing the best release can
 * take several seconds; this used to hold the button's request open for the
 * whole thing, so the UI just sat there waiting. Queued instead: the button
 * gets an immediate response, and the movie's status flips to "searching"
 * (already visible via the library poll) the moment the job actually starts.
 */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const movie = getMovie(id);
  if (!movie) return NextResponse.json({ error: "movie not found" }, { status: 404 });

  enqueueJob("qualityUpgrade", `Recherche : ${movie.title}`, 1, async (setProgress) => {
    await searchAndGrabMovie(id);
    setProgress(1, 1);
  }, `movie-search-${id}`);
  return NextResponse.json({ queued: true });
}
