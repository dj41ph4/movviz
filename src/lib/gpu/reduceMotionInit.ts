/** beforeInteractive — applies the effects classes before first paint (no logo flash). */
export const REDUCE_MOTION_STORAGE_KEY = "movviz-reduce-animations";
/** Niveau d'effets de cet appareil. La clé historique ci-dessus reste écrite
 *  ("1" dès que les animations sont coupées) pour les navigateurs déjà réglés. */
export const EFFECTS_LEVEL_STORAGE_KEY = "movviz-effects-level";
/**
 * - full : tout (animations, bandes-annonces, halo du Hero).
 * - balanced : plus d'animations ni de halo, mais les bandes-annonces
 *   d'ambiance restent (Hero, fiche, survol des cartes).
 * - smooth : plus rien de tout cela.
 */
export type EffectsLevel = "full" | "balanced" | "smooth";
/** Classe posée sur <html> au niveau « balanced » : animations coupées (reduce-motion), vidéos gardées. */
export const KEEP_VIDEOS_CLASS = "keep-ambient-videos";

export function readEffectsLevel(storage: Pick<Storage, "getItem">): EffectsLevel {
  const reduced = storage.getItem(REDUCE_MOTION_STORAGE_KEY) === "1";
  if (!reduced) return "full";
  return storage.getItem(EFFECTS_LEVEL_STORAGE_KEY) === "balanced" ? "balanced" : "smooth";
}

export const REDUCE_MOTION_INIT_SCRIPT = `
(function () {
  try {
    var root = document.documentElement;
    var stored = window.localStorage.getItem("${REDUCE_MOTION_STORAGE_KEY}");
    if (stored === "1") root.classList.add("reduce-motion");
    else if (stored === "0") root.classList.remove("reduce-motion");
    var balanced = stored === "1" && window.localStorage.getItem("${EFFECTS_LEVEL_STORAGE_KEY}") === "balanced";
    root.classList.toggle("${KEEP_VIDEOS_CLASS}", balanced);
  } catch (e) {}
})();
`;
