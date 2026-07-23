import fs from "node:fs";
import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import { loadSeerrConfig } from "@/lib/seerr/store";

/** Validate a base URL: must be http(s), must not point to localhost/private ranges. */
function safeBase(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase();
    // Block loopback, link-local, private ranges — SSRF mitigation.
    if (host === "localhost" || host === "0.0.0.0" || host === "::1") return null;
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|127\.)/.test(host)) return null;
    if (/^169\.254\./.test(host)) return null;
    // Strip trailing slashes without regex (avoids CodeQL polynomial regex alert)
    const trimmed = raw.replace(/[/]+$/, "");
    return trimmed;
  } catch {
    return null;
  }
}

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "seerr-media-map.json");

interface MediaMap {
  [key: string]: number; // "movie:12345" → seerrMediaId
}

function loadMediaMap(): MediaMap {
  return readJsonCached<MediaMap>(FILE, {});
}

function saveMediaMap(map: MediaMap) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(FILE, map);
}

type MovvizType = "movie" | "series";
type SeerrType = "movie" | "tv";

function toSeerrType(t: MovvizType): SeerrType {
  return t === "series" ? "tv" : "movie";
}

export function setMediaMapEntry(mediaType: MovvizType, tmdbId: number, seerrMediaId: number) {
  const map = loadMediaMap();
  map[`${mediaType}:${tmdbId}`] = seerrMediaId;
  saveMediaMap(map);
}

export function getSeerrMediaId(mediaType: MovvizType, tmdbId: number): number | undefined {
  return loadMediaMap()[`${mediaType}:${tmdbId}`];
}

/** Overseerr API expects a numeric status code in the URL path, not a string. */
const STATUS_CODE: Record<string, number> = {
  unknown: 1,
  pending: 2,
  processing: 3,
  partial: 4,
  available: 5,
};

export async function notifySeerrStatus(
  mediaType: MovvizType,
  tmdbId: number,
  status: "available" | "partial" | "processing" | "pending" | "unknown"
): Promise<boolean> {
  let mediaId = getSeerrMediaId(mediaType, tmdbId);

  if (mediaId == null) {
    mediaId = await findSeerrMediaId(tmdbId, toSeerrType(mediaType));
    if (mediaId == null) {
      console.warn("[seerr] mediaId not found for " + mediaType + ":" + tmdbId);
      return false;
    }
  }

  const cfg = loadSeerrConfig();
  if (!cfg.baseUrl || !cfg.apiKey) return false;

  const base = safeBase(cfg.baseUrl);
  if (!base) return false;

  const code = STATUS_CODE[status];
  if (code == null) {
    console.warn("[seerr] unknown status " + status);
    return false;
  }

  try {
    const url = new URL("/api/v1/media/" + mediaId + "/" + code, base);
    const res = await fetch(url.href, {
      method: "POST",
      headers: { accept: "application/json", "X-Api-Key": cfg.apiKey, "content-type": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.warn("[seerr] notify status " + status + " (code " + code + ") failed HTTP " + res.status + " for " + mediaType + ":" + tmdbId);
    }
    return res.ok;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[seerr] notify status " + status + " threw for " + mediaType + ":" + tmdbId + ": " + msg);
    return false;
  }
}

export async function findSeerrMediaId(tmdbId: number, mediaType: SeerrType): Promise<number | undefined> {
  const cfg = loadSeerrConfig();
  if (!cfg.baseUrl || !cfg.apiKey) return undefined;

  const base = safeBase(cfg.baseUrl);
  if (!base) return undefined;

  // Try a targeted search first — Overseerr's search response includes
  // mediaInfo for titles already in its database, giving us the internal id.
  try {
    const searchUrl = new URL("/api/v1/search/" + tmdbId, base);
    const searchRes = await fetch(searchUrl.href, {
      headers: { accept: "application/json", "X-Api-Key": cfg.apiKey },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (searchRes.ok) {
      const searchData: Record<string, unknown> = await searchRes.json();
      const results = searchData.results as Record<string, unknown>[] | undefined;
      if (results) {
        for (const item of results) {
          if (item.mediaType === mediaType) {
            const mi = item.mediaInfo as Record<string, unknown> | undefined;
            if (mi) {
              const id = Number(mi.id);
              if (id) {
                setMediaMapEntry(mediaType === "movie" ? "movie" : "series", tmdbId, id);
                return id;
              }
            }
          }
        }
      }
    }
  } catch {
    // fall through to pagination
  }

  // Paginate all media (newest first) as a fallback.
  let skip = 0;
  const take = 200;
  for (;;) {
    try {
      const pageUrl = new URL("/api/v1/media?take=" + take + "&skip=" + skip + "&sort=added", base);
      const res = await fetch(pageUrl.href, {
        headers: { accept: "application/json", "X-Api-Key": cfg.apiKey },
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) break;
      const data = await res.json();
      const results: Record<string, unknown>[] = data.results ?? [];
      for (const item of results) {
        if (Number(item.tmdbId) === tmdbId && item.mediaType === mediaType) {
          const id = Number(item.id);
          setMediaMapEntry(mediaType === "movie" ? "movie" : "series", tmdbId, id);
          return id;
        }
      }
      if (results.length < take) break;
      skip += take;
    } catch {
      break;
    }
  }
  return undefined;
}