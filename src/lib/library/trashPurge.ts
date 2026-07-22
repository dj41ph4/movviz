import fs from "node:fs";
import { loadTrashManifest, removeTrashEntry, getTrashConfig } from "./trashStore";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Permanently deletes any trashed item older than the configured retention
 * — the other half of the trash feature's safety promise: files aren't kept
 * forever, but they're never deleted before their time either. Each entry
 * is handled independently (one failure — permissions, already gone by
 * hand — doesn't block the rest) and only dropped from the manifest once
 * its files are actually gone.
 */
export async function purgeExpiredTrash(): Promise<{ purged: number; failed: number }> {
  const { retentionDays } = getTrashConfig();
  const cutoff = Date.now() - retentionDays * DAY_MS;
  let purged = 0;
  let failed = 0;
  for (const entry of loadTrashManifest()) {
    if (entry.deletedAt > cutoff) continue;
    try {
      fs.rmSync(entry.trashPath, { recursive: true, force: true });
      removeTrashEntry(entry.id);
      purged++;
    } catch {
      failed++;
    }
  }
  return { purged, failed };
}
