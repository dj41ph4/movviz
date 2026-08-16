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