import { withUserContextDb } from "@/lib/userContext/database";
import { getMovieByTmdbId } from "@/lib/library/store";
import { loadUsers } from "@/lib/auth/store";

/**
 * Statistiques de lecture façon Tautulli, calculées sur le journal d'événements
 * utilisateur (context_events) — la même source que l'historique de visionnage,
 * donc valable avec ou sans liaison Plex.
 *
 *  - Movviz : une lecture = un `playback_stopped` de ≥ 60 s (durée réellement vue
 *    quand le lecteur l'a déclarée, sinon la position d'arrêt).
 *  - Plex   : une lecture = un `watched_marked` de source `plex_history`.
 *  - Une vue Plex qui n'est que le miroir d'une lecture Movviz (même utilisateur,
 *    même titre, même épisode, à moins de 4 h) n'est comptée qu'une fois : Movviz gagne.
 */

export type PlaySource = "movviz" | "plex";
export type StatsPeriod = 7 | 30 | 90 | 365 | 0;

export interface PlayRecord {
  at: number;
  userId: string;
  source: PlaySource;
  tmdbId: number;
  mediaType: "movie" | "episode";
  title: string;
  season: number | null;
  episode: number | null;
  /** Durée réellement regardée en ms (null = inconnue). */
  playedMs: number | null;
  /** Durée du titre en ms (null = inconnue). */
  durationMs: number | null;
  platform: string | null;
  browser: string | null;
  mode: string | null;
}

interface EventRow {
  user_id: string;
  event_type: string;
  source: string;
  tmdb_id: number;
  media_type: string | null;
  season_number: number | null;
  episode_number: number | null;
  title_snapshot: string | null;
  position_ms: number | null;
  duration_ms: number | null;
  occurred_at: number;
  payload_json: string | null;
}

const MIN_PLAY_MS = 60_000;
const MIRROR_WINDOW_MS = 4 * 60 * 60 * 1000;
/** Durée supposée d'un épisode quand rien ne la donne (affichée comme estimation). */
const FALLBACK_EPISODE_MS = 40 * 60_000;

