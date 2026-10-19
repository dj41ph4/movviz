"use client";

import { useEffect, useRef, useState } from "react";
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
  onShown,
}: {
  progress: number;
  reduceMotion: boolean;
  tagline: string;
  label: string;
  /** Called once the scene is fully visible (after its fade-in over the instant backdrop). */
  onShown?: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const shownRef = useRef(false);
  const onShownRef = useRef(onShown);
  useEffect(() => {
    onShownRef.current = onShown;
  }, [onShown]);
  const notifyShown = () => {
    if (shownRef.current) return;
    shownRef.current = true;
    onShownRef.current?.();
  };
  // Si la transition CSS est désactivée (réduire les animations), le signal arrive quand même.
  useEffect(() => {
    if (!visible) return;
    const id = window.setTimeout(notifyShown, 700);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
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
      .load("/brand/splash")
      .then(() => {
        if (cancelled) return;
        fit();
        renderer.setProgress(progressRef.current);
        renderer.setTexts(textsRef.current);
        if (reduceRef.current) {
          renderer.render(3.2, true);
        } else {
          start = performance.now();
          renderer.render(0, false); // first frame drawn before the fade-in starts
          raf = requestAnimationFrame(frame);
        }
        setVisible(true);
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

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      onTransitionEnd={notifyShown}
      className={`absolute inset-0 h-full w-full transition-opacity duration-500 motion-reduce:transition-none ${visible ? "opacity-100" : "opacity-0"}`}
    />
  );
}
