/**
 * Bridges `additional_version` grabs (LOT6.2) across the async gap between
 * "we submitted this release to the engine" and "the engine calls back
 * `/api/library/import` once it's renamed/moved" — the only place that
 * knows the user's intent is the grab call, but the only place that knows
 * the final file (resolution/codec/size) is the import callback. Keyed by
 * infoHash since that's the one identifier both sides share.
 *
 * Deliberately NOT persisted to disk — a pending entry only matters for the
 * few minutes between grab and import completion; if the app restarts
 * mid-download the worst case is the import callback falls back to the
 * normal replace-primary behavior instead of adding a version, which is a
 * safe (non-destructive) default either way.
 *
 * TTL-bounded on top of that: if the "add version" download this was set
 * for stalls, gets blocked, or is cancelled before import ever fires, the
 * entry used to sit here forever — nothing ever cleared it. A totally
 * unrelated LATER grab (an ordinary auto/manual search) picking the exact
 * same release (same infoHash, which happens constantly — repeated
 * searches for the same movie routinely land on the same best-scored
 * release) would then silently inherit that stale "add" intent and add a
 * duplicate version instead of replacing, with no "add version" action
 * ever having been taken this time. MAX_AGE_MS bounds that staleness
 * window to comfortably longer than any real download, so an abandoned
 * intent expires instead of lingering indefinitely.
 */
export type VersionGrabMode = "replace" | "add";

const MAX_AGE_MS = 6 * 60 * 60 * 1000;

interface PendingEntry {
  mode: VersionGrabMode;
  setAt: number;
}

const g = globalThis as typeof globalThis & { __movvizPendingVersionIntent?: Map<string, PendingEntry> };
const pending = (g.__movvizPendingVersionIntent ??= new Map<string, PendingEntry>());

/** `mode` is the user's explicit replace-vs-add choice (LOT6.10) made at confirmation time. */
export function markPendingVersionIntent(infoHash: string, mode: VersionGrabMode) {
  pending.set(infoHash, { mode, setAt: Date.now() });
}

/** Reads AND clears — a one-shot check, consumed exactly once by the import callback. Returns null if this infoHash has no pending (and still fresh) additional-version intent — the normal case, and also the outcome for a stale/expired entry. */
export function takePendingVersionIntent(infoHash: string | undefined): VersionGrabMode | null {
  if (!infoHash) return null;
  const entry = pending.get(infoHash);
  pending.delete(infoHash);
  if (!entry) return null;
  if (Date.now() - entry.setAt > MAX_AGE_MS) return null;
  return entry.mode;
}
