"use client";

import { cn } from "@/lib/utils";
import "./animated-logo.css";

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
      {/* Stable garde le PNG officiel ; la bêta affiche le nouveau symbole animé (SVG). Le choix se fait en CSS
          (attribut posé sur <html> par AppearanceProvider) : aucune dépendance au contexte, donc valable sur login/setup aussi. */}
      <img
        src="/brand/movviz-mark.png"
        alt="Movviz"
        fetchPriority="high"
        loading="eager"
        className={cn("mv-logo-stable h-full w-full object-contain", s.inner)}
      />
      <img
        src="/brand/movviz-mark-animated.svg"
        alt=""
        aria-hidden="true"
        loading="eager"
        className={cn("mv-logo-beta hidden h-full w-full object-contain", s.inner)}
      />
    </div>
  );
}
