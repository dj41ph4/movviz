export interface FieldMutation<T> {
  value: T;
  occurredAt: number;
  source: string;
  eventId: string;
}

export interface FieldState<T> {
  value: T;
  updatedAt: number | null;
  source: string | null;
  eventId?: string | null;
}

export type ReconcileResult<T> =
  | { applied: true; state: FieldState<T> }
  | { applied: false; state: FieldState<T>; reason: "stale" | "duplicate" };

/** Field-level Last Write Wins. Source never wins; eventId only resolves an
 * exact timestamp collision so replicas converge deterministically. */
export function reconcileField<T>(current: FieldState<T>, incoming: FieldMutation<T>): ReconcileResult<T> {
  if (current.updatedAt == null || incoming.occurredAt > current.updatedAt) {
    return { applied: true, state: { value: incoming.value, updatedAt: incoming.occurredAt, source: incoming.source, eventId: incoming.eventId } };
  }
  if (incoming.occurredAt < current.updatedAt) return { applied: false, state: current, reason: "stale" };
  if (Object.is(incoming.value, current.value)) return { applied: false, state: current, reason: "duplicate" };
  if ((incoming.eventId ?? "") > (current.eventId ?? "")) {
    return { applied: true, state: { value: incoming.value, updatedAt: incoming.occurredAt, source: incoming.source, eventId: incoming.eventId } };
  }
  return { applied: false, state: current, reason: "stale" };
}

export function mediaStateKey(userId: string, mediaType: "movie" | "series" | "episode", tmdbId: number, seasonNumber?: number | null, episodeNumber?: number | null): string {
  return mediaType === "episode"
    ? `${userId}:episode:${tmdbId}:${seasonNumber ?? -1}:${episodeNumber ?? -1}`
    : `${userId}:${mediaType}:${tmdbId}`;
}
