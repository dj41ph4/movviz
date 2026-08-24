"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useShouldUseCdn } from "@/lib/settings/useShouldUseCdn";
import type { TmdbImageSize } from "@/lib/metadata/tmdbImageCache";

const CDN_BASE = "https://image.tmdb.org/t/p";

// The same TMDb logo is rendered both on the card and in its hover preview.
// Keep the alpha-derived scale in memory so the preview can use its final
// dimensions immediately instead of measuring the same PNG a second time.
// Keyed by `path` (not the resolved URL) so a CDN->local fallback reuses the
// same cache entry instead of re-measuring.
const logoScaleCache = new Map<string, number>();

/**
 * TMDb logo PNGs are wildly inconsistent: some use their canvas tightly,
 * while others reserve half the file as transparent padding. Measure the
 * visible alpha bounds once, then bring only undersized marks up to 40% of
 * their card width. A naturally broad/tight logo is never reduced.
 */
export function AdaptiveTitleLogo({ path, size, className }: { path: string; size: TmdbImageSize; className?: string }) {
  const useCdn = useShouldUseCdn();
  const [fellBack, setFellBack] = useState(false);
  const [layout, setLayout] = useState(() => {
    const cachedScale = logoScaleCache.get(path);
    return { scale: cachedScale ?? 1, ready: cachedScale !== undefined };
  });

  // Cards are recycled as rows change. Never retain the preceding title's
  // alpha-derived scale (or CDN-fallback state) while the next logo loads.
  useEffect(() => {
    setFellBack(false);
    const cachedScale = logoScaleCache.get(path);
    setLayout({ scale: cachedScale ?? 1, ready: cachedScale !== undefined });
  }, [path]);

  const inspectAlphaBounds = (image: HTMLImageElement) => {
    try {
      const longest = Math.max(image.naturalWidth, image.naturalHeight);
      if (!longest) {
        setLayout({ scale: 1, ready: true });
        return;
      }
      const ratio = Math.min(1, 256 / longest);
      const width = Math.max(1, Math.round(image.naturalWidth * ratio));
      const height = Math.max(1, Math.round(image.naturalHeight * ratio));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) {
        setLayout({ scale: 1, ready: true });
        return;
      }
      context.drawImage(image, 0, 0, width, height);
      const pixels = context.getImageData(0, 0, width, height).data;
      let left = width, top = height, right = -1, bottom = -1;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (pixels[(y * width + x) * 4 + 3] < 18) continue;
          left = Math.min(left, x); right = Math.max(right, x);
          top = Math.min(top, y); bottom = Math.max(bottom, y);
        }
      }
      if (right < left || bottom < top) {
        setLayout({ scale: 1, ready: true });
        return;
      }
      const visibleWidthRatio = (right - left + 1) / width;
      // `offsetWidth` deliberately ignores CSS transforms, so this is the
      // intrinsic, unscaled canvas width even when a recycled card briefly
      // still carries the preceding logo's transform. The direct parent is
      // the bottom-left logo rail and its parent is the actual 16:9 card.
      const cardWidth = image.parentElement?.parentElement?.getBoundingClientRect().width ?? 0;
      const visibleWidth = image.offsetWidth * visibleWidthRatio;
      if (!cardWidth || !visibleWidth) {
        setLayout({ scale: 1, ready: true });
        return;
      }
      // Never shrink a logo that already occupies more than 40% of the
      // card (The International), but make smaller transparent/franchise
      // marks reach that exact visual width while preserving their ratio.
      const nextScale = Math.max(1, (cardWidth * 0.4) / visibleWidth);
      logoScaleCache.set(path, nextScale);
      setLayout({ scale: nextScale, ready: true });
    } catch {
      // Canvas inspection is an enhancement only (also the expected path on
      // a CORS-tainted CDN load — see useShouldUseCdn); the unscaled logo
      // still renders fine either way.
      setLayout({ scale: 1, ready: true });
    }
  };

  const localSrc = `/tmdb/${size}${path}`;
  const src = useCdn && !fellBack ? `${CDN_BASE}/${size}${path}` : localSrc;

  const onError = () => {
    // First failure while on the CDN: retry same-origin before giving up —
    // this is a real load failure (not just a canvas taint, which fires
    // onLoad -> inspectAlphaBounds's own catch, never onError).
    if (useCdn && !fellBack) {
      setFellBack(true);
      return;
    }
    setLayout({ scale: 1, ready: true });
  };

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="eager"
      decoding="async"
      onLoad={(event) => inspectAlphaBounds(event.currentTarget)}
      onError={onError}
      className={cn("origin-bottom-left object-contain object-left", !layout.ready && "opacity-0", className)}
      style={{ transform: `scale(${layout.scale})` }}
    />
  );
}
