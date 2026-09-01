export type UserContextEventType =
  | "playback_started"
  | "playback_resumed"
  | "playback_stopped"
  | "movie_completed"
  | "episode_completed"
  | "watched_marked"
  | "watched_unmarked"
  | "rating_set"
  | "rating_changed"
  | "recommendation_liked"
  | "recommendation_disliked"
  | "recommendation_accepted"
  | "media_requested"
  | "media_added_via_ai"
  | "fact_added"
  | "fact_corrected"
  | "netflix_history_imported"
  // Signal that never had ANY capture point before (browsing behavior) —
  // "understands the user" needs to see what's searched/opened, not just
  // what gets watched. numericValue on search_performed = result count;
  // title_viewed always carries tmdbId/mediaType (the query itself doesn't).
  | "search_performed"
  | "title_viewed";

export type UserContextMediaType = "movie" | "series" | "episode";

export interface UserContextEvent {
  id?: string;
  userId: string;
  eventType: UserContextEventType;
  source: string;
  sourceEventId?: string | null;
  tmdbId?: number | null;
  mediaType?: UserContextMediaType | null;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  mediaId?: string | null;
  ratingKey?: string | null;
  title?: string | null;
  positionMs?: number | null;
  durationMs?: number | null;
  numericValue?: number | null;
  textValue?: string | null;
  occurredAt: number;
  payload?: Record<string, unknown> | null;
}

export interface ContextMediaState {
  stateKey: string;
  userId: string;
  tmdbId: number;
  mediaType: UserContextMediaType;
  mediaId?: string | null;
  ratingKey?: string | null;
  title?: string | null;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  positionMs?: number | null;
  durationMs?: number | null;
  progressRatio?: number | null;
  eligibleForResume: boolean;
  watched: boolean;
  startedAt?: number | null;
  lastPlayedAt?: number | null;
  watchedAt?: number | null;
  updatedAt: number;
  sourceRevision?: number | null;
}

export interface RecentWatchedContextItem {
  tmdbId: number;
  mediaType: "movie" | "series";
  title: string;
  watchedAt: number;
  genres: string[];
}

export interface CurrentWatchingContextItem {
  tmdbId: number;
  mediaType: "movie" | "episode";
  title: string;
  seasonNumber?: number;
  episodeNumber?: number;
  positionMs: number;
  durationMs: number;
  progressRatio: number;
  lastPlayedAt: number | null;
}

export interface SeriesProgressContext {
  tmdbId: number;
  title: string;
  seasonNumber: number | null;
  completedEpisodes: number;
  lastCompleted: { season: number; episode: number } | null;
  current: {
    season: number;
    episode: number;
    positionMs: number;
    durationMs: number;
    progressRatio: number;
    lastPlayedAt: number | null;
  } | null;
  next: { season: number; episode: number; title?: string } | null;
  seasonStats: { season: number; watched: number; total: number | null } | null;
}

export interface UnifiedUserContextSnapshot {
  recentWatched: RecentWatchedContextItem[];
  currentWatching: CurrentWatchingContextItem[];
  seriesProgress: SeriesProgressContext[];
  generatedAt: number;
  storageAvailable: boolean;
}

export interface UserContextHealth {
  database: "ok" | "unavailable" | "error";
  schemaVersion: number;
  file: string;
  lastError: string | null;
}
