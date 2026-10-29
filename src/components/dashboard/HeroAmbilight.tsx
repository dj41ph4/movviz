"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { videoPositionNow } from "@/lib/player/heroVideoClock";

const YOUTUBE_ORIGIN = "https://www.youtube.com";
/** Re-align the mirror as soon as it drifts this far from the visible video. */
const MAX_DRIFT_SEC = 0.3;
const SEEK_COOLDOWN_MS = 800;

/** Les quatre bords s'estompent par masque, indépendamment du flou : si le
 *  navigateur abandonne le filtre sur ce très grand calque (plein écran), le
 *  halo garde des bords doux au lieu de montrer son rectangle net. */
const EDGE_FADE = "linear-gradient(to right, transparent, #000 12%, #000 88%, transparent)";
const EDGE_FADE_Y = "linear-gradient(to bottom, transparent, #000 12%, #000 88%, transparent)";
const AMBILIGHT_STYLE = {
  containerType: "size",
  maskImage: `${EDGE_FADE}, ${EDGE_FADE_Y}`,
  WebkitMaskImage: `${EDGE_FADE}, ${EDGE_FADE_Y}`,
  maskComposite: "intersect",
  WebkitMaskComposite: "source-in",
} as CSSProperties;

/**
 * Ambilight behind the desktop dashboard hero: a blurred copy of what the
 * hero shows, framed exactly like it and spilling past the card's edges.
 *
 * A YouTube embed is cross-origin, so its pixels can never be read to
 * compute colours. Instead a second, muted copy of the same video plays
 * underneath, slaved to the visible player's clock (heroVideoClock): it is
 * aligned before being shown and re-seeked whenever it drifts, so the glow
 * matches the scene on screen. Before/without a video the still backdrop
 * provides the glow. Purely decorative: no pointer events, hidden from
 * assistive tech.
 */
export function HeroAmbilight({ backdropUrl, videoKey }: { backdropUrl: string | null; videoKey: string | null }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [alignedKey, setAlignedKey] = useState<string | null>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!videoKey || !iframe) return;
    const bridgeId = Math.floor(Math.random() * 1_000_000_000) + 1;
    let mirrorSample: { time: number; at: number; playing: boolean } | null = null;
    let mirrorPlaying: boolean | null = null;
    let lastSeekAt = 0;
    const post = (payload: Record<string, unknown>) => {
      try { iframe.contentWindow?.postMessage(JSON.stringify({ ...payload, id: bridgeId, channel: "widget" }), YOUTUBE_ORIGIN); } catch { /* not ready */ }
    };
    const command = (func: string, args: unknown[] = []) => post({ event: "command", func, args });
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== YOUTUBE_ORIGIN || event.source !== iframe.contentWindow) return;
      let data: { event?: string; info?: { currentTime?: number; playerState?: number } | number } | null = null;
      try { data = typeof event.data === "string" ? JSON.parse(event.data) : event.data; } catch { return; }
      const info = data?.info;
      const state = typeof info === "number" ? info : info?.playerState;
      if (typeof state === "number") mirrorPlaying = state === 1;
      const t = typeof info === "object" ? info?.currentTime : undefined;
      if (data?.event === "infoDelivery" && typeof t === "number" && Number.isFinite(t)) {
        mirrorSample = { time: t, at: performance.now(), playing: mirrorPlaying ?? false };
        sync();
      }
    };
    const sync = () => {
      const main = videoPositionNow(videoKey);
      if (!main) {
        setAlignedKey((key) => key === videoKey ? null : key);
        return;
      }
      const now = performance.now();
      const mirror = mirrorSample
        ? mirrorSample.time + (mirrorSample.playing ? (now - mirrorSample.at) / 1000 : 0)
        : null;
      const aligned = mirror !== null && Math.abs(mirror - main.time) <= MAX_DRIFT_SEC
        && (mirrorPlaying === null || mirrorPlaying === main.playing);
      setAlignedKey((key) => aligned ? videoKey : (key === videoKey ? null : key));
      if (!aligned && now - lastSeekAt >= SEEK_COOLDOWN_MS) {
        // Do not invent a mirror position after seekTo: wait until YouTube
        // reports the new frame before showing its light around the hero.
        command("seekTo", [main.time + 0.15, true]);
        lastSeekAt = now;
      }
      if (mirrorPlaying !== main.playing) command(main.playing ? "playVideo" : "pauseVideo");
    };
    const onLoad = () => post({ event: "listening" });
    window.addEventListener("message", onMessage);
    iframe.addEventListener("load", onLoad);
    const timer = setInterval(() => { post({ event: "listening" }); sync(); }, 250);
    return () => {
      clearInterval(timer);
      window.removeEventListener("message", onMessage);
      iframe.removeEventListener("load", onLoad);
      setAlignedKey(null);
    };
  }, [videoKey]);

  const params = videoKey && typeof window !== "undefined"
    ? new URLSearchParams({ autoplay: "1", mute: "1", controls: "0", playsinline: "1", rel: "0", iv_load_policy: "3", disablekb: "1", fs: "0", enablejsapi: "1", origin: window.location.origin }).toString()
    : "";

  return (
    // Same box and same "cover" framing as the hero video, so each edge of the
    // glow continues the colours sitting right at that edge of the card.
    <div aria-hidden className="mv-hero-ambilight pointer-events-none absolute inset-0 -z-10" style={AMBILIGHT_STYLE}>
      {backdropUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={backdropUrl} alt="" className="absolute inset-0 h-full w-full object-cover transition-opacity duration-300" style={{ opacity: videoKey ? 0 : 1 }} />
      )}
      {videoKey && (
        <iframe
          ref={iframeRef}
          key={videoKey}
          title=""
          tabIndex={-1}
          allow="autoplay; encrypted-media"
          src={`${YOUTUBE_ORIGIN}/embed/${encodeURIComponent(videoKey)}?${params}`}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 scale-[1.15] border-0 transition-opacity duration-500"
          style={{ width: "max(100cqw, 177.78cqh)", height: "max(100cqh, 56.25cqw)", opacity: alignedKey === videoKey ? 1 : 0 }}
        />
      )}
    </div>
  );
}
