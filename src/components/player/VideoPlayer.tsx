"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/provider";
import { X, Maximize2, Minimize2, ExternalLink } from "lucide-react";

interface VideoPlayerProps {
  ratingKey: string;
  plexUrl: string;
  title: string;
  onClose: () => void;
}

export function VideoPlayer({ ratingKey, plexUrl, title, onClose }: VideoPlayerProps) {
  const t = useT();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const onError = () => setError(true);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    el.addEventListener("error", onError);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);

    return () => {
      el.removeEventListener("error", onError);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
    };
  }, []);

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
          <p className="truncate text-sm font-semibold text-ink">{title}</p>
          <div className="flex items-center gap-2">
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
              <p className="text-sm text-ink-dim">{t("player.betaError")}</p>
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
              src={`/api/stream/${ratingKey}`}
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
