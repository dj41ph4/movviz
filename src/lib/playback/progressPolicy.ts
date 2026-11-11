export const MIN_REAL_PLAYBACK_MS = 60_000;
export const MAX_HEARTBEAT_INTERVAL_MS = 30_000;
/** Without a marker: watched once at most T seconds remain, T = 3 % of the
 *  runtime kept between 30 s and 90 s. */
export const FALLBACK_REMAINING_RATIO = 0.03;
export const FALLBACK_MIN_REMAINING_MS = 30_000;
export const FALLBACK_MAX_REMAINING_MS = 90_000;
/** Share of the content that must really have been played (not sought past). */
export const REAL_WATCH_RATIO = 0.85;
/** A « credits » marker in the first half is an opening sequence, not the end. */
const CREDITS_MIN_START_RATIO = 0.5;
/** Sibling-episode estimate: enough samples, tightly grouped, never a large slice. */
export const ESTIMATE_MIN_SAMPLES = 3;
export const ESTIMATE_MAX_SPREAD_MS = 15_000;
const ESTIMATE_MAX_REMAINING_RATIO = 0.1;

/** Names kept from the Plex-only era: stored in every progress record. */
export type CompletionBoundarySource = "plex_final_credits" | "plex_credits" | "estimated" | "fallback" | "ended" | "explicit";

export function fallbackRemainingMs(durationMs: number): number {
  return Math.min(FALLBACK_MAX_REMAINING_MS, Math.max(FALLBACK_MIN_REMAINING_MS, Math.round(durationMs * FALLBACK_REMAINING_RATIO)));
}

type BoundaryMarker = { type: string; startMs: number; endMs: number; final?: boolean };

/** Last end-credits marker of a media, whatever its source (Plex, IntroDB…). */
function endCredits(durationMs: number, markers: readonly BoundaryMarker[]): { marker: BoundaryMarker; final: boolean } | null {
  const credits = markers
    .filter((m) => m.type === "credits" && Number.isFinite(m.startMs) && Number.isFinite(m.endMs))
    .filter((m) => m.endMs > m.startMs && m.startMs < durationMs && m.startMs >= durationMs * CREDITS_MIN_START_RATIO)
    .sort((a, b) => a.startMs - b.startMs);
  const final = credits.filter((m) => m.final);
  const marker = final.at(-1) ?? credits.at(-1);
  return marker ? { marker, final: final.length > 0 } : null;
}

/** Length (ms) of a sibling's end credits, for the estimate. Its runtime is
 *  not known here, so the last credits marker is taken as is. */
export function endCreditsLengthMs(markers: readonly BoundaryMarker[]): number | null {
  const credits = markers.filter((m) => m.type === "credits" && Number.isFinite(m.startMs) && Number.isFinite(m.endMs) && m.endMs > m.startMs)
    .sort((a, b) => a.startMs - b.startMs);
  const last = credits.filter((m) => m.final).at(-1) ?? credits.at(-1);
  return last ? last.endMs - last.startMs : null;
}

/**
 * Credits length the other episodes of a season agree on, or null when the
 * data is too thin or inconsistent.
 */
export function estimateCreditsLengthMs(samples: readonly number[]): number | null {
  const valid = samples.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (valid.length < ESTIMATE_MIN_SAMPLES) return null;
  if (valid[valid.length - 1] - valid[0] > ESTIMATE_MAX_SPREAD_MS) return null;
  return valid[Math.floor(valid.length / 2)];
}

/**
 * The single position past which a media counts as finished, by priority:
 * its own end-credits marker, then the credits length its sibling episodes
 * agree on, then the runtime-based fallback.
 */
export function completionBoundaryMs(
  durationMs: number,
  markers: readonly BoundaryMarker[],
  mediaType: "movie" | "episode",
  estimatedCreditsLengthMs: number | null = null,
): { boundaryMs: number | null; source: CompletionBoundarySource } {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return { boundaryMs: null, source: "fallback" };
  const cap = Math.max(0, durationMs - 1_000);
  const own = endCredits(durationMs, markers);
  if (own) return { boundaryMs: Math.min(Math.max(0, own.marker.startMs), cap), source: own.final ? "plex_final_credits" : "plex_credits" };
  const fallback = fallbackRemainingMs(durationMs);
  if (mediaType === "episode" && estimatedCreditsLengthMs != null) {
    const remaining = Math.min(estimatedCreditsLengthMs, Math.round(durationMs * ESTIMATE_MAX_REMAINING_RATIO));
    if (remaining > fallback) return { boundaryMs: Math.max(1_000, durationMs - remaining), source: "estimated" };
  }
  return { boundaryMs: Math.max(1_000, durationMs - Math.min(fallback, cap)), source: "fallback" };
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

/** Real playback required before a position-based completion: 85 % of the
 *  content — the whole runtime without a marker, what precedes the credits
 *  with one. */
export function requiredWatchedMs(durationMs: number, boundaryMs: number | null, source: CompletionBoundarySource): number {
  const content = source === "plex_final_credits" || source === "plex_credits" ? (boundaryMs ?? durationMs) : durationMs;
  return Math.max(Math.min(MIN_REAL_PLAYBACK_MS, content), Math.round(content * REAL_WATCH_RATIO));
}

/**
 * Automatic completion: the position passed the boundary AND the content was
 * really played. Jumping into the end zone on the timeline never satisfies it.
 */
export function canComplete(watchedMs: number, positionMs: number, boundaryMs: number | null, durationMs: number, source: CompletionBoundarySource): boolean {
  if (boundaryMs == null || positionMs < boundaryMs) return false;
  return watchedMs >= requiredWatchedMs(durationMs, boundaryMs, source);
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
