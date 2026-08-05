/**
 * Extracts a subtle, cinematic color ambience from a title's own backdrop
 * (or poster, as a fallback) for Theater Mode's backdrop layer — same
 * canvas-pixel-sampling approach as letterboxCrop.ts (small downsampled
 * copy, crossOrigin anonymous load, every step try/catch wrapped, null-safe
 * on any failure: CORS taint, decode error, whatever).
 *
 * Deliberately a simple weighted-average-per-hue-bucket, not real k-means —
 * the spec only asks for a subtle ambience, not a precise palette. The
 * result is clamped at generation time (capped saturation, narrow lightness
 * band) so it reads as "subtle, cinematic" regardless of how vivid the
 * source image actually is — callers never have to remember to dim it
 * themselves.
 */

const SAMPLE_SIZE = 32;
const HUE_BUCKETS = 12; // 30° each
const SATURATION_CAP = 0.6;
const LIGHTNESS_MIN = 0.16;
const LIGHTNESS_MAX = 0.36;

export interface AmbienceColor {
  h: number;
  s: number;
  l: number;
}

export interface DominantColorResult {
  dominant: AmbienceColor;
  secondary: AmbienceColor;
  /** 0 (near-black source) – 1 (near-white source), unweighted average luma. */
  brightness: number;
  /** 0–1, unweighted average saturation of the source image. */
  saturation: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}

function rgbToHsl(r: number, g: number, b: number): AmbienceColor {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
    case g: h = ((b - r) / d + 2) * 60; break;
    default: h = ((r - g) / d + 4) * 60;
  }
  return { h, s, l };
}

function clampAmbience(c: AmbienceColor): AmbienceColor {
  return {
    h: c.h,
    s: Math.min(c.s, SATURATION_CAP),
    l: Math.max(LIGHTNESS_MIN, Math.min(LIGHTNESS_MAX, c.l)),
  };
}

function extract(data: Uint8ClampedArray): DominantColorResult | null {
  const buckets: { weight: number; r: number; g: number; b: number }[] =
    Array.from({ length: HUE_BUCKETS }, () => ({ weight: 0, r: 0, g: 0, b: 0 }));
  let lumaSum = 0;
  let satSum = 0;
  let count = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const { h, s, l } = rgbToHsl(r, g, b);
    lumaSum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
    satSum += s;
    count++;
    // Weight by saturation*lightness so black bars (s≈0 or l≈0) and blown-out
    // white text/highlights (l≈1) don't win a bucket just by being numerous.
    const weight = s * (1 - Math.abs(l - 0.5) * 2);
    if (weight <= 0) continue;
    const bucket = Math.min(HUE_BUCKETS - 1, Math.floor(h / (360 / HUE_BUCKETS)));
    buckets[bucket].weight += weight;
    buckets[bucket].r += r * weight;
    buckets[bucket].g += g * weight;
    buckets[bucket].b += b * weight;
  }
  if (count === 0) return null;

  const ranked = buckets
    .map((b, i) => ({ ...b, index: i }))
    .filter((b) => b.weight > 0)
    .sort((a, b) => b.weight - a.weight);
  if (ranked.length === 0) return null;

  const top = ranked[0];
  const dominant = rgbToHsl(top.r / top.weight, top.g / top.weight, top.b / top.weight);
  // Next bucket at least 2 bins (60°) away from the dominant one, so
  // "secondary" reads as a genuinely different color rather than a noisy
  // neighbor of the same hue.
  const secondCandidate = ranked.find((b) => {
    const dist = Math.min(Math.abs(b.index - top.index), HUE_BUCKETS - Math.abs(b.index - top.index));
    return dist >= 2;
  }) ?? top;
  const secondary = rgbToHsl(secondCandidate.r / secondCandidate.weight, secondCandidate.g / secondCandidate.weight, secondCandidate.b / secondCandidate.weight);

  return {
    dominant: clampAmbience(dominant),
    secondary: clampAmbience(secondary),
    brightness: lumaSum / count / 255,
    saturation: satSum / count,
  };
}

const cache = new Map<string, Promise<DominantColorResult | null>>();

/** Once per unique URL for the whole page session — never re-run on a playback tick. */
export function getDominantColor(src: string | null | undefined): Promise<DominantColorResult | null> {
  if (!src) return Promise.resolve(null);
  const cached = cache.get(src);
  if (cached) return cached;

  const promise = (async () => {
    try {
      const img = await loadImage(src);
      if (!img.naturalWidth || !img.naturalHeight) return null;
      const canvas = document.createElement("canvas");
      canvas.width = SAMPLE_SIZE;
      canvas.height = SAMPLE_SIZE;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
      const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
      return extract(data);
    } catch {
      // CORS-tainted canvas, decode failure, etc. — never fatal, caller
      // just gets no ambience and falls back to a plain dark backdrop.
      return null;
    }
  })();
  cache.set(src, promise);
  return promise;
}
