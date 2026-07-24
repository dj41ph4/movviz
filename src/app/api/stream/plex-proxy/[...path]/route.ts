import { NextRequest, NextResponse } from "next/server";
import { loadPlexConfig } from "@/lib/plex/store";
import { safePlexUrl } from "@/lib/plex/safeUrl";
import { getStreamCacheTtl } from "@/lib/settings/betaPlayer";

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
  const { path } = await context.params;
  const cfg = loadPlexConfig();
  if (!cfg.hostname || !cfg.adminToken) {
    return NextResponse.json({ error: "plex_not_configured" }, { status: 400 });
  }

  const base = safePlexUrl(`${cfg.useSsl ? "https" : "http"}://${cfg.hostname}:${cfg.port}`);
  if (!base) return NextResponse.json({ error: "invalid_plex_url" }, { status: 500 });
  const token = cfg.adminToken;

  const qs = req.nextUrl.searchParams;
  qs.set("X-Plex-Token", token);

  const plexUrl = `${base}/${path.join("/")}?${qs.toString()}`;

  const plexHeaders: Record<string, string> = {
    "x-plex-token": token,
    "x-plex-client-identifier": "movviz-proxy",
  };
  const range = req.headers.get("range");
  if (range) plexHeaders["range"] = range;

  const cacheTtl = getStreamCacheTtl();
  const cacheControl = cacheTtl > 0 ? `private, max-age=${cacheTtl}` : "private, no-store";
  const corsHeaders: Record<string, string> = {
    "access-control-allow-origin": corsOrigin(req),
    "access-control-allow-credentials": "true",
  };

  const isPlaylistPath = path.some((p) => p.endsWith(".m3u8"));

  const cacheKey = `${plexUrl}|${range ?? ""}`;

  if (isPlaylistPath || !range) {
    const cached = cacheGet(cacheKey);
    if (cached) {
      if (req.headers.get("if-none-match") === cached.etag) {
        return new NextResponse(null, {
          status: 304,
          headers: {
            etag: cached.etag,
            "cache-control": cacheControl,
            ...corsHeaders,
          },
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
      if (plexRes.status === 502 || plexRes.status === 504) {
        await new Promise((r) => setTimeout(r, 200));
        plexRes = await fetchPlex(AbortSignal.timeout(30000));
        if (plexRes.status === 502 || plexRes.status === 504) {
          await new Promise((r) => setTimeout(r, 200));
          plexRes = await fetchPlex(AbortSignal.timeout(30000));
        }
      }
    } catch (e) {
      console.error("[plex-proxy] fetch error", plexUrl, e);
      return NextResponse.json({ error: "proxy_error" }, { status: 500 });
    }

    if (!plexRes.ok && plexRes.status !== 206) {
      const body = await plexRes.text().catch(() => "");
      console.error("[plex-proxy] fetch failed", plexRes.status, plexUrl, body.slice(0, 500));
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
      const etag = buildEtag(rewritten);

      if (req.headers.get("if-none-match") === etag) {
        return new NextResponse(null, {
          status: 304,
          headers: { etag, "cache-control": cacheControl, ...corsHeaders },
        });
      }

      const body = new Uint8Array(Buffer.from(rewritten));
      if (body.byteLength <= MAX_CACHEABLE_SIZE) {
        cacheSet(cacheKey, {
          body: Buffer.from(rewritten),
          contentType,
          status: 200,
          etag,
          expires: Date.now() + CACHE_TTL_MS,
        });
      }
      return new NextResponse(body, {
        headers: {
          "content-type": contentType,
          "cache-control": cacheControl,
          etag,
          "x-movviz-cache": "MISS",
          ...corsHeaders,
        },
      });
    }

    const resHeaders: Record<string, string> = {
      "content-type": contentType,
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
        contentType,
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
    console.error("[plex-proxy] error", plexUrl, e);
    return NextResponse.json({ error: "proxy_error" }, { status: 500 });
  }
}
