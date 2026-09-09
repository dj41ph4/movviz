"use client";

import { cn } from "@/lib/utils";

const SIZES = {
  sm: { outer: "h-10 w-10", inner: "h-10 w-10" },
  md: { outer: "h-14 w-14", inner: "h-11 w-11" },
  lg: { outer: "h-16 w-16", inner: "h-12 w-12" },
} as const;

/**
 * Identité unique Movviz : sidebar, login, lecteur et favicon affichent le
 * même mark. C'est le fichier officiel (public/brand/movviz-mark.png),
 * jamais un dessin recréé à la main — fetchPriority="high" car ce logo
 * apparaît toujours au-dessus de la ligne de flottaison, dès le premier rendu.
 */
export function AnimatedLogo({ size = "md" }: { size?: keyof typeof SIZES }) {
  const s = SIZES[size];

  return (
    <div className={cn("relative flex items-center justify-center", s.outer)}>
      <img
        src="/brand/movviz-mark.png"
        alt="Movviz"
        fetchPriority="high"
        loading="eager"
        className={cn("h-full w-full object-contain", s.inner)}
      />
    </div>
  );
}
