import fs from "node:fs";
import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import { loadSeerrConfig, seerrConfigured } from "@/lib/seerr/store";

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
    let trimmed = raw;
    while (trimmed.endsWith("/")) trimmed = trimmed.slice(0, -1);
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

/**
 * Negative-result cache: a tmdbId that Seerr doesn't know gets re-queried at
 * most once per TTL (and warned at most once too). Without this, a series
 * that has no Seerr media entry makes every episode import fire a full
 * search + pagination + console.warn — the "mediaId not found" log flood.
 * Anchored on globalThis because Next.js bundles API routes separately.
 */
const MISS_TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_MEDIA_PAGES = 5; // 5 × 200 items — plenty for "recently added", bounded regardless

function missCache(): Map<string, number> {
  const g = globalThis as Record<string, unknown>;
  if (!(g.__movvizSeerrMisses instanceof Map)) {
    g.__movvizSeerrMisses = new Map<string, number>();
  }
  return g.__movvizSeerrMisses as Map<string, number>;
}

function missKey(mediaType: MovvizType, tmdbId: number): string {
  return mediaType + ":" + tmdbId;
}

function rememberMiss(mediaType: MovvizType, tmdbId: number) {
  missCache().set(missKey(mediaType, tmdbId), Date.now());
}

function isMissedRecently(mediaType: MovvizType, tmdbId: number): boolean {
  const cached = missCache().get(missKey(mediaType, tmdbId));
  if (cached == null) return false;
  if (Date.now() - cached < MISS_TTL_MS) return true;
  missCache().delete(missKey(mediaType, tmdbId));
  return false;
}

/** Overseerr API expects a numeric status code in the URL path, not a string. */
const STATUS_CODE: Record<string, number> = {
  unknown: 1,
  pending: 2,
  processing: 3,
  partial: 4,
  available: 5,
};

/**
 * A series grab cascade (pack → season → episode) can easily fire 10+
 * identical "processing" notifications for the SAME tmdbId within seconds
 * (one per episode targeted in the pass) — a pointless flood of Seerr API
 * calls and, when the id lookup fails, the same "mediaId not found" warn
 * over and over. Dedupes by type:tmdbId within a short window.
 * Anchored on globalThis because Next.js bundles API routes separately.
 */
const PROCESSING_DEDUP_MS = 2 * 60 * 1000; // 2 minutes

function processingSentAt(mediaType: MovvizType, tmdbId: number): number | null {
  const g = globalThis as Record<string, unknown>;
  const map = (g.__movvizSeerrProcessing ??= new Map<string, number>());
  return (map as Map<string, number>).get(mediaType + ":" + tmdbId) ?? null;
}

function markProcessingSent(mediaType: MovvizType, tmdbId: number) {
  const g = globalThis as Record<string, unknown>;
  const map = (g.__movvizSeerrProcessing ??= new Map<string, number>());
  (map as Map<string, number>).set(mediaType + ":" + tmdbId, Date.now());
}

/** Fire a "processing" notification at most once per title per pass (2 min window). */
export async function notifySeerrProcessingOnce(mediaType: MovvizType, tmdbId: number): Promise<void> {
  const sent = processingSentAt(mediaType, tmdbId);
  if (sent != null && Date.now() - sent < PROCESSING_DEDUP_MS) return;
  markProcessingSent(mediaType, tmdbId);
  await notifySeerrStatus(mediaType, tmdbId, "processing");
}

export async function notifySeerrStatus(
  mediaType: MovvizType,
  tmdbId: number,
  status: "available" | "partial" | "processing" | "pending" | "unknown"
): Promise<boolean> {
  if (!seerrConfigured()) return false;

  let mediaId = getSeerrMediaId(mediaType, tmdbId);

  if (mediaId == null && !isMissedRecently(mediaType, tmdbId)) {
    mediaId = await findSeerrMediaId(tmdbId, toSeerrType(mediaType));
    if (mediaId == null) {
      rememberMiss(mediaType, tmdbId);
      console.warn("[seerr] mediaId not found for " + mediaType + ":" + tmdbId);
      return false;
    }
  }

  if (mediaId == null) return false;

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

  // Paginate media (newest first) as a fallback — bounded so an unknown
  // title can never make us walk the entire table (or loop forever).
  let skip = 0;
  const take = 200;
  let lastPageId: unknown = undefined;
  for (let page = 0; page < MAX_MEDIA_PAGES; page++) {
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
      if (results.length === 0) break;
      // Seerr ignores skip on some versions → identical page → stop.
      if (results[0] === lastPageId) break;
      lastPageId = results[0];
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