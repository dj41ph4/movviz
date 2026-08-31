"use client";

import { useEffect, useState } from "react";
import { cropLetterboxBars } from "./letterboxCrop";

/**
 * Module-level cache so revisiting the same title in one session doesn't
 * re-run the canvas analysis every time — keyed by the original src, value
 * is the cropped object URL or null (no bars found / detection failed,
 * meaning "just use the original src"). Never revoked mid-session since a
 * cached object URL may still be in use by another mounted instance of the
 * same backdrop (e.g. Dashboard Hero + a title page open at once).
 */
const cropCache = new Map<string, string | null>();

/** Returns the bar-free version of `src`, falling back to `src` itself while processing or if no crop was needed/possible. */
export function useCroppedBackdrop(src: string | null): string | null {
  const [resolved, setResolved] = useState<string | null>(src);

  useEffect(() => {
    if (!src) {
      setResolved(null);
      return;
    }
    if (cropCache.has(src)) {
      setResolved(cropCache.get(src) ?? src);
      return;
    }
    let cancelled = false;
    setResolved(src);
    cropLetterboxBars(src).then((cropped) => {
      if (cancelled) return;
      cropCache.set(src, cropped);
      setResolved(cropped ?? src);
    });
    return () => {
      cancelled = true;
    };
  }, [src]);

  return resolved;
}
