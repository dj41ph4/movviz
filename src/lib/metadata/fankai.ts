import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import { fanReleaseName, normalizeTitle } from "@/lib/library/matching";
import {
  fankaiBaseTitle, fankaiDisplayTitle, fankaiIdFor, hasFanMarker, isFankaiId, parseFankaiPage, parseFankaiReleaseName, parseRedirect,
  type FankaiFiche, type FankaiPart,
} from "./fankaiWikitext";
import type { MetaEpisode, MetaSearchResult, MetaSeason, MetaSeries } from "./types";

/**
 * Fan-Kai — last-resort metadata for fan versions of anime (montages without
 * filler: « Kaï », « Henshū », « Yabai », « FAN-CUT »), read from the
 * community wiki fan-kai.fandom.com/fr. TMDb and TVDB do not list re-cuts, so
 * without it a fan version has no title, synopsis, poster or part list.
 *
 * Each fan version is presented to the whole app as a TMDb-like series with a
 * synthetic id (fankaiIdFor, a range TMDb never reaches): tmdb.ts answers
 * those ids from here, so search, the fiche, the library, episode sync, the
 * indexer search and the native clients need no code of their own. Season 1
 * holds the parts, numbered as the Fan-Kai files are (« … Kaï - 01 - … »).
 *
 * The wiki changes rarely: the whole catalogue (≈100 versions) is rebuilt in
 * about ten requests at most once a week, in the background, and kept on
 * disk. No request ever waits for the wiki once the catalogue exists.
 */

const CONFIG_DIR = process.env.MOVVIZ_CONFIG_DIR ?? process.env.MOVVIZ_DATA_DIR ?? path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "fankai-catalog.json");
const API = "https://fan-kai.fandom.com/fr/api.php";
const WIKI = "https://fan-kai.fandom.com/fr/wiki/";
const ANIME_LISTS = "https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-full.json";
/** Fan-Kai's own metadata pack (the one its wiki links for Plex/Emby): a folder per version with logo.png. */
const PACK_TREE = "https://gitlab.com/api/v4/projects/51750670/repository/tree";
const PACK_RAW = "https://gitlab.com/ElPouki/fankai_pack/-/raw/main/";
const REFRESH_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
/** After a failed rebuild, wait before asking the wiki again. */
const RETRY_AFTER_MS = 6 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 20_000;
const CATALOG_VERSION = 1;
/** Fandom refuses (403) an image asked without its wiki as Referer (hotlink protection), and an anonymous client. */
export const FANKAI_FETCH_HEADERS = { "User-Agent": "Movviz (metadata)", Referer: "https://fan-kai.fandom.com/" };

export interface FankaiImage {
  file: string;
  url: string;
  uploadedAt: string | null;
  /** A title logo from the Fan-Kai pack (served lightened when drawn in black). */
  kind?: "logo";
}

export interface FankaiEntry {
  id: number;
  page: string;
  title: string;
  baseTitle: string;
  /** Other wiki names of this version (redirections): « Death Note Kaï » → « Death Note Kai ». */
  aliases: string[];
  fiche: FankaiFiche;
  synopsis: string;
  parts: FankaiPart[];
  /** The TMDb series this version is cut from, via its MyAnimeList id. */
  parentTmdbId: number | null;
  /** Image key of its title logo in the Fan-Kai pack, when the pack has one. */
  logoKey?: string | null;
}

interface FankaiCatalog {
  version: number;
  fetchedAt: number;
  entries: FankaiEntry[];
  /** Image key (`fankai-<hash>.<ext>`) → wiki file. */
  images: Record<string, FankaiImage>;
  /** When the Fan-Kai pack (logos) was last read; absent in catalogues built before it was. */
  packAt?: number;
}

const EMPTY: FankaiCatalog = { version: CATALOG_VERSION, fetchedAt: 0, entries: [], images: {} };

const g = globalThis as typeof globalThis & {
  __movvizFankaiRefresh?: Promise<boolean> | null;
  __movvizFankaiLastFailure?: number;
  __movvizFankaiIndex?: { fetchedAt: number; byId: Map<number, FankaiEntry>; byParent: Map<number, FankaiEntry[]>; byName: Map<string, FankaiEntry> };
};

