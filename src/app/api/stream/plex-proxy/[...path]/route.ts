import { NextRequest, NextResponse } from "next/server";
import { loadPlexConfig } from "@/lib/plex/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, context: Ctx) {
  const { path } = await context.params;
  const cfg = loadPlexConfig();
  if (!cfg.hostname || !cfg.adminToken) {
    return NextResponse.json({ error: "plex_not_configured" }, { status: 400 });
  }

  const base = `${cfg.useSsl ? "https" : "http"}://${cfg.hostname}:${cfg.port}`;
  const token = cfg.adminToken;

  const qs = req.nextUrl.searchParams;
  qs.set("X-Plex-Token", token);

  const plexUrl = `${base}/${path.join("/")}?${qs.toString()}`;

  try {
    const plexHeaders: Record<string, string> = { "x-plex-token": token };
    const range = req.headers.get("range");
    if (range) plexHeaders["range"] = range;

    const plexRes = await fetch(plexUrl, {
      headers: plexHeaders,
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });

    if (!plexRes.ok && plexRes.status !== 206) {
      return NextResponse.json({ error: "proxy_fetch_failed" }, { status: plexRes.status });
    }

    const contentType = plexRes.headers.get("content-type") || "";
    const isPlaylist = contentType.includes("mpegurl") || contentType.includes("m3u");

    if (isPlaylist) {
      const raw = await plexRes.text();
      const proxyBase = `/api/stream/plex-proxy`;
      const rewritten = raw.replace(
        /(https?:\/\/[^\/]+)?(\/playlists\/[^\s"']*)/g,
        (_match, _host, p) => `${proxyBase}${p}`
      );
      return new NextResponse(rewritten, {
        headers: {
          "content-type": contentType,
          "cache-control": "private, no-store",
          "access-control-allow-origin": "*",
        },
      });
    }

    const resHeaders: Record<string, string> = {
      "content-type": contentType,
      "cache-control": "private, no-store",
      "access-control-allow-origin": "*",
    };
    for (const h of ["content-length", "content-range", "accept-ranges"] as const) {
      const v = plexRes.headers.get(h);
      if (v) resHeaders[h] = v;
    }

    return new NextResponse(plexRes.body, {
      status: plexRes.status,
      statusText: plexRes.statusText,
      headers: resHeaders,
    });
  } catch {
    return NextResponse.json({ error: "proxy_error" }, { status: 500 });
  }
}
