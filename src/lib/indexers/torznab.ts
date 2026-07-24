import type { ConfiguredIndexer, IndexerRelease, IndexerCapabilities } from "./types";
import type { CategoryNode } from "./categories";
import { loadCustomFormats } from "@/lib/customFormats/store";
import { loadReleaseRules, matchesBlockedWord, normalizeCodec, type ReleaseRules } from "@/lib/library/releaseRules";
import { loadResolverConfig } from "@/lib/resolver/store";
import { titleSimilarity } from "@/lib/library/matching";
import { parseRelease } from "@/lib/naming/parser";
import { markRateLimited } from "./rateLimit";

/**
 * Torznab / Newznab client. These share one query protocol (an RSS/XML API),
 * so a single implementation drives both torrent and usenet indexers. Parsed
 * with a small targeted extractor — no XML dependency.
 *
 * Beyond the generic free-text `t=search`, the protocol defines precise
 * search modes — `t=movie` (imdbid/tmdbid) and `t=tvsearch`
 * (tvdbid/tmdbid/imdbid + season/ep) — that return far more accurate results
 * than a text query, but only when the indexer actually declares support for
 * them in its `t=caps` response. searchMovie()/searchTv() below check the
 * indexer's cached capabilities and use the best mode available, falling
 * back to plain text search otherwise.
 */

function buildUrl(ix: ConfiguredIndexer, params: Record<string, string>) {
  const url = new URL(ix.baseUrl);
  if (ix.authType === "apikey" && ix.apiKey) {
    url.searchParams.set("apikey", ix.apiKey);
  }
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

/** Basic Auth header for indexer instances protected by a login/password. */
function authHeaders(ix: ConfiguredIndexer): Record<string, string> {
  if (ix.authType === "credentials" && ix.username) {
    const token = Buffer.from(`${ix.username}:${ix.password}`).toString("base64");
    return { authorization: `Basic ${token}` };
  }
  if (ix.authType === "x-api-key" && ix.apiKey) {
    return { "X-Api-Key": ix.apiKey };
  }
  return {};
}

const cookieCache = new Map<string, { cookies: string; expiresAt: number }>();

async function resolveCookies(ix: ConfiguredIndexer): Promise<string | null> {
  const cached = cookieCache.get(ix.id);
  if (cached && Date.now() < cached.expiresAt) return cached.cookies;

  const config = loadResolverConfig();
  if (!config.url) return null;

  try {
    const res = await fetch(`${config.url}/v1`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: ix.baseUrl, maxTimeout: 60, returnOnlyCookies: true, blockMedia: true }),
      signal: AbortSignal.timeout(90000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== "ok") return null;

    const cookieHeader = data.solution.cookies
      .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
      .join("; ");

    cookieCache.set(ix.id, { cookies: cookieHeader, expiresAt: Date.now() + 600000 });
    return cookieHeader;
  } catch {
    return null;
  }
}

async function fetchXml(url: string, ix: ConfiguredIndexer, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = { ...authHeaders(ix) };
    if (ix.useFlareResolver) {
      const cookies = await resolveCookies(ix);
      if (cookies) headers.cookie = cookies;
    }
    const res = await fetch(url, {
      signal: ctrl.signal,
      cache: "no-store",
      headers,
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } finally {
    clearTimeout(timer);
  }
}

/** Pull `available="yes"` and `supportedParams="a,b,c"` off a self-closing `<tag .../>` in the caps XML. */
function searchMode(xml: string, tag: string): { available: boolean; params: string[] } {
  const block = xml.match(new RegExp(`<${tag}\\b[^>]*/?>`, "i"))?.[0];
  if (!block) return { available: false, params: [] };
  const available = /available="yes"/i.test(block);
  const params = block.match(/supportedParams="([^"]*)"/i)?.[1]?.split(",") ?? [];
  return { available, params };
}

/**
 * Torznab caps advertise the indexer's OWN category tree — real ids/names it
 * actually uses, which only usually line up with the standard numbering
 * (a private tracker can call 2045 "4K Movies" instead of "UHD", or use
 * entirely custom ids outside the standard ranges). Parsed here so the
 * category picker can show what THIS indexer really offers instead of
 * always presenting the same generic list to every indexer (see categories.ts).
 */
