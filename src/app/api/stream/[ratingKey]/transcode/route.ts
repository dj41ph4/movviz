import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { loadPlexConfig } from "@/lib/plex/store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ ratingKey: string }> };

export async function GET(req: NextRequest, context: Ctx) {
  if (!requireUser(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { ratingKey } = await context.params;

  const cfg = loadPlexConfig();
  if (!cfg.hostname || !cfg.adminToken) {
    return NextResponse.json({ error: "plex_not_configured" }, { status: 400 });
  }

  const base = `${cfg.useSsl ? "https" : "http"}://${cfg.hostname}:${cfg.port}`;
  const token = cfg.adminToken;
  const sessionId = crypto.randomUUID();

  const metadataUrl = `${base}/library/metadata/${ratingKey}?X-Plex-Token=${token}`;
  const metaRes = await fetch(metadataUrl, {
    headers: { accept: "application/json", "x-plex-token": token },
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!metaRes.ok) {
    return NextResponse.json({ error: "metadata_fetch_failed" }, { status: 502 });
  }

  const data = await metaRes.json();
  const metadata = data?.MediaContainer?.Metadata?.[0];
  if (!metadata) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const transcodePath = encodeURIComponent(`${base}/library/metadata/${ratingKey}`);
  const transcodeUrl = `${base}/video/:/transcode/universal/start.m3u8` +
    `?path=${transcodePath}` +
    `&mediaIndex=0&partIndex=0` +
    `&protocol=hls&videoCodec=h264&audioCodec=aac` +
    `&fastSeek=1&directPlay=0&directStream=0` +
    `&subtitleSize=100&session=${sessionId}` +
    `&X-Plex-Token=${token}`;

  try {
    const m3u8Res = await fetch(transcodeUrl, {
      headers: { "x-plex-token": token },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!m3u8Res.ok) {
      return NextResponse.json({ error: "transcode_start_failed" }, { status: 502 });
    }

    const raw = await m3u8Res.text();
    const proxyBase = `/api/stream/plex-proxy`;
    const rewritten = raw.replace(
      /(https?:\/\/[^\/]+)?(\/playlists\/[^\s"']*)/g,
      (_match, _host, path) => `${proxyBase}${path}`
    );

    return new NextResponse(rewritten, {
      headers: {
        "content-type": "application/vnd.apple.mpegurl",
        "cache-control": "private, no-store",
        "access-control-allow-origin": "*",
      },
    });
  } catch {
    return NextResponse.json({ error: "transcode_error" }, { status: 500 });
  }
}
