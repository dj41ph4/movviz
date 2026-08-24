"use client";

import { useShouldUseCdn } from "./useShouldUseCdn";
import type { TmdbImageSize } from "@/lib/metadata/tmdbImageCache";

const CDN_BASE = "https://image.tmdb.org/t/p";

/**
 * For the handful of call sites that hand a resolved URL STRING to something
 * that doesn't own an `<img>` tag itself (e.g. PlayerProvider's
 * backdropUrl/posterUrl, forwarded into TheaterModePlayer's ambient
 * background) — no onError-driven retry is possible at this layer (there's
 * no DOM node to attach one to), so this is CDN-or-local only, no fallback.
 * Accepted trade-off: a plain `<img src=...>` displays a cross-origin image
 * fine regardless of CORS headers (CORS only blocks canvas pixel reads, see
 * TmdbImage.tsx's doc comment) — the only real gap is TMDb's CDN being
 * fully unreachable, which is rare and, here, only affects a decorative
 * background layer, never the actual video.
 */
export function useTmdbImageUrl(path: string | null, size: TmdbImageSize): string | null {
  const useCdn = useShouldUseCdn();
  if (!path) return null;
  return useCdn ? `${CDN_BASE}/${size}${path}` : `/tmdb/${size}${path}`;
}