function parseCategories(xml: string): CategoryNode[] {
  const block = xml.match(/<categories>[\s\S]*?<\/categories>/i)?.[0];
  if (!block) return [];
  const nodes: CategoryNode[] = [];
  const catBlockRe = /<category\b[^>]*?(?:\/>|>[\s\S]*?<\/category>)/gi;
  let m: RegExpExecArray | null;
  while ((m = catBlockRe.exec(block))) {
    const catStr = m[0];
    const id = Number(catStr.match(/\bid="(\d+)"/i)?.[1]);
    const name = catStr.match(/\bname="([^"]*)"/i)?.[1];
    if (!id || !name) continue;
    const children: { id: number; name: string }[] = [];
    const subcatRe = /<subcat\b[^>]*\/?>/gi;
    let sm: RegExpExecArray | null;
    while ((sm = subcatRe.exec(catStr))) {
      const sid = Number(sm[0].match(/\bid="(\d+)"/i)?.[1]);
      const sname = sm[0].match(/\bname="([^"]*)"/i)?.[1];
      if (sid && sname) children.push({ id: sid, name: decodeXmlEntities(sname) });
    }
    nodes.push({ id, name: decodeXmlEntities(name), children: children.length ? children : undefined });
  }
  return nodes;
}

export function parseCapabilities(xml: string): IndexerCapabilities {
  const search = searchMode(xml, "search");
  const movie = searchMode(xml, "movie-search");
  const tv = searchMode(xml, "tv-search");
  return {
    search: search.available,
    movieSearch: movie.available,
    movieSearchImdb: movie.available && movie.params.includes("imdbid"),
    movieSearchTmdb: movie.available && movie.params.includes("tmdbid"),
    tvSearch: tv.available,
    tvSearchImdb: tv.available && tv.params.includes("imdbid"),
    tvSearchTmdb: tv.available && tv.params.includes("tmdbid"),
    tvSearchTvdb: tv.available && tv.params.includes("tvdbid"),
    tvSearchSeason: tv.available && tv.params.includes("season"),
    tvSearchEp: tv.available && tv.params.includes("ep"),
    categories: parseCategories(xml),
  };
}

async function fetchCaps(ix: ConfiguredIndexer): Promise<{ ok: boolean; detail: string; caps: IndexerCapabilities | null }> {
  try {
    const { ok, status, text } = await fetchXml(buildUrl(ix, { t: "caps" }), ix);
    if (!ok) return { ok: false, detail: `HTTP ${status}`, caps: null };
    if (/<error/i.test(text)) {
      const code = text.match(/code="(\d+)"/)?.[1];
      const desc = text.match(/description="([^"]*)"/)?.[1];
      return { ok: false, detail: desc ?? `error ${code ?? ""}`.trim(), caps: null };
    }
    if (!/<caps[\s>]/i.test(text)) return { ok: false, detail: "unexpected response", caps: null };
    return { ok: true, detail: "OK", caps: parseCapabilities(text) };
  } catch (e) {
    return { ok: false, detail: (e as Error).name === "AbortError" ? "timeout" : "unreachable", caps: null };
  }
}

/** Verify credentials and refresh the indexer's cached search capabilities. */
export async function testIndexer(ix: ConfiguredIndexer) {
  const { ok, detail, caps } = await fetchCaps(ix);
  return { ok, detail, caps };
}

/** Parse a date string safely; malformed values become null instead of throwing. */
const safeDate = (v: string | null) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

/** Torznab/RSS producers escape `&`, `<`, `>`, `"`, `'` inside XML text/attributes per spec — a value like a
 * download URL's query string (`...&amp;apikey=...`) is unusable (and silently drops params) until unescaped. */
function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, "&");
}

const attr = (block: string, name: string) => {
  const v = block.match(new RegExp(`attr[^>]*name="${name}"[^>]*value="([^"]*)"`, "i"))?.[1];
  return v != null ? decodeXmlEntities(v) : null;
};
const tag = (block: string, name: string) => {
  const v = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"))?.[1]?.trim();
  return v != null ? decodeXmlEntities(v) : null;
};

