"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { MotionConfig } from "framer-motion";
import { REDUCE_MOTION_STORAGE_KEY } from "@/lib/gpu/reduceMotionInit";

export type GpuTier = "high" | "medium" | "low" | "ultraLow";

export interface GpuInfo {
  renderer: string;
  vendor: string;
  tier: GpuTier;
  cores: number;
  memoryGB: number;
  /** true = kill every animation (logo, CSS, framer-motion). */
  reduceAnimations: boolean;
}

interface GpuContextValue extends GpuInfo {
  setReduceAnimations: (v: boolean) => void;
  setTier: (tier: GpuTier) => void;
}

const STORAGE_KEY = REDUCE_MOTION_STORAGE_KEY;
const TIER_STORAGE_KEY = "movviz-gpu-tier";

const TIER_CLASS: Record<GpuTier, string> = {
  high: "gpu-high",
  medium: "gpu-medium",
  low: "gpu-low",
  ultraLow: "gpu-ultralow",
};

function detectGpu(): { renderer: string; vendor: string } {
  if (typeof document === "undefined") return { renderer: "unknown", vendor: "unknown" };
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl") as WebGLRenderingContext | null;
    if (!gl) return { renderer: "unknown", vendor: "unknown" };
    const debugInfo = (gl as WebGLRenderingContext).getExtension("WEBGL_debug_renderer_info");
    if (!debugInfo) return { renderer: "unknown", vendor: "unknown" };
    return {
      renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || "unknown",
      vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || "unknown",
    };
  } catch {
    return { renderer: "unknown", vendor: "unknown" };
  }
}

function loadSavedTier(): GpuTier {
  if (typeof localStorage === "undefined") return "medium";
  try {
    const saved = localStorage.getItem(TIER_STORAGE_KEY);
    if (saved === "high" || saved === "medium" || saved === "low" || saved === "ultraLow") return saved;
  } catch {}
  return "medium";
}

function computeTier(): { tier: GpuInfo["tier"]; cores: number; memoryGB: number } {
  return { tier: loadSavedTier(), cores: 4, memoryGB: 4 };
}

const defaultValue: GpuContextValue = {
  renderer: "unknown",
  vendor: "unknown",
  tier: "medium",
  cores: 4,
  memoryGB: 4,
  reduceAnimations: false,
  setReduceAnimations: () => {},
  setTier: () => {},
};

const GpuContext = createContext<GpuContextValue>(defaultValue);

export function GpuProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [info, setInfo] = useState<GpuInfo>(() => {
    const { tier, cores, memoryGB } = computeTier();
    const gpu = detectGpu();
    return { ...gpu, tier, cores, memoryGB, reduceAnimations: false };
  });

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const { tier, cores, memoryGB } = computeTier();
    const gpu = detectGpu();
    const reduceAnimations = stored !== null ? stored === "1" : false;
    setInfo({ ...gpu, tier, cores, memoryGB, reduceAnimations });
    setHydrated(true);

    // Account-level preference, once it loads, wins over the localStorage
    // value used for instant first paint above — confirmed live: this used
    // to be device-only, so the choice reset on every new browser/device.
    // Silently ignored when logged out (login page etc.) or offline; the
    // localStorage value from just above stays in effect either way.
    fetch("/api/settings/preferences", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const prefs = d?.prefs;
        if (!prefs) return;
        setInfo((prev) => ({
          ...prev,
          tier: prefs.gpuTier ?? prev.tier,
          reduceAnimations: prefs.reduceAnimations ?? prev.reduceAnimations,
        }));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (info.reduceAnimations) {
      document.documentElement.classList.add("reduce-motion");
    } else {
      document.documentElement.classList.remove("reduce-motion");
    }
    document.documentElement.classList.remove("gpu-high", "gpu-medium", "gpu-low", "gpu-ultralow");
    document.documentElement.classList.add(TIER_CLASS[info.tier]);
    localStorage.setItem(STORAGE_KEY, info.reduceAnimations ? "1" : "0");
  }, [hydrated, info.reduceAnimations, info.tier]);

  const savePrefs = useCallback((patch: { gpuTier?: GpuTier; reduceAnimations?: boolean }) => {
    fetch("/api/settings/preferences", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => {});
  }, []);

  const setReduceAnimations = useCallback((v: boolean) => {
    setInfo((prev) => ({ ...prev, reduceAnimations: v }));
    savePrefs({ reduceAnimations: v });
  }, [savePrefs]);

  const setTier = useCallback((tier: GpuTier) => {
    setInfo((prev) => ({ ...prev, tier }));
    try { localStorage.setItem(TIER_STORAGE_KEY, tier); } catch {}
    savePrefs({ gpuTier: tier });
  }, [savePrefs]);

  const value = useMemo(
    () => ({ ...info, setReduceAnimations, setTier }),
    [info, setReduceAnimations, setTier],
  );

  return (
    <GpuContext.Provider value={value}>
      <MotionConfig reducedMotion={info.reduceAnimations ? "always" : "user"}>
        {children}
      </MotionConfig>
    </GpuContext.Provider>
  );
}

export function useGpu() {
  return useContext(GpuContext);
}
