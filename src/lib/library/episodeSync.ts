import { loadSeries, getSeries, updateSeries } from "@/lib/library/store";
import { getSeries as fetchTmdbSeries, getSeason as fetchTmdbSeason, isPlaceholderEpisodeTitle } from "@/lib/metadata/tmdb";
import { isFresh, markDone } from "@/lib/library/taskMemory";
import { specialsEnabled } from "@/lib/metadata/tvdb";
import { episodeStatus, seasonEpisodeStatuses } from "@/lib/library/releaseSchedule";
import { withKeyLock } from "@/lib/library/locks";
import { BLEACH_TMDB_ID } from "@/lib/metadata/bleachEpisodeOrder";
import { shrinkToLongCut } from "@/lib/metadata/longCutSeasons";
import { yieldToEventLoop, trackJobProgress } from "@/lib/jobs/cancelScope";
import type { LibraryEpisode, LibrarySeason, LibrarySeries } from "@/lib/library/types";
import type { MetaSeason } from "@/lib/metadata/types";

/**
 * Daily episode-list sync for library series. A series' seasons/episodes
 * used to be built once, at add time, and never again: episodes TMDb listed
 * later (Link Click season 4 stayed at 1 of 12 episodes), new seasons, and
 * episode titles/air dates published after the add were never picked up.
 *
 * Strictly additive and conservative:
 * - updates episode titles, air dates (and the status of still-upcoming
 *   episodes) and season names;
 * - appends episodes/seasons TMDb now lists (new seasons only for monitored
 *   series, inheriting the season/series monitoring);
 * - never deletes anything, never touches files, downloads or Plex links;
 * - skips series whose structure doesn't match TMDb's (TVDB-ordered anime,
 *   Bleach, a library season TMDb doesn't have, more episodes than TMDb),
 *   since their numbering can't be safely reconciled automatically.
 *
 * Incrémental : ne redemande à TMDb que ce qui peut avoir changé.
 * - une série terminée et complète n'est revérifiée que tous les 3 jours ;
 * - pour une série revérifiée, le détail d'une saison n'est chargé que si le nombre
 *   d'épisodes annoncé par la fiche série diffère de celui de la bibliothèque, ou si un
 *   épisode est encore à venir, sans titre ou sans date ;
 * - une vérification complète (toutes les saisons) a lieu environ une fois par mois et par série,
 *   étalée dans le temps, pour rattraper un titre corrigé sur TMDb.
 * Un nouvel épisode, une nouvelle saison ou un titre manquant restent donc détectés dès le
 * prochain passage ; le titre d'un épisode qui vient d'arriver est de plus rechargé aussitôt
 * (episodeMeta.ts).
 */
const MEMORY_SCOPE = "series-episodes-sync";
const DAY_MS = 24 * 60 * 60 * 1000;
const ENDED_RECHECK_MS = 3 * DAY_MS;
const DEEP_RECHECK_MS = 30 * DAY_MS;

function isUnsettled(ep: LibraryEpisode): boolean {
  return ep.status === "upcoming" || !ep.airDate || isPlaceholderEpisodeTitle(ep.title);
}

function seriesNeedsCheck(series: LibrarySeries, now: number): boolean {
  const ended = /^(ended|canceled|cancelled)$/i.test(series.tvStatus ?? "");
  const unsettled = series.seasons.some((season) => season.episodes.some(isUnsettled));
  if (!ended || unsettled) return true;
  return !isFresh(MEMORY_SCOPE, series.id, ENDED_RECHECK_MS, undefined, now);
}
export async function syncSeriesEpisodes(): Promise<{ checked: number; updated: number; episodesAdded: number; skipped: number }> {
  let checked = 0;
  let updated = 0;
  let episodesAdded = 0;
  let skipped = 0;
  const specials = specialsEnabled();
  const now = Date.now();
  const allSeries = loadSeries();
  const tick = trackJobProgress(allSeries.length);

  for (const listed of allSeries) {
    await yieldToEventLoop();
    tick();
    if (listed.tmdbId === BLEACH_TMDB_ID || listed.episodeOrder === "tvdb") { skipped++; continue; }
    if (!seriesNeedsCheck(listed, now)) continue;
    const meta = await fetchTmdbSeries(listed.tmdbId).catch(() => null);
    if (!meta) continue;
    checked++;

    const deep = !isFresh(MEMORY_SCOPE, `${listed.id}:deep`, DEEP_RECHECK_MS, undefined, now);
    const tmdbSeasons: MetaSeason[] = [];
    for (const s of meta.seasons) {
      if (s.seasonNumber === 0 && !specials && !listed.seasons.some((ls) => ls.seasonNumber === 0)) continue;
      const local = listed.seasons.find((ls) => ls.seasonNumber === s.seasonNumber);
      const changed = !local || local.episodes.length !== s.episodeCount || local.episodes.some(isUnsettled);
      if (!deep && !changed) continue;
      const detail = await fetchTmdbSeason(listed.tmdbId, s.seasonNumber).catch(() => null);
      if (detail) tmdbSeasons.push(detail);
    }
    markDone(MEMORY_SCOPE, listed.id);
    if (deep) markDone(MEMORY_SCOPE, `${listed.id}:deep`, undefined, 5 * DAY_MS);
    if (tmdbSeasons.length === 0) continue;

    const outcome = await withKeyLock(`series:${listed.id}`, async () => {
      const current = getSeries(listed.id);
      if (!current) return null;
      // Passage partiel : seules certaines saisons ont été relues, les autres ne sont pas à valider.
      const merged = mergeSeasons(current, tmdbSeasons, { partial: !deep });
      if (!merged) return "skip" as const;
      if (!merged.changed) return null;
      updateSeries(current.id, { seasons: merged.seasons });
      return merged.added;
    });
    if (outcome === "skip") skipped++;
    else if (typeof outcome === "number") { updated++; episodesAdded += outcome; }
  }
  return { checked, updated, episodesAdded, skipped };
}