function parsePayload(json: string | null): Record<string, unknown> {
  if (!json) return {};
  try {
    const value = JSON.parse(json);
    return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function itemKey(r: Pick<PlayRecord, "userId" | "tmdbId" | "mediaType" | "season" | "episode">): string {
  return `${r.userId}:${r.mediaType}:${r.tmdbId}:${r.season ?? -1}:${r.episode ?? -1}`;
}

/** Toutes les lectures (Movviz + Plex) depuis `since`, dédupliquées, plus récentes d'abord. */
export function loadPlays(since: number, externalPlex?: PlayRecord[] | null): PlayRecord[] {
  const rows = withUserContextDb((db) => db.prepare(`
    SELECT user_id, event_type, source, tmdb_id, media_type, season_number, episode_number,
           title_snapshot, position_ms, duration_ms, occurred_at, payload_json
    FROM context_events
    WHERE tmdb_id IS NOT NULL
      AND occurred_at >= ?
      AND occurred_at <= ?
      AND (
        (source = 'movviz_playback' AND event_type = 'playback_stopped')
        OR (source = 'plex_history' AND event_type = 'watched_marked')
      )
    ORDER BY occurred_at DESC
    LIMIT 100000
  `).all(since, Date.now() + 86_400_000) as unknown as EventRow[], [] as EventRow[]);

  const movviz: PlayRecord[] = [];
  const plex: PlayRecord[] = [];
  for (const row of rows) {
    const mediaType = row.media_type === "movie" ? "movie" : "episode";
    const payload = parsePayload(row.payload_json);
    const base = {
      at: Number(row.occurred_at),
      userId: row.user_id,
      tmdbId: Number(row.tmdb_id),
      mediaType,
      title: row.title_snapshot?.trim() || `#${row.tmdb_id}`,
      season: mediaType === "episode" ? row.season_number : null,
      episode: mediaType === "episode" ? row.episode_number : null,
      durationMs: row.duration_ms && row.duration_ms > 0 ? row.duration_ms : null,
    } as const;
    if (row.source === "movviz_playback") {
      const played = typeof payload.playedMs === "number" ? payload.playedMs : null;
      // Sans durée déclarée (anciennes lectures), la position d'arrêt sert de mesure.
      const measured = played ?? row.position_ms ?? 0;
      if (measured < MIN_PLAY_MS) continue;
      const web = payload.web === true ? "web" : payload.web === false ? "app" : null;
      movviz.push({
        ...base,
        source: "movviz",
        playedMs: played ?? row.position_ms ?? null,
        platform: web,
        browser: typeof payload.browser === "string" ? payload.browser : null,
        mode: typeof payload.mode === "string" ? payload.mode : null,
      });
    } else {
      plex.push({ ...base, source: "plex", playedMs: null, platform: null, browser: null, mode: null });
    }
  }

  // Miroir Plex d'une lecture Movviz : on garde la lecture Movviz, plus riche.
  const mirrors = new Map<string, number[]>();
  for (const play of movviz) {
    const key = itemKey(play);
    const list = mirrors.get(key);
    if (list) list.push(play.at);
    else mirrors.set(key, [play.at]);
  }
  // Historique du serveur Plex disponible : il couvre tous les comptes et remplace
  // les vus du journal (sinon on les compterait deux fois).
  const plexSource = externalPlex ? externalPlex.filter((p) => p.at >= since) : plex;
  const plexOnly = plexSource.filter((play) => !(mirrors.get(itemKey(play)) ?? []).some((at) => Math.abs(at - play.at) <= MIRROR_WINDOW_MS));

  // Deux lignes Plex quasi identiques (même vue relue par deux chemins) : une seule.
  const seen = new Map<string, number>();
  const dedupedPlex = plexOnly.filter((play) => {
    const key = itemKey(play);
    const last = seen.get(key);
    if (last != null && Math.abs(last - play.at) <= 120_000) return false;
    seen.set(key, play.at);
    return true;
  });

  return [...movviz, ...dedupedPlex].sort((a, b) => b.at - a.at);
}

function watchedMs(play: PlayRecord): { ms: number; estimated: boolean } {
  if (play.playedMs != null && play.playedMs > 0) return { ms: play.playedMs, estimated: false };
  if (play.durationMs) return { ms: play.durationMs, estimated: true };
  if (play.mediaType === "movie") {
    const runtime = getMovieByTmdbId(play.tmdbId)?.runtime;
    if (runtime) return { ms: runtime * 60_000, estimated: true };
    return { ms: 100 * 60_000, estimated: true };
  }
  return { ms: FALLBACK_EPISODE_MS, estimated: true };
}

export interface SourceSplit { movviz: number; plex: number }
const split = (): SourceSplit => ({ movviz: 0, plex: 0 });

export interface StatsResult {
  period: StatsPeriod;
  generatedAt: number;
  totals: {
    plays: number;
    watchedMs: number;
    watchedEstimated: boolean;
    users: number;
    movies: number;
    episodes: number;
    bySource: SourceSplit;
    previousPlays: number;
  };
  byDay: Array<{ date: string } & SourceSplit>;
  byWeekday: SourceSplit[];
  byHour: SourceSplit[];
  byPlatform: Array<{ key: string; plays: number }>;
  byMode: Array<{ key: string; plays: number }>;
  topMovies: Array<{ tmdbId: number; title: string; plays: number; users: number; lastAt: number }>;
  topSeries: Array<{ tmdbId: number; title: string; plays: number; users: number; lastAt: number }>;
  topUsers: Array<{ userId: string; username: string; plays: number; watchedMs: number; lastAt: number; bySource: SourceSplit }>;
  users: Array<{ id: string; username: string }>;
  recent: Array<{
    at: number;
    userId: string;
    username: string;
    title: string;
    mediaType: "movie" | "episode";
    tmdbId: number;
    season: number | null;
    episode: number | null;
    source: PlaySource;
    playedMs: number | null;
    percent: number | null;
    platform: string | null;
    browser: string | null;
    mode: string | null;
  }>;
  recentTotal: number;
}

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Période → début du chargement (inclut la période précédente pour l'évolution). */
export function statsLoadFrom(period: StatsPeriod): number {
  return period === 0 ? 0 : Date.now() - 2 * period * 86_400_000;
}

export function computeStats(
  options: { period: StatsPeriod; source?: PlaySource | null; userId?: string | null; offset?: number; limit?: number },
  external?: { plays: PlayRecord[]; names: Map<string, string> } | null,
): StatsResult {
  const now = Date.now();
  const period = options.period;
  const since = period === 0 ? 0 : now - period * 86_400_000;
  // On charge aussi la période précédente (même durée) pour afficher l'évolution.
  const loadFrom = period === 0 ? 0 : since - period * 86_400_000;
  const everything = loadPlays(loadFrom, external?.plays ?? null).filter((play) =>
    (!options.source || play.source === options.source) && (!options.userId || play.userId === options.userId));

  const plays = everything.filter((play) => play.at >= since);
  const previousPlays = period === 0 ? 0 : everything.length - plays.length;

  const allUsers = loadUsers();
  const nameOf = (id: string) => allUsers.find((u) => u.id === id)?.username ?? external?.names.get(id) ?? "—";

  const byDayMap = new Map<string, SourceSplit>();
  if (period !== 0) {
    for (let i = period - 1; i >= 0; i--) byDayMap.set(dayKey(now - i * 86_400_000), split());
  }
  const byWeekday = Array.from({ length: 7 }, split);
  const byHour = Array.from({ length: 24 }, split);
  const platforms = new Map<string, number>();
  const modes = new Map<string, number>();
  const movies = new Map<number, { title: string; plays: number; users: Set<string>; lastAt: number }>();
  const series = new Map<number, { title: string; plays: number; users: Set<string>; lastAt: number }>();
  const users = new Map<string, { plays: number; watchedMs: number; lastAt: number; bySource: SourceSplit }>();
  const bySource = split();
  let watchedTotal = 0;
  let estimated = false;
  let movieCount = 0;
  let episodeCount = 0;

  for (const play of plays) {
    const d = new Date(play.at);
    const day = dayKey(play.at);
    const bucket = byDayMap.get(day) ?? split();
    bucket[play.source]++;
    byDayMap.set(day, bucket);
    byWeekday[(d.getDay() + 6) % 7][play.source]++;
    byHour[d.getHours()][play.source]++;
    bySource[play.source]++;
    if (play.mediaType === "movie") movieCount++; else episodeCount++;

    if (play.source === "movviz") {
      const platform = play.platform === "web" ? (play.browser ? `web:${play.browser.split(" ")[0]}` : "web") : play.platform ?? "unknown";
      platforms.set(platform, (platforms.get(platform) ?? 0) + 1);
      const mode = play.mode ?? "unknown";
      modes.set(mode, (modes.get(mode) ?? 0) + 1);
    }

    const target = play.mediaType === "movie" ? movies : series;
    const entry = target.get(play.tmdbId) ?? { title: play.title, plays: 0, users: new Set<string>(), lastAt: 0 };
    entry.plays++;
    entry.users.add(play.userId);
    if (play.at > entry.lastAt) { entry.lastAt = play.at; entry.title = play.title; }
    target.set(play.tmdbId, entry);

    const w = watchedMs(play);
    watchedTotal += w.ms;
    if (w.estimated) estimated = true;
    const u = users.get(play.userId) ?? { plays: 0, watchedMs: 0, lastAt: 0, bySource: split() };
    u.plays++;
    u.watchedMs += w.ms;
    u.bySource[play.source]++;
    if (play.at > u.lastAt) u.lastAt = play.at;
    users.set(play.userId, u);
  }

  const rank = <T extends { plays: number }>(list: T[], n = 10) => list.sort((a, b) => b.plays - a.plays).slice(0, n);
  const offset = Math.max(0, options.offset ?? 0);
  const limit = Math.min(200, Math.max(1, options.limit ?? 50));

  return {
    period,
    generatedAt: now,
    totals: {
      plays: plays.length,
      watchedMs: watchedTotal,
      watchedEstimated: estimated,
      users: users.size,
      movies: movieCount,
      episodes: episodeCount,
      bySource,
      previousPlays,
    },
    byDay: [...byDayMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v })),
    byWeekday,
    byHour,
    byPlatform: rank([...platforms.entries()].map(([key, n]) => ({ key, plays: n })), 12),
    byMode: rank([...modes.entries()].map(([key, n]) => ({ key, plays: n })), 8),
    topMovies: rank([...movies.entries()].map(([tmdbId, v]) => ({ tmdbId, title: v.title, plays: v.plays, users: v.users.size, lastAt: v.lastAt }))),
    topSeries: rank([...series.entries()].map(([tmdbId, v]) => ({ tmdbId, title: v.title, plays: v.plays, users: v.users.size, lastAt: v.lastAt }))),
    topUsers: rank([...users.entries()].map(([userId, v]) => ({ userId, username: nameOf(userId), ...v })), 20),
    users: [
      ...allUsers.map((u) => ({ id: u.id, username: u.username })),
      ...[...(external?.names ?? [])].map(([id, username]) => ({ id, username })),
    ],
    recent: plays.slice(offset, offset + limit).map((play) => {
      const duration = play.durationMs;
      return {
        at: play.at,
        userId: play.userId,
        username: nameOf(play.userId),
        title: play.title,
        mediaType: play.mediaType,
        tmdbId: play.tmdbId,
        season: play.season,
        episode: play.episode,
        source: play.source,
        playedMs: play.playedMs,
        percent: duration && play.playedMs ? Math.min(100, Math.round((play.playedMs / duration) * 100)) : null,
        platform: play.platform,
        browser: play.browser,
        mode: play.mode,
      };
    }),
    recentTotal: plays.length,
  };
}
