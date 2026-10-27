/**
 * Plage horaire d'une tâche planifiée : elle ne démarre que dans cette tranche de la
 * journée, sans toucher à son intervalle (« 1 fois par mois, entre 4 h et 6 h »).
 * Heures entières 0-23 à l'heure locale du serveur ; la fin est exclue (4 → 6 = de
 * 04:00 à 05:59) et la plage peut passer minuit (22 → 2).
 */

export interface TaskWindow {
  startHour: number;
  endHour: number;
}

const isHour = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 23;

/** Valide une plage reçue de l'extérieur ; null si absente ou invalide (début = fin n'a pas de sens). */
export function parseTaskWindow(raw: unknown): TaskWindow | null {
  if (!raw || typeof raw !== "object") return null;
  const { startHour, endHour } = raw as Record<string, unknown>;
  if (!isHour(startHour) || !isHour(endHour) || startHour === endHour) return null;
  return { startHour, endHour };
}

export function isInTaskWindow(at: number | Date, window: TaskWindow | null | undefined): boolean {
  if (!window) return true;
  const hour = new Date(at).getHours();
  const { startHour, endHour } = window;
  return startHour < endHour ? hour >= startHour && hour < endHour : hour >= startHour || hour < endHour;
}

/** Premier instant ≥ `at` qui tombe dans la plage (`at` lui-même s'il y est déjà). */
export function nextInTaskWindow(at: number, window: TaskWindow | null | undefined): number {
  if (!window || isInTaskWindow(at, window)) return at;
  const next = new Date(at);
  next.setHours(window.startHour, 0, 0, 0);
  if (next.getTime() < at) next.setDate(next.getDate() + 1);
  return next.getTime();
}

/** Fuseau du serveur, pour que l'interface dise de quelle heure on parle. */
export function serverTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
