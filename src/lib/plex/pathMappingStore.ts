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

const usableCache = new Map<string, { usable: boolean; at: number }>();
const USABLE_TTL_MS = 60_000;

/**
 * Une correspondance n'est utilisable que si son dossier côté Movviz existe
 * vraiment dans ce conteneur. Sans ce garde-fou, une correspondance fausse mais
 * plus longue (ex. /volume1/docker/plex/films → /data/film, dossier inexistant)
 * l'emportait sur la bonne (/volume1/docker/plex → /data) et 157 films finissaient
 * enregistrés avec le chemin vu par Plex. Résultat mis en cache 60 s : la synchro
 * l'interroge pour chaque fichier.
 */
export function isUsablePathMapping(m: PathMapping): boolean {
  const key = m.movvizPrefix;
  const cached = usableCache.get(key);
  if (cached && Date.now() - cached.at < USABLE_TTL_MS) return cached.usable;
  let usable = false;
  try { usable = fs.statSync(m.movvizPrefix).isDirectory(); } catch { usable = false; }
  usableCache.set(key, { usable, at: Date.now() });
  return usable;
}

function translateWith(m: PathMapping, plexPath: string): string | null {
  const sep = pathFor(plexPath).sep;
  const normalized = plexPath.replace(/[\\/]/g, sep);
  const prefixNormalized = m.plexPrefix.replace(/[\\/]/g, sep);
  if (!normalized.toLowerCase().startsWith(prefixNormalized.toLowerCase())) return null;
  const rest = normalized.slice(prefixNormalized.length);
  // Le préfixe doit s'arrêter sur une frontière de dossier : « /plex/films »
  // ne doit pas capturer « /plex/films-4k/... ».
  if (rest !== "" && rest[0] !== sep) return null;
  const movvizSep = pathFor(m.movvizPrefix).sep;
  return m.movvizPrefix + rest.split(sep).join(movvizSep);
}

/**
 * Un vrai fichier vient de prouver où se trouve `plexPath` côté Movviz : toute
 * correspondance qui le traduirait ailleurs, vers un fichier inexistant, est
 * fausse et retirée — la détection automatique se corrige d'elle-même.
 */
export function pruneContradictedMappings(plexPath: string, verifiedMovvizPath: string): void {
  const mappings = loadPathMappings();
  const kept = mappings.filter((m) => {
    const translated = translateWith(m, plexPath);
    if (!translated) return true;
    if (translated.toLowerCase() === verifiedMovvizPath.toLowerCase()) return true;
    return fs.existsSync(translated);
  });
  if (kept.length !== mappings.length) {
    usableCache.clear();
    savePathMappings(kept);
  }
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
    if (!translateWith(m, normalized)) continue;
    if (!isUsablePathMapping(m)) continue;
    if (!best || m.plexPrefix.length > best.plexPrefix.length) best = m;
  }
  if (!best) return plexPath;
  return translateWith(best, normalized) ?? plexPath;
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
