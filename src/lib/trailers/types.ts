/**
 * Enhanced trailer source chain (Apple TV → IMDb) — gated behind
 * enhancedTrailerSourcesEnabled, always a fallback candidate list ahead of
 * the existing YouTube keys, never a replacement for them.
 */
export interface TrailerSource {
  provider: "apple" | "imdb" | "primeVideo";
  playbackType: "hls" | "mp4" | "dash";
  url: string;
  type: "teaser" | "trailer";
  language: string | null;
  width?: number;
  height?: number;
}
