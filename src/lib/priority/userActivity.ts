/**
 * Détection d'activité utilisateur (process-wide).
 *
 * Toute route API authentifiée marque l'activité via markUserActivity()
 * (voir auth/guard.ts — le point d'entrée unique de toutes les routes). Les
 * boucles d'arrière-plan (bulk « Rechercher les manquants », tâches planifiées
 * RSS, upgrades qualité…) consultent isUserActive() / yieldToUser() au début
 * de chaque itération : quand l'utilisateur clique, elles cèdent la main et
 * reprennent après quelques secondes d'inactivité — le ralentissement est
 * toujours côté arrière-plan, jamais côté utilisateur.
 *
 * Ancré sur globalThis (convention AGENTS.md) : partagé entre les bundles
 * Next.js du même processus, survit au HMR. Timestamp en mémoire seulement —
 * rien à persister ; au redémarrage la valeur tombe à zéro, ce qui est
 * exactement le comportement voulu (personne n'est actif à froid).
 */

// Fenêtre pendant laquelle une interaction utilisateur est considérée
// « récente » (isUserActive).
const ACTIVE_WINDOW_MS = 2_500;
// Délai d'inactivité après lequel une boucle de fond reprend son travail.
const IDLE_RESUME_MS = 4_000;
// Plafond : une boucle ne cède jamais plus longtemps que ça, même si
// l'utilisateur continue de cliquer — l'arrière-plan finit toujours par
// progresser (au pire 30 s de latence sur une boucle, jamais bloqué à vie).
const MAX_YIELD_MS = 30_000;
const YIELD_STEP_MS = 1_000;

const g = globalThis as typeof globalThis & { __movvizLastUserActivity?: number };

/** Enregistre une interaction utilisateur — appelé par requireUser/requireAdmin. */
export function markUserActivity() {
  g.__movvizLastUserActivity = Date.now();
}

/** Un utilisateur a-t-il interagi dans les ACTIVE_WINDOW_MS dernières ms ? */
export function isUserActive(): boolean {
  const last = g.__movvizLastUserActivity;
  if (last == null) return false;
  return Date.now() - last < ACTIVE_WINDOW_MS;
}

/**
 * Cède la main à l'utilisateur : si personne n'a interagi depuis
 * IDLE_RESUME_MS, retour immédiat (coût nul — un simple check de timestamp,
 * utilisé à chaque itération de boucle). Sinon, dort par pas de
 * YIELD_STEP_MS jusqu'à ce qu'il y ait IDLE_RESUME_MS d'inactivité, plafonné
 * à MAX_YIELD_MS au total. La condition relit le timestamp à chaque pas :
 * si l'utilisateur continue de cliquer, le yield se prolonge (jusqu'au
 * plafond) au lieu de repartir en pleine activité.
 */
export async function yieldToUser(): Promise<void> {
  const last = g.__movvizLastUserActivity;
  if (last == null || Date.now() - last >= IDLE_RESUME_MS) return;
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const now = Date.now();
    if (now - g.__movvizLastUserActivity! >= IDLE_RESUME_MS) return;
    if (now - start >= MAX_YIELD_MS) return;
    await new Promise<void>((resolve) => setTimeout(resolve, YIELD_STEP_MS));
  }
}
