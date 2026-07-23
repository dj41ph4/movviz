import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { loadPlexConfig } from "@/lib/plex/store";

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

  const base = `${cfg.useSsl ? "https" : "http"}://${cfg.hostname}:${cfg.port}`;
  const token = cfg.adminToken;
  const clientId = `movviz-${user.id}`;

  try {
    const metaUrl = `${base}/library/metadata/${ratingKey}?X-Plex-Token=${token}`;
    const metaRes = await fetch(metaUrl, {
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
      console.error("[stream info] metadata fetch failed", ratingKey, metaRes.status, body.slice(0, 500));
      return NextResponse.json({ error: "metadata_fetch_failed" }, { status: 502 });
    }

    const data = await metaRes.json();
    const metadata = data?.MediaContainer?.Metadata?.[0];
    const media = metadata?.Media?.[0];
    const part = media?.Part?.[0];

    const streams: Array<Record<string, unknown>> = Array.isArray(part?.Stream) ? part.Stream : [];

    const videoCodec: string | null =
      (streams.find((s) => s.streamType === 1) as { codec?: string } | undefined)?.codec ?? null;
    const audioCodec: string | null =
      (streams.find((s) => s.streamType === 2) as { codec?: string } | undefined)?.codec ?? null;

    // Audio + subtitle stream lists for the player menu (#5)
    const audioStreams = streams
      .filter((s) => s.streamType === 2)
      .map((s) => ({
        id: String(s.id ?? ""),
        codec: String(s.codec ?? ""),
        language: String(s.language ?? s.languageTag ?? ""),
        channels: Number(s.channels ?? 0),
        selected: Boolean(s.selected),
      }));
    const subtitleStreams = streams
      .filter((s) => s.streamType === 3)
      .map((s) => ({
        id: String(s.id ?? ""),
        codec: String(s.codec ?? ""),
        language: String(s.language ?? s.languageTag ?? ""),
        selected: Boolean(s.selected),
      }));

    return NextResponse.json(
      {
        videoCodec,
        audioCodec,
        container: media?.container ?? null,
        height: Number(media?.videoResolution ?? media?.height ?? 0) || null,
        audioStreams,
        subtitleStreams,
      },
      {
        headers: {
          "cache-control": "private, no-store",
          "access-control-allow-origin": corsOrigin(req),
          "access-control-allow-credentials": "true",
        },
      }
    );
  } catch (e) {
    console.error("[stream info] error", ratingKey, e);
    return NextResponse.json({ error: "metadata_fetch_failed" }, { status: 500 });
  }
}