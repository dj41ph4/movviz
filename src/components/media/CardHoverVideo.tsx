"use client";

import { useEffect, useRef, useState } from "react";
import { loadYouTubeApi } from "./TrailerHeader";

const MIN_QUALITY = "hd1080";
const YOUTUBE_SETTLE_MS = 1500;
const LOOP_BEFORE_END_SEC = 0.75;
const LOOP_POLL_MS = 250;

function createPlayer(host: HTMLElement | null, trailerKey: string, muted: boolean, onPlaying: () => void, onError: () => void) {
  if (!host?.isConnected) return null;
  const mount = document.createElement("div");
  host.replaceChildren(mount);
  try {
    return new (window as any).YT.Player(mount, {
      videoId: trailerKey,
      playerVars: { autoplay: 1, mute: 1, controls: 0, modestbranding: 1, playsinline: 1, rel: 0, iv_load_policy: 3, disablekb: 1, fs: 0, cc_load_policy: 0 },
      events: {
        onReady: (e: any) => {
          try {
            const iframe = e.target.getIframe?.();
            if (iframe && host) {
              iframe.style.width = "1920px";
              iframe.style.height = "1080px";
              // copie le style du host déjà scalé
              iframe.style.cssText = host.style.cssText;
              iframe.style.width = "1920px";
              iframe.style.height = "1080px";
            }
          } catch {}
          if (muted) e.target.mute(); else e.target.unMute();
          e.target.setPlaybackQuality(MIN_QUALITY);
          try { e.target.unloadModule?.("captions"); } catch {}
          e.target.playVideo();
        },
        onStateChange: (e: any) => {
          const YTNS = (window as any).YT;
          if (e.data === YTNS.PlayerState.PLAYING) {
            e.target.setPlaybackQuality(MIN_QUALITY);
            try { e.target.unloadModule?.("captions"); } catch {}
            setTimeout(onPlaying, YOUTUBE_SETTLE_MS);
          }
        },
        onError,
      },
    });
  } catch { return null; }
}

export function CardHoverVideo({ trailerKeys, zoomOffset = 0, enabled = true }: { trailerKeys: string[]; zoomOffset?: number; enabled?: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const key = trailerKeys[index] ?? null;
  const canPlay = enabled && !!key;

  // zoom pur : 400px = largeur carte moyenne, 210 = 0
  const zoom = Math.max(10, 210 + zoomOffset);
  const scale = (400 / 1920) * (zoom / 100);
  const style: React.CSSProperties = { transform: `translate(-50%, -50%) scale(${scale})` };

  useEffect(() => setIndex(0), [trailerKeys.join(",")]);
  useEffect(() => setVisible(false), [key]);

  useEffect(() => {
    if (!canPlay || !key) return;
    let cancelled = false;
    let loopTimer: ReturnType<typeof setInterval> | null = null;
    loadYouTubeApi().then(() => {
      if (cancelled) return;
      if (!(window as any).YT?.Player) return;
      const p = createPlayer(hostRef.current, key, true, () => !cancelled && setVisible(true), () => setIndex((i) => i + 1));
      if (p) playerRef.current = p;
      else setIndex((i) => i + 1);
      loopTimer = setInterval(() => {
        const pl = playerRef.current;
        if (!pl?.getDuration) return;
        const d = pl.getDuration(), c = pl.getCurrentTime();
        if (d > 0 && d - c <= LOOP_BEFORE_END_SEC) pl.seekTo(0, true);
      }, LOOP_POLL_MS);
    });
    return () => {
      cancelled = true;
      if (loopTimer) clearInterval(loopTimer);
      try { playerRef.current?.destroy(); } catch {}
      try { hostRef.current?.replaceChildren(); } catch {}
      playerRef.current = null;
    };
  }, [key, canPlay]);

  if (!canPlay || !key) return null;

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {/* iframe 1080p downscalée pile à la carte, pure sans ombrage */}
      <div
        ref={hostRef}
        className="pointer-events-none absolute left-1/2 top-1/2 h-[1080px] w-[1920px] -translate-x-1/2 -translate-y-1/2"
        style={style}
      />
      {/* tant que YouTube n'a pas PLAYING, on garde noir pur (pas d'image) */}
      {!visible && <div className="absolute inset-0 bg-black" />}
    </div>
  );
}
