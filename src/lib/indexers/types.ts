/**
 * Movviz native indexer manager.
 *
 * Movviz manages its own indexers directly — no external tool. It speaks the
 * standard Torznab (torrent) / Newznab (usenet) query protocol, so a configured
 * indexer with a base URL + credentials works for real search and grab.
 */

import type { CategoryNode } from "./categories";

export type IndexerProtocol = "torrent" | "usenet";
/** Query API standard exposed by the indexer. */
export type IndexerKind = "torznab" | "newznab";
/** How the indexer authenticates a request. */
export type IndexerAuthType = "apikey" | "credentials" | "none";

/**
 * What an indexer's `t=caps` response actually declares it can do. Torznab
 * supports precise search modes (t=movie / t=tvsearch with imdbid/tmdbid/
 * season/ep params) alongside the generic free-text t=search — using them
 * when available returns far more accurate results than stuffing everything
 * into a text query, and not every indexer supports every parameter.
 */
export interface IndexerCapabilities {
  search: boolean;
  movieSearch: boolean;
  movieSearchImdb: boolean;
  movieSearchTmdb: boolean;
  tvSearch: boolean;
  tvSearchImdb: boolean;
  tvSearchTmdb: boolean;
  tvSearchTvdb: boolean;
  tvSearchSeason: boolean;
  tvSearchEp: boolean;
  /** The indexer's own category tree, as declared in its caps response — real ids/names, not Movviz's generic guess. */
  categories: CategoryNode[];
}

/** An indexer the user has configured (with their own credentials). */
export interface ConfiguredIndexer {
  id: string;
  name: string;
  kind: IndexerKind;
  protocol: IndexerProtocol;
  baseUrl: string; // Torznab/Newznab API endpoint
  authType: IndexerAuthType;
  apiKey: string;
  username: string;
  password: string;
  categories: number[]; // Newznab category ids (2000 movies, 5000 tv…)
  enabled: boolean;
  priority: number; // 1 = highest
  addedAt: number;
  /** Release filters — 0/undefined means no limit; per-indexer size/age caps. */
  minSizeMb?: number;
  maxSizeMb?: number;
  maxAgeDays?: number;
  lastTest?: { ok: boolean; at: number; detail?: string };
  /** Cached from the last successful t=caps call; refreshed by the indexer health-check task. */
  caps?: IndexerCapabilities | null;
  /** When true, indexer requests are routed through the Cloudflare resolver service to bypass anti-bot challenges. */
  useFlareResolver?: boolean;
}

/** A search result normalized across every indexer. */
export interface IndexerRelease {
  guid: string;
  title: string;
  indexerId: string;
  indexer: string;
  protocol: IndexerProtocol;
  size: number; // bytes
  seeders: number | null; // null for usenet
  leechers: number | null;
  grabs: number | null;
  publishDate: string | null; // ISO
  downloadUrl: string | null; // .torrent / nzb URL
  magnetUrl: string | null;
  infoHash: string | null;
  categories: number[];
  score: number; // Movviz release score (quality/health/freshness)
}

/**
 * A pickable definition from the built-in catalog. Predefined entries carry a
 * known API base URL, so adding one only asks the user for what's actually
 * required to authenticate: an API key, or a username/password pair.
 */
export interface CatalogEntry {
  key: string;
  name: string;
  kind: IndexerKind;
  protocol: IndexerProtocol;
  authType: IndexerAuthType;
  siteUrl?: string;
  description: string;
  /** Default categories to request. */
  categories: number[];
  /** Known API endpoint. Absent for the generic "bring your own URL" entries. */
  baseUrl?: string;
}
