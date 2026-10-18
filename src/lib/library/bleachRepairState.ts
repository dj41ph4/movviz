import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { readJsonCached, jsonCacheReadFailed } from "@/lib/fsJsonCache";
import { BLEACH_TMDB_ID } from "@/lib/metadata/bleachEpisodeOrder";
import type { BleachTrackedCoordinate } from "./bleachRepair";
import { PLAYBACK_ACTIVE_HEARTBEAT_MS, playbackEngineSessionTtlMs } from "@/lib/playback/sessionFreshness";

const DATA_DIR = process.env.MOVVIZ_CONFIG_DIR ?? process.env.MOVVIZ_DATA_DIR ?? path.join(process.cwd(), ".movviz-data");

/** Do not call progress/watch/context getters: several perform lazy backfills. */
export function inspectBleachRepairState(seriesId: string, episodeRatingKeys: string[] = []) {
  const tracked: BleachTrackedCoordinate[] = [];
  const snapshots: Record<string, unknown> = {};
  const blockers: string[] = [];
  const knownRatingKeys = new Set(episodeRatingKeys);
  const visit = (value: unknown, store: string, bleachParent = false) => {
    if (!value || typeof value !== "object") return;
    const row = value as Record<string, unknown>;
    const mediaIdentity = typeof row.mediaId === "string" && row.mediaId.startsWith(`${seriesId}:`);
    const bleach = row.tmdbId === BLEACH_TMDB_ID || row.tmdbShowId === BLEACH_TMDB_ID || mediaIdentity || bleachParent;
    if (bleach) {
      const seasonNumber = row.seasonNumber ?? row.season;
      const episodeNumber = row.episodeNumber ?? row.episode;
      if (typeof seasonNumber === "number" && typeof episodeNumber === "number") tracked.push({ store, seasonNumber, episodeNumber });
      else if (row.type === "episode" || row.mediaType === "episode" || "season" in row || "seasonNumber" in row) blockers.push("unknown_context_identity");
    }
    if (store === "playback-progress.json" && typeof row.lastHeartbeatAt === "number" && Date.now() - row.lastHeartbeatAt <= PLAYBACK_ACTIVE_HEARTBEAT_MS && (mediaIdentity || (typeof row.ratingKey === "string" && knownRatingKeys.has(row.ratingKey)))) blockers.push("active_playback");
    for (const child of Object.values(row)) visit(child, store, bleach);
  };
  for (const name of ["plex-watch-status.json", "watchlist.json", "playback-progress.json", "plex-media-identity-map.json", "trash-manifest.json", "requests.json"]) {
    const file = path.join(DATA_DIR, name);
    if (!fs.existsSync(file)) continue;
    const value = readJsonCached<unknown>(file, null);
    if (value == null || jsonCacheReadFailed(file)) { blockers.push(`unreadable:${name}`); continue; }
    snapshots[name] = value;
    if (name === "requests.json" && Array.isArray(value) && value.some(r => r?.type === "series" && r.tmdbId === BLEACH_TMDB_ID && r.seasonNumbers?.length && !r.seriesPart && r.status === "pending")) blockers.push("ambiguous_user_history");
    visit(value, name);
  }
  const dbFile = path.join(DATA_DIR, "context", "user-context.sqlite");
  if (fs.existsSync(dbFile)) {
    const sqlite = process.getBuiltinModule?.("node:sqlite") as typeof import("node:sqlite") | undefined;
    if (!sqlite?.DatabaseSync) blockers.push("sqlite_unavailable");
    else {
      const db = new sqlite.DatabaseSync(dbFile, { readOnly: true });
      try {
        for (const table of ["context_events", "user_media_state"]) {
          const rows = db.prepare(`SELECT * FROM ${table} WHERE tmdb_id = ? AND media_type = 'episode'`).all(BLEACH_TMDB_ID);
          snapshots[table] = rows;
          for (const row of rows) {
            if (typeof row.season_number !== "number" || typeof row.episode_number !== "number") blockers.push("unknown_context_identity");
            else tracked.push({ store: table, seasonNumber: row.season_number, episodeNumber: row.episode_number });
          }
        }
        // Pending exports must never replay old coordinates during a repair.
        const pending = db.prepare("SELECT * FROM user_media_sync_state WHERE state_key LIKE ?").all(`%:episode:${BLEACH_TMDB_ID}:%`);
        snapshots.user_media_sync_state = pending;
        if (pending.length) blockers.push("pending_history_sync");
      } catch { blockers.push("unreadable_context"); }
      finally { db.close(); }
    }
  }
  // The second player has independent in-memory sessions, not in the JSON store.
  const engineState = (globalThis as typeof globalThis & { __movvizPlaybackEngineSessions?: { sessions: Map<string, { mediaId?: string; lastActivity?: number }> } }).__movvizPlaybackEngineSessions;
  if ([...(engineState?.sessions.values() ?? [])].some((s) => s.mediaId?.startsWith(`${seriesId}:`) && typeof s.lastActivity === "number" && Date.now() - s.lastActivity <= playbackEngineSessionTtlMs())) blockers.push("active_playback");
  return { tracked, blockers: [...new Set(blockers)], fingerprint: createHash("sha256").update(JSON.stringify(snapshots)).digest("hex") };
}
