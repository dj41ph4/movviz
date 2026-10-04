"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { MotionConfig } from "framer-motion";
import { REDUCE_MOTION_STORAGE_KEY } from "@/lib/gpu/reduceMotionInit";

interface GpuContextValue {
  reduceAnimations: boolean;
  setReduceAnimations: (value: boolean) => void;
}

const GpuContext = createContext<GpuContextValue>({ reduceAnimations: false, setReduceAnimations: () => {} });

/** Keep the deployed default rendering; animation reduction is the only
 * personal graphics preference. Legacy component name preserves consumers. */
export function GpuProvider({ children }: { children: React.ReactNode }) {
  const [reduceAnimations, setReduced] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try { setReduced(localStorage.getItem(REDUCE_MOTION_STORAGE_KEY) === "1"); } catch {}
    setHydrated(true);
    let active = true;
    fetch("/api/settings/preferences", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (active && typeof data?.prefs?.reduceAnimations === "boolean") setReduced(data.prefs.reduceAnimations);
      })
      .catch(() => {});
    return () => { active = false; };
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
    fetch("/api/settings/preferences", {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ reduceAnimations: value }),
    }).catch(() => {});
  }, []);
  const value = useMemo(() => ({ reduceAnimations, setReduceAnimations }), [reduceAnimations, setReduceAnimations]);

  return (
    <GpuContext.Provider value={value}>
      <MotionConfig reducedMotion={reduceAnimations ? "always" : "user"}>{children}</MotionConfig>
    </GpuContext.Provider>
  );
}

export function useGpu() { return useContext(GpuContext); }
