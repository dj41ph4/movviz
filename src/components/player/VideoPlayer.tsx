"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
// dashjs est importé dynamiquement côté navigateur uniquement (window au
// niveau module — pas SSR-safe) ; seul le TYPE est importé statiquement.
import type { MediaPlayerClass } from "dashjs";
import { cn, openPlexLink } from "@/lib/utils";
import { useI18n } from "@/i18n/provider";
import { findTrackForLocale } from "@/lib/library/detectLanguage";
import { usePreferredAudioLanguage } from "@/lib/settings/usePreferredAudioLanguage";
import {
  X, Maximize2, Minimize2, ExternalLink, AlertTriangle, Loader2,
  Play, Pause, Volume2, Volume1, VolumeX, Gauge, AudioLines, Captions,
  SkipBack, SkipForward, PictureInPicture2, Zap, Monitor, Settings,
} from "lucide-react";
import { detectCodecs, isVideoCodecSupported, isAudioCodecSupported, isAudioMseTransmuxable, shouldForceAudioTranscode, type CodecCapabilities } from "@/lib/player/webcodecs";
import { watchForSilentAudio } from "@/lib/player/silentAudioDetector";
import { orchestrate } from "@/lib/playback/orchestrator";
import { detectCapabilities } from "@/lib/playback/capabilities";
import { MSEPlaybackEngine, type MseDebugStats } from "@/lib/playback/mse/MSEPlaybackEngine";
import { FfmpegRemuxEngine, type FfmpegDebugStats } from "@/lib/playback/ffmpeg/FfmpegRemuxEngine";
import type { MediaInfo } from "@/lib/playback/types";
import { useBetaPlayer } from "@/lib/settings/useBetaPlayer";

export interface VideoPlayerProps {
  ratingKey: string;
  plexUrl: string;
  title: string;
  onClose: () => void;
  useTranscode?: boolean;
  /** Seconds to pre-buffer before starting playback (default 0 = play immediately). */
  prebufferSeconds?: number;
  /** True when rendered inside TheaterModePlayer, which owns positioning,
   *  sizing, and the backdrop — skips this component's own fixed/backdrop
   *  wrapper so it doesn't fight the parent's animated geometry. */
  embedded?: boolean;
}

interface StreamTrack {
  id: string;
  codec: string;
  language: string;
  channels?: number;
  selected?: boolean;
}

interface StreamInfo {
  videoCodec: string | null;
  audioCodec: string | null;
  container: string | null;
  audioStreams?: StreamTrack[];
  subtitleStreams?: StreamTrack[];
  height?: number | null;
  ffmpegAvailable?: boolean;
  durationMs?: number | null;
}

/**
 * Best fallback track when the default one (DTS/TrueHD/PCM) can't be decoded.
 * Prefers: same language as the original track → 5.1 (3-6 channels) → 2.0 → AAC.
 */
function scoreAudioTrack(t: StreamTrack, prefLang: string): number {
  const c = (t.codec ?? "").toLowerCase();
  let score = 0;
  if (prefLang && (t.language ?? "").toLowerCase() === prefLang) score += 4;
  const ch = t.channels ?? 0;
  if (ch >= 3 && ch <= 6) score += 2;
  else if (ch === 2) score += 1;
  if (c.includes("aac")) score += 1;
  return score;
}

const PROGRESS_KEY = (ratingKey: string) => `movviz:progress:${ratingKey}`;
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

/**
 * Max seconds to pre-buffer before starting playback. The pre-buffer warms
 * the server-side stream cache so early seeks are instant — but it DELAYS
 * playback start by its own value, so it must stay small: wiring the old
 * streamCacheTtl default (300s) straight in as prebufferSeconds held every
 * movie on the "mise en cache…" screen for up to 5 minutes. 30s matches
 * hls.js's own maxBufferLength: a sane head start, not a loading wall.
 */
