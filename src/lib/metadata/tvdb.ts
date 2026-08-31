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

/** Global opt-out for special-episode (season 0) tracking — see tvdbStore.ts. */
export function specialsEnabled(): boolean {
  return loadTvdbConfig().specialsEnabled;
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
  const lang = loadTvdbConfig().language || "fr";
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json", "accept-language": lang },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.data ?? null) as T;
  } catch {
    return null;
  }
}

/**
 * TVDB v4's episode-translation endpoint takes the language as a URL PATH
 * segment (3-letter ISO 639-2/B code), not the Accept-Language header —
 * the header is accepted by the API but silently ignored for this specific
 * endpoint, so /episodes/default always returned the show's original
 * (often Japanese, for anime) episode names no matter what was requested.
 * This is exactly the "you already fixed this and broke it again" bug:
 * the previous fix only set the header, which never actually worked here.
 */
const TVDB_LANG_CODES: Record<string, string> = {
  fr: "fra", en: "eng", it: "ita", nl: "nld", de: "deu", ja: "jpn", es: "spa", pt: "por",
};
function tvdbLangCode(iso6391: string): string {
  return TVDB_LANG_CODES[iso6391] ?? "eng";
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

function rawEpisodesToTvdbEpisodes(raw: RawEpisode[] | undefined): TvdbEpisode[] {
  return (raw ?? [])
    .map((e) => ({
      seasonNumber: e.seasonNumber,
      episodeNumber: e.number,
      title: e.name ?? "",
      airDate: e.aired ?? null,
    }));
}

/**
 * The "default" episode order — matches how TVDB expects anime/absolute-
 * numbered shows to be browsed. Requests the URL-path-localized endpoint
 * (see tvdbLangCode's comment for why the header alone doesn't work), with
 * two fallbacks: per-episode gaps (TVDB's translation coverage is often
 * partial — some episodes translated, others not) are filled in from the
 * original-language list, and if the localized endpoint fails outright
 * (unsupported language, 404), the whole thing falls back to the original.
 */
export async function getTvdbEpisodes(tvdbId: number, langOverride?: string): Promise<TvdbEpisode[]> {
  const code = tvdbLangCode(langOverride ?? loadTvdbConfig().language ?? "fr");
  const localized = await tvdbGet<{ episodes: RawEpisode[] }>(`/series/${tvdbId}/episodes/default/${code}`);

  if (localized?.episodes?.length) {
    const episodes = rawEpisodesToTvdbEpisodes(localized.episodes);
    if (episodes.every((e) => e.title)) return episodes;
    const original = await tvdbGet<{ episodes: RawEpisode[] }>(`/series/${tvdbId}/episodes/default`);
    const originalByKey = new Map(
      rawEpisodesToTvdbEpisodes(original?.episodes).map((e) => [`${e.seasonNumber}x${e.episodeNumber}`, e.title])
    );
    return episodes.map((e) => (e.title ? e : { ...e, title: originalByKey.get(`${e.seasonNumber}x${e.episodeNumber}`) ?? e.title }));
  }

  const data = await tvdbGet<{ episodes: RawEpisode[] }>(`/series/${tvdbId}/episodes/default`);
  return rawEpisodesToTvdbEpisodes(data?.episodes);
}

interface RawSeason {
  id: number;
  number: number;
  name?: string | null;
  type?: { type?: string };
}

interface RawSeasonTranslation {
  name?: string;
}

/**
 * Real arc/saga names (e.g. "La Bataille Des Dieux" for Dragon Ball Super
 * season 1) — TMDb only curates these for some seasons of some shows
 * (inconsistent), while TVDB's "official" season list names every season.
 * Purely cosmetic: callers must keep matching downloads by season NUMBER,
 * never by this name — a torrent release is never named after the arc.
 */
export async function getTvdbSeasonNames(tvdbId: number, langOverride?: string): Promise<Map<number, string>> {
  const code = tvdbLangCode(langOverride ?? loadTvdbConfig().language ?? "fr");
  const extended = await tvdbGet<{ seasons?: RawSeason[] }>(`/series/${tvdbId}/extended`);
  // Season 0 (specials) included too — TVDB does sometimes give it a real
  // name, though most callers will just fall back to a generic "Specials"
  // label when it doesn't (see LibrarySeason construction call sites).
  const officialSeasons = (extended?.seasons ?? []).filter(
    (s) => (s.type?.type ?? "official") === "official" && s.number >= 0
  );

  const names = new Map<number, string>();
  await Promise.all(
    officialSeasons.map(async (s) => {
      const translated = await tvdbGet<RawSeasonTranslation>(`/seasons/${s.id}/translations/${code}`);
      const name = translated?.name || s.name;
      if (name) names.set(s.number, name);
    })
  );
  return names;
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
