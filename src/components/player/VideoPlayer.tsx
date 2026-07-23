"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/provider";
import { X, Maximize2, Minimize2, ExternalLink, AlertTriangle, Loader2 } from "lucide-react";
import { pickStrategy, type PlaybackStrategy } from "@/lib/player/webcodecs";

interface VideoPlayerProps {
  ratingKey: string;
  plexUrl: string;
  title: string;
  onClose: () => void;
  /** Utiliser le flux transcodé HLS dès le départ (contourne les problèmes de codec audio/vidéo). */
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

export function VideoPlayer({ ratingKey, plexUrl, title, onClose, useTranscode }: VideoPlayerProps) {
  const t = useT();
  const tRef = useRef(t);
  tRef.current = t;

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const fallbackGuardRef = useRef(false);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const infoRef = useRef<StreamInfo>({ videoCodec: null, audioCodec: null });

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
  const [menuOpen, setMenuOpen] = useState<null | "audio" | "subtitle">(null);

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

        // Current quality level indicator (#11)
        hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => setCurrentLevel(data.level));
      } else if (el.canPlayType("application/vnd.apple.mpegurl")) {
        el.src = url;
      } else {
        setError(tRef.current("player.betaError"));
      }
    };

    const startDirect = () => {
      // Restore saved position
      const saved = Number(localStorage.getItem(PROGRESS_KEY(ratingKey)));
      if (saved && Number.isFinite(saved)) {
        el.addEventListener(
          "loadedmetadata",
          () => {
            if (el.duration && saved < el.duration) el.currentTime = saved;
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

    const begin = async () => {
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
      } catch {
        /* ignore — fallback below */
      }

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
      startDirect();
    };

    void begin();

    const onWaiting = () => setBuffering(true);
    const onPlaying = () => setBuffering(false);
    const onCanPlay = () => setBuffering(false);
    el.addEventListener("waiting", onWaiting);
    el.addEventListener("playing", onPlaying);
    el.addEventListener("canplay", onCanPlay);

    const saveProgress = () => {
      if (!el.duration || Number.isNaN(el.duration)) return;
      const offset = Math.floor(el.currentTime * 1000); // ms
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
        } catch {
          /* ignore */
        }
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
            {usingFallback && (
              <div className="relative flex items-center gap-1">
                {qualityLabel() && (
                  <span className="hidden sm:inline-flex h-6 items-center rounded-full bg-white/10 px-2 text-[10px] font-semibold text-ink-dim">
                    {t("player.betaQuality")}: {qualityLabel()}
                  </span>
                )}
                <button
                  onClick={() => setMenuOpen(menuOpen === "audio" ? null : "audio")}
                  disabled={audioStreams.length === 0}
                  className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-ink-dim hover:bg-white/10 hover:text-ink disabled:opacity-40"
                  title={t("player.betaAudio")}
                >
                  {t("player.betaAudio")}
                </button>
                <button
                  onClick={() => setMenuOpen(menuOpen === "subtitle" ? null : "subtitle")}
                  disabled={subtitleStreams.length === 0 && !currentSubtitle}
                  className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-ink-dim hover:bg-white/10 hover:text-ink disabled:opacity-40"
                  title={t("player.betaSubtitle")}
                >
                  {t("player.betaSubtitle")}
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-9 z-10 max-h-64 w-56 overflow-auto rounded-xl border border-white/10 bg-surface p-1 shadow-2xl">
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
                              currentAudio === s.id ? "text-amber" : "text-ink-dim"
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
                            !currentSubtitle ? "text-amber" : "text-ink-dim"
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
                              currentSubtitle === s.id ? "text-amber" : "text-ink-dim"
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
            <button
              onClick={toggleFullscreen}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-dim hover:bg-white/10 hover:text-ink"
              title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
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

        <div className="flex flex-1 items-center justify-center bg-black">
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
                className="h-full w-full"
                controls
                autoPlay
                playsInline
              />
              {buffering && !error && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-white/80" />
                </div>
              )}
              {buffering && (
                <span className="sr-only">{t("player.betaLoading")}</span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}