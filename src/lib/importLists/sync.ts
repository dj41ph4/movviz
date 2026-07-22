import { loadImportLists, updateImportListSync } from "./store";
import type { ImportListEntry } from "./types";
import { addMediaSilent } from "@/lib/library/addMedia";
import { mapWithConcurrency } from "@/lib/concurrency";

async function fetchTrakt(url: string): Promise<ImportListEntry[]> {
  const listId = url.split("/").pop()?.split("?")[0] ?? "";
  const apiUrl = `https://api.trakt.tv/users/${listId}/lists/${listId}/items`;
  const res = await fetch(apiUrl, {
    headers: { "Content-Type": "application/json", "trakt-api-version": "2", "trakt-api-key": "" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data
    .filter((item: any) => item.type === "movie" || (item.type === "show" && item.show?.ids?.tmdb))
    .map((item: any) => ({
      tmdbId: item.movie?.ids?.tmdb ?? item.show?.ids?.tmdb,
      type: item.type === "show" ? "series" : "movie" as const,
      title: item.movie?.title ?? item.show?.title ?? "",
      year: (item.movie?.year ?? item.show?.year) ? Number(item.movie?.year ?? item.show?.year) : null,
    }))
    .filter((e: ImportListEntry) => e.tmdbId);
}

async function fetchImdb(url: string): Promise<ImportListEntry[]> {
  const listId = url.match(/list\/(\w+)/)?.[1] ?? url.split("/").pop() ?? "";
  const apiUrl = `https://www.imdb.com/list/${listId}/export`;
  try {
    const res = await fetch(apiUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return [];
    const csv = await res.text();
    const lines = csv.split("\n").slice(1);
    const entries: ImportListEntry[] = [];
    for (const line of lines) {
      const cols = line.split(",");
      if (cols.length < 4) continue;
      const constId = cols[0]?.trim();
      const title = cols[1]?.trim();
      const year = cols[3]?.trim();
      if (!constId || !title) continue;
      const tmdbId = await resolveImdbToTmdb(constId);
      if (tmdbId) entries.push({ tmdbId, type: "movie", title, year: year ? Number(year) : null });
    }
    return entries;
  } catch {
    return [];
  }
}

async function fetchLetterboxd(url: string): Promise<ImportListEntry[]> {
  const username = url.match(/letterboxd\.com\/([^/]+)\//)?.[1] ?? url.split("/").filter(Boolean).pop() ?? "";
  const rssUrl = `https://letterboxd.com/${username}/watchlist/rss/`;
  try {
    const res = await fetch(rssUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return [];
    const xml = await res.text();
    const titleMatches = xml.match(/<title>(.*?)<\/title>/g) ?? [];
    const entries: ImportListEntry[] = [];
    for (const t of titleMatches.slice(1)) {
      const raw = t.replace(/<\/?title>/g, "").trim();
      const m = raw.match(/^(.+?)\s*\((\d{4})\)$/);
      if (!m) continue;
      const title = m[1].trim();
      const year = Number(m[2]);
      const tmdbId = await searchTmdb(title, year);
      if (tmdbId) entries.push({ tmdbId, type: "movie", title, year });
    }
    return entries;
  } catch {
    return [];
  }
}

async function resolveImdbToTmdb(imdbId: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.themoviedb.org/3/find/${imdbId}?external_source=imdb_id`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.movie_results?.[0]?.id ?? data.tv_results?.[0]?.id ?? null;
  } catch { return null; }
}

async function searchTmdb(title: string, year: number): Promise<number | null> {
  try {
    const res = await fetch(`https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(title)}&year=${year}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.results?.[0]?.id ?? null;
  } catch { return null; }
}

const FETCHERS: Record<string, (url: string) => Promise<ImportListEntry[]>> = {
  trakt: fetchTrakt,
  imdb: fetchImdb,
  letterboxd: fetchLetterboxd,
};

export async function syncImportList(listId: string): Promise<number> {
  const lists = loadImportLists();
  const list = lists.find((l) => l.id === listId);
  if (!list || !list.enabled) return 0;
  const fetcher = FETCHERS[list.kind];
  if (!fetcher) return 0;
  const entries = await fetcher(list.url);
  const results = await mapWithConcurrency(entries, 4, async (entry) => {
    try {
      await addMediaSilent(entry.tmdbId, entry.type);
      return true;
    } catch {
      return false; // duplicate or add failure — skip, doesn't count
    }
  });
  updateImportListSync(listId, Date.now());
  return results.filter(Boolean).length;
}
