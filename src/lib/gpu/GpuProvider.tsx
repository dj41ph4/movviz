"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { MotionConfig } from "framer-motion";
import { REDUCE_MOTION_STORAGE_KEY } from "@/lib/gpu/reduceMotionInit";
import { SMOOTHNESS_SNOOZE_MS } from "@/lib/motion/smoothness";

interface GpuContextValue {
  reduceAnimations: boolean;
  setReduceAnimations: (value: boolean) => void;
}

const GpuContext = createContext<GpuContextValue>({ reduceAnimations: false, setReduceAnimations: () => {} });
const AUTH_PAGES = new Set(["/login", "/setup", "/privacy", "/help"]);

/** Keep the deployed default rendering; animation reduction is the only
 * personal graphics preference. Legacy component name preserves consumers. */
export function GpuProvider({ children }: { children: React.ReactNode }) {
  const [reduceAnimations, setReduced] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const pathname = usePathname();
  const sessionScope = AUTH_PAGES.has(pathname) ? pathname : "app";

  useEffect(() => {
    try { setReduced(localStorage.getItem(REDUCE_MOTION_STORAGE_KEY) === "1"); } catch {}
    setHydrated(true);
  }, []);

  // The saved value belongs to the account, localStorage only avoids a flash at
  // first paint. Re-read whenever the session may have changed (entering or leaving
  // an auth page: sign-in is a client-side navigation that keeps this provider
  // mounted). An account that never chose, or no account, gets the default rather
  // than the choice of whoever used this browser before.
  useEffect(() => {
    let active = true;
    fetch("/api/settings/preferences", { cache: "no-store" })
      .then((response) => {
        if (response.status === 401) return { prefs: {} };
        return response.ok ? response.json() : null;
      })
      .then((data) => {
        if (active && data?.prefs) setReduced(data.prefs.reduceAnimations === true);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [sessionScope]);

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
      // Turning it off by hand is an answer too: the offer does not come straight back.
      body: JSON.stringify(value ? { reduceAnimations: true } : { reduceAnimations: false, smoothnessPromptUntil: Date.now() + SMOOTHNESS_SNOOZE_MS }),
    }).catch(() => {});
  }, []);
  const value = useMemo(() => ({ reduceAnimations, setReduceAnimations }), [reduceAnimations, setReduceAnimations]);

  return (
    <GpuContext.Provider value={value}>
      <MotionConfig reducedMotion={reduceAnimations ? "always" : "user"} transition={reduceAnimations ? { duration: 0, delay: 0 } : undefined}>{children}</MotionConfig>
    </GpuContext.Provider>
  );
}

export function useGpu() { return useContext(GpuContext); }
