/**
 * Per-user transcode session registry (in-process).
 * Limits concurrent Plex transcode sessions to avoid hammering the server.
 * Sessions auto-expire after 5 minutes of inactivity.
 */

const MAX_SESSIONS_PER_USER = 5;
const SESSION_TTL_MS = 5 * 60 * 1000;

interface SessionEntry { ratingKey: string; lastUsed: number }

type SessionRegistry = Map<string, SessionEntry[]>;
function getRegistry(): SessionRegistry {
  const g = globalThis as unknown as { __movvizTranscodeSessions?: SessionRegistry };
  if (!g.__movvizTranscodeSessions) g.__movvizTranscodeSessions = new Map();
  return g.__movvizTranscodeSessions;
}

function pruneExpired(entries: SessionEntry[]): SessionEntry[] {
  const now = Date.now();
  return entries.filter((e) => now - e.lastUsed < SESSION_TTL_MS);
}

export function registerSession(userId: string, ratingKey: string): boolean {
  const reg = getRegistry();
  let entries = reg.get(userId) ?? [];
  entries = pruneExpired(entries);

  const existing = entries.find((e) => e.ratingKey === ratingKey);
  if (existing) {
    existing.lastUsed = Date.now();
    reg.set(userId, entries);
    return true;
  }

  if (entries.length >= MAX_SESSIONS_PER_USER) return false;

  entries.push({ ratingKey, lastUsed: Date.now() });
  reg.set(userId, entries);
  return true;
}

export function unregisterSession(userId: string, ratingKey: string): void {
  const reg = getRegistry();
  const entries = reg.get(userId);
  if (!entries) return;
  const filtered = entries.filter((e) => e.ratingKey !== ratingKey);
  if (filtered.length === 0) reg.delete(userId);
  else reg.set(userId, filtered);
}

export const MAX_TRANSCODE_SESSIONS = MAX_SESSIONS_PER_USER;
