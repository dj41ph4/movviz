import { getSeries, loadSeries, updateSeries, onEpisodeArrival } from "@/lib/library/store";
import { getSeason as fetchTmdbSeason, refreshSeasonFromTmdb, isPlaceholderEpisodeTitle } from "@/lib/metadata/tmdb";
import { mergeSeasons } from "@/lib/library/episodeSync";
import { withKeyLock } from "@/lib/library/locks";
import { BLEACH_TMDB_ID } from "@/lib/metadata/bleachEpisodeOrder";
import { isFresh, markDone } from "@/lib/library/taskMemory";
import { recordSearchLog } from "@/lib/diagnostic/searchLog";
import { runBackground } from "@/lib/priority/lane";
import type { LibraryEpisode, LibrarySeries } from "@/lib/library/types";
import type { MetaSeason } from "@/lib/metadata/types";

/**
 * Titre et synopsis d'un épisode qui vient d'apparaître, sans attendre la synchronisation
 * quotidienne : un épisode peut sortir (ou être déposé dans le dossier, ou arriver par Plex)
 * avant que TMDb ait son titre. Dès qu'un épisode devient disponible, sa saison est rechargée
 * depuis TMDb en ignorant le cache ; tant qu'un épisode récent reste sans titre, une tâche
 * légère repasse sur lui. TMDb sans traduction : titre et synopsis anglais plutôt que rien.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
/** Un épisode sorti depuis moins longtemps peut encore voir son titre ou son synopsis changer sur TMDb. */
const RECENT_MS = 30 * DAY_MS;
/** Une saison déjà rechargée à neuf n'est pas redemandée à TMDb avant ce délai. */
const FRESH_FETCH_MIN_GAP_MS = 10 * 60 * 1000;
const MEMORY_SCOPE = "episode-meta";
/** Épisode sans date connue : on ne redemande pas plus d'une fois par jour. */
const UNDATED_RECHECK_MS = DAY_MS;
const MAX_SEASONS_PER_PENDING_RUN = 30;

type MetaGlobals = {
  __movvizEpisodeMeta?: { lastFresh: Map<string, number>; queue: Map<string, Set<number>>; timer: ReturnType<typeof setTimeout> | null; running: boolean; listening: boolean };
};
const state = ((globalThis as MetaGlobals).__movvizEpisodeMeta ??= { lastFresh: new Map(), queue: new Map(), timer: null, running: false, listening: false });

function airedAt(ep: LibraryEpisode): number {
  return ep.airDate ? Date.parse(ep.airDate) : Number.NaN;
}

/** Épisode qu'il vaut la peine de redemander à TMDb : titre manquant, date inconnue, ou sorti récemment. */
export function episodeMayBeIncomplete(ep: LibraryEpisode, now = Date.now()): boolean {
  const aired = airedAt(ep);
  if (Number.isNaN(aired)) return true;
  if (isPlaceholderEpisodeTitle(ep.title)) return true;
  return now - aired < RECENT_MS;
}

/** Épisode sans titre à surveiller régulièrement (sorti récemment, déjà présent, ou date inconnue). */
function episodeNeedsFollowUp(ep: LibraryEpisode, now: number): boolean {
  const aired = airedAt(ep);
  if (Number.isNaN(aired)) return true;
  if (!isPlaceholderEpisodeTitle(ep.title)) return false;
  return !!ep.file || now - aired < 60 * DAY_MS;
}

function syncable(series: LibrarySeries): boolean {
  return series.tmdbId !== BLEACH_TMDB_ID && series.episodeOrder !== "tvdb";
}

/** Recharge ces saisons depuis TMDb (copie en cache ignorée) et reporte titres, dates et nouveaux épisodes. */
export async function refreshSeasonsMeta(seriesId: string, seasonNumbers: number[]): Promise<{ updated: boolean; episodesAdded: number }> {
  const listed = getSeries(seriesId);
  if (!listed || !syncable(listed)) return { updated: false, episodesAdded: 0 };
  const details: MetaSeason[] = [];
  for (const seasonNumber of [...new Set(seasonNumbers)]) {
    const key = `${listed.tmdbId}:${seasonNumber}`;
    const last = state.lastFresh.get(key) ?? 0;
    if (Date.now() - last >= FRESH_FETCH_MIN_GAP_MS) {
      state.lastFresh.set(key, Date.now());
      await refreshSeasonFromTmdb(listed.tmdbId, seasonNumber).catch(() => {});
    }
    const detail = await fetchTmdbSeason(listed.tmdbId, seasonNumber).catch(() => null);
    if (detail) details.push(detail);
  }
  if (details.length === 0) return { updated: false, episodesAdded: 0 };
  return withKeyLock(`series:${listed.id}`, async () => {
    const current = getSeries(listed.id);
    if (!current) return { updated: false, episodesAdded: 0 };
    const merged = mergeSeasons(current, details, { partial: true });
    if (!merged || !merged.changed) return { updated: false, episodesAdded: 0 };
    updateSeries(current.id, { seasons: merged.seasons });
    return { updated: true, episodesAdded: merged.added };
  });
}

