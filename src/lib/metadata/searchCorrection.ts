import path from "node:path";
import { CONFIG_DIR } from "@/lib/auth/store";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import { browseCategory, trending } from "@/lib/metadata/tmdb";
import { loadMovies, loadSeries } from "@/lib/library/store";
import type { MetaSearchResult } from "@/lib/metadata/types";

/**
 * Typo-tolerant search. TMDb matches text literally — "hary potter",
 * "matirx" or "onepiece" return nothing. A lexicon of known titles (TMDb
 * popular/top rated/trending, the library, and every title a search has
 * already surfaced) lets a weak answer be retried with the closest real
 * title. Purely deterministic: normalized text + edit distance.
 */

const FILE = path.join(CONFIG_DIR, "search-corpus.json");
const REBUILD_MS = 24 * 3_600_000;
const MAX_ENTRIES = 20_000;
const MIN_GUESS_WEIGHT = 50;

type CorpusFile = { builtAt: number; entries: [string, number][] };
type Corpus = { entries: Map<string, [string, number]>; builtAt: number; building: boolean; saveTimer: ReturnType<typeof setTimeout> | null };

const g = globalThis as typeof globalThis & { __movvizSearchCorpus?: Corpus };

const ARTICLES = /^(the|le|la|les|l|a|an|un|une|el|los|las|der|die|das|il|lo|gli|de|het|een) /;

export function normalizeTitle(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const stripArticle = (normalized: string) => normalized.replace(ARTICLES, "");
const compact = (normalized: string) => normalized.replace(/ /g, "");
/** Comparable form: no accents, no punctuation, no leading article, no spaces. */
export const searchKey = (s: string) => compact(stripArticle(normalizeTitle(s)));

function corpus(): Corpus {
  if (!g.__movvizSearchCorpus) {
    const file = readJsonCached<CorpusFile>(FILE, { builtAt: 0, entries: [] });
    const entries = new Map<string, [string, number]>();
    for (const [title, weight] of file.entries ?? []) {
      const key = normalizeTitle(title);
      if (key) entries.set(key, [title, weight]);
    }
    g.__movvizSearchCorpus = { entries, builtAt: file.builtAt ?? 0, building: false, saveTimer: null };
  }
  return g.__movvizSearchCorpus;
}

function scheduleSave(c: Corpus) {
  if (c.saveTimer) return;
  c.saveTimer = setTimeout(() => {
    c.saveTimer = null;
    writeJsonCached(FILE, { builtAt: c.builtAt, entries: [...c.entries.values()] } satisfies CorpusFile);
  }, 5_000);
}

function addTitle(c: Corpus, title: string | undefined | null, weight: number) {
  if (!title) return;
  const key = normalizeTitle(title);
  if (key.length < 2) return;
  const prev = c.entries.get(key);
  if (prev && prev[1] >= weight) return;
  if (!prev && c.entries.size >= MAX_ENTRIES) return;
  c.entries.set(key, [title, weight]);
}

/** Every title a search surfaces enriches the lexicon (bounded, debounced save). */
export function learnTitles(results: MetaSearchResult[]) {
  const c = corpus();
  const before = c.entries.size;
  for (const r of results) {
    const weight = r.voteCount ?? 0;
    if (weight < 20) continue;
    addTitle(c, r.title, weight);
    addTitle(c, r.originalTitle, weight);
  }
  if (c.entries.size !== before) scheduleSave(c);
}

/** Refreshes the lexicon in the background — never awaited on a request path. */
export function warmSearchCorpus() {
  const c = corpus();
  if (c.building || Date.now() - c.builtAt < REBUILD_MS) return;
  c.building = true;
  void (async () => {
    try {
      for (const m of loadMovies()) addTitle(c, m.title, 1_000);
      for (const s of loadSeries()) addTitle(c, s.title, 1_000);
      for (const type of ["movie", "series"] as const) {
        for (let page = 1; page <= 5; page++) learnAll(c, (await trending(type, page)).results);
        for (const category of ["popular", "top_rated"] as const) {
          for (let page = 1; page <= 15; page++) learnAll(c, (await browseCategory(type, category, page)).results);
        }
      }
      c.builtAt = Date.now();
      scheduleSave(c);
    } catch {
      // TMDb unreachable — keep what we have, retry on a later search.
    } finally {
      c.building = false;
    }
  })();
}

function learnAll(c: Corpus, results: MetaSearchResult[]) {
  for (const r of results) {
    addTitle(c, r.title, r.voteCount ?? 0);
    addTitle(c, r.originalTitle, r.voteCount ?? 0);
  }
}

/** Optimal-string-alignment distance between `a` and every prefix of `b`
 *  (index = prefix length). Transpositions ("matirx") count as one edit. */
function prefixDistances(a: string, b: string): number[] {
  const n = a.length, m = b.length;
  let prev2: number[] = [];
  let prev = Array.from({ length: m + 1 }, (_, j) => j);
  for (let i = 1; i <= n; i++) {
    const cur = [i];
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur.push(v);
    }
    prev2 = prev;
    prev = cur;
  }
  return prev;
}

/** The query rewritten as the closest known title (or its leading words),
 *  or null when nothing is close enough to be a safe guess. */
export function findCorrection(query: string): string | null {
  const c = corpus();
  const normalized = normalizeTitle(query);
  const q = compact(stripArticle(normalized));
  if (q.length < 4) return null;
  const maxDist = q.length <= 8 ? 1 : q.length <= 12 ? 2 : 3;

  let best: { words: string; dist: number; weight: number } | null = null;
  for (const [key, [, weight]] of c.entries) {
    // Only a reasonably known title is a safe guess.
    if (weight < MIN_GUESS_WEIGHT) continue;
    const stripped = stripArticle(key);
    const form = compact(stripped);
    if (form.length < q.length - maxDist) continue;
    const dists = prefixDistances(q, form.slice(0, q.length + maxDist));
    // Only cut the title on a word boundary: "harrypotter|alecole…".
    const words = stripped.split(" ");
    let len = 0;
    for (let w = 0; w < words.length; w++) {
      len += words[w].length;
      if (len > q.length + maxDist) break;
      if (len < q.length - maxDist) continue;
      const dist = dists[len];
      if (dist > maxDist || (dist > 1 && form[0] !== q[0])) continue;
      if (!best || dist < best.dist || (dist === best.dist && weight > best.weight)) {
        best = { words: words.slice(0, w + 1).join(" "), dist, weight };
      }
    }
  }
  if (!best || best.words === stripArticle(normalized)) return null;
  return best.words;
}

/** True when a literal answer already contains a well-known title matching the query. */
export function hasStrongMatch(query: string, results: MetaSearchResult[]): boolean {
  const q = searchKey(query);
  if (!q) return true;
  return results.some((r) =>
    (r.voteCount ?? 0) >= 50 && [r.title, r.originalTitle].some((t) => !!t && searchKey(t).includes(q))
  );
}
