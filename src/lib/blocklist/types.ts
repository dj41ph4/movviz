export interface BlockedTitle {
  id: string;
  type: "movie" | "series";
  tmdbId: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  reason: string;
  blockedBy: string; // admin username
  blockedAt: number;
}
