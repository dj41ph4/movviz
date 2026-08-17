import fs from "node:fs";
import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import { DEFAULT_AI_CONFIG, type AiChatSession, type AiConfig } from "./types";

const CONFIG_DIR = process.env.MOVVIZ_CONFIG_DIR ?? process.env.MOVVIZ_DATA_DIR ?? path.join(process.cwd(), ".movviz-data");
export const AI_CONFIG_FILE = path.join(CONFIG_DIR, "ai.json");
const SESSIONS_FILE = path.join(CONFIG_DIR, "ai-sessions.json");

function deepMerge(base: AiConfig, patch: unknown): AiConfig {
  const p = (patch ?? {}) as Partial<AiConfig>;
  return {
    enabled: p.enabled ?? base.enabled,
    primary: (p.primary as AiConfig["primary"]) ?? base.primary,
    fallback: p.fallback ?? base.fallback,
    webSearchEnabled: p.webSearchEnabled ?? base.webSearchEnabled,
    providers: {
      mistral: { model: p.providers?.mistral?.model ?? base.providers.mistral.model, keys: p.providers?.mistral?.keys ?? base.providers.mistral.keys },
      openrouter: { model: p.providers?.openrouter?.model ?? base.providers.openrouter.model, keys: p.providers?.openrouter?.keys ?? base.providers.openrouter.keys },
      gemini: { model: p.providers?.gemini?.model ?? base.providers.gemini.model, keys: p.providers?.gemini?.keys ?? base.providers.gemini.keys },
    },
  };
}

export function loadAiConfig(): AiConfig {
  const raw = readJsonCached<unknown>(AI_CONFIG_FILE, null);
  if (!raw || typeof raw !== "object") return DEFAULT_AI_CONFIG;
  return deepMerge(DEFAULT_AI_CONFIG, raw);
}

export function saveAiConfig(config: AiConfig): AiConfig {
  const next = deepMerge(DEFAULT_AI_CONFIG, config);
  writeJsonCached(AI_CONFIG_FILE, next);
  return next;
}

/** Session memory lives in-process (globalThis — Next bundles routes
 *  separately) for fast reads/writes on every chat message, mirrored to
 *  disk with the same bounded ring-buffer + debounced-flush pattern as
 *  ai-debug-log.json (never a synchronous write on the chat request path).
 *  Confirmed live: a server restart was wiping every conversation even
 *  though the user never touched the trash icon — only an explicit
 *  clearAiSession() should ever empty a session now. */
const MAX_SESSION_MESSAGES = 40;
const WRITE_COALESCE_MS = 5000;

const g = globalThis as typeof globalThis & {
  __movvizAiChats?: Map<string, AiChatSession>;
  __movvizAiChatsTimer?: ReturnType<typeof setTimeout> | null;
};

function loadSessionsFromDisk(): Map<string, AiChatSession> {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const raw = JSON.parse(fs.readFileSync(SESSIONS_FILE, "utf8")) as Record<string, AiChatSession>;
      return new Map(Object.entries(raw));
    }
  } catch {
    // corrupt or missing file — start fresh, never crash the app over chat history
  }
  return new Map();
}

const sessions = (g.__movvizAiChats ??= loadSessionsFromDisk());

function flushSessionsToDisk() {
  try {
    const dir = path.dirname(SESSIONS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const obj = Object.fromEntries(sessions);
    const tmp = `${SESSIONS_FILE}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(obj), "utf8");
    fs.renameSync(tmp, SESSIONS_FILE);
  } catch (err) {
    console.error("[ai store] failed to persist sessions:", err);
  }
}

function scheduleSessionsFlush() {
  if (g.__movvizAiChatsTimer) clearTimeout(g.__movvizAiChatsTimer);
  g.__movvizAiChatsTimer = setTimeout(() => {
    g.__movvizAiChatsTimer = null;
    flushSessionsToDisk();
  }, WRITE_COALESCE_MS);
}

export function loadAiSession(userId: string): AiChatSession {
  const existing = sessions.get(userId);
  if (existing) return existing;
  const fresh: AiChatSession = { messages: [], updatedAt: Date.now() };
  sessions.set(userId, fresh);
  return fresh;
}

export function pushAiMessage(userId: string, message: AiChatSession["messages"][number]): AiChatSession {
  const session = loadAiSession(userId);
  session.messages.push(message);
  if (session.messages.length > MAX_SESSION_MESSAGES) {
    session.messages.splice(0, session.messages.length - MAX_SESSION_MESSAGES);
  }
  session.updatedAt = Date.now();
  scheduleSessionsFlush();
  return session;
}

/** The only thing that should ever empty a session — the trash icon in the
 *  chat UI. Flushed immediately (not debounced): this is a rare, explicit
 *  user action, not a hot request-path write, and a restart landing inside
 *  the normal 5s debounce window must never resurrect a chat the user just
 *  deleted. */
export function clearAiSession(userId: string): void {
  sessions.delete(userId);
  flushSessionsToDisk();
}