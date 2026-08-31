import { useRef, useState, useEffect } from "react";

/**
 * Smoothly interpolates download progress between engine polls.
 * The engine updates every ~2.5s (aria2 tellActive) + SWR polling,
 * causing visible jumps. This hook advances progress at the last
 * known download speed between updates for a fluid 60fps bar.
 */
export function useSmoothProgress(
  progress: number,       // 0..1 from engine
  size: number,           // bytes total
  speed: number,          // bytes/s download speed from engine
): number {
  const ref = useRef({ progress, speed, size, time: Date.now() });
  const [displayed, setDisplayed] = useState(progress);

  useEffect(() => {
    const last = ref.current;
    // Reset interpolation when polled progress actually changes
    // (accounting for the fact that our own interpolation may have
    //  pushed displayed slightly past the last known progress)
    if (progress !== last.progress) {
      ref.current = { progress, speed, size, time: Date.now() };
      setDisplayed(progress);
      return;
    }
    // Speed changed but progress hasn't (yet) — keep the new speed
    if (speed !== last.speed) {
      ref.current = { ...ref.current, speed, time: Date.now() };
    }
  }, [progress, speed, size]);

  useEffect(() => {
    if (progress >= 1 || speed <= 0 || size <= 0) return;
    let raf: number;
    const tick = () => {
      const now = Date.now();
      const { progress: lastProgress, speed: lastSpeed, size: lastSize, time: lastTime } = ref.current;
      const dt = (now - lastTime) / 1000;
      const estimated = lastProgress + (lastSpeed * dt) / lastSize;
      if (estimated <= 1) {
        setDisplayed(estimated);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [progress, speed, size]);

  return Math.min(displayed, 1);
}
