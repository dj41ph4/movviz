import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import type { AiFactEntry, AiFeedbackEntry, AiProfileStore, AiUserProfile } from "./types";

/**
 * Foundation of the AI v2 taste engine (AI.MD §2.A/§2.G): a strictly
 * per-user, append-only log of 👍/👎 reactions to recommendation cards,
 * persisted to ai-user-profiles.json. This brick only captures and surfaces
 * the raw signal — turning it into weighted traits (contrastive learning,
 * confidence/evolution) is a later brick, deliberately not done here.
 *
 * Same storage pattern as ai-memory.json (readJsonCached/writeJsonCached,
 * bounded list, dedupe by tmdbId+type keeping the most recent vote) — a
 * user changing their mind on a title overwrites the old vote rather than
 * accumulating contradictory entries.
 */
const CONFIG_DIR = process.env.MOVVIZ_CONFIG_DIR ?? process.env.MOVVIZ_DATA_DIR ?? path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "ai-user-profiles.json");

const MAX_FEEDBACK_ENTRIES = 200;
const MAX_FACT_ENTRIES = 30;

function read(): AiProfileStore {
  const raw = readJsonCached<AiProfileStore | null>(FILE, null);
  if (!raw || typeof raw !== "object") return {};
  return raw;
}

function write(store: AiProfileStore): void {
  writeJsonCached(FILE, store);
}

function profileForUser(store: AiProfileStore, userId: string): AiUserProfile {
  const existing = store[userId];
  // facts is newer than feedback — old on-disk profiles may predate it.
  return { feedback: existing?.feedback ?? [], facts: existing?.facts ?? [] };
}

export function recordFeedback(userId: string, entry: AiFeedbackEntry): void {
  const store = read();
  const profile = profileForUser(store, userId);
  const deduped = profile.feedback.filter((e) => !(e.tmdbId === entry.tmdbId && e.type === entry.type));
  deduped.push(entry);
  store[userId] = { ...profile, feedback: deduped.slice(-MAX_FEEDBACK_ENTRIES) };
  write(store);
}

export function getFeedback(userId: string): AiFeedbackEntry[] {
  return profileForUser(read(), userId).feedback;
}

// A first name is a single fixed value, not a growing list — if the user
// gives a new one, that REPLACES the old one (a correction, a name change,
// or the same person clarifying) rather than piling up two contradictory
// "Prénom : X" facts that would both get fed into the prompt at once.
const NAME_FACT_RE = /pr[ée]nom/i;

/** Stores a freeform fact the model extracted from conversation (see
 *  intentParser.extractFacts) — deduped case-insensitively so a repeated
 *  "I'm called Alex" doesn't pile up, bounded so the prompt this feeds back
 *  into never grows unbounded. */
export function rememberFact(userId: string, fact: string): void {
  const store = read();
  const profile = profileForUser(store, userId);
  let deduped = profile.facts.filter((f) => f.fact.toLowerCase() !== fact.toLowerCase());
  if (NAME_FACT_RE.test(fact)) deduped = deduped.filter((f) => !NAME_FACT_RE.test(f.fact));
  deduped.push({ fact, at: Date.now() });
  store[userId] = { ...profile, facts: deduped.slice(-MAX_FACT_ENTRIES) };
  write(store);
}

export function getFacts(userId: string): AiFactEntry[] {
  return profileForUser(read(), userId).facts;
}

/** Whether the user's first name is already known — checked loosely (any
 *  stored fact mentioning "prénom", not just the exact "Prénom : X" format
 *  extractSelfIntroName writes) since an LLM-tagged fact could phrase it
 *  differently. Used to decide whether the prompt should nudge the model
 *  to actually ask for it, rather than leaving that to chance. */
export function hasKnownName(userId: string): boolean {
  return getFacts(userId).some((f) => /pr[ée]nom/i.test(f.fact));
}

/** Compact context for the system prompt — read-and-consolidate only, never
 *  a trigger for background work (AI.MD closing note). */
export function buildFactsContext(userId: string): string {
  const facts = getFacts(userId);
  if (!facts.length) return "";
  return `\n\nFAITS RETENUS SUR CET UTILISATEUR (dits en conversation, à travers les sessions) — ${facts.map((f) => f.fact).join(" ; ")}. Utilise-les naturellement quand c'est pertinent (ex. l'appeler par son prénom s'il en a donné un), jamais comme une liste récitée.`;
}

/** Compact human-readable feedback summary for the system prompt — the
 *  assistant should already know what landed and what missed, even before
 *  the contrastive-learning brick turns this into weighted traits. Empty
 *  when the user hasn't voted on anything yet (no prompt bloat). */
export function buildFeedbackContext(userId: string): string {
  const feedback = getFeedback(userId);
  if (!feedback.length) return "";
  const liked = feedback.filter((e) => e.liked).slice(-8);
  const disliked = feedback.filter((e) => !e.liked).slice(-8);
  const fmt = (list: AiFeedbackEntry[]) => list.map((e) => (e.reason ? `${e.title} (${e.reason})` : e.title)).join(", ");
  const parts: string[] = [];
  if (liked.length) parts.push(`recommandations appréciées : ${fmt(liked)}`);
  if (disliked.length) parts.push(`recommandations rejetées : ${fmt(disliked)}`);
  return `\n\nRETOURS SUR RECOMMANDATIONS PASSÉES (👍/👎 de cet utilisateur) — ${parts.join(" ; ")}. N'insiste jamais sur un titre déjà rejeté ni sur un axe de recommandation explicitement écarté ; les titres appréciés indiquent le TYPE de lien à rechercher (mécanique d'humour, tension, ton), pas juste le genre.`;
}
