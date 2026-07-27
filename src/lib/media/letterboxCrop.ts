/**
 * Auto-crop letterbox/pillarbox black bars baked into a backdrop image
 * (e.g. a 21:9 cinematic frame delivered inside a 16:9 TMDb backdrop, or a
 * 4:3 frame pillarboxed the same way) — analyzed via canvas pixel sampling,
 * format-agnostic (never hardcodes 4:3/16:9/21:9, just measures how much of
 * each edge is actually black). Only works on static images: a cross-origin
 * YouTube iframe's rendered frames are not readable from canvas at all
 * (browser security), so this deliberately only ever touches the backdrop
 * fallback image, never the trailer video itself.
 *
 * Silently returns null on any failure (CORS-tainted canvas, load error,
 * no bars found) — callers always fall back to the original, unprocessed
 * image, so a detection failure never breaks the page.
 */

const BLACK_LUMA_THRESHOLD = 24; // 0-255 — below this counts as a "black bar" pixel
const BAR_ROW_FRACTION = 0.9; // this fraction of a row/column must be near-black for it to count as part of a bar
const MAX_BAR_FRACTION = 0.25; // never crop more than 25% off a single edge — a sanity guard against misdetecting a genuinely dark scene as a bar
const SAMPLE_SIZE = 160; // analysis is done on a small downsampled copy — plenty for a fractional crop estimate, cheap either way

export interface LetterboxCrop {
  top: number;
  bottom: number;
  left: number;
  right: number;
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

function detectCrop(ctx: CanvasRenderingContext2D, w: number, h: number): LetterboxCrop | null {
  const { data } = ctx.getImageData(0, 0, w, h);
  const luma = (i: number) => 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];

  const isRowBlack = (y: number) => {
    let black = 0;
    for (let x = 0; x < w; x++) if (luma((y * w + x) * 4) < BLACK_LUMA_THRESHOLD) black++;
    return black / w >= BAR_ROW_FRACTION;
  };
  const isColBlack = (x: number) => {
    let black = 0;
    for (let y = 0; y < h; y++) if (luma((y * w + x) * 4) < BLACK_LUMA_THRESHOLD) black++;
    return black / h >= BAR_ROW_FRACTION;
  };

  let top = 0;
  while (top < h * MAX_BAR_FRACTION && isRowBlack(top)) top++;
  let bottom = 0;
  while (bottom < h * MAX_BAR_FRACTION && isRowBlack(h - 1 - bottom)) bottom++;
  let left = 0;
  while (left < w * MAX_BAR_FRACTION && isColBlack(left)) left++;
  let right = 0;
  while (right < w * MAX_BAR_FRACTION && isColBlack(w - 1 - right)) right++;

  if (top + bottom + left + right === 0) return null;
  return { top: top / h, bottom: bottom / h, left: left / w, right: right / w };
}

/**
 * Returns an object URL for the bar-free crop of `src`, or null if no bars
 * were found (or detection failed) — in both cases the caller should just
 * keep using the original `src`. Caller owns the returned object URL and
 * must revoke it when done (see useCroppedBackdrop).
 */
export async function cropLetterboxBars(src: string): Promise<string | null> {
  try {
    const img = await loadImage(src);
    const w = SAMPLE_SIZE;
    const h = Math.round((img.naturalHeight / img.naturalWidth) * w);
    if (!w || !h || !img.naturalWidth || !img.naturalHeight) return null;

    const sampleCanvas = document.createElement("canvas");
    sampleCanvas.width = w;
    sampleCanvas.height = h;
    const sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });
    if (!sampleCtx) return null;
    sampleCtx.drawImage(img, 0, 0, w, h);

    const crop = detectCrop(sampleCtx, w, h);
    if (!crop) return null;

    // Redraw just the content region (excluding the detected bars) from the
    // FULL-resolution image, so the cropped result isn't limited to the
    // small analysis sample's resolution.
    const fullW = img.naturalWidth;
    const fullH = img.naturalHeight;
    const sx = Math.round(crop.left * fullW);
    const sy = Math.round(crop.top * fullH);
    const sw = Math.round(fullW * (1 - crop.left - crop.right));
    const sh = Math.round(fullH * (1 - crop.top - crop.bottom));
    if (sw <= 0 || sh <= 0) return null;

    const outCanvas = document.createElement("canvas");
    outCanvas.width = sw;
    outCanvas.height = sh;
    const outCtx = outCanvas.getContext("2d");
    if (!outCtx) return null;
    outCtx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

    return await new Promise<string | null>((resolve) => {
      outCanvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : null), "image/jpeg", 0.9);
    });
  } catch {
    // Cross-origin canvas taint, decode failure, etc. — never fatal.
    return null;
  }
}