function loadCatalog(): FankaiCatalog {
  const catalog = readJsonCached<FankaiCatalog>(FILE, EMPTY);
  return catalog.version === CATALOG_VERSION ? catalog : EMPTY;
}

function index() {
  const catalog = loadCatalog();
  if (g.__movvizFankaiIndex?.fetchedAt === catalog.fetchedAt) return g.__movvizFankaiIndex;
  const byId = new Map<number, FankaiEntry>();
  const byParent = new Map<number, FankaiEntry[]>();
  const byName = new Map<string, FankaiEntry>();
  for (const entry of catalog.entries) {
    byId.set(entry.id, entry);
    if (entry.parentTmdbId != null) byParent.set(entry.parentTmdbId, [...(byParent.get(entry.parentTmdbId) ?? []), entry]);
    for (const name of [entry.title, entry.page, ...entry.aliases]) {
      const key = normalizeTitle(name.replace(/\s*\([^)]*\)\s*$/, ""));
      // Two versions can share a name once the kaieur is dropped (« Death
      // Note Kaï » and « Death Note Kaï (Roro) »): the page named exactly so wins.
      if (key && (!byName.has(key) || normalizeTitle(entry.page) === key)) byName.set(key, entry);
    }
  }
  g.__movvizFankaiIndex = { fetchedAt: catalog.fetchedAt, byId, byParent, byName };
  return g.__movvizFankaiIndex;
}

/** Starts a background rebuild when the catalogue is missing, a week old, or has never read the pack's logos. */
function refreshIfStale(): void {
  const catalog = loadCatalog();
  if (Date.now() - catalog.fetchedAt < REFRESH_AFTER_MS && (catalog.packAt || catalog.fetchedAt === 0)) return;
  if (Date.now() - (g.__movvizFankaiLastFailure ?? 0) < RETRY_AFTER_MS) return;
  void refreshFankaiCatalog();
}

/** The catalogue, waiting for its first build only (a fiche opened before any). */
async function catalogReady(): Promise<void> {
  if (loadCatalog().fetchedAt > 0) { refreshIfStale(); return; }
  if (Date.now() - (g.__movvizFankaiLastFailure ?? 0) < RETRY_AFTER_MS) return;
  await refreshFankaiCatalog();
}

export { isFankaiId };

export async function getFankaiEntry(id: number): Promise<FankaiEntry | null> {
  if (!isFankaiId(id)) return null;
  await catalogReady();
  return index().byId.get(id) ?? null;
}

/** Instant (cache only) — for code that must never wait for the network. */
export function getCachedFankaiEntry(id: number): FankaiEntry | null {
  if (!isFankaiId(id)) return null;
  refreshIfStale();
  return index().byId.get(id) ?? null;
}

/** Fan versions cut from this TMDb series. */
export function fankaiVersionsOf(parentTmdbId: number): FankaiEntry[] {
  refreshIfStale();
  return index().byParent.get(parentTmdbId) ?? [];
}

/** The fan version a release/file title names, if the wiki knows it. */
export function findFankaiByTitle(title: string): FankaiEntry | null {
  refreshIfStale();
  const key = normalizeTitle(title.replace(/\s*\([^)]*\)\s*$/, ""));
  return key ? index().byName.get(key) ?? null : null;
}

/** The fan version a release or file name belongs to, with its part number. */
export function matchFankaiRelease(name: string): { entry: FankaiEntry; part: number | null } | null {
  const parsed = parseFankaiReleaseName(name);
  if (!parsed) return null;
  const entry = findFankaiByTitle(parsed.title);
  if (!entry) return null;
  return { entry: versionByKaieur(entry, name) ?? entry, part: parsed.part };
}

/**
 * Two versions can share a name (« Death Note Kaï » by Odji-san, « Death
 * Note Kaï (Roro) »): the kaieur's tag in the release name — « [Roro] » at
 * the end, « [Odji-san] » at the start — tells which one it is. Without a
 * tag naming a version of that name, the name's own entry stays.
 */
