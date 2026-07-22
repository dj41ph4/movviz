"use client";

import Link from "next/link";
import useSWR from "swr";
import { cn, formatBytes, formatSpeed, formatEtaMs } from "@/lib/utils";
import { useT } from "@/i18n/provider";
import type { EngineTorrent } from "@/lib/types";
import { Download, Pause, CheckCircle2, AlertTriangle, Clock, WifiOff } from "lucide-react";

const VISIBLE_LIMIT = 3;

const STATUS = {
  downloading: { icon: Download, tone: "text-cyan", key: "downloads.states.downloading" },
  queued: { icon: Clock, tone: "text-ink-dim", key: "downloads.states.queued" },
  paused: { icon: Pause, tone: "text-amber", key: "downloads.states.paused" },
  seeding: { icon: CheckCircle2, tone: "text-ok", key: "downloads.states.seeding" },
  completed: { icon: CheckCircle2, tone: "text-ok", key: "downloads.states.completed" },
  stalled: { icon: AlertTriangle, tone: "text-down", key: "downloads.states.stalled" },
  metadata: { icon: Clock, tone: "text-brand-glow", key: "downloads.states.metadata" },
} as const;

export function DownloadQueue() {
  const t = useT();
  // Shared SWR key with the Téléchargements page and the dashboard grid —
  // one poll feeds all of them, and the queue paints instantly from cache.
  const { data, error } = useSWR<{ torrents: EngineTorrent[] }>(
    "/api/engine/torrents", { refreshInterval: 3000 }
  );
  const torrents = error ? null : data?.torrents ?? null;

  // Only in-flight torrents belong here — once a download finishes it moves
  // into the Activity feed's journal instead of lingering in the queue too.
  const queued = (torrents ?? []).filter((d) => d.state !== "completed" && d.state !== "seeding");
  const active = queued.filter((d) => d.state === "downloading").length;

  return (
    <div className="rounded-2xl glass p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-ink">{t("dashboard.downloadQueue")}</h2>
        <span className="rounded-full bg-cyan/12 px-2.5 py-1 text-xs font-semibold text-cyan">
          {active} {t("common.active")}
        </span>
      </div>

      {error && (
        <div className="flex items-center gap-2 py-4 text-sm text-ink-dim">
          <WifiOff className="h-4 w-4" />
          {(error as { status?: number }).status === 401 ? t("downloads.sessionExpired") : t("downloads.engineOffline")}
        </div>
      )}

      {!error && torrents !== null && queued.length === 0 && (
        <p className="py-4 text-center text-sm text-ink-dim">{t("downloads.empty")}</p>
      )}

      <div className="space-y-2">
        {queued.slice(0, VISIBLE_LIMIT).map((d) => {
          const s = STATUS[d.state] ?? STATUS.downloading;
          const Icon = s.icon;
          return (
            <div key={d.infoHash} className="rounded-xl border border-white/5 bg-black/20 p-2.5">
              <div className="flex items-center gap-2.5">
                <Icon className={cn("h-4 w-4 shrink-0", s.tone)} />
                <span className="flex-1 truncate text-sm font-medium text-ink">{d.name}</span>
                <span className="shrink-0 text-xs text-ink-dim">
                  {d.state === "downloading" ? `${formatSpeed(d.downloadSpeed)} · ${formatEtaMs(d.timeRemaining)}` : t(s.key)}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2.5">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/40">
                  <div
                    className={cn("h-full rounded-full", d.state === "stalled" ? "bg-down" : "brand-gradient")}
                    style={{ width: `${Math.round((d.progress ?? 0) * 100)}%` }}
                  />
                </div>
                <span className="w-10 text-right text-xs font-semibold text-ink-soft">{Math.round((d.progress ?? 0) * 100)}%</span>
                <span className="hidden w-14 text-right text-[11px] text-ink-dim sm:inline">{formatBytes(d.size)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {queued.length > VISIBLE_LIMIT && (
        <Link href="/activity" className="mt-3 block text-center text-xs font-semibold text-brand-glow hover:text-brand">
          {t("dashboard.viewQueue", { n: queued.length - VISIBLE_LIMIT })}
        </Link>
      )}
    </div>
  );
}
