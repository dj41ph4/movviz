"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Volume2, VolumeX, TriangleAlert, ExternalLink } from "lucide-react";
import { useShouldReduceMotion } from "@/lib/motion/useReduceMotion";
import { useCroppedBackdrop } from "@/lib/media/useCroppedBackdrop";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

/**
 * Shared "video instead of a static backdrop" header — used by the title
 * page/sidepanel header (TitleContent.tsx) and the dashboard Cinematic Hero
 * (DashboardHero.tsx). One fade/mute/loop/fallback implementation instead of
 * two, so a fix or tweak to the premium video treatment never has to be
 * made twice.
 *
 * Always muted, always looping, never a substitute for the real "watch the
 * trailer with sound" action elsewhere on the page — this is strictly an
 * ambient preview.
 *
 * Uses the YouTube IFrame Player API (not a raw `<iframe src=...>`) so we can
 * call `setPlaybackQuality("hd1080")` programmatically — URL query params
 * like `vq=` are a legacy hint YouTube frequently ignores; the JS API call is
 * the only mechanism that actually has a real (still best-effort, YouTube
 * can still downgrade for a slow connection) chance of enforcing a minimum
 * quality. Looping is done manually via `onStateChange` (ENDED → seekTo(0) +
 * playVideo()) rather than the `loop=1&playlist=` URL trick, since a manual
 * loop lets us re-assert the quality floor on every replay too.
 */

const HOVER_DELAY_MS = 900; // "survol prolongé" — not an instant trigger on mouse-in
const MIN_QUALITY = "hd1080";

let apiLoadPromise: Promise<void> | null = null;
export function loadYouTubeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if ((window as any).YT?.Player) return Promise.resolve();
  if (apiLoadPromise) return apiLoadPromise;
  apiLoadPromise = new Promise((resolve) => {
    const prev = (window as any).onYouTubeIframeAPIReady;
    (window as any).onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });
  return apiLoadPromise;
}

export interface TrailerHeaderProps {
  backdropUrl: string | null;
  /** Ordered fallback candidates, best first — see pickTrailerCandidates() in tmdb.ts. A video can be embed-blocked (rights holder restriction, e.g. Kaamelott's trailer blocked by Calt Distribution) in a way TMDb's own metadata never flags; the player advances to the next candidate on error instead of just failing. */
  trailerKeys: string[];
  title: string;
  /** "immediate" — starts as soon as it's allowed to (title page header).
   *  "hover" — only plays while hovered past HOVER_DELAY_MS (dashboard hero, several slides share the same screen real estate). */
  trigger: "immediate" | "hover";
  /** Hard off-switch (a settings toggle) — when false, the player is never mounted at all, not just hidden. */
  enabled?: boolean;
  /** Defaults to true (ambient autoplay is always muted by policy/design) — set to false to let the user opt into sound via their own control. */
  muted?: boolean;
  className?: string;
}

// How close to the true end (seconds) to preemptively loop back to the
// start. YouTube's native ENDED state draws an end-card (title, channel,
// suggested videos, logo) that a follow-up seekTo()+playVideo() command
// does NOT reliably dismiss — it can linger visibly over the restarted
// video. Looping slightly BEFORE the real end means ENDED never actually
// fires, so that end-card never has a chance to render in the first place.
const LOOP_BEFORE_END_SEC = 0.75;
const LOOP_POLL_MS = 250;

