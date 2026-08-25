"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import { Volume2, VolumeX, TriangleAlert, ExternalLink } from "lucide-react";

import { useCroppedBackdrop } from "@/lib/media/useCroppedBackdrop";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { registerAmbientVideo } from "@/lib/player/ambientVideoRegistry";
import { useShouldUseCdn } from "@/lib/settings/useShouldUseCdn";
import type { TmdbImageSize } from "@/lib/metadata/tmdbImageCache";
import type { TrailerSource } from "@/lib/trailers/types";

const CDN_BASE = "https://image.tmdb.org/t/p";

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
// If the iframe_api script is blocked (ad blocker, network failure) the
// promise must still settle, or every subsequent loadYouTubeApi().then()
// would hang forever AND — worse — the async YT.Player creation could land
// on a detached DOM node after unmount/exit-animation, which is the exact
// recipe for "Failed to execute 'removeChild' on 'Node'" crashing the page
// into the global-error boundary.
const API_LOAD_TIMEOUT_MS = 10000;

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
    // Even when the script never fires onYouTubeIframeAPIReady (blocked),
    // resolve anyway — the callers all guard on window.YT before use. Reset
    // the cached promise so a LATER mount retries the load instead of being
    // stuck on a permanently-unresolved API forever.
    setTimeout(() => {
      apiLoadPromise = null;
      resolve();
    }, API_LOAD_TIMEOUT_MS);
  });
  return apiLoadPromise;
}

/**
 * The YouTube API REPLACES its target div with an iframe. That target must
 * therefore be created imperatively: if it were a React child, React would
 * later try to remove the original div during a slide exit, although YouTube
 * has already removed it. The outer host remains React-owned but its content
 * is deliberately opaque to React.
 */
function createSafeYouTubePlayer(
  host: HTMLElement | null,
  options: any
): any | null {
  try {
    if (!host?.isConnected) return null;
    const mountPoint = document.createElement("div");
    host.replaceChildren(mountPoint);
    return new (window as any).YT.Player(mountPoint, options);
  } catch {
    return null;
  }
}

function destroyYouTubePlayer(player: any, host: HTMLElement | null) {
  try { player?.destroy(); } catch { /* already gone */ }
  // The contents were never rendered by React, so removing them here cannot
  // invalidate React's child bookkeeping. It also prevents a late iframe
  // paint while Framer Motion is finishing a slide's exit transition.
  try { host?.replaceChildren(); } catch { /* host already detached */ }
}

/**
 * Direct MP4/HLS playback for the Apple/IMDb enhanced trailer sources —
 * native <video>, so unlike the YouTube iframe hack above it can just use
 * object-fit: cover for full-bleed sizing, no oversize-and-crop trick or
 * letterbox zoom needed. Native `loop` is also seamless (no end-card to
 * fight, unlike YouTube's ENDED state).
 */
function DirectVideoPlayer({ source, muted, className, onPlayingChange, onError }: { source: TrailerSource; muted: boolean; className?: string; onPlayingChange: (playing: boolean) => void; onError: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let hls: Hls | null = null;

    if (source.playbackType === "hls" && Hls.isSupported()) {
      hls = new Hls();
      hls.loadSource(source.url);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (data.fatal) onError();
      });
    } else {
      video.src = source.url;
    }
    video.play().catch(() => {
      // Autoplay can be rejected before the user has interacted with the
      // page at all — the same cover/backdrop crossfade below just stays on
      // the static image in that case, no different from a slow YouTube load.
    });

    return () => {
      hls?.destroy();
      video.removeAttribute("src");
      video.load();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source.url, source.playbackType]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  return (
    <video
      ref={videoRef}
      className={className}
      muted={muted}
      loop
      playsInline
      onPlaying={() => onPlayingChange(true)}
      onPause={() => onPlayingChange(false)}
      onWaiting={() => onPlayingChange(false)}
      onError={() => onError()}
    />
  );
}

type TrailerCandidate = { kind: "direct"; source: TrailerSource } | { kind: "youtube"; key: string };

