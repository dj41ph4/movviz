"use client";

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

export function Logo4K({ className }: LogoProps) {
  return (
    <BaseBadge className={cn("badge-4k-shimmer", className)}>
      <svg viewBox="0 0 36 21" className="relative z-10 h-full w-auto" aria-label="4K">
        <text x="0" y="17" fontFamily="Arial,sans-serif" fontSize="18" fontWeight="900" fill="#fff">
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
