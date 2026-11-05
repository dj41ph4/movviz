import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";

/**
 * Mémoire des tâches de fond : « ce travail a déjà été fait pour cet élément, à cette date ».
 * Elle survit aux redémarrages (chaque mise à jour en provoque un), alors qu'un état gardé en
 * mémoire vive forçait un passage complet à chaque démarrage.
 *
 * Une entrée ne vaut que pour une « signature » (règles, version du fichier…) : si elle change,
 * le travail est refait. Les écritures sont groupées par fsJsonCache.
 */
const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "task-memory.json");

interface Entry {
  /** Dernier passage (ms). */
  at: number;
  /** Ce qui rend ce passage caduc quand ça change (règles, taille du fichier…). */
  sig?: string;
}
type Store = Record<string, Record<string, Entry>>;

function read(): Store {
  return readJsonCached<Store>(FILE, {});
}

/** L'élément a-t-il été traité il y a moins de `maxAgeMs`, avec la même signature ? */
export function isFresh(scope: string, key: string, maxAgeMs: number, sig?: string, now = Date.now()): boolean {
  const entry = read()[scope]?.[key];
  if (!entry) return false;
  if (sig !== undefined && entry.sig !== sig) return false;
  return now - entry.at < maxAgeMs;
}

export function lastDoneAt(scope: string, key: string): number {
  return read()[scope]?.[key]?.at ?? 0;
}

/** Note un passage. `jitterMs` étale les prochaines échéances pour qu'elles ne tombent pas toutes le même jour. */
export function markDone(scope: string, key: string, sig?: string, jitterMs = 0, now = Date.now()): void {
  markManyDone(scope, [key], sig, jitterMs, now);
}

export function markManyDone(scope: string, keys: string[], sig?: string, jitterMs = 0, now = Date.now()): void {
  if (keys.length === 0) return;
  const store = { ...read() };
  const bucket = { ...(store[scope] ?? {}) };
  for (const key of keys) bucket[key] = { at: now - (jitterMs > 0 ? hashOf(key) % jitterMs : 0), ...(sig !== undefined ? { sig } : {}) };
  store[scope] = bucket;
  writeJsonCached(FILE, store);
}

/** Oublie les éléments d'une portée qui n'existent plus (évite que le fichier grossisse sans fin). */
export function pruneScope(scope: string, keep: Set<string>): void {
  const store = read();
  const bucket = store[scope];
  if (!bucket) return;
  const kept = Object.fromEntries(Object.entries(bucket).filter(([key]) => keep.has(key)));
  if (Object.keys(kept).length === Object.keys(bucket).length) return;
  writeJsonCached(FILE, { ...store, [scope]: kept });
}

/** Pour un état plus riche qu'une date (ensembles, signatures). */
export function readState<T>(scope: string, fallback: T): T {
  return (read()[scope] as unknown as { __state?: T } | undefined)?.__state ?? fallback;
}

export function writeState<T>(scope: string, value: T): void {
  writeJsonCached(FILE, { ...read(), [scope]: { __state: value } as unknown as Record<string, Entry> });
}

function hashOf(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
