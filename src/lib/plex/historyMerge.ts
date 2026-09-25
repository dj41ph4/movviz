import { getUserById } from "@/lib/auth/store";
import { listPlaybackProgress } from "@/lib/playback/progressStore";
import { getCurrentWatchStateAt } from "@/lib/userContext/watchBridge";
import { setWatchedEpisodes, setWatchedMovies } from "./watchStore";
import { getAccountHistoryPage, type PlexHistoryEntry } from "./client";
import { resolveEpisode, resolveMovie } from "./episodeResolver";
import { resolvePlexUserContext } from "./plexUserContext";
import { loadPlexConfig } from "./store";
import { getAllBindings } from "./plexBindingStore";

/** PMS local account 1 is always the server owner. */
const SERVER_OWNER_LOCAL_ACCOUNT_ID = 1;

export interface HistoryMergeReport {
  dryRun: boolean;
  target: string;
  sourceEntries: number;
  unresolved: number;
  /** Distinct titles (films, episodes) found in the old history. */
  titles: number;
  /** Never seen by the target: marked watched at their real, old date. */
  added: number;
  /** Already watched by the target: state kept, the old view only joins the history. */
  alreadyWatched: number;
  /** Marked « not watched » by the target: the old view wins, dated right after that mark. */
  overriddenUnwatched: number;
  /** In progress for the target (« Reprendre »): left untouched. */
  skippedInProgress: number;
  examples: string[];
}

type Canonical =
  | { type: "movie"; tmdbId: number }
  | { type: "episode"; tmdbShowId: number; seasonNumber: number; episodeNumber: number };

/**
 * Brings the playback history of one Plex server account (e.g. a deleted
 * Plex Home profile, still in the server's database) into a Movviz account —
 * for its suggestions and « vu » state. Rules asked for explicitly:
 * - recent views and what is being watched stay first: an imported view
 *   keeps its real, old date, and anything in progress is left untouched;
 * - a title already watched keeps its own, more recent view;
 * - an old view replaces a « not watched », dated right after that mark;
 * - never writes to Plex (a Plex view would be dated today and jump ahead
 *   of the recent ones), never marks anything unwatched.
 * dryRun computes the exact same report without writing anything.
 */
