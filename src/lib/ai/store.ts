import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import { DEFAULT_AI_CONFIG, type AiChatSession, type AiConfig } from "./types";

const CONFIG_DIR = process.env.MOVVIZ_CONFIG_DIR ?? process.env.MOVVIZ_DATA_DIR ?? path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "ai.json");

function deepMerge(base: AiConfig, patch: unknown): AiConfig {
  const p = (patch ?? {}) as Partial<AiConfig>;
  return {
    enabled: p.enabled ?? base.enabled,
    primary: (p.primary as AiConfig["primary"]) ?? base.primary,
    fallback: p.fallback ?? base.fallback,
    providers: {
      mistral: { model: p.providers?.mistral?.model ?? base.providers.mistral.model, keys: p.providers?.mistral?.keys ?? base.providers.mistral.keys },
      openrouter: { model: p.providers?.openrouter?.model ?? base.providers.openrouter.model, keys: p.providers?.openrouter?.keys ?? base.providers.openrouter.keys },
      gemini: { model: p.providers?.gemini?.model ?? base.providers.gemini.model, keys: p.providers?.gemini?.keys ?? base.providers.gemini.keys },
    },
  };
}

export function loadAiConfig(): AiConfig {
  const raw = readJsonCached<unknown>(FILE, null);
  if (!raw || typeof raw !== "object") return DEFAULT_AI_CONFIG;
  return deepMerge(DEFAULT_AI_CONFIG, raw);
}

export function saveAiConfig(config: AiConfig): AiConfig {
  const next = deepMerge(DEFAULT_AI_CONFIG, config);
  writeJsonCached(FILE, next);
  return next;
}

/** Session memory lives in-process (globalThis — Next bundles routes
 *  separately) and is intentionally volatile: chat history surviving an app
 *  restart is nice-to-have, not required, and this keeps the AI features
 *  from ever growing a persistent store of user chatter. */
const MAX_SESSION_MESSAGES = 40;

const g = globalThis as typeof globalThis & { __movvizAiChats?: Map<string, AiChatSession> };
const sessions = (g.__movvizAiChats ??= new Map<string, AiChatSession>());

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
  return session;
}

export function clearAiSession(userId: string): void {
  sessions.delete(userId);
}