import fs from "node:fs";
import path from "node:path";
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
  const { retentionDays, moviesPath, seriesPath } = getTrashConfig();
  const cutoff = Date.now() - retentionDays * DAY_MS;
  // Collect configured trash roots for path validation
  const trashRoots = [moviesPath, seriesPath].filter(Boolean).map((r) => path.resolve(r as string));
  let purged = 0;
  let failed = 0;
  for (const entry of loadTrashManifest()) {
    if (entry.deletedAt > cutoff) continue;
    // Safety: verify trashPath is actually under a configured trash root.
    // If no roots are configured, refuse ALL deletions — an empty config means
    // the admin hasn't set up trash yet, so nothing should be auto-purged.
    const resolved = path.resolve(entry.trashPath);
    const safe = trashRoots.length > 0 && trashRoots.some((root) => resolved.startsWith(root + path.sep));
    if (!safe) {
      failed++;
      continue;
    }
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
