import { loadMovies, loadSeries } from "@/lib/library/store";
import { getWatchStatus } from "@/lib/plex/watchStore";
import { loadRequests } from "@/lib/requests/store";
import { readJsonCached } from "@/lib/fsJsonCache";
import type { AiMemoryStore } from "./types";
import { AI_MEMORY_FILE } from "./memory";
import { relativeFr } from "./actions";
import { buildUnifiedUserContextSnapshot, formatUnifiedUserContext } from "@/lib/userContext/query";
import { refreshLegacyUserContext } from "@/lib/userContext/bootstrap";
import { formatUserWatchHistory } from "@/lib/userContext/history";
import { formatTasteEvidenceContext } from "@/lib/userContext/taste";
import { formatExplicitPreferencesContext } from "@/lib/userContext/preferences";

export interface UsageProfile {
  /** Whole-instance library size (shared across every user — not a "watched" count). Distinct on purpose: a user asking "j'ai 2284 films" means the library total, not how many they've watched. */
  libraryMovies: number;
  librarySeries: number;
  watchedMovies: number;
  watchedSeries: number;
  watchedEpisodes: number;
  requestsTotal: number;
  requestsPending: number;
  requestsApproved: number;
  requestsDeclined: number;
  aiAdded: number;
  aiAccepted: number;
  /** Series with the most watched episodes — the strongest "you binge this"
   *  signal Movviz has. */
  topSeries: { title: string; episodes: number }[];
  /** Epoch ms of the most recent dated watch event, or null if none —
   *  demande explicite user ("date de visionnage aussi"). Only ever derived
   *  from `recent` (bounded to the last 30 dated entries, Plex sync +
   *  direct playback + manual toggle), never a guess — a real timestamp or
   *  nothing. */
  lastWatchedAt: number | null;
  /** How many of those last 30 dated entries fall within the last 7/30
   *  days — a real, bounded "viewing rhythm" signal (not the user's whole
   *  history, just what's covered by the dated window Movviz actually
   *  keeps), letting the assistant distinguish "watches constantly" from
   *  "hasn't opened Movviz in weeks" without guessing. */
  watchesLast7Days: number;
  watchesLast30Days: number;
  /** Compact, live-verified context assembled by the unified Context Engine.
   *  This is factual state (resume positions, exact recent titles, series
   *  progression), not an LLM-generated taste insight. */
  verifiedContext: string;
  /** Chronological completion/watch history. Unlike the old recent list,
   *  future ledger entries preserve rewatches as distinct dated events. */
  verifiedWatchHistory: string;
  /** Evidence-backed preferences/habits kept separate from exact facts. */
  tasteEvidenceContext: string;
  /** Direct user statements/corrections. These outrank inferred insights. */
  explicitPreferencesContext: string;
}

/** Quantified usage profile derived from REAL Movviz data — the assistant's
 *  view of "who this user is" is numbers and facts computed from the
 *  user's own activity (watch status, requests, AI memory), never guesses.
 *  Strictly per-user: every source is filtered by userId. */
