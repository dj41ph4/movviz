import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { loadMovies } from "@/lib/library/store";
import { getCollection } from "@/lib/metadata/tmdb";
import { mapWithConcurrency } from "@/lib/concurrency";

export const dynamic = "force-dynamic";

export interface SagaSummary {
  collectionId: number;
  name: string;
  posterPath: string | null;
  ownedCount: number;
  totalCount: number;
}

/**
 * Every TMDb franchise represented in the library, even by a single owned
 * movie — e.g. one movie whose collection has two other entries still shows
 * up here, so the "you're missing the rest of this saga" case is exactly
 * the point, not an edge case to filter out.
 */
export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const owned = new Map<number, number>(); // collectionId -> owned count
  for (const m of loadMovies()) {
    if (!m.tmdbCollectionId) continue;
    owned.set(m.tmdbCollectionId, (owned.get(m.tmdbCollectionId) ?? 0) + 1);
  }

  const ids = [...owned.keys()];
  // A large library can span hundreds of distinct collections — firing them
  // all as one unbounded Promise.all self-inflicts a request storm against
  // TMDb (seen in practice: 400+ simultaneous calls each slowed to ~4s,
  // presumably TMDb's own rate limiting kicking in), even though each
  // individual call is cheap and gets cached afterward. A small fixed
  // concurrency keeps the same total work without the pile-up.
  const collections = await mapWithConcurrency(ids, 10, (id) => getCollection(id));
  const today = new Date().toISOString().slice(0, 10);

  const sagas: SagaSummary[] = collections
    .map((c, i) => {
      if (!c) return null;
      // Counting every part (including unreleased/announced entries) made the
      // ratio permanently look incomplete for active franchises — "1/12" for
      // a saga where only 10 films actually exist yet. Only released movies
      // count toward the total, same as what "owned" can realistically reach.
      const releasedCount = c.parts.filter((p) => p.releaseDate && p.releaseDate <= today).length;
      return { collectionId: ids[i], name: c.name, posterPath: c.posterPath, ownedCount: owned.get(ids[i])!, totalCount: Math.max(releasedCount, owned.get(ids[i])!) };
    })
    .filter((s): s is SagaSummary => !!s)
    .sort((a, b) => b.totalCount - b.ownedCount - (a.totalCount - a.ownedCount));

  return NextResponse.json({ sagas });
}
