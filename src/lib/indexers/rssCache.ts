/**
 * File-backed RSS cache for indexers.
 *
 * The hourly RSS scan (`rss-indexer-scan`) fetches each indexer's recent
 * releases feed and caches the results here on disk. The matching logic
 * (`rssMatchIndexers`) reads from this file — zero direct indexer calls
 * during matching, so HTTP 429 rate-limits are impossible.
 *
 * Persisted to disk so a restart doesn't leave the cache cold: the first
 * matching cycle after a reboot still has the last cached feed while the
 * scheduled refresh fetches fresh data.
 *
 * Since 1.1.14: every search path (auto-grab, manual search, retry jobs)
 * reads from this cache instead of making direct HTTP calls. Only
 * `refreshRssCache()` calls indexers directly.
 */

import path from "node:path";
import fsp from "node:fs/promises";
import type { IndexerRelease } from "./types";
import { loadIndexers } from "./store";
import { searchIndexer } from "./torznab";
import { withoutRateLimited, clearRateLimit } from "./rateLimit";
import { readJsonCached } from "@/lib/fsJsonCache";
import { recordSearchLog } from "@/lib/diagnostic/searchLog";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");

const CACHE_FILE = path.join(CONFIG_DIR, "rss-cache.json");

/** Read the cached RSS releases (empty array = no cache yet). */
export function readRssCache(): IndexerRelease[] {
  return readJsonCached<IndexerRelease[]>(CACHE_FILE, []);
}

/**
 * Search the RSS cache for releases matching the given title + year,
 * optionally scoped to a set of Torznab category IDs. Returns every
 * cached release that overlaps the requested categories — the caller
 * is responsible for further scoring/filtering via quality profiles.
 *
 * Zero HTTP calls: this is what every search path (auto-grab, manual
 * search, retry jobs) uses instead of querying indexers directly.
 */
export function searchFromCache(
  scopeCategories?: number[]
): IndexerRelease[] {
  const releases = readRssCache();
  if (!scopeCategories?.length) return releases;
  const filtered = releases.filter((r) => r.categories.some((c) => scopeCategories.includes(c)));
  if (filtered.length === 0 && releases.length > 0) {
    recordSearchLog("debug", "cache_search.cat_mismatch", `${releases.length} release(s) en cache mais 0 après filtre catégories [${scopeCategories.join(",")}]`);
  }
  return filtered;
}

/**
 * Write the cache atomically (tmp + rename) and sync the in-memory cache so
 * reads via readJsonCached see it immediately. Bypasses writeJsonCached's
 * coalescing delay (300ms) — this is a one-shot bulk write, not a stream
 * of incremental updates, so the extra latency just hurts.
 *
 * Uses the async fs/promises API, NOT writeFileSync/renameSync: those run on
 * Node's single main thread and block it for their entire duration — with up
 * to ~2000 releases and a NAS disk simultaneously busy serving active
 * torrent downloads, that could stall long enough to fail the container's
 * health check (5s timeout) and every other in-flight request. This is
 * still awaited by refreshRssCache() (an already-async scheduled task, not a
 * request handler) before it returns, so the write is just as durable as
 * the sync version — nothing moves on to the next step, or lets the process
 * be considered "done", before the file actually lands on disk. Async fs
 * calls run on libuv's thread pool, so the main thread stays free to serve
 * other requests (including the health check) while this is in flight.
 */
async function writeRssCache(releases: IndexerRelease[]) {
  const json = JSON.stringify(releases);
  const dir = path.dirname(CACHE_FILE);
  await fsp.mkdir(dir, { recursive: true });
  const tmp = `${CACHE_FILE}.${process.pid}.${Date.now()}.tmp`;
  await fsp.writeFile(tmp, json, "utf8");
  await fsp.rename(tmp, CACHE_FILE);
  const stat = await fsp.stat(CACHE_FILE);
  const g = globalThis as typeof globalThis & { __movvizFsJsonCache?: Map<string, { mtimeMs: number; size: number; value: unknown; pending?: boolean }> };
  const cache = g.__movvizFsJsonCache;
  if (cache) cache.set(CACHE_FILE, { mtimeMs: stat.mtimeMs, size: stat.size, value: releases });
}

/**
 * Fetch fresh RSS data from every enabled indexer and persist to disk.
 * Respects rate limits: indexers with an active 429 cooldown are skipped.
 * Call this from the scheduled RSS task, NOT from the matching path.
 */
export async function refreshRssCache(): Promise<{ fetched: number }> {
  const configured = loadIndexers().filter((i) => i.enabled && i.protocol === "torrent");
  if (configured.length === 0) {
    recordSearchLog("warn", "rss_refresh.no_indexers", "Aucun indexeur torrent activé — cache vidé");
    await writeRssCache([]);
    return { fetched: 0 };
  }

  const indexers = withoutRateLimited(configured);
  const rateLimitedCount = configured.length - indexers.length;
  if (rateLimitedCount > 0) {
    recordSearchLog("warn", "rss_refresh.rate_limited", `${rateLimitedCount} indexeur(s) rate-limité(s) ignoré(s) sur ${configured.length} configuré(s)`);
  }

  const t0 = performance.now();
  const results = indexers.length > 0
    ? await Promise.all(indexers.map((ix) => searchIndexer(ix, "").catch(() => [])))
    : [];
  const all = results.flat();
  const fetchMs = Math.round(performance.now() - t0);

  const perIndexer = indexers.map((ix, i) => `${ix.name}:${results[i]?.length ?? 0}`).join(", ");
  recordSearchLog("info", "rss_refresh.result", `${all.length} release(s) depuis ${indexers.length} indexeur(s) (${fetchMs}ms) [${perIndexer}]`, fetchMs);

  // Every configured indexer either rate-limited or errored out this cycle —
  // a transient blip, not "there's nothing left to find". Overwriting the
  // cache with [] here previously wiped every previously-known release, and
  // every search (auto-grab, manual, "search missing") reads only from this
  // cache — so one bad refresh cycle silently zeroed out search results
  // until the next successful one. Keep serving the last good cache instead.
  if (all.length === 0) {
    const oldCount = readRssCache().length;
    recordSearchLog("warn", "rss_refresh.empty", `0 release ramenée (${rateLimitedCount} rate-limité(s), ${indexers.length} interrogé(s)) — ancien cache conservé (${oldCount} release(s))`);
    return { fetched: 0 };
  }

  recordSearchLog("info", "rss_refresh.write", `Écriture de ${all.length} release(s) dans le cache RSS`);
  await writeRssCache(all);
  return { fetched: all.length };
}
