import { batchTmdbIds, getLibrarySections, getSectionRawItems, getShowEpisodes } from "./client";
import { loadPlexConfig } from "./store";
import type { PlexUserContext } from "./plexUserContext";
import type { CanonicalMediaIdentity } from "./mediaIdentityMap";
import { upsertMapping } from "./mediaIdentityMap";

export type EpisodeResolveReason =
  | "RESOLVED_RATING_KEY"
  | "RESOLVED_GUID"
  | "RESOLVED_SXXEXX"
  | "RESOLVED_LIBRARY_LOOKUP"
  | "RESOLVED_TMDB_CACHE"
  | "UNRESOLVED_MISSING_RATING_KEY"
  | "UNRESOLVED_MISSING_SHOW_TITLE"
  | "UNRESOLVED_MISSING_SEASON_INDEX"
  | "UNRESOLVED_MISSING_EPISODE_INDEX"
  | "UNRESOLVED_MISSING_LIBRARY_SECTION"
  | "UNRESOLVED_MEDIA_NOT_FOUND"
  | "UNRESOLVED_TMDB_MAPPING_FAILED"
  | "UNRESOLVED_AMBIGUOUS_MATCH"
  | "UNRESOLVED_INVALID_TYPE"
  | "UNRESOLVED_ACCOUNT_MISMATCH";

export type EpisodeResolveResult = {
  status: "RESOLVED" | "UNRESOLVED";
  canonical?: CanonicalMediaIdentity;
  ratingKey?: string;
  reason: EpisodeResolveReason;
  sample?: Record<string, unknown>;
};

type RawEpisodeEvent = {
  ratingKey?: string;
  key?: string;
  guid?: unknown;
  Guid?: unknown[];
  grandparentTitle?: string;
  parentTitle?: string;
  title?: string;
  type?: string;
  index?: number; // episode
  parentIndex?: number; // season
  grandparentRatingKey?: string;
  grandparentKey?: string;
  accountID?: number | string;
  viewedAt?: number;
};

/**
 * Pipeline de résolution épisode (§34-36):
 * 1. ratingKey direct + GUID
 * 2. TMDB mapping cache
 * 3. library lookup exact (SxxExx)
 * 4. fallback contrôlé
 * Never fuzzy match silently.
 */
export async function resolveEpisode(
  ctx: PlexUserContext,
  raw: RawEpisodeEvent,
  opts?: { strict?: boolean }
): Promise<EpisodeResolveResult> {
  const cfg = loadPlexConfig();

  // Basic validation – structured reasons instead of generic "malformed"
  if (!raw.ratingKey && !raw.key) {
    return { status: "UNRESOLVED", reason: "UNRESOLVED_MISSING_RATING_KEY", sample: raw as Record<string, unknown> };
  }
  if (raw.type && raw.type !== "episode") {
    return { status: "UNRESOLVED", reason: "UNRESOLVED_INVALID_TYPE", sample: raw as Record<string, unknown> };
  }
  const ratingKey = raw.ratingKey ?? raw.key?.split("/").pop() ?? "";
  if (!ratingKey) {
    return { status: "UNRESOLVED", reason: "UNRESOLVED_MISSING_RATING_KEY", sample: raw as Record<string, unknown> };
  }

  // 1) ratingKey direct – try to resolve via existing library mapping (fast path)
  // If Movviz library already knows this episode's ratingKey -> canonical via store
  const existing = findEpisodeByPlexRatingKeyCached(ratingKey);
  if (existing) {
    return {
      status: "RESOLVED",
      canonical: { type: "episode", tmdbShowId: existing.tmdbId, seasonNumber: existing.season, episodeNumber: existing.episode },
      ratingKey,
      reason: "RESOLVED_RATING_KEY",
    };
  }

  // 2) GUID direct – batchTmdbIds will resolve via GUID if we fetch metadata
  // We try metadata fetch for this single ratingKey with user token
  try {
    const tmdbMap = await batchTmdbIds(cfg, ctx.serverToken, [ratingKey]);
    const info = tmdbMap.get(ratingKey);
    if (info?.tmdbId) {
      // Need season/episode coordinates – they are in raw.parentIndex/index
      if (raw.parentIndex != null && raw.index != null) {
        // We still need show tmdbId – batchTmdbIds for episodes returns null tmdbId (episode items are not shows)
        // So GUID path for episodes is not tmdb show – need grandparent.
        // Fall through to SxxExx instead.
      }
    }
  } catch {
    // ignore
  }

  // 3) SxxExx exact match (§35) – needs grandparentTitle + parentIndex + index
  if (raw.grandparentTitle && raw.parentIndex != null && raw.index != null) {
    const sxxexx = await resolveViaShowLookup(ctx, raw.grandparentTitle, raw.parentIndex, raw.index, ratingKey);
    if (sxxexx.status === "RESOLVED") return sxxexx;
    if (sxxexx.reason === "UNRESOLVED_AMBIGUOUS_MATCH") return sxxexx; // don't fallback if ambiguous
    // else continue to other fallbacks
  } else {
    if (!raw.grandparentTitle) return { status: "UNRESOLVED", reason: "UNRESOLVED_MISSING_SHOW_TITLE", sample: raw as Record<string, unknown> };
    if (raw.parentIndex == null) return { status: "UNRESOLVED", reason: "UNRESOLVED_MISSING_SEASON_INDEX", sample: raw as Record<string, unknown> };
    if (raw.index == null) return { status: "UNRESOLVED", reason: "UNRESOLVED_MISSING_EPISODE_INDEX", sample: raw as Record<string, unknown> };
  }

  // 4) TMDB mapping cache via show ratingKey
  const grandparentRatingKey = (raw as { grandparentRatingKey?: string }).grandparentRatingKey ?? (raw as { grandparentKey?: string }).grandparentKey?.split("/").pop();
  if (grandparentRatingKey) {
    try {
      const showTmdb = await batchTmdbIds(cfg, ctx.serverToken, [grandparentRatingKey]);
      const tmdbId = showTmdb.get(grandparentRatingKey)?.tmdbId;
      if (tmdbId != null && raw.parentIndex != null && raw.index != null) {
        return {
          status: "RESOLVED",
          canonical: { type: "episode", tmdbShowId: tmdbId, seasonNumber: raw.parentIndex, episodeNumber: raw.index },
          ratingKey,
          reason: "RESOLVED_TMDB_CACHE",
        };
      }
    } catch {
      // ignore
    }
  }

  // 5) Exhausted
  return { status: "UNRESOLVED", reason: "UNRESOLVED_MEDIA_NOT_FOUND", sample: raw as Record<string, unknown> };
}

