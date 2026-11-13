"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { MotionConfig } from "framer-motion";
import { EFFECTS_LEVEL_STORAGE_KEY, KEEP_VIDEOS_CLASS, REDUCE_MOTION_STORAGE_KEY, readEffectsLevel, type EffectsLevel } from "@/lib/gpu/reduceMotionInit";
import { writeSmoothnessSnooze } from "@/lib/motion/smoothness";

interface GpuContextValue {
  /** Animations coupées : vrai aux niveaux « balanced » et « smooth ». */
  reduceAnimations: boolean;
  setReduceAnimations: (value: boolean) => void;
  effectsLevel: EffectsLevel;
  setEffectsLevel: (level: EffectsLevel) => void;
}

const GpuContext = createContext<GpuContextValue>({ reduceAnimations: false, setReduceAnimations: () => {}, effectsLevel: "full", setEffectsLevel: () => {} });

/** Le mode fluide est propre à l'appareil (stocké dans ce navigateur, pas sur le compte) :
 * un PC puissant et une vieille TV du même compte n'ont pas les mêmes besoins.
 * Le nom historique du composant est conservé pour ses consommateurs. */
export function GpuProvider({ children }: { children: React.ReactNode }) {
  const [effectsLevel, setLevel] = useState<EffectsLevel>("full");
  const [hydrated, setHydrated] = useState(false);
  const reduceAnimations = effectsLevel !== "full";

  useEffect(() => {
    try { setLevel(readEffectsLevel(localStorage)); } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.classList.toggle("reduce-motion", reduceAnimations);
    document.documentElement.classList.toggle(KEEP_VIDEOS_CLASS, effectsLevel === "balanced");
    document.documentElement.classList.remove("gpu-high", "gpu-low", "gpu-ultralow");
    document.documentElement.classList.add("gpu-medium");
    try {
      localStorage.setItem(REDUCE_MOTION_STORAGE_KEY, reduceAnimations ? "1" : "0");
      localStorage.setItem(EFFECTS_LEVEL_STORAGE_KEY, effectsLevel);
    } catch {}
  }, [hydrated, reduceAnimations, effectsLevel]);

  const setEffectsLevel = useCallback((level: EffectsLevel) => {
    setLevel(level);
    // Turning it off by hand is an answer too: the offer does not come straight back.
    if (level === "full") writeSmoothnessSnooze();
  }, []);
  /** Bascule historique (conseil de fluidité) : tout ou rien. */
  const setReduceAnimations = useCallback((value: boolean) => setEffectsLevel(value ? "smooth" : "full"), [setEffectsLevel]);
  const value = useMemo(() => ({ reduceAnimations, setReduceAnimations, effectsLevel, setEffectsLevel }), [reduceAnimations, setReduceAnimations, effectsLevel, setEffectsLevel]);

  return (
    <GpuContext.Provider value={value}>
      <MotionConfig reducedMotion={reduceAnimations ? "always" : "user"} transition={reduceAnimations ? { duration: 0, delay: 0 } : undefined}>{children}</MotionConfig>
    </GpuContext.Provider>
  );
}

export function useGpu() { return useContext(GpuContext); }
