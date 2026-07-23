"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/provider";
import { X, Maximize2, Minimize2, ExternalLink, AlertTriangle } from "lucide-react";

interface VideoPlayerProps {
  ratingKey: string;
  plexUrl: string;
  title: string;
  onClose: () => void;
  /** Utiliser le flux transcodé HLS dès le départ (contourne les problèmes de codec audio/vidéo). */
  useTranscode?: boolean;
}

export function VideoPlayer({ ratingKey, plexUrl, title, onClose, useTranscode }: VideoPlayerProps) {
  const t = useT();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const hlsUrl = `/api/stream/${ratingKey}/transcode`;

    const startHls = () => {
      setUsingFallback(true);
      if (Hls.isSupported()) {
        const hls = new Hls();
        hlsRef.current = hls;
        hls.loadSource(hlsUrl);
        hls.attachMedia(el);
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) setError(t("player.betaError"));
        });
      } else if (el.canPlayType("application/vnd.apple.mpegurl")) {
        el.src = hlsUrl;
      } else {
        setError(t("player.betaError"));
      }
    };

    if (useTranscode) {
      startHls();
    } else {
      const directUrl = `/api/stream/${ratingKey}`;
      const onError = () => {
        if (!hlsRef.current) startHls();
      };
      el.addEventListener("error", onError);
      el.src = directUrl;
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [ratingKey, t, useTranscode]);

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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className={cn("relative flex flex-col overflow-hidden rounded-2xl bg-surface shadow-2xl", fullscreen ? "h-full w-full rounded-none" : "h-[80vh] w-[90vw] max-w-5xl")}>
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            {usingFallback && (
              <span className="flex h-6 shrink-0 items-center gap-1 rounded-full bg-amber/15 px-2 text-[10px] font-semibold text-amber">
                <AlertTriangle className="h-3 w-3" />
                transcodé
              </span>
            )}
            <p className="truncate text-sm font-semibold text-ink">{title}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
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
            <video
              ref={videoRef}
              className="h-full w-full"
              controls
              autoPlay
              playsInline
            />
          )}
        </div>
      </div>
    </div>
  );
}
