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
 */
export type VersionGrabMode = "replace" | "add";

const g = globalThis as typeof globalThis & { __movvizPendingVersionIntent?: Map<string, VersionGrabMode> };
const pending = (g.__movvizPendingVersionIntent ??= new Map<string, VersionGrabMode>());

/** `mode` is the user's explicit replace-vs-add choice (LOT6.10) made at confirmation time. */
export function markPendingVersionIntent(infoHash: string, mode: VersionGrabMode) {
  pending.set(infoHash, mode);
}

/** Reads AND clears — a one-shot check, consumed exactly once by the import callback. Returns null if this infoHash has no pending additional-version intent (the normal case). */
export function takePendingVersionIntent(infoHash: string | undefined): VersionGrabMode | null {
  if (!infoHash) return null;
  const mode = pending.get(infoHash) ?? null;
  pending.delete(infoHash);
  return mode;
}
