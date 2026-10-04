"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import useSWR from "swr";
import { useShouldReduceMotion } from "@/lib/motion/useReduceMotion";
import type { DashboardLayout } from "@/lib/dashboard/types";
import { isPremiumAppearance } from "@/lib/appearance/policy";
import { createPremiumPointerController } from "@/lib/appearance/premiumPointer";
import { usePlaybackActive } from "@/lib/player/PlayerProvider";
import "./premium.css";

const AppearanceContext = createContext(false);
export const usePremiumAppearance = () => useContext(AppearanceContext);

export function AppearanceProvider({ userId, children }: { userId: string | null; children: ReactNode }) {
  // Reuses the existing Settings/Home SWR request, including its mutation.
  const { data } = useSWR<{ userId: string; layout: DashboardLayout }>(userId ? "/api/dashboard/layout" : null);
  const beta = isPremiumAppearance(userId, data);
  const reduceMotion = useShouldReduceMotion();
  const playbackActive = usePlaybackActive();

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.movvizAppearance = beta ? "beta" : "stable";
    return () => { delete root.dataset.movvizAppearance; };
  }, [beta, userId]);

  useEffect(() => {
    if (!beta || reduceMotion || playbackActive) return;
    const media = window.matchMedia("(min-width: 1024px) and (hover: hover) and (pointer: fine)");
    const pointer = createPremiumPointerController(requestAnimationFrame, cancelAnimationFrame);
    const onMove = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-premium-card]") : null;
      pointer.move(media.matches && event.pointerType !== "touch" ? target : null, event.clientX, event.clientY);
    };
    const onOut = (event: PointerEvent) => {
      const source = event.target instanceof Element ? event.target.closest("[data-premium-card]") : null;
      const destination = event.relatedTarget instanceof Element ? event.relatedTarget.closest("[data-premium-card]") : null;
      if (!event.relatedTarget || (source && source !== destination)) pointer.reset();
    };
    const reset = () => pointer.reset();
    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerout", onOut, { passive: true });
    document.addEventListener("scroll", reset, { passive: true, capture: true });
    window.addEventListener("blur", reset);
    window.addEventListener("resize", reset);
    media.addEventListener("change", reset);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("scroll", reset, true);
      window.removeEventListener("blur", reset);
      window.removeEventListener("resize", reset);
      media.removeEventListener("change", reset);
      pointer.reset();
    };
  }, [beta, reduceMotion, playbackActive]);

  return <AppearanceContext.Provider value={beta}>{children}</AppearanceContext.Provider>;
}
