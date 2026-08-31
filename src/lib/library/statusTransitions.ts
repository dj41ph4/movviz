import fs from "node:fs";
import path from "node:path";
import type { LibraryStatus } from "@/lib/library/types";

/**
 * Traçabilité des transitions de statut — décision de cadrage LOT2.1b :
 * plutôt que de remplacer `LibraryStatus` par une machine à états à 7+
 * valeurs (voir le plan v1.10.1), on garde l'enum actuel intact et on
 * journalise chaque changement à côté. Consommé par Doctor Movviz (LOT4.4)
 * et par l'affichage "Pourquoi cette décision ?" (LOT4.3). Même pattern
 * borné + écriture disque asynchrone coalescée que searchLog.ts — jamais
 * d'écriture synchrone bloquante sur le chemin d'une requête utilisateur.
 */

const MAX_LINES = 5000;
const WRITE_COALESCE_MS = 5000;

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");

const FILE = path.join(CONFIG_DIR, "status-transitions-log.json");

export interface StatusTransition {
  t: number;
  refType: "movie" | "episode";
  refId: string; // movie id, or "seriesId:season:episode" for an episode
  title: string;
  from: LibraryStatus;
  to: LibraryStatus;
}

const g = globalThis as typeof globalThis & {
  __movvizStatusLog?: StatusTransition[];
  __movvizStatusLogTimer?: ReturnType<typeof setTimeout> | null;
};
const buffer: StatusTransition[] = (g.__movvizStatusLog ??= []);

function loadFromDisk(): StatusTransition[] {
  try {
    if (fs.existsSync(FILE)) return JSON.parse(fs.readFileSync(FILE, "utf8")) as StatusTransition[];
  } catch {
    // corrupt or missing file — start fresh
  }
  return [];
}

if (buffer.length === 0) {
  for (const line of loadFromDisk()) buffer.push(line);
}

function flushToDisk() {
  try {
    const dir = path.dirname(FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmp = `${FILE}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(buffer), "utf8");
    fs.renameSync(tmp, FILE);
  } catch (err) {
    console.error("[statusTransitions] failed to persist:", err);
  }
}

function scheduleFlush() {
  if (g.__movvizStatusLogTimer) clearTimeout(g.__movvizStatusLogTimer);
  g.__movvizStatusLogTimer = setTimeout(() => {
    g.__movvizStatusLogTimer = null;
    flushToDisk();
  }, WRITE_COALESCE_MS);
}

export function recordStatusTransition(entry: Omit<StatusTransition, "t">) {
  if (entry.from === entry.to) return;
  buffer.push({ t: Date.now(), ...entry });
  while (buffer.length > MAX_LINES) buffer.shift();
  scheduleFlush();
}

/** Most recent transitions first — optionally scoped to one title. */
export function getStatusTransitions(refId?: string): StatusTransition[] {
  const list = refId ? buffer.filter((e) => e.refId === refId) : buffer;
  return [...list].reverse();
}
