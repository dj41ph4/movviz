/**
 * Shared helpers for Plex universal HLS streaming.
 *
 * Plex 1.40+ rejects /video/:/transcode/universal/start.m3u8 without
 * X-Plex-Product / Platform / Device headers (HTTP 400).
 *
 * Master playlists return relative URIs like:
 *   session/{id}/base/index.m3u8
 * resolved against /video/:/transcode/universal/ — NOT /playlists/.
 */

export const PLEX_UNIVERSAL_BASE = "/video/:/transcode/universal";

/**
 * `sessionId` maps to X-Plex-Session-Identifier — real Plex clients send this
 * stable per-playback value on the transcode-start request AND every segment/
 * playlist fetch that follows, so Plex can attribute the whole run to one
 * viewer/session (priority, "now playing" state). Movviz was omitting it
 * entirely on every request — harmless for correctness (the transcode job
 * still runs, keyed off the `session` query param) but a real divergence
 * from how a native client talks to the same server, worth closing.
 */
export function plexClientHeaders(token: string, clientId: string, sessionId?: string): Record<string, string> {
  return {
    "x-plex-token": token,
    "x-plex-client-identifier": clientId,
    "x-plex-product": "Movviz",
    "x-plex-version": "1.0.0",
    "x-plex-platform": "Chrome",
    "x-plex-platform-version": "120.0",
    "x-plex-device": "Web",
    "x-plex-device-name": "Movviz",
    "x-plex-model": "bundled",
    accept: "application/json",
    ...(sessionId ? { "x-plex-session-identifier": sessionId } : {}),
  };
}

/**
 * Plex Web impersonation for transcode sessions.
 *
 * PMS's Media Decision Engine picks the client profile from these headers and
 * refuses video bitstream-copy (`videoCodec=copy`) for codecs the matched
 * profile does not declare. For an unknown product like "Movviz" it matches a
 * profile with NO HEVC support → HEVC/H.265 sources get silently re-encoded
 * to H.264 even when `tv=0` is requested — the #1 cause of lag on
 * "audio-only" transcodes (confirmed live: h264 sources copy fine, HEVC
 * sources don't). Declaring the built-in "Plex Web" profile (which supports
 * HEVC over HLS) makes MDE honor the copy in DIRECT-STREAM sessions.
 *
 * BUT a direct-stream session is only produced when BOTH codecs copy
 * (ta=0 & tv=0). As soon as the audio must be re-encoded (ta=1, e.g. DTS/
 * E-AC-3 → AAC), MDE runs a TRANSCODE session — and there it still refuses
 * the HEVC copy unless the profile declares HEVC as a transcode target codec
 * for the HLS protocol (confirmed live: segments 2.4-2.8 MB produced every
 * 22 s = video re-encoded to H.264 at a capped bitrate on a NAS that can't
 * keep up). `X-Plex-Client-Profile-Extra` appends HEVC (and AV1) to the
 * profile's transcode target codecs for HLS — the documented augmentation
 * mechanism — so MDE may honor `videoCodec=copy` inside transcode sessions
 * too.
 *
 * CRITICAL (v1.13.59): the declaration MUST cover DASH too. Confirmed live
 * (Ace Ventura 500751, 2026-08-13): with protocol=hls only, MDE refused
 * `videoCodec=hevc` in DASH transcode sessions — `demandé hevc → réel
 * avc1.640028` on BOTH ta=0 and ta=1 sessions — re-encoding 1080p/2160p at
 * ~20 Mbps on a NAS that can't keep up, so playback never started. Plex Web
 * copies HEVC in DASH because its own profile declares the DASH target
 * codecs; we must do the same.
 */
export function plexWebHeaders(token: string, clientId: string, sessionId?: string): Record<string, string> {
  return {
    ...plexClientHeaders(token, clientId, sessionId),
    "x-plex-product": "Plex Web",
    "x-plex-version": "4.100.0",
    "x-plex-device": "Windows",
    "x-plex-device-name": "Movviz",
    "x-plex-model": "Plex Web",
    "x-plex-client-profile-name": "Plex Web",
    "x-plex-client-profile-extra":
      "append-transcode-target-codec(type=videoProfile&context=streaming&videoCodec=hevc,av1,h264&audioCodec=aac,ac3,mp3&protocol=hls,dash)",
  };
}

/**
 * Plex's rewritten HLS URIs embed its own transcode-job id as the segment
 * after "session" (e.g. /video/:/transcode/universal/session/{id}/base/...).
 * Reusing that exact id as X-Plex-Session-Identifier on the proxied
 * segment/playlist fetches — rather than inventing a second, unrelated one —
 * keeps every request for this job self-consistent with what Plex itself
 * already named it.
 */
export function extractPlexSessionId(pathSegments: string[]): string | undefined {
  const idx = pathSegments.indexOf("session");
  if (idx === -1 || idx + 1 >= pathSegments.length) return undefined;
  return pathSegments[idx + 1];
}

