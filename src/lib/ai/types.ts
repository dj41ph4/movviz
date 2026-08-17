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
  /** Demande explicite user — recherche web pour les scènes mémorables
   *  (contextBuilder.ts n'utilise jamais ceci ; c'est providers.ts
   *  searchTitleScene). Mistral UNIQUEMENT (seul fournisseur dont l'API
   *  supporte le connecteur web_search côté Movviz aujourd'hui) — quel que
   *  soit le fournisseur PRIMARY, OpenRouter/Gemini n'ont jamais accès au
   *  web. Off par défaut (AGENTS.md : toute future fonctionnalité IA reste
   *  invisible tant qu'elle n'est pas explicitement activée). */
  webSearchEnabled: boolean;
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
  webSearchEnabled: false,
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
  /** The existing library entry's own id (movie/series, distinct from
   *  tmdbId) — only set for status "already". Lets the chat UI offer a
   *  one-click delete of a wrong entry (via the normal admin-only DELETE
   *  route, USER-triggered) instead of leaving a dead-end "already in
   *  library" message when it turns out to be the wrong title. The
   *  assistant itself never deletes anything — this is the human clicking
   *  the button, same as the trash icon anywhere else in Movviz. */
  libraryId?: string;
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
  /** Recommendation distance tier (vague 2) — how close this candidate is
   *  to the reference title/franchise, computed by recommendationScore.ts,
   *  never by the LLM. Absent for older cached sessions (optional). */
  distance?: "very_close" | "close" | "mood_match" | "conceptual_match" | "discovery";
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

/** One durable, synthesized insight about the user's taste/habits — built by
 *  a dedicated one-off LLM analysis pass over REAL Movviz data (watched
 *  titles, requests, feedback), not extracted from conversation like
 *  AiFactEntry. `source` distinguishes the initial deep pass from later
 *  incremental top-ups (both shown the same way in the UI, but useful to
 *  tell apart in the raw store). */
export interface AiContextInsight {
  text: string;
  /** Self-reported by the model, same trust level as the Mood Engine's
   *  trait weights (titleAnalysis.ts) — clamped 0..1, never treated as
   *  ground truth (spec: "ne jamais confondre profil et vérité"). */
  confidence: number;
  /** How many distinct data points (titles/requests/feedback) the model
   *  says support this — clamped to a sane range, purely explanatory. */
  evidenceCount: number;
  trend: "emergente" | "stable" | "en_baisse";
  at: number;
  source: "bootstrap" | "incremental";
}

/** The consolidated "what Movviz AI has figured out about you" context
 *  (demande explicite user — profile page button). Distinct from the raw
 *  feedback/facts logs above: this is a SYNTHESIS over them plus watch/
 *  request history, built once on demand then topped up incrementally as
 *  new activity accumulates (contextBuilder.ts owns the thresholds/cooldown
 *  — never a background daemon, always gated to a real request). */
export interface AiContextProfile {
  insights: AiContextInsight[];
  /** 0 = never built (bootstrap button not used yet). Incremental passes
   *  compare this against dated activity (watch.recent[].at, request
   *  createdAt) to find what's genuinely NEW since the last synthesis —
   *  no separate event journal needed. */
  builtAt: number;
}

/** A user correcting the assistant on a wrong claim it just made — logged so
 *  a REPEATED same-shape mistake can escalate the prompt's own honesty rule
 *  for that specific user (tasteProfile.buildCorrectionEscalationContext),
 *  instead of each correction only ever living as a one-off in-context
 *  apology that's forgotten the moment the session ends. Deliberately not a
 *  large taxonomy (AI.MD "simplest thing that actually works") — only the
 *  one category that's confirmed live and reliably detectable from regex
 *  alone; "other" exists so the shape doesn't need to change the day a
 *  second reliably-detectable category shows up, but nothing writes it yet. */
export interface AiCorrectionEntry {
  category: "library_false_negative" | "other";
  /** Short excerpt of the user's correcting message — just enough to see
   *  what was said, never a full transcript. */
  note: string;
  at: number;
}

/**
 * 1-5 star ratings — a richer, deliberately DIFFERENT signal from the
 * binary 👍/👎 feedback log above (AiFeedbackEntry, kept as-is, still used
 * by recommendation-card voting). A rating always belongs to exactly one
 * title (tmdbId+type) per user; every change is appended to `history`
 * rather than overwriting it, so "how has my opinion of this changed over
 * time" stays answerable.
 *
 * Only two priority tiers are tracked, on purpose — not the mega-spec's
 * full 6-level source hierarchy. A small/free-tier LLM (this whole
 * session's own established pattern) can't reliably distinguish "explicit
 * chatbot rating" from "explicit widget click" from "clear opinion" from
 * "correction" as separate confidence bands; collapsing to "explicit"
 * (a real number the user stated or clicked, always wins) vs "inferred"
 * (a qualitative opinion the model interpreted, always loses to any
 * explicit rating, past or future) is the honest ceiling of what's
 * reliably enforceable, same reasoning as buildCorrectionEscalationContext
 * above choosing a plain count over a fake fine-grained taxonomy.
 */
export type RatingSource = "explicit" | "inferred";

export interface RatingHistoryEntry {
  rating: number; // 1-5
  source: RatingSource;
  /** 0..1 — self-reported by the model for an inferred rating (never
   *  fabricated ground truth), always 1 for an explicit one. */
  confidence: number;
  at: number;
  /** The opinion text that justified an inferred rating, or a short user
   *  comment attached to an explicit one — kept separate from the numeric
   *  rating itself (spec: "distinguer opinion et note", the note is HOW
   *  MUCH, the opinion is WHY). Never required. */
  opinion?: string;
}

export interface TitleRating {
  tmdbId: number;
  type: "movie" | "series";
  /** Denormalized for display/logs only — never the source of truth for
   *  what the title actually is (that's always tmdbId+type). */
  title: string;
  /** The CURRENT rating — always the most recent entry unless a lower-
   *  priority (inferred) rating tried to override a higher-priority
   *  (explicit) one, in which case the explicit one is kept as current
   *  even though the inferred attempt is still appended to `history` for
   *  transparency (see setRating in ratingStore.ts). */
  rating: number;
  source: RatingSource;
  confidence: number;
  opinion?: string;
  history: RatingHistoryEntry[];
  updatedAt: number;
}

export interface AiUserProfile {
  feedback: AiFeedbackEntry[];
  facts: AiFactEntry[];
  context?: AiContextProfile;
  corrections?: AiCorrectionEntry[];
  ratings?: TitleRating[];
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