export async function mergePlexAccountHistory(input: { fromLocalAccountId: number; toUserId: string; dryRun: boolean }): Promise<HistoryMergeReport> {
  const cfg = loadPlexConfig();
  if (!cfg.adminToken) throw new Error("plex_not_connected");
  const user = getUserById(input.toUserId);
  if (!user) throw new Error("user_not_found");
  const ctxRes = await resolvePlexUserContext(user.id);
  if (!ctxRes.ok) throw new Error(`plex_context_unresolved:${ctxRes.reason}`);
  const ctx = ctxRes.ctx;

  // Only an orphan account's views may move: never the server owner's (the
  // admin account linking Movviz to Plex), never an account a Movviz user
  // is still bound to — nor the target's own.
  if (input.fromLocalAccountId === SERVER_OWNER_LOCAL_ACCOUNT_ID) throw new Error("source_is_server_owner");
  const boundUsers = getAllBindings().filter((b) => b.localAccountId === input.fromLocalAccountId).map((b) => b.movvizUserId);
  if (boundUsers.length > 0) throw new Error("source_account_still_bound");
  if (ctx.localAccountId === input.fromLocalAccountId) throw new Error("source_is_target");

  // 1) The whole old history, oldest first.
  const entries: PlexHistoryEntry[] = [];
  for (let start = 0; ; ) {
    const page = await getAccountHistoryPage(cfg, cfg.adminToken, input.fromLocalAccountId, { start, size: 100, sortDirection: "asc" });
    // Already filtered per entry by getAccountHistoryPage; checked again here
    // because this is the one place that moves views between people.
    entries.push(...page.entries.filter((entry) => entry.accountId === input.fromLocalAccountId));
    if (!page.hasMore || page.rawPageCount === 0) break;
    start = page.nextStart;
  }

  // 2) Resolve each view to a film / episode, keeping its latest view date.
  const latest = new Map<string, { canonical: Canonical; title: string; viewedAt: number }>();
  let unresolved = 0;
  for (const entry of entries) {
    const viewedAt = entry.viewedAt;
    if (!viewedAt) { unresolved++; continue; }
    let canonical: Canonical | null = null;
    let title = "";
    if (entry.type === "movie") {
      const r = await resolveMovie(ctx, { ratingKey: entry.ratingKey, type: "movie", title: entry.title, guid: entry.guid, Guid: entry.Guid });
      if (r.status === "RESOLVED" && r.canonical) { canonical = r.canonical; title = entry.title ?? ""; }
    } else {
      const r = await resolveEpisode(ctx, {
        ratingKey: entry.ratingKey, type: "episode", title: entry.title, guid: entry.guid, Guid: entry.Guid,
        grandparentTitle: entry.grandparentTitle, parentIndex: entry.season, index: entry.episode,
        grandparentRatingKey: entry.grandparentRatingKey,
        grandparentKey: entry.grandparentRatingKey ? `/library/metadata/${entry.grandparentRatingKey}` : undefined,
        accountID: entry.accountId,
      });
      if (r.status === "RESOLVED" && r.canonical) { canonical = r.canonical; title = entry.grandparentTitle ?? entry.title ?? ""; }
    }
    if (!canonical) { unresolved++; continue; }
    const key = canonical.type === "movie" ? `movie:${canonical.tmdbId}` : `ep:${canonical.tmdbShowId}:${canonical.seasonNumber}:${canonical.episodeNumber}`;
    const prev = latest.get(key);
    if (!prev || viewedAt > prev.viewedAt) latest.set(key, { canonical, title, viewedAt });
  }

  // 3) Decide per title against the target's current state.
  const inProgress = new Set(
    listPlaybackProgress(user.id).map((p) => (p.mediaType === "movie" ? `movie:${p.tmdbId}` : `ep:${p.tmdbId}:${p.seasonNumber}:${p.episodeNumber}`)),
  );
  const report: HistoryMergeReport = {
    dryRun: input.dryRun, target: user.username, sourceEntries: entries.length, unresolved,
    titles: latest.size, added: 0, alreadyWatched: 0, overriddenUnwatched: 0, skippedInProgress: 0, examples: [],
  };
  const movieWrites: { tmdbId: number; title: string; at: number }[] = [];
  const episodeWrites = new Map<number, { title: string; entries: { tmdbId: number; season: number; episode: number; watchedAt: number }[] }>();
  for (const [key, item] of latest) {
    if (inProgress.has(key)) { report.skippedInProgress++; continue; }
    const c = item.canonical;
    const current = getCurrentWatchStateAt(c.type === "movie"
      ? { userId: user.id, tmdbId: c.tmdbId, mediaType: "movie" }
      : { userId: user.id, tmdbId: c.tmdbShowId, mediaType: "episode", seasonNumber: c.seasonNumber, episodeNumber: c.episodeNumber });
    let at = item.viewedAt;
    if (current.state === "watched") {
      report.alreadyWatched++; // same call below: rejected as older, only joins the history
    } else if (current.state === "unwatched" && current.updatedAt != null && current.updatedAt >= at) {
      at = current.updatedAt + 1;
      report.overriddenUnwatched++;
    } else {
      report.added++;
      if (report.examples.length < 12) report.examples.push(c.type === "movie" ? item.title : `${item.title} S${c.seasonNumber}E${c.episodeNumber}`);
    }
    if (c.type === "movie") movieWrites.push({ tmdbId: c.tmdbId, title: item.title, at });
    else {
      const group = episodeWrites.get(c.tmdbShowId) ?? { title: item.title, entries: [] };
      group.entries.push({ tmdbId: c.tmdbShowId, season: c.seasonNumber, episode: c.episodeNumber, watchedAt: at });
      episodeWrites.set(c.tmdbShowId, group);
    }
  }
  if (input.dryRun) return report;

  // 4) Write — source "plex_history": never propagated back to Plex. One
  // call per series (not per episode), yielding between them so a large
  // history never freezes the server.
  for (const movie of movieWrites) {
    setWatchedMovies(user.id, [movie.tmdbId], true, movie.title, movie.at, "plex_history");
    await new Promise((resolve) => setImmediate(resolve));
  }
  for (const group of episodeWrites.values()) {
    setWatchedEpisodes(user.id, group.entries, true, group.title, "plex_history");
    await new Promise((resolve) => setImmediate(resolve));
  }
  return report;
}
