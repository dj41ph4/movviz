"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { BRAND } from "@/lib/brand";

/**
 * Beta cold-start scene (see dashboard-splash.css). The root layout already painted the backdrop and the
 * M before hydration; this component draws the very same M at the same place and resumes its entrance
 * animation at the current point of the page's timeline (negative delay), so the hand-over is invisible.
 */
export function BrandSplash({ progress, label, loadingLabel, onShown }: { progress: number; label: string; loadingLabel: string; onShown: () => void }) {
  // Time already elapsed since navigation start: the entrance continues instead of restarting.
  const [elapsed] = useState(() => (typeof performance !== "undefined" ? Math.round(performance.now()) : 0));
  useEffect(() => {
    // The component's own M now covers the pre-hydration one.
    const id = requestAnimationFrame(onShown);
    return () => cancelAnimationFrame(id);
  }, [onShown]);
  const vars = { "--mv-m-src": `url("${BRAND.mark}")`, "--mv-word-src": `url("${BRAND.word}")` } as CSSProperties;
  const resume = { animationDelay: `-${elapsed}ms` };
  return (
    <div className="absolute inset-0" style={vars}>
      <div className="mv-m-splash-glow" aria-hidden="true" />
      <div className="mv-m-splash-mark" style={resume} role="img" aria-label="Movviz" />
      <div className="mv-m-splash-sheen" aria-hidden="true" />
      <div className="mv-m-splash-word" aria-hidden="true" />
      <div className="mv-m-splash-loading">
        <div className="mv-m-splash-track" role="progressbar" aria-label={loadingLabel} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
          <div className="mv-m-splash-fill" style={{ transform: `scaleX(${Math.max(0.03, progress / 100)})` }} />
        </div>
        <p className="mv-m-splash-label" role="status">{label}</p>
      </div>
    </div>
  );
}
