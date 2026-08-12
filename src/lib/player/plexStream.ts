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
 * This NAS's Plex only accepts ONE active transcode session per media Part —
 * requesting a genuinely new session id for a Part that already has one
 * "live" (even one the player abandoned without explicitly stopping) gets
 * rejected outright with HTTP 400 on start.m3u8, confirmed live: any new
 * session id fails while the original deterministic one keeps succeeding.
 * Best-effort, short-timeout — a failed stop must never block starting the
 * new session, it only frees up the slot faster when it works.
 */
export async function stopPlexSession(
  base: string,
  token: string,
  clientId: string,
  sessionId: string
): Promise<void> {
  try {
    await fetch(
      `${base}${PLEX_UNIVERSAL_BASE}/stop?session=${encodeURIComponent(sessionId)}`,
      {
        method: "GET",
        headers: plexClientHeaders(token, clientId, sessionId),
        signal: AbortSignal.timeout(3000),
      }
    );
  } catch {
    /* best-effort — starting the new session proceeds regardless */
  }
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
