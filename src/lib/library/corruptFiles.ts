import fs from "node:fs";
import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import { loadMovies, loadSeries } from "@/lib/library/store";

/**
 * Détection des fichiers vides ou incomplets de la bibliothèque, sans ffprobe :
 * des fichiers pré-alloués (torrent jamais complété, copie interrompue) ont
 * leur taille finale mais des zones entières de zéros. On échantillonne
 * quelques blocs répartis sur le fichier ; un média valide n'a pas de bloc de
 * 4 Ko entièrement nul en son début, et très peu ailleurs.
 */

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "corrupt-files.json");

const BLOCK = 4096;
const SAMPLES = 24;
/** Part de blocs nuls à partir de laquelle un fichier est jugé incomplet. */
const ZERO_RATIO_LIMIT = 0.2;

export type CorruptReason = "empty" | "zero_head" | "partial" | "unreadable";

export interface FileInspection {
  ok: boolean;
  reason: CorruptReason | null;
  size: number;
  zeroBlocks: number;
  sampled: number;
}

export interface CorruptItem {
  kind: "movie" | "episode";
  /** Identifiant du film ou de la série. */
  id: string;
  title: string;
  seasonNumber?: number;
  episodeNumber?: number;
  path: string;
  size: number;
  reason: CorruptReason;
  /** Part des blocs échantillonnés entièrement nuls (0 à 1). */
  zeroRatio: number;
}

export interface CorruptReport {
  scannedAt: number | null;
  checked: number;
  /** Fichiers dont le chemin n'existe plus sur le disque, ignorés de la liste. */
  missing: number;
  items: CorruptItem[];
}

export async function inspectFile(filePath: string): Promise<FileInspection | null> {
  let size: number;
  try {
    size = (await fs.promises.stat(filePath)).size;
  } catch {
    return null; // absent : ce n'est pas un fichier corrompu
  }
  if (size === 0) return { ok: false, reason: "empty", size, zeroBlocks: 0, sampled: 0 };

  let handle: fs.promises.FileHandle | null = null;
  try {
    handle = await fs.promises.open(filePath, "r");
    const blocks = Math.ceil(size / BLOCK);
    const sampled = Math.min(SAMPLES, blocks);
    const buf = Buffer.alloc(BLOCK);
    let zeroBlocks = 0;
    let headZero = false;
    for (let i = 0; i < sampled; i++) {
      const block = sampled === 1 ? 0 : Math.round((i * (blocks - 1)) / (sampled - 1));
      const { bytesRead } = await handle.read(buf, 0, BLOCK, block * BLOCK);
      let zero = bytesRead > 0;
      for (let j = 0; j < bytesRead; j++) {
        if (buf[j] !== 0) { zero = false; break; }
      }
      if (zero) {
        zeroBlocks++;
        if (i === 0) headZero = true;
      }
    }
    const ratio = zeroBlocks / sampled;
    const reason: CorruptReason | null = headZero ? "zero_head" : ratio >= ZERO_RATIO_LIMIT ? "partial" : null;
    return { ok: reason === null, reason, size, zeroBlocks, sampled };
  } catch {
    return { ok: false, reason: "unreadable", size, zeroBlocks: 0, sampled: 0 };
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

export function saveCorruptReport(report: CorruptReport): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(FILE, report);
}

export function loadCorruptReport(): CorruptReport {
  return readJsonCached<CorruptReport>(FILE, { scannedAt: null, checked: 0, missing: 0, items: [] });
}

interface Candidate {
  kind: "movie" | "episode";
  id: string;
  title: string;
  seasonNumber?: number;
  episodeNumber?: number;
  path: string;
}

function collectCandidates(): Candidate[] {
  const out: Candidate[] = [];
  for (const movie of loadMovies()) {
    const p = movie.file?.diskPath ?? movie.file?.path;
    if (p) out.push({ kind: "movie", id: movie.id, title: movie.title, path: p });
  }
  for (const series of loadSeries()) {
    for (const season of series.seasons) {
      for (const ep of season.episodes) {
        const p = ep.file?.diskPath ?? ep.file?.path;
        // Un épisode en cours de téléchargement est incomplet par nature.
        if (!p || ep.activeInfoHash || ep.status === "downloading") continue;
        out.push({ kind: "episode", id: series.id, title: series.title, seasonNumber: season.seasonNumber, episodeNumber: ep.episodeNumber, path: p });
      }
    }
  }
  return out;
}

export async function scanCorruptFiles(
  onProgress?: (current: number, total: number) => void,
  opts?: { shouldCancel?: () => boolean }
): Promise<CorruptReport> {
  const candidates = collectCandidates();
  const items: CorruptItem[] = [];
  let checked = 0;
  let missing = 0;
  for (let i = 0; i < candidates.length; i++) {
    if (opts?.shouldCancel?.()) break;
    onProgress?.(i, candidates.length);
    const c = candidates[i];
    const result = await inspectFile(c.path);
    if (!result) { missing++; continue; }
    checked++;
    if (result.ok || !result.reason) continue;
    items.push({
      kind: c.kind,
      id: c.id,
      title: c.title,
      seasonNumber: c.seasonNumber,
      episodeNumber: c.episodeNumber,
      path: c.path,
      size: result.size,
      reason: result.reason,
      zeroRatio: result.sampled > 0 ? result.zeroBlocks / result.sampled : 0,
    });
  }
  onProgress?.(candidates.length, candidates.length);
  const report: CorruptReport = { scannedAt: Date.now(), checked, missing, items };
  saveCorruptReport(report);
  return report;
}
