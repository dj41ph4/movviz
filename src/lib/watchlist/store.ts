import fs from "node:fs";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import path from "node:path";
import type { WatchlistItem } from "./types";
import { recordUserContextEvent, upsertUserMediaState } from "@/lib/userContext/ingest";
import { mediaStateKey } from "@/lib/userContext/reconcile";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "watchlist.json");

function readJson<T>(file: string, fallback: T): T {
  return readJsonCached(file, fallback);
}
function writeJson(file: string, data: unknown) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(file, data);
}

export function loadWatchlist(userId: string): WatchlistItem[] {
  return readJson<WatchlistItem[]>(FILE, []).filter((i) => i.userId === userId).map(normalizeItem).filter((i) => i.present);
}
function normalizeItem(item: WatchlistItem): WatchlistItem {
  const addedAt = Number.isFinite(item.addedAt) ? item.addedAt : Date.now();
  return {
    ...item,
    present: item.present !== false,
    removedAt: item.removedAt ?? null,
    updatedAt: Number.isFinite(item.updatedAt) ? item.updatedAt : addedAt,
    source: item.source ?? "legacy_watchlist",
  };
}

export function watchlistKey(item: Pick<WatchlistItem, "type" | "tmdbId" | "seasonNumber" | "episodeNumber">): string {
  return item.type === "episode"
    ? `episode:${item.tmdbId}:${item.seasonNumber ?? -1}:${item.episodeNumber ?? -1}`
    : `${item.type}:${item.tmdbId}`;
}

function sameItem(a: WatchlistItem, b: Pick<WatchlistItem, "type" | "tmdbId" | "seasonNumber" | "episodeNumber">): boolean {
  return watchlistKey(a) === watchlistKey(b);
}

export function addWatchlistItem(item: Omit<WatchlistItem, "present" | "updatedAt" | "removedAt" | "source"> & Partial<Pick<WatchlistItem, "updatedAt" | "source">>) {
  const mutationAt = item.updatedAt ?? Date.now();
  const all = readJson<WatchlistItem[]>(FILE, []);
  const normalized = all.map(normalizeItem);
  const idx = normalized.findIndex((i) => i.userId === item.userId && sameItem(i, item));
  const next: WatchlistItem = { ...item, present: true, removedAt: null, updatedAt: mutationAt, source: item.source ?? "movviz" };
  if (idx >= 0 && normalized[idx].updatedAt > mutationAt) return normalized[idx];
  if (idx >= 0 && normalized[idx].updatedAt === mutationAt && normalized[idx].source >= next.source) return normalized[idx];
  if (idx >= 0) normalized[idx] = { ...normalized[idx], ...next };
  else normalized.push(next);
  writeJson(FILE, normalized);
  recordUserContextEvent({ userId: item.userId, eventType: "watchlist_added", source: next.source, sourceEventId: `watchlist:${watchlistKey(next)}:add:${mutationAt}`, tmdbId: next.tmdbId, mediaType: next.type === "episode" ? "episode" : next.type, seasonNumber: next.seasonNumber, episodeNumber: next.episodeNumber, title: next.title, occurredAt: mutationAt });
  upsertUserMediaState({ stateKey: mediaStateKey(item.userId, next.type, next.tmdbId, next.seasonNumber, next.episodeNumber), userId: item.userId, tmdbId: next.tmdbId, mediaType: next.type, seasonNumber: next.seasonNumber, episodeNumber: next.episodeNumber, title: next.title, eligibleForResume: false, watched: false, updatedAt: mutationAt, watchlistPresent: true, watchlistUpdatedAt: mutationAt, watchlistSource: next.source, watchlistAddedAt: mutationAt });
  return next;
}
export function removeWatchlistItem(userId: string, type: string, tmdbId: number, seasonNumber?: number, episodeNumber?: number, mutationAt = Date.now()) {
  const all = readJson<WatchlistItem[]>(FILE, []);
  const normalized = all.map(normalizeItem);
  const idx = normalized.findIndex((i) => i.userId === userId && i.type === type && i.tmdbId === tmdbId && (type !== "episode" || (i.seasonNumber === seasonNumber && i.episodeNumber === episodeNumber)));
  if (idx >= 0) {
    const current = normalized[idx];
    if (current.updatedAt > mutationAt) return;
    normalized[idx] = { ...current, present: false, removedAt: mutationAt, updatedAt: mutationAt, source: "movviz" };
    writeJson(FILE, normalized);
    recordUserContextEvent({ userId, eventType: "watchlist_removed", source: "movviz", sourceEventId: `watchlist:${watchlistKey(current)}:remove:${mutationAt}`, tmdbId, mediaType: type as "movie" | "series" | "episode", seasonNumber, episodeNumber, title: current.title, occurredAt: mutationAt });
    upsertUserMediaState({ stateKey: mediaStateKey(userId, type as "movie" | "series" | "episode", tmdbId, seasonNumber, episodeNumber), userId, tmdbId, mediaType: type as "movie" | "series" | "episode", seasonNumber, episodeNumber, title: current.title, eligibleForResume: false, watched: false, updatedAt: mutationAt, watchlistPresent: false, watchlistUpdatedAt: mutationAt, watchlistSource: "movviz", watchlistRemovedAt: mutationAt }, { force: true });
  }
}
