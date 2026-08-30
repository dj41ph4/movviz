"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const YOUTUBE_ORIGIN = "https://www.youtube.com";
const LOAD_TIMEOUT_MS = 6000;
const HANDSHAKE_TIMEOUT_MS = 3000;
const PLAYBACK_TIMEOUT_MS = 5000;
const LISTEN_RETRY_MS = 200;
const REVEAL_SETTLE_MS = 700;
const ADVANCE_SEC = 0.03;
// Card-only experiment: keep YouTube's *layout viewport* genuinely large so
// the embed chooses its desktop player layout while CSS scales that viewport
// down into the small Movviz popover. A transform does not change the iframe
// document's innerWidth/innerHeight, so YouTube still sees 1920x1080.
const VIRTUAL_PLAYER_WIDTH = 1920;
const VIRTUAL_PLAYER_HEIGHT = 1080;
const CARD_CROP_ZOOM = 1.36;
const VIRTUAL_LAYOUT_TIMEOUT_MS = 1500;

type BridgePayload = {
  event?: string;
  id?: number | string;
  channel?: string;
  info?: unknown;
};

export function YouTubeCardBridgePlayer({
  trailerKey,
  title,
  muted,
  loopBeforeEndSec,
  onPlayingChange,
  onError,
  fallback,
}: {
  trailerKey: string;
  title: string;
  muted: boolean;
  loopBeforeEndSec: number;
  onPlayingChange: (playing: boolean) => void;
  onError: () => void;
  fallback: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const commandRef = useRef<((func: string, args?: unknown[]) => boolean) | null>(null);
  const [useFallback, setUseFallback] = useState(false);
  const [virtualScale, setVirtualScale] = useState<number | null>(null);

  useEffect(() => {
    if (useFallback) return;
    const container = containerRef.current;
    if (!container) return;
    if (typeof ResizeObserver === "undefined") {
      console.debug(`[Movviz][YouTubeBridge] ${trailerKey}: fallback (ResizeObserver unavailable)`);
      setUseFallback(true);
      return;
    }

    let cancelled = false;
    let hadValidLayout = false;
    const updateVirtualScale = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (!(width > 0) || !(height > 0)) return;
      const coverScale = Math.max(width / VIRTUAL_PLAYER_WIDTH, height / VIRTUAL_PLAYER_HEIGHT);
      const nextScale = coverScale * CARD_CROP_ZOOM;
      if (!Number.isFinite(nextScale) || nextScale <= 0) return;
      if (!hadValidLayout) {
        console.debug(
          `[Movviz][YouTubeBridge] ${trailerKey}: virtual ${VIRTUAL_PLAYER_WIDTH}x${VIRTUAL_PLAYER_HEIGHT} -> ${Math.round(width)}x${Math.round(height)}; scale=${nextScale.toFixed(4)}`,
        );
      }
      hadValidLayout = true;
      setVirtualScale((previous) =>
        previous != null && Math.abs(previous - nextScale) < 0.0005 ? previous : nextScale,
      );
    };

    updateVirtualScale();
    const observer = new ResizeObserver(updateVirtualScale);
    observer.observe(container);
    const layoutTimeout = setTimeout(() => {
      if (!cancelled && !hadValidLayout) {
        console.debug(`[Movviz][YouTubeBridge] ${trailerKey}: fallback (invalid virtual layout)`);
        setUseFallback(true);
      }
    }, VIRTUAL_LAYOUT_TIMEOUT_MS);

    return () => {
      cancelled = true;
      clearTimeout(layoutTimeout);
      observer.disconnect();
    };
  }, [trailerKey, useFallback]);

  useEffect(() => {
    if (useFallback) return;
    const iframe = iframeRef.current;
    if (!iframe) return;

    let cancelled = false;
    let fallingBack = false;
    let ready = false;
    let revealed = false;
    let lastCurrentTime: number | null = null;
    let duration = 0;
    let playerState = -1;
    let loopArmed = true;
    let listeningTimer: ReturnType<typeof setInterval> | null = null;
    let loadTimeout: ReturnType<typeof setTimeout> | null = null;
    let handshakeTimeout: ReturnType<typeof setTimeout> | null = null;
    let playbackTimeout: ReturnType<typeof setTimeout> | null = null;
    let revealTimer: ReturnType<typeof setTimeout> | null = null;
    let postPlayChromeTimer: ReturnType<typeof setTimeout> | null = null;
    const bridgeId = Math.floor(Math.random() * 1_000_000_000) + 1;
    const capabilities = new Set<string>();

    const clearTimers = () => {
      if (listeningTimer) clearInterval(listeningTimer);
      if (loadTimeout) clearTimeout(loadTimeout);
      if (handshakeTimeout) clearTimeout(handshakeTimeout);
      if (playbackTimeout) clearTimeout(playbackTimeout);
      if (revealTimer) clearTimeout(revealTimer);
      if (postPlayChromeTimer) clearTimeout(postPlayChromeTimer);
      listeningTimer = null;
      loadTimeout = null;
      handshakeTimeout = null;
      playbackTimeout = null;
      revealTimer = null;
      postPlayChromeTimer = null;
    };

    const post = (payload: Record<string, unknown>) => {
      try {
        iframe.contentWindow?.postMessage(
          JSON.stringify({ ...payload, id: bridgeId, channel: "widget" }),
          YOUTUBE_ORIGIN,
        );
        return true;
      } catch {
        return false;
      }
    };

    const command = (func: string, args: unknown[] = []) => {
      if (!capabilities.has(func)) return false;
      return post({ event: "command", func, args });
    };
    commandRef.current = command;

    const hideAdvertisedChrome = () => {
      command("hideVideoInfo");
      command("hideControls");
      command("unloadModule", ["captions"]);
    };

    const fallbackToStablePlayer = (reason: string) => {
      if (cancelled || fallingBack) return;
      fallingBack = true;
      console.debug(`[Movviz][YouTubeBridge] ${trailerKey}: fallback (${reason})`);
      clearTimers();
      commandRef.current = null;
      onPlayingChange(false);
      setUseFallback(true);
    };

    const revealWhenStable = () => {
      if (cancelled || fallingBack || revealed || revealTimer) return;
      hideAdvertisedChrome();
      postPlayChromeTimer = setTimeout(hideAdvertisedChrome, 250);
      revealTimer = setTimeout(() => {
        revealTimer = null;
        if (cancelled || fallingBack || revealed) return;
        revealed = true;
        if (playbackTimeout) clearTimeout(playbackTimeout);
        playbackTimeout = null;
        onPlayingChange(true);
      }, REVEAL_SETTLE_MS);
    };

    const installCapabilities = (apiInterface: unknown) => {
      if (ready || !Array.isArray(apiInterface)) return;
      for (const entry of apiInterface) {
        if (typeof entry === "string") capabilities.add(entry);
      }
      if (!capabilities.has("playVideo")) {
        fallbackToStablePlayer("playVideo unavailable");
        return;
      }

      ready = true;
      if (listeningTimer) clearInterval(listeningTimer);
      listeningTimer = null;
      if (handshakeTimeout) clearTimeout(handshakeTimeout);
      handshakeTimeout = null;
      if (loadTimeout) clearTimeout(loadTimeout);
      loadTimeout = null;

      const chromeCaps = ["hideVideoInfo", "isVideoInfoVisible", "hideControls"]
        .filter((name) => capabilities.has(name));
      console.debug(`[Movviz][YouTubeBridge] ${trailerKey}: ready; chrome=${chromeCaps.join(",") || "none"}`);

      command("addEventListener", ["onStateChange"]);
      command("addEventListener", ["onError"]);
      if (muted) command("mute");
      else command("unMute");
      hideAdvertisedChrome();
      command("playVideo");

      playbackTimeout = setTimeout(() => {
        if (!revealed) fallbackToStablePlayer("no advancing playback");
      }, PLAYBACK_TIMEOUT_MS);
    };

    const parse = (raw: unknown): BridgePayload | null => {
      try {
        const value = typeof raw === "string" ? JSON.parse(raw) : raw;
        return value && typeof value === "object" ? value as BridgePayload : null;
      } catch {
        return null;
      }
    };

    const onMessage = (event: MessageEvent) => {
      if (cancelled || fallingBack || event.origin !== YOUTUBE_ORIGIN || event.source !== iframe.contentWindow) return;
      const data = parse(event.data);
      if (!data) return;
      const info = data.info as Record<string, unknown> | number | undefined;

      if (data.event === "initialDelivery" && info && typeof info === "object") {
        installCapabilities(info.apiInterface);
        if (typeof info.playerState === "number") playerState = info.playerState;
      }

      if (data.event === "onError") {
        onError();
        return;
      }

      if (data.event === "onStateChange") {
        const rawState = typeof info === "number"
          ? info
          : (info && typeof info === "object" ? info.playerState : undefined);
        if (typeof rawState === "number") playerState = rawState;
        if (playerState === 1) hideAdvertisedChrome();
      }

      if (data.event !== "infoDelivery" || !info || typeof info !== "object") return;
      installCapabilities(info.apiInterface);
      if (typeof info.playerState === "number") playerState = info.playerState;
      if (typeof info.duration === "number" && Number.isFinite(info.duration)) duration = info.duration;
      const current = typeof info.currentTime === "number" && Number.isFinite(info.currentTime)
        ? info.currentTime
        : null;

      if (playerState === 1) hideAdvertisedChrome();
      if (current == null) return;

      if (playerState === 1 && lastCurrentTime != null && current > lastCurrentTime + ADVANCE_SEC) {
        revealWhenStable();
      }

      if (duration > 0 && loopArmed && duration - current <= loopBeforeEndSec) {
        loopArmed = false;
        command("seekTo", [0, true]);
        command("playVideo");
        hideAdvertisedChrome();
      } else if (!loopArmed && current < 2) {
        loopArmed = true;
      }
      lastCurrentTime = current;
    };

    const sendListening = () => post({ event: "listening" });
    const onLoad = () => {
      if (cancelled || fallingBack) return;
      sendListening();
      listeningTimer = setInterval(() => {
        if (!ready) sendListening();
      }, LISTEN_RETRY_MS);
      handshakeTimeout = setTimeout(() => {
        if (!ready) fallbackToStablePlayer("handshake timeout");
      }, HANDSHAKE_TIMEOUT_MS);
    };

    window.addEventListener("message", onMessage);
    iframe.addEventListener("load", onLoad);
    loadTimeout = setTimeout(() => fallbackToStablePlayer("iframe load timeout"), LOAD_TIMEOUT_MS);

    const params = new URLSearchParams({
      autoplay: "1",
      mute: "1",
      controls: "0",
      playsinline: "1",
      rel: "0",
      iv_load_policy: "3",
      disablekb: "1",
      fs: "0",
      cc_load_policy: "0",
      enablejsapi: "1",
      origin: window.location.origin,
    });
    iframe.src = `${YOUTUBE_ORIGIN}/embed/${encodeURIComponent(trailerKey)}?${params.toString()}`;

    return () => {
      cancelled = true;
      clearTimers();
      commandRef.current = null;
      window.removeEventListener("message", onMessage);
      iframe.removeEventListener("load", onLoad);
      try { iframe.removeAttribute("src"); } catch { /* already detached */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trailerKey, useFallback]);

  useEffect(() => {
    if (useFallback) return;
    const command = commandRef.current;
    if (!command) return;
    if (muted) command("mute");
    else command("unMute");
  }, [muted, useFallback]);

  if (useFallback) return <>{fallback}</>;

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ contain: "paint" }}
    >
      <iframe
        ref={iframeRef}
        title={title}
        width={VIRTUAL_PLAYER_WIDTH}
        height={VIRTUAL_PLAYER_HEIGHT}
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        className="pointer-events-none absolute left-1/2 top-1/2 max-w-none border-0"
        style={{
          width: `${VIRTUAL_PLAYER_WIDTH}px`,
          height: `${VIRTUAL_PLAYER_HEIGHT}px`,
          transform: `translate(-50%, -50%) scale(${virtualScale ?? 1})`,
          transformOrigin: "center center",
        }}
      />
    </div>
  );
}
