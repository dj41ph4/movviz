export const MIN_REAL_PLAYBACK_MS = 60_000;
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
    : mediaType === "episode" ? EPISODE_FALLBACK_REMAINING_MS : MOVIE_FALLBACK_REMAINING_MS;
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
