import { loadMovies, loadSeries } from "@/lib/library/store";
import { getWatchStatus } from "@/lib/plex/watchStore";
import { loadRequests } from "@/lib/requests/store";
import { readJsonCached } from "@/lib/fsJsonCache";
import path from "node:path";
import type { AiMemoryStore } from "./types";

const CONFIG_DIR = process.env.MOVVIZ_CONFIG_DIR ?? process.env.MOVVIZ_DATA_DIR ?? path.join(process.cwd(), ".movviz-data");

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
}

/** Quantified usage profile derived from REAL Movviz data — the assistant's
 *  view of "who this user is" is numbers and facts computed from the
 *  user's own activity (watch status, requests, AI memory), never guesses.
 *  Strictly per-user: every source is filtered by userId. */
export function buildUsageProfile(userId: string): UsageProfile {
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
  const memory = readJsonCached<AiMemoryStore | null>(path.join(CONFIG_DIR, "ai-memory.json"), null) ?? {};

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
  return parts.join(" · ");
}