export interface WatchlistItem {
  userId: string;
  type: "movie" | "series";
  tmdbId: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  rating: number;
  addedAt: number;
}
