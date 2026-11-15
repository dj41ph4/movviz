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

async function tvdbFetch(path: string): Promise<{ data?: unknown; links?: { next?: string | null } } | null> {
  const token = await getToken();
  if (!token) return null;
  const lang = loadTvdbConfig().language || "fr";
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json", "accept-language": lang },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function tvdbGet<T>(path: string): Promise<T | null> {
  const body = await tvdbFetch(path);
  return (body?.data ?? null) as T | null;
}

/** Hard stop for a runaway `links.next` chain (Pokémon, the longest anime
 *  on TVDB, needs 3 pages of 500 today). */
const MAX_EPISODE_PAGES = 20;

/**
 * TVDB v4 serves a series' episodes 500 per page and says so only through
 * `links.next`. Reading page 0 alone silently cut every long anime at
 * exactly 500 episodes (Pokémon stopped at season 8, Naruto Shippuden lost
 * its last episodes). Null when the very first page fails, so callers keep
 * their existing "endpoint failed" fallbacks.
 */
async function tvdbGetAllEpisodes(path: string): Promise<RawEpisode[] | null> {
  const all: RawEpisode[] = [];
  for (let page = 0; page < MAX_EPISODE_PAGES; page++) {
    const body = await tvdbFetch(`${path}?page=${page}`);
    if (!body) return page === 0 ? null : all;
    const episodes = (body.data as { episodes?: RawEpisode[] } | undefined)?.episodes ?? [];
    all.push(...episodes);
    if (!body.links?.next || episodes.length === 0) break;
  }
  return all;
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
  const localized = await tvdbGetAllEpisodes(`/series/${tvdbId}/episodes/default/${code}`);

  if (localized?.length) {
    const episodes = rawEpisodesToTvdbEpisodes(localized);
    if (episodes.every((e) => e.title)) return episodes;
    const original = await tvdbGetAllEpisodes(`/series/${tvdbId}/episodes/default`);
    const originalByKey = new Map(
      rawEpisodesToTvdbEpisodes(original ?? undefined).map((e) => [`${e.seasonNumber}x${e.episodeNumber}`, e.title])
    );
    return episodes.map((e) => (e.title ? e : { ...e, title: originalByKey.get(`${e.seasonNumber}x${e.episodeNumber}`) ?? e.title }));
  }

  const data = await tvdbGetAllEpisodes(`/series/${tvdbId}/episodes/default`);
  return rawEpisodesToTvdbEpisodes(data ?? undefined);
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

function normalizeSeriesName(name: string): string {
  return name.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/** At least half of the shorter name's words appear in the other one. */
function namesOverlap(a: string, b: string): boolean {
  const wa = a.split(" ").filter(Boolean), wb = new Set(b.split(" ").filter(Boolean));
  if (wa.length === 0 || wb.size === 0) return false;
  const shared = wa.filter((w) => wb.has(w)).length;
  return shared / Math.min(wa.length, wb.size) >= 0.5;
}

/**
 * A name search is only trusted when the candidate provably IS the show:
 * same first-air year (±1, TVDB and TMDb disagree on premieres straddling
 * New Year) or, without a known year, the exact same name. Taking the first
 * hit blindly gave « Saint Seiya - The Lost Canvas » (2009) the 1986 Saint
 * Seiya franchise entry — 12 seasons, 291 episodes — and the 2025 New Panty
 * & Stocking the 2010 series. No trustworthy candidate → null, so the
 * caller keeps TMDb instead of importing another show's structure.
 */
export function pickTvdbSearchMatch(candidates: TvdbSearchResult[], title: string, year: number | null): TvdbSearchResult | null {
  const wanted = normalizeSeriesName(title);
  const sameName = (c: TvdbSearchResult) => normalizeSeriesName(c.name) === wanted;
  if (year == null) return candidates.find(sameName) ?? null;
  // Same era is not enough on its own: a search also returns unrelated
  // shows of that year, so the name must still mostly agree.
  const close = candidates.filter((c) => c.year != null && Math.abs(c.year - year) <= 1 && namesOverlap(normalizeSeriesName(c.name), wanted));
  return close.find((c) => c.year === year && sameName(c))
    ?? close.find(sameName)
    ?? close.find((c) => c.year === year)
    ?? close[0]
    ?? null;
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
  const best = pickTvdbSearchMatch(await searchTvdbSeries(title), title, year);
  return best ? getTvdbEpisodes(best.tvdbId) : [];
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
