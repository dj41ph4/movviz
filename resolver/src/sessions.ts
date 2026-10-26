import { randomUUID } from "node:crypto";
import { closeSession, createSession, type ResolverSession } from "./browser.js";

type Proxy = { server: string; username?: string; password?: string };
type NamedSession = { browser: ResolverSession; lastUsedAt: number };

const sessions = new Map<string, NamedSession>();
const queues = new Map<string, Promise<void>>();
const MAX_SESSIONS = 10;
const SESSION_TTL_MS = 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let cleanupTimer: ReturnType<typeof setInterval> | undefined;

// Serialize creation, navigation and destruction for the same browser page.
async function withSessionLock<T>(id: string, task: () => Promise<T>): Promise<T> {
  const previous = queues.get(id) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  queues.set(id, current);
  await previous;
  try {
    return await task();
  } finally {
    release();
    if (queues.get(id) === current) queues.delete(id);
  }
}

function startCleanup(): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => { void cleanupExpired(); }, CLEANUP_INTERVAL_MS);
  cleanupTimer.unref?.();
}

function stopCleanupIfIdle(): void {
  if (sessions.size || !cleanupTimer) return;
  clearInterval(cleanupTimer);
  cleanupTimer = undefined;
}

async function createUnlocked(id: string, proxy?: Proxy): Promise<void> {
  if (sessions.has(id)) return;
  if (sessions.size >= MAX_SESSIONS) throw new Error("Session limit reached");
  const browser = await createSession(proxy);
  sessions.set(id, { browser, lastUsedAt: Date.now() });
  startCleanup();
}

export async function createNamedSession(id: string = randomUUID(), proxy?: Proxy): Promise<string> {
  if (!id.trim()) throw new Error("Session ID must not be empty");
  await withSessionLock(id, () => createUnlocked(id, proxy));
  return id;
}

export async function destroyNamedSession(id: string): Promise<boolean> {
  return withSessionLock(id, async () => {
    const entry = sessions.get(id);
    if (!entry) return false;
    sessions.delete(id);
    await closeSession(entry.browser);
    stopCleanupIfIdle();
    return true;
  });
}

export async function useNamedSession<T>(id: string, task: (browser: ResolverSession) => Promise<T>): Promise<T> {
  if (!id.trim()) throw new Error("Session ID must not be empty");
  return withSessionLock(id, async () => {
    // FlareSolverr creates an absent named session on request.get.
    await createUnlocked(id);
    const entry = sessions.get(id)!;
    entry.lastUsedAt = Date.now();
    try {
      return await task(entry.browser);
    } finally {
      entry.lastUsedAt = Date.now();
    }
  });
}

export async function cleanupExpired(): Promise<void> {
  const now = Date.now();
  await Promise.all([...sessions.keys()].map((id) => withSessionLock(id, async () => {
    const entry = sessions.get(id);
    if (!entry || now - entry.lastUsedAt < SESSION_TTL_MS) return;
    sessions.delete(id);
    await closeSession(entry.browser);
  })));
  stopCleanupIfIdle();
}

export async function destroyAllSessions(): Promise<void> {
  if (cleanupTimer) clearInterval(cleanupTimer);
  cleanupTimer = undefined;
  await Promise.all([...sessions.keys()].map((id) => destroyNamedSession(id)));
}
