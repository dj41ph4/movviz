"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useShouldReduceMotion } from "@/lib/motion/useReduceMotion";
import { computeMorphOrigin, estimateFullscreenGeometry, type MorphTransform, type Rect } from "@/lib/motion/morphOrigin";
import { getDominantColor, type DominantColorResult } from "@/lib/media/dominantColor";
import { VideoPlayer, type VideoPlayerProps } from "./VideoPlayer";

type TheaterModePlayerProps = Pick<VideoPlayerProps, "ratingKey" | "movvizId" | "plexUrl" | "title" | "useTranscode" | "prebufferSeconds"> & {
  tmdbId?: number;
  type?: "movie" | "series";
  seasonNumber?: number;
  episodeNumber?: number;
  originRect?: Rect;
  onClose: () => void;
  /** Backdrop wins for ambience extraction; poster is the fallback for
   *  call sites (LibraryMovieCard) that only ever have a poster on hand. */
  backdropUrl?: string | null;
  posterUrl?: string | null;
};

const EASE = [0.22, 1, 0.36, 1] as const;
const DURATION = 0.45;

/**
 * Immersive expand/collapse shell around the existing VideoPlayer — owns
 * positioning, the backdrop dim/blur layer, body scroll-lock, and dvh-safe
 * fullscreen sizing. VideoPlayer's own playback internals (decode engine,
 * controls, quality menu) are untouched; this only ever renders it with
 * `embedded` so it fills whatever box this component gives it.
 *
 * Same manual-morph technique as TitlePanel.tsx (see morphOrigin.ts) rather
 * than a Framer Motion layoutId crossfade — cheaper on layout-heavy pages
 * and gives frame-accurate control over the easing curve. The only
 * difference from TitlePanel: the end geometry is always true fullscreen,
 * never a bounded modal.
 */
