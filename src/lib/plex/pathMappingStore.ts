import fs from "node:fs";
import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import { pathFor } from "@/lib/library/renamePath";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "plex-path-mappings.json");

export interface PathMapping {
  plexPrefix: string;
  movvizPrefix: string;
  learnedAt: number;
}

export function loadPathMappings(): PathMapping[] {
  return readJsonCached<PathMapping[]>(FILE, []);
}

function savePathMappings(mappings: PathMapping[]) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(FILE, mappings);
}

/**
 * Records a Plex↔Movviz prefix pair learned by comparing Plex's reported
 * path against Movviz's own verified path for the SAME tracked entry (never
 * a global filename index — see librarySync.ts). Multiple independent pairs
 * coexist (movies root and series root are very likely on different mounts).
 */
export function learnPathMapping(plexPrefix: string, movvizPrefix: string): void {
  if (!plexPrefix || !movvizPrefix) return;
  const mappings = loadPathMappings();
  const exists = mappings.some(
    (m) =>
      m.plexPrefix.toLowerCase() === plexPrefix.toLowerCase() &&
      m.movvizPrefix.toLowerCase() === movvizPrefix.toLowerCase()
  );
  if (exists) return;
  mappings.push({ plexPrefix, movvizPrefix, learnedAt: Date.now() });
  savePathMappings(mappings);
}

/** Suppression manuelle depuis Réglages → Plex (validation humaine). */
export function removePathMapping(plexPrefix: string, movvizPrefix: string): boolean {
  const mappings = loadPathMappings();
  const kept = mappings.filter(
    (m) =>
      !(
        m.plexPrefix.toLowerCase() === plexPrefix.toLowerCase() &&
        m.movvizPrefix.toLowerCase() === movvizPrefix.toLowerCase()
      )
  );
  if (kept.length === mappings.length) return false;
  savePathMappings(kept);
  return true;
}

/**
 * Rewrites a Plex-reported path to Movviz's own filesystem view using the
 * longest matching learned prefix (tolerant of both separator styles, same
 * as the rest of the path-repair code — see pathFor()). No match → path
 * returned unchanged, which is today's exact behavior for single-container
 * installs where no mapping is ever learned.
 */
export function applyLearnedPathMapping(plexPath: string): string {
  const mappings = loadPathMappings();
  if (mappings.length === 0) return plexPath;

  const sep = pathFor(plexPath).sep;
  const normalized = plexPath.replace(/[\\/]/g, sep);

  let best: PathMapping | null = null;
  for (const m of mappings) {
    const prefixNormalized = m.plexPrefix.replace(/[\\/]/g, sep);
    if (normalized.toLowerCase().startsWith(prefixNormalized.toLowerCase())) {
      if (!best || m.plexPrefix.length > best.plexPrefix.length) best = m;
    }
  }
  if (!best) return plexPath;

  const rest = normalized.slice(best.plexPrefix.replace(/[\\/]/g, sep).length);
  const movvizSep = pathFor(best.movvizPrefix).sep;
  return best.movvizPrefix + rest.split(sep).join(movvizSep);
}

/**
 * The reverse of applyLearnedPathMapping: Movviz's own path (inside its
 * container, e.g. /data/série/…) → the path the NAS and Plex see
 * (/volume1/docker/plex/série/…). Shown on the title pages so the file can
 * actually be found on the disk. No learned mapping → unchanged.
 */
export function toPlexSidePath(movvizPath: string): string {
  const mappings = loadPathMappings();
  if (mappings.length === 0) return movvizPath;
  const sep = pathFor(movvizPath).sep;
  const normalized = movvizPath.replace(/[\/]/g, sep);
  let best: PathMapping | null = null;
  for (const m of mappings) {
    const prefix = m.movvizPrefix.replace(/[\/]/g, sep);
    const lower = normalized.toLowerCase();
    const prefixLower = prefix.toLowerCase();
    if (lower === prefixLower || lower.startsWith(prefixLower.endsWith(sep) ? prefixLower : prefixLower + sep)) {
      if (!best || m.movvizPrefix.length > best.movvizPrefix.length) best = m;
    }
  }
  if (!best) return movvizPath;
  const rest = normalized.slice(best.movvizPrefix.replace(/[\/]/g, sep).length);
  const plexSep = pathFor(best.plexPrefix).sep;
  return best.plexPrefix + rest.split(sep).join(plexSep);
}
