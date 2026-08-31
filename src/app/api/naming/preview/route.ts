import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { renderSegment } from "@/lib/naming/render";
import { SAMPLE_MOVIE, SAMPLE_EPISODE } from "@/lib/naming/defaults";
import path from "node:path";

export const dynamic = "force-dynamic";

/** Render a live preview of the current (unsaved) template edits. */
export async function POST(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  const dots = !!body.useDotsInsteadOfSpaces;

  const movieFolder = renderSegment(body.movieFolder ?? "", SAMPLE_MOVIE, dots);
  const movieFile = renderSegment(body.movieFile ?? "", SAMPLE_MOVIE, dots);
  const seriesFolder = renderSegment(body.seriesFolder ?? "", SAMPLE_EPISODE, dots);
  const seasonFolder = renderSegment(body.seasonFolder ?? "", SAMPLE_EPISODE, dots);
  const episodeFile = renderSegment(body.episodeFile ?? "", SAMPLE_EPISODE, dots);

  return NextResponse.json({
    movie: path.join(movieFolder, movieFile + ".mkv"),
    episode: path.join(seriesFolder, seasonFolder, episodeFile + ".mkv"),
  });
}
