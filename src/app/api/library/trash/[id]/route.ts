import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { loadTrash, removeTrashItem, type TrashItem } from "@/lib/library/trashStore";
import { deleteItemFromPlex } from "@/lib/plex/watchWrite";
import type { LibraryEpisode, LibraryMovie, LibrarySeries } from "@/lib/library/types";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = requireAdmin(req);
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const parts = id.split("_");
  const type = parts[0];
  const tmdbId = Number(parts[1]);
  if (!tmdbId || !type || !["movie", "series", "episode"].includes(type)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const episode = type === "episode" ? { season: Number(parts[2]), episode: Number(parts[3]) } : undefined;
  if (type === "episode" && (!episode?.season || !episode.episode)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  // Look the entry up before removing it — its snapshot carries the Plex
  // ratingKey to delete (the movie/series' own for those types, or the
  // episode's own distinct ratingKey for "episode").
  const item: TrashItem | undefined = loadTrash().find(
    (t) => t.tmdbId === tmdbId && t.type === type &&
      (type !== "episode" || (t.seasonNumber === episode?.season && t.episodeNumber === episode?.episode))
  );
  const ratingKey =
    type === "episode" ? (item?.snapshot as LibraryEpisode | undefined)?.plexRatingKey
    : (item?.snapshot as LibraryMovie | LibrarySeries | undefined)?.plexRatingKey;
  if (ratingKey) void deleteItemFromPlex(user, ratingKey);

  removeTrashItem(tmdbId, type as "movie" | "series" | "episode", episode);
  return NextResponse.json({ ok: true });
}
