import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { loadPlexConfig } from "@/lib/plex/store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { ratingKey: string } }) {
  if (!requireUser(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const cfg = loadPlexConfig();
  if (!cfg.hostname || !cfg.adminToken) {
    return NextResponse.json({ error: "plex_not_configured" }, { status: 400 });
  }

  const base = `${cfg.useSsl ? "https" : "http"}://${cfg.hostname}:${cfg.port}`;
  const token = cfg.adminToken;

  try {
    const metaUrl = `${base}/library/metadata/${params.ratingKey}?X-Plex-Token=${token}`;
    const metaRes = await fetch(metaUrl, {
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

    const media = metadata.Media?.[0];
    const part = media?.Part?.[0];
    if (!part?.id) {
      return NextResponse.json({ error: "no_media_part" }, { status: 404 });
    }

    const container = media.container || "mp4";
    const streamUrl = `${base}/library/parts/${part.id}/file.${container}?X-Plex-Token=${token}`;

    const streamRes = await fetch(streamUrl, {
      headers: { "x-plex-token": token },
      cache: "no-store",
      signal: AbortSignal.timeout(300000),
    });

    if (!streamRes.ok) {
      return NextResponse.json({ error: "stream_fetch_failed" }, { status: 502 });
    }

    return new NextResponse(streamRes.body, {
      status: streamRes.status,
      statusText: streamRes.statusText,
      headers: {
        "content-type": streamRes.headers.get("content-type") || "video/mp4",
        "content-length": streamRes.headers.get("content-length") || "",
        "accept-ranges": streamRes.headers.get("accept-ranges") || "bytes",
        "cache-control": "private, no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: "stream_error" }, { status: 500 });
  }
}
