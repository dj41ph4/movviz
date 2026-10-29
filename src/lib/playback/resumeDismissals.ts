import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "resume-dismissals.json");

type Store = Record<string, Record<string, number>>;

/** Identité d'un titre dans « Reprendre » : un film, ou une série entière (une
 *  seule carte par série, quel que soit l'épisode proposé). */
export function resumeIdentity(type: "movie" | "series", tmdbId: number): string {
  return `${type}:${tmdbId}`;
}

/**
 * « Retirer de Reprendre » : Movviz retient le retrait lui-même, sans dépendre
 * de Plex ni de la position de lecture. Plusieurs sources (On Deck de Plex,
 * « épisode suivant » reconstruit depuis l'historique, positions locales)
 * peuvent sinon réintroduire le titre juste après. Il ne revient qu'avec une
 * lecture plus récente que le retrait.
 */
export function dismissFromResume(userId: string, identity: string, at = Date.now()): void {
  const store = readJsonCached<Store>(FILE, {});
  writeJsonCached(FILE, { ...store, [userId]: { ...(store[userId] ?? {}), [identity]: at } });
}

export function resumeDismissals(userId: string): Record<string, number> {
  return readJsonCached<Store>(FILE, {})[userId] ?? {};
}
