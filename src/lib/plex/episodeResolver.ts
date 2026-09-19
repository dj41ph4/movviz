import { batchTmdbIds, getLibrarySections, getSectionRawItemsAtomic, getShowEpisodesAtomic } from "./client";
import { loadPlexConfig } from "./store";
import type { PlexUserContext } from "./plexUserContext";
import type { CanonicalMediaIdentity } from "./mediaIdentityMap";
import { upsertMapping } from "./mediaIdentityMap";
import { recordSearchLog } from "@/lib/diagnostic/searchLog";

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
  | "UNRESOLVED_ACCOUNT_MISMATCH"
  | "MISSING_ALL_IDENTIFIERS"
  | "MISSING_SHOW_TITLE"
  | "MISSING_SEASON"
  | "MISSING_EPISODE"
  | "AMBIGUOUS_SHOW"
  | "SHOW_NOT_FOUND"
  | "EPISODE_NOT_FOUND"
  | "ACCOUNT_MISMATCH"
  | "GUID_UNRESOLVED"
  | "RATINGKEY_UNRESOLVED";

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
  opts?: { strict?: boolean; requireRatingKey?: boolean }
): Promise<EpisodeResolveResult> {
  const cfg = loadPlexConfig();

  if (raw.type && raw.type !== "episode") {
    return { status: "UNRESOLVED", reason: "UNRESOLVED_INVALID_TYPE", sample: raw as Record<string, unknown> };
  }
  const ratingKey = raw.ratingKey ?? raw.key?.split("/").pop() ?? "";

  // 1) ratingKey direct – try to resolve via existing library mapping (fast path) if present
  if (ratingKey) {
    const existing = findEpisodeByPlexRatingKeyCached(ratingKey);
    if (existing) {
      return {
        status: "RESOLVED",
        canonical: { type: "episode", tmdbShowId: existing.tmdbId, seasonNumber: existing.season, episodeNumber: existing.episode },
        ratingKey,
        reason: "RESOLVED_RATING_KEY",
      };
    }
  } else {
    // No ratingKey – continue to SxxExx path if we have show+season+episode
    if (!raw.grandparentTitle && !raw.grandparentRatingKey && !raw.grandparentKey) {
      return { status: "UNRESOLVED", reason: "MISSING_ALL_IDENTIFIERS", sample: raw as Record<string, unknown> };
    }
  }

  // 2) GUID direct – batchTmdbIds will resolve via GUID if we fetch metadata (only if ratingKey present)
  if (ratingKey) {
    try {
      const tmdbMap = await batchTmdbIds(cfg, ctx.serverToken, [ratingKey]);
      const info = tmdbMap.get(ratingKey);
      if (info?.tmdbId) {
        if (raw.parentIndex != null && raw.index != null) {
          // Fall through to SxxExx – episode GUID path needs show
        }
      }
    } catch {
      // ignore
    }
  }

  // 3) Show + SxxExx. Quand l'événement n'a PAS de ratingKey (cas History),
  // le lookup Plex passe EN PREMIER : lui seul récupère le vrai episode.ratingKey
  // via allLeaves, indispensable pour verifyWatchState. Le lookup Movviz local
  // (rapide, sans réseau) reste premier quand un ratingKey est déjà présent,
  // et sert de repli canonical sinon.
  const hasInputKey = ratingKey.length > 0;
  const movvizResolved = raw.grandparentTitle && raw.parentIndex != null && raw.index != null
    ? resolveViaMovvizLibrary(raw.grandparentTitle, raw.parentIndex, raw.index, ratingKey)
    : null;
  // requireRatingKey: a Movviz-only canonical without a Plex ratingKey is NOT RESOLVED for history→verify
  if (hasInputKey && movvizResolved) {
    if (!opts?.requireRatingKey || movvizResolved.ratingKey) return movvizResolved;
  } else if (movvizResolved && !hasInputKey && !opts?.requireRatingKey) {
    return movvizResolved;
  }
  // B. Fast path: grandparentRatingKey present → direct allLeaves, no 618-series scan (§5.B)
  const directShowKey = raw.grandparentRatingKey ?? (raw.grandparentKey ? raw.grandparentKey.split("/").pop() : undefined);
  if (directShowKey && raw.parentIndex != null && raw.index != null) {
    try {
      const epsRes = await getShowEpisodesAtomic(cfg, directShowKey, ctx.serverToken);
      if (epsRes.complete) {
        const match = epsRes.items.find((e) => e.seasonNumber === raw.parentIndex && e.episodeNumber === raw.index);
        if (match) {
          // Resolve show TMDB (for canonical) via batch, fallback to Movviz canonical if TMDB fails
          let tmdbShowId: number | null = null;
          try {
            const tmdbMap = await batchTmdbIds(cfg, ctx.serverToken, [directShowKey]);
            tmdbShowId = tmdbMap.get(directShowKey)?.tmdbId ?? null;
          } catch { /* ignore */ }
          if (tmdbShowId == null && movvizResolved?.canonical) {
            tmdbShowId = (movvizResolved.canonical as Extract<CanonicalMediaIdentity, { type: "episode" }>).tmdbShowId;
          }
          if (tmdbShowId != null) {
            const realKey = match.ratingKey;
            const canonical = { type: "episode", tmdbShowId, seasonNumber: raw.parentIndex, episodeNumber: raw.index } as const;
            if (realKey) upsertMapping({ machineIdentifier: ctx.machineIdentifier, ratingKey: realKey, canonical, updatedAt: Date.now() });
            return { status: "RESOLVED", canonical, ratingKey: realKey, reason: "RESOLVED_SXXEXX" };
          }
        } else {
          // Title fallback when SxxExx fails and we have raw.title (Dragon Ball Z Kaï)
          if (raw.title) {
            const t = raw.title.trim().toLowerCase();
            const exact = epsRes.items.filter((e) => (e as unknown as { title?: string })["title"]?.trim().toLowerCase() === t);
            // Fallback to exact title match only if single
            if (exact.length === 1) {
              let tmdbShowId: number | null = null;
              try {
                const tmdbMap = await batchTmdbIds(cfg, ctx.serverToken, [directShowKey]);
                tmdbShowId = tmdbMap.get(directShowKey)?.tmdbId ?? null;
              } catch { /* ignore */ }
              if (tmdbShowId == null && movvizResolved?.canonical) tmdbShowId = (movvizResolved.canonical as Extract<CanonicalMediaIdentity, { type: "episode" }>).tmdbShowId;
              if (tmdbShowId != null && exact[0].seasonNumber != null && exact[0].episodeNumber != null) {
                const realKey = exact[0].ratingKey;
                const canonical = { type: "episode", tmdbShowId, seasonNumber: exact[0].seasonNumber, episodeNumber: exact[0].episodeNumber } as const;
                if (realKey) upsertMapping({ machineIdentifier: ctx.machineIdentifier, ratingKey: realKey, canonical, updatedAt: Date.now() });
                recordSearchLog("info", "plex.resolve.episode", `plex.resolve.episode titleFallback user=${ctx.movvizUserId} show=${raw.grandparentTitle ?? "?"} history S${raw.parentIndex}E${raw.index} title="${raw.title}" plex S${exact[0].seasonNumber}E${exact[0].episodeNumber} exactTitleMatches=1`);
                return { status: "RESOLVED", canonical, ratingKey: realKey, reason: "RESOLVED_SXXEXX" };
              }
            } else if (exact.length === 0) {
              recordSearchLog("info", "plex.resolve.episode", `plex.resolve.episode historySeason=${raw.parentIndex} historyEpisode=${raw.index} historyTitle="${raw.title ?? ""}" plexShow=${directShowKey} exactSxxExxMatch=false exactTitleMatches=0`);
            } else {
              return { status: "UNRESOLVED", reason: "UNRESOLVED_AMBIGUOUS_MATCH", sample: { showTitle: raw.grandparentTitle, season: raw.parentIndex, episode: raw.index, title: raw.title } };
            }
          }
          return { status: "UNRESOLVED", reason: "EPISODE_NOT_FOUND", sample: { showTitle: raw.grandparentTitle, season: raw.parentIndex, episode: raw.index, plexShowRatingKey: directShowKey, exactSxxExxMatch: false } };
        }
      } else {
        return { status: "UNRESOLVED", reason: "UNRESOLVED_MEDIA_NOT_FOUND", sample: { showTitle: raw.grandparentTitle, season: raw.parentIndex, episode: raw.index, plexShowRatingKey: directShowKey, error: epsRes.error } };
      }
    } catch { /* fall through to title scan */ }
  }
  // 3b) SxxExx exact match via Plex library (§35) – needs grandparentTitle + parentIndex + index
  if (raw.grandparentTitle && raw.parentIndex != null && raw.index != null) {
    const sxxexx = await resolveViaShowLookup(ctx, raw.grandparentTitle, raw.parentIndex, raw.index, ratingKey);
    if (sxxexx.status === "RESOLVED") {
      // Enforce requireRatingKey (§4): RESOLVED without a real ratingKey is UNRESOLVED here
      if (opts?.requireRatingKey && !sxxexx.ratingKey) {
        // continue to fallbacks that can recover a key
      } else {
        return sxxexx;
      }
    }
    if (sxxexx.reason === "UNRESOLVED_AMBIGUOUS_MATCH" || sxxexx.reason === "AMBIGUOUS_SHOW") return { ...sxxexx, reason: "AMBIGUOUS_SHOW" as EpisodeResolveReason };
    // Plex ne connaît pas la série : repli sur le canonical Movviz seulement si la clé n'est pas exigée
    if (movvizResolved && (!opts?.requireRatingKey || movvizResolved.ratingKey)) return movvizResolved;
    if (movvizResolved && opts?.requireRatingKey && !movvizResolved.ratingKey) {
      // Need a real Plex key – try TMDB-based show lookup (§5.D)
      const tmdbShowId = (movvizResolved.canonical as Extract<CanonicalMediaIdentity, { type: "episode" }>).tmdbShowId;
      const plexShow = await findPlexShowByTmdbId(ctx, tmdbShowId);
      if (plexShow) {
        const epsRes = await getShowEpisodesAtomic(cfg, plexShow.ratingKey, ctx.serverToken);
        if (epsRes.complete) {
          const m = epsRes.items.find((e) => e.seasonNumber === raw.parentIndex && e.episodeNumber === raw.index);
          if (m) {
            const realKey = m.ratingKey;
            const canonical = movvizResolved!.canonical!;
            if (realKey) upsertMapping({ machineIdentifier: ctx.machineIdentifier, ratingKey: realKey, canonical, updatedAt: Date.now() });
            return { status: "RESOLVED", canonical, ratingKey: realKey, reason: "RESOLVED_SXXEXX" };
          }
        }
      }
    }
    // else continue to other fallbacks
  } else {
    if (!raw.grandparentTitle) return { status: "UNRESOLVED", reason: "MISSING_SHOW_TITLE", sample: raw as Record<string, unknown> };
    if (raw.parentIndex == null) return { status: "UNRESOLVED", reason: "MISSING_SEASON", sample: raw as Record<string, unknown> };
    if (raw.index == null) return { status: "UNRESOLVED", reason: "MISSING_EPISODE", sample: raw as Record<string, unknown> };
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

function resolveViaMovvizLibrary(showTitle: string, season: number, episode: number, ratingKey: string): EpisodeResolveResult | null {
  try {
    const { loadSeries } = require("@/lib/library/store") as typeof import("@/lib/library/store");
    const seriesList = loadSeries() as Array<{ tmdbId: number; title: string; seasons: Array<{ seasonNumber: number; episodes: Array<{ episodeNumber: number }> }> }>;
    const candidates = seriesList.filter((s) => s.title.trim().localeCompare(showTitle.trim(), undefined, { sensitivity: "base" }) === 0);
    if (candidates.length === 0) return null;
    if (candidates.length > 1) return { status: "UNRESOLVED", reason: "AMBIGUOUS_SHOW", sample: { showTitle, candidates: candidates.map((c) => c.title).slice(0, 3) } };
    const show = candidates[0];
    const seasonObj = show.seasons.find((s) => s.seasonNumber === season);
    if (!seasonObj) return { status: "UNRESOLVED", reason: "EPISODE_NOT_FOUND", sample: { showTitle, season, episode } };
    const ep = seasonObj.episodes.find((e) => e.episodeNumber === episode);
    if (!ep) return { status: "UNRESOLVED", reason: "EPISODE_NOT_FOUND", sample: { showTitle, season, episode } };
    // For Euphoria S01E01 style, this is enough to resolve
    return {
      status: "RESOLVED",
      canonical: { type: "episode", tmdbShowId: show.tmdbId, seasonNumber: season, episodeNumber: episode },
      ratingKey: ratingKey || undefined,
      reason: "RESOLVED_LIBRARY_LOOKUP",
    };
  } catch {
    return null;
  }
}

async function findPlexShowByTmdbId(ctx: PlexUserContext, tmdbShowId: number): Promise<{ ratingKey: string; title: string } | null> {
  const cfg = loadPlexConfig();
  const sections = await getLibrarySections(cfg, ctx.serverToken);
  const showSections = sections.filter((s) => s.type === "show");
  for (const section of showSections) {
    const result = await getSectionRawItemsAtomic(cfg, section.key, ctx.serverToken);
    if (!result.complete) continue;
    const keys = result.items.map((it) => it.ratingKey);
    if (keys.length === 0) continue;
    const tmdbMap = await batchTmdbIds(cfg, ctx.serverToken, keys);
    for (const it of result.items) {
      if (tmdbMap.get(it.ratingKey)?.tmdbId === tmdbShowId) return { ratingKey: it.ratingKey, title: it.title };
    }
  }
  return null;
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
    const result = await getSectionRawItemsAtomic(cfg, section.key, ctx.serverToken);
    if (!result.complete) return { status: "UNRESOLVED", reason: "UNRESOLVED_MISSING_LIBRARY_SECTION", sample: { showTitle, section: section.key, error: result.error } };
    for (const it of result.items) {
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

  // Verify episode exists via allLeaves (atomic) – also recovers the REAL Plex episode ratingKey (§1)
  const epsRes = await getShowEpisodesAtomic(cfg, showKey, ctx.serverToken);
  if (!epsRes.complete) return { status: "UNRESOLVED", reason: "UNRESOLVED_MEDIA_NOT_FOUND", sample: { showTitle, season, episode, error: epsRes.error } };
  const match = epsRes.items.find((e) => e.seasonNumber === season && e.episodeNumber === episode);
  if (!match) return { status: "UNRESOLVED", reason: "UNRESOLVED_MEDIA_NOT_FOUND", sample: { showTitle, season, episode } };

  const realRatingKey = match.ratingKey || ratingKey || undefined;
  // Upsert mapping for future fast path on the REAL key (and legacy key if different)
  const canonical = { type: "episode", tmdbShowId, seasonNumber: season, episodeNumber: episode } as const;
  if (realRatingKey) upsertMapping({ machineIdentifier: ctx.machineIdentifier, ratingKey: realRatingKey, canonical, updatedAt: Date.now() });
  if (ratingKey && ratingKey !== realRatingKey) upsertMapping({ machineIdentifier: ctx.machineIdentifier, ratingKey, canonical, updatedAt: Date.now() });

  return {
    status: "RESOLVED",
    canonical,
    ratingKey: realRatingKey,
    reason: "RESOLVED_SXXEXX",
  };
}

export type MovieResolveReason =
  | "RESOLVED_RATING_KEY"
  | "RESOLVED_LIBRARY_LOOKUP"
  | "RESOLVED_PLEX_LIBRARY"
  | "RESOLVED_GUID"
  | "UNRESOLVED_MISSING_TITLE"
  | "UNRESOLVED_AMBIGUOUS_MATCH"
  | "UNRESOLVED_MEDIA_NOT_FOUND"
  | "UNRESOLVED_TMDB_MAPPING_FAILED"
  | "UNRESOLVED_INVALID_TYPE";

export type MovieResolveResult = {
  status: "RESOLVED" | "UNRESOLVED";
  canonical?: CanonicalMediaIdentity;
  ratingKey?: string;
  reason: MovieResolveReason;
  sample?: Record<string, unknown>;
};

type RawMovieEvent = {
  ratingKey?: string;
  key?: string;
  title?: string;
  type?: string;
  guid?: string;
  Guid?: { id: string }[];
  viewedAt?: number;
};

function tmdbIdFromGuids(guids: { id: string }[] | undefined): number | null {
  const g = (guids ?? []).find((x) => typeof x?.id === "string" && x.id.startsWith("tmdb://"));
  if (!g) return null;
  const n = Number((g.id as string).replace("tmdb://", ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Resolver film pour les événements history sans ratingKey (ex. "La vie est
 * belle") : titre exact → vrai ratingKey Plex → canonical TMDB → verify.
 * Même contrat que resolveEpisode : match exact unique ou AMBIGUOUS, jamais
 * de fuzzy silencieux. Réutilise les scans bibliothèque existants.
 */
export async function resolveMovie(
  ctx: PlexUserContext,
  raw: RawMovieEvent,
): Promise<MovieResolveResult> {
  const cfg = loadPlexConfig();
  if (raw.type && raw.type !== "movie") {
    return { status: "UNRESOLVED", reason: "UNRESOLVED_INVALID_TYPE", sample: raw as Record<string, unknown> };
  }
  const ratingKey = raw.ratingKey ?? raw.key?.split("/").pop() ?? "";

  // 1) ratingKey direct → TMDB via metadata batch.
  if (ratingKey) {
    try {
      const tmdbMap = await batchTmdbIds(cfg, ctx.serverToken, [ratingKey]);
      const tmdbId = tmdbMap.get(ratingKey)?.tmdbId;
      if (tmdbId != null) {
        return { status: "RESOLVED", canonical: { type: "movie", tmdbId }, ratingKey, reason: "RESOLVED_RATING_KEY" };
      }
    } catch { /* fall through */ }
  }

  const title = raw.title?.trim();
  if (!title) {
    return { status: "UNRESOLVED", reason: "UNRESOLVED_MISSING_TITLE", sample: raw as Record<string, unknown> };
  }
  const eqTitle = (a: string, b: string) => a.trim().localeCompare(b.trim(), undefined, { sensitivity: "base" }) === 0;

  // 2) Bibliothèque Movviz : titre exact → tmdbId + plexRatingKey connu.
  try {
    const { loadMovies } = require("@/lib/library/store") as typeof import("@/lib/library/store");
    const movies = loadMovies() as Array<{ tmdbId: number; title: string; plexRatingKey?: string | null }>;
    const candidates = movies.filter((m) => eqTitle(m.title, title));
    if (candidates.length === 1 && candidates[0].plexRatingKey) {
      return { status: "RESOLVED", canonical: { type: "movie", tmdbId: candidates[0].tmdbId }, ratingKey: candidates[0].plexRatingKey!, reason: "RESOLVED_LIBRARY_LOOKUP" };
    }
    if (candidates.length > 1) {
      return { status: "UNRESOLVED", reason: "UNRESOLVED_AMBIGUOUS_MATCH", sample: { title, candidates: candidates.map((c) => c.title).slice(0, 3) } };
    }
    // 0 candidat Movviz (ou sans plexRatingKey) : continuer vers le scan Plex.
  } catch { /* fall through to Plex scan */ }

  // 3) Bibliothèque Plex : titre exact dans les sections films → vrai ratingKey → TMDB.
  const sections = await getLibrarySections(cfg, ctx.serverToken);
  const movieSections = sections.filter((s) => s.type === "movie");
  if (movieSections.length === 0) {
    return { status: "UNRESOLVED", reason: "UNRESOLVED_MEDIA_NOT_FOUND", sample: { title } };
  }
  const { getSectionRawItemsAtomic } = await import("./client");
  const candidates: { ratingKey: string; title: string }[] = [];
  for (const section of movieSections) {
    const result = await getSectionRawItemsAtomic(cfg, section.key, ctx.serverToken);
    if (!result.complete) {
      return { status: "UNRESOLVED", reason: "UNRESOLVED_MEDIA_NOT_FOUND", sample: { title, section: section.key, error: result.error } };
    }
    for (const it of result.items) {
      if (eqTitle(it.title, title)) candidates.push({ ratingKey: it.ratingKey, title: it.title });
    }
  }
  if (candidates.length === 0) {
    return { status: "UNRESOLVED", reason: "UNRESOLVED_MEDIA_NOT_FOUND", sample: { title } };
  }
  // Levée d'ambiguïté par GUID TMDB de l'événement si disponible.
  let picked = candidates[0];
  if (candidates.length > 1) {
    const wantedTmdb = tmdbIdFromGuids(raw.Guid);
    if (wantedTmdb != null) {
      const tmdbMap = await batchTmdbIds(cfg, ctx.serverToken, candidates.map((c) => c.ratingKey));
      const match = candidates.find((c) => tmdbMap.get(c.ratingKey)?.tmdbId === wantedTmdb);
      if (match) {
        picked = match;
      } else {
        return { status: "UNRESOLVED", reason: "UNRESOLVED_AMBIGUOUS_MATCH", sample: { title, candidates: candidates.map((c) => c.title).slice(0, 3) } };
      }
    } else {
      return { status: "UNRESOLVED", reason: "UNRESOLVED_AMBIGUOUS_MATCH", sample: { title, candidates: candidates.map((c) => c.title).slice(0, 3) } };
    }
  }
  const tmdbMap = await batchTmdbIds(cfg, ctx.serverToken, [picked.ratingKey]);
  const tmdbId = tmdbMap.get(picked.ratingKey)?.tmdbId;
  if (tmdbId == null) {
    return { status: "UNRESOLVED", reason: "UNRESOLVED_TMDB_MAPPING_FAILED", sample: { title, ratingKey: picked.ratingKey } };
  }
  upsertMapping({ machineIdentifier: ctx.machineIdentifier, ratingKey: picked.ratingKey, canonical: { type: "movie", tmdbId }, updatedAt: Date.now() });
  return { status: "RESOLVED", canonical: { type: "movie", tmdbId }, ratingKey: picked.ratingKey, reason: "RESOLVED_PLEX_LIBRARY" };
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
