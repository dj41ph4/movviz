export interface SeerrConfig {
  baseUrl: string;
  apiKey: string;
}

export interface SeerrUser {
  id: number;
  email: string | null;
  username: string | null;
  displayName: string | null;
  plexUsername: string | null;
  plexId: string | null;
}

export type SeerrMediaStatus = 1 | 2 | 3 | 4 | 5; // unknown/pending/processing/partially_available/available
export type SeerrRequestStatus = 1 | 2 | 3; // pending/approved/declined

export interface SeerrRequest {
  id: number;
  status: SeerrRequestStatus;
  createdAt: string;
  requestedBy: SeerrUser;
  media: {
    id: number;
    tmdbId: number;
    mediaType: "movie" | "tv";
    status: SeerrMediaStatus;
    /** Specific seasons requested, e.g. [1, 3, 5]; undefined = all seasons. */
    seasons?: number[];
  };
}