export interface TrailerHeaderProps {
  backdropPath: string | null;
  size: TmdbImageSize;
  /** Ordered fallback candidates, best first — see pickTrailerCandidates() in tmdb.ts. A video can be embed-blocked (rights holder restriction, e.g. Kaamelott's trailer blocked by Calt Distribution) in a way TMDb's own metadata never flags; the player advances to the next candidate on error instead of just failing. */
  trailerKeys: string[];
  /** Apple/IMDb direct-video candidates — tried BEFORE trailerKeys when
   *  present, per the user's enhancedTrailerSourcesEnabled setting (resolved
   *  by the caller via useTrailerSources, not fetched here). Empty/absent
   *  falls straight through to the existing YouTube behavior, unchanged. */
  enhancedSources?: TrailerSource[];
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
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    let loopTimer: ReturnType<typeof setInterval> | null = null;

    loadYouTubeApi().then(() => {
      if (cancelled) return;
      const YT = (window as any).YT;
      if (!YT?.Player) return;
      const player = createSafeYouTubePlayer(hostRef.current, {
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
            // The IFrame API replaces our placeholder <div> with a brand-new
            // <iframe> that does NOT inherit its class/style — left alone,
            // the iframe falls back to YouTube's default 640x390 box instead
            // of the "cover trick" sizing (cqw/cqh units, oversized past the
            // container so overflow-hidden crops instead of letterboxing),
            // and — separately — starts intercepting clicks over whatever
            // area it does get, including the mute button rendered on top of
            // it via z-index. Copying the host's own (already-correct)
            // className onto the iframe fixes both at once: same absolute
            // positioning/cover sizing, and pointer-events-none is one of
            // those classes already.
            try {
              const iframe = e.target.getIframe?.();
              if (iframe && hostRef.current) iframe.className = hostRef.current.className;
            } catch { /* best-effort */ }
            if (muted) e.target.mute();
            else e.target.unMute();
            e.target.setPlaybackQuality(MIN_QUALITY);
            // cc_load_policy: 0 above only sets the DEFAULT captions state —
            // YouTube can still force them on for some videos/viewers
            // regardless. unloadModule is undocumented but the only way to
            // actually guarantee no captions ever render on this decorative,
            // sound-off ambient background.
            try { e.target.unloadModule?.("captions"); } catch { /* best-effort */ }
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
              try { e.target.unloadModule?.("captions"); } catch { /* best-effort */ }
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
      // Container detached or API failed to build the player → try the next
      // candidate instead of leaving YouTube's dead chrome on screen.
      if (player) playerRef.current = player;
      else onError();
    });

    return () => {
      if (loopTimer) clearInterval(loopTimer);
      cancelled = true;
      destroyYouTubePlayer(playerRef.current, hostRef.current);
      playerRef.current = null;
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
      ref={hostRef}
      title={title}
      // scale-110 — a small extra zoom on top of the cover-fit sizing above.
      // Started at scale-105; bumped after confirming live that some real
      // trailers (Aladdin 2019, recurring — not a one-off black transition
      // frame) bake in a thin cinematic letterbox for part of the runtime.
      // Per-video detection was tried (thumbnail pixel analysis) and
      // dropped — a single thumbnail frame doesn't represent shots that
      // toggle in and out of letterbox through the video, so it can't be
      // reliably automated; a uniform zoom applied to every video is the
      // simple fix that actually holds up. No per-video logic, so a
      // perfectly flat 16:9 trailer (Hurlevent) trades a few extra cropped
      // pixels for consistency — same reasoning as the crop clause below.
      //
      // A "render huge, transform-scale it back down" trick was tried here
      // to nudge YouTube's quality heuristic (which reads the iframe's own
      // un-transformed layout size) — reverted after confirming live it
      // broke the video into disconnected fragments. The oversize math
      // itself checked out on paper (every length scaled by the same
      // factor, aspect ratio preserved); the actual cause is more likely
      // YouTube's OWN player switching to a different internal layout
      // (related-videos strip, TV-sized chrome…) once it believes the
      // player is that large — not something CSS on our side controls.
      // Not worth re-attempting without a real way to inspect what
      // YouTube's iframe renders internally at that size.
      className="pointer-events-none absolute left-1/2 top-1/2 h-[56.25cqw] w-[100cqw] min-h-full min-w-[177.78cqh] -translate-x-1/2 -translate-y-1/2 scale-110"
    />
  );
}

export function TrailerHeader({ backdropPath, size, trailerKeys, enhancedSources, title, trigger, enabled = true, muted: initialMuted = true, className }: TrailerHeaderProps) {
  const useCdn = useShouldUseCdn();
  const [backdropFellBack, setBackdropFellBack] = useState(false);
  useEffect(() => setBackdropFellBack(false), [backdropPath]);
  const backdropUrl = backdropPath
    ? (useCdn && !backdropFellBack ? `${CDN_BASE}/${size}${backdropPath}` : `/tmdb/${size}${backdropPath}`)
    : null;
  const onBackdropError = useCdn && !backdropFellBack ? () => setBackdropFellBack(true) : undefined;
  const croppedBackdrop = useCroppedBackdrop(backdropUrl);
  const [soundOn, setSoundOn] = useState(!initialMuted);
  const muted = !soundOn;
  // Enhanced (Apple/IMDb) sources are tried first, then the existing
  // YouTube keys — same ordered-fallback contract as trailerKeys alone had,
  // just with an extra tier prepended.
  const candidates = useMemo<TrailerCandidate[]>(
    () => [
      ...(enhancedSources ?? []).map((source): TrailerCandidate => ({ kind: "direct", source })),
      ...trailerKeys.map((key): TrailerCandidate => ({ kind: "youtube", key })),
    ],
    [enhancedSources, trailerKeys]
  );
  // Which candidate we're currently trying — advanced by onError below.
  // Reset to 0 whenever the candidate list itself changes (new title), not
  // just on every render, or a slide change would keep replaying whichever
  // fallback the PREVIOUS title happened to land on.
  const [candidateIndex, setCandidateIndex] = useState(0);
  useEffect(() => { setCandidateIndex(0); }, [candidates]);
  const candidate = candidates[candidateIndex] ?? null;
  const candidateKey = candidate ? (candidate.kind === "direct" ? candidate.source.url : candidate.key) : null;
  const canPlay = enabled && !!candidate;
  const [playing, setPlaying] = useState(trigger === "immediate" && canPlay);
  // The active player renders its own full "not playing" chrome (YouTube:
  // title/channel/suggested videos/logo; direct video: none, but the same
  // state still gates the crossfade) any time it isn't actively playing —
  // buffering, paused, cued, ended mid-loop-restart — not just once at first
  // load. The cover stays up whenever that's true, reset to "covered" on
  // every new video so a slide change never briefly reuses a stale value.
  const [videoPlaying, setVideoPlaying] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (trigger === "immediate") setPlaying(canPlay);
  }, [trigger, canPlay]);

