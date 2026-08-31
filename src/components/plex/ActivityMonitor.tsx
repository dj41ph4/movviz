"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Activity, Play, Pause, Monitor, Wifi, Globe, Film, Tv, Radio } from "lucide-react";
import { usePlexActivity } from "@/lib/plex/usePlexActivity";
import type { PlexSession } from "@/lib/plex/usePlexActivity";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/provider";

function formatBitrate(kbps: number): string {
  if (kbps <= 0) return "—";
  if (kbps >= 1000) return `${(kbps / 1000).toFixed(1)} Mbps`;
  return `${Math.round(kbps)} kbps`;
}

function formatDuration(ms: number): string {
  if (!ms) return "";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${m} min`;
}

function SessionRow({ s, t }: { s: PlexSession; t: (k: string, params?: Record<string, string | number>) => string }) {
  const typeLabel = s.type === "movie" ? "Film" : s.type === "episode" ? "Episode" : s.type;
  const isPlaying = s.state === "playing";
  const isBuffering = s.state === "buffering";
  const stateLabel = isBuffering ? t("plexActivity.buffering") : isPlaying ? t("plexActivity.live") : t("plexActivity.paused");
  const stateColor = isBuffering ? "text-amber" : isPlaying ? "text-ok" : "text-ink-dim";

  const transcodePill =
    s.transcodeDecision === "transcode"
      ? { text: t("plexActivity.transcoding"), cls: "border-amber/30 bg-amber/12 text-amber" }
      : s.transcodeDecision === "copy"
        ? { text: t("plexActivity.directStream"), cls: "border-cyan/30 bg-cyan/12 text-cyan" }
        : { text: t("plexActivity.directPlay"), cls: "border-ok/30 bg-ok/12 text-ok" };

  return (
    <div className="group flex gap-3 rounded-xl p-2.5 transition-colors hover:bg-white/5">
      {/* Poster */}
      <div className="relative shrink-0">
        <div
          className={cn(
            "h-[72px] w-12 overflow-hidden rounded-lg bg-surface-2",
            isPlaying ? "logo-glow-pulse" : "ring-1 ring-amber/30"
          )}
        >
          {s.thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/stream/plex-proxy${s.thumb}`} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-ink-dim">
              {s.type === "movie" ? <Film className="h-5 w-5" /> : <Tv className="h-5 w-5" />}
            </div>
          )}
        </div>
        <span
          className={cn(
            "absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-void",
            isBuffering ? "bg-amber text-void" : isPlaying ? "bg-ok text-void animate-heartbeat" : "bg-white/20 text-ink"
          )}
        >
          {isPlaying ? <Play className="h-2.5 w-2.5 fill-current" /> : <Pause className="h-2.5 w-2.5 fill-current" />}
        </span>
      </div>

      {/* Details */}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{s.title}</p>
          <span className={cn("shrink-0 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide", stateColor)}>
            {isPlaying && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ok" />}
            {stateLabel}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-ink-dim">
          <Monitor className="h-3 w-3 shrink-0" />
          <span className="truncate">{s.user}</span>
          <span className="text-white/20">·</span>
          <span className="truncate">{s.device}</span>
          <span
            className={cn(
              "ml-0.5 flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold",
              s.location === "lan" ? "border-cyan/30 bg-cyan/10 text-cyan" : "border-magenta/30 bg-magenta/10 text-magenta"
            )}
          >
            {s.location === "lan" ? <Wifi className="h-2.5 w-2.5" /> : <Globe className="h-2.5 w-2.5" />}
            {s.location === "lan" ? t("plexActivity.local") : t("plexActivity.remote")}
          </span>
        </div>

        {s.duration > 0 && (
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/30">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  isPlaying
                    ? "animate-shimmer-progress bg-[linear-gradient(90deg,var(--color-brand)_0%,var(--color-brand-glow)_25%,var(--color-brand-2)_50%,var(--color-brand-glow)_75%,var(--color-brand)_100%)]"
                    : "bg-amber/70"
                )}
                style={{ width: `${Math.min(s.progress, 100)}%` }}
              />
            </div>
            <span className="text-[11px] tabular-nums text-ink-dim">{Math.round(s.progress)}%</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1 pt-0.5">
          <span className={cn("rounded-full border px-1.5 py-0.5 text-[10px] font-bold", transcodePill.cls)}>
            {transcodePill.text}
          </span>
          {s.resolution && (
            <span className="rounded-full border border-white/8 bg-black/20 px-1.5 py-0.5 text-[10px] font-bold text-ink-soft">
              {s.resolution.startsWith("2160") ? "4K" : s.resolution}
            </span>
          )}
          {s.videoCodec && (
            <span className="rounded-full border border-white/8 bg-black/20 px-1.5 py-0.5 text-[10px] font-bold text-ink-soft">
              {s.videoCodec}
            </span>
          )}
          <span className="text-[10px] text-ink-dim">{formatBitrate(s.bitrate || s.bandwidth)}</span>
          {s.duration > 0 && <span className="text-[10px] text-ink-dim">{formatDuration(s.duration)}</span>}
        </div>
      </div>
    </div>
  );
}

