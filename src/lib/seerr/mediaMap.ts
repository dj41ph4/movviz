import fs from "node:fs";
import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import { loadSeerrConfig } from "@/lib/seerr/store";

function baseFor(cfg: { baseUrl: string }): string {
  return cfg.baseUrl.replace(/\/+$/, "");
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

export async function notifySeerrStatus(
  mediaType: MovvizType,
  tmdbId: number,
  status: "available" | "partial" | "processing" | "pending" | "unknown"
): Promise<boolean> {
  let mediaId = getSeerrMediaId(mediaType, tmdbId);

  if (mediaId == null) {
    mediaId = await findSeerrMediaId(tmdbId, toSeerrType(mediaType));
    if (mediaId == null) return false;
  }

  const cfg = loadSeerrConfig();
  if (!cfg.baseUrl || !cfg.apiKey) return false;

  try {
    const res = await fetch(`${baseFor(cfg)}/api/v1/media/${mediaId}/${status}`, {
      method: "POST",
      headers: { accept: "application/json", "X-Api-Key": cfg.apiKey, "content-type": "application/json" },
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function findSeerrMediaId(tmdbId: number, mediaType: SeerrType): Promise<number | undefined> {
  const cfg = loadSeerrConfig();
  if (!cfg.baseUrl || !cfg.apiKey) return undefined;

  const lookups = [];
  let skip = 0;
  const take = 100;
  for (;;) {
    const url = `${baseFor(cfg)}/api/v1/media?take=${take}&skip=${skip}&sort=added`;
    try {
      const res = await fetch(url, {
        headers: { accept: "application/json", "X-Api-Key": cfg.apiKey },
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
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