/** Sum the score of every enabled custom format whose regex terms match the release title. */
function applyCustomFormats(title: string): number {
  let delta = 0;
  for (const cf of loadCustomFormats()) {
    if (!cf.enabled) continue;
    const matches = cf.terms.some((pattern) => {
      try {
        return new RegExp(pattern, "i").test(title);
      } catch {
        return false; // malformed user-entered regex — skip rather than throw
      }
    });
    if (matches) delta += cf.score;
  }
  return delta;
}

const CODEC_RE = /\b(x265|x264|h ?265|h ?264|hevc|avc10|avc|av1)\b/i;

/**
 * Series searches build their query as "Title SxxEyy" / "Title Sxx" (see
 * searchTv below) — comparing that whole string against the release title
 * fuzzy-matches the season/episode CODE too, and scene releases spell it
 * inconsistently enough (S08E01 vs Season 08 vs 8x01, or a season pack
 * using a different code than a single-episode release) that a correct
 * match could fail containment/edit-distance on the code alone and get
 * dragged into the mismatch penalty. Season/episode correctness is already
 * verified separately as a hard gate (seasonEpisodeMatches in matching.ts,
 * applied by the auto-grab path) — title relevance only needs the title.
 */
function bareTitle(query: string): string {
  return query.replace(/\bS\d{1,2}(?:E\d{1,3})?\b/gi, "").trim();
}

/**
 * Relevance delta plus an optional hard ceiling on the FINAL score, comparing
 * the search query against the release title (fuzzy/accent/punctuation-
 * insensitive — reuses the same matcher the automated grab path gates
 * candidates with, titleSimilarity from matching.ts) — both against the raw
 * noisy release title (containment catches "Query Words" sitting inside
 * "Query.Words.1080p.WEB-DL-GROUP") and against the release name with
 * quality/codec/group tags stripped off (parseRelease), whichever scores
 * higher.
 *
 * A plain additive penalty isn't enough on its own: a release for a
 * completely different show can still stack enough quality/seeder/custom-
 * format bonuses (a user's "prefer French audio" format alone can easily be
 * +25) to land back near 100 despite a -60 penalty, tying it visually with a
 * genuine match. The cap makes a severe/moderate mismatch structurally
 * unable to outrank a real match no matter how good its other numbers are.
 */
function titleRelevance(query: string, releaseTitle: string, preParsed?: ReturnType<typeof parseRelease>): { delta: number; cap: number | null } {
  if (!query) return { delta: 0, cap: null };
  const bareQuery = bareTitle(query) || query;
  const parsedTitle = preParsed?.title ?? parseRelease(releaseTitle).title;
  const sim = Math.max(titleSimilarity(bareQuery, releaseTitle), titleSimilarity(bareQuery, parsedTitle));
  if (sim >= 0.85) return { delta: 35, cap: null };
  if (sim >= 0.7) return { delta: 15, cap: null };
  if (sim >= 0.5) return { delta: 0, cap: null };
  if (sim >= 0.3) return { delta: -25, cap: 55 };
  return { delta: -60, cap: 20 };
}

/** Detects whether a query year appears in the release title. */
function titleYearMatch(query: string, releaseTitle: string): boolean {
  const year = query.match(/\b(19\d{2}|20\d{2})\b/)?.[0];
  if (!year) return true; // no year in query → don't penalise
  return releaseTitle.includes(year);
}

/**
 * Season/episode delta (+ hard cap, same reasoning as titleRelevance's —
 * see there), decoupled from titleRelevance's title-only fuzzy match (which
 * deliberately ignores the SxxExx code — see bareTitle above). Without this,
 * a query for S01E01 scored E02 identically: title relevance alone can't
 * tell episodes of the same series apart. Uses parseRelease on both sides —
 * the same robust parser the auto-grab path relies on — rather than
 * comparing the raw SxxExx text, so it isn't fooled by formatting
 * differences either.
 */