/**
 * Rewrite every media URI inside an m3u8 so the browser hits our same-origin
 * proxy instead of the Plex LAN address (which the browser cannot reach, and
 * which would leak the admin token if embedded).
 *
 * @param raw          raw m3u8 body from Plex
 * @param playlistPath absolute path of THIS playlist on Plex (no query), e.g.
 *                     `/video/:/transcode/universal/start.m3u8` for the master
 *                     or `/video/:/transcode/universal/session/x/base/index.m3u8`
 */
export function rewriteM3u8(raw: string, playlistPath: string): string {
  const proxyBase = "/api/stream/plex-proxy";
  const dir = playlistDir(playlistPath);

  const rewriteUri = (uri: string): string => {
    const u = uri.trim();
    if (!u || u.startsWith("#")) return uri;
    // Already proxied
    if (u.startsWith(proxyBase) || u.startsWith("/api/stream/")) return u;

    // Absolute URL → strip origin, keep path+query
    if (/^https?:\/\//i.test(u)) {
      try {
        const parsed = new URL(u);
        return `${proxyBase}${parsed.pathname}${parsed.search}`;
      } catch {
        return u;
      }
    }

    // Absolute path on Plex
    if (u.startsWith("/")) {
      return `${proxyBase}${u}`;
    }

    // Relative URI (session/.../index.m3u8 or 00000.ts)
    const resolved = resolveRelative(dir, u);
    return `${proxyBase}${resolved}`;
  };

  return raw
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      // Tag lines may embed URI="..."
      if (trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/gi, (_m, uri: string) => `URI="${rewriteUri(uri)}"`);
      }

      // Media / playlist URI line
      return rewriteUri(trimmed);
    })
    .join("\n");
}

/**
 * Rewrite a Plex DASH manifest (MPD) so every media URL hits our same-origin
 * proxy instead of the Plex LAN address (unreachable from the browser, and it
 * would leak the admin token).
 *
 * Two shapes observed from real PMS responses:
 *  - A <BaseURL> element per AdaptationSet, e.g.
 *    https://host:32400/video/:/transcode/universal/session/{id}/0/ — the
 *    SegmentTemplate's media/initialization then resolve as relative against
 *    it, so once BaseURL is proxied the browser resolves the rest on its own.
 *  - NO <BaseURL> at all, with SegmentTemplate carrying relative paths
 *    directly, e.g. initialization="session/{id}/0/header". Confirmed live
 *    (Jurassic Park, 2026-08-13): without a BaseURL to anchor against, the
 *    browser resolves these relative to the MPD's OWN fetch URL
 *    (/api/stream/{ratingKey}/transcode?...) instead of Plex's real
 *    transcode path — producing a 404 on every single init-segment request,
 *    so DASH playback can never start (regardless of tv/ta mode). These must
 *    be anchored to PLEX_UNIVERSAL_BASE explicitly.
 */
export function rewriteMpd(raw: string): string {
  const proxyBase = "/api/stream/plex-proxy";
  const templateBase = `${proxyBase}${PLEX_UNIVERSAL_BASE}/`;

  const rewriteAbsoluteOrPath = (u: string): string => {
    const t = u.trim();
    if (!t || t.startsWith(proxyBase) || t.startsWith("/api/stream/")) return u;
    if (/^https?:\/\//i.test(t)) {
      try {
        const parsed = new URL(t);
        return `${proxyBase}${parsed.pathname}${parsed.search}`;
      } catch {
        return u;
      }
    }
    if (t.startsWith("/")) return `${proxyBase}${t}`;
    return u;
  };

  const hasBaseUrl = /<BaseURL[^>]*>[^<]*<\/BaseURL>/i.test(raw);

  return raw
    .replace(/<BaseURL([^>]*)>([^<]*)<\/BaseURL>/gi, (_m, attrs: string, url: string) => {
      return `<BaseURL${attrs}>${rewriteAbsoluteOrPath(url)}</BaseURL>`;
    })
    .replace(/\b(media|initialization)="([^"]+)"/gi, (_m, attr: string, url: string) => {
      const t = url.trim();
      const isAnchored = !t || t.startsWith(proxyBase) || t.startsWith("/api/stream/") || /^https?:\/\//i.test(t) || t.startsWith("/");
      if (isAnchored) return `${attr}="${rewriteAbsoluteOrPath(url)}"`;
      // Relative template: safe to leave as-is only if a <BaseURL> above was
      // rewritten to an absolute proxy path for the browser to resolve
      // against. Otherwise anchor it to the real Plex universal-transcode
      // path ourselves.
      if (hasBaseUrl) return `${attr}="${url}"`;
      return `${attr}="${templateBase}${t}"`;
    });
}

function playlistDir(playlistPath: string): string {
  const bare = playlistPath.split("?")[0] || "/";
  const idx = bare.lastIndexOf("/");
  if (idx <= 0) return "/";
  return bare.slice(0, idx + 1); // keep trailing slash
}

function resolveRelative(dir: string, rel: string): string {
  // dir always ends with /
  const stack = dir.split("/").filter((p) => p.length > 0);
  for (const part of rel.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      stack.pop();
      continue;
    }
    stack.push(part);
  }
  return "/" + stack.join("/");
}
