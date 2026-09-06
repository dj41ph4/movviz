"use client";

import { cn } from "@/lib/utils";

const SIZES = {
  sm: { outer: "h-10 w-10", inner: "h-10 w-10" },
  md: { outer: "h-14 w-14", inner: "h-11 w-11" },
  lg: { outer: "h-16 w-16", inner: "h-12 w-12" },
} as const;

/**
 * Identité unique Movviz. Le fichier source est le nouveau logo officiel :
 * sidebar, login, lecteur et favicon affichent donc exactement le même signe.
 */
export function AnimatedLogo({ size = "md" }: { size?: keyof typeof SIZES }) {
  const s = SIZES[size];

  return (
    <div className={cn("relative flex items-center justify-center", s.outer)}>
      <img
        src="/brand/movviz-mark.png"
        alt="Movviz"
        className={cn("h-full w-full object-contain", s.inner)}
      />
    </div>
  );
}
