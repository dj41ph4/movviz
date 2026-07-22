import { loadTvdbConfig } from "./tvdbStore";
import { getCache } from "@/lib/cache/registry";

/**
 * TheTVDB v4 API client. TVDB tends to have more accurate episode numbering
 * and titles for anime than TMDb, which is why it's the reference source for
 * that content type — used the same way here, opt-in via Settings.
 */

const BASE = "https://api4.thetvdb.com/v4";
const TOKEN_TTL_MS = 25 * 24 * 60 * 60 * 1000; // TVDB tokens are valid ~1 month; refresh a bit early

function apiKey(): string | null {
  return process.env.MOVVIZ_TVDB_API_KEY ?? loadTvdbConfig().apiKey;
}

export function tvdbConfigured(): boolean {
  return !!apiKey();
}

async function getToken(): Promise<string | null> {
  const key = apiKey();
  if (!key) return null;
  const cache = getCache("The TVDB API", TOKEN_TTL_MS);
  const cached = cache.get<string>("token");
  if (cached) return cached;

  try {
    const res = await fetch(`${BASE}/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apikey: key }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const token: string | undefined = data?.data?.token;
    if (!token) return null;
    cache.set("token", token);
    return token;
  } catch {
    return null;
  }
}

async function tvdbGet<T>(path: string): Promise<T | null> {
  const token = await getToken();
  if (!token) return null;
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.data ?? null) as T;
  } catch {
    return null;
  }
}

export interface TvdbSearchResult {
  tvdbId: number;
  name: string;
  year: number | null;
}

export async function searchTvdbSeries(query: string): Promise<TvdbSearchResult[]> {
  const results = await tvdbGet<RawSearchResult[]>(`/search?query=${encodeURIComponent(query)}&type=series`);
  if (!results) return [];
  return results
    .filter((r) => r.tvdb_id)
    .map((r) => ({
      tvdbId: Number(r.tvdb_id),
      name: r.name,
      year: r.year ? Number(r.year) : null,
    }));
}

export interface TvdbEpisode {
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  airDate: string | null;
}

/** The "default" episode order — matches how TVDB expects anime/absolute-numbered shows to be browsed. */
export async function getTvdbEpisodes(tvdbId: number): Promise<TvdbEpisode[]> {
  const data = await tvdbGet<{ episodes: RawEpisode[] }>(`/series/${tvdbId}/episodes/default`);
  if (!data) return [];
  return data.episodes
    .filter((e) => e.seasonNumber > 0)
    .map((e) => ({
      seasonNumber: e.seasonNumber,
      episodeNumber: e.number,
      title: e.name ?? "",
      airDate: e.aired ?? null,
    }));
}

export interface TvdbSeason {
  seasonNumber: number;
  episodes: TvdbEpisode[];
}

/** Groups a flat episode list into TVDB's own season breakdown, in broadcast order. */
export function groupTvdbEpisodesBySeason(episodes: TvdbEpisode[]): TvdbSeason[] {
  const bySeason = new Map<number, TvdbEpisode[]>();
  for (const e of episodes) {
    const list = bySeason.get(e.seasonNumber) ?? [];
    list.push(e);
    bySeason.set(e.seasonNumber, list);
  }
  return [...bySeason.entries()]
    .sort(([a], [b]) => a - b)
    .map(([seasonNumber, eps]) => ({
      seasonNumber,
      episodes: eps.sort((a, b) => a.episodeNumber - b.episodeNumber),
    }));
}

/**
 * Resolves a series to its TVDB episode list, preferring TMDb's own tvdb_id
 * (exact) over a name+year text search (best-effort, only used as a
 * fallback since two different shows can share a title).
 */
export async function getTvdbEpisodesFor(tvdbId: number | null, title: string, year: number | null): Promise<TvdbEpisode[]> {
  if (tvdbId) {
    const byId = await getTvdbEpisodes(tvdbId);
    if (byId.length > 0) return byId;
  }
  const candidates = await searchTvdbSeries(title);
  if (candidates.length === 0) return [];
  const best = candidates.find((c) => c.year === year) ?? candidates[0];
  return getTvdbEpisodes(best.tvdbId);
}

interface RawSearchResult {
  tvdb_id?: string | number;
  name: string;
  year?: string;
}

interface RawEpisode {
  seasonNumber: number;
  number: number;
  name?: string | null;
  aired?: string | null;
}
