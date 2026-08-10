/**
 * Voies de priorité (lanes) pour les requêtes indexeurs : "user" (défaut —
 * déclenchée par un clic utilisateur) vs "background" (boucles automatiques,
 * tâches planifiées).
 *
 * Utilise AsyncLocalStorage (node:async_hooks — disponible en runtime Node
 * Next.js) : le contexte se propage à travers les await, donc les
 * searchMovie/searchTv/searchIndexer/grabPayload appelés depuis une fonction
 * de fond enveloppée par runBackground héritent automatiquement de la voie
 * "background" — aucune modification des chemins de recherche eux-mêmes.
 *
 * Voie par défaut = "user" : tout chemin NON enveloppé (route
 * /api/indexers/search, boutons « rechercher » de la bibliothèque…) est
 * prioritaire sans rien avoir à faire.
 */

import { AsyncLocalStorage } from "node:async_hooks";

export type Lane = "user" | "background";

const store = new AsyncLocalStorage<Lane>();

/** Exécute fn dans la voie "background" — la voie se propage à tous ses awaits. */
export function runBackground<T>(fn: () => Promise<T>): Promise<T> {
  return store.run("background", fn);
}

/** Voie du contexte asynchrone courant ; défaut : "user". */
export function currentLane(): Lane {
  return store.getStore() ?? "user";
}
