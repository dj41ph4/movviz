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

type CursorShape = Record<string, { lastViewedAt: number; historyKeyCount: number; updatedAt: number; seenEventKeysAtTimestamp?: string[] }>; // key = `${userId}::${machineIdentifier}::history`

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
export const EMPTY_HISTORY_RESULT: HistoryPollResult = {
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

export async function pollHistory(ctx: PlexUserContext, opts?: { force?: boolean }): Promise<HistoryPollResult> {
  const cfg = loadPlexConfig();
  if (!cfg.hostname || !cfg.adminToken) {
    return { ...EMPTY_HISTORY_RESULT };
  }
  if (!ctx.historyAvailable || ctx.historyAccountId == null) {
    recordSearchLog("info", "plex.history", `plex.history user=${ctx.movvizUserId} skipped reason=no_reliable_per_user_history historyAvailable=false snapshotAvailable=${ctx.authSource === "owner"}`);
    return { ...EMPTY_HISTORY_RESULT };
  }

  const cursors = readCursors();
  const k = cursorKey(ctx.movvizUserId, ctx.machineIdentifier);
  const cursor = cursors[k];

  // Use adminToken + the proven PMS-local history account id.
  const historyResult = await getAccountHistory(cfg, cfg.adminToken, ctx.historyAccountId);
  const entries = historyResult.entries;

  // Assertion §13: history.accountId must match expected localAccountId – getAccountHistory already filters, but we double-check & log mismatch
  let accountMismatch = 0;
  for (const e of entries) {
    if (e.accountId != null && e.accountId !== ctx.historyAccountId) {
      accountMismatch++;
      recordSearchLog("warn", "plex.history", `PLEX_ACCOUNT_MISMATCH user=${ctx.movvizUserId} expected=${ctx.historyAccountId} got=${e.accountId} ratingKey=${e.ratingKey}`);
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

  // The caller advances the cursor only after its batch has reconciled.  A
  // fetch is not a processed event and must never make history disappear.
  const cursorAdvanced = false;

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
      `plex.history user=${ctx.movvizUserId} historyAccountId=${ctx.historyAccountId} received=${entries.length} totalEpisodeSeen=${historyResult.totalEpisodeTypeSeen} ${parts.length ? `, ${parts.join(", ")}` : ""} cursorAdvanced=${cursorAdvanced}`
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

/** Persist only the highest event timestamp which was fully processed. */
export function setHistoryCursor(userId: string, machineIdentifier: string, lastViewedAt: number, entriesAtTimestamp: PlexHistoryEntry[] | string[] = []): void {
  if (!Number.isFinite(lastViewedAt) || lastViewedAt <= 0) return;
  const cursors = readCursors();
  const k = cursorKey(userId, machineIdentifier);
  const previous = cursors[k];
  const seen = entriesAtTimestamp.length > 0 && typeof entriesAtTimestamp[0] === "string"
    ? entriesAtTimestamp as string[]
    : (entriesAtTimestamp as PlexHistoryEntry[])
      .filter((entry) => (entry.viewedAt ?? 0) === lastViewedAt)
      .map((entry) => entry.ratingKey ?? `nork:${entry.grandparentTitle ?? "?"}:${entry.season ?? "?"}:${entry.episode ?? "?"}:${entry.viewedAt ?? "?"}`);
  if (previous?.lastViewedAt === lastViewedAt) seen.push(...(previous.seenEventKeysAtTimestamp ?? []));
  cursors[k] = { lastViewedAt, historyKeyCount: previous?.historyKeyCount ?? 0, updatedAt: Date.now(), seenEventKeysAtTimestamp: [...new Set(seen)].slice(0, 50) };
  writeCursors(cursors);
}

export function getHistoryCursor(userId: string, machineIdentifier: string): { lastViewedAt: number; historyKeyCount: number; updatedAt: number; seenEventKeysAtTimestamp?: string[] } | null {
  const cursors = readCursors();
  return cursors[cursorKey(userId, machineIdentifier)] ?? null;
}

export function clearHistoryCursor(userId: string, machineIdentifier: string): void {
  const cursors = readCursors();
  delete cursors[cursorKey(userId, machineIdentifier)];
  writeCursors(cursors);
}