function versionByKaieur(entry: FankaiEntry, name: string): FankaiEntry | null {
  const tags = [...name.matchAll(/\[([^\]]+)\]/g)].map((m) => normalizeTitle(m[1])).filter(Boolean);
  if (tags.length === 0) return null;
  const base = normalizeTitle(fanReleaseName(entry.title));
  for (const other of index().byId.values()) {
    if (normalizeTitle(fanReleaseName(other.title)) !== base) continue;
    const kaieur = normalizeTitle(other.title.match(/\(([^)]*)\)\s*$/)?.[1] ?? other.fiche.kaieur ?? "");
    if (kaieur && tags.includes(kaieur)) return other;
  }
  return null;
}

/**
 * The bare name a Fan-Kai version is released under, when this search text
 * names one the wiki knows: « Naruto Yabai (Triggerforce) S01 » → « Naruto
 * Yabai ». Releases carry neither the kaieur nor a season code. Null otherwise.
 */
export function fankaiSearchName(text: string): string | null {
  const title = text.replace(/\s+S\d{1,2}(?:E\d{1,3})?\s*$/i, "").trim();
  if (!hasFanMarker(title) || !findFankaiByTitle(title)) return null;
  return fanReleaseName(title) || null;
}

/** Search: every word of the query in the version's title or the series it comes from. */
export function searchFankai(query: string, limit = 8): FankaiEntry[] {
  refreshIfStale();
  const words = normalizeTitle(query).split(" ").filter((w) => w.length > 1);
  if (words.length === 0) return [];
  const scored: { entry: FankaiEntry; score: number }[] = [];
  for (const entry of index().byId.values()) {
    const hay = ` ${normalizeTitle(`${entry.title} ${entry.aliases.join(" ")} ${entry.fiche.kind ?? ""} fan kai`)} `;
    if (!words.every((w) => hay.includes(` ${w}`))) continue;
    const exact = normalizeTitle(entry.title) === normalizeTitle(query) ? 0 : 1;
    scored.push({ entry, score: exact * 100 + entry.title.length });
  }
  return scored.sort((a, b) => a.score - b.score).slice(0, limit).map((s) => s.entry);
}

// ---------- Images ----------

function imageKey(file: string): string | null {
  const ext = file.match(/\.(png|jpe?g|webp)$/i)?.[1]?.toLowerCase();
  if (!ext) return null;
  const name = file.replace(/_/g, " ").trim().toLowerCase();
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < name.length; i++) {
    a = Math.imul(a ^ name.charCodeAt(i), 0x01000193) >>> 0;
    b = Math.imul(b ^ name.charCodeAt(i), 0x5bd1e995) >>> 0;
  }
  return `fankai-${a.toString(16).padStart(8, "0")}${b.toString(16).padStart(8, "0")}.${ext === "jpeg" ? "jpg" : ext}`;
}

/** posterPath-style path (`/fankai-….png`) served by the /tmdb image route. */
function imagePath(file: string | null): string | null {
  if (!file) return null;
  const key = imageKey(file);
  return key && loadCatalog().images[key] ? `/${key}` : null;
}

/** Title logo of a fan version (Fan-Kai pack), as a `/fankai-….png` path. */
export function fankaiLogoPath(entry: FankaiEntry): string | null {
  return entry.logoKey && loadCatalog().images[entry.logoKey] ? `/${entry.logoKey}` : null;
}

/** True for a Fan-Kai pack logo — the only images the image cache may lighten. */
export function isFankaiLogo(filename: string): boolean {
  return loadCatalog().images[filename]?.kind === "logo";
}

export function isFankaiImage(filename: string): boolean {
  return /^fankai-[0-9a-f]{16}\.(?:png|jpg|webp)$/.test(filename);
}

/** Source URL of a Fan-Kai image at about the asked width (Fandom scales on its side). */
export function fankaiImageSource(filename: string, width: number | null): string | null {
  const image = loadCatalog().images[filename];
  if (!image) return null;
  if (!width) return image.url;
  // https://static.wikia.nocookie.net/<wiki>/images/a/ab/X.png/revision/latest?cb=…
  return image.url.replace(/\/revision\/latest(?=\?|$)/, `/revision/latest/scale-to-width-down/${width}`);
}

