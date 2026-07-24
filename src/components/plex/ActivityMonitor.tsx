"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, Play, Pause, Monitor } from "lucide-react";
import { usePlexActivity } from "@/lib/plex/usePlexActivity";
import type { PlexSession } from "@/lib/plex/usePlexActivity";
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

function SessionRow({ s }: { s: PlexSession }) {
  const typeLabel = s.type === "movie" ? "Film" : s.type === "episode" ? "Episode" : s.type;
  const isPlaying = s.state === "playing";
  return (
    <div className="flex flex-col gap-1 rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-white/5">
      <div className="flex items-center gap-2">
        <span className="flex-1 truncate font-medium text-ink-soft">{s.title}</span>
        {isPlaying ? (
          <Play className="h-3.5 w-3.5 shrink-0 text-emerald" />
        ) : (
          <Pause className="h-3.5 w-3.5 shrink-0 text-amber" />
        )}
        <span className="text-xs text-ink-dim">{typeLabel}</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-ink-dim">
        <Monitor className="h-3 w-3" />
        <span>{s.user}</span>
        <span className="text-white/20">·</span>
        <span>{s.device}</span>
        {s.resolution && (
          <>
            <span className="text-white/20">·</span>
            <span>{s.resolution}</span>
          </>
        )}
      </div>
      {s.duration > 0 && (
        <div className="flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full transition-all ${isPlaying ? "bg-emerald" : "bg-amber"}`}
              style={{ width: `${Math.min(s.progress, 100)}%` }}
            />
          </div>
          <span className="text-[11px] tabular-nums text-ink-dim">
            {Math.round(s.progress)}%
          </span>
        </div>
      )}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-ink-dim">
        {s.videoCodec && <span>{s.videoCodec}</span>}
        {s.audioCodec && <span>{s.audioCodec}</span>}
        <span>{formatBitrate(s.bitrate || s.bandwidth)}</span>
        {s.duration > 0 && <span>{formatDuration(s.duration)}</span>}
      </div>
    </div>
  );
}

export function ActivityMonitor() {
  const t = useT();
  const sessions = usePlexActivity();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const activeCount = sessions.length;
  const playingCount = sessions.filter((s) => s.state === "playing").length;
  const eegSpeed = playingCount > 0 ? "0.6s" : "1.5s";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t("plexActivity.title")}
        className="relative flex h-11 w-11 items-center justify-center rounded-xl glass transition-colors hover:text-brand-glow"
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
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-magenta px-1 text-[10px] font-bold text-white ring-2 ring-void">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-40 w-72 max-w-[calc(100vw-2rem)] rounded-2xl glass-strong p-2 shadow-2xl sm:w-80">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-dim">
              {t("plexActivity.popoverTitle")}
            </span>
            <span className="text-[11px] text-ink-dim">
              {activeCount > 0
                ? t("plexActivity.activeCount", { count: activeCount })
                : t("plexActivity.noActivity")}
            </span>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {sessions.length === 0 && (
              <p className="p-4 text-center text-sm text-ink-dim">
                {t("plexActivity.empty")}
              </p>
            )}
            {sessions.map((s, i) => (
              <SessionRow key={`${s.title}-${s.user}-${i}`} s={s} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
