"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { MotionConfig } from "framer-motion";
import { REDUCE_MOTION_STORAGE_KEY } from "@/lib/gpu/reduceMotionInit";
import { writeSmoothnessSnooze } from "@/lib/motion/smoothness";

interface GpuContextValue {
  reduceAnimations: boolean;
  setReduceAnimations: (value: boolean) => void;
}

const GpuContext = createContext<GpuContextValue>({ reduceAnimations: false, setReduceAnimations: () => {} });

/** Le mode fluide est propre à l'appareil (stocké dans ce navigateur, pas sur le compte) :
 * un PC puissant et une vieille TV du même compte n'ont pas les mêmes besoins.
 * Le nom historique du composant est conservé pour ses consommateurs. */
export function GpuProvider({ children }: { children: React.ReactNode }) {
  const [reduceAnimations, setReduced] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try { setReduced(localStorage.getItem(REDUCE_MOTION_STORAGE_KEY) === "1"); } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.classList.toggle("reduce-motion", reduceAnimations);
    document.documentElement.classList.remove("gpu-high", "gpu-low", "gpu-ultralow");
    document.documentElement.classList.add("gpu-medium");
    try { localStorage.setItem(REDUCE_MOTION_STORAGE_KEY, reduceAnimations ? "1" : "0"); } catch {}
  }, [hydrated, reduceAnimations]);

  const setReduceAnimations = useCallback((value: boolean) => {
    setReduced(value);
    // Turning it off by hand is an answer too: the offer does not come straight back.
    if (!value) writeSmoothnessSnooze();
  }, []);
  const value = useMemo(() => ({ reduceAnimations, setReduceAnimations }), [reduceAnimations, setReduceAnimations]);

  return (
    <GpuContext.Provider value={value}>
      <MotionConfig reducedMotion={reduceAnimations ? "always" : "user"} transition={reduceAnimations ? { duration: 0, delay: 0 } : undefined}>{children}</MotionConfig>
    </GpuContext.Provider>
  );
}

export function useGpu() { return useContext(GpuContext); }