// ---------- Mapping to Movviz metadata ----------

function partDate(entry: FankaiEntry, part: FankaiPart, fetchedAt: number): string | null {
  if (!part.released) return null;
  const images = loadCatalog().images;
  const key = part.posterFile ? imageKey(part.posterFile) : null;
  const ficheKey = entry.fiche.posterFile ? imageKey(entry.fiche.posterFile) : null;
  // The wiki gives no release date: the day the part's poster was uploaded is
  // the closest one, then the version's own poster. A part marked as out
  // always gets a date, so it is never mistaken for an unaired episode.
  const date = (key && images[key]?.uploadedAt) || (ficheKey && images[ficheKey]?.uploadedAt) || new Date(fetchedAt || Date.now()).toISOString();
  return date.slice(0, 10);
}

function partOverview(part: FankaiPart): string {
  const facts = [part.episodes ? `Épisodes ${part.episodes}` : null, part.chapters ? `chapitres ${part.chapters}` : null].filter(Boolean).join(" · ");
  return [part.synopsis, facts ? `(${facts})` : ""].filter(Boolean).join(" ");
}

export function fankaiEpisodes(entry: FankaiEntry): MetaEpisode[] {
  const fetchedAt = loadCatalog().fetchedAt;
  return entry.parts.map((part) => ({
    seasonNumber: 1,
    episodeNumber: part.number,
    title: part.title || `Film ${part.number}`,
    airDate: partDate(entry, part, fetchedAt),
    overview: partOverview(part),
    stillPath: imagePath(part.posterFile),
    runtime: part.runtime,
    rating: 0,
  }));
}

export function fankaiSeason(entry: FankaiEntry): MetaSeason {
  const episodes = fankaiEpisodes(entry);
  return {
    seasonNumber: 1,
    name: entry.fiche.kind && /yabai|hensh|kai|ka[iï]/i.test(entry.fiche.kind) ? "Films" : "Parties",
    overview: entry.synopsis,
    episodeCount: episodes.length,
    airDate: episodes.find((e) => e.airDate)?.airDate ?? null,
    posterPath: imagePath(entry.fiche.posterFile),
    episodes,
  };
}

function firstYear(entry: FankaiEntry): number | null {
  const date = fankaiEpisodes(entry).find((e) => e.airDate)?.airDate;
  return date ? Number(date.slice(0, 4)) : null;
}

export function fankaiStatus(entry: FankaiEntry): string {
  return /termin/i.test(entry.fiche.status ?? "") ? "Ended" : "Returning Series";
}

/** Series metadata without the parent's TMDb data (tmdb.ts adds the backdrop and genres). */
export function fankaiSeries(entry: FankaiEntry): MetaSeries {
  const season = fankaiSeason(entry);
  return {
    tmdbId: entry.id,
    imdbId: null,
    tvdbId: null,
    title: entry.title,
    year: firstYear(entry),
    releaseDate: season.airDate,
    overview: entry.synopsis,
    posterPath: imagePath(entry.fiche.posterFile),
    backdropPath: null,
    rating: 0,
    genres: [],
    status: fankaiStatus(entry),
    // Never true: an anime goes through TVDB on addition and resync, which
    // only knows the original series and would renumber the parts.
    isAnime: false,
    seasons: [{ ...season, episodes: [] }],
    originalTitle: entry.title,
  };
}

export function fankaiSearchResult(entry: FankaiEntry): MetaSearchResult {
  const series = fankaiSeries(entry);
  return {
    tmdbId: entry.id,
    type: "series",
    title: entry.title,
    year: series.year,
    releaseDate: series.releaseDate,
    overview: entry.synopsis,
    posterPath: series.posterPath,
    backdropPath: null,
    rating: 0,
    originalLanguage: "ja",
    originalTitle: entry.title,
  };
}