async function drainQueue(): Promise<void> {
  if (state.running) return;
  state.running = true;
  try {
    while (state.queue.size > 0) {
      const [seriesId, seasons] = state.queue.entries().next().value as [string, Set<number>];
      state.queue.delete(seriesId);
      try {
        const result = await refreshSeasonsMeta(seriesId, [...seasons]);
        if (result.updated) {
          const title = getSeries(seriesId)?.title ?? seriesId;
          recordSearchLog("info", "episode_meta.refreshed", `${title} : saison(s) ${[...seasons].join(", ")} rechargée(s) depuis TMDb${result.episodesAdded ? `, ${result.episodesAdded} épisode(s) ajouté(s)` : ""}`);
        }
      } catch (e) {
        recordSearchLog("warn", "episode_meta.failed", `${seriesId} : ${(e as Error)?.message ?? e}`);
      }
    }
  } finally {
    state.running = false;
  }
}

/** Met en file le rechargement de ces saisons (regroupé : plusieurs arrivées d'un coup = un seul appel par saison). */
export function queueEpisodeMetaRefresh(seriesId: string, seasonNumbers: number[]): void {
  if (seasonNumbers.length === 0) return;
  const set = state.queue.get(seriesId) ?? new Set<number>();
  for (const n of seasonNumbers) set.add(n);
  state.queue.set(seriesId, set);
  if (state.timer) return;
  state.timer = setTimeout(() => {
    state.timer = null;
    void runBackground(() => drainQueue());
  }, 4_000);
  state.timer.unref?.();
}

/**
 * À brancher au démarrage : tout épisode qui devient disponible — téléchargé par Movviz, déposé
 * dans le dossier, importé de Plex — fait recharger sa saison, s'il peut encore être incomplet.
 * Un épisode ancien et complet ne coûte rien.
 */
export function registerEpisodeMetaListener(): void {
  if (state.listening) return;
  state.listening = true;
  onEpisodeArrival((seriesId, arrived) => {
    const series = getSeries(seriesId);
    if (!series || !syncable(series)) return;
    const now = Date.now();
    const seasons = new Set<number>();
    for (const { seasonNumber, episodeNumber } of arrived) {
      const ep = series.seasons.find((s) => s.seasonNumber === seasonNumber)?.episodes.find((e) => e.episodeNumber === episodeNumber);
      if (ep && episodeMayBeIncomplete(ep, now)) seasons.add(seasonNumber);
    }
    if (seasons.size > 0) queueEpisodeMetaRefresh(seriesId, [...seasons]);
  });
}

/** Tâche légère : repasse sur les saisons dont un épisode récent ou déjà présent n'a toujours pas de titre. */
export async function refreshPendingEpisodeMeta(): Promise<{ seasons: number; updated: number }> {
  const now = Date.now();
  const due: { seriesId: string; seasonNumber: number; latest: number }[] = [];
  for (const series of loadSeries()) {
    if (!syncable(series)) continue;
    for (const season of series.seasons) {
      const waiting = season.episodes.filter((ep) => episodeNeedsFollowUp(ep, now));
      if (waiting.length === 0) continue;
      // Rien ne presse pour une date inconnue : un passage par jour suffit.
      const onlyUndated = waiting.every((ep) => Number.isNaN(airedAt(ep)));
      const key = `${series.id}:${season.seasonNumber}`;
      if (onlyUndated && isFresh(MEMORY_SCOPE, key, UNDATED_RECHECK_MS, undefined, now)) continue;
      const latest = Math.max(0, ...waiting.map((ep) => (Number.isNaN(airedAt(ep)) ? 0 : airedAt(ep))));
      due.push({ seriesId: series.id, seasonNumber: season.seasonNumber, latest });
    }
  }
  due.sort((a, b) => b.latest - a.latest);
  let updated = 0;
  const batch = due.slice(0, MAX_SEASONS_PER_PENDING_RUN);
  for (const item of batch) {
    const result = await refreshSeasonsMeta(item.seriesId, [item.seasonNumber]).catch(() => ({ updated: false, episodesAdded: 0 }));
    if (result.updated) updated++;
    markDone(MEMORY_SCOPE, `${item.seriesId}:${item.seasonNumber}`);
  }
  return { seasons: batch.length, updated };
}