export function ActivityMonitor() {
  const t = useT();
  const sessions = usePlexActivity();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; right: number; width: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && !(e.target as HTMLElement).closest("[data-activity-monitor-popover]")) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const compute = () => {
      const btn = buttonRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const isMobile = window.innerWidth < 640;
      if (isMobile) {
        setPos({ top: 64, left: 16, right: 16, width: window.innerWidth - 32 });
      } else {
        setPos({ top: rect.bottom + 8, left: rect.right - 384, right: 0, width: 384 });
      }
    };
    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("scroll", compute, true);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute, true);
    };
  }, [open]);

  const activeCount = sessions.length;
  const playingCount = sessions.filter((s) => s.state === "playing").length;
  const eegSpeed = playingCount > 0 ? "0.6s" : "1.5s";
  const plural = activeCount === 1 ? "" : "s";

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen((o) => !o)}
        aria-label={t("plexActivity.title")}
        className={cn(
          "relative flex h-11 w-11 items-center justify-center rounded-xl glass transition-colors hover:text-brand-glow",
          playingCount > 0 && "text-ok"
        )}
      >
        <div className="flex items-center gap-[2px]">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="eeg-bar block w-[3px] rounded-full bg-current"
              style={{
                height: "16px",
                animationDuration: eegSpeed,
                animationDelay: `${i * (playingCount > 0 ? 0.1 : 0.2)}s`,
              }}
            />
          ))}
        </div>
        {activeCount > 0 && (
          <span
            key={activeCount}
            className="animate-badge-pop absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-magenta px-1 text-[10px] font-bold text-white ring-2 ring-void"
          >
            {activeCount}
          </span>
        )}
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            data-activity-monitor-popover
            className="fixed z-40 overflow-hidden rounded-2xl glass-strong shadow-2xl"
            style={{ top: pos.top, left: pos.left, width: pos.width }}
          >
          <div className="relative overflow-hidden border-b border-white/8 px-4 py-3">
            <div className="absolute inset-0 brand-gradient opacity-15" />
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-brand-glow">
                  {playingCount > 0 ? <Radio className="h-3.5 w-3.5 animate-pulse" /> : <Activity className="h-3.5 w-3.5" />}
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-ink">
                  {t("plexActivity.popoverTitle")}
                </span>
              </div>
              <span
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold",
                  activeCount > 0 ? "border-ok/30 bg-ok/12 text-ok" : "border-white/10 bg-white/5 text-ink-dim"
                )}
              >
                {activeCount > 0 && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ok" />}
                {activeCount > 0
                  ? t("plexActivity.activeCount", { count: activeCount, plural })
                  : t("plexActivity.noActivity")}
              </span>
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto p-1.5">
            {sessions.length === 0 && (
              <p className="p-6 text-center text-sm text-ink-dim">{t("plexActivity.empty")}</p>
            )}
            {sessions.map((s, i) => (
              <SessionRow key={`${s.title}-${s.user}-${i}`} s={s} t={t} />
            ))}
          </div>
          </div>,
          document.body
        )}
    </div>
  );
}
