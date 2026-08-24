"use client";

import { useEffect, useState, type ImgHTMLAttributes } from "react";
import { useShouldUseCdn } from "@/lib/settings/useShouldUseCdn";
import type { TmdbImageSize } from "@/lib/metadata/tmdbImageCache";

const CDN_BASE = "https://image.tmdb.org/t/p";

type TmdbImageProps = { path: string | null; size: TmdbImageSize } & Omit<ImgHTMLAttributes<HTMLImageElement>, "src">;

/**
 * Drop-in replacement for `<img src={`/tmdb/{size}${path}`} .../>` — behind
 * Réglages → Expérience's "Images depuis Internet" toggle (off by default),
 * tries TMDb's own CDN first and falls back to the existing same-origin NAS
 * route on any load error, never leaving a broken image on screen. See
 * useShouldUseCdn for the full off/on/local-network-priority decision.
 */
export function TmdbImage({ path, size, ...imgProps }: TmdbImageProps) {
  const useCdn = useShouldUseCdn();
  const [fellBack, setFellBack] = useState(false);

  // A recycled card in a virtualized list must never keep a previous
  // title's fallback state.
  useEffect(() => setFellBack(false), [path]);

  if (!path) return null;

  const localSrc = `/tmdb/${size}${path}`;
  const src = useCdn && !fellBack ? `${CDN_BASE}/${size}${path}` : localSrc;

  return (
    <img
      src={src}
      onError={useCdn && !fellBack ? () => setFellBack(true) : undefined}
      {...imgProps}
    />
  );
}