function findEpisodeByPlexRatingKeyCached(ratingKey: string): { tmdbId: number; season: number; episode: number } | null {
  try {
    const { findEpisodeByPlexRatingKey } = require("@/lib/library/store") as typeof import("@/lib/library/store");
    const hit = findEpisodeByPlexRatingKey(ratingKey);
    if (!hit) return null;
    return { tmdbId: hit.series.tmdbId, season: hit.season.seasonNumber, episode: hit.episode.episodeNumber };
  } catch {
    return null;
  }
}

async function resolveViaShowLookup(
  ctx: PlexUserContext,
  showTitle: string,
  season: number,
  episode: number,
  ratingKey: string
): Promise<EpisodeResolveResult> {
  const cfg = loadPlexConfig();
  const sections = await getLibrarySections(cfg, ctx.serverToken);
  const showSections = sections.filter((s) => s.type === "show");
  if (showSections.length === 0) return { status: "UNRESOLVED", reason: "UNRESOLVED_MISSING_LIBRARY_SECTION" };

  const candidates: { ratingKey: string; title: string }[] = [];
  for (const section of showSections) {
    const items = await getSectionRawItems(cfg, section.key, ctx.serverToken);
    for (const it of items) {
      if (it.title.trim().localeCompare(showTitle.trim(), undefined, { sensitivity: "base" }) === 0) {
        candidates.push({ ratingKey: it.ratingKey, title: it.title });
      }
    }
  }
  if (candidates.length === 0) return { status: "UNRESOLVED", reason: "UNRESOLVED_MEDIA_NOT_FOUND", sample: { showTitle, season, episode } };
  if (candidates.length > 1) return { status: "UNRESOLVED", reason: "UNRESOLVED_AMBIGUOUS_MATCH", sample: { showTitle, candidates: candidates.slice(0, 3) } };

  const showKey = candidates[0].ratingKey;
  const showTmdb = await batchTmdbIds(cfg, ctx.serverToken, [showKey]);
  const tmdbShowId = showTmdb.get(showKey)?.tmdbId;
  if (tmdbShowId == null) return { status: "UNRESOLVED", reason: "UNRESOLVED_TMDB_MAPPING_FAILED", sample: { showTitle, showKey } };

  // Verify episode exists via allLeaves
  const eps = await getShowEpisodes(cfg, showKey, ctx.serverToken);
  const match = eps.find((e) => e.seasonNumber === season && e.episodeNumber === episode);
  if (!match) return { status: "UNRESOLVED", reason: "UNRESOLVED_MEDIA_NOT_FOUND", sample: { showTitle, season, episode } };

  // Upsert mapping for future fast path
  upsertMapping({ machineIdentifier: ctx.machineIdentifier, ratingKey, canonical: { type: "episode", tmdbShowId, seasonNumber: season, episodeNumber: episode }, updatedAt: Date.now() });

  return {
    status: "RESOLVED",
    canonical: { type: "episode", tmdbShowId, seasonNumber: season, episodeNumber: episode },
    ratingKey,
    reason: "RESOLVED_SXXEXX",
  };
}

/**
 * Batch resolver helper for diagnostics – returns structured counts (§31-32)
 */
export async function resolveEpisodesBatch(
  ctx: PlexUserContext,
  raws: RawEpisodeEvent[]
): Promise<{ resolved: EpisodeResolveResult[]; counts: Record<EpisodeResolveReason, number>; samples: Record<string, unknown>[] }> {
  const counts = {} as Record<EpisodeResolveReason, number>;
  const resolved: EpisodeResolveResult[] = [];
  const samples: Record<string, unknown>[] = [];
  for (const r of raws) {
    const res = await resolveEpisode(ctx, r);
    resolved.push(res);
    counts[res.reason] = (counts[res.reason] ?? 0) + 1;
    if (res.status === "UNRESOLVED" && samples.length < 3) samples.push(res.sample ?? (r as Record<string, unknown>));
  }
  return { resolved, counts, samples };
}
