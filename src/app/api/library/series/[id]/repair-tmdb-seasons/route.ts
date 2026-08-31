import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { getSeries, updateSeries } from "@/lib/library/store";
import { getSeries as fetchTmdbSeries, getSeason as fetchTmdbSeason } from "@/lib/metadata/tmdb";
import type { LibraryEpisode, LibrarySeason } from "@/lib/library/types";
import { episodeStatus } from "@/lib/library/releaseSchedule";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/**
 * One-off admin repair tool — NOT wired into any UI. Rebuilds a series'
 * entire season/episode list fresh from TMDb's CURRENT structure, carrying
 * over existing episode data (status/file/monitored/activeInfoHash/
 * plexRatingKey) via an explicit caller-supplied map instead of guessing.
 *
 * Exists because TMDb occasionally restructures a show's seasons (e.g.
 * Bleach: originally split into ~16 TVDB-style arc seasons, later
 * consolidated by TMDb into one giant 366-episode season 1 + a separate
 * sequel season) — when that happens, a library entry built under the old
 * numbering silently drifts out of sync (season numbers that no longer
 * exist on TMDb, episodes TMDb now lists that were never added). Purely
 * additive/corrective: never deletes an episode's tracked data, only
 * relocates it to its correct (season, episode) position. Requires an
 * explicit map because auto-detecting "this episode moved from season 11
 * episode 1 to season 1 episode 206" generically (vs. actually new/missing
 * episodes) isn't reliably inferable — a human confirms the mapping first.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const id = (await params).id;
  const series = getSeries(id);
  if (!series) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await req.json().catch(() => null) as {
    episodeMap?: { oldSeason: number; oldEpisode: number; newSeason: number; newEpisode: number }[];
  } | null;
  const episodeMap = body?.episodeMap ?? [];

  const meta = await fetchTmdbSeries(series.tmdbId);
  if (!meta) return NextResponse.json({ error: "tmdb_not_found" }, { status: 502 });

  const oldByKey = new Map<string, LibraryEpisode>();
  for (const s of series.seasons) {
    for (const e of s.episodes) oldByKey.set(`${s.seasonNumber}-${e.episodeNumber}`, e);
  }
  const mapByTarget = new Map<string, { oldSeason: number; oldEpisode: number }>();
  for (const m of episodeMap) mapByTarget.set(`${m.newSeason}-${m.newEpisode}`, m);

  const newSeasons: LibrarySeason[] = [];
  for (const s of meta.seasons) {
    const detail = await fetchTmdbSeason(series.tmdbId, s.seasonNumber);
    const monitoredByDefault = s.seasonNumber !== 0;
    const episodes: LibraryEpisode[] = (detail?.episodes ?? []).map((e) => {
      const directOld = oldByKey.get(`${s.seasonNumber}-${e.episodeNumber}`);
      const mapping = mapByTarget.get(`${s.seasonNumber}-${e.episodeNumber}`);
      const mappedOld = mapping ? oldByKey.get(`${mapping.oldSeason}-${mapping.oldEpisode}`) : undefined;
      const old = directOld ?? mappedOld;
      return {
        seasonNumber: e.seasonNumber,
        episodeNumber: e.episodeNumber,
        title: old?.title || e.title,
        airDate: e.airDate,
        monitored: old?.monitored ?? monitoredByDefault,
        status: old?.status ?? episodeStatus(e.airDate, e.title),
        file: old?.file ?? null,
        activeInfoHash: old?.activeInfoHash ?? null,
        plexRatingKey: old?.plexRatingKey ?? null,
      };
    });
    newSeasons.push({ seasonNumber: s.seasonNumber, name: s.name, monitored: monitoredByDefault, episodes });
  }

  const carriedCount = newSeasons.reduce((n, s) => n + s.episodes.filter((e) => e.file).length, 0);
  const oldCarriedCount = series.seasons.reduce((n, s) => n + s.episodes.filter((e) => e.file).length, 0);
  if (carriedCount < oldCarriedCount) {
    // Safety net: never save a rebuild that would silently drop episodes
    // that currently have a real file attached.
    return NextResponse.json({ error: "carry_over_mismatch", before: oldCarriedCount, after: carriedCount }, { status: 409 });
  }

  updateSeries(id, { seasons: newSeasons });
  return NextResponse.json({
    ok: true,
    oldSeasonCount: series.seasons.length,
    newSeasonCount: newSeasons.length,
    oldEpisodesWithFile: oldCarriedCount,
    newEpisodesWithFile: carriedCount,
  });
}
