import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { loadPlexConfig } from "@/lib/plex/store";
import { getStreamCacheTtl } from "@/lib/settings/betaPlayer";
import { registerSession } from "@/lib/player/transcodeSessions";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ ratingKey: string }> };

/** Resolve CORS origin from the referer (preferred) then the Origin header, else "null". */
function corsOrigin(req: NextRequest): string {
  const referer = req.headers.get("referer");
  if (referer) {
    try {
      const u = new URL(referer);
      return `${u.protocol}//${u.host}`;
    } catch {
      /* fallthrough */
    }
  }
  return req.headers.get("origin") || "null";
}

export async function GET(req: NextRequest, context: Ctx) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { ratingKey } = await context.params;

  const cfg = loadPlexConfig();
  if (!cfg.hostname || !cfg.adminToken) {
    return NextResponse.json({ error: "plex_not_configured" }, { status: 400 });
  }

  if (!registerSession(user.id, ratingKey)) {
    return NextResponse.json({ error: "too_many_transcode_sessions" }, { status: 429 });
  }

  const base = `${cfg.useSsl ? "https" : "http"}://${cfg.hostname}:${cfg.port}`;
  const token = cfg.adminToken;
  const clientId = `movviz-${user.id}`;
  const sessionId = `movviz-${user.id}-${ratingKey}`;

  const metadataUrl = `${base}/library/metadata/${ratingKey}?X-Plex-Token=${token}`;
  const metaRes = await fetch(metadataUrl, {
    headers: {
      accept: "application/json",
      "x-plex-token": token,
      "x-plex-client-identifier": clientId,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!metaRes.ok) {
    const body = await metaRes.text().catch(() => "");
    console.error("[transcode] metadata fetch failed", ratingKey, metaRes.status, body.slice(0, 500));
    return NextResponse.json({ error: "metadata_fetch_failed" }, { status: 502 });
  }

  const data = await metaRes.json();
  const metadata = data?.MediaContainer?.Metadata?.[0];
  if (!metadata) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Derive a sensible transcode bitrate cap from the source resolution.
  const media = metadata?.Media?.[0];
  const height = Number(media?.videoResolution ?? media?.height ?? 0);
  let maxVideoBitrate = 8000;
  if (height >= 2000) maxVideoBitrate = 15000;
  else if (height >= 1440) maxVideoBitrate = 10000;
  else if (height >= 1000) maxVideoBitrate = 8000;
  else if (height >= 700) maxVideoBitrate = 4000;
  else maxVideoBitrate = 2000;

  // Optional audio/subtitle stream selection from query params (#5)
  const sp = req.nextUrl.searchParams;
  const audioStreamID = sp.get("audioStreamID");
  const subtitleStreamID = sp.get("subtitleStreamID");

  const transcodePath = encodeURIComponent(`${base}/library/metadata/${ratingKey}`);
  let transcodeUrl =
    `${base}/video/:/transcode/universal/start.m3u8` +
    `?path=${transcodePath}` +
    `&mediaIndex=0&partIndex=0` +
    `&protocol=hls&videoCodec=h264&audioCodec=aac` +
    `&fastSeek=1&directPlay=1&directStream=1` +
    `&maxVideoBitrate=${maxVideoBitrate}` +
    `&subtitleSize=100&session=${encodeURIComponent(sessionId)}` +
    `&X-Plex-Token=${token}` +
    `&X-Plex-Client-Identifier=${encodeURIComponent(clientId)}`;

  if (audioStreamID) transcodeUrl += `&audioStreamID=${encodeURIComponent(audioStreamID)}`;
  if (subtitleStreamID) transcodeUrl += `&subtitleStreamID=${encodeURIComponent(subtitleStreamID)}`;

  try {
    const m3u8Res = await fetch(transcodeUrl, {
      headers: {
        "x-plex-token": token,
        "x-plex-client-identifier": clientId,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!m3u8Res.ok) {
      const body = await m3u8Res.text().catch(() => "");
      console.error("[transcode] start failed", ratingKey, m3u8Res.status, body.slice(0, 500));
      return NextResponse.json({ error: "transcode_start_failed" }, { status: 502 });
    }

    const raw = await m3u8Res.text();
    const proxyBase = `/api/stream/plex-proxy`;
    const cacheTtl = getStreamCacheTtl();

    const rewritten = raw.replace(
      /(https?:\/\/[^\/]+)?(\/playlists\/[^\s"']*)/g,
      (_match, _host, path) => `${proxyBase}${path}`
    );

    return new NextResponse(rewritten, {
      headers: {
        "content-type": "application/vnd.apple.mpegurl",
        "cache-control": cacheTtl > 0 ? `public, max-age=${cacheTtl}` : "private, no-store",
        "access-control-allow-origin": corsOrigin(req),
        "access-control-allow-credentials": "true",
      },
    });
  } catch (e) {
    console.error("[transcode] error", ratingKey, e);
    return NextResponse.json({ error: "transcode_error" }, { status: 500 });
  }
}