export const PREBUFFER_SECONDS = 30;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function VideoPlayer({ ratingKey, plexUrl, title, onClose, useTranscode, prebufferSeconds, embedded }: VideoPlayerProps) {
  const { t, locale } = useI18n();
  const tRef = useRef(t);
  tRef.current = t;
  // Langue audio préférée (Réglages → Plex) — distincte de la langue
  // d'interface, retombe dessus quand non définie ("auto").
  const { effective: preferredAudioLocale } = usePreferredAudioLanguage();
  const localeRef = useRef<string>(locale);
  localeRef.current = preferredAudioLocale;
  const beta = useBetaPlayer();
  const betaRef = useRef(beta);
  betaRef.current = beta;

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const dashRef = useRef<MediaPlayerClass | null>(null);
  const dashHeightRef = useRef<number | null>(null);
  const prebufferClearRef = useRef<(() => void) | null>(null);
  const fallbackGuardRef = useRef(false);
  const startHlsRef = useRef<((extraParams?: string, isCopyNetworkRetry?: boolean) => void) | null>(null);
  const stopSilentWatchRef = useRef<(() => void) | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const infoRef = useRef<StreamInfo>({ videoCodec: null, audioCodec: null, container: null });
  const progressRef = useRef<HTMLDivElement>(null);
  const volumeTrackRef = useRef<HTMLDivElement>(null);
  const seekingRef = useRef(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const beginRef = useRef<((seekTo?: number) => Promise<void>) | null>(null);
  const startDirectRef = useRef<((seekTo?: number, expectAudio?: boolean) => void) | null>(null);
  const transcodeVideoRef = useRef(true);
  const transcodeAudioRef = useRef(true);
  // Loop-guard: once the HLS-leg's ta=0 (copy) attempt has been live-verified
  // silent and escalated to ta=1 once, never retry ta=0 again for this
  // playback session — prevents a silent-copy → escalate → silent-copy loop.
  const hlsCopyEscalatedRef = useRef(false);
  // A transient network error (e.g. a 503 on segment 0 during Plex's
  // transcode spin-up — confirmed to happen even on Plex's own client, see
  // the v1.13.40 investigation notes) is NOT evidence the copied audio track
  // doesn't work. One genuine do-over (fresh Hls instance, fresh Plex
  // session, still ta=0) is allowed before a repeat failure counts as real.
  const hlsCopyNetworkRetriedRef = useRef(false);
  const transcodeModeRef = useRef<"auto" | "audio" | "video" | "full">("auto");
  const codecCapsRef = useRef<CodecCapabilities | null>(null);
  const audioStreamIdRef = useRef<string | null>(null);
  const defaultAudioIdRef = useRef<string | null>(null);
  const mseEngineRef = useRef<MSEPlaybackEngine | null>(null);
  const mseSkippedRef = useRef(false);
  const ffmpegEngineRef = useRef<FfmpegRemuxEngine | null>(null);
  const ffmpegSkippedRef = useRef(false);

  const [error, setError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [mseActive, setMseActive] = useState(false);
  const [mseStats, setMseStats] = useState<MseDebugStats | null>(null);
  const [ffmpegActive, setFfmpegActive] = useState(false);
  const ffmpegActiveRef = useRef(false);
  ffmpegActiveRef.current = ffmpegActive;
  const [ffmpegStats, setFfmpegStats] = useState<FfmpegDebugStats | null>(null);
  const [audioStreams, setAudioStreams] = useState<StreamTrack[]>([]);
  const [subtitleStreams, setSubtitleStreams] = useState<StreamTrack[]>([]);
  const [currentAudio, setCurrentAudio] = useState<string | null>(null);
  const [currentSubtitle, setCurrentSubtitle] = useState<string | null>(null);
  const [currentLevel, setCurrentLevel] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState<null | "audio" | "subtitle" | "speed" | "quality" | "transcode">(null);
  const [directMode, setDirectMode] = useState(false);
  const qualityMaxWidthRef = useRef<number | null>(null);

  const [playing, setPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [bufferedPct, setBufferedPct] = useState(0);
  const [showVolume, setShowVolume] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [seekPreview, setSeekPreview] = useState<number | null>(null);
  const [pipSupported, setPipSupported] = useState(false);
  const [showResume, setShowResume] = useState(false);
  const [savedPos, setSavedPos] = useState(0);
  const [cacheProgress, setCacheProgress] = useState<{ current: number; target: number } | null>(null);
  // Hard cap: no caller can reintroduce a multi-minute loading wall by
  // passing a huge prebuffer (the old streamCacheTtl wiring did exactly that
  // — see PREBUFFER_SECONDS).
  const prebufferRef = useRef(Math.min(prebufferSeconds ?? 0, PREBUFFER_SECONDS));
  prebufferRef.current = Math.min(prebufferSeconds ?? 0, PREBUFFER_SECONDS);

  useEffect(() => {
    setPipSupported(
      typeof document !== "undefined" &&
      "pictureInPictureEnabled" in document &&
      document.pictureInPictureEnabled
    );
  }, []);

  const reloadHls = (audioId: string | null, subtitleId: string | null) => {
    const mode = transcodeModeRef.current;
    const tv = mode === "auto" ? (transcodeVideoRef.current ? "1" : "0") : mode === "video" || mode === "full" ? "1" : "0";
    let ta: string;
    if (mode === "auto") {
      // Re-evaluate the target track's codec — E-AC3/DTS/TrueHD tracks must
      // transcode audio (hls.js can't transmux them from TS), never copy
      const track = audioStreams.find((s) => s.id === audioId);
      const trackCodec = track?.codec ?? infoRef.current?.audioCodec;
      const forceAudioTranscode = trackCodec
        ? (codecCapsRef.current ? shouldForceAudioTranscode(trackCodec, codecCapsRef.current) : !isAudioMseTransmuxable(trackCodec))
        : false;
      if (forceAudioTranscode) {
        ta = "1";
      } else {
        ta = transcodeAudioRef.current ? "1" : "0";
      }
    } else {
      ta = mode === "audio" || mode === "full" ? "1" : "0";
    }
    // Keep refs in sync — the badge and handleReturnToHls read them
    setCurrentAudio(audioId);
    setCurrentSubtitle(subtitleId);
    audioStreamIdRef.current = audioId;
    if (mode === "auto") transcodeAudioRef.current = ta === "1";
    // DASH gate: same rule as the leg dispatcher — any transcode session or
    // HEVC/AV1 source plays via DASH (the only path where MDE honors the
    // video copy). Fresh engine + fresh Plex session (in-place dash.js reload
    // across leg-param changes is brittle). The dispatcher inside startHls
    // handles the dash.js availability check and the HLS fallback.
    const srcVideo = (infoRef.current?.videoCodec ?? "").toLowerCase();
    const needDash = tv === "1" || ta === "1" || /hevc|h265|hev1|hvc1|av1|av01|vp9/.test(srcVideo);
    if (needDash) {
      fallbackGuardRef.current = false;
      startHlsRef.current?.();
      return;
    }
    const hls = hlsRef.current;
    if (!hls) return;
    let url = `/api/stream/${ratingKey}/transcode`;
    const params = new URLSearchParams();
    params.set("tv", tv);
    params.set("ta", ta);
    if (qualityMaxWidthRef.current) params.set("maxWidth", String(qualityMaxWidthRef.current));
    if (audioId) params.set("audioStreamID", audioId);
    if (subtitleId) params.set("subtitleStreamID", subtitleId);
    const qs = params.toString();
    if (qs) url += `?${qs}`;
    hls.loadSource(url);
  };

  useEffect(() => {
    if (!videoRef.current) return;

    const hlsUrl = `/api/stream/${ratingKey}/transcode`;
    const directUrl = `/api/stream/${ratingKey}`;

    // --- Prébuffer partagé (legs HLS + DASH) ---
    const armPrebuffer = () => {
      prebufferClearRef.current?.();
      const elv = videoRef.current;
      if (!elv) return;
      const prebufSecs = prebufferRef.current;
      if (prebufSecs <= 0 || !elv.duration || elv.duration <= prebufSecs) {
        setBuffering(false);
        void elv.play().catch(() => void 0);
        return;
      }
      setBuffering(true);
      setCacheProgress({ current: 0, target: prebufSecs });
      const iv = setInterval(() => {
        if (elv.buffered.length > 0) {
          const bufferedSecs = elv.buffered.end(0) - elv.currentTime;
          const clamped = Math.min(bufferedSecs, prebufSecs);
          setCacheProgress({ current: clamped, target: prebufSecs });
          if (bufferedSecs >= prebufSecs || bufferedSecs >= elv.duration - elv.currentTime) {
            clearInterval(iv);
            setCacheProgress(null);
            setBuffering(false);
            void elv.play().catch(() => void 0);
          }
        }
      }, 300);
      prebufferClearRef.current = () => clearInterval(iv);
    };

    // Shared by every copy leg (HLS, DASH, direct, MSE, ffmpeg remux): only
    // forces a real ta=1 transcode — never touched by a transient network
    // hiccup, only by a genuine live-silence verdict or by a second,
    // independent copy attempt also failing at the network level (see the
    // NETWORK_ERROR branch in the HLS leg). from="mse"/"ffmpeg" additionally
    // tears that engine down first — both are "copy to browser" attempts
    // like the others, and a silence verdict there means the codec can't be
    // rendered at all, so the whole copy family is done and a real
    // transcode is the only way left.
    const escalateSilentToTranscode = (from: "mse" | "ffmpeg" | false) => {
      if (hlsCopyEscalatedRef.current) return;
      hlsCopyEscalatedRef.current = true;
      transcodeAudioRef.current = true;
      if (from === "mse") {
        try { mseEngineRef.current?.destroy(); } catch { /* ignore */ }
        mseEngineRef.current = null;
        mseSkippedRef.current = true;
        setMseActive(false);
        setMseStats(null);
      }
      if (from === "ffmpeg") {
        try { void ffmpegEngineRef.current?.destroy(); } catch { /* ignore */ }
        ffmpegEngineRef.current = null;
        ffmpegSkippedRef.current = true;
        setFfmpegActive(false);
        setFfmpegStats(null);
      }
      fallbackGuardRef.current = false;
      startHlsRef.current?.();
    };

    // --- Leg DASH (dash.js) ---
    // Plex Web lit exclusivement en DASH, et c'est le SEUL protocole où MDE
    // honore videoCodec=copy pour les sources HEVC dans une session transcode
    // (prouvé en live : HLS ré-encode chaque fichier HEVC en libx264 — John
    // Carter, Tomb Raider — alors que Plex Web copie le bitstream HEVC en
    // DASH, 6× temps réel). Toute leg qui transcode la vidéo ou l'audio, ou
    // dont la vidéo source est HEVC/AV1, passe par DASH.
    // dash.js est chargé dynamiquement : pas SSR-safe (window au niveau
    // module), ce qui poussait son évaluation dans le graphe des pages
    // statiques pendant le prerender (ReferenceError: window is not defined).
    let dashPromise: Promise<typeof import("dashjs")> | null = null;
    const ensureDashjs = () => (dashPromise ??= import("dashjs"));
    const startDash = (djs: typeof import("dashjs"), tv: string, ta: string, extraParams?: string, isCopyNetworkRetry?: boolean) => {
      const elv = videoRef.current;
      if (!elv) return;
      prebufferClearRef.current?.();
      if (hlsRef.current) {
        try { hlsRef.current.destroy(); } catch { /* ignore */ }
        hlsRef.current = null;
      }
      if (dashRef.current) {
        try { dashRef.current.reset(); } catch { /* ignore */ }
        dashRef.current = null;
      }

      let url = `${hlsUrl}?tv=${tv}&ta=${ta}&fmt=dash`;
      if (audioStreamIdRef.current) url += `&audioStreamID=${audioStreamIdRef.current}`;
      if (qualityMaxWidthRef.current) url += `&maxWidth=${qualityMaxWidthRef.current}`;
      if (extraParams) url += `&${extraParams}`;

      const mode = transcodeModeRef.current;
      // Les legs DASH en copie audio (AC3/AAC/EAC3 en fMP4) reçoivent la même
      // veille de silence que les legs HLS : un codec que le navigateur ne
      // peut pas décoder joue en silence et doit escalader en vrai transcode.
      const attemptingDashAudioCopy = mode === "auto" && ta === "0" && !hlsCopyEscalatedRef.current;
      if (attemptingDashAudioCopy && !isCopyNetworkRetry) {
        stopSilentWatchRef.current?.();
        stopSilentWatchRef.current = watchForSilentAudio(elv, () => escalateSilentToTranscode(false));
      }

      const player = djs.MediaPlayer().create();
      dashRef.current = player;
      player.updateSettings({
        streaming: {
          buffer: { fastSwitchEnabled: true, bufferToKeep: 30 },
          // Le cold-start Plex peut 404/503 les premiers segments — retries
          // internes généreux, miroir du backoff de la leg HLS.
          retryAttempts: {
            MPD: 6,
            MediaSegment: 8,
            InitializationSegment: 8,
            FragmentInfoSegment: 8,
            other: 8,
          },
          retryIntervals: { MPD: 1200, MediaSegment: 800, InitializationSegment: 800, other: 800 },
        },
      });
      player.initialize(elv, url, false);

      player.on(djs.MediaPlayer.events.MANIFEST_LOADED, () => {
        armPrebuffer();
      });
      player.on(djs.MediaPlayer.events.QUALITY_CHANGE_RENDERED, () => {
        // dash.js v5 n'expose plus la liste des bitrates — la hauteur
        // réellement décodée (videoHeight intrinsèque) est plus vraie de toute
        // façon : c'est ce que le badge qualité doit afficher.
        if (elv.videoHeight) dashHeightRef.current = elv.videoHeight;
      });
      player.on(djs.MediaPlayer.events.PLAYBACK_STARTED, () => {
        if (elv.videoHeight) dashHeightRef.current = elv.videoHeight;
      });
      player.on(djs.MediaPlayer.events.ERROR, (e: { error?: { code?: number } }) => {
        const code = (e as { error?: { code?: number } })?.error?.code ?? 0;
        console.error("[VideoPlayer] DASH error", code, e);
        // Les échecs réseau sont ré-essayés en interne (retryAttempts
        // ci-dessus) ; si ERROR se déclenche quand même, une leg copie a
        // droit à une escalade, tout le reste est une erreur fatale.
        if (attemptingDashAudioCopy && !hlsCopyEscalatedRef.current) {
          escalateSilentToTranscode(false);
          return;
        }
        if (code !== 0) {
          setError(tRef.current("player.betaError"));
          try { player.reset(); } catch { /* ignore */ }
          if (dashRef.current === player) dashRef.current = null;
        }
      });
    };

    const startHls = (extraParams?: string, isCopyNetworkRetry?: boolean) => {
      startHlsRef.current = startHls;
      const el = videoRef.current;
      if (!el) {
        // Element not mounted yet — schedule retry
        requestAnimationFrame(() => startHls(extraParams, isCopyNetworkRetry));
        return;
      }
      if (fallbackGuardRef.current) return;
      fallbackGuardRef.current = true;
      setUsingFallback(true);
      setDirectMode(false);

      const mode = transcodeModeRef.current;
      const tv = mode === "auto" ? (transcodeVideoRef.current ? "1" : "0") : mode === "video" || mode === "full" ? "1" : "0";
      const ta = mode === "auto" ? (transcodeAudioRef.current ? "1" : "0") : mode === "audio" || mode === "full" ? "1" : "0";
      const srcVideo = (infoRef.current?.videoCodec ?? "").toLowerCase();
      // DASH gate : les sessions transcode (tv=1/ta=1) et les sources
      // HEVC/AV1 jouent en DASH — HLS ne honore jamais le copy HEVC sur ce
      // serveur (prouvé via /decision + Job running : toute source HEVC est
      // ré-encodé en libx264 en HLS, Plex Web copie le bitstream en DASH).
      // dash.js se charge en diffé ré ; s'il est indisponible (vieux Safari
      // sans MSE), on retombe sur la leg HLS (hls.js utilise alors le HLS
      // natif du navigateur).
      const wantDash = tv === "1" || ta === "1" || /hevc|h265|hev1|hvc1|av1|av01|vp9/.test(srcVideo);
      if (wantDash && typeof window !== "undefined") {
        void ensureDashjs().then((djs) => {
          if (djs.supportsMediaSource()) {
            startDash(djs, tv, ta, extraParams, isCopyNetworkRetry);
            return;
          }
          runHlsLeg(tv, ta, extraParams, isCopyNetworkRetry);
        });
        return;
      }
      runHlsLeg(tv, ta, extraParams, isCopyNetworkRetry);
    };

    const runHlsLeg = (tv: string, ta: string, extraParams?: string, isCopyNetworkRetry?: boolean) => {
      const mode = transcodeModeRef.current;
      let url = `${hlsUrl}?tv=${tv}&ta=${ta}`;
      if (audioStreamIdRef.current) url += `&audioStreamID=${audioStreamIdRef.current}`;
      if (qualityMaxWidthRef.current) url += `&maxWidth=${qualityMaxWidthRef.current}`;
      if (extraParams) url += `&${extraParams}`;
      // Tear down any previous instance before creating a new one
      if (hlsRef.current) {
        try { hlsRef.current.destroy(); } catch { /* ignore */ }
        hlsRef.current = null;
      }

      // ta=0 here means Plex is asked to remux (repackage the container,
      // e.g. MKV → MPEG-TS) without touching the audio bitstream — the same
      // "copy" Plex's own client gets, cheap for the NAS. Whether hls.js/the
      // browser actually renders it is unknown until real audio is playing,
      // so watch decoded energy exactly like the direct-play leg and
      // escalate to a real ta=1 transcode only on a genuine, live silence —
      // never a second guess baked into the request itself.
      const attemptingHlsAudioCopy = mode === "auto" && ta === "0" && !hlsCopyEscalatedRef.current;
      // A network-error retry (isCopyNetworkRetry) reuses the SAME live-audio
      // watch already running from the original attempt instead of installing
      // a second one on the same <video> element — Web Audio only allows one
      // MediaElementAudioSourceNode capture per element for its whole
      // lifetime (see silentAudioDetector.ts), so a second install here would
      // silently no-op anyway. Letting the original watch keep ticking means
      // the retry still gets genuinely live-verified, just on whatever time
      // remains of the original 6s window rather than a fresh one.
      if (attemptingHlsAudioCopy && !isCopyNetworkRetry) {
        stopSilentWatchRef.current?.();
        stopSilentWatchRef.current = watchForSilentAudio(el, () => escalateSilentToTranscode(false));
      }

      if (Hls.isSupported()) {
        let networkRetries = 0;
        const hls = new Hls({
          capLevelToPlayerSize: true,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 30,
          // Plex segments can take a moment on first request (transcode spin-up)
          fragLoadingTimeOut: 30000,
          manifestLoadingTimeOut: 20000,
          levelLoadingTimeOut: 20000,
          xhrSetup: (xhr) => {
            // Same-origin cookies for /api/stream auth
            xhr.withCredentials = true;
          },
        });
        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(el);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          networkRetries = 0;
          armPrebuffer();
        });
        hls.on(Hls.Events.DESTROYING, () => {
          prebufferClearRef.current?.();
          prebufferClearRef.current = null;
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) return;
          console.error("[VideoPlayer] HLS fatal", data.type, data.details, data.response);
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR: {
              networkRetries += 1;
              if (networkRetries > 5) {
                // hls.js's own in-place retry budget (startLoad() below) is
                // exhausted — but for a ta=0 copy attempt that's still just
                // "the network had a bad few seconds" (confirmed: transient
                // 503s on segment 0 happen even on Plex's own client's
                // sessions), not "this audio track doesn't work". Give the
                // exact same request ONE genuine do-over — a brand new Hls
                // instance and a brand new Plex transcode session — before
                // treating a repeat failure as real signal. Only a SECOND
                // independent failure, or a live-silence verdict from the
                // still-running watch, escalates to a real ta=1 transcode.
                if (attemptingHlsAudioCopy && !hlsCopyNetworkRetriedRef.current) {
                  hlsCopyNetworkRetriedRef.current = true;
                  hls.destroy();
                  hlsRef.current = null;
                  fallbackGuardRef.current = false;
                  startHls(extraParams, true);
                  break;
                }
                if (attemptingHlsAudioCopy && !hlsCopyEscalatedRef.current) {
                  escalateSilentToTranscode(false);
                  break;
                }
                setError(tRef.current("player.betaError"));
                hls.destroy();
                hlsRef.current = null;
                break;
              }
              // Brief backoff then retry — covers Plex cold-start 503s
              setTimeout(() => {
                try { hls.startLoad(); } catch { /* destroyed */ }
              }, 400 * networkRetries);
              break;
            }
            case Hls.ErrorTypes.MEDIA_ERROR:
              try { hls.recoverMediaError(); } catch {
                setError(tRef.current("player.betaError"));
                hls.destroy();
                hlsRef.current = null;
              }
              break;
            default:
              setError(tRef.current("player.betaError"));
              hls.destroy();
              hlsRef.current = null;
              break;
          }
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => setCurrentLevel(data.level));
      } else if (el.canPlayType("application/vnd.apple.mpegurl")) {
        el.src = url;
        void el.play().catch(() => void 0);
      } else {
        setError(tRef.current("player.betaError"));
      }
    };

    const startDirect = (seekTo?: number, expectAudio?: boolean) => {
      if (seekTo && seekTo > 0) {
        el.addEventListener(
          "loadedmetadata",
          () => {
            if (el.duration && seekTo < el.duration) el.currentTime = seekTo;
          },
          { once: true }
        );
      }
      // Setting `src` to a value it already holds — the exact case when the
      // "Test direct" button retries while direct play is already the
      // active engine — is a no-op per the HTML spec: no reload, no
      // request, nothing. `load()` forces a genuine re-fetch regardless of
      // whether the URL string actually changed.
      el.src = directUrl;
      el.load();
      void el.play().catch(() => void 0);

      // Recovery chain is strictly direct → MSE → HLS: a failed direct play
      // (real `error` event) still gets a shot at the bitstream-copy MSE
      // engine (proven, no server transcode) before falling all the way back
      // to a real Plex transcode. tryStartMse() itself no-ops for anything it
      // can't handle (wrong container, active subtitles, seek-resume...) and
      // returns false, which cascades straight to HLS — same contract as the
      // strategy==="transcode" branch in begin() already uses.
      let directRecoveryStarted = false;
      const recoverFromDirect = async () => {
        if (directRecoveryStarted || fallbackGuardRef.current || hlsRef.current || mseEngineRef.current || ffmpegEngineRef.current) return;
        directRecoveryStarted = true;
        if (!(await tryStartMse(infoRef.current, seekTo)) && !(await tryStartFfmpegRemux(infoRef.current, seekTo))) startHls();
      };

      // Direct play can now be (re)started more than once per mount — the
      // manual retry button reuses this same function — so a stale listener
      // from a previous attempt must be removed first, or it stacks up and
      // double-fires recovery.
      const prevErr = (el as unknown as { __vpOnError?: () => void }).__vpOnError;
      if (prevErr) el.removeEventListener("error", prevErr);
      const onError = () => { void recoverFromDirect(); };
      el.addEventListener("error", onError);
      (el as unknown as { __vpOnError?: () => void }).__vpOnError = onError;

      // Safety net: the codec checks that greenlit direct play are all
      // static pre-playback probes (see webcodecs.ts) — none of them are
      // re-verified once actually playing, and an unroutable/unsupported
      // audio track does not fire the `error` event above, it just plays
      // silently. Watch real decoded audio energy for a few seconds. A
      // genuine silence verdict means the browser can't render the track —
      // a silence SKIPS the MSE copy leg (same codec, same <video> element
      // would hit the same wall, and its own source node is already taken)
      // and escalates straight to a real ta=1 transcode.
      if (expectAudio) {
        stopSilentWatchRef.current?.();
        stopSilentWatchRef.current = watchForSilentAudio(el, () => escalateSilentToTranscode(false));
      }
    };
    startDirectRef.current = startDirect;

    const begin = async (seekTo?: number) => {
      setBuffering(true);
      hlsCopyEscalatedRef.current = false;
      hlsCopyNetworkRetriedRef.current = false;
      // Reset the engine badge — begin() can re-run (resume-with-seek) and
      // the previous run's engine may differ from this one.
      setDirectMode(false);

      // useTranscode = beta player mode: try direct/WebCodecs first,
      // fall back to HLS transcode if the browser can't handle the codec.
      let info: StreamInfo = { videoCodec: null, audioCodec: null, container: null };
      // Calculée ici pour être réutilisée par la détection de stratégie
      // ci-dessous (même piste, jamais recalculée différemment).
      let localePreferredAudio: StreamTrack | undefined;
      try {
        const res = await fetch(`/api/stream/${ratingKey}/info`, { cache: "no-store" });
        if (res.ok) {
          info = (await res.json()) as StreamInfo;
          info.container = (info as any).container ?? null;
          infoRef.current = info;
          const audioTracks = Array.isArray(info.audioStreams) ? info.audioStreams : [];
          const subTracks = Array.isArray(info.subtitleStreams) ? info.subtitleStreams : [];
          setAudioStreams(audioTracks);
          setSubtitleStreams(subTracks);

          // Piste audio par défaut : la langue de l'UI Movviz d'abord (même
          // règle que le badge, voir findAudioStreamForLocale) — repli sur la
          // piste marquée "selected" par Plex si aucune ne correspond.
          const localeAudio = findTrackForLocale(audioTracks, localeRef.current);
          localePreferredAudio = localeAudio ?? audioTracks.find((s) => s.selected) ?? audioTracks[0];
          if (localePreferredAudio) setCurrentAudio(localePreferredAudio.id);

          // Sous-titres : jamais forcés quand l'audio choisi correspond déjà
          // à la langue de l'UI — seulement quand aucune piste audio dans
          // cette langue n'existe, pour retrouver le réflexe "audio étranger
          // → sous-titres dans ma langue" des autres lecteurs.
          const localeSub = localeAudio ? null : findTrackForLocale(subTracks, localeRef.current);
          const selSub = localeSub ?? subTracks.find((s) => s.selected);
          if (selSub) setCurrentSubtitle(selSub.id);
        }
      } catch { /* ignore */ }

      let strategy: "direct" | "transcode";
      let effectiveAudioCodec: string | null | undefined;
      try {
        // Detect browser codec capabilities once
        const caps = await detectCodecs();
        codecCapsRef.current = caps;

        // --- Bypass codecs audio: auto-switch to a compatible track ---
        // DTS/TrueHD/PCM can't be decoded by ANY browser. Most Blu-ray remuxes
        // carry a second track (AC3/EAC3/AAC...) — pick it so audio is copied
        // (ta=0) instead of transcoded, with zero audible quality loss.
        // CRITICAL: direct play plays the file's DEFAULT track — it cannot
        // select a track. So a switch forces the HLS path, which can via
        // audioStreamID. Otherwise the browser plays the DTS track and the
        // video is silently muted.
        const audioTracks = Array.isArray(info.audioStreams) ? info.audioStreams : [];
        // Réutilise le choix déjà fait plus haut (langue UI d'abord) — ne
        // jamais recalculer une seconde règle qui pourrait diverger.
        const selAudio = localePreferredAudio ?? audioTracks.find((s) => s.selected) ?? audioTracks[0];
        defaultAudioIdRef.current = selAudio?.id ?? null;
        effectiveAudioCodec = selAudio?.codec ?? info.audioCodec;
        audioStreamIdRef.current = selAudio?.id ?? null;
        let audioSwitched = false;
        if (effectiveAudioCodec && !isAudioCodecSupported(effectiveAudioCodec, caps)) {
          const prefLang = selAudio?.language ?? "";
          const fallback = audioTracks
            .filter(
              (t) =>
                t.id !== selAudio?.id &&
                !!t.codec &&
                // Le même codec que la piste déjà rejetée ne peut rien
                // résoudre — confirmé en direct (Jurassic Park 499959,
                // deux pistes AC-3 FR/EN) : sans ce garde, le bypass
                // "réussissait" en basculant vers l'AUTRE piste AC-3
                // (anglaise) simplement parce qu'elle n'était pas exclue,
                // écrasant silencieusement la piste française déjà
                // correctement choisie (locale ET défaut Plex) sans
                // apporter la moindre compatibilité supplémentaire.
                t.codec.toLowerCase() !== (selAudio?.codec ?? "").toLowerCase() &&
                isAudioMseTransmuxable(t.codec)
            )
            .sort((a, b) => scoreAudioTrack(b, prefLang) - scoreAudioTrack(a, prefLang))[0];
          if (fallback?.codec) {
            setCurrentAudio(fallback.id);
            audioStreamIdRef.current = fallback.id;
            effectiveAudioCodec = fallback.codec;
            audioSwitched = true;
            console.log(`[player] audio bypass: ${selAudio?.codec ?? info.audioCodec} → ${fallback.codec} (piste ${fallback.id})`);
          }
        }

        // Always compute individual codec flags (feeds the fallback leg's
        // transcode-mode badges/menu regardless of how it was reached).
        transcodeVideoRef.current = info.videoCodec ? !isVideoCodecSupported(info.videoCodec, caps) : false;
        // HLS gate: ta=0 (copy) for any codec hls.js's TS demuxer structurally
        // supports (AAC/MP3/AC-3) — a fixed library fact, not a browser probe.
        // E-AC3/DTS/TrueHD/FLAC/Opus in HLS → transcode to AAC, never copy.
        // Whether the browser actually renders the copied track is verified
        // live by startHls's silent-audio watch below, same as direct play.
        transcodeAudioRef.current = effectiveAudioCodec ? shouldForceAudioTranscode(effectiveAudioCodec, caps) : false;

        // Direct play is now the unconditional first attempt — the manual
        // "lightning bolt" button and this automatic path are the same
        // function (startDirect), sharing the same error/silent-audio
        // recovery net. No more static canPlayType/MediaSource probing to
        // pre-decide "direct" vs "webcodecs" vs "transcode": confirmed live
        // that those probes lie for common cases (AC-3/E-AC-3 canPlayType on
        // Chrome/Edge, DTS/TrueHD on native <video> for non-MP4 containers)
        // and routed away from direct play that would have actually worked
        // fine. Only two structural gates remain, because both are facts,
        // not probabilistic probes:
        //  - audioSwitched: direct play cannot select a non-default audio
        //    track, so if the bypass logic above had to switch tracks,
        //    direct is impossible, not just risky.
        //  - video codec truly undecodable: skip a doomed direct attempt.
        // Everything else — silent/broken default audio, a codec probe that
        // would have said "should be fine" but isn't — is caught live by
        // startDirect's error listener + watchForSilentAudio, exactly as it
        // already was for the subset of files that used to reach "direct".
        strategy = audioSwitched || (info.videoCodec && !isVideoCodecSupported(info.videoCodec, caps))
          ? "transcode"
          : "direct";
      } catch {
        strategy = "transcode";
        transcodeVideoRef.current = true;
        transcodeAudioRef.current = true;
      }

      if (strategy === "transcode") {
        if (!(await tryStartMse(info, seekTo)) && !(await tryStartFfmpegRemux(info, seekTo))) startHls();
        return;
      }

      setDirectMode(true);
      startDirect(seekTo, !!effectiveAudioCodec);
    };

    beginRef.current = begin;

    const destroyMse = () => {
      if (mseEngineRef.current) {
        try { mseEngineRef.current.destroy(); } catch { /* ignore */ }
        mseEngineRef.current = null;
      }
      setMseActive(false);
      setMseStats(null);
    };

    const fallbackFromMse = () => {
      destroyMse();
      mseSkippedRef.current = true;
      setBuffering(true);
      fallbackGuardRef.current = false;
      startHlsRef.current?.();
    };

    // MSE leg: replaces the HLS-transcode leg for MP4 files whose codecs are
    // provably MSE-copyable. Deterministic — every failure falls back to HLS.
    const tryStartMse = async (info: StreamInfo, seekTo?: number): Promise<boolean> => {
      const video = videoRef.current;
      if (!video) return false;
      const b = betaRef.current;
      if (!b.enabled || mseSkippedRef.current || b.playbackEngine === "native") return false;
      if (seekTo && seekTo > 0) return false; // resume path stays on proven engines
      const media: MediaInfo = {
        ratingKey,
        container: info.container,
        videoCodec: info.videoCodec,
        audioCodec: info.audioCodec,
      };
      try {
        const caps = await detectCapabilities();
        const decision = await orchestrate({
          media,
          capabilities: caps,
          engine: b.playbackEngine,
          subtitleActive: !!currentSubtitle,
          directPossible: false,
          webcodecsPossible: false,
        });
        if (decision.engine !== "mse" || !decision.mse) return false;

        const engine = new MSEPlaybackEngine({
          onBuffering: (buffering) => setBuffering(buffering),
          onError: (_msg, fatal) => {
            if (!fatal) return;
            if (!mseEngineRef.current) return;
            fallbackFromMse();
          },
          onDebug: (stats) => setMseStats(stats),
        });
        mseEngineRef.current = engine;
        setMseActive(true);
        setDirectMode(false);
        setBuffering(true);
        engine.attach(video);
        try {
          await engine.load(ratingKey, {
            videoMime: decision.mse.videoMime,
            audioMime: decision.mse.audioMime,
            debug: b.debug,
          });
        } catch {
          fallbackFromMse();
          return false;
        }
        // The MSE leg is a bitstream-copy leg like direct/HLS/DASH: a codec
        // the browser can't actually render plays silently with no `error`
        // event. Arm the same live-energy watch — on a genuine silence
        // verdict the whole copy family is done, so it escalates to a real
        // ta=1 transcode (destroying this engine first). No-op if the
        // element's AudioContext source node is already taken by an earlier
        // direct-leg watch (that verdict already covered this case).
        stopSilentWatchRef.current?.();
        stopSilentWatchRef.current = watchForSilentAudio(video, () => escalateSilentToTranscode("mse"));
        return true;
      } catch {
        return false;
      }
    };

    const destroyFfmpeg = () => {
      if (ffmpegEngineRef.current) {
        const engine = ffmpegEngineRef.current;
        ffmpegEngineRef.current = null;
        void engine.destroy().catch(() => void 0);
      }
      setFfmpegActive(false);
      setFfmpegStats(null);
    };

    const fallbackFromFfmpeg = () => {
      destroyFfmpeg();
      ffmpegSkippedRef.current = true;
      setBuffering(true);
      fallbackGuardRef.current = false;
      startHlsRef.current?.();
    };

    // FFmpeg remux leg: takes over exactly where the JS-only MSE parser
    // gives up (non-MP4-progressive containers — MKV in particular, the
    // vast majority of this library). Movviz pulls the raw file straight
    // from Plex and remuxes it itself (-c:v copy, -c:a copy|aac), bypassing
    // Plex's own transcoder entirely — see the plan's "Contexte" section for
    // why: Plex MDE's refusal to bitstream-copy HEVC for some files is a
    // confirmed, unfixable-from-outside black box. Deterministic — every
    // failure falls back to HLS, same contract as tryStartMse.
    const tryStartFfmpegRemux = async (info: StreamInfo, seekTo?: number): Promise<boolean> => {
      const video = videoRef.current;
      if (!video) return false;
      const b = betaRef.current;
      if (!b.enabled || ffmpegSkippedRef.current || b.playbackEngine === "native") return false;
      if (seekTo && seekTo > 0) return false; // resume path stays on proven engines
      const media: MediaInfo = {
        ratingKey,
        container: info.container,
        videoCodec: info.videoCodec,
        audioCodec: info.audioCodec,
      };
      try {
        const caps = await detectCapabilities();
        const decision = await orchestrate({
          media,
          capabilities: caps,
          engine: b.playbackEngine,
          subtitleActive: !!currentSubtitle,
          directPossible: false,
          webcodecsPossible: false,
          ffmpegAvailable: info.ffmpegAvailable === true,
        });
        if (decision.engine !== "ffmpeg") return false;

        const engine = new FfmpegRemuxEngine({
          onBuffering: (buffering) => setBuffering(buffering),
          onError: (_msg, fatal) => {
            if (!fatal) return;
            if (!ffmpegEngineRef.current) return;
            fallbackFromFfmpeg();
          },
          onDebug: (stats) => setFfmpegStats(stats),
        });
        ffmpegEngineRef.current = engine;
        setFfmpegActive(true);
        setDirectMode(false);
        setBuffering(true);
        engine.attach(video);
        try {
          await engine.load(ratingKey, {
            audioStreamId: audioStreamIdRef.current ? Number(audioStreamIdRef.current) : null,
            seekTo,
            debug: b.debug,
          });
        } catch {
          fallbackFromFfmpeg();
          return false;
        }
        // Contrairement à MSE (où le navigateur doit lui-même décoder un
        // codec dont le support n'est que probé, jamais garanti), l'audio
        // ffmpeg est soit une copie bit-exacte d'une piste déjà whitelistée
        // décodable (`COPY_SAFE_AUDIO`), soit transcodé en AAC — aucune
        // incertitude à couvrir. Confirmé en direct (Ace Ventura 500751) :
        // la veille de silence se déclenchait ~6s (sa fenêtre par défaut)
        // après le démarrage d'un flux ffmpeg qui jouait normalement,
        // détruisant le moteur et coupant la connexion — ce qui déclenchait
        // à son tour le crash serveur du double-destroy corrigé plus haut.
        return true;
      } catch {
        return false;
      }
    };

    const saved = Number(localStorage.getItem(PROGRESS_KEY(ratingKey)));
    if (saved > 5 && Number.isFinite(saved)) {
      setSavedPos(saved);
      setShowResume(true);
    } else {
      void begin();
    }

    const el = videoRef.current;
    if (!el) return;

    const onWaiting = () => setBuffering(true);
    const onPlaying = () => setBuffering(false);
    const onCanPlay = () => setBuffering(false);
    el.addEventListener("waiting", onWaiting);
    el.addEventListener("playing", onPlaying);
    el.addEventListener("canplay", onCanPlay);

    const saveProgress = () => {
      const ve = videoRef.current;
      if (!ve || !ve.duration || Number.isNaN(ve.duration)) return;
      const offset = Math.floor(ve.currentTime * 1000);
      localStorage.setItem(PROGRESS_KEY(ratingKey), String(ve.currentTime));
      void fetch(`/api/stream/${ratingKey}/progress`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ offset }),
        keepalive: true,
      }).catch(() => void 0);
    };
    progressTimerRef.current = setInterval(saveProgress, 10000);

    return () => {
      try {
        const offset = Math.floor(el.currentTime * 1000);
        void fetch(`/api/stream/${ratingKey}/progress`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ offset, state: "stopped" }),
          keepalive: true,
        }).catch(() => void 0);
        void fetch(`/api/stream/${ratingKey}/stop`, {
          method: "POST",
          keepalive: true,
        }).catch(() => void 0);
      } catch { /* ignore */ }
      if (mseEngineRef.current) {
        try { mseEngineRef.current.destroy(); } catch { /* ignore */ }
        mseEngineRef.current = null;
      }
      if (ffmpegEngineRef.current) {
        const engine = ffmpegEngineRef.current;
        ffmpegEngineRef.current = null;
        void engine.destroy().catch(() => void 0);
      }
      stopSilentWatchRef.current?.();
      stopSilentWatchRef.current = null;

      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }

      el.removeEventListener("waiting", onWaiting);
      el.removeEventListener("playing", onPlaying);
      el.removeEventListener("canplay", onCanPlay);
      const storedErr = (el as unknown as { __vpOnError?: () => void }).__vpOnError;
      if (storedErr) el.removeEventListener("error", storedErr);

    if (hlsRef.current) {
        try { hlsRef.current.destroy(); } catch { /* ignore */ }
        hlsRef.current = null;
      }
      if (dashRef.current) {
        try { dashRef.current.reset(); } catch { /* ignore */ }
        dashRef.current = null;
      }
      prebufferClearRef.current?.();
      prebufferClearRef.current = null;
    };
  }, [ratingKey, useTranscode]);

  // Point d'entrée unique pour tout seek programmatique (barre de
  // progression, boutons ±10s, raccourcis clavier) — la leg ffmpeg n'a pas
  // de plage seekable côté navigateur (fMP4 fragmenté sans index) et doit
  // toujours passer par le moteur plutôt que par `.currentTime` direct.
  const seekTo = useCallback((time: number) => {
    const el = videoRef.current;
    if (!el) return;
    if (ffmpegActiveRef.current && ffmpegEngineRef.current) {
      void ffmpegEngineRef.current.seek(time);
      setCurrentTime(time);
    } else {
      el.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const skip = useCallback((seconds: number) => {
    const el = videoRef.current;
    if (!el) return;
    const target = Math.max(0, Math.min(duration || el.duration || 0, el.currentTime + seconds));
    seekTo(target);
  }, [duration, seekTo]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const onTimeUpdate = () => {
      if (!seekingRef.current) setCurrentTime(el.currentTime);
    };
    const onLoadedData = () => {
      // Leg ffmpeg : `<video>` natif lit un MP4 fragmenté à `empty_moov`
      // (durée totale inconnue par construction, pas un vrai live) — sa
      // `.duration` reste figée sur la portion déjà reçue ("0:02" observé
      // en direct) plutôt que de refléter la durée réelle du film. La durée
      // Plex connue à l'avance est toujours la bonne source pour cette leg.
      const known = infoRef.current?.durationMs;
      setDuration(ffmpegActiveRef.current && known ? known / 1000 : el.duration);
      setVolume(el.volume);
      setMuted(el.muted);
    };
    const onProgress = () => {
      if (el.buffered.length > 0 && el.duration > 0) {
        const end = el.buffered.end(el.buffered.length - 1);
        setBufferedPct((end / el.duration) * 100);
      }
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onVolumeChange = () => {
      setVolume(el.volume);
      setMuted(el.muted);
    };
    const onRateChange = () => setPlaybackRate(el.playbackRate);

    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("loadeddata", onLoadedData);
    el.addEventListener("progress", onProgress);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("volumechange", onVolumeChange);
    el.addEventListener("ratechange", onRateChange);

    return () => {
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("loadeddata", onLoadedData);
      el.removeEventListener("progress", onProgress);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("volumechange", onVolumeChange);
      el.removeEventListener("ratechange", onRateChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    const el = videoRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      setFullscreen(false);
    } else {
      await el.requestFullscreen();
      setFullscreen(true);
    }
  };

  useEffect(() => {
    const onFsChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const qualityLabel = (): string | null => {
    let h = 0;
    if (dashRef.current) {
      h = dashHeightRef.current ?? 0;
    } else {
      const hls = hlsRef.current;
      if (hls && currentLevel !== null) {
        const level = hls.levels[currentLevel];
        if (level) h = level.height || 0;
      }
    }
    if (h >= 2000) return "4K";
    if (h >= 1440) return "1440p";
    if (h >= 1000) return "1080p";
    if (h >= 700) return "720p";
    if (h > 0) return `${h}p`;
    return null;
  };

  const resetHideTimer = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (!seekingRef.current && playing && !buffering) {
        setControlsVisible(false);
      }
    }, 3000);
  }, [playing, buffering]);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  const togglePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  };

  const toggleMute = () => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = !el.muted;
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          skip(-10);
          resetHideTimer();
          break;
        case "ArrowRight":
          e.preventDefault();
          skip(10);
          resetHideTimer();
          break;
        case "ArrowUp": {
          e.preventDefault();
          const el = videoRef.current;
          if (el) {
            el.volume = Math.min(1, el.volume + 0.1);
            el.muted = false;
          }
          resetHideTimer();
          break;
        }
        case "ArrowDown": {
          e.preventDefault();
          const el = videoRef.current;
          if (el) el.volume = Math.max(0, el.volume - 0.1);
          resetHideTimer();
          break;
        }
        case "f":
        case "F":
          e.preventDefault();
          void toggleFullscreen();
          break;
        case "m":
        case "M":
          e.preventDefault();
          toggleMute();
          break;
        case "Escape":
          onClose();
          break;
        case "0": case "1": case "2": case "3": case "4":
        case "5": case "6": case "7": case "8": case "9":
          // Convention YouTube/Netflix : saute au X0% de la durée totale.
          if (duration > 0) {
            e.preventDefault();
            seekTo((Number(e.key) / 10) * duration);
            resetHideTimer();
          }
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, skip, seekTo, resetHideTimer, duration]);

  const togglePiP = async () => {
    const el = videoRef.current;
    if (!el) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await el.requestPictureInPicture();
      }
    } catch { /* PiP not supported or denied */ }
  };

  const getSeekRatio = (clientX: number): number => {
    const rect = progressRef.current?.getBoundingClientRect();
    if (!rect || !rect.width) return 0;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };

  const getSeekTime = (clientX: number): number => {
    if (!duration) return 0;
    return getSeekRatio(clientX) * duration;
  };

  // Vignette de survol — proxy des index BIF que Plex génère déjà pour son
  // propre lecteur (voir scrub-thumb/route.ts). Granularité 1s (largement
  // suffisant pour un aperçu), résultats mis en cache en mémoire (Blob URL)
  // pour ne jamais re-fetcher la même seconde en scrubant sur place, et
  // débattus (150ms) pour ne pas spammer le serveur à chaque pixel de
  // mouvement de souris.
  const scrubCacheRef = useRef<Map<number, string>>(new Map());
  const scrubAbortRef = useRef<AbortController | null>(null);
  const scrubDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scrubPreview, setScrubPreview] = useState<{ time: number; ratio: number; url: string | null } | null>(null);

  useEffect(() => () => {
    scrubCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
    scrubCacheRef.current.clear();
  }, []);

  const requestScrubThumb = useCallback((time: number, ratio: number) => {
    const key = Math.floor(time);
    const cached = scrubCacheRef.current.get(key);
    setScrubPreview({ time, ratio, url: cached ?? null });
    if (cached) return;
    if (scrubDebounceRef.current) clearTimeout(scrubDebounceRef.current);
    scrubDebounceRef.current = setTimeout(() => {
      scrubAbortRef.current?.abort();
      const ac = new AbortController();
      scrubAbortRef.current = ac;
      fetch(`/api/stream/${ratingKey}/scrub-thumb?t=${key * 1000}`, { signal: ac.signal })
        .then((res) => (res.ok ? res.blob() : null))
        .then((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          scrubCacheRef.current.set(key, url);
          setScrubPreview((cur) => (cur && Math.floor(cur.time) === key ? { ...cur, url } : cur));
        })
        .catch(() => void 0);
    }, 150);
  }, [ratingKey]);

  const handleProgressDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!duration) return;
    e.preventDefault();
    seekingRef.current = true;

    const cx = "touches" in e ? e.touches[0].clientX : e.clientX;
    setSeekPreview(getSeekTime(cx));
    requestScrubThumb(getSeekTime(cx), getSeekRatio(cx));

    const onMove = (me: MouseEvent | TouchEvent) => {
      const mc = "touches" in me ? me.touches[0].clientX : me.clientX;
      setSeekPreview(getSeekTime(mc));
      requestScrubThumb(getSeekTime(mc), getSeekRatio(mc));
    };
    const onUp = (me: MouseEvent | TouchEvent) => {
      seekingRef.current = false;
      const uc = "changedTouches" in me ? me.changedTouches[0].clientX : me.clientX;
      const time = getSeekTime(uc);
      seekTo(time);
      setSeekPreview(null);
      setScrubPreview(null);
      document.removeEventListener("mousemove", onMove as EventListener);
      document.removeEventListener("mouseup", onUp as EventListener);
      document.removeEventListener("touchmove", onMove as EventListener);
      document.removeEventListener("touchend", onUp as EventListener);
    };

    document.addEventListener("mousemove", onMove as EventListener);
    document.addEventListener("mouseup", onUp as EventListener);
    document.addEventListener("touchmove", onMove as EventListener);
    document.addEventListener("touchend", onUp as EventListener);
  };

  // Survol seul (sans clic) — même aperçu que pendant un drag, pour pouvoir
  // repérer un moment avant de s'engager sur un clic.
  const handleProgressHover = (e: React.MouseEvent) => {
    if (!duration || seekingRef.current) return;
    requestScrubThumb(getSeekTime(e.clientX), getSeekRatio(e.clientX));
  };
  const handleProgressLeave = () => {
    if (!seekingRef.current) setScrubPreview(null);
  };

  const getVolumeFromEvent = (clientX: number): number => {
    const rect = volumeTrackRef.current?.getBoundingClientRect();
    if (!rect || !rect.width) return 1;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };

  const handleVolumeDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const apply = (clientX: number) => {
      const v = getVolumeFromEvent(clientX);
      if (videoRef.current) {
        videoRef.current.volume = v;
        videoRef.current.muted = false;
      }
    };
    apply(e.clientX);

    const onMove = (me: MouseEvent) => apply(me.clientX);
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const setSpeed = (speed: number) => {
    const el = videoRef.current;
    if (el) el.playbackRate = speed;
    setPlaybackRate(speed);
    setMenuOpen(null);
  };

  const toggleMenu = (menu: "audio" | "subtitle" | "speed" | "quality" | "transcode") => {
    setMenuOpen((prev) => (prev === menu ? null : menu));
  };

  const handleResume = () => {
    setShowResume(false);
    void beginRef.current?.(savedPos);
  };

  const handleStartOver = () => {
    setShowResume(false);
    void beginRef.current?.(0);
  };

  const handleDirectPlay = () => {
    const el = videoRef.current;
    if (!el) return;
    if (mseEngineRef.current) {
      try { mseEngineRef.current.destroy(); } catch { /* ignore */ }
      mseEngineRef.current = null;
      mseSkippedRef.current = true;
      setMseActive(false);
      setMseStats(null);
    }
    if (ffmpegEngineRef.current) {
      const engine = ffmpegEngineRef.current;
      ffmpegEngineRef.current = null;
      ffmpegSkippedRef.current = true;
      setFfmpegActive(false);
      setFfmpegStats(null);
      void engine.destroy().catch(() => void 0);
    }
    // Direct play can't select an audio track — if a fallback track was chosen
    // (audio bypass) or the user picked a non-default track, the browser would
    // play the file's default (undecodable) track → silent video. Stay on HLS.
    if (
      audioStreamIdRef.current !== null &&
      audioStreamIdRef.current !== defaultAudioIdRef.current
    ) {
      startHlsRef.current?.();
      return;
    }
    if (hlsRef.current) {
      try { hlsRef.current.destroy(); } catch { /* ignore */ }
      hlsRef.current = null;
    }
    if (dashRef.current) {
      try { dashRef.current.reset(); } catch { /* ignore */ }
      dashRef.current = null;
    }
    fallbackGuardRef.current = false;
    setDirectMode(true);
    setUsingFallback(false);
    setBuffering(true);
    // Reuses the exact same function (and its error/silent-audio recovery
    // net) as the default first-attempt path — a manual retry is no longer
    // a weaker, unwired duplicate of it. Resumes from the current position
    // instead of restarting from 0.
    startDirectRef.current?.(el.currentTime > 0 ? el.currentTime : undefined, !!infoRef.current.audioCodec);
  };

  const handleReturnToHls = () => {
    setDirectMode(false);
    setUsingFallback(false);
    fallbackGuardRef.current = false;
    setBuffering(true);
    if (mseEngineRef.current) {
      try { mseEngineRef.current.destroy(); } catch { /* ignore */ }
      mseEngineRef.current = null;
      mseSkippedRef.current = true;
      setMseActive(false);
      setMseStats(null);
    }
    if (ffmpegEngineRef.current) {
      const engine = ffmpegEngineRef.current;
      ffmpegEngineRef.current = null;
      ffmpegSkippedRef.current = true;
      setFfmpegActive(false);
      setFfmpegStats(null);
      void engine.destroy().catch(() => void 0);
    }
    startHlsRef.current?.();
  };

  const QUALITY_PRESETS = [
    { label: t("player.betaQualityOriginal"), maxWidth: null },
    { label: "4K", maxWidth: 3840 },
    { label: "1440p", maxWidth: 2560 },
    { label: "1080p", maxWidth: 1920 },
    { label: "720p", maxWidth: 1280 },
  ] as const;

  const handleQualityChange = (mw: number | null) => {
    qualityMaxWidthRef.current = mw;
    setMenuOpen(null);
    if (mseEngineRef.current || ffmpegEngineRef.current) {
      // Downscaling needs a transcode — deterministic switch to the HLS leg
      // (both the MSE parser and the ffmpeg remux leg only ever produce the
      // source resolution — a bitstream copy).
      fallbackGuardRef.current = false;
      handleReturnToHls();
      return;
    }
    if (hlsRef.current) {
      reloadHls(currentAudio, currentSubtitle);
    } else if (startHlsRef.current) {
      startHlsRef.current();
    }
  };

  const playedPct = ((seekPreview ?? currentTime) / (duration || 1)) * 100;

  return (
    <div className={cn(!embedded && "fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm", embedded && "h-full w-full")}>
      <div className={cn("relative flex flex-col overflow-hidden shadow-2xl", embedded ? "h-full w-full rounded-none bg-transparent" : "bg-surface", !embedded && fullscreen ? "h-full w-full rounded-none" : !embedded ? "rounded-2xl h-[80vh] w-[90vw] max-w-5xl" : undefined)}>
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-3 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {usingFallback && (
              <span className={cn(
                "flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-[10px] font-semibold",
                transcodeVideoRef.current || transcodeAudioRef.current ? "bg-amber/15 text-amber" : "bg-green/15 text-green"
              )}>
                {transcodeVideoRef.current || transcodeAudioRef.current ? <AlertTriangle className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
                {transcodeVideoRef.current && transcodeAudioRef.current
                  ? t("player.betaTranscoded")
                  : transcodeVideoRef.current
                    ? t("player.betaTranscodedVideo")
                    : transcodeAudioRef.current
                      ? t("player.betaTranscodedAudio")
                      : t("player.betaDirectStream")}
              </span>
            )}
            {directMode && (
              <span className="flex h-6 shrink-0 items-center gap-1 rounded-full bg-green/15 px-2 text-[10px] font-semibold text-green">
                <Zap className="h-3 w-3" />
                {t("player.betaDirectActive")}
              </span>
            )}
            {mseActive && (
              <span className="flex h-6 shrink-0 items-center gap-1 rounded-full bg-cyan/15 px-2 text-[10px] font-semibold text-cyan">
                <Zap className="h-3 w-3" />
                {t("player.betaMseStream")}
              </span>
            )}
            {ffmpegActive && (
              <span className="flex h-6 shrink-0 items-center gap-1 rounded-full bg-purple/15 px-2 text-[10px] font-semibold text-purple">
                <Zap className="h-3 w-3" />
                {t("player.betaFfmpegLocal")}
              </span>
            )}
            <p className="truncate text-sm font-semibold text-ink">{title}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={plexUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => openPlexLink(e, plexUrl)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-dim hover:bg-white/10 hover:text-ink"
              title={t("library.watchOnPlex")}
            >
              <ExternalLink className="h-4 w-4" />
            </a>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-dim hover:bg-white/10 hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div
          className={cn("relative flex flex-1 items-center justify-center", embedded ? "bg-transparent" : "bg-black")}
          onMouseMove={resetHideTimer}
          onMouseEnter={resetHideTimer}
          onTouchStart={resetHideTimer}
        >
          {error ? (
            <div className="flex flex-col items-center gap-4 p-8 text-center">
              <p className="text-sm text-ink-dim">{error}</p>
              <a
                href={plexUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => openPlexLink(e, plexUrl)}
                className="flex h-10 items-center gap-2 rounded-xl bg-amber px-5 text-sm font-bold text-black"
              >
                <ExternalLink className="h-4 w-4" />
                {t("library.watchOnPlex")}
              </a>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                className="h-full w-full cursor-pointer"
                autoPlay
                playsInline
                onClick={togglePlay}
              />

              {buffering && !mseActive && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-white/80" />
                </div>
              )}

              {mseActive && mseStats && beta.debug && (
                <div className="pointer-events-none absolute bottom-16 left-3 z-30 rounded-lg bg-black/70 px-3 py-2 font-mono text-[10px] leading-relaxed text-white/80">
                  <div>MSE {mseStats.state} · buf {mseStats.bufferedSec.toFixed(1)}s</div>
                  <div>{mseStats.networkMbps.toFixed(1)} Mbps · seg {mseStats.segmentMs.toFixed(0)}ms</div>
                  <div>rebuffer {mseStats.rebufferCount} · errors {mseStats.errors} · start {(mseStats.startupMs / 1000).toFixed(1)}s</div>
                  <div>{(mseStats.fetchedBytes / 1048576).toFixed(1)} MB fetched</div>
                </div>
              )}

              {ffmpegActive && ffmpegStats && beta.debug && (
                <div className="pointer-events-none absolute bottom-16 left-3 z-30 rounded-lg bg-black/70 px-3 py-2 font-mono text-[10px] leading-relaxed text-white/80">
                  <div>FFmpeg remux · actif {ffmpegStats.active ? "oui" : "non"}</div>
                  <div className="truncate max-w-[220px]">{ffmpegStats.src}</div>
                </div>
              )}

              {cacheProgress && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80">
                  <div className="flex flex-col items-center gap-4 p-8 text-center">
                    <p className="text-md font-semibold text-white">{t("player.betaCacheFill")}</p>
                    <div className="h-2 w-64 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full brand-gradient transition-all duration-300"
                        style={{ width: `${(cacheProgress.current / cacheProgress.target) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-ink-dim">{cacheProgress.current.toFixed(0)}s / {cacheProgress.target}s</p>
                  </div>
                </div>
              )}

              {showResume && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80">
                  <div className="flex flex-col items-center gap-6 p-8 text-center">
                    <p className="text-lg font-semibold text-white">
                      {t("player.betaResumeFrom")} {formatTime(savedPos)}
                    </p>
                    <div className="flex items-center gap-4 flex-wrap justify-center">
                      <button
                        onClick={handleResume}
                        className="flex h-12 items-center gap-2 rounded-xl bg-amber px-6 text-sm font-bold text-black hover:bg-amber/90 transition-colors"
                      >
                        <Play className="h-4 w-4" />
                        {t("player.betaResume")}
                      </button>
                      <button
                        onClick={handleStartOver}
                        className="flex h-12 items-center gap-2 rounded-xl bg-white/10 px-6 text-sm font-semibold text-white hover:bg-white/20 transition-colors"
                      >
                        {t("player.betaStartOver")}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {!error && (
                <div
                  className={cn(
                    "absolute bottom-0 left-0 right-0 transition-opacity duration-300",
                    controlsVisible || !playing || buffering ? "opacity-100" : "opacity-0 pointer-events-none"
                  )}
                >
                  <div className="px-3 relative">
                    {scrubPreview && (
                      <div
                        className="pointer-events-none absolute bottom-full mb-2 -translate-x-1/2 flex flex-col items-center"
                        style={{ left: `${Math.min(94, Math.max(6, scrubPreview.ratio * 100))}%` }}
                      >
                        <div className="flex h-[90px] w-[160px] items-center justify-center overflow-hidden rounded-lg border border-white/15 bg-black/80 shadow-lg">
                          {scrubPreview.url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={scrubPreview.url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <Loader2 className="h-4 w-4 animate-spin text-white/50" />
                          )}
                        </div>
                        <span className="mt-1 rounded-full bg-black/80 px-2 py-0.5 text-[10px] font-bold text-white">
                          {formatTime(scrubPreview.time)}
                        </span>
                      </div>
                    )}
                    <div
                      ref={progressRef}
                      className="group relative h-1 hover:h-2 transition-[height] cursor-pointer origin-bottom"
                      onMouseDown={handleProgressDown}
                      onTouchStart={handleProgressDown}
                      onMouseMove={handleProgressHover}
                      onMouseLeave={handleProgressLeave}
                    >
                      <div className="absolute inset-y-0 left-0 right-0 rounded-full bg-white/10" />
                      <div className="absolute inset-y-0 left-0 rounded-full bg-white/20" style={{ width: `${bufferedPct}%` }} />
                      <div className="absolute inset-y-0 left-0 rounded-full bg-brand-glow" style={{ width: `${playedPct}%` }} />
                      <div
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3 w-3 rounded-full bg-white opacity-0 group-hover:opacity-100 transition-opacity shadow"
                        style={{ left: `${playedPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-0.5 px-2 py-2 bg-black/60 backdrop-blur">
                    <button
                      onClick={togglePlay}
                      className="flex h-11 w-11 items-center justify-center rounded-lg text-white/80 hover:text-white"
                      aria-label={playing ? t("player.betaPause") : t("player.betaPlay")}
                    >
                      {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
                    </button>

                    <button
                      onClick={() => { skip(-10); resetHideTimer(); }}
                      className="flex h-11 w-11 items-center justify-center rounded-lg text-white/60 hover:text-white"
                      aria-label={t("player.betaSkipBack")}
                    >
                      <SkipBack className="h-4 w-4" />
                    </button>

                    <button
                      onClick={() => { skip(10); resetHideTimer(); }}
                      className="flex h-11 w-11 items-center justify-center rounded-lg text-white/60 hover:text-white"
                      aria-label={t("player.betaSkipForward")}
                    >
                      <SkipForward className="h-4 w-4" />
                    </button>

                    <div
                      className="flex items-center"
                      onMouseEnter={() => setShowVolume(true)}
                      onMouseLeave={() => setShowVolume(false)}
                    >
                      <button
                        onClick={toggleMute}
                        className="flex h-11 w-11 items-center justify-center rounded-lg text-white/80 hover:text-white"
                        aria-label={muted ? t("player.betaUnmute") : t("player.betaMute")}
                      >
                        {muted || volume === 0
                          ? <VolumeX className="h-5 w-5" />
                          : volume < 0.5
                            ? <Volume1 className="h-5 w-5" />
                            : <Volume2 className="h-5 w-5" />
                        }
                      </button>
                      <div className={cn(
                        "overflow-hidden transition-all duration-200",
                        showVolume ? "w-20 opacity-100 ml-1" : "w-0 opacity-0"
                      )}>
                        <div
                          ref={volumeTrackRef}
                          className="relative h-1 w-20 rounded-full bg-white/20 cursor-pointer"
                          onMouseDown={handleVolumeDown}
                        >
                          <div className="absolute inset-y-0 left-0 rounded-full bg-white" style={{ width: `${muted ? 0 : volume * 100}%` }} />
                          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3 w-3 rounded-full bg-white shadow" style={{ left: `${muted ? 0 : volume * 100}%` }} />
                        </div>
                      </div>
                    </div>

                    <span className="ml-1 text-xs font-mono tabular-nums text-white/80 whitespace-nowrap select-none">
                      {formatTime(seekPreview ?? currentTime)} / {formatTime(duration)}
                    </span>

                    <div className="flex-1" />

                    {usingFallback && qualityLabel() && (
                      <span className="hidden sm:inline-flex h-6 items-center rounded-full bg-white/10 px-2 text-[10px] font-semibold text-ink-dim">{qualityLabel()}</span>
                    )}

                    <div className="relative">
                      <button
                        onClick={() => toggleMenu("quality")}
                        className="flex h-11 w-11 items-center justify-center rounded-lg text-white/60 hover:text-white"
                        aria-label={t("player.betaQuality")}
                      >
                        <Monitor className="h-5 w-5" />
                      </button>
                      {menuOpen === "quality" && (
                        <div className="absolute right-0 bottom-full mb-2 w-28 rounded-xl border border-white/10 bg-surface p-1 shadow-2xl">
                          {QUALITY_PRESETS.map((preset) => (
                            <button
                              key={preset.label}
                              onClick={() => handleQualityChange(preset.maxWidth)}
                              className={cn(
                                "flex w-full items-center justify-center rounded-lg px-3 py-2 text-xs hover:bg-white/10",
                                qualityMaxWidthRef.current === preset.maxWidth ? "text-brand-glow" : "text-ink-dim"
                              )}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="relative">
                      <button
                        onClick={() => toggleMenu("speed")}
                        className="flex h-11 w-11 items-center justify-center rounded-lg text-white/60 hover:text-white"
                        aria-label={t("player.betaSpeed")}
                      >
                        <Gauge className="h-5 w-5" />
                      </button>
                      {menuOpen === "speed" && (
                        <div className="absolute right-0 bottom-full mb-2 w-24 rounded-xl border border-white/10 bg-surface p-1 shadow-2xl">
                          {SPEEDS.map((s) => (
                            <button
                              key={s}
                              onClick={() => setSpeed(s)}
                              className={cn(
                                "flex w-full items-center justify-center rounded-lg px-3 py-2 text-xs hover:bg-white/10",
                                playbackRate === s ? "text-brand-glow" : "text-ink-dim"
                              )}
                            >
                              {s}x
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {usingFallback && (
                      <div className="relative flex items-center gap-1">
                        <button
                          onClick={() => toggleMenu("audio")}
                          disabled={audioStreams.length === 0}
                          className="flex h-11 w-11 items-center justify-center rounded-lg text-white/60 hover:text-white disabled:opacity-40"
                          title={t("player.betaAudio")}
                          aria-label={t("player.betaAudio")}
                        >
                          <AudioLines className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => toggleMenu("subtitle")}
                          disabled={subtitleStreams.length === 0 && !currentSubtitle}
                          className="flex h-11 w-11 items-center justify-center rounded-lg text-white/60 hover:text-white disabled:opacity-40"
                          title={t("player.betaSubtitle")}
                          aria-label={t("player.betaSubtitle")}
                        >
                          <Captions className="h-5 w-5" />
                        </button>
                        {menuOpen && (menuOpen === "audio" || menuOpen === "subtitle") && (
                          <div className="absolute right-0 bottom-full mb-2 max-h-64 w-56 overflow-auto rounded-xl border border-white/10 bg-surface p-1 shadow-2xl">
                            {menuOpen === "audio" && (
                              <>
                                {audioStreams.map((s) => (
                                  <button
                                    key={s.id}
                                    onClick={() => {
                                      reloadHls(s.id, currentSubtitle);
                                      setMenuOpen(null);
                                    }}
                                    className={cn(
                                      "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs hover:bg-white/10",
                                      currentAudio === s.id ? "text-brand-glow" : "text-ink-dim"
                                    )}
                                  >
                                    <span className="truncate">{s.language || s.codec || s.id}</span>
                                    {s.channels ? <span className="text-[10px] opacity-60">{s.channels > 2 ? `${s.channels}.1` : `${s.channels}.0`}</span> : null}
                                  </button>
                                ))}
                              </>
                            )}
                            {menuOpen === "subtitle" && (
                              <>
                                <button
                                  onClick={() => {
                                    reloadHls(currentAudio, null);
                                    setMenuOpen(null);
                                  }}
                                  className={cn(
                                    "flex w-full items-center rounded-lg px-3 py-2 text-left text-xs hover:bg-white/10",
                                    !currentSubtitle ? "text-brand-glow" : "text-ink-dim"
                                  )}
                                >
                                  {t("player.betaOff")}
                                </button>
                                {subtitleStreams.map((s) => (
                                  <button
                                    key={s.id}
                                    onClick={() => {
                                      reloadHls(currentAudio, s.id);
                                      setMenuOpen(null);
                                    }}
                                    className={cn(
                                      "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs hover:bg-white/10",
                                      currentSubtitle === s.id ? "text-brand-glow" : "text-ink-dim"
                                    )}
                                  >
                                    <span className="truncate">{s.language || s.codec || s.id}</span>
                                  </button>
                                ))}
                              </>
                            )}
                          </div>
                        )}
                        <div className="relative">
                          <button
                            onClick={() => toggleMenu("transcode")}
                            className="flex h-11 w-11 items-center justify-center rounded-lg text-white/60 hover:text-white"
                            title={t("player.betaTranscodeMode")}
                          >
                            <Settings className="h-5 w-5" />
                          </button>
                          {menuOpen === "transcode" && (
                            <div className="absolute right-0 bottom-full mb-2 w-32 rounded-xl border border-white/10 bg-surface p-1 shadow-2xl">
                              {(["auto", "audio", "video", "full"] as const).map((m) => (
                                <button
                                  key={m}
                                  onClick={() => {
                                    transcodeModeRef.current = m;
                                    setMenuOpen(null);
                                    if (hlsRef.current) reloadHls(currentAudio, currentSubtitle);
                                    else if (startHlsRef.current) startHlsRef.current();
                                  }}
                                  className={cn(
                                    "flex w-full items-center justify-center rounded-lg px-3 py-2 text-xs hover:bg-white/10",
                                    transcodeModeRef.current === m ? "text-brand-glow" : "text-ink-dim"
                                  )}
                                >
                                  {m === "auto" ? t("player.betaTranscodeAuto")
                                    : m === "audio" ? t("player.betaTranscodeAudio")
                                    : m === "video" ? t("player.betaTranscodeVideo")
                                    : t("player.betaTranscodeFull")}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={handleDirectPlay}
                          className="flex h-11 w-11 items-center justify-center rounded-lg text-white/60 hover:text-green"
                          title={t("player.betaDirectPlay")}
                          aria-label={t("player.betaDirectPlay")}
                        >
                          <Zap className="h-5 w-5" />
                        </button>
                      </div>
                    )}

                    {directMode && (
                      <button
                        onClick={handleReturnToHls}
                        className="flex h-11 w-11 items-center justify-center rounded-lg text-white/60 hover:text-amber"
                        title={t("player.betaReturnHls")}
                        aria-label={t("player.betaReturnHls")}
                      >
                        <AlertTriangle className="h-5 w-5" />
                      </button>
                    )}

                    {pipSupported && (
                      <button
                        onClick={togglePiP}
                        className="flex h-11 w-11 items-center justify-center rounded-lg text-white/60 hover:text-white"
                        aria-label={t("player.betaPiP")}
                      >
                        <PictureInPicture2 className="h-5 w-5" />
                      </button>
                    )}

                    <button
                      onClick={toggleFullscreen}
                      className="flex h-11 w-11 items-center justify-center rounded-lg text-white/60 hover:text-white"
                      aria-label={fullscreen ? t("player.betaExitFullscreen") : t("player.betaFullscreen")}
                    >
                      {fullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
