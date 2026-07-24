import { NextRequest, NextResponse } from "next/server";
import { getCollection, getMovie } from "@/lib/metadata/tmdb";
import { getPlexCollections, getPlexCollectionDetail } from "@/lib/plex/client";
import { loadPlexConfig, plexConfigured } from "@/lib/plex/store";
import { loadMovies } from "@/lib/library/store";
import { mapWithConcurrency } from "@/lib/concurrency";
import type { MetaCollectionDetail, MetaSearchResult } from "@/lib/metadata/types";

export const dynamic = "force-dynamic";

async function buildPlexCollectionDetail(
  ratingKey: string,
): Promise<MetaCollectionDetail | null> {
  const cfg = loadPlexConfig();
  const token = cfg.adminToken;
  if (!token) return null;

  const detail = await getPlexCollectionDetail(cfg, ratingKey, token);
  if (!detail) return null;

  const parts: MetaSearchResult[] = [];
  for (const child of detail.children) {
    if (child.tmdbId) {
      const movie = await getMovie(child.tmdbId);
      if (movie) {
        parts.push({
          tmdbId: movie.tmdbId,
          type: "movie" as const,
          title: movie.title,
          year: movie.year,
          releaseDate: movie.releaseDate,
          overview: movie.overview,
          posterPath: movie.posterPath,
          rating: movie.rating,
        });
        continue;
      }
    }
    parts.push({
      tmdbId: child.tmdbId ?? 0,
      type: "movie" as const,
      title: child.title,
      year: child.year ?? null,
      releaseDate: null,
      overview: "",
      posterPath: null,
      rating: 0,
    });
  }

  parts.sort((a, b) => (a.releaseDate ?? "9999").localeCompare(b.releaseDate ?? "9999"));

  return {
    id: Number(ratingKey) || 0,
    name: detail.title || "Collection",
    overview: "",
    posterPath: detail.posterPath,
    backdropPath: null,
    parts,
  };
}

interface MergedCollection {
  ratingKey: string;
  title: string;
  thumb: string | null;
  childCount: number;
  source: "plex" | "tmdb";
}

async function listMergedCollections(): Promise<MergedCollection[]> {
  const seen = new Set<string>();
  const result: MergedCollection[] = [];

  if (plexConfigured()) {
    const cfg = loadPlexConfig();
    const plexCols = await getPlexCollections(cfg);
    for (const pc of plexCols) {
      const key = pc.title.toLowerCase().trim();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({
        ratingKey: pc.ratingKey,
        title: pc.title,
        thumb: pc.thumb,
        childCount: pc.childCount,
        source: "plex",
      });
    }
  }

  const movies = loadMovies();
  const collectionIds = new Set<number>();
  for (const m of movies) {
    if (m.tmdbCollectionId) collectionIds.add(m.tmdbCollectionId);
  }

  const tmdbCols = await mapWithConcurrency([...collectionIds], 10, (id) => getCollection(id));
  for (const col of tmdbCols) {
    if (!col) continue;
    const key = col.name.toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      ratingKey: String(col.id),
      title: col.name,
      thumb: col.posterPath ? `https://image.tmdb.org/t/p/w185${col.posterPath}` : null,
      childCount: col.parts.length,
      source: "tmdb",
    });
  }

  return result;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const plexId = searchParams.get("plexId");

  if (plexId) {
    if (!plexConfigured()) {
      return NextResponse.json({ error: "Plex not configured" }, { status: 400 });
    }
    const col = await buildPlexCollectionDetail(plexId);
    if (!col) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(col);
  }

  if (id) {
    const tmdbId = Number(id);
    if (!tmdbId) return NextResponse.json({ error: "id required" }, { status: 400 });
    const collection = await getCollection(tmdbId);
    if (!collection) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(collection);
  }

  const merged = await listMergedCollections();
  return NextResponse.json({ collections: merged });
}
