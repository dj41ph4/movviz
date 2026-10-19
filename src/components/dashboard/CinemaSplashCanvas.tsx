"use client";

import { useEffect, useRef, useState } from "react";
import { CinemaSplashRenderer, drawTextLayer, splashLayout } from "./cinemaSplash/renderer";
import type { SplashWorkerMessage } from "./cinemaSplash/splash.worker";

const STILL_TIME = 3.2;

/** What the component drives, whichever thread actually draws. */
interface SplashDriver {
  resize(pw: number, ph: number, k: number): void;
  progress(value: number): void;
  text(bitmap: ImageBitmap): void;
  reduce(value: boolean): void;
  stop(): void;
}

/**
 * Beta design cold-start scene. Draws the cinema plate and its live lighting on a canvas that fills
 * its parent (16:9, 21:9, portrait). The bar shows the REAL loading progress.
 *
 * The drawing runs in a Web Worker (OffscreenCanvas) so the dashboard loading underneath — data
 * parsing, React rendering — never steals its frames. Browsers without OffscreenCanvas transfer
 * fall back to drawing on the main thread.
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
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const driverRef = useRef<SplashDriver | null>(null);
  const kCssRef = useRef(1);
  const latest = useRef({ progress, reduceMotion, tagline, label });

  const pushText = () => {
    const driver = driverRef.current;
    if (!driver) return;
    const { tagline: tg, label: lb } = latest.current;
    const font = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
    driver.text(drawTextLayer({ tagline: tg, label: lb }, kCssRef.current, font));
  };

  useEffect(() => {
    latest.current = { progress, reduceMotion, tagline, label };
    driverRef.current?.progress(progress);
  }, [progress, reduceMotion, tagline, label]);
  useEffect(() => {
    driverRef.current?.reduce(reduceMotion);
  }, [reduceMotion]);
  useEffect(() => {
    pushText();
  }, [tagline, label]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    const layout = () => {
      const l = splashLayout(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio || 1);
      kCssRef.current = l.kCss;
      return l;
    };
    const first = layout();
    const init = latest.current;

    let driver: SplashDriver;
    if (typeof Worker !== "undefined" && "transferControlToOffscreen" in canvas) {
      const offscreen = canvas.transferControlToOffscreen();
      const worker = new Worker(new URL("./cinemaSplash/splash.worker.ts", import.meta.url), { type: "module" });
      const post = (m: SplashWorkerMessage, transfer: Transferable[] = []) => worker.postMessage(m, transfer);
      worker.onmessage = (e: MessageEvent<{ type: string }>) => {
        if (!cancelled && e.data.type === "shown") setVisible(true);
      };
      post({ type: "init", canvas: offscreen, pw: first.pw, ph: first.ph, k: first.k, progress: init.progress, reduce: init.reduceMotion }, [offscreen]);
      driver = {
        resize: (pw, ph, k) => post({ type: "resize", pw, ph, k }),
        progress: (value) => post({ type: "progress", value }),
        text: (bitmap) => post({ type: "text", bitmap }, [bitmap]),
        reduce: (value) => post({ type: "reduce", value }),
        stop: () => {
          post({ type: "stop" });
          setTimeout(() => worker.terminate(), 1000);
        },
      };
    } else {
      // Main-thread fallback: same renderer, own animation loop.
      const renderer = new CinemaSplashRenderer(canvas);
      renderer.resize(first.pw, first.ph, first.k);
      renderer.setProgress(init.progress);
      let raf = 0;
      let start = 0;
      let reduce = init.reduceMotion;
      const frame = (now: number) => {
        renderer.render((now - start) / 1000, false);
        raf = requestAnimationFrame(frame);
      };
      const play = () => {
        cancelAnimationFrame(raf);
        if (reduce) renderer.render(STILL_TIME, true);
        else {
          start = performance.now();
          raf = requestAnimationFrame(frame);
        }
      };
      renderer.onLayerLoaded = () => {
        if (reduce) renderer.render(STILL_TIME, true);
      };
      renderer.load().then(
        () => {
          if (cancelled) return;
          play();
          setVisible(true);
        },
        () => {
          /* images unavailable: the plain dark backdrop stays */
        },
      );
      driver = {
        resize: (pw, ph, k) => {
          renderer.resize(pw, ph, k);
          if (reduce && renderer.isReady()) renderer.render(STILL_TIME, true);
        },
        progress: (value) => {
          renderer.setProgress(value);
          if (reduce && renderer.isReady()) renderer.render(STILL_TIME, true);
        },
        text: (bitmap) => {
          renderer.setTextLayer(bitmap);
          if (reduce && renderer.isReady()) renderer.render(STILL_TIME, true);
        },
        reduce: (value) => {
          reduce = value;
          if (renderer.isReady()) play();
        },
        stop: () => {
          cancelAnimationFrame(raf);
          renderer.dispose();
        },
      };
    }
    driverRef.current = driver;
    pushText();
    // texts again once the web font is ready (the first raster may use a fallback face)
    document.fonts?.ready.then(() => {
      if (!cancelled) pushText();
    });

    const observer = new ResizeObserver(() => {
      const l = layout();
      driver.resize(l.pw, l.ph, l.k);
      pushText();
    });
    observer.observe(canvas);

    return () => {
      cancelled = true;
      observer.disconnect();
      driver.stop();
      driverRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      onTransitionEnd={notifyShown}
      className={`absolute inset-0 h-full w-full transition-opacity duration-500 motion-reduce:transition-none ${visible ? "opacity-100" : "opacity-0"}`}
    />
  );
}