/** One line under the title: « Kaï · Odji-san · 6 films · 1080p ». */
export function fankaiTagline(entry: FankaiEntry): string {
  const count = entry.parts.length;
  return ["Version fan Fan-Kai", entry.fiche.kind, entry.fiche.kaieur ? `par ${entry.fiche.kaieur}` : null, count ? `${count} film${count > 1 ? "s" : ""}` : null]
    .filter(Boolean).join(" · ");
}

export function fankaiWikiUrl(entry: FankaiEntry): string {
  return WIKI + encodeURIComponent(entry.page.replace(/ /g, "_"));
}

// ---------- Rebuild ----------

async function getJson<T>(url: URL | string): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), headers: FANKAI_FETCH_HEADERS, cache: "no-store" });
  if (!response.ok) throw new Error(`fankai_http_${response.status}`);
  return (await response.json()) as T;
}

function apiUrl(params: Record<string, string>): URL {
  const url = new URL(API);
  for (const [key, value] of Object.entries({ format: "json", formatversion: "2", ...params })) url.searchParams.set(key, value);
  return url;
}

async function allPageTitles(): Promise<string[]> {
  const titles: string[] = [];
  let next: string | undefined;
  for (let guard = 0; guard < 20; guard++) {
    const data = await getJson<{ query?: { allpages?: { title: string }[] }; continue?: { apcontinue?: string } }>(
      apiUrl({ action: "query", list: "allpages", aplimit: "500", ...(next ? { apcontinue: next } : {}) }));
    titles.push(...(data.query?.allpages ?? []).map((p) => p.title));
    next = data.continue?.apcontinue;
    if (!next) break;
  }
  return titles;
}

async function pageContents(titles: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < titles.length; i += 50) {
    const data = await getJson<{ query?: { pages?: { title: string; revisions?: { slots?: { main?: { content?: string } } }[] }[] } }>(
      apiUrl({ action: "query", prop: "revisions", rvprop: "content", rvslots: "main", titles: titles.slice(i, i + 50).join("|") }));
    for (const page of data.query?.pages ?? []) {
      const content = page.revisions?.[0]?.slots?.main?.content;
      if (content) out.set(page.title, content);
    }
  }
  return out;
}

async function imageInfos(files: string[]): Promise<Record<string, FankaiImage>> {
  const out: Record<string, FankaiImage> = {};
  const unique = [...new Set(files)];
  for (let i = 0; i < unique.length; i += 50) {
    const batch = unique.slice(i, i + 50);
    const data = await getJson<{ query?: { normalized?: { from: string; to: string }[]; pages?: { title: string; imageinfo?: { url?: string; timestamp?: string }[] }[] } }>(
      apiUrl({ action: "query", prop: "imageinfo", iiprop: "url|timestamp", titles: batch.map((f) => `Fichier:${f}`).join("|") }));
    const original = new Map<string, string>();
    for (const file of batch) original.set(`Fichier:${file}`, file);
    for (const n of data.query?.normalized ?? []) { const file = original.get(n.from); if (file) original.set(n.to, file); }
    for (const page of data.query?.pages ?? []) {
      const info = page.imageinfo?.[0];
      const file = original.get(page.title) ?? page.title.replace(/^(?:Fichier|File):/, "");
      const key = imageKey(file);
      if (info?.url && key) out[key] = { file, url: info.url, uploadedAt: info.timestamp ?? null };
    }
  }
  return out;
}

/** MyAnimeList id → TMDb series id, from the public Fribb/anime-lists mapping. */
async function malToTmdb(malIds: number[]): Promise<Map<number, number>> {
  const wanted = new Set(malIds);
  const out = new Map<number, number>();
  if (wanted.size === 0) return out;
  const list = await getJson<{ mal_id?: number; themoviedb_id?: number | { tv?: number } }[]>(ANIME_LISTS);
  for (const item of list) {
    if (item.mal_id == null || !wanted.has(item.mal_id) || out.has(item.mal_id)) continue;
    const tv = typeof item.themoviedb_id === "object" ? item.themoviedb_id?.tv : undefined;
    if (tv) out.set(item.mal_id, tv);
  }
  return out;
}