function YouTubePlayer({ trailerKey, title, muted, onPlayingChange, onError }: { trailerKey: string; title: string; muted: boolean; onPlayingChange: (playing: boolean) => void; onError: () => void }) {
  const containerId = `yt-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const playerRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    let loopTimer: ReturnType<typeof setInterval> | null = null;

    loadYouTubeApi().then(() => {
      if (cancelled) return;
      const YT = (window as any).YT;
      playerRef.current = new YT.Player(containerId, {
        videoId: trailerKey,
        playerVars: {
          autoplay: 1,
          mute: 1,
          controls: 0,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
          iv_load_policy: 3,
          disablekb: 1,
          fs: 0,
          cc_load_policy: 0,
        },
        events: {
          onReady: (e: any) => {
            // The IFrame API replaces our placeholder <div> (which carries
            // pointer-events-none) with a brand-new <iframe> that does NOT
            // inherit its class/style — without this, the iframe silently
            // starts intercepting clicks over its whole (oversized, cover-
            // trick) area, including the mute button rendered on top of it,
            // even though the button visually sits above it via z-index.
            try {
              const iframe = e.target.getIframe?.();
              if (iframe) iframe.style.pointerEvents = "none";
            } catch { /* best-effort */ }
            if (muted) e.target.mute();
            else e.target.unMute();
            e.target.setPlaybackQuality(MIN_QUALITY);
            e.target.playVideo();
            loopTimer = setInterval(() => {
              const player = playerRef.current;
              if (!player?.getDuration) return;
              const duration = player.getDuration();
              const current = player.getCurrentTime();
              if (duration > 0 && duration - current <= LOOP_BEFORE_END_SEC) {
                player.seekTo(0, true);
              }
            }, LOOP_POLL_MS);
          },
          onStateChange: (e: any) => {
            const YTNS = (window as any).YT;
            const isPlaying = e.data === YTNS.PlayerState.PLAYING;
            // Reported on EVERY transition, not just the first one — YouTube's
            // full "paused" chrome (title, channel avatar, suggested videos,
            // logo, center pause icon) renders any time the player isn't
            // actively PLAYING (buffering, paused, cued), so the cover needs
            // to come back for those too, not just the initial load. ENDED is
            // deliberately not handled here anymore — the poll above loops
            // before the video ever reaches it.
            onPlayingChange(isPlaying);
            if (isPlaying) {
              e.target.setPlaybackQuality(MIN_QUALITY);
            }
          },
          // Fires for a removed/private video (100) or one the owner has
          // disabled embedding for (101/150 — the actual Kaamelott case:
          // blocked by Calt Distribution on third-party sites). Never
          // reached for network hiccups, so this is specifically "this
          // exact video will never play here," worth immediately trying
          // the next candidate for.
          onError: () => onError(),
        },
      });
    });

    return () => {
      if (loopTimer) clearInterval(loopTimer);
      cancelled = true;
      try { playerRef.current?.destroy(); } catch { /* already gone */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trailerKey]);

  // Live mute/unmute toggle (e.g. a user-facing sound button) — separate
  // from the one-time onReady setup above, since that only ever runs once
  // per player instance.
  useEffect(() => {
    const player = playerRef.current;
    if (!player?.mute) return;
    if (muted) player.mute();
    else player.unMute();
  }, [muted]);

  return (
    <div
      // pointer-events-none: this is a decorative ambient background, never a
      // player the user interacts with directly (our own buttons drive
      // play/pause) — since the mouse can never reach the iframe, YouTube's
      // own hover/pause overlay never has a chance to trigger. The
      // playerVars above (rel/iv_load_policy/disablekb/fs) are a second line
      // of defense at the embed level. YouTube's small branding mark in the
      // corner is required by their ToS and cannot be removed even via the
      // official API — modestbranding=1 is the only lever available.
      id={containerId}
      title={title}
      className="pointer-events-none absolute left-1/2 top-1/2 h-[56.25cqw] w-[100cqw] min-h-full min-w-[177.78cqh] -translate-x-1/2 -translate-y-1/2"
    />
  );
}

export function TrailerHeader({ backdropUrl, trailerKeys, title, trigger, enabled = true, muted: initialMuted = true, className }: TrailerHeaderProps) {
  const reduceMotion = useShouldReduceMotion();
  const croppedBackdrop = useCroppedBackdrop(backdropUrl);
  const [soundOn, setSoundOn] = useState(!initialMuted);
  const muted = !soundOn;
  // Which candidate we're currently trying — advanced by onError below.
  // Reset to 0 whenever the candidate list itself changes (new title), not
  // just on every render, or a slide change would keep replaying whichever
  // fallback the PREVIOUS title happened to land on.
  const [candidateIndex, setCandidateIndex] = useState(0);
  useEffect(() => { setCandidateIndex(0); }, [trailerKeys]);
  const trailerKey = trailerKeys[candidateIndex] ?? null;
  const canPlay = enabled && !!trailerKey && !reduceMotion;
  const [playing, setPlaying] = useState(trigger === "immediate" && canPlay);
  // YouTube renders its own full "not playing" chrome — title, channel
  // avatar, suggested videos, logo, center play/pause icon — any time the
  // player state isn't actively PLAYING (buffering, paused, cued, ended
  // mid-loop-restart), not just once at first load. The cover stays up
  // whenever that's true, reset to "covered" on every new video so a slide
  // change never briefly reuses a stale "was playing" value.
  const [videoPlaying, setVideoPlaying] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (trigger === "immediate") setPlaying(canPlay);
  }, [trigger, canPlay]);

  useEffect(() => { setVideoPlaying(false); }, [trailerKey, playing]);

  // This exact video is blocked/removed — never a network hiccup (that
  // wouldn't fire onError at all) — so retrying it would just fail again.
  // Move to the next candidate; once the list is exhausted, trailerKey
  // resolves to null and canPlay naturally falls back to the static poster.
  const onVideoError = () => setCandidateIndex((i) => i + 1);

  useEffect(() => () => { if (hoverTimer.current) clearTimeout(hoverTimer.current); }, []);

  const onMouseEnter = () => {
    if (trigger !== "hover" || !canPlay) return;
    hoverTimer.current = setTimeout(() => setPlaying(true), HOVER_DELAY_MS);
  };
  const onMouseLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    if (trigger === "hover") setPlaying(false);
  };

  return (
    <div
      className={`${className ?? ""} relative overflow-hidden`}
      // `contain: paint` on top of overflow-hidden — the "cover" trick below
      // deliberately oversizes the YouTube iframe past this box (cqw/cqh
      // units) and relies on clipping to hide the excess. overflow-hidden
      // clips normal content reliably, but YouTube's own ad-break UI
      // (rendered inside the iframe, entirely outside our control) was seen
      // briefly painting past this boundary during ad load — paint
      // containment is a hard clip guarantee at the compositor level,
      // closing that gap regardless of what the embedded iframe does.
      style={{ containerType: "size", contain: "paint" }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <AnimatePresence mode="wait">
        {playing && canPlay ? (
          // "Cover" trick using container-query units: the player is always
          // sized to at least fill the container's width AND height (never
          // letterboxed), cropping top/bottom or sides as needed.
          // `overflow-hidden` on the wrapper guarantees it can never bleed
          // outside the header into neighboring layout (e.g. the sidebar).
          <motion.div
            key="trailer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="relative h-full w-full"
          >
            <YouTubePlayer key={trailerKey} trailerKey={trailerKey!} title={title} muted={muted} onPlayingChange={setVideoPlaying} onError={onVideoError} />
            <div
              className={cn(
                "absolute inset-0 transition-opacity duration-500",
                videoPlaying ? "pointer-events-none opacity-0" : "opacity-100"
              )}
            >
              {croppedBackdrop ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={croppedBackdrop} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-surface" />
              )}
            </div>
            {/* Son — bascule muet/sonore, visible seulement quand la vidéo joue.
                Top-left, at every width — the bottom-right corner is where
                every consumer (TitleContent, DashboardHero) anchors its
                title/actions block, which can grow tall enough (wrapping
                onto more lines, more badges/buttons than usual) to sit on
                top of and swallow clicks on that corner even on a wide
                screen; top-left is never contested by either consumer,
                regardless of width. */}
            <button
              onClick={() => setSoundOn((s) => !s)}
              className={cn(
                "absolute top-4 left-4 z-20 flex h-11 w-11 items-center justify-center rounded-full backdrop-blur transition-all duration-200",
                "bg-black/40 text-white/80 hover:bg-white/20 hover:text-white hover:scale-110 active:scale-95"
              )}
              aria-label={muted ? "Activer le son" : "Couper le son"}
            >
              {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
          </motion.div>
        ) : croppedBackdrop ? (
          <motion.img
            key="backdrop"
            src={croppedBackdrop}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        ) : (
          <div key="empty" className="h-full w-full bg-surface" />
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Interactive, user-controls-visible player for the "watch trailer" modal
 * (TitleContent.tsx) — deliberately separate from the ambient background
 * player above (ambient is muted/looping/chromeless; this is a single
 * explicit watch with full YouTube controls and sound). Shares the same
 * candidate-list-with-fallback approach: on a blocked/removed video (the
 * Kaamelott-blocked-by-Calt-Distribution case), it advances to the next
 * TMDb/YouTube candidate automatically instead of leaving YouTube's own
 * "Video unavailable" chrome on screen with no way out but closing the modal.
 */
export function TrailerModalPlayer({ trailerKeys, title }: { trailerKeys: string[]; title: string }) {
  const t = useT();
  const containerId = `yt-modal-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const playerRef = useRef<any>(null);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const trailerKey = trailerKeys[candidateIndex] ?? null;

  useEffect(() => {
    if (!trailerKey) return;
    let cancelled = false;
    loadYouTubeApi().then(() => {
      if (cancelled) return;
      const YT = (window as any).YT;
      playerRef.current = new YT.Player(containerId, {
        videoId: trailerKey,
        playerVars: { autoplay: 1, playsinline: 1, rel: 0 },
        events: {
          onError: () => setCandidateIndex((i) => i + 1),
        },
      });
    });
    return () => {
      cancelled = true;
      try { playerRef.current?.destroy(); } catch { /* already gone */ }
    };
  }, [containerId, trailerKey]);

  if (!trailerKey) {
    // Every candidate failed — a plain YouTube link at least gives the user
    // a way to actually watch it, since youtube.com itself isn't subject to
    // the same third-party embed restriction that blocked it here.
    const firstKey = trailerKeys[0];
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 bg-surface p-6 text-center">
        <TriangleAlert className="h-8 w-8 text-amber" />
        <p className="font-semibold text-ink">{t("title.trailerUnavailable")}</p>
        <p className="max-w-sm text-sm text-ink-dim">{t("title.trailerUnavailableHint")}</p>
        {firstKey && (
          <a
            href={`https://www.youtube.com/watch?v=${firstKey}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 flex items-center gap-1.5 rounded-xl brand-gradient px-4 py-2 text-sm font-bold text-white transition-transform hover:scale-105"
          >
            <ExternalLink className="h-4 w-4" /> {t("title.watchOnYoutube")}
          </a>
        )}
      </div>
    );
  }

  return <div id={containerId} title={title} className="aspect-video w-full" />;
}
