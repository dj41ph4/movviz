import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import type { AiMemoryEntry, AiMemoryStore, AiUserMemory } from "./types";

/**
 * Per-user long-term memory, persisted to ai-memory.json in the config dir.
 * Unlike the chat sessions (volatile, in-process), the memory survives
 * restarts: it feeds the assistant a compact "what this user has been doing"
 * profile — titles added through the assistant and recommendation cards
 * that were actually accepted. Kept intentionally small (bounded lists) so
 * the LLM prompt never grows unbounded.
 */
const CONFIG_DIR = process.env.MOVVIZ_CONFIG_DIR ?? process.env.MOVVIZ_DATA_DIR ?? path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "ai-memory.json");

const MAX_ENTRIES = 20;

function read(): AiMemoryStore {
  const raw = readJsonCached<AiMemoryStore | null>(FILE, null);
  if (!raw || typeof raw !== "object") return {};
  return raw;
}

function write(store: AiMemoryStore): void {
  writeJsonCached(FILE, store);
}

function entryForUser(store: AiMemoryStore, userId: string): AiUserMemory {
  return store[userId] ?? { added: [], accepted: [] };
}

function pushBounded(list: AiMemoryEntry[], entry: AiMemoryEntry): AiMemoryEntry[] {
  const deduped = list.filter((e) => !(e.tmdbId === entry.tmdbId && e.type === entry.type));
  deduped.push(entry);
  return deduped.slice(-MAX_ENTRIES);
}

export function rememberAiEntry(userId: string, kind: "added" | "accepted", entry: AiMemoryEntry): void {
  const store = read();
  const user = entryForUser(store, userId);
  const list = kind === "added" ? user.added : user.accepted;
  const next: AiUserMemory = kind === "added"
    ? { ...user, added: pushBounded(list, entry) }
    : { ...user, accepted: pushBounded(list, entry) };
  store[userId] = next;
  write(store);
}

/** Readable long-term memory for the user — feeds the chat's "I remember
 *  you" panel so the assistant's knowledge is visible and grows with usage. */
export function getAiMemory(userId: string): AiUserMemory {
  return entryForUser(read(), userId);
}

/** Compact human-readable memory context for the system prompt. Empty when
 *  the user has no memory yet — no useless prompt bloat (AGENTS.md: minimal
 *  relevant context, never dump the whole library). */
export function buildMemoryContext(userId: string): string {
  const store = read();
  const user = store[userId];
  if (!user || (!user.added.length && !user.accepted.length)) return "";
  const fmt = (list: AiMemoryEntry[]) => list.slice(-8).map((e) => e.title).join(", ");
  const parts: string[] = [];
  if (user.added.length) parts.push(`titres ajoutés via l'assistant : ${fmt(user.added)}`);
  if (user.accepted.length) parts.push(`recommandations acceptées : ${fmt(user.accepted)}`);
  return `\n\nMÉMOIRE (interactions passées de cet utilisateur avec l'assistant) — ${parts.join(" ; ")}. Utilise-la pour affiner tes recommandations et tes réponses : l'utilisateur a déjà manifesté de l'intérêt pour ces titres.`;
}