/**
 * The pack's version folders (« Death Note Kaï », « Hunter x Hunter Kaï
 * (2011) »), each with a logo.png. One API request a week: GitLab's API
 * rate-limits anonymous clients hard (a recursive listing, ≈45 pages, got
 * this address refused for 45 minutes). A folder without logo.png is caught
 * when its logo is first downloaded (see fankaiLogoPath's callers).
 */
async function packFolders(): Promise<string[]> {
  const url = new URL(PACK_TREE);
  url.searchParams.set("path", "pack");
  url.searchParams.set("per_page", "100");
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), headers: { "User-Agent": FANKAI_FETCH_HEADERS["User-Agent"] }, cache: "no-store" });
  if (!response.ok) throw new Error(`fankai_pack_http_${response.status}`);
  const items = (await response.json()) as { name: string; type: string }[];
  return items.filter((item) => item.type === "tree").map((item) => item.name);
}

/** The version a pack folder is for: its exact name first, else the version named so without its kaieur. */
export function entryForPackFolder(folder: string, entries: FankaiEntry[]): { entry: FankaiEntry; exact: boolean } | null {
  const names = (e: FankaiEntry) => [e.title, e.page, ...e.aliases];
  const exact = normalizeTitle(folder);
  const byExact = entries.find((e) => names(e).some((n) => normalizeTitle(n) === exact));
  if (byExact) return { entry: byExact, exact: true };
  // Same words in another order: « Hunter x Hunter Kaï (1999) » / « Hunter x Hunter (1999) Kaï ».
  const words = (s: string) => normalizeTitle(s).split(" ").filter(Boolean).sort().join(" ");
  const wordKey = words(folder);
  const byWords = entries.find((e) => names(e).some((n) => words(n) === wordKey));
  if (byWords) return { entry: byWords, exact: true };
  const bare = normalizeTitle(fanReleaseName(folder));
  const same = entries.filter((e) => names(e).some((n) => normalizeTitle(fanReleaseName(n)) === bare));
  const entry = same.find((e) => normalizeTitle(e.page) === bare) ?? (same.length === 1 ? same[0] : null);
  return entry ? { entry, exact: false } : null;
}

/** Registers each pack logo on its version. False when the pack could not be read (logos kept from before). */
async function attachPackLogos(entries: FankaiEntry[], images: Record<string, FankaiImage>, previous: FankaiCatalog): Promise<boolean> {
  let folders: string[];
  try {
    folders = await packFolders();
  } catch (error) {
    console.warn("[fankai] logos du pack non lus :", error instanceof Error ? error.message : error);
    // Keep the logos the previous catalogue knew rather than dropping them.
    const before = new Map(previous.entries.map((e) => [e.id, e.logoKey]));
    for (const entry of entries) {
      const key = before.get(entry.id);
      if (key && previous.images[key]) { entry.logoKey = key; images[key] = previous.images[key]; }
    }
    return false;
  }
  const attach = (folder: string, entry: FankaiEntry) => {
    const file = `fankai-pack/${folder}/logo.png`;
    const key = imageKey(file);
    if (!key || entry.logoKey) return false;
    entry.logoKey = key;
    images[key] = { file, url: `${PACK_RAW}pack/${encodeURIComponent(folder)}/logo.png`, uploadedAt: null, kind: "logo" };
    return true;
  };
  const matches = folders.map((folder) => ({ folder, match: entryForPackFolder(folder, entries) }));
  // Exact names first: « GTO Kai (Autres langues) » must not take the logo of « GTO Kaï ».
  for (const { folder, match } of matches) if (match?.exact) attach(folder, match.entry);
  for (const { folder, match } of matches) if (match && !match.exact) attach(folder, match.entry);
  // Last resort, the series it is cut from: « Shingeki no Kyojin Henshū » is the
  // wiki's « L'attaque des Titans Henshū ». Only when that series has a single
  // version still without a logo.
  const { searchTv } = await import("./tmdb");
  for (const { folder, match } of matches) {
    if (match) continue;
    const base = fankaiBaseTitle(folder);
    const results = (await searchTv(base).catch(() => null))?.results.filter((r) => !isFankaiId(r.tmdbId)) ?? [];
    const named = results.find((r) => normalizeTitle(r.title) === normalizeTitle(base) || normalizeTitle(r.originalTitle ?? "") === normalizeTitle(base));
    // TMDb answers in French (« L'Attaque des Titans »): its first result is
    // accepted only for a version carrying the folder's own marker (Henshū).
    const hit = named ?? results[0];
    const marker = normalizeTitle(folder).split(" ").pop();
    const candidates = hit ? entries.filter((e) => e.parentTmdbId === hit.tmdbId && !e.logoKey && (named || normalizeTitle(e.title).split(" ").pop() === marker)) : [];
    if (candidates.length === 1) attach(folder, candidates[0]);
  }
  return true;
}

