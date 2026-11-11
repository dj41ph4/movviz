import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Mode « téléchargement sans restriction » (admins uniquement, déclenché à la
 * main depuis une fiche film / série / épisode). Le temps d'une recherche,
 * les règles de release « mots interdits » ne s'appliquent pas : ni le veto
 * dur de l'auto-grab, ni la pénalité de score, ni le contrôle d'import après
 * téléchargement (voir markManualGrab).
 *
 * Porté par un AsyncLocalStorage : aucun paramètre à faire descendre dans
 * toute la chaîne de recherche, et aucune fuite vers les recherches
 * automatiques qui tournent en parallèle.
 */
const als = new AsyncLocalStorage<{ unrestricted: true }>();

export function runUnrestricted<T>(fn: () => Promise<T>): Promise<T> {
  return als.run({ unrestricted: true }, fn);
}

export function isUnrestricted(): boolean {
  return als.getStore()?.unrestricted === true;
}
