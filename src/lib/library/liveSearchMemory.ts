import { isFresh, markDone } from "@/lib/library/taskMemory";

/**
 * Remplacements par meilleure version : une recherche directe aux indexeurs qui n'a rien donné
 * pour un fichier n'est pas refaite avant 3 jours, tant que ni le fichier ni les règles ne
 * changent. Sans cela, le budget de recherches par passage était dépensé chaque fois sur les
 * mêmes premiers titres, et les suivants n'étaient jamais examinés.
 */
const SCOPE = "upgrade-live-search";
const RECHECK_MS = 3 * 24 * 60 * 60 * 1000;

export function liveSearchRecentlyEmpty(kind: string, key: string, signature: string): boolean {
  return isFresh(SCOPE, `${kind}:${key}`, RECHECK_MS, signature);
}

export function noteLiveSearchEmpty(kind: string, key: string, signature: string): void {
  markDone(SCOPE, `${kind}:${key}`, signature, Math.floor(RECHECK_MS / 4));
}
