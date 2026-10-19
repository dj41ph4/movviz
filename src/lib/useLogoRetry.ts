"use client";

import { useRef } from "react";

/** Spacing of the extra attempts after an artwork request that came back
 * without a logo (a TMDb hiccup is served as an empty list, not an error). */
const LOGO_RETRY_DELAYS_MS = [4_000, 8_000, 15_000, 30_000, 60_000];

/**
 * SWR `refreshInterval` that keeps asking, with growing gaps, until a logo
 * exists — then stops. The page shows its text stand-in meanwhile and the
 * logo takes the place of the text whenever it finally arrives, however late.
 * Capped, so a title that really has no logo is not polled forever.
 */
export function useLogoRetry<T>(hasLogo: (data: T | undefined) => boolean): (data: T | undefined) => number {
  const attempts = useRef(0);
  return (data) => {
    if (hasLogo(data)) {
      attempts.current = 0;
      return 0;
    }
    return LOGO_RETRY_DELAYS_MS[attempts.current++] ?? 0;
  };
}
