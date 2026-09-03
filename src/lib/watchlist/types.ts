export type WatchlistMediaType = "movie" | "series" | "episode";

export interface WatchlistItem {
  userId: string;
  type: WatchlistMediaType;
  tmdbId: number;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  title: string;
  parentTitle?: string | null;
  year: number | null;
  posterPath: string | null;
  stillPath?: string | null;
  rating: number;
  present: boolean;
  addedAt: number;
  removedAt?: number | null;
  updatedAt: number;
  source: string;
  plexGuid?: string | null;
  plexDiscoverRatingKey?: string | null;
}
