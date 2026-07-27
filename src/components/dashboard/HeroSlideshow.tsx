"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useShouldReduceMotion } from "@/lib/motion/useReduceMotion";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

/**
 * Auto-rotating slide container — timing/navigation only, no idea what a
 * "slide" actually contains (that's `DashboardHero`'s job, via `children`).
 * Depth-cascade transition matches `DiscoverCard`'s cascade-in feel, scaled
 * up to a full-bleed slide instead of a poster tile.
 */
export interface HeroSlideshowProps {
  count: number;
  index: number;
  onIndexChange: (i: number) => void;
  intervalMs: number;
  /** Auto-rotation pauses while true (e.g. the active slide's trailer is playing, or the user is hovering). */
  paused?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function HeroSlideshow({ count, index, onIndexChange, intervalMs, paused = false, children, className }: HeroSlideshowProps) {
  const t = useT();
  const reduceMotion = useShouldReduceMotion();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    if (count <= 1 || paused || hovering || reduceMotion) return;
    timer.current = setTimeout(() => onIndexChange((index + 1) % count), intervalMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [count, index, intervalMs, paused, hovering, reduceMotion, onIndexChange]);

  if (count === 0) return null;

  const goTo = (i: number) => onIndexChange(((i % count) + count) % count);

  return (
    <div
      className={cn("relative", className)}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={reduceMotion ? false : { opacity: 0, scale: 1.03 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          {children}
        </motion.div>
      </AnimatePresence>

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            aria-label={t("dashboard.hero.previousSlide")}
            className="absolute left-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur transition-transform hover:scale-110 sm:left-4"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            aria-label={t("dashboard.hero.nextSlide")}
            className="absolute right-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur transition-transform hover:scale-110 sm:right-4"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5 sm:bottom-4">
            {Array.from({ length: count }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Slide ${i + 1}`}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === index ? "w-6 bg-white" : "w-1.5 bg-white/40 hover:bg-white/60"
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
