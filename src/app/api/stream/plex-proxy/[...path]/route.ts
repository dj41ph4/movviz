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
    const plexRes = await fetch(plexUrl, {
      headers: { "x-plex-token": token },
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });

    if (!plexRes.ok) {
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

    return new NextResponse(plexRes.body, {
      headers: {
        "content-type": contentType,
        "content-length": plexRes.headers.get("content-length") || "",
        "cache-control": "private, no-store",
        "access-control-allow-origin": "*",
      },
    });
  } catch {
    return NextResponse.json({ error: "proxy_error" }, { status: 500 });
  }
}
