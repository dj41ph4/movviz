"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Gauge } from "lucide-react";
import { useT } from "@/i18n/provider";
import { useGpu } from "@/lib/gpu/GpuProvider";
import { usePlayer } from "@/lib/player/PlayerProvider";
import { toast } from "@/components/ui/Toast";
import {
  assessFrames,
  nextStreak,
  SMOOTHNESS_FIRST_DELAY_MS,
  SMOOTHNESS_GAP_MS,
  SMOOTHNESS_REQUIRED_WINDOWS,
  readSmoothnessSnooze,
  writeSmoothnessSnooze,
  SMOOTHNESS_WINDOW_MS,
} from "@/lib/motion/smoothness";

/** Records one window of frame gaps, or null if it says nothing about this page. */
function measureWindow(signal: AbortSignal): Promise<number[] | null> {
  return new Promise((resolve) => {
    const deltas: number[] = [];
    let last: number | null = null;
    let start: number | null = null;
    let frame = 0;
    const stop = (result: number[] | null) => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onHidden);
      signal.removeEventListener("abort", onAbort);
      resolve(result);
    };
    const onAbort = () => stop(null);
    const onHidden = () => { if (document.hidden) stop(null); };
    const tick = (now: number) => {
      if (last !== null) deltas.push(now - last);
      last = now;
      start ??= now;
      if (now - start >= SMOOTHNESS_WINDOW_MS) stop(deltas);
      else frame = requestAnimationFrame(tick);
    };
    document.addEventListener("visibilitychange", onHidden);
    signal.addEventListener("abort", onAbort);
    frame = requestAnimationFrame(tick);
  });
}

/**
 * Offers a lighter effects level when this device visibly struggles: Balanced
 * first, then Smooth if the device still struggles once Balanced is on. Never during
 * playback (a film decoding is not what the offer can lighten), and a page change
 * discards the window it interrupts, since a transition is not a sign of weakness.
 */
export function SmoothnessAdvisor() {
  const t = useT();
  const pathname = usePathname();
  const { request } = usePlayer();
  const { effectsLevel, setEffectsLevel } = useGpu();
  // Rien de plus léger à proposer une fois au niveau Fluide.
  const nothingLighter = effectsLevel === "smooth";
  const [visible, setVisible] = useState(false);
  const measurable = useRef(true);
  const pageChange = useRef<AbortController | null>(null);

  useEffect(() => {
    measurable.current = !request;
    pageChange.current?.abort();
  }, [pathname, request]);

  useEffect(() => {
    if (nothingLighter) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let streak = 0;

    const blocked = () => !measurable.current || document.hidden || !!document.fullscreenElement;

    const measure = async () => {
      if (cancelled) return;
      if (!blocked()) {
        const controller = new AbortController();
        pageChange.current = controller;
        const deltas = await measureWindow(controller.signal);
        if (cancelled) return;
        if (deltas) streak = nextStreak(streak, assessFrames(deltas));
      }
      if (streak >= SMOOTHNESS_REQUIRED_WINDOWS && !document.querySelector('[aria-modal="true"]')) {
        // Re-read: the choice may have changed elsewhere since the measure began.
        if (readSmoothnessSnooze() <= Date.now()) setVisible(true);
        return;
      }
      timer = setTimeout(measure, SMOOTHNESS_GAP_MS);
    };

    if (readSmoothnessSnooze() <= Date.now()) timer = setTimeout(measure, SMOOTHNESS_FIRST_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      pageChange.current?.abort();
    };
  }, [nothingLighter, effectsLevel]);

  const dismiss = useCallback(() => {
    setVisible(false);
    writeSmoothnessSnooze();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") dismiss(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, dismiss]);

  if (!visible || nothingLighter) return null;

  // Deuxième proposition : l'appareil peine encore alors qu'il est déjà en Équilibré.
  const second = effectsLevel === "balanced";
  const accept = () => {
    setVisible(false);
    setEffectsLevel(second ? "smooth" : "balanced");
    toast("success", t(second ? "smoothness.enabledToastMore" : "smoothness.enabledToast"));
  };

  // Opaque on purpose: no blur on a card shown to a device short of power.
  return (
    <div
      role="dialog"
      aria-labelledby="mv-smoothness-title"
      aria-describedby="mv-smoothness-body"
      className="animate-menu-pop fixed inset-x-4 bottom-36 z-[80] mx-auto max-w-md rounded-2xl border border-white/12 bg-[#12121c] p-5 shadow-2xl md:bottom-6"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-brand/30 bg-brand/12 text-brand-glow">
          <Gauge className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 id="mv-smoothness-title" className="text-base font-bold text-ink">{t(second ? "smoothness.titleMore" : "smoothness.title")}</h2>
          <p id="mv-smoothness-body" className="mt-1 text-sm leading-relaxed text-ink-soft">{t(second ? "smoothness.bodyMore" : "smoothness.body")}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button onClick={accept} className="brand-gradient ring-focus min-h-11 flex-1 rounded-xl px-4 text-sm font-bold text-white">
          {t(second ? "smoothness.acceptMore" : "smoothness.accept")}
        </button>
        <button onClick={dismiss} className="glass ring-focus min-h-11 flex-1 rounded-xl px-4 text-sm font-bold text-ink-soft transition hover:bg-white/10">
          {t(second ? "smoothness.declineMore" : "smoothness.decline")}
        </button>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-ink-dim">{t("smoothness.note")}</p>
    </div>
  );
}
