import {
  findByExternalId,
  getMovie,
  getSeries,
  searchMovies,
  searchTv,
  tmdbImageUrl,
} from "@/lib/metadata/tmdb";
import { getMovieByTmdbId, getSeriesByTmdbId } from "@/lib/library/store";
import { loadRequests } from "@/lib/requests/store";
import { resolveMovieStatus } from "@/lib/library/types";
import type { LibrarySeries } from "@/lib/library/types";

export type ExtensionType = "movie" | "series";
export type ExtensionStatus = "none" | "pending" | "processing" | "available";

export interface ExtensionMedia {
  type: ExtensionType;
  tmdbId: number;
  title: string;
  year: number | null;
  posterUrl: string | null;
  status: ExtensionStatus;
  requestCount: number;
}

export interface LookupQuery {
  type?: ExtensionType;
  tmdbId?: number;
  imdbId?: string;
  tvdbId?: string;
  title?: string;
  year?: number;
}

function seriesStatus(series: LibrarySeries): ExtensionStatus {
  const episodes = series.seasons.flatMap((s) => s.episodes).filter((e) => e.monitored);
  if (episodes.length === 0) return "processing";
  const settled = episodes.every((e) => e.status === "available" || e.status === "upcoming");
  return settled && episodes.some((e) => e.status === "available") ? "available" : "processing";
}

function statusOf(type: ExtensionType, tmdbId: number): { status: ExtensionStatus; requestCount: number } {
  const requests = loadRequests().filter((r) => r.type === type && r.tmdbId === tmdbId && r.status !== "declined");
  const requestCount = requests.length;
  if (type === "movie") {
    const movie = getMovieByTmdbId(tmdbId);
    if (movie) return { status: resolveMovieStatus(movie) === "available" ? "available" : "processing", requestCount };
  } else {
    const series = getSeriesByTmdbId(tmdbId);
    if (series) return { status: seriesStatus(series), requestCount };
  }
  return { status: requests.some((r) => r.status === "pending") ? "pending" : "none", requestCount };
}

async function resolveId(q: LookupQuery): Promise<{ type: ExtensionType; tmdbId: number } | null> {
  if (q.tmdbId && q.type) return { type: q.type, tmdbId: q.tmdbId };

  const ext = q.imdbId
    ? await findByExternalId("imdb_id", q.imdbId)
    : q.tvdbId
      ? await findByExternalId("tvdb_id", q.tvdbId)
      : null;
  if (ext) {
    if (q.type !== "series" && ext.movies[0]) return { type: "movie", tmdbId: ext.movies[0] };
    if (q.type !== "movie" && ext.series[0]) return { type: "series", tmdbId: ext.series[0] };
    return null;
  }

  const title = q.title?.trim();
  if (!title) return null;
  const year = q.year;
  if (q.type !== "series") {
    const { results } = await searchMovies(title);
    const byYear = year ? results.find((r) => r.year != null && Math.abs(r.year - year) <= 1) : undefined;
    const hit = byYear ?? (q.type === "movie" || !year ? results[0] : undefined);
    if (hit) return { type: "movie", tmdbId: hit.tmdbId };
  }
  if (q.type !== "movie") {
    const { results } = await searchTv(title);
    const byYear = year ? results.find((r) => r.year != null && Math.abs(r.year - year) <= 1) : undefined;
    const hit = byYear ?? results[0];
    if (hit) return { type: "series", tmdbId: hit.tmdbId };
  }
  return null;
}

export async function lookupMedia(q: LookupQuery): Promise<ExtensionMedia | null> {
  const id = await resolveId(q);
  if (!id) return null;
  const meta = id.type === "movie" ? await getMovie(id.tmdbId) : await getSeries(id.tmdbId);
  if (!meta) return null;
  return {
    type: id.type,
    tmdbId: id.tmdbId,
    title: meta.title,
    year: meta.year,
    posterUrl: tmdbImageUrl(meta.posterPath, "w342"),
    ...statusOf(id.type, id.tmdbId),
  };
}
