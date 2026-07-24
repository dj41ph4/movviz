"use client";

import { createContext, useContext, useEffect, useState } from "react";

export interface GpuInfo {
  renderer: string;
  vendor: string;
  tier: "high" | "medium" | "low";
  cores: number;
  memoryGB: number;
  reduceAnimations: boolean;
}

function detectGpu(): { renderer: string; vendor: string } {
  if (typeof document === "undefined") return { renderer: "unknown", vendor: "unknown" };
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl") as WebGLRenderingContext | null;
    if (!gl) return { renderer: "unknown", vendor: "unknown" };
    const debugInfo = (gl as any).getExtension("WEBGL_debug_renderer_info");
    if (!debugInfo) return { renderer: "unknown", vendor: "unknown" };
    return {
      renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || "unknown",
      vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || "unknown",
    };
  } catch {
    return { renderer: "unknown", vendor: "unknown" };
  }
}

function computeTier(): { tier: GpuInfo["tier"]; cores: number; memoryGB: number } {
  if (typeof navigator === "undefined") return { tier: "high", cores: 4, memoryGB: 4 };
  const cores = navigator.hardwareConcurrency || 4;
  const memoryGB = ((navigator as any).deviceMemory as number) || 4;
  const gpu = detectGpu();
  const renderer = gpu.renderer.toLowerCase();

  if (cores <= 2 || memoryGB <= 2) return { tier: "low", cores, memoryGB };
  if (renderer.includes("llvmpipe") || renderer.includes("swiftshader") || renderer.includes("microsoft basic render")) return { tier: "low", cores, memoryGB };
  if (cores <= 4 || memoryGB <= 4) return { tier: "medium", cores, memoryGB };
  return { tier: "high", cores, memoryGB };
}

const GpuContext = createContext<GpuInfo>({
  renderer: "unknown",
  vendor: "unknown",
  tier: "high",
  cores: 4,
  memoryGB: 4,
  reduceAnimations: false,
});

export function GpuProvider({ children }: { children: React.ReactNode }) {
  const [info, setInfo] = useState<GpuInfo>(() => {
    const stored = typeof localStorage !== "undefined" ? localStorage.getItem("movviz-reduce-animations") : null;
    const { tier, cores, memoryGB } = computeTier();
    const gpu = detectGpu();
    const reduceAnimations = stored !== null ? stored === "1" : tier === "low";
    return { ...gpu, tier, cores, memoryGB, reduceAnimations };
  });

  useEffect(() => {
    if (info.reduceAnimations) {
      document.documentElement.classList.add("reduce-motion");
    } else {
      document.documentElement.classList.remove("reduce-motion");
    }
    if (info.tier === "low") {
      document.documentElement.classList.add("gpu-low");
    }
    localStorage.setItem("movviz-reduce-animations", info.reduceAnimations ? "1" : "0");
  }, [info.reduceAnimations, info.tier]);

  const setReduceAnimations = (v: boolean) => setInfo((prev) => ({ ...prev, reduceAnimations: v }));

  return (
    <GpuContext.Provider value={{ ...info, reduceAnimations: info.reduceAnimations }}>
      {children}
    </GpuContext.Provider>
  );
}

export function useGpu() {
  return useContext(GpuContext);
}