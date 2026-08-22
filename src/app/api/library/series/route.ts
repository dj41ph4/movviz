import { NextRequest, NextResponse } from "next/server";
import { loadSeries } from "@/lib/library/store";
import { requireUser } from "@/lib/auth/guard";
import { requestMedia } from "@/lib/requests/requestMedia";
import { loadPlexConfig } from "@/lib/plex/store";
import { buildPlexWebUrl } from "@/lib/plex/client";
import { loadTrash } from "@/lib/library/trashStore";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const cfg = loadPlexConfig();
  const urlFor = (ratingKey: string | null) => (ratingKey && cfg.machineIdentifier ? buildPlexWebUrl(cfg.machineIdentifier, ratingKey) : null);
  // A title page only ever needs its own single match — fetching the whole
  // library (every series, full season/episode structures) just to .find()
  // one by tmdbId client-side was the actual cause of "why does this page
  // take forever to know if the title is already in the library". Optional
  // filter, additive: omitting tmdbId keeps returning the full list for
  // callers that need it (the Bibliothèque page itself).
  const tmdbIdParam = req.nextUrl.searchParams.get("tmdbId");
  const tmdbId = tmdbIdParam ? Number(tmdbIdParam) : null;
  const all = tmdbId ? loadSeries().filter((s) => s.tmdbId === tmdbId) : loadSeries();
  const series = all.map((s) => ({
    ...s,
    playable: s.seasons.some((season) => season.episodes.some((ep) => ep.status === "available" && !!ep.file)),
    playbackSource: s.seasons.some((season) => season.episodes.some((ep) => ep.status === "available" && !!ep.file)) ? "movviz" as const : (s.plexRatingKey ? "plex" as const : null),
    plexUrl: urlFor(s.plexRatingKey),
  }));
  const readdable = !!tmdbId && loadTrash().some((t) => t.type === "series" && t.tmdbId === tmdbId);
  return NextResponse.json({ series, readdable });
}

/** Same auto-approve/pending-request split as movies (see /api/library/movies). */
export async function POST(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const tmdbId = Number(body.tmdbId);
  if (!tmdbId) return NextResponse.json({ error: "tmdbId required" }, { status: 400 });

  const result = await requestMedia(user, "series", tmdbId, body.qualityProfileId, body.seasonNumbers, { skipSearch: body.skipSearch === true });
  if ("blocked" in result) return NextResponse.json(result, { status: 403 });
  if ("quotaReached" in result) return NextResponse.json(result, { status: 429 });
  if ("error" in result) return NextResponse.json(result, { status: 404 });
  if ("alreadyInLibrary" in result) return NextResponse.json(result, { status: 200 });
  if ("duplicateRequest" in result) return NextResponse.json(result, { status: 200 });
  if ("added" in result) return NextResponse.json({ ...result.added, searchResult: result.searchResult, readded: result.readded === true }, { status: 201 });
  return NextResponse.json({ pendingRequest: result.pendingRequest }, { status: 202 });
}