export async function buildUsageProfile(userId: string): Promise<UsageProfile> {
  // Best-effort, idempotent mirror of the legacy stores into the unified
  // Context Engine. It never blocks this read path when SQLite is unavailable
  // and it never invents historical dates for legacy watched flags.
  refreshLegacyUserContext(userId);

  const status = getWatchStatus(userId);

  const episodeCount = new Map<number, number>();
  for (const ep of status?.episodes ?? []) {
    episodeCount.set(ep.tmdbId, (episodeCount.get(ep.tmdbId) ?? 0) + 1);
  }
  const seriesTitles = new Map(loadSeries().map((s) => [s.tmdbId, s.title]));
  const topSeries = [...episodeCount.entries()]
    .map(([tmdbId, episodes]) => ({ title: seriesTitles.get(tmdbId) ?? `#${tmdbId}`, episodes }))
    .sort((a, b) => b.episodes - a.episodes)
    .slice(0, 5);

  const requests = loadRequests().filter((r) => r.userId === userId);
  const memory = readJsonCached<AiMemoryStore | null>(AI_MEMORY_FILE, null) ?? {};

  const recent = status?.recent ?? [];
  const lastWatchedAt = recent.length ? Math.max(...recent.map((r) => r.at)) : null;
  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const watchesLast7Days = recent.filter((r) => now - r.at <= 7 * DAY_MS).length;
  const watchesLast30Days = recent.filter((r) => now - r.at <= 30 * DAY_MS).length;
  const verifiedContext = formatUnifiedUserContext(buildUnifiedUserContextSnapshot(userId));
  const verifiedWatchHistory = formatUserWatchHistory(userId, 30);
  const tasteEvidenceContext = await formatTasteEvidenceContext(userId, 5);
  const explicitPreferencesContext = formatExplicitPreferencesContext(userId, 12);

  return {
    libraryMovies: loadMovies().length,
    librarySeries: loadSeries().length,
    watchedMovies: status?.movies.length ?? 0,
    watchedSeries: episodeCount.size,
    watchedEpisodes: status?.episodes.length ?? 0,
    requestsTotal: requests.length,
    requestsPending: requests.filter((r) => r.status === "pending").length,
    requestsApproved: requests.filter((r) => r.status === "approved").length,
    requestsDeclined: requests.filter((r) => r.status === "declined").length,
    aiAdded: memory[userId]?.added.length ?? 0,
    aiAccepted: memory[userId]?.accepted.length ?? 0,
    topSeries,
    lastWatchedAt,
    watchesLast7Days,
    watchesLast30Days,
    verifiedContext,
    verifiedWatchHistory,
    tasteEvidenceContext,
    explicitPreferencesContext,
  };
}

export function formatUsageProfile(p: UsageProfile): string {
  const parts: string[] = [];
  parts.push(`bibliothèque Movviz (tous utilisateurs) : ${p.libraryMovies} films, ${p.librarySeries} séries au total`);
  parts.push(`films vus (cet utilisateur) : ${p.watchedMovies}`);
  parts.push(`séries suivies : ${p.watchedSeries} (${p.watchedEpisodes} épisodes vus)`);
  if (p.topSeries.length) {
    parts.push(`le plus regardées : ${p.topSeries.map((s) => `${s.title} (${s.episodes} ép.)`).join(", ")}`);
  }
  if (p.requestsTotal > 0) {
    parts.push(`demandes : ${p.requestsTotal} (${p.requestsApproved} approuvées, ${p.requestsPending} en attente, ${p.requestsDeclined} refusées)`);
  }
  if (p.aiAdded > 0) parts.push(`ajouts via l'assistant : ${p.aiAdded}`);
  if (p.aiAccepted > 0) parts.push(`recommandations acceptées : ${p.aiAccepted}`);
  if (p.lastWatchedAt !== null) {
    parts.push(`dernière vue : ${relativeFr(p.lastWatchedAt)}`);
    parts.push(`rythme récent : ${p.watchesLast7Days} vue(s) sur 7 jours, ${p.watchesLast30Days} sur 30 jours`);
  }
  if (p.verifiedContext) {
    parts.push(`DONNÉES UTILISATEUR VÉRIFIÉES PAR MOVVIZ (faits exacts, ne jamais les inventer ni les contredire) : ${p.verifiedContext}`);
  }
  if (p.verifiedWatchHistory) {
    parts.push(`HISTORIQUE CHRONOLOGIQUE VÉRIFIÉ (ordre récent → ancien ; les genres entre crochets viennent de la bibliothèque, les dates après @ sont réelles) : ${p.verifiedWatchHistory}`);
  }
  if (p.tasteEvidenceContext) {
    parts.push(`TENDANCES DE GOÛT ÉTAYÉES (personnalisation possible, mais ce ne sont PAS toutes des certitudes : respecte la confiance et la source, une préférence explicite prime toujours) : ${p.tasteEvidenceContext}`);
  }
  if (p.explicitPreferencesContext) {
    parts.push(`PRÉFÉRENCES EXPLICITES ET CORRECTIONS (source utilisateur directe, PRIORITÉ ABSOLUE sur une ancienne supposition, un ancien insight ou une ancienne réponse de l'assistant) : ${p.explicitPreferencesContext}`);
  }
  return parts.join(" · ");
}
