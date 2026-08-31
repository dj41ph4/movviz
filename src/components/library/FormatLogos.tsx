"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
}

/**
 * Same h-[21px]/rounded-full/backdrop-blur shape as every other badge in the
 * app (see MediaBadges.tsx's BADGE_SHAPE) — a solid-enough dark fill (not a
 * translucent one) so the logo stays legible whether it's sitting over a
 * bright or a dark patch of poster artwork.
 */
function BaseBadge({ className, children }: LogoProps & { children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex h-[21px] shrink-0 items-center rounded-full border border-white/15 bg-black/70 px-2.5 leading-none backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ───────────── 4K ULTRA PREMIUM — animated brand-color badge ─────────────
 * Three animation layers running simultaneously, tuned to never clash:
 *
 *   Layer 1 — badge background  | CSS class `badge-4k-shimmer`
 *     A slow, dark, double-period gradient traveling on an absolutely
 *     positioned ::before pseudo-element, clipped to the pill shape.
 *     GPU-composited via translateX (not background-position), so the
 *     6 s loop is stutter‑free even under main‑thread load.
 *
 *   Layer 2 — border + glow      | Framer Motion
 *     The pill's border color and an outer box-shadow pulse cycle
 *     through brand → cyan → magenta → brand‑2 in a 5.5 s easeInOut
 *     sine‑like loop. The glow remains tiny (6–8 px) on purpose — it
 *     whispers "premium" instead of shouting.
 *
 *   Layer 3 — SVG text fill      | SMIL <animateTransform> inside <linearGradient>
 *     A 200 %‑wide gradient carrying the full brand palette written
 *     twice back‑to‑back (0–50 % = one period, 50–100 % = identical
 *     repeat).  The gradient is translated left by exactly one text‑
 *     width (objectBoundingBox unit‑1) over 4.5 s, then jumps back to
 *     zero — because the first and last stops are identical (#eef1ff),
 *     the jump is invisible and the flow appears continuous forever.
 *
 * Each SVG on the page gets a unique gradient id (React useId) so
 * multiple badges on the same poster row never share a definition.
 * ─────────────────────────────────────────────────────────────────────── */

export function Logo4K({ className }: LogoProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const gradientId = `g4k-${uid}`;

  return (
    <BaseBadge className={cn("px-1.5", className)}>
      <svg viewBox="0 0 24 21" className="h-full w-auto" aria-label="4K">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="2" y2="0" gradientUnits="objectBoundingBox">
            <stop offset="0%"      stopColor="#eef1ff" />
            <stop offset="10%"     stopColor="#a06bff" />
            <stop offset="22.5%"   stopColor="#ff4bd0" />
            <stop offset="35%"     stopColor="#34e2ff" />
            <stop offset="47.5%"   stopColor="#c04bff" />
            <stop offset="50%"     stopColor="#eef1ff" />
            <stop offset="60%"     stopColor="#a06bff" />
            <stop offset="72.5%"   stopColor="#ff4bd0" />
            <stop offset="85%"     stopColor="#34e2ff" />
            <stop offset="97.5%"   stopColor="#c04bff" />
            <stop offset="100%"    stopColor="#eef1ff" />
            <animateTransform attributeName="gradientTransform" type="translate" from="0 0" to="-1 0" dur="4.5s" repeatCount="indefinite" />
          </linearGradient>
        </defs>
        <text x="12" y="17" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="16" fontWeight="900" fill={`url(#${gradientId})`}>
          4K
        </text>
      </svg>
    </BaseBadge>
  );
}

export function LogoHDR({ className }: LogoProps) {
  return (
    <BaseBadge className={className}>
      <svg viewBox="0 0 40 21" className="h-full w-auto" aria-label="HDR">
        <text x="0" y="16" fontFamily="Arial,sans-serif" fontSize="15" fontWeight="900" fill="#fff">
          HDR
        </text>
      </svg>
    </BaseBadge>
  );
}

export function LogoDolbyVision({ className }: LogoProps) {
  return (
    <BaseBadge className={cn("px-3", className)}>
      <svg viewBox="0 0 48 21" className="h-full w-auto" aria-label="Dolby Vision">
        <text x="0" y="9.5" fontFamily="Arial,sans-serif" fontSize="5.5" fontWeight="800" fill="#aaa" letterSpacing="1">
          DOLBY
        </text>
        <text x="0" y="18" fontFamily="Arial,sans-serif" fontSize="9" fontWeight="900" fill="#fff" letterSpacing="0.5">
          VISION
        </text>
      </svg>
    </BaseBadge>
  );
}

export function LogoDolbyAtmos({ className }: LogoProps) {
  return (
    <BaseBadge className={cn("px-3", className)}>
      <svg viewBox="0 0 52 21" className="h-full w-auto" aria-label="Dolby Atmos">
        <text x="0" y="9.5" fontFamily="Arial,sans-serif" fontSize="5.5" fontWeight="800" fill="#aaa" letterSpacing="1">
          DOLBY
        </text>
        <text x="0" y="18" fontFamily="Arial,sans-serif" fontSize="9" fontWeight="900" fill="#fff" letterSpacing="0.5">
          ATMOS
        </text>
      </svg>
    </BaseBadge>
  );
}

export function LogoDTS({ className }: LogoProps) {
  return (
    <BaseBadge className={className}>
      <svg viewBox="0 0 36 21" className="h-full w-auto" aria-label="DTS">
        <text x="0" y="17" fontFamily="Arial,sans-serif" fontSize="14" fontWeight="900" fill="#fff">
          DTS
        </text>
      </svg>
    </BaseBadge>
  );
}

export function LogoTrueHD({ className }: LogoProps) {
  return (
    <BaseBadge className={className}>
      <svg viewBox="0 0 62 21" className="h-full w-auto" aria-label="TrueHD">
        <text x="0" y="16" fontFamily="Arial,sans-serif" fontSize="12" fontWeight="800" fill="#fff">
          TrueHD
        </text>
      </svg>
    </BaseBadge>
  );
}

export function LogoFullHD({ className }: LogoProps) {
  return (
    <BaseBadge className={className}>
      <svg viewBox="0 0 34 21" className="relative z-10 h-full w-auto" aria-label="Full HD">
        <text x="0" y="17" fontFamily="Arial,sans-serif" fontSize="14" fontWeight="900" fill="#fff">
          FHD
        </text>
      </svg>
    </BaseBadge>
  );
}

export function LogoHD({ className }: LogoProps) {
  return (
    <BaseBadge className={cn("px-2", className)}>
      <svg viewBox="0 0 22 21" className="relative z-10 h-full w-auto" aria-label="HD">
        <text x="0" y="17" fontFamily="Arial,sans-serif" fontSize="14" fontWeight="900" fill="#fff">
          HD
        </text>
      </svg>
    </BaseBadge>
  );
}

export function LogoDolbyDigital({ className }: LogoProps) {
  return (
    <BaseBadge className={cn("px-3", className)}>
      <svg viewBox="0 0 54 21" className="h-full w-auto" aria-label="Dolby Digital">
        <text x="0" y="9.5" fontFamily="Arial,sans-serif" fontSize="5.5" fontWeight="800" fill="#aaa" letterSpacing="1">
          DOLBY
        </text>
        <text x="0" y="18" fontFamily="Arial,sans-serif" fontSize="9" fontWeight="900" fill="#fff" letterSpacing="0.5">
          DIGITAL
        </text>
      </svg>
    </BaseBadge>
  );
}

export function LogoDolbyDigitalPlus({ className }: LogoProps) {
  return (
    <BaseBadge className={cn("px-3", className)}>
      <svg viewBox="0 0 58 21" className="h-full w-auto" aria-label="Dolby Digital Plus">
        <text x="0" y="9.5" fontFamily="Arial,sans-serif" fontSize="5.5" fontWeight="800" fill="#aaa" letterSpacing="1">
          DOLBY
        </text>
        <text x="0" y="18" fontFamily="Arial,sans-serif" fontSize="9" fontWeight="900" fill="#fff" letterSpacing="0.5">
          DIGITAL+
        </text>
      </svg>
    </BaseBadge>
  );
}