  useEffect(() => { setVideoPlaying(false); }, [candidateKey, playing]);

  // This exact video is blocked/removed — never a network hiccup (that
  // wouldn't fire onError at all) — so retrying it would just fail again.
  // Move to the next candidate; once the list is exhausted, candidate
  // resolves to null and canPlay naturally falls back to the static poster.
  const onVideoError = () => setCandidateIndex((i) => i + 1);

  useEffect(() => () => { if (hoverTimer.current) clearTimeout(hoverTimer.current); }, []);

  // Lets the real player (PlayerProvider.play()) stop this ambient preview
  // the instant it opens, so only one video is ever playing at once — reuses
  // the exact same setPlaying(false) this component already calls itself on
  // hover-leave, just exposed so it can also be triggered externally.
  useEffect(() => registerAmbientVideo(() => setPlaying(false)), []);

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
      {/* Backdrop is always mounted as the base layer — never unmounted/
          re-mounted by a framer-motion AnimatePresence exit here. The outer
          slideshow (HeroSlideshow) already owns its own AnimatePresence
          crossfade over this entire component when the active slide changes;
          nesting a second AnimatePresence in here that could still be mid
          exit-removal at the exact moment the outer one unmounts this whole
          subtree was the recipe for React's "removeChild ... not a child of
          this node" crash (two independent framer-motion instances racing
          to remove overlapping DOM). Plain conditional rendering below
          removes/creates nodes synchronously within React's own commit, so
          there is only ever one exit-removal in flight for this subtree. */}
      {croppedBackdrop ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={croppedBackdrop} alt="" loading="lazy" onError={onBackdropError} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 h-full w-full bg-surface" />
      )}

      {playing && canPlay && candidate && (
        // "Cover" trick using container-query units: the player is always
        // sized to at least fill the container's width AND height (never
        // letterboxed), cropping top/bottom or sides as needed.
        // `overflow-hidden` on the wrapper guarantees it can never bleed
        // outside the header into neighboring layout (e.g. the sidebar). The
        // cover div below shows the same backdrop already visible on the
        // base layer, so this layer appearing is imperceptible — the video
        // reveal itself is what actually crossfades in, via videoPlaying.
        <div className="absolute inset-0 h-full w-full">
          {candidate.kind === "direct" ? (
            <DirectVideoPlayer
              key={candidateKey}
              source={candidate.source}
              muted={muted}
              className="absolute inset-0 h-full w-full object-cover"
              onPlayingChange={setVideoPlaying}
              onError={onVideoError}
            />
          ) : (
            <YouTubePlayer key={candidateKey} trailerKey={candidate.key} title={title} muted={muted} onPlayingChange={setVideoPlaying} onError={onVideoError} />
          )}
          <div
            className={cn(
              "absolute inset-0 transition-opacity duration-500",
              videoPlaying ? "pointer-events-none opacity-0" : "opacity-100"
            )}
          >
            {croppedBackdrop ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={croppedBackdrop} alt="" onError={onBackdropError} className="h-full w-full object-cover" />
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
        </div>
      )}
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
export function TrailerModalPlayer({ trailerKeys, enhancedSources, title }: { trailerKeys: string[]; enhancedSources?: TrailerSource[]; title: string }) {
  const t = useT();
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const candidates = useMemo<TrailerCandidate[]>(
    () => [
      ...(enhancedSources ?? []).map((source): TrailerCandidate => ({ kind: "direct", source })),
      ...trailerKeys.map((key): TrailerCandidate => ({ kind: "youtube", key })),
    ],
    [enhancedSources, trailerKeys]
  );
  const [candidateIndex, setCandidateIndex] = useState(0);
  const candidate = candidates[candidateIndex] ?? null;
  const trailerKey = candidate?.kind === "youtube" ? candidate.key : null;
  const directSource = candidate?.kind === "direct" ? candidate.source : null;

  useEffect(() => {
    if (!trailerKey) return;
    let cancelled = false;
    loadYouTubeApi().then(() => {
      if (cancelled) return;
      if (!(window as any).YT?.Player) return;
      const player = createSafeYouTubePlayer(hostRef.current, {
        videoId: trailerKey,
        playerVars: { autoplay: 1, playsinline: 1, rel: 0 },
        events: {
          onReady: (e: any) => {
            try {
              const iframe = e.target.getIframe?.();
              if (iframe && hostRef.current) iframe.className = hostRef.current.className;
            } catch { /* best-effort */ }
            e.target.setPlaybackQuality(MIN_QUALITY);
          },
          onStateChange: (e: any) => {
            const YTNS = (window as any).YT;
            if (e.data === YTNS.PlayerState.PLAYING) e.target.setPlaybackQuality(MIN_QUALITY);
          },
          onError: () => setCandidateIndex((i) => i + 1),
        },
      });
      if (player) playerRef.current = player;
      else setCandidateIndex((i) => i + 1);
    });
    return () => {
      cancelled = true;
      destroyYouTubePlayer(playerRef.current, hostRef.current);
      playerRef.current = null;
    };
  }, [trailerKey]);

  if (directSource) {
    return (
      <DirectVideoPlayer
        key={directSource.url}
        source={directSource}
        muted={false}
        className="aspect-video w-full"
        onPlayingChange={() => {}}
        onError={() => setCandidateIndex((i) => i + 1)}
      />
    );
  }

  if (!candidate) {
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

  return <div ref={hostRef} title={title} className="aspect-video w-full" />;
}
