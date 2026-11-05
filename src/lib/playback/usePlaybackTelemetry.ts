"use client";

import { useEffect, type RefObject } from "react";

type Ev = {
  type: "stall" | "sample";
  t: number;
  mode: string;
  device: string;
  bufAhead: number;
  pos: number;
  net: string | null;
  sid: string | null;
  cause?: "waiting" | "stalled" | "seek";
  ms?: number | null;
  readyState?: number;
  networkState?: number;
};

const SAMPLE_EVERY_MS = 10_000;
const FLUSH_EVERY_MS = 15_000;

/** Libellé court de l'appareil : type (tv / mobile / desktop) + plateforme. */
function deviceLabel(): string {
  const ua = navigator.userAgent;
  const tv = /Tizen|SMART-TV|SmartTV|Web0S|WebOS|Android TV|AFT[A-Z]|BRAVIA|Chromecast|CrKey|Movviz TV|NX/i.test(ua);
  const kind = tv ? "tv" : /Mobi|Android|iPhone|iPad/i.test(ua) ? "mobile" : "desktop";
  const os = /Tizen/i.test(ua) ? "tizen" : /Web0S|WebOS/i.test(ua) ? "webos" : /Android/i.test(ua) ? "android" : /iPhone|iPad/i.test(ua) ? "ios" : /Windows/i.test(ua) ? "windows" : /Mac OS/i.test(ua) ? "mac" : "autre";
  const wv = /; wv\)|Version\/[\d.]+ Chrome/i.test(ua) ? "-webview" : "";
  return `${kind}/${os}${wv}`;
}

function networkType(): string | null {
  const c = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection;
  return c?.effectiveType ?? null;
}

/** Secondes de tampon devant la tête de lecture (0 si elle est hors de toute plage). */
function bufferAhead(el: HTMLVideoElement): number {
  const t = el.currentTime;
  for (let i = 0; i < el.buffered.length; i++) {
    if (t >= el.buffered.start(i) - 0.25 && t <= el.buffered.end(i)) return Math.max(0, el.buffered.end(i) - t);
  }
  return 0;
}

/**
 * Remonte à /api/perf (champ `playback`) les coupures de lecture et la réserve de
 * tampon de CE lecteur, avec le mode de lecture et l'appareil — pour savoir si un
 * « chargement » vu sur téléphone ou TV vient du serveur ou du réseau. Ne change
 * rien au lecteur : il n'écoute que des événements de l'élément <video>.
 */
export function usePlaybackTelemetry(
  videoRef: RefObject<HTMLVideoElement | null>,
  getMode: () => string,
  getSessionId: () => string | null,
  getReserveSeconds: () => number = () => 0,
) {
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const device = deviceLabel();
    const queue: Ev[] = [];
    let open: { start: number; cause: "waiting" | "seek"; bufAhead: number; pos: number; readyState: number; networkState: number } | null = null;

    const base = () => ({
      t: Date.now(),
      mode: getMode(),
      device,
      bufAhead: bufferAhead(el),
      pos: el.currentTime,
      net: networkType(),
      sid: getSessionId(),
    });

    const closeStall = (ms: number | null) => {
      if (!open) return;
      queue.push({
        ...base(),
        type: "stall",
        cause: open.cause,
        ms,
        bufAhead: open.bufAhead,
        pos: open.pos,
        readyState: open.readyState,
        networkState: open.networkState,
      });
      open = null;
    };

    const flush = () => {
      if (!queue.length) return;
      const events = queue.splice(0, queue.length);
      void fetch("/api/perf/playback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events }),
        keepalive: true,
      }).catch(() => void 0);
    };

    const onWaiting = () => {
      if (open || el.paused || el.ended) return;
      open = {
        start: performance.now(),
        cause: el.seeking ? "seek" : "waiting",
        bufAhead: bufferAhead(el),
        pos: el.currentTime,
        readyState: el.readyState,
        networkState: el.networkState,
      };
    };
    const onResume = () => {
      if (open) closeStall(Math.round(performance.now() - open.start));
    };
    const onStalled = () => {
      if (el.paused || el.ended) return;
      queue.push({ ...base(), type: "stall", cause: "stalled", ms: 0, readyState: el.readyState, networkState: el.networkState });
    };
    const onHide = () => {
      if (document.visibilityState !== "hidden") return;
      closeStall(null);
      flush();
    };

    const sampleTimer = window.setInterval(() => {
      if (el.paused || el.ended || el.readyState < 2 || !el.currentSrc) return;
      const sample = base();
      queue.push({ ...sample, type: "sample", bufAhead: sample.bufAhead + getReserveSeconds() });
    }, SAMPLE_EVERY_MS);
    const flushTimer = window.setInterval(flush, FLUSH_EVERY_MS);

    el.addEventListener("waiting", onWaiting);
    el.addEventListener("playing", onResume);
    el.addEventListener("canplay", onResume);
    el.addEventListener("stalled", onStalled);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);

    return () => {
      window.clearInterval(sampleTimer);
      window.clearInterval(flushTimer);
      el.removeEventListener("waiting", onWaiting);
      el.removeEventListener("playing", onResume);
      el.removeEventListener("canplay", onResume);
      el.removeEventListener("stalled", onStalled);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
      closeStall(null);
      flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoRef]);
}
