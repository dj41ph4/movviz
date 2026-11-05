import { getMovie, getSeries } from "@/lib/metadata/tmdb";
import { mapWithConcurrency } from "@/lib/metadata/resolveTitle";
import { getWatchStatus } from "@/lib/plex/watchStore";

/**
 * Movviz → LifeHub (demande explicite user) — inverse of importHistory.ts.
 * Returns ONE user's watched history in the exact shape of a LifeHub export
 * (docs/LIFEHUB_API_CONTRAT.md), so LifeHub can ingest it with its existing
 * import code. Read-only: nothing here writes to the watch store.
 *
 *  - movie watched                      → "vu"
 *  - series, every regular episode seen → "vu"
 *  - series partly seen                 → "en_cours", current_* = the episode
 *    AFTER the last one seen (what importHistory.ts reads back as "not yet
 *    watched", so a round trip is stable).
 */

const CONCURRENCY = 4;

export interface LifehubExportTitle {
  media_type: "movie" | "tv";
  tmdb_id: number;
  title: string;
  status: "vu" | "en_cours";
  current_season: number | null;
  current_episode: number | null;
  updated_at: string;
}

export interface LifehubExport {
  source: "Movviz";
  export_date: string;
  nombre: number;
  titres: LifehubExportTitle[];
}

/** 1767225600000 → "2026-01-01 00:00:00.000+00" (LifeHub's own timestamp style). */
export function toLifehubTimestamp(ms: number): string {
  return new Date(ms).toISOString().replace("T", " ").replace("Z", "+00");
}

export async function buildLifehubExport(userId: string, sinceMs: number | null): Promise<LifehubExport> {
  const status = getWatchStatus(userId);
  const fallbackAt = status?.updatedAt ?? Date.now();
  const titres: LifehubExportTitle[] = [];

  const movieIds = [...new Set(status?.movies ?? [])];
  const movieRows = await mapWithConcurrency(movieIds, CONCURRENCY, async (tmdbId) => {
    const at = status?.movieWatchedAt?.[String(tmdbId)] ?? fallbackAt;
    if (sinceMs != null && at < sinceMs) return null;
    const meta = await getMovie(tmdbId).catch(() => null);
    return {
      media_type: "movie" as const,
      tmdb_id: tmdbId,
      title: meta?.title ?? status?.recent?.find((r) => r.type === "movie" && r.tmdbId === tmdbId)?.title ?? String(tmdbId),
      status: "vu" as const,
      current_season: null,
      current_episode: null,
      updated_at: toLifehubTimestamp(at),
    };
  });
  for (const row of movieRows) if (row) titres.push(row);

  const bySeries = new Map<number, { season: number; episode: number; at: number }[]>();
  for (const e of status?.episodes ?? []) {
    if (e.season < 1) continue; // specials are never part of the LifeHub model
    const list = bySeries.get(e.tmdbId) ?? [];
    list.push({ season: e.season, episode: e.episode, at: e.at ?? fallbackAt });
    bySeries.set(e.tmdbId, list);
  }

  const seriesRows = await mapWithConcurrency([...bySeries.entries()], CONCURRENCY, async ([tmdbId, eps]) => {
    const updatedAt = Math.max(...eps.map((e) => e.at));
    if (sinceMs != null && updatedAt < sinceMs) return null;
    const series = await getSeries(tmdbId).catch(() => null);
    const counts = new Map((series?.seasons ?? []).filter((s) => s.seasonNumber >= 1).map((s) => [s.seasonNumber, s.episodeCount]));
    const seen = new Set(eps.map((e) => `${e.season}.${e.episode}`));
    const complete = counts.size > 0 && [...counts].every(([season, count]) => {
      for (let n = 1; n <= count; n++) if (!seen.has(`${season}.${n}`)) return false;
      return true;
    });
    const last = eps.reduce((a, b) => (b.season > a.season || (b.season === a.season && b.episode > a.episode) ? b : a));
    let nextSeason = last.season;
    let nextEpisode = last.episode + 1;
    const lastCount = counts.get(last.season);
    if (lastCount != null && last.episode >= lastCount && counts.has(last.season + 1)) {
      nextSeason = last.season + 1;
      nextEpisode = 1;
    }
    return {
      media_type: "tv" as const,
      tmdb_id: tmdbId,
      title: series?.title ?? status?.recent?.find((r) => r.type === "series" && r.tmdbId === tmdbId)?.title ?? String(tmdbId),
      status: complete ? ("vu" as const) : ("en_cours" as const),
      current_season: complete ? null : nextSeason,
      current_episode: complete ? null : nextEpisode,
      updated_at: toLifehubTimestamp(updatedAt),
    };
  });
  for (const row of seriesRows) if (row) titres.push(row);

  titres.sort((a, b) => a.title.localeCompare(b.title));
  return { source: "Movviz", export_date: new Date().toISOString().slice(0, 10), nombre: titres.length, titres };
}
