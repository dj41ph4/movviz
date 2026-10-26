export const MIN_REAL_PLAYBACK_MS = 60_000;
export const EPISODE_WATCHED_RATIO = 0.80;
export const MAX_HEARTBEAT_INTERVAL_MS = 30_000;
export const MOVIE_FALLBACK_REMAINING_MS = 5 * 60_000;
export const EPISODE_FALLBACK_REMAINING_MS = 2 * 60_000;
export const SHORT_MEDIA_MIN_REMAINING_MS = 30_000;

export type CompletionBoundarySource = "plex_final_credits" | "plex_credits" | "fallback" | "ended";

export function completionBoundaryMs(
  durationMs: number,
  markers: readonly { type: string; startMs: number; endMs: number; final?: boolean }[],
  mediaType: "movie" | "episode",
): { boundaryMs: number | null; source: CompletionBoundarySource } {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return { boundaryMs: null, source: "fallback" };
  // Episodes become watched at 80%, independently of credit indexing.
  if (mediaType === "episode") return { boundaryMs: Math.ceil(durationMs * EPISODE_WATCHED_RATIO), source: "fallback" };
  const credits = markers
    .filter((m) => m.type === "credits" && Number.isFinite(m.startMs) && Number.isFinite(m.endMs))
    .filter((m) => m.startMs >= 0 && m.endMs > m.startMs && m.startMs < durationMs)
    .sort((a, b) => a.startMs - b.startMs);
  const final = credits.filter((m) => m.final);
  const selected = final.at(-1) ?? credits.at(-1);
  if (selected) {
    return {
      boundaryMs: Math.min(Math.max(0, selected.startMs), Math.max(0, durationMs - 1_000)),
      source: final.length ? "plex_final_credits" : "plex_credits",
    };
  }
  const remaining = durationMs <= 10 * 60_000
    ? Math.max(SHORT_MEDIA_MIN_REMAINING_MS, Math.round(durationMs * 0.1))
    : MOVIE_FALLBACK_REMAINING_MS;
  return { boundaryMs: Math.max(1_000, durationMs - Math.min(remaining, durationMs - 1_000)), source: "fallback" };
}

export function isPlausiblePlaybackAdvance(
  previousPositionMs: number,
  nextPositionMs: number,
  elapsedMs: number,
  playbackRate = 1,
): boolean {
  if (!Number.isFinite(nextPositionMs) || nextPositionMs < 0) return false;
  if (!Number.isFinite(previousPositionMs) || previousPositionMs < 0) return true;
  const delta = nextPositionMs - previousPositionMs;
  if (delta < -2_000) return false;
  const allowed = Math.max(5_000, Math.min(MAX_HEARTBEAT_INTERVAL_MS, Math.max(0, elapsedMs)) * Math.max(0.25, playbackRate) + 3_000);
  return delta <= allowed;
}

export function canComplete(actualPlayedMs: number, positionMs: number, boundaryMs: number | null): boolean {
  return actualPlayedMs >= MIN_REAL_PLAYBACK_MS && boundaryMs != null && positionMs >= boundaryMs;
}

export const NEAR_START_MS = 10_000;

/**
 * A position near the start cannot replace a resume point further in when
 * it does not come from real playback: a session that never played a full
 * minute (closed on the resume prompt, or on an error before the first
 * frame), or a sudden drop from a position already far in (the player lost
 * its stream and reports its empty element at 0).
 */
export function isSpuriousRestartPosition(input: {
  positionMs: number;
  resumeOffsetMs: number | null;
  sessionPlayedMs: number;
  previousSessionPositionMs: number;
}): boolean {
  if (input.resumeOffsetMs == null || input.resumeOffsetMs <= MIN_REAL_PLAYBACK_MS) return false;
  if (input.positionMs >= NEAR_START_MS) return false;
  return input.sessionPlayedMs < MIN_REAL_PLAYBACK_MS || input.previousSessionPositionMs > MIN_REAL_PLAYBACK_MS;
}

/**
 * `ended` from a player whose session never got near the completion
 * boundary is a stream that stopped early (a live ffmpeg pipe closed by a
 * server restart or a proxy), not the end of the film: marking it watched
 * erased the resume point. Heartbeats arrive every 10 s, so a real end is
 * always reported well within this margin of the boundary.
 */
export const ENDED_BOUNDARY_TOLERANCE_MS = 60_000;

export function isCredibleEnd(lastPositionMs: number, boundaryMs: number | null): boolean {
  if (boundaryMs == null || !Number.isFinite(lastPositionMs)) return true;
  return lastPositionMs >= boundaryMs - ENDED_BOUNDARY_TOLERANCE_MS;
}
