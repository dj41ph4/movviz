/**
 * Shared "grow from the clicked element" morph math — originally
 * TitlePanel.tsx's own estimateMorph(), generalized so TheaterModePlayer
 * can reuse the exact same transform-origin technique for its own
 * expand-to-fullscreen transition instead of a second parallel
 * implementation. Framer Motion's `initial` prop only ever applies at
 * first mount, so waiting for a post-mount DOM measurement (a layout
 * effect) would always be one frame too late — by then the component has
 * already committed its fallback initial style. The estimate only has to
 * be reasonable: the transition always converges on the real, correctly
 * laid-out CSS geometry (scaleY: 1) by its end regardless of how accurate
 * the guess was, since the origin is a center-to-center delta.
 */

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface MorphTransform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
}

/** Center-to-center delta + scale from `originRect` to `finalRect`. */
export function computeMorphOrigin(originRect: Rect, finalRect: Rect): MorphTransform | null {
  if (originRect.width === 0 || originRect.height === 0) return null;
  if (finalRect.width === 0 || finalRect.height === 0) return null;
  return {
    x: originRect.left + originRect.width / 2 - (finalRect.left + finalRect.width / 2),
    y: originRect.top + originRect.height / 2 - (finalRect.top + finalRect.height / 2),
    scaleX: originRect.width / finalRect.width,
    scaleY: originRect.height / finalRect.height,
  };
}

/** TitlePanel's own final geometry — a centered, capped modal on sm:+, true full-bleed below it. */
export function estimateModalGeometry(): Rect | null {
  if (typeof window === "undefined") return null;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const mobile = vw < 640; // Tailwind's sm breakpoint — full-screen card below it.
  const outerPad = (vw < 768 ? 24 : 40) * 2; // sm:p-6 / md:p-10 on the fixed centering wrapper.
  const width = mobile ? vw : Math.min(vw - outerPad, 1024); // sm:max-w-5xl
  const height = mobile ? vh : Math.min(vh * 0.88, vh - outerPad); // sm:max-h-[88vh]
  return { left: (vw - width) / 2, top: (vh - height) / 2, width, height };
}

/** Theater Mode's final geometry — always true fullscreen, no modal cap at any breakpoint. */
export function estimateFullscreenGeometry(): Rect | null {
  if (typeof window === "undefined") return null;
  return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
}