async function buildCatalog(): Promise<FankaiCatalog> {
  const titles = await allPageTitles();
  const contents = await pageContents(titles);
  const redirects = new Map<string, string>();
  for (const [title, text] of contents) {
    const target = parseRedirect(text);
    if (target) redirects.set(title, target);
  }
  const entries: FankaiEntry[] = [];
  for (const [title, text] of contents) {
    if (redirects.has(title)) continue;
    const page = parseFankaiPage(text);
    if (!page || page.parts.length === 0) continue;
    const aliases = [...redirects].filter(([, target]) => target === title).map(([from]) => from);
    entries.push({
      id: fankaiIdFor(title),
      page: title,
      title: fankaiDisplayTitle(title),
      baseTitle: fankaiBaseTitle(title),
      aliases,
      fiche: page.fiche,
      synopsis: page.synopsis,
      parts: page.parts,
      parentTmdbId: null,
    });
  }
  const images = await imageInfos(entries.flatMap((e) => [e.fiche.posterFile, ...e.parts.map((p) => p.posterFile)]).filter((f): f is string => !!f));
  const mapping = await malToTmdb(entries.map((e) => e.fiche.malId).filter((id): id is number => id != null)).catch(() => new Map<number, number>());
  const { searchTv } = await import("./tmdb");
  for (const entry of entries) {
    entry.parentTmdbId = entry.fiche.malId != null ? mapping.get(entry.fiche.malId) ?? null : null;
    if (entry.parentTmdbId == null) {
      // No MyAnimeList link (or not in the mapping): the series of the same name on TMDb.
      const hit = (await searchTv(entry.baseTitle).catch(() => null))?.results.find((r) => !isFankaiId(r.tmdbId) && (normalizeTitle(r.title) === normalizeTitle(entry.baseTitle) || normalizeTitle(r.originalTitle ?? "") === normalizeTitle(entry.baseTitle)));
      entry.parentTmdbId = hit?.tmdbId ?? null;
    }
  }
  const packRead = await attachPackLogos(entries, images, loadCatalog());
  return { version: CATALOG_VERSION, fetchedAt: Date.now(), entries, images, ...(packRead ? { packAt: Date.now() } : {}) };
}

/** Rebuilds the catalogue from the wiki (single flight). False when the wiki could not be read. */
export function refreshFankaiCatalog(): Promise<boolean> {
  if (g.__movvizFankaiRefresh) return g.__movvizFankaiRefresh;
  const run = (async () => {
    try {
      const catalog = await buildCatalog();
      if (catalog.entries.length === 0) throw new Error("fankai_empty_catalog");
      writeJsonCached(FILE, catalog);
      // Pack unreadable: the catalogue is fresh, but ask GitLab again only after the retry delay.
      if (!catalog.packAt) g.__movvizFankaiLastFailure = Date.now();
      return true;
    } catch (error) {
      g.__movvizFankaiLastFailure = Date.now();
      console.warn("[fankai] catalogue non reconstruit :", error instanceof Error ? error.message : error);
      return false;
    } finally {
      g.__movvizFankaiRefresh = null;
    }
  })();
  g.__movvizFankaiRefresh = run;
  return run;
}

export function fankaiCatalogInfo(): { fetchedAt: number; versions: number } {
  const catalog = loadCatalog();
  return { fetchedAt: catalog.fetchedAt, versions: catalog.entries.length };
}
