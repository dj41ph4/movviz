import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";

/**
 * Proactive nudge trigger (demande explicite user) — "quand l'utilisateur
 * revient sur Movviz après un moment, l'IA peut lancer spontanément une
 * question sur le cinéma". Deliberately NOT built on the existing
 * priority/userActivity.ts (that system is global/process-wide and only
 * tracks "is anyone active right now" for background-loop throttling — it
 * has no per-user history and would misfire in a multi-compte household).
 * This is its own tiny, strictly per-user, persisted store, following the
 * exact same restraint as everything else in AI.MD: no polling loop, no
 * daemon — it's only ever checked synchronously inside a real request the
 * client already makes (GET /api/ai/session, which SWR re-fires on window
 * focus by default — i.e. exactly "the user came back to the tab").
 */
const CONFIG_DIR = process.env.MOVVIZ_CONFIG_DIR ?? process.env.MOVVIZ_DATA_DIR ?? path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "ai-presence.json");

// A tab re-focus alone isn't "coming back" — only a REAL gap counts, so
// switching tabs for a few seconds never triggers this.
const RETURN_GAP_MS = 15 * 60 * 1000;
// Never more than one spontaneous nudge in this window, however many times
// the user comes and goes — a chatty assistant that pings every return
// would get old fast (and contradicts "never a permanent daemon").
const COOLDOWN_MS = 4 * 60 * 60 * 1000;

interface AiPresenceEntry {
  lastSeenAt: number;
  lastProactiveAt: number;
}

type AiPresenceStore = Record<string, AiPresenceEntry>;

function read(): AiPresenceStore {
  const raw = readJsonCached<AiPresenceStore | null>(FILE, null);
  return raw && typeof raw === "object" ? raw : {};
}

/**
 * Always updates "last seen" for this user; returns true the moment a
 * proactive nudge should fire (real return-gap elapsed AND cooldown
 * elapsed). Side-effecting on purpose — this is meant to be called exactly
 * once per real session check, not probed speculatively.
 */
export function checkProactivePulse(userId: string): boolean {
  const store = read();
  const now = Date.now();
  const entry = store[userId];
  const shouldFire = !!entry
    && now - entry.lastSeenAt >= RETURN_GAP_MS
    && now - entry.lastProactiveAt >= COOLDOWN_MS;
  store[userId] = { lastSeenAt: now, lastProactiveAt: shouldFire ? now : (entry?.lastProactiveAt ?? 0) };
  writeJsonCached(FILE, store);
  return shouldFire;
}