function seasonEpisodeRelevance(query: string, releaseTitle: string, preParsed?: ReturnType<typeof parseRelease>): { delta: number; cap: number | null } {
  const qm = query.match(/\bS(\d{1,2})(?:E(\d{1,3}))?\b/i);
  if (!qm) return { delta: 0, cap: null };
  const qSeason = parseInt(qm[1], 10);
  const qEpisode = qm[2] ? parseInt(qm[2], 10) : null;

  const r = preParsed ?? parseRelease(releaseTitle);
  if (r.season == null) return { delta: 0, cap: null };
  if (r.season !== qSeason) return { delta: -60, cap: 20 };
  if (qEpisode == null) return { delta: 0, cap: null };
  if (r.episode == null) return { delta: 15, cap: null };
  return r.episode === qEpisode ? { delta: 30, cap: null } : { delta: -50, cap: 40 };
}

function score(r: Omit<IndexerRelease, "score">, rules: ReleaseRules, query?: string) {
  let s = 40;
  const t = r.title.toLowerCase();
  if (/2160p|\b4k\b|uhd/.test(t)) s += 30;
  else if (/1080p/.test(t)) s += 20;
  else if (/720p/.test(t)) s += 8;
  if (/remux|bluray|blu-ray/.test(t)) s += 10;
  if (/web-?dl|webrip/.test(t)) s += 6;
  if (/dolby\s?vision|dv/.test(t)) s += 8;
  else if (/hdr10\+|hdr10/.test(t)) s += 5;
  else if (/\bhdr\b/.test(t)) s += 3;
  if (/atmos|truehd/.test(t)) s += 3;
  const codec = normalizeCodec(t.match(CODEC_RE)?.[0] ?? null);
  if (codec) s += rules.codecScores[codec] ?? 0;
  if (r.seeders != null) s += Math.min(20, Math.round(Math.log2((r.seeders || 0) + 1) * 4));
  else if (r.grabs != null) s += Math.min(15, Math.round(Math.log2((r.grabs || 0) + 1) * 3));
  if (r.publishDate) {
    const ageDays = (Date.now() - new Date(r.publishDate).getTime()) / 86400000;
    if (ageDays < 2) s += 8;
    else if (ageDays < 14) s += 3;
  }
  s += applyCustomFormats(r.title);
  let cap = 100;
  if (query) {
    const parsed = parseRelease(r.title);
    const titleRel = titleRelevance(query, r.title, parsed);
    s += titleRel.delta;
    if (titleRel.cap != null) cap = Math.min(cap, titleRel.cap);
    const seRel = seasonEpisodeRelevance(query, r.title, parsed);
    s += seRel.delta;
    if (seRel.cap != null) cap = Math.min(cap, seRel.cap);
    if (!titleYearMatch(query, r.title)) s -= 15;
  }
  return Math.max(1, Math.min(cap, s));
}

function parseReleases(text: string, ix: ConfiguredIndexer, effectiveCategories: number[], query?: string): IndexerRelease[] {
  const items = text.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];
  const rules = loadReleaseRules();
  const releases: IndexerRelease[] = [];
  for (const block of items) {
    const title = tag(block, "title");
    if (!title || matchesBlockedWord(title, rules)) continue;
    const enclosureRaw = block.match(/<enclosure[^>]*url="([^"]*)"[^>]*>/i)?.[1] ?? null;
    const enclosure = enclosureRaw != null ? decodeXmlEntities(enclosureRaw) : null;
    const enclosureLen = block.match(/<enclosure[^>]*length="(\d+)"/i)?.[1];
    const size = Number(attr(block, "size") ?? tag(block, "size") ?? enclosureLen ?? 0);
    const seeders = attr(block, "seeders");
    const peers = attr(block, "peers") ?? attr(block, "leechers");
    const magnet = attr(block, "magneturl");
    const infoHash = attr(block, "infohash");
    const grabs = attr(block, "grabs");
    const guid = tag(block, "guid") ?? enclosure ?? magnet ?? title;

    const base: Omit<IndexerRelease, "score"> = {
      guid,
      title,
      indexerId: ix.id,
      indexer: ix.name,
      protocol: ix.protocol,
      size: Number.isFinite(size) ? size : 0,
      seeders: ix.protocol === "torrent" && seeders != null ? Number(seeders) : null,
      leechers:
        ix.protocol === "torrent" && peers != null && seeders != null
          ? Math.max(0, Number(peers) - Number(seeders))
          : null,
      grabs: grabs != null ? Number(grabs) : null,
      publishDate: safeDate(tag(block, "pubDate")),
      downloadUrl: enclosure,
      magnetUrl: magnet,
      infoHash,
      categories: effectiveCategories,
    };
    releases.push({ ...base, score: score(base, rules, query) });
  }
  return releases;
}

