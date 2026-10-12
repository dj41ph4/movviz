"use client";

import { useEffect, type ReactNode } from "react";
import { useShouldReduceMotion } from "@/lib/motion/useReduceMotion";
import { createPremiumPointerController } from "@/lib/appearance/premiumPointer";
import { usePlaybackActive } from "@/lib/player/PlayerProvider";
import "./premium.css";
import "./salle-obscure.css";

/** Beta is the only appearance: `data-movviz-appearance="beta"` is set on
 *  <html> by the root layout. This only drives the desktop pointer effects. */
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const reduceMotion = useShouldReduceMotion();
  const playbackActive = usePlaybackActive();

  useEffect(() => {
    if (reduceMotion || playbackActive) return;
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
  }, [reduceMotion, playbackActive]);

  return <>{children}</>;
}
