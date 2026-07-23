/**
 * Per-user transcode session registry (in-process).
 * Limits concurrent Plex transcode sessions to avoid hammering the server.
 */

const MAX_SESSIONS_PER_USER = 3;

type SessionRegistry = Map<string, Set<string>>;
function getRegistry(): SessionRegistry {
  const g = globalThis as unknown as { __movvizTranscodeSessions?: SessionRegistry };
  if (!g.__movvizTranscodeSessions) g.__movvizTranscodeSessions = new Map();
  return g.__movvizTranscodeSessions;
}

/** Returns true if the (user, ratingKey) session can be registered. */
export function registerSession(userId: string, ratingKey: string): boolean {
  const reg = getRegistry();
  let set = reg.get(userId);
  if (!set) {
    set = new Set();
    reg.set(userId, set);
  }
  if (!set.has(ratingKey)) {
    if (set.size >= MAX_SESSIONS_PER_USER) return false;
    set.add(ratingKey);
  }
  return true;
}

/** Remove a (user, ratingKey) session from the registry. */
export function unregisterSession(userId: string, ratingKey: string): void {
  const reg = getRegistry();
  const set = reg.get(userId);
  if (!set) return;
  set.delete(ratingKey);
  if (set.size === 0) reg.delete(userId);
}

export const MAX_TRANSCODE_SESSIONS = MAX_SESSIONS_PER_USER;