"use client";

import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";
import "./animated-logo.css";

const SIZES = {
  sm: { outer: "h-10 w-10", inner: "h-10 w-10", full: "h-8" },
  md: { outer: "h-14 w-14", inner: "h-11 w-11", full: "h-9" },
  lg: { outer: "h-16 w-16", inner: "h-12 w-12", full: "h-11" },
  xl: { outer: "h-16 w-16", inner: "h-12 w-12", full: "h-14" },
} as const;

/**
 * Identité unique Movviz : sidebar, login, lecteur, réglages affichent le même logo.
 *
 * Design stable : le symbole officiel (public/brand/movviz-mark.png), inchangé.
 * Design bêta : le « M ruban » — logo horizontal (M + MOVVIZ) partout, `variant="mark"` pour le M
 * seul (sidebar repliée), avec un reflet discret qui le traverse de temps en temps. Le choix entre
 * les deux designs se fait en CSS (attribut posé sur <html> par AppearanceProvider), donc il vaut
 * aussi hors application (connexion, installation). fetchPriority="high" : ce logo est toujours
 * au-dessus de la ligne de flottaison, dès le premier rendu.
 */
export function AnimatedLogo({ size = "md", variant = "full" }: { size?: keyof typeof SIZES; variant?: "full" | "mark" }) {
  const s = SIZES[size];
  const mark = variant === "mark";
  const src = mark ? (size === "sm" ? BRAND.markSmall : BRAND.mark) : BRAND.logoSmall;
  const srcSet = mark ? `${BRAND.markSmall} 128w, ${BRAND.mark} 640w` : `${BRAND.logoSmall} 480w, ${BRAND.logo} 960w`;

  return (
    <div data-variant={variant} className={cn("mv-logo-box relative flex items-center justify-center", s.outer)}>
      <img
        src="/brand/movviz-mark.png"
        alt="Movviz"
        fetchPriority="high"
        loading="eager"
        className={cn("mv-logo-stable h-full w-full object-contain", s.inner)}
      />
      <span className={cn("mv-logo-beta mv-logo-shine relative hidden", mark ? s.inner : s.full)} style={{ "--mv-logo-src": `url("${src}")` } as CSSProperties}>
        <img
          src={src}
          srcSet={srcSet}
          sizes={mark ? "64px" : "320px"}
          alt={mark ? "" : "Movviz"}
          aria-hidden={mark ? true : undefined}
          fetchPriority="high"
          loading="eager"
          className="h-full w-auto max-w-full object-contain"
        />
      </span>
    </div>
  );
}
