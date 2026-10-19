"use client";

import { cn } from "@/lib/utils";
import "./animated-logo.css";

const SIZES = {
  sm: { outer: "h-10 w-10", inner: "h-10 w-10", full: "h-6" },
  md: { outer: "h-14 w-14", inner: "h-11 w-11", full: "h-8" },
  lg: { outer: "h-16 w-16", inner: "h-12 w-12", full: "h-11" },
  xl: { outer: "h-16 w-16", inner: "h-12 w-12", full: "h-14" },
} as const;

/**
 * Identité unique Movviz : sidebar, login, lecteur, réglages affichent le même logo.
 *
 * Design stable : le symbole officiel (public/brand/movviz-mark.png), inchangé.
 * Design bêta : le logo complet petit format animé (movviz-logo-compact-animated.svg), partout ;
 * `variant="mark"` demande le symbole « O » animé seul (sidebar repliée). Le choix entre les deux
 * designs se fait en CSS (attribut posé sur <html> par AppearanceProvider), donc il vaut aussi
 * hors application (connexion, installation). Les fichiers sont les logos officiels, jamais un
 * dessin recréé à la main — fetchPriority="high" car ce logo apparaît toujours au-dessus de la
 * ligne de flottaison, dès le premier rendu.
 */
export function AnimatedLogo({ size = "md", variant = "full" }: { size?: keyof typeof SIZES; variant?: "full" | "mark" }) {
  const s = SIZES[size];

  return (
    <div data-variant={variant} className={cn("mv-logo-box relative flex items-center justify-center", s.outer)}>
      <img
        src="/brand/movviz-mark.png"
        alt="Movviz"
        fetchPriority="high"
        loading="eager"
        className={cn("mv-logo-stable h-full w-full object-contain", s.inner)}
      />
      {variant === "mark" ? (
        <img
          src="/brand/movviz-mark-animated.svg"
          alt=""
          aria-hidden="true"
          loading="eager"
          className={cn("mv-logo-beta hidden h-full w-full object-contain", s.inner)}
        />
      ) : (
        <img
          src="/brand/movviz-logo-compact-animated.svg"
          alt="Movviz"
          loading="eager"
          className={cn("mv-logo-beta hidden w-auto max-w-full object-contain", s.full)}
        />
      )}
    </div>
  );
}
