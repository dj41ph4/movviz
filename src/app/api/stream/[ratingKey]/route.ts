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

  try {
    const metaUrl = `${base}/library/metadata/${ratingKey}?X-Plex-Token=${token}`;
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

    const plexHeaders: Record<string, string> = { "x-plex-token": token };
    const range = req.headers.get("range");
    if (range) plexHeaders["range"] = range;

    const streamRes = await fetch(streamUrl, {
      headers: plexHeaders,
      cache: "no-store",
      signal: AbortSignal.timeout(300000),
    });

    if (!streamRes.ok && streamRes.status !== 206) {
      return NextResponse.json({ error: "stream_fetch_failed" }, { status: 502 });
    }

    const resHeaders: Record<string, string> = {
      "content-type": streamRes.headers.get("content-type") || "video/mp4",
      "cache-control": "private, no-store",
    };
    for (const h of ["content-length", "content-range", "accept-ranges"] as const) {
      const v = streamRes.headers.get(h);
      if (v) resHeaders[h] = v;
    }

    return new NextResponse(streamRes.body, {
      status: streamRes.status,
      statusText: streamRes.statusText,
      headers: resHeaders,
    });
  } catch (e) {
    return NextResponse.json({ error: "stream_error" }, { status: 500 });
  }
}