export function TheaterModePlayer({ originRect, onClose, backdropUrl, posterUrl, tmdbId, type, title, seasonNumber, episodeNumber, ...playerProps }: TheaterModePlayerProps) {
  const reduceMotion = useShouldReduceMotion();
  const ambienceSrc = backdropUrl ?? posterUrl ?? null;
  const [ambience, setAmbience] = useState<DominantColorResult | null>(null);

  // Record "quoi + quand" for direct Movviz playback — fire-and-forget, the
  // player must never be blocked by the network. Only fires when the caller
  // actually knows the TMDb identity of the watched item.
  useEffect(() => {
    if (tmdbId == null || !type) return;
    fetch("/api/ai/watched", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tmdbId, type, title }),
    }).catch(() => {});
  }, [tmdbId, type, title]);

  // Runs once per unique image (module-level cache in dominantColor.ts makes
  // repeat opens of the same title instant) — never on a playback tick, per
  // spec: analyze once, cache, no re-analysis while watching.
  useEffect(() => {
    let cancelled = false;
    getDominantColor(ambienceSrc).then((result) => {
      if (!cancelled) setAmbience(result);
    });
    return () => { cancelled = true; };
  }, [ambienceSrc]);
  // Captured once at open — reused verbatim on close so the shell always
  // returns to its true point of origin, even if the page has scrolled
  // behind the overlay since (spec: close = exact reverse of open).
  const [morph] = useState<MorphTransform | null>(() => {
    if (!originRect || reduceMotion) return null;
    const final = estimateFullscreenGeometry();
    return final ? computeMorphOrigin(originRect, final) : null;
  });
  const [lowerBlur, setLowerBlur] = useState(false);

  useEffect(() => {
    // backdrop-filter blur is one of the more GPU-costly filters on
    // lower-end mobile GPUs/older iOS — halve it below the sm breakpoint.
    const mq = window.matchMedia("(max-width: 639px)");
    setLowerBlur(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setLowerBlur(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, []);

  // Very bright source art still gets a darker scrim (spec: "contenu très
  // lumineux -> ambiance sombre mais avec profondeur") — brightness pushes
  // the scrim darker, never lighter than the baseline. Capped well below
  // opaque: this scrim sits on top of the color gradient, so a previous,
  // near-opaque version of this value (up to 0.92) was crushing the entire
  // ambience effect to flat black regardless of source art — confirmed live
  // ("noir sur fond noir"). It only needs to keep the letterbox area from
  // ever reading as fully saturated, not erase the color.
  const scrimOpacity = ambience ? Math.min(0.6, 0.32 + ambience.brightness * 0.25) : 0.45;
  const ambienceStyle = ambience
    ? ({
        "--theater-ambience-1": `hsl(${ambience.dominant.h} ${Math.round(ambience.dominant.s * 100)}% ${Math.round(ambience.dominant.l * 100)}%)`,
        "--theater-ambience-2": `hsl(${ambience.secondary.h} ${Math.round(ambience.secondary.s * 100)}% ${Math.round(ambience.secondary.l * 100)}%)`,
      } as React.CSSProperties)
    : undefined;

  return (
    <div className="fixed inset-0 z-[100] h-[100dvh] w-screen" style={ambienceStyle}>
      {/* Always-opaque base, rendered unconditionally and before anything
       * else — confirmed live: making VideoPlayer's own background
       * transparent (so the ambience below can show through in the
       * letterbox bars) meant that on its own, NOTHING behind it was
       * actually fully opaque: the page-dim layer below is only ~80% black
       * through an 8px blur, and the ambience group (when present) stacks
       * several partial-opacity layers with no solid base of its own. Net
       * result was the real page bleeding through visibly at the edges
       * (readable text/thumbnails) — worse than the flat black it replaced.
       * This solid layer guarantees the page can never show through again,
       * with or without ambience data (e.g. no backdrop/poster URL).
       */}
      <div className="absolute inset-0 bg-[#07070b]" />
      {/* Stacking order (spec section 13): page (blurred here) → blurred/
          color-graded backdrop → dark scrim → player → controls. */}
      <motion.div
        className="absolute inset-0 bg-black/80"
        style={{ backdropFilter: `blur(${lowerBlur ? 4 : 8}px)`, WebkitBackdropFilter: `blur(${lowerBlur ? 4 : 8}px)` }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduceMotion ? 0.15 : DURATION, ease: EASE }}
      />

      {ambienceSrc && (
        <motion.div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.15 : DURATION, ease: EASE }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ambienceSrc} alt="" className="h-full w-full scale-110 object-cover opacity-40 max-sm:blur-2xl animate-kenburns will-change-transform" />
          {ambience && (
            <motion.div
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: reduceMotion ? 0.15 : 0.5, ease: EASE }}
              style={{ background: "radial-gradient(120% 100% at 50% 20%, var(--theater-ambience-1) 0%, transparent 55%), radial-gradient(120% 100% at 50% 90%, var(--theater-ambience-2) 0%, transparent 55%)", opacity: 0.7, mixBlendMode: "screen" }}
            />
          )}
          <div className="absolute inset-0 bg-black" style={{ opacity: scrimOpacity }} />
        </motion.div>
      )}

      {/* Vignette cinématique — au-dessus du player (z-[60]), jamais
       * interactive (pointer-events-none). Opacité réduite sous 640px. */}
      <motion.div
        className="pointer-events-none absolute inset-0 z-[60] max-sm:opacity-60"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduceMotion ? 0.15 : DURATION, ease: EASE }}
        style={{ background: "radial-gradient(ellipse 80% 75% at 50% 45%, transparent 55%, rgba(2,3,8,0.5) 100%)" }}
      />

      <motion.div
        className="absolute inset-0 h-full w-full overflow-hidden"
        initial={morph ? { opacity: 0.5, x: morph.x, y: morph.y, scaleX: morph.scaleX, scaleY: morph.scaleY, borderRadius: 16 } : { opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, x: 0, y: 0, scaleX: 1, scaleY: 1, borderRadius: 0 }}
        exit={morph ? { opacity: 0, x: morph.x, y: morph.y, scaleX: morph.scaleX, scaleY: morph.scaleY, borderRadius: 16 } : { opacity: 0, scale: 0.97 }}
        transition={{ duration: reduceMotion ? 0.15 : DURATION, ease: EASE }}
        style={{ transformOrigin: "center center" }}
      >
        <VideoPlayer {...playerProps} title={title} onClose={onClose} tmdbId={tmdbId} seasonNumber={seasonNumber} episodeNumber={episodeNumber} mediaType={type === "series" ? "episode" : "movie"} embedded />
      </motion.div>
    </div>
  );
}
