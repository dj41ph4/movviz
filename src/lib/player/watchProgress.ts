/**
 * Shared "resume position" storage — the Beta player saves playback progress
 * to localStorage keyed by Plex ratingKey (see VideoPlayer.tsx's own
 * saveProgress()). This module is the single place that key format and the
 * "is it worth offering a resume" threshold live, so a second call site
 * (the title page's resume button) can read the exact same value without
 * duplicating the format or drifting out of sync with it.
 */

export const PROGRESS_STORAGE_KEY = (ratingKey: string) => `movviz:progress:${ratingKey}`;

/** Below this, resuming isn't meaningful — matches VideoPlayer's own guard before showing its resume-vs-restart dialog. */
const MIN_RESUME_SECONDS = 5;

/** Saved position in seconds for this ratingKey, or null when there's nothing worth resuming (never played, finished, or below the threshold). Client-only — always null during SSR. */
export function getSavedProgressSeconds(ratingKey: string | null | undefined): number | null {
  if (!ratingKey || typeof window === "undefined") return null;
  const saved = Number(localStorage.getItem(PROGRESS_STORAGE_KEY(ratingKey)));
  return Number.isFinite(saved) && saved > MIN_RESUME_SECONDS ? saved : null;
}

export function formatResumeTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
