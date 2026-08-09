import { c411FetchJson, loadC411ListsConfig } from "./session";
import { classifyTmdbId, resolveReleases, posterPathFromUrl } from "./resolve";
import type { MetaSearchResult } from "@/lib/metadata/types";
import { mapWithConcurrency } from "@/lib/concurrency";

/**
 * C411 front-page lists for the Discover tab.
 *
 * The homepage's own "Nouvelles Sorties" section is served by
 * /api/homepage as three pre-enriched lists (popular / recent / release
 * date) whose items already carry tmdbId + TMDb artwork — no extra TMDb
 * calls. The "uploaded today" counter links to /api/torrents/today, which
 * has no tmdbId — those release names are resolved through TMDb search
 * (disk-cached, see resolve.ts).
 *
 * Rows only exist when the C411 indexer has lists enabled with site
 * credentials — otherwise the endpoint reports `configured: false` and the
 * Discover page renders nothing for it.
 */

export const C411_ROW_KEYS = ["c411Popular", "c411Recent", "c411Today"] as const;
export type C411RowKey = (typeof C411_ROW_KEYS)[number];

export interface C411Row {
  key: string;
  results: MetaSearchResult[];
}

const g = globalThis as typeof globalThis & {
  __movvizC411Rows?: { ts: number; value: C411Row[] };
};

/** List responses are cached briefly so row refreshes never hammer the tracker. */
const ROW_TTL_MS = 5 * 60 * 1000;

interface C411ExclusiveItem {
  tmdbId: number | null;
  tmdbTitle: string | null;
  tmdbYear: number | null;
  posterUrl: string | null;
}

interface C411Homepage {
  exclusive: C411ExclusiveItem[];
  exclusiveRecent: C411ExclusiveItem[];
  exclusivePopular: C411ExclusiveItem[];
}

interface C411TodayTorrent {
  name: string;
  seeders: number;
}

interface C411TodayGroup {
  slug: string;
  torrents: C411TodayTorrent[];
}

/** Film & série subcategories only — the Discover rows are media cards, not game/ebook listings. */
const MEDIA_SUBCATS = new Set(["films-videos"]);

async function mapExclusiveItems(items: C411ExclusiveItem[]): Promise<MetaSearchResult[]> {
  const out = await mapWithConcurrency(items.slice(0, 14), 5, async (item): Promise<MetaSearchResult | null> => {
    if (!item.tmdbId) return null;
    const type = await classifyTmdbId(item.tmdbId);
    if (!type) return null;
    return {
      tmdbId: item.tmdbId,
      type,
      title: item.tmdbTitle?.trim() || "",
      year: item.tmdbYear,
      releaseDate: null,
      overview: "",
      posterPath: posterPathFromUrl(item.posterUrl),
      backdropPath: null,
      rating: 0,
    };
  });
  const seen = new Set<number>();
  return out.filter((r): r is MetaSearchResult => {
    if (!r || seen.has(r.tmdbId)) return false;
    seen.add(r.tmdbId);
    return true;
  });
}

async function buildTodayRow(): Promise<MetaSearchResult[]> {
  const payload = (await c411FetchJson(loadC411ListsConfig()!, "/api/torrents/today")) as { data: C411TodayGroup[] };
  if (!Array.isArray(payload?.data)) return [];
  const torrents = (payload.data as C411TodayGroup[])
    .filter((gr) => MEDIA_SUBCATS.has(gr.slug ?? ""))
    .flatMap((gr) => gr.torrents ?? [])
    .sort((a, b) => (b.seeders ?? 0) - (a.seeders ?? 0))
    .slice(0, 24);
  const results = await resolveReleases(torrents.map((t) => t.name));
  const seen = new Set<number>();
  return results.filter((r) => {
    if (seen.has(r.tmdbId)) return false;
    seen.add(r.tmdbId);
    return true;
  });
}

export async function getC411Rows(): Promise<{ configured: boolean; rows: C411Row[] }> {
  const cfg = loadC411ListsConfig();
  if (!cfg) return { configured: false, rows: [] };

  const memo = g.__movvizC411Rows;
  if (memo && Date.now() - memo.ts < ROW_TTL_MS) return { configured: true, rows: memo.value };

  try {
    const homepage = await c411FetchJson(cfg, "/api/homepage");
    const home = homepage as C411Homepage;
    const popularSource =
      home.exclusivePopular && home.exclusivePopular.length > 0 ? home.exclusivePopular : home.exclusive;
    const [popular, recent, today] = await Promise.all([
      mapExclusiveItems(popularSource ?? []),
      mapExclusiveItems(home.exclusiveRecent ?? []),
      buildTodayRow(),
    ]);
    const rows: C411Row[] = [
      { key: "c411Popular", results: popular },
      { key: "c411Recent", results: recent },
      { key: "c411Today", results: today },
    ].filter((r) => r.results.length > 0);
    g.__movvizC411Rows = { ts: Date.now(), value: rows };
    return { configured: true, rows };
  } catch {
    // Keep showing the last good lists when c411 hiccups; empty on first failure.
    return { configured: true, rows: memo?.value ?? [] };
  }
}

export async function getC411RowPage(key: string, page: number, perPage = 20): Promise<MetaSearchResult[]> {
  const { rows } = await getC411Rows();
  const row = rows.find((r) => r.key === key);
  if (!row) return [];
  return row.results.slice((page - 1) * perPage, page * perPage);
}
