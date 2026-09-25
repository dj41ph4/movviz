import fs from "node:fs";
import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import { AI_PROVIDERS, DEFAULT_AI_CONFIG, type AiChatSession, type AiConfig, type AiProviderId, type AiRecommendation } from "./types";

const CONFIG_DIR = process.env.MOVVIZ_CONFIG_DIR ?? process.env.MOVVIZ_DATA_DIR ?? path.join(process.cwd(), ".movviz-data");
export const AI_CONFIG_FILE = path.join(CONFIG_DIR, "ai.json");
const SESSIONS_FILE = path.join(CONFIG_DIR, "ai-sessions.json");

/** Reads a stored config onto the defaults. Configs written before the
 *  provider cleanup still carry priority/fallback and other providers'
 *  entries: they are ignored (and dropped on next save). */
function deepMerge(base: AiConfig, patch: unknown): AiConfig {
  const p = (patch ?? {}) as Partial<AiConfig>;
  const provider = (id: AiProviderId) => ({
    model: p.providers?.[id]?.model ?? base.providers[id].model,
    keys: p.providers?.[id]?.keys ?? base.providers[id].keys,
  });
  return {
    enabled: p.enabled ?? base.enabled,
    primary: p.primary && AI_PROVIDERS.includes(p.primary) ? p.primary : base.primary,
    providers: { gemini: provider("gemini") },
    webSearchEnabled: p.webSearchEnabled ?? base.webSearchEnabled,
    voiceInputEnabled: p.voiceInputEnabled ?? base.voiceInputEnabled,
    voiceOutputEnabled: p.voiceOutputEnabled ?? base.voiceOutputEnabled,
    webSearchKey: typeof p.webSearchKey === "string" && p.webSearchKey.trim() ? p.webSearchKey.trim() : undefined,
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

const gActivity = globalThis as typeof globalThis & { __movvizAiChatActivity?: Map<string, number> };
const chatActivity: Map<string, number> = (gActivity.__movvizAiChatActivity ??= new Map());

/** A question from this user is being answered (or was, moments ago). */
export function markChatActive(userId: string): void {
  chatActivity.set(userId, Date.now());
}

/** The proactive nudge stays out of an active conversation: it used to be
 *  appended while a question was being answered, so the model then received
 *  a conversation ending with ITS OWN message (Gemini 3 refuses that:
 *  « Requests ending with a model turn are not supported »). */
export function isChatActive(userId: string, withinMs = 120_000): boolean {
  return Date.now() - (chatActivity.get(userId) ?? 0) < withinMs;
}

/** Drops the user's last message when it got no answer (the model call
 *  failed): otherwise it stayed in the history as an orphan question — shown
 *  again on every reload, and fed to the model as if it had been answered. */
export function dropUnansweredUserMessage(userId: string, content: string): void {
  const session = loadAiSession(userId);
  const last = session.messages[session.messages.length - 1];
  if (last?.role !== "user" || last.content !== content) return;
  session.messages.pop();
  session.updatedAt = Date.now();
  scheduleSessionsFlush();
}

/** « Déjà vu » / « Pas pour moi » on a card: the card leaves its message
 *  for good (a reload must not bring it back) and the next best-ranked
 *  alternate takes its place. Returns that replacement, or null when the
 *  message has none left (the card is then simply removed). */
export function replaceRecommendationCard(userId: string, type: "movie" | "series", tmdbId: number): AiRecommendation | null {
  const session = loadAiSession(userId);
  for (let i = session.messages.length - 1; i >= 0; i--) {
    const message = session.messages[i];
    const index = message.recommendations?.findIndex((r) => r.type === type && r.tmdbId === tmdbId) ?? -1;
    if (index < 0) continue;
    const replacement = message.alternates?.shift() ?? null;
    if (replacement) message.recommendations!.splice(index, 1, replacement);
    else message.recommendations!.splice(index, 1);
    session.updatedAt = Date.now();
    scheduleSessionsFlush();
    return replacement;
  }
  return null;
}

/** Enregistre le titre qui vient d'être réellement résolu comme sujet actif
 *  de la conversation (voir AiChatSession.activeSubject). Appelé UNIQUEMENT
 *  après une vraie résolution TMDb/bibliothèque — jamais sur une supposition,
 *  sinon le sujet actif deviendrait lui-même une source d'erreur. */
export function setActiveSubject(userId: string, subject: { tmdbId: number; type: "movie" | "series"; title: string }): void {
  const session = loadAiSession(userId);
  session.activeSubject = { ...subject, at: Date.now() };
  scheduleSessionsFlush();
}

export function setDialogueState(userId: string, dialogueState: NonNullable<AiChatSession["dialogueState"]>): void {
  const session = loadAiSession(userId);
  session.dialogueState = dialogueState;
  session.updatedAt = Date.now();
  scheduleSessionsFlush();
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
