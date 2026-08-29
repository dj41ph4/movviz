import { NextRequest, NextResponse } from "next/server";
import { getPipedYoutubePlaybackEnabled } from "@/lib/settings/trailerSources";
import { resolvePiped } from "@/lib/piped/client";
import { buildPipedDashManifest } from "@/lib/piped/dashManifest";

export const dynamic = "force-dynamic";

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await context.params;

  if (!videoId || !VIDEO_ID_RE.test(videoId)) {
    return NextResponse.json({ error: "invalid_videoId" }, { status: 400 });
  }

  if (!getPipedYoutubePlaybackEnabled()) {
    return NextResponse.json({ error: "piped_disabled" }, { status: 404 });
  }

  let streams;
  try {
    streams = await resolvePiped(videoId);
  } catch {
    return NextResponse.json({ error: "piped_error" }, { status: 502 });
  }

  if (!streams) {
    return NextResponse.json({ error: "piped_unavailable" }, { status: 502 });
  }

  let mpd: string;
  try {
    mpd = buildPipedDashManifest(streams, 1080);
  } catch {
    return NextResponse.json({ error: "manifest_build_failed" }, { status: 502 });
  }

  if (mpd.includes("<BaseURL>http://")) {
    return NextResponse.json({ error: "insecure_url_in_manifest" }, { status: 502 });
  }

  return new NextResponse(mpd, {
    status: 200,
    headers: {
      "Content-Type": "application/dash+xml",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
