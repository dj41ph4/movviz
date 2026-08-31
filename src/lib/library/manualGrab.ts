/**
 * Marks a grab as USER-INITIATED (manual) so the post-import blocklist check
 * (checkPostImportBlockedWord in applyImportedFiles.ts) does not apply to it.
 *
 * Rationale: the pre-grab decision guard (decisionGuard.ts) filters automatic
 * grabs against the user's forbidden words, and the post-import check is the
 * second layer that catches releases whose REAL torrent name smuggles a
 * blocked term past that filter (indexer-advertised title vs actual torrent
 * name). But a manual grab is the user explicitly picking THIS release —
 * they saw the name (e.g. "VOSTFR") and chose it anyway. Quarantining it at
 * import time (file deleted + library reverted to "missing") turns a
 * deliberate choice into a silent data loss. So manual grabs are exempted:
 * they still get renamed/moved into the library exactly like any other
 * import, blocklist rules simply don't veto them.
 *
 * Same shape as pendingVersionIntent.ts — in-memory only, keyed by the
 * engine-resolved infoHash (the one identifier both the grab response and
 * the import callback share), lowercase-normalized, TTL-bounded so a
 * stalled/cancelled download never leaves a stale entry that a later
 * unrelated grab of the same release could inherit.
 */
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

interface ManualEntry {
  setAt: number;
}

const g = globalThis as typeof globalThis & { __movvizManualGrabs?: Map<string, ManualEntry> };
const manual = (g.__movvizManualGrabs ??= new Map<string, ManualEntry>());

/** Called right after the engine accepts a manual grab and resolves its infoHash. */
export function markManualGrab(infoHash: string) {
  manual.set(infoHash.toLowerCase(), { setAt: Date.now() });
}

/** Reads AND clears — one-shot, consumed by the import callback. False for automatic grabs and for stale entries. */
export function takeManualGrab(infoHash: string | undefined): boolean {
  if (!infoHash) return false;
  const key = infoHash.toLowerCase();
  const entry = manual.get(key);
  manual.delete(key);
  if (!entry) return false;
  if (Date.now() - entry.setAt > MAX_AGE_MS) return false;
  return true;
}