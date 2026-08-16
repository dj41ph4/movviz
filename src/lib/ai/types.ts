export type AiProviderId = "mistral" | "openrouter" | "gemini";

export interface AiProviderKey {
  id: string;
  key: string;
}

export interface AiProviderConfig {
  model: string;
  keys: AiProviderKey[];
}

export interface AiConfig {
  enabled: boolean;
  /** First provider tried on every request. */
  primary: AiProviderId;
  /** When true (and enabled), a provider that fails (quota/error) falls back to the next one in order. */
  fallback: boolean;
  providers: Record<AiProviderId, AiProviderConfig>;
}

export const AI_PROVIDER_ORDER: AiProviderId[] = ["mistral", "openrouter", "gemini"];

export const DEFAULT_AI_CONFIG: AiConfig = {
  enabled: false,
  primary: "mistral",
  fallback: true,
  providers: {
    mistral: { model: "mistral-small-latest", keys: [] },
    openrouter: { model: "deepseek/deepseek-chat", keys: [] },
    gemini: { model: "gemini-2.5-flash-lite", keys: [] },
  },
};

export interface AiAddItem {
  title: string;
  year?: number;
  type?: "movie" | "series";
}

export interface AiActionOutcome {
  title: string;
  year?: number;
  type: "movie" | "series";
  status: "added" | "requested" | "already" | "blocked" | "not_found" | "error";
  tmdbId?: number;
  detail?: string;
}

/** A recommendation card resolved against TMDb, rendered in the chat. */
export interface AiRecommendation {
  title: string;
  year?: number;
  type: "movie" | "series";
  tmdbId: number;
  overview: string;
  posterPath: string | null;
  rating: number;
  inLibrary: boolean;
  reason?: string;
}

export interface AiChatMessage {
  role: "user" | "assistant";
  content: string;
  /** Results of the media actions the assistant executed for this message (if any). */
  actions?: AiActionOutcome[];
  /** Resolved recommendation cards (recommend intent). */
  recommendations?: AiRecommendation[];
}

export interface AiChatSession {
  messages: AiChatMessage[];
  updatedAt: number;
}

/** Long-term memory entries — facts about what the user asked the assistant
 *  to add and which recommendations were accepted. One store per user,
 *  persisted to disk (sessions themselves stay volatile). */
export interface AiMemoryEntry {
  tmdbId: number;
  title: string;
  type: "movie" | "series";
  at: number;
}

export interface AiUserMemory {
  /** Titles the user asked the assistant to add (add_media intent). */
  added: AiMemoryEntry[];
  /** Recommendation cards the user actually added to the library. */
  accepted: AiMemoryEntry[];
}

export type AiMemoryStore = Record<string, AiUserMemory>;

/** A user's reaction to a specific recommendation card — the raw signal the
 *  future taste engine (contrastive learning, mood weights) will train on.
 *  Kept as a flat append-only log here: this brick only captures and
 *  surfaces the signal, it does not yet interpret it. */
export interface AiFeedbackEntry {
  tmdbId: number;
  type: "movie" | "series";
  title: string;
  liked: boolean;
  /** The reason the assistant originally gave for this recommendation —
   *  kept alongside the vote so a later pass can learn WHY a title landed
   *  or missed, not just that it did. */
  reason?: string;
  at: number;
}

/** A freeform fact the assistant picked up from conversation (first name,
 *  an explicit stated preference, a constraint) — distinct from the
 *  structured `AiMemoryEntry` events (added/accepted titles). Extracted by
 *  the model itself via an inline marker in its own reply (no extra LLM
 *  call), so this stays free within "no background analysis" (AI.MD). */
export interface AiFactEntry {
  fact: string;
  at: number;
}

export interface AiUserProfile {
  feedback: AiFeedbackEntry[];
  facts: AiFactEntry[];
}

/** Strictly per-user — ai-user-profiles.json, never cross-referenced between
 *  users (AGENTS.md profile separation). */
export type AiProfileStore = Record<string, AiUserProfile>;

/** Hierarchical mood profile for ONE title (AI.MD §2.B/C) — deliberately a
 *  free-form nested map, not a fixed set of ten properties: whatever
 *  categories/traits are actually relevant to a given title (a thriller has
 *  no "humour" category, a parody has no "tension" one). Values are 0..1. */
export type AiMoodCategories = Record<string, Record<string, number>>;

export interface AiMoodProfile {
  tmdbId: number;
  type: "movie" | "series";
  title: string;
  categories: AiMoodCategories;
  analyzedAt: number;
}

/** GLOBAL cache (ai-title-analysis.json) — a title's mood is a fact about
 *  the title, not about any one user, so unlike ai-user-profiles.json this
 *  is intentionally shared across everyone (AI.MD §2.P/§2.U: cache global
 *  Movie → MoodProfile only, never personal data here). Keyed "type:tmdbId". */
export type AiTitleAnalysisStore = Record<string, AiMoodProfile>;