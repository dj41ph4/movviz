"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * TMDb logo PNGs are wildly inconsistent: some use their canvas tightly,
 * while others reserve half the file as transparent padding. Measure the
 * visible alpha bounds once, then enlarge only padded marks. A naturally
 * wide/tight logo (e.g. The International) therefore stays restrained.
 */
export function AdaptiveTitleLogo({ src, className }: { src: string; className?: string }) {
  const [scale, setScale] = useState(1);

  const inspectAlphaBounds = (image: HTMLImageElement) => {
    try {
      const longest = Math.max(image.naturalWidth, image.naturalHeight);
      if (!longest) return;
      const ratio = Math.min(1, 256 / longest);
      const width = Math.max(1, Math.round(image.naturalWidth * ratio));
      const height = Math.max(1, Math.round(image.naturalHeight * ratio));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return;
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
      if (right < left || bottom < top) return;
      const coverage = Math.max((right - left + 1) / width, (bottom - top + 1) / height);
      // A tight image is unchanged. Padded artwork grows up to 55%, which
      // makes small franchise marks readable without swallowing the card.
      setScale(Math.min(1.55, Math.max(1, 0.92 / Math.max(coverage, 0.2))));
    } catch {
      // Canvas inspection is an enhancement only; the unscaled logo remains.
    }
  };

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      onLoad={(event) => inspectAlphaBounds(event.currentTarget)}
      className={cn("origin-bottom-left object-contain object-left transition-transform duration-300", className)}
      style={{ transform: `scale(${scale})` }}
    />
  );
}