/** Drop releases outside the indexer's configured size/age caps — 0/undefined means no limit. */
function filterBySizeAge(releases: IndexerRelease[], ix: ConfiguredIndexer): IndexerRelease[] {
  if (!ix.minSizeMb && !ix.maxSizeMb && !ix.maxAgeDays) return releases;
  const minBytes = ix.minSizeMb ? ix.minSizeMb * 1024 * 1024 : 0;
  const maxBytes = ix.maxSizeMb ? ix.maxSizeMb * 1024 * 1024 : Infinity;
  return releases.filter((r) => {
    if (r.size && (r.size < minBytes || r.size > maxBytes)) return false;
    if (ix.maxAgeDays && r.publishDate) {
      const ageDays = (Date.now() - new Date(r.publishDate).getTime()) / 86400000;
      if (ageDays > ix.maxAgeDays) return false;
    }
    return true;
  });
}

/**
 * A Torznab/Newznab error response ("Invalid API Key", "Query too short",
 * rate-limited, etc.) still comes back as HTTP 200 — indistinguishable from
 * "zero matches" unless the body is actually inspected. Left unchecked, an
 * indexer rejecting the request looks identical to it finding nothing, which
 * is how a query that genuinely matches on the indexer's own site can come
 * back empty in Movviz with no indication anything went wrong.
 */
function extractIndexerError(text: string): string | null {
  if (!/<error[\s/>]/i.test(text)) return null;
  const desc = text.match(/description="([^"]*)"/i)?.[1];
  const code = text.match(/code="(\d+)"/i)?.[1];
  return desc ? decodeXmlEntities(desc) : code ? `erreur ${code}` : "erreur indexeur";
}

/**
 * Strip characters that Torznab indexers interpret as search operators.
 * "!", "-" (at word start), "+", "|", "(", ")" all have special meaning
 * and cause false negatives when they appear in a title. A movie "Black
 * Friday !" returns zero hits because the "!" is parsed as a NOT operator.
 */
/**
 * Strips characters a Torznab search interprets as operators (quotes,
 * parens, +/|, !) AND typographic punctuation TMDb titles are stored with
 * (curly quotes “”‘’, em/en dashes) that a tracker's own search never
 * contains verbatim — a title like "“Hurlevent”" (TMDb keeps the fancy
 * quotes as part of the title itself) searched for literally matches
 * nothing, on every indexer, for every query built from that title.
 */
export function sanitizeQuery(q: string): string {
  // Release names are dot-separated ("100.Millions.2025...",
  // "House.of.the.Dragon.S03..."), and confirmed live against both
  // configured indexers (C411, Torr9): a query containing a literal space
  // does NOT match a dot in the release name — a multi-word query like
  // "100 Millions" or "House of the Dragon" returns 0 results even though
  // the exact same query with dots instead of spaces returns dozens. Local
  // matching (titleSimilarity/parseReleases) already normalizes dots and
  // spaces identically, so this is safe for the matchQuery use too.
  // ":" never appears in a scene release name either (subtitle separators
  // become a space or get dropped entirely) — confirmed live: "Resident
  // Evil : Chapitre Final" returns 0, "Resident Evil Chapitre Final" (no
  // colon) returns 4.
  // "…" (ellipsis) and "..." appear in titles like "What If...?" — they
  // are never part of a scene release name, and leaving them produces a
  // query like "What.If..." that indexers can't match. Strip them before
  // the space-to-dot pass so the result is clean ("What.If").
  // "?" and "¿" are similarly absent from release names — confirmed on
  // both configured indexers.
  // Accented chars ("é", "è", "ç", "ñ"…) are never used in scene release
  // names either — a search for "Team.Démolition" returns 0 while
  // "Team.Demolition" returns the expected results. Normalize to ASCII so
  // titles like "Team Démolition" or "What If...?" actually find releases.
  return q
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[!"'()+|:‘’"“”–—¿?…]/g, "")
    .trim()
    .replace(/\s+/g, ".")
    .replace(/\.{2,}/g, ".")
    .replace(/^\.|\.$/g, "");
}

