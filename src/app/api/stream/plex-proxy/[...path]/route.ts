import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { loadPlexConfig } from "@/lib/plex/store";
import { safePlexUrl } from "@/lib/plex/safeUrl";
import { getStreamCacheTtl } from "@/lib/settings/betaPlayer";
import { plexClientHeaders, rewriteM3u8 } from "@/lib/player/plexStream";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ path: string[] }> };

function corsOrigin(req: NextRequest): string {
  const referer = req.headers.get("referer");
  if (referer) {
    try {
      const u = new URL(referer);
      return `${u.protocol}//${u.host}`;
    } catch { /* fallthrough */ }
  }
  return req.headers.get("origin") || "null";
}

function buildEtag(input: string | Buffer): string {
  const str = typeof input === "string" ? input : input.toString("base64");
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return `"${Math.abs(hash).toString(36)}"`;
}

interface CacheEntry {
  body: Buffer;
  contentType: string;
  status: number;
  etag: string;
  expires: number;
}

type SegmentCache = Map<string, CacheEntry>;
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ENTRIES = 300;

function getCache(): SegmentCache {
  const g = globalThis as unknown as { __movvizPlexProxyCache?: SegmentCache };
  if (!g.__movvizPlexProxyCache) g.__movvizPlexProxyCache = new Map();
  return g.__movvizPlexProxyCache;
}

function cacheGet(key: string): CacheEntry | null {
  const cache = getCache();
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expires < Date.now()) {
    cache.delete(key);
    return null;
  }
  // LRU touch
  cache.delete(key);
  cache.set(key, entry);
  return entry;
}

function cacheSet(key: string, entry: CacheEntry): void {
  const cache = getCache();
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, entry);
}

const MAX_CACHEABLE_SIZE = 8 * 1024 * 1024;

