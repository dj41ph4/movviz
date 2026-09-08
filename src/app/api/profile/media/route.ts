import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { loadWatchlist } from "@/lib/watchlist/store";
import { getAllRatings } from "@/lib/ai/tasteProfile";
import { getUserWatchHistory } from "@/lib/userContext/history";
import { getMovieByTmdbId, getSeriesByTmdbId } from "@/lib/library/store";
import { listOnDeckEntries } from "@/lib/plex/onDeckService";
import { getMovie, getSeries } from "@/lib/metadata/tmdb";
import { mapWithConcurrency } from "@/lib/concurrency";

export const dynamic = "force-dynamic";

function titleFor(tmdbId: number, type: "movie" | "series" | "episode", fallback?: string | null): string {
  if (fallback) return fallback;
  if (type === "movie") return getMovieByTmdbId(tmdbId)?.title ?? `#${tmdbId}`;
  return getSeriesByTmdbId(tmdbId)?.title ?? `#${tmdbId}`;
}

/**
 * L'historique et les notes ne stockent volontairement qu'un instantané
 * utilisateur (titre, date, note). L'affiche, elle, appartient aux
 * métadonnées de la bibliothèque : on la rattache ici sans jamais écrire ni
 * croiser les données d'un autre profil. Pour un épisode, le poster de la
 * série est l'image verticale attendue dans une rangée TV.
 */
function libraryArtwork(tmdbId: number, type: "movie" | "series" | "episode") {
  const media = type === "movie" ? getMovieByTmdbId(tmdbId) : getSeriesByTmdbId(tmdbId);
  return {
    posterPath: media?.posterPath ?? null,
    year: media?.year ?? null,
  };
}

type ProfileArtwork = ReturnType<typeof libraryArtwork>;

/**
 * Une entrée peut provenir d'un ancien historique ou d'une note, donc ne plus
 * avoir de correspondant local (fichier supprimé, import Plex ancien). Dans
 * ce seul cas, on utilise le cache TMDb déjà mutualisé par le serveur. Les
 * appels sont dédoublonnés et plafonnés : ce n'est pas une cascade de requêtes
 * côté TV et aucune donnée de suivi n'est modifiée.
 */
async function resolveArtwork(tmdbId: number, type: "movie" | "series" | "episode"): Promise<ProfileArtwork> {
  const local = libraryArtwork(tmdbId, type);
  if (local.posterPath) return local;
  const meta = type === "movie" ? await getMovie(tmdbId) : await getSeries(tmdbId);
  return { posterPath: meta?.posterPath ?? null, year: meta?.year ?? null };
}

export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const watchlist = loadWatchlist(user.id);
  const onDeck = await listOnDeckEntries(user);
  const history = getUserWatchHistory({ userId: user.id, limit: 200 });
  const ratings = getAllRatings(user.id).sort((a, b) => b.updatedAt - a.updatedAt);

  const artworkRefs = new Map<string, { tmdbId: number; type: "movie" | "series" | "episode" }>();
  for (const item of history) {
    artworkRefs.set(`${item.mediaType}:${item.tmdbId}`, {
      tmdbId: item.tmdbId,
      type: item.mediaType,
    });
  }
  for (const item of ratings) {
    artworkRefs.set(`${item.type}:${item.tmdbId}`, {
      tmdbId: item.tmdbId,
      type: item.type,
    });
  }
  const resolvedArtwork = new Map(
    await mapWithConcurrency([...artworkRefs.entries()], 5, async ([key, ref]) => [key, await resolveArtwork(ref.tmdbId, ref.type)] as const),
  );

  const continueWatching = onDeck.map((item) => ({
    tmdbId: item.tmdbId, type: item.type, seasonNumber: item.seasonNumber ?? null, episodeNumber: item.episodeNumber ?? null,
    title: item.title, subtitle: item.type === "episode" ? item.episodeTitle ?? null : null,
    posterPath: item.posterPath, stillPath: item.episodeStillPath ?? null, year: item.year, watched: false,
    progress: item.progressPercent > 0 ? { ratio: item.progressPercent / 100 } : null,
    watchedAt: null,
  }));
  const watchHistory = history.map((item) => {
    const artwork = resolvedArtwork.get(`${item.mediaType}:${item.tmdbId}`) ?? libraryArtwork(item.tmdbId, item.mediaType);
    return {
      tmdbId: item.tmdbId, type: item.mediaType, seasonNumber: item.seasonNumber, episodeNumber: item.episodeNumber,
      title: item.title, subtitle: null, posterPath: artwork.posterPath, stillPath: null, year: artwork.year, watchedAt: item.watchedAt,
    };
  });
  const ratingItems = ratings.map((item) => {
    const artwork = resolvedArtwork.get(`${item.type}:${item.tmdbId}`) ?? libraryArtwork(item.tmdbId, item.type);
    return {
      tmdbId: item.tmdbId, type: item.type, title: item.title, posterPath: artwork.posterPath,
      stillPath: null, year: artwork.year, userRating: item.rating, watchedAt: null, addedAt: null,
    };
  });
  const watchlistItems = watchlist.map((item) => ({ tmdbId: item.tmdbId, type: item.type, seasonNumber: item.seasonNumber ?? null, episodeNumber: item.episodeNumber ?? null, title: item.title, subtitle: item.parentTitle ?? null, posterPath: item.posterPath, stillPath: item.stillPath ?? null, year: item.year, addedAt: item.addedAt }));
  return NextResponse.json({ generatedAt: Date.now(), continueWatching: continueWatching.slice(0, 12), watchHistory: watchHistory.slice(0, 20), ratings: ratingItems.slice(0, 20), watchlist: watchlistItems.slice(0, 20), counts: { continueWatching: continueWatching.length, history: watchHistory.length, ratings: ratingItems.length, watchlist: watchlistItems.length } });
}