async function runSearch(
  ix: ConfiguredIndexer,
  params: Record<string, string>,
  scopeCategories?: number[],
  query?: string
): Promise<IndexerRelease[]> {
  const scoped = scopeCategories ? ix.categories.filter((c) => scopeCategories.includes(c)) : ix.categories;
  const effective = scoped.length ? scoped : ix.categories;
  const withCat = effective.length ? { ...params, cat: effective.join(",") } : params;
  let r;
  try {
    r = await fetchXml(buildUrl(ix, withCat), ix);
  } catch {
    return [];
  }
  if (r.status === 429) {
    markRateLimited(ix.id);
    return [];
  }
  if (!r.ok) return [];
  const indexerError = extractIndexerError(r.text);
  if (indexerError) throw new Error(indexerError);
  return filterBySizeAge(parseReleases(r.text, ix, effective, query), ix);
}

/** Generic free-text search across everything the indexer offers — used by the interactive Search page. */
export async function searchIndexer(
  ix: ConfiguredIndexer,
  query: string,
  scopeCategories?: number[]
): Promise<IndexerRelease[]> {
  const q = sanitizeQuery(query);
  return runSearch(ix, { t: "search", q }, scopeCategories, q);
}

export interface MovieSearchCriteria {
  title: string;
  year?: number | null;
  imdbId?: string | null;
  tmdbId?: number | null;
}

/** Uses t=movie with imdbid/tmdbid when the indexer declares support for it; falls back to a text query otherwise. */
export async function searchMovie(
  ix: ConfiguredIndexer,
  criteria: MovieSearchCriteria,
  scopeCategories?: number[]
): Promise<IndexerRelease[]> {
  const caps = ix.caps;
  // Two different uses that must NOT share one string: `matchQuery` (title +
  // year) is only ever compared locally against parsed release titles in
  // parseReleases — fine to combine there. `searchQuery` (title only) is
  // what actually gets sent to the indexer's own search — appending the year
  // there was confirmed live to return zero results even for a release that
  // exists and matches perfectly on title alone (the indexer's search
  // doesn't reliably treat "Title YYYY" as "Title" AND "YYYY", unlike the
  // local dot/underscore-tolerant matching parseReleases does).
  const searchQuery = sanitizeQuery(criteria.title);
  const matchQuery = sanitizeQuery(criteria.year ? `${criteria.title} ${criteria.year}` : criteria.title);

  if (caps?.movieSearch && (criteria.imdbId || criteria.tmdbId)) {
    const params: Record<string, string> = { t: "movie" };
    if (criteria.imdbId && caps.movieSearchImdb) params.imdbid = criteria.imdbId.replace(/^tt/, "");
    if (criteria.tmdbId && caps.movieSearchTmdb) params.tmdbid = String(criteria.tmdbId);
    if (Object.keys(params).length > 1) {
      const results = await runSearch(ix, params, scopeCategories, matchQuery);
      if (results.length > 0) return results;
      // ID search returned nothing — fall back to text search so a title
      // with accents or special chars still finds releases.
    }
  }
  return runSearch(ix, { t: "search", q: searchQuery }, scopeCategories, matchQuery);
}

export interface TvSearchCriteria {
  title: string;
  season: number;
  episode?: number | null;
  imdbId?: string | null;
  tmdbId?: number | null;
}

