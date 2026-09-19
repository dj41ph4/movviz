import { loadPlexConfig } from "./store";
import { getAccountHistory, type PlexHistoryEntry } from "./client";
import type { PlexUserContext } from "./plexUserContext";
import { recordSearchLog } from "@/lib/diagnostic/searchLog";
import fs from "node:fs";
import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const CURSOR_FILE = path.join(CONFIG_DIR, "plex-history-cursors.json");

type CursorShape = Record<string, { lastViewedAt: number; historyKeyCount: number; updatedAt: number }>; // key = `${userId}::${machineIdentifier}::history`

function cursorKey(userId: string, machineIdentifier: string): string {
  return `${userId}::${machineIdentifier}::history`;
}

function readCursors(): CursorShape {
  return readJsonCached<CursorShape>(CURSOR_FILE, {});
}
function writeCursors(shape: CursorShape): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(CURSOR_FILE, shape);
}

export type HistoryPollResult = {
  entries: PlexHistoryEntry[];
  accountMismatch: number;
  unmapped: number;
  totalSeen: number;
  cursorAdvanced: boolean;
  rejectedForeign: number;
  rejectedUnattributed: number;
  rejectedMalformed: number;
  sampleMalformed: Record<string, unknown> | null;
  totalEpisodeTypeSeen: number;
};

/**
 * PlexHistoryObserver (§28-29): answers "Que s'est-il réellement passé en lecture ?"
 * - Uses accountID filter with adminToken (as before)
 * - Does NOT directly determine WATCHED/UNWATCHED – only returns history events
 * - Caller must trigger targeted PlexWatchStateObserver verification for each event's ratingKey
 */
export async function pollHistory(ctx: PlexUserContext, opts?: { force?: boolean }): Promise<HistoryPollResult> {
  const cfg = loadPlexConfig();
  if (!cfg.hostname || !cfg.adminToken) {
    return {
      entries: [],
      accountMismatch: 0,
      unmapped: 0,
      totalSeen: 0,
      cursorAdvanced: false,
      rejectedForeign: 0,
      rejectedUnattributed: 0,
      rejectedMalformed: 0,
      sampleMalformed: null,
      totalEpisodeTypeSeen: 0,
    };
  }

  const cursors = readCursors();
  const k = cursorKey(ctx.movvizUserId, ctx.machineIdentifier);
  const cursor = cursors[k];

  // Use adminToken + localAccountId (PMS-local id space, §13)
  const historyResult = await getAccountHistory(cfg, cfg.adminToken, ctx.localAccountId);
  const entries = historyResult.entries;

  // Assertion §13: history.accountId must match expected localAccountId – getAccountHistory already filters, but we double-check & log mismatch
  let accountMismatch = 0;
  for (const e of entries) {
    if (e.accountId != null && e.accountId !== ctx.localAccountId) {
      accountMismatch++;
      recordSearchLog("warn", "plex.history", `PLEX_ACCOUNT_MISMATCH user=${ctx.movvizUserId} expected=${ctx.localAccountId} got=${e.accountId} ratingKey=${e.ratingKey}`);
    }
  }
  if (accountMismatch > 0) {
    // Fail closed: don't import if mismatched entries slipped through
    recordSearchLog("warn", "plex.history", `plex.history user=${ctx.movvizUserId} accountMismatch=${accountMismatch} – import ignoré`);
    return {
      entries: [],
      accountMismatch,
      unmapped: 0,
      totalSeen: entries.length,
      cursorAdvanced: false,
      rejectedForeign: historyResult.rejectedForeignEntries,
      rejectedUnattributed: historyResult.rejectedUnattributedEntries,
      rejectedMalformed: historyResult.rejectedMalformedEpisodeEntries,
      sampleMalformed: historyResult.sampleMalformedEpisode,
      totalEpisodeTypeSeen: historyResult.totalEpisodeTypeSeen,
    };
  }

  // Cursor advancement (§58): only after successful fetch + processing
  // We store max viewedAt seen; next poll could theoretically filter, but for now we just record and always fetch newest first.
  // The history endpoint pagination already handles large history; we just track cursor for diagnostics.
  let cursorAdvanced = false;
  if (entries.length > 0) {
    const maxViewedAt = Math.max(...entries.map((e) => e.viewedAt ?? 0));
    if (!cursor || maxViewedAt > cursor.lastViewedAt) {
      cursors[k] = { lastViewedAt: maxViewedAt, historyKeyCount: entries.length, updatedAt: Date.now() };
      writeCursors(cursors);
      cursorAdvanced = true;
    }
  }

  // Structured rejection diagnostics (§66-67)
  const hasRejections = historyResult.rejectedForeignEntries > 0 || historyResult.rejectedUnattributedEntries > 0 || historyResult.rejectedMalformedEpisodeEntries > 0;
  if (hasRejections || entries.length === 0) {
    const parts = [
      historyResult.rejectedForeignEntries ? `${historyResult.rejectedForeignEntries} autre(s) compte(s) rejeté(s)` : null,
      historyResult.rejectedUnattributedEntries ? `${historyResult.rejectedUnattributedEntries} sans accountID rejeté(s)` : null,
      historyResult.rejectedMalformedEpisodeEntries ? `${historyResult.rejectedMalformedEpisodeEntries} épisode(s) mal formé(s) rejeté(s)` : null,
    ].filter(Boolean) as string[];
    recordSearchLog(
      hasRejections ? "warn" : "info",
      "plex.history",
      `plex.history user=${ctx.movvizUserId} localAccountId=${ctx.localAccountId} received=${entries.length} totalEpisodeSeen=${historyResult.totalEpisodeTypeSeen} ${parts.length ? `, ${parts.join(", ")}` : ""} cursorAdvanced=${cursorAdvanced}`
    );
    if (historyResult.sampleMalformedEpisode) {
      recordSearchLog("warn", "plex.history", `plex.history sampleMalformed user=${ctx.movvizUserId} ${JSON.stringify(historyResult.sampleMalformedEpisode).slice(0, 800)}`);
    }
  } else {
    recordSearchLog("info", "plex.history", `plex.history user=${ctx.movvizUserId} received=${entries.length} cursorAdvanced=${cursorAdvanced}`);
  }

  // Sampling (§67): don't flood logs with per-entry lines
  if (entries.length > 3) {
    const sample = entries.slice(0, 3).map((e) => `${e.type}:${e.ratingKey}@${e.viewedAt}`).join(", ");
    recordSearchLog("info", "plex.history", `plex.history sample user=${ctx.movvizUserId} count=${entries.length} sample=[${sample}]`);
  }

  return {
    entries,
    accountMismatch,
    unmapped: 0,
    totalSeen: entries.length,
    cursorAdvanced,
    rejectedForeign: historyResult.rejectedForeignEntries,
    rejectedUnattributed: historyResult.rejectedUnattributedEntries,
    rejectedMalformed: historyResult.rejectedMalformedEpisodeEntries,
    sampleMalformed: historyResult.sampleMalformedEpisode,
    totalEpisodeTypeSeen: historyResult.totalEpisodeTypeSeen,
  };
}

export function getHistoryCursor(userId: string, machineIdentifier: string): { lastViewedAt: number; historyKeyCount: number; updatedAt: number } | null {
  const cursors = readCursors();
  return cursors[cursorKey(userId, machineIdentifier)] ?? null;
}

export function clearHistoryCursor(userId: string, machineIdentifier: string): void {
  const cursors = readCursors();
  delete cursors[cursorKey(userId, machineIdentifier)];
  writeCursors(cursors);
}
