export type RequestStatus = "pending" | "approved" | "declined";

export interface MediaRequest {
  id: string;
  userId: string;
  username: string; // snapshot, survives the user being renamed/removed later
  type: "movie" | "series";
  tmdbId: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  overview: string;
  rating: number;
  status: RequestStatus;
  createdAt: number;
  decidedAt: number | null;
  decidedBy: string | null; // admin username
}