/** Uses t=tvsearch with season/ep + an id param when the indexer declares support for it; falls back to a text query. */
export async function searchTv(
  ix: ConfiguredIndexer,
  criteria: TvSearchCriteria,
  scopeCategories?: number[]
): Promise<IndexerRelease[]> {
  const caps = ix.caps;
  const pad = (n: number) => String(n).padStart(2, "0");
  // Same split as searchMovie: appending "SxxExx"/"Sxx" to the title with a
  // space and sending that as the indexer's own search query returns ZERO
  // results even for a series that has plenty of matching releases —
  // confirmed live ("9-1-1 S09" → 0 hits, "9-1-1" alone → 80). matchQuery
  // (title + season/episode) stays for the LOCAL parseReleases comparison,
  // where the season/episode code genuinely helps disambiguate.
  const searchQuery = sanitizeQuery(criteria.title);
  const matchQuery = sanitizeQuery(criteria.episode
    ? `${criteria.title} S${pad(criteria.season)}E${pad(criteria.episode)}`
    : `${criteria.title} S${pad(criteria.season)}`);

  if (caps?.tvSearch && caps.tvSearchSeason && (criteria.imdbId || criteria.tmdbId)) {
    const params: Record<string, string> = { t: "tvsearch", season: String(criteria.season) };
    if (criteria.episode && caps.tvSearchEp) params.ep = String(criteria.episode);
    if (criteria.imdbId && caps.tvSearchImdb) params.imdbid = criteria.imdbId.replace(/^tt/, "");
    if (criteria.tmdbId && caps.tvSearchTmdb) params.tmdbid = String(criteria.tmdbId);
    if (Object.keys(params).length > 2) {
      const results = await runSearch(ix, params, scopeCategories, matchQuery);
      if (results.length > 0) return results;
    }
  }
  return runSearch(ix, { t: "search", q: searchQuery }, scopeCategories, matchQuery);
}

/**
 * Terms release groups/indexers use to tag a full-series pack, by language —
 * Movviz's own indexers are mostly French trackers, but a release itself (or
 * a foreign indexer) may use any of these. Tried as separate queries (below)
 * rather than one combined string, since a strict on-site text search often
 * requires every query word to appear in the result title.
 */
export const COMPLETE_SERIES_TERMS = [
  "Complete Series", "Complete", // English
  "Intégrale", "Saisons complètes", "Complet", // French
  "Serie Completa", "Completa", // Italian/Spanish
  "Complete Serie", "Compleet", // Dutch
  "Komplette Serie", "Komplett", // German
];

/**
 * Search for a complete-series pack — a single torrent that contains every
 * season/episode of a whole show. Tries every known "complete pack" term
 * (see COMPLETE_SERIES_TERMS) plus a season-range query, merging and
 * deduping results, since a single English-only query missed real packs
 * tagged in French ("Intégrale") or another language.
 */
export async function searchCompleteSeriesPack(
  ix: ConfiguredIndexer,
  criteria: { title: string; seasonCount?: number },
  scopeCategories?: number[]
): Promise<IndexerRelease[]> {
  // Search the indexer with the bare title only — appending "Complete Series"/
  // "Seasons 1-N" etc. to the actual query string returns 0 results from real
  // torznab backends even when matching releases exist (same bug fixed for
  // searchMovie/searchTv above). The combined term is still used as the
  // matchQuery so parseReleases can score/filter for series-pack relevance.
  const searchQuery = sanitizeQuery(criteria.title);
  const matchQueries = COMPLETE_SERIES_TERMS.map((term) => `${criteria.title} ${term}`);
  if (criteria.seasonCount) matchQueries.push(`${criteria.title} Seasons 1-${criteria.seasonCount}`);

  const results = await Promise.all(
    matchQueries.map((matchQuery) =>
      runSearch(ix, { t: "search", q: searchQuery }, scopeCategories, matchQuery).catch(() => [])
    )
  );
  const seen = new Set<string>();
  const merged: IndexerRelease[] = [];
  for (const release of results.flat()) {
    if (seen.has(release.guid)) continue;
    seen.add(release.guid);
    merged.push(release);
  }
  return merged;
}
