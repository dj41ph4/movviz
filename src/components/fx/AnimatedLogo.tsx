"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";
import { useShouldReduceMotion } from "@/lib/motion/useReduceMotion";
import "./animated-logo.css";

const SIZES = {
  sm: { outer: "h-10 w-10", inner: "h-10 w-10", full: "h-8" },
  md: { outer: "h-14 w-14", inner: "h-11 w-11", full: "h-9" },
  lg: { outer: "h-16 w-16", inner: "h-12 w-12", full: "h-11" },
  xl: { outer: "h-16 w-16", inner: "h-12 w-12", full: "h-14" },
} as const;

/** Lancé passage par passage : une animation CSS sans fin réveillerait le navigateur à
 *  chaque image entre deux reflets, sur toutes les pages, sans rien changer à l'écran. */
const SHINE_DELAY_MS = 1_200;
const SHINE_EVERY_MS = 7_000;
const SHINE_SWEEP_MS = 1_960;

function useLogoShine() {
  const ref = useRef<HTMLSpanElement>(null);
  const reduceMotion = useShouldReduceMotion();
  useEffect(() => {
    const shine = ref.current;
    if (!shine || reduceMotion) return;
    const sweep = () => {
      if (document.hidden || !shine.offsetWidth) return;
      shine.animate(
        { backgroundPosition: ["130% 0", "-30% 0"] },
        { duration: SHINE_SWEEP_MS, easing: "cubic-bezier(.45, 0, .2, 1)", pseudoElement: "::after" },
      );
    };
    let interval: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      sweep();
      interval = setInterval(sweep, SHINE_EVERY_MS);
    }, SHINE_DELAY_MS);
    return () => {
      clearTimeout(start);
      clearInterval(interval);
    };
  }, [reduceMotion]);
  return ref;
}

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
  const shineRef = useLogoShine();
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
      <span ref={shineRef} className={cn("mv-logo-beta mv-logo-shine relative hidden", mark ? s.inner : s.full)} style={{ "--mv-logo-src": `url("${src}")` } as CSSProperties}>
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
