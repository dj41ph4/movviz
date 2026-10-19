"use client";

import { useEffect, useRef } from "react";
import { CinemaSplashRenderer } from "./cinemaSplash/renderer";

/**
 * Beta design cold-start scene. Draws the cinema plate and its live lighting
 * on a canvas that fills its parent at the screen's real resolution (16:9,
 * 21:9, portrait). The bar shows the REAL loading progress.
 */
export function CinemaSplashCanvas({
  progress,
  reduceMotion,
  tagline,
  label,
}: {
  progress: number;
  reduceMotion: boolean;
  tagline: string;
  label: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CinemaSplashRenderer | null>(null);
  const reduceRef = useRef(reduceMotion);
  const progressRef = useRef(progress);
  const textsRef = useRef({ tagline, label });

  useEffect(() => {
    reduceRef.current = reduceMotion;
    progressRef.current = progress;
    textsRef.current = { tagline, label };
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.setProgress(progress);
    renderer.setTexts({ tagline, label });
    // Reduced motion: no animation loop, so redraw the still scene when something changes.
    if (reduceMotion && renderer.isReady()) renderer.render(3.2, true);
  }, [progress, reduceMotion, tagline, label]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new CinemaSplashRenderer(canvas, textsRef.current);
    rendererRef.current = renderer;
    let raf = 0;
    let cancelled = false;
    let start = 0;

    const fit = () => renderer.resize(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio || 1);
    const frame = (now: number) => {
      if (cancelled) return;
      renderer.render((now - start) / 1000, false);
      raf = requestAnimationFrame(frame);
    };

    renderer
      .load("/brand/splash-bg.webp")
      .then(() => {
        if (cancelled) return;
        fit();
        renderer.setProgress(progressRef.current);
        renderer.setTexts(textsRef.current);
        if (reduceRef.current) {
          renderer.render(3.2, true);
        } else {
          start = performance.now();
          raf = requestAnimationFrame(frame);
        }
      })
      .catch(() => {
        /* image unavailable: the plain dark backdrop stays, nothing else to show */
      });

    const observer = new ResizeObserver(() => {
      if (!renderer.isReady()) return;
      fit();
      if (reduceRef.current) renderer.render(3.2, true);
    });
    observer.observe(canvas);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 h-full w-full" />;
}
