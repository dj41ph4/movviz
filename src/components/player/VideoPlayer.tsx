"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/provider";
import {
  X, Maximize2, Minimize2, ExternalLink, AlertTriangle, Loader2,
  Play, Pause, Volume2, Volume1, VolumeX, Gauge, AudioLines, Captions,
  SkipBack, SkipForward, PictureInPicture2,
} from "lucide-react";
import { pickStrategy, type PlaybackStrategy } from "@/lib/player/webcodecs";

interface VideoPlayerProps {
  ratingKey: string;
  plexUrl: string;
  title: string;
  onClose: () => void;
  useTranscode?: boolean;
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
  audioStreams?: StreamTrack[];
  subtitleStreams?: StreamTrack[];
  height?: number | null;
}

const PROGRESS_KEY = (ratingKey: string) => `movviz:progress:${ratingKey}`;
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function VideoPlayer({ ratingKey, plexUrl, title, onClose, useTranscode }: VideoPlayerProps) {
  const t = useT();
  const tRef = useRef(t);
  tRef.current = t;

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const fallbackGuardRef = useRef(false);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const infoRef = useRef<StreamInfo>({ videoCodec: null, audioCodec: null });
  const progressRef = useRef<HTMLDivElement>(null);
  const volumeTrackRef = useRef<HTMLDivElement>(null);
  const seekingRef = useRef(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const beginRef = useRef<((seekTo?: number) => Promise<void>) | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [webcodecsNotice, setWebcodecsNotice] = useState(false);
  const [audioStreams, setAudioStreams] = useState<StreamTrack[]>([]);
  const [subtitleStreams, setSubtitleStreams] = useState<StreamTrack[]>([]);
  const [currentAudio, setCurrentAudio] = useState<string | null>(null);
  const [currentSubtitle, setCurrentSubtitle] = useState<string | null>(null);
  const [currentLevel, setCurrentLevel] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState<null | "audio" | "subtitle" | "speed">(null);

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

  useEffect(() => {
    setPipSupported(
      typeof document !== "undefined" &&
      "pictureInPictureEnabled" in document &&
      document.pictureInPictureEnabled
    );
  }, []);

  const reloadHls = (audioId: string | null, subtitleId: string | null) => {
    const hls = hlsRef.current;
    if (!hls) return;
    let url = `/api/stream/${ratingKey}/transcode`;
    const params = new URLSearchParams();
    if (audioId) params.set("audioStreamID", audioId);
    if (subtitleId) params.set("subtitleStreamID", subtitleId);
    const qs = params.toString();
    if (qs) url += `?${qs}`;
    setCurrentAudio(audioId);
    setCurrentSubtitle(subtitleId);
    hls.loadSource(url);
  };

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const hlsUrl = `/api/stream/${ratingKey}/transcode`;
    const directUrl = `/api/stream/${ratingKey}`;

    const startHls = (extraParams?: string) => {
      if (fallbackGuardRef.current) return;
      fallbackGuardRef.current = true;
      setUsingFallback(true);

      const url = extraParams ? `${hlsUrl}?${extraParams}` : hlsUrl;
      if (Hls.isSupported()) {
        const hls = new Hls({
          capLevelToPlayerSize: true,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 30,
        });
        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(el);

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) return;
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              setError(tRef.current("player.betaError"));
              hls.destroy();
              break;
          }
        });

        hls.on(Hls.Events.FRAG_LOADING, () => setBuffering(true));
        hls.on(Hls.Events.FRAG_BUFFERED, () => setBuffering(false));
        hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => setCurrentLevel(data.level));
      } else if (el.canPlayType("application/vnd.apple.mpegurl")) {
        el.src = url;
      } else {
        setError(tRef.current("player.betaError"));
      }
    };

    const startDirect = (seekTo?: number) => {
      if (seekTo && seekTo > 0) {
        el.addEventListener(
          "loadedmetadata",
          () => {
            if (el.duration && seekTo < el.duration) el.currentTime = seekTo;
          },
          { once: true }
        );
      }
      el.src = directUrl;

      const onError = () => {
        if (!fallbackGuardRef.current && !hlsRef.current) startHls();
      };
      el.addEventListener("error", onError);
      (el as unknown as { __vpOnError?: () => void }).__vpOnError = onError;
    };

    const begin = async (seekTo?: number) => {
      setBuffering(true);

      if (useTranscode) {
        startHls();
        return;
      }

      let info: StreamInfo = { videoCodec: null, audioCodec: null };
      try {
        const res = await fetch(`/api/stream/${ratingKey}/info`, { cache: "no-store" });
        if (res.ok) {
          info = (await res.json()) as StreamInfo;
          infoRef.current = info;
          if (Array.isArray(info.audioStreams)) setAudioStreams(info.audioStreams);
          if (Array.isArray(info.subtitleStreams)) setSubtitleStreams(info.subtitleStreams);
          const selAudio = info.audioStreams?.find((s) => s.selected);
          if (selAudio) setCurrentAudio(selAudio.id);
          const selSub = info.subtitleStreams?.find((s) => s.selected);
          if (selSub) setCurrentSubtitle(selSub.id);
        }
      } catch { /* ignore */ }

      let strategy: PlaybackStrategy;
      try {
        strategy = await pickStrategy(info.videoCodec, info.audioCodec);
      } catch {
        strategy = "direct";
      }

      if (strategy === "transcode") {
        startHls();
        return;
      }

      if (strategy === "webcodecs") setWebcodecsNotice(true);
      startDirect(seekTo);
    };

    beginRef.current = begin;

    const saved = Number(localStorage.getItem(PROGRESS_KEY(ratingKey)));
    if (saved > 5 && Number.isFinite(saved)) {
      setSavedPos(saved);
      setShowResume(true);
    } else {
      void begin();
    }

    const onWaiting = () => setBuffering(true);
    const onPlaying = () => setBuffering(false);
    const onCanPlay = () => setBuffering(false);
    el.addEventListener("waiting", onWaiting);
    el.addEventListener("playing", onPlaying);
    el.addEventListener("canplay", onCanPlay);

    const saveProgress = () => {
      if (!el.duration || Number.isNaN(el.duration)) return;
      const offset = Math.floor(el.currentTime * 1000);
      localStorage.setItem(PROGRESS_KEY(ratingKey), String(el.currentTime));
      void fetch(`/api/stream/${ratingKey}/progress`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ offset }),
        keepalive: true,
      }).catch(() => void 0);
    };
    progressTimerRef.current = setInterval(saveProgress, 10000);

    return () => {
      if (el.currentTime > 0) {
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
      }

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
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [ratingKey, useTranscode]);

  const skip = useCallback((seconds: number) => {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(el.duration || 0, el.currentTime + seconds));
  }, []);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const onTimeUpdate = () => {
      if (!seekingRef.current) setCurrentTime(el.currentTime);
    };
    const onLoadedData = () => {
      setDuration(el.duration);
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
    const hls = hlsRef.current;
    if (!hls || currentLevel === null) return null;
    const level = hls.levels[currentLevel];
    if (!level) return null;
    const h = level.height || 0;
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
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, skip, resetHideTimer]);

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

  const getSeekTime = (clientX: number): number => {
    const rect = progressRef.current?.getBoundingClientRect();
    if (!rect || !rect.width || !duration) return 0;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * duration;
  };

  const handleProgressDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!duration) return;
    e.preventDefault();
    seekingRef.current = true;

    const cx = "touches" in e ? e.touches[0].clientX : e.clientX;
    setSeekPreview(getSeekTime(cx));

    const onMove = (me: MouseEvent | TouchEvent) => {
      const mc = "touches" in me ? me.touches[0].clientX : me.clientX;
      setSeekPreview(getSeekTime(mc));
    };
    const onUp = (me: MouseEvent | TouchEvent) => {
      seekingRef.current = false;
      const uc = "changedTouches" in me ? me.changedTouches[0].clientX : me.clientX;
      const time = getSeekTime(uc);
      if (videoRef.current) {
        videoRef.current.currentTime = time;
        setCurrentTime(time);
      }
      setSeekPreview(null);
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

  const toggleMenu = (menu: "audio" | "subtitle" | "speed") => {
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

  const playedPct = ((seekPreview ?? currentTime) / (duration || 1)) * 100;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className={cn("relative flex flex-col overflow-hidden rounded-2xl bg-surface shadow-2xl", fullscreen ? "h-full w-full rounded-none" : "h-[80vh] w-[90vw] max-w-5xl")}>
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-3 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {usingFallback && (
              <span className="flex h-6 shrink-0 items-center gap-1 rounded-full bg-amber/15 px-2 text-[10px] font-semibold text-amber">
                <AlertTriangle className="h-3 w-3" />
                {t("player.betaTranscoded")}
              </span>
            )}
            {webcodecsNotice && !usingFallback && (
              <span className="flex h-6 shrink-0 items-center gap-1 rounded-full bg-cyan/15 px-2 text-[10px] font-semibold text-cyan">
                {t("player.betaWebcodecs")}
              </span>
            )}
            <p className="truncate text-sm font-semibold text-ink">{title}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={plexUrl}
              target="_blank"
              rel="noopener noreferrer"
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
          className="relative flex flex-1 items-center justify-center bg-black"
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

              {buffering && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-white/80" />
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
                  <div className="px-3">
                    <div
                      ref={progressRef}
                      className="group relative h-1 hover:h-2 transition-[height] cursor-pointer origin-bottom"
                      onMouseDown={handleProgressDown}
                      onTouchStart={handleProgressDown}
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
                      </div>
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
