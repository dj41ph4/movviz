/** Fluidité ressentie : un site ne peut pas lire la charge du processeur, mais il
 *  voit l'écart entre deux images. Mesure par périodes courtes et espacées, pour
 *  ne pas devenir elle-même une charge. */
export const SMOOTHNESS_FIRST_DELAY_MS = 20_000;
export const SMOOTHNESS_WINDOW_MS = 8_000;
export const SMOOTHNESS_GAP_MS = 20_000;
export const SMOOTHNESS_REQUIRED_WINDOWS = 3;
export const SMOOTHNESS_SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;

/** Sous 30 images/s : un 30 images/s bien régulier est un cas normal (mode économie
 *  d'énergie, navigateur intégré) et ne doit jamais déclencher la proposition. */
const MIN_FPS = 24;
const SLOW_FRAME_MS = 50;
const MAX_SLOW_SHARE = 0.25;
/** Au-delà, le navigateur a suspendu la page (fenêtre masquée) : rien à conclure.
 *  Assez haut pour qu'un vrai gel d'une ou deux secondes compte comme une difficulté. */
const SUSPENDED_FRAME_MS = 5_000;
const MIN_FRAMES = 10;

export type SmoothnessVerdict = "smooth" | "struggling" | "invalid";

export function assessFrames(deltas: readonly number[]): SmoothnessVerdict {
  if (deltas.length < MIN_FRAMES || deltas.some((delta) => delta > SUSPENDED_FRAME_MS)) return "invalid";
  const total = deltas.reduce((sum, delta) => sum + delta, 0);
  if (total <= 0) return "invalid";
  const fps = deltas.length / (total / 1000);
  const slowShare = deltas.filter((delta) => delta > SLOW_FRAME_MS).length / deltas.length;
  return fps < MIN_FPS || slowShare >= MAX_SLOW_SHARE ? "struggling" : "smooth";
}

/** Une seule période fluide efface tout : seule une difficulté qui dure compte. */
export function nextStreak(streak: number, verdict: SmoothnessVerdict): number {
  if (verdict === "invalid") return streak;
  return verdict === "struggling" ? streak + 1 : 0;
}

/** La proposition est mémorisée par appareil, comme le mode fluide lui-même : un appareil
 *  qui rame ne doit pas décider pour les autres, ni être décidé par eux. */
const SNOOZE_STORAGE_KEY = "movviz-smoothness-snooze-until";

export function readSmoothnessSnooze(): number {
  try { return Number(window.localStorage.getItem(SNOOZE_STORAGE_KEY)) || 0; } catch { return 0; }
}

export function writeSmoothnessSnooze(until: number = Date.now() + SMOOTHNESS_SNOOZE_MS): void {
  try { window.localStorage.setItem(SNOOZE_STORAGE_KEY, String(until)); } catch {}
}
