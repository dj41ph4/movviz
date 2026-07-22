import { NextRequest, NextResponse } from "next/server";
import { loadSeries } from "@/lib/library/store";
import { requireUser } from "@/lib/auth/guard";
import { requestMedia } from "@/lib/requests/requestMedia";
import { loadPlexConfig } from "@/lib/plex/store";
import { buildPlexWebUrl } from "@/lib/plex/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const cfg = loadPlexConfig();
  const urlFor = (ratingKey: string | null) => (ratingKey && cfg.machineIdentifier ? buildPlexWebUrl(cfg.machineIdentifier, ratingKey) : null);
  const series = loadSeries().map((s) => ({
    ...s,
    plexUrl: urlFor(s.plexRatingKey),
  }));
  return NextResponse.json({ series });
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
  if ("added" in result) return NextResponse.json({ ...result.added, searchResult: result.searchResult }, { status: 201 });
  return NextResponse.json({ pendingRequest: result.pendingRequest }, { status: 202 });
}