/** Brings seasons still in broadcast numbering to their long cut. Idempotent; run at boot. */
export async function repairLongCutSeasons(): Promise<number> {
  let repaired = 0;
  for (const listed of loadSeries()) {
    if (!listed.seasons.some((season) => shrinkToLongCut(listed.tmdbId, season.seasonNumber, season.episodes) !== season.episodes)) continue;
    await withKeyLock(`series:${listed.id}`, async () => {
      const current = getSeries(listed.id);
      if (!current) return;
      updateSeries(current.id, { seasons: current.seasons.map((season) => ({ ...season, episodes: shrinkToLongCut(current.tmdbId, season.seasonNumber, season.episodes) })) });
      repaired++;
    });
  }
  return repaired;
}

/** Returns null when the library structure is incompatible with TMDb's. */
export function mergeSeasons(series: LibrarySeries, tmdbSeasons: MetaSeason[], opts?: { partial?: boolean }): { seasons: LibrarySeason[]; changed: boolean; added: number } | null {
  const tmdbByNumber = new Map(tmdbSeasons.map((s) => [s.seasonNumber, s] as const));
  for (const ls of series.seasons) {
    const ts = tmdbByNumber.get(ls.seasonNumber);
    if (!ts) {
      // A library season TMDb doesn't know only matters if it holds episodes.
      if (!opts?.partial && ls.episodes.length > 0) return null;
      continue;
    }
    const tmdbNumbers = new Set(ts.episodes.map((e) => e.episodeNumber));
    if (ls.episodes.some((e) => !tmdbNumbers.has(e.episodeNumber))) return null;
  }

  let changed = false;
  let added = 0;
  const seasons: LibrarySeason[] = series.seasons.map((ls) => {
    const ts = tmdbByNumber.get(ls.seasonNumber);
    if (!ts) return ls;
    const statuses = seasonEpisodeStatuses(ts.episodes);
    const byNumber = new Map(ls.episodes.map((e) => [e.episodeNumber, e] as const));
    const episodes: LibraryEpisode[] = ts.episodes.map((te) => {
      const existing = byNumber.get(te.episodeNumber);
      if (!existing) {
        changed = true;
        added++;
        return newEpisode(ls.seasonNumber, te, ls.monitored, statuses.get(te.episodeNumber) ?? episodeStatus(te.airDate, te.title));
      }
      const title = te.title?.trim() ? te.title : existing.title;
      const airDate = te.airDate ?? existing.airDate;
      // Only a still-upcoming episode follows a moved date; anything already
      // missing/downloading/available keeps the status it earned.
      const status = existing.status === "upcoming" && airDate !== existing.airDate
        ? (statuses.get(te.episodeNumber) ?? episodeStatus(airDate, title))
        : existing.status;
      if (title === existing.title && airDate === existing.airDate && status === existing.status) return existing;
      changed = true;
      return { ...existing, title, airDate, status };
    });
    const name = ts.name?.trim() ? ts.name : ls.name;
    if (name !== ls.name) changed = true;
    return { ...ls, name, episodes };
  });

  // Brand-new seasons: only for a series the user is following.
  if (series.monitored) {
    const known = new Set(series.seasons.map((s) => s.seasonNumber));
    for (const ts of tmdbSeasons) {
      if (known.has(ts.seasonNumber) || ts.episodes.length === 0) continue;
      const monitored = ts.seasonNumber !== 0;
      const statuses = seasonEpisodeStatuses(ts.episodes);
      seasons.push({
        seasonNumber: ts.seasonNumber,
        name: ts.name,
        monitored,
        episodes: ts.episodes.map((te) => newEpisode(ts.seasonNumber, te, monitored, statuses.get(te.episodeNumber) ?? episodeStatus(te.airDate, te.title))),
      });
      changed = true;
      added += ts.episodes.length;
    }
    seasons.sort((a, b) => a.seasonNumber - b.seasonNumber);
  }
  return { seasons, changed, added };
}

function newEpisode(seasonNumber: number, te: MetaSeason["episodes"][number], monitored: boolean, status: LibraryEpisode["status"]): LibraryEpisode {
  return {
    seasonNumber,
    episodeNumber: te.episodeNumber,
    title: te.title,
    airDate: te.airDate,
    monitored,
    // Unaired episodes start "upcoming"; release-day-search flips them to
    // "missing" (and searches them) on their air date, like any new add.
    status,
    file: null,
    activeInfoHash: null,
    plexRatingKey: null,
  };
}
