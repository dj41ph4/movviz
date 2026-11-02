"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { videoPositionNow } from "@/lib/player/heroVideoClock";

const YOUTUBE_ORIGIN = "https://www.youtube.com";
/** Re-align the mirror as soon as it drifts this far from the visible video. */
const MAX_DRIFT_SEC = 0.3;
const SEEK_COOLDOWN_MS = 800;

/** Le halo déborde du héros d'une distance fixe (px) sur chaque côté : il est
 *  étiré séparément en largeur et en hauteur (--ambi-sx / --ambi-sy) plutôt
 *  qu'agrandi uniformément. La déformation est invisible sous le flou et les
 *  quatre côtés prolongent la scène sur la même épaisseur. */
const OVERSHOOT_X = 200;
const OVERSHOOT_Y = 150;

/** Fondu des bords par masque, indépendamment du flou : si le navigateur
 *  abandonne le filtre sur ce très grand calque (plein écran), le halo garde des
 *  bords doux. Le dégradé suit une courbe « smootherstep » (pente nulle aux deux
 *  extrémités) : le halo naît progressivement, sans début marqué.
 *  --ambi-fx / --ambi-fy = part du calque qui dépasse du héros, en % ; le fondu
 *  est plein juste avant le bord du héros. */
const FADE_STEPS = 8;
const smootherstep = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const fade = (dir: string, f: string) => {
  const rise = Array.from({ length: FADE_STEPS + 1 }, (_, i) => {
    const t = i / FADE_STEPS;
    return `rgba(0,0,0,${smootherstep(t).toFixed(4)}) calc(var(${f}) * ${(t * 1.1).toFixed(4)})`;
  });
  const fall = Array.from({ length: FADE_STEPS + 1 }, (_, i) => {
    const t = 1 - i / FADE_STEPS;
    return `rgba(0,0,0,${smootherstep(t).toFixed(4)}) calc(100% - var(${f}) * ${(t * 1.1).toFixed(4)})`;
  });
  return `linear-gradient(${dir}, ${[...rise, ...fall].join(", ")})`;
};
const EDGE_FADE = fade("to right", "--ambi-fx");
const EDGE_FADE_Y = fade("to bottom", "--ambi-fy");
// Un masque par élément, jamais deux masques combinés (mask-composite) sur
// l'élément flouté : le masque du dessus ne s'applique que dans son propre
// rectangle, alors que le flou déborde de ce rectangle. La traîne du flou restait
// donc visible, réduite par le seul masque du dessous : une fine ligne au bord du
// calque (mesuré : 17 sur un fond à 12, quelle que soit la courbe du dégradé).
const AMBILIGHT_FRAME_STYLE = {
  maskImage: EDGE_FADE_Y,
  WebkitMaskImage: EDGE_FADE_Y,
  maskRepeat: "no-repeat",
  maskSize: "100% 100%",
} as CSSProperties;
const AMBILIGHT_STYLE = {
  containerType: "size",
  maskImage: EDGE_FADE,
  WebkitMaskImage: EDGE_FADE,
  maskRepeat: "no-repeat",
  maskSize: "100% 100%",
} as CSSProperties;

/** The mirror plays in a small player (cheap to decode) and is scaled up to
 *  the hero's cover framing: once blurred, nobody can tell the resolution. */
const MIRROR_W = 480;
const MIRROR_H = 270;

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
  const boxRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [alignedKey, setAlignedKey] = useState<string | null>(null);
  const [mirrorScale, setMirrorScale] = useState(3);

  // Same "cover" framing as before (max(100cqw, 177.78cqh) wide, +15%), obtained
  // by scaling the small player instead of sizing a full-resolution one.
  useEffect(() => {
    const box = boxRef.current;
    const frame = frameRef.current;
    if (!box || !frame) return;
    const update = () => {
      const width = box.offsetWidth;
      const height = box.offsetHeight;
      if (width > 0 && height > 0) {
        frame.style.setProperty("--ambi-sx", String(1 + (2 * OVERSHOOT_X) / width));
        frame.style.setProperty("--ambi-sy", String(1 + (2 * OVERSHOOT_Y) / height));
        frame.style.setProperty("--ambi-fx", `${(OVERSHOOT_X / (width + 2 * OVERSHOOT_X)) * 100}%`);
        frame.style.setProperty("--ambi-fy", `${(OVERSHOOT_Y / (height + 2 * OVERSHOOT_Y)) * 100}%`);
      }
      const full = Math.max(box.offsetWidth, box.offsetHeight * (MIRROR_W / MIRROR_H));
      if (full > 0) setMirrorScale((full / MIRROR_W) * 1.15);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

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

  // Same box and same "cover" framing as the hero video, so each edge of the
  // glow continues the colours sitting right at that edge of the card.
  return (
    <div ref={frameRef} aria-hidden className="mv-hero-ambilight-frame pointer-events-none absolute inset-0 -z-10" style={AMBILIGHT_FRAME_STYLE}>
    <div ref={boxRef} className="mv-hero-ambilight absolute inset-0" style={AMBILIGHT_STYLE}>
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
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border-0 transition-opacity duration-500"
          style={{ width: MIRROR_W, height: MIRROR_H, scale: mirrorScale, opacity: alignedKey === videoKey ? 1 : 0 }}
        />
      )}
    </div>
    </div>
  );
}