export async function GET(req: NextRequest, context: Ctx) {
  // Auth: browser sends session cookie (same-origin). Reject anonymous.
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { path } = await context.params;
  const cfg = loadPlexConfig();
  if (!cfg.hostname || !cfg.adminToken) {
    return NextResponse.json({ error: "plex_not_configured" }, { status: 400 });
  }

  const base = safePlexUrl(`${cfg.useSsl ? "https" : "http"}://${cfg.hostname}:${cfg.port}`);
  if (!base) return NextResponse.json({ error: "invalid_plex_url" }, { status: 500 });
  const token = cfg.adminToken;
  const clientId = `movviz-${user.id}`;

  // Rebuild Plex path. Catch-all may split "video" / ":" / "transcode" / ...
  const plexPath = "/" + path.map((p) => decodeURIComponent(p)).join("/");
  const qs = new URLSearchParams(req.nextUrl.searchParams);
  // Never trust client-supplied token — always inject ours
  qs.delete("X-Plex-Token");
  qs.delete("X-Plex-Token".toLowerCase());

  const plexUrl = `${base}${plexPath}${qs.toString() ? `?${qs.toString()}` : ""}`;

  const plexHeaders: Record<string, string> = {
    ...plexClientHeaders(token, clientId),
  };
  const range = req.headers.get("range");
  if (range) plexHeaders["range"] = range;

  const cacheTtl = getStreamCacheTtl();
  const cacheControl = cacheTtl > 0 ? `private, max-age=${cacheTtl}` : "private, no-store";
  const corsHeaders: Record<string, string> = {
    "access-control-allow-origin": corsOrigin(req),
    "access-control-allow-credentials": "true",
  };

  const isPlaylistPath = plexPath.endsWith(".m3u8") || path.some((p) => p.endsWith(".m3u8"));
  const cacheKey = `${plexUrl}|${range ?? ""}`;

  // Cache playlists + small non-range segments
  if (isPlaylistPath || !range) {
    const cached = cacheGet(cacheKey);
    if (cached) {
      if (req.headers.get("if-none-match") === cached.etag) {
        return new NextResponse(null, {
          status: 304,
          headers: { etag: cached.etag, "cache-control": cacheControl, ...corsHeaders },
        });
      }
      return new NextResponse(new Uint8Array(cached.body), {
        status: cached.status,
        headers: {
          "content-type": cached.contentType,
          "cache-control": cacheControl,
          etag: cached.etag,
          "x-movviz-cache": "HIT",
          ...corsHeaders,
        },
      });
    }
  }

  const fetchPlex = (signal: AbortSignal) =>
    fetch(plexUrl, {
      headers: plexHeaders,
      cache: "no-store",
      signal,
    });

  try {
    let plexRes: Response;
    try {
      plexRes = await fetchPlex(AbortSignal.timeout(30000));
      // Retry transient gateway errors (Plex still spinning up the segment)
      if (plexRes.status === 502 || plexRes.status === 504 || plexRes.status === 503) {
        await new Promise((r) => setTimeout(r, 250));
        plexRes = await fetchPlex(AbortSignal.timeout(30000));
        if (plexRes.status === 502 || plexRes.status === 504 || plexRes.status === 503) {
          await new Promise((r) => setTimeout(r, 400));
          plexRes = await fetchPlex(AbortSignal.timeout(30000));
        }
      }
    } catch (e) {
      console.error("[plex-proxy] fetch error", plexPath, e);
      return NextResponse.json({ error: "proxy_error" }, { status: 500 });
    }

    if (!plexRes.ok && plexRes.status !== 206) {
      const body = await plexRes.text().catch(() => "");
      console.error("[plex-proxy] fetch failed", plexRes.status, plexPath, body.slice(0, 300));
      return NextResponse.json({ error: "proxy_fetch_failed" }, { status: plexRes.status });
    }

    const contentType = plexRes.headers.get("content-type") || "";
    const isPlaylist =
      isPlaylistPath ||
      contentType.includes("mpegurl") ||
      contentType.includes("m3u") ||
      contentType.includes("application/vnd.apple.mpegurl");

    if (isPlaylist) {
      const raw = await plexRes.text();
      const rewritten = rewriteM3u8(raw, plexPath);
      const etag = buildEtag(rewritten);

      if (req.headers.get("if-none-match") === etag) {
        return new NextResponse(null, {
          status: 304,
          headers: { etag, "cache-control": cacheControl, ...corsHeaders },
        });
      }

      const bodyBuf = Buffer.from(rewritten, "utf8");
      if (bodyBuf.byteLength <= MAX_CACHEABLE_SIZE) {
        // Media playlists are live — short TTL
        cacheSet(cacheKey, {
          body: bodyBuf,
          contentType: "application/vnd.apple.mpegurl",
          status: 200,
          etag,
          expires: Date.now() + Math.min(CACHE_TTL_MS, 15_000),
        });
      }
      return new NextResponse(new Uint8Array(bodyBuf), {
        headers: {
          "content-type": "application/vnd.apple.mpegurl",
          "cache-control": "private, max-age=5",
          etag,
          "x-movviz-cache": "MISS",
          ...corsHeaders,
        },
      });
    }

    const resHeaders: Record<string, string> = {
      "content-type": contentType || "application/octet-stream",
      "cache-control": cacheControl,
      ...corsHeaders,
    };
    for (const h of ["content-length", "content-range", "accept-ranges"] as const) {
      const v = plexRes.headers.get(h);
      if (v) resHeaders[h] = v;
    }

    const contentLength = Number(plexRes.headers.get("content-length") ?? "0");
    if (contentLength > 0 && contentLength <= MAX_CACHEABLE_SIZE && !range) {
      const buf = Buffer.from(await plexRes.arrayBuffer());
      const etag = buildEtag(buf);

      if (req.headers.get("if-none-match") === etag) {
        return new NextResponse(null, {
          status: 304,
          headers: { etag, "cache-control": cacheControl, ...corsHeaders },
        });
      }

      cacheSet(cacheKey, {
        body: buf,
        contentType: resHeaders["content-type"],
        status: plexRes.status,
        etag,
        expires: Date.now() + CACHE_TTL_MS,
      });
      return new NextResponse(new Uint8Array(buf), {
        status: plexRes.status,
        statusText: plexRes.statusText,
        headers: { ...resHeaders, etag, "x-movviz-cache": "MISS" },
      });
    }

    return new NextResponse(plexRes.body, {
      status: plexRes.status,
      statusText: plexRes.statusText,
      headers: resHeaders,
    });
  } catch (e) {
    console.error("[plex-proxy] error", plexPath, e);
    return NextResponse.json({ error: "proxy_error" }, { status: 500 });
  }
}
