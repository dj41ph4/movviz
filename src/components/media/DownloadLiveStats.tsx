"use client";

import useSWR from "swr";
import { useState } from "react";
import Link from "next/link";
import { Activity, ArrowDown, ArrowUp, Download, RotateCw } from "lucide-react";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { formatBytes, formatSpeed } from "@/lib/utils";
import { useT } from "@/i18n/provider";
import { toast } from "@/components/ui/Toast";
import { Toggle } from "@/components/ui/Toggle";
import type { EngineInstance } from "@/lib/types";

type SpeedSample = { at: number; downloadSpeed: number; uploadSpeed: number; active: number };
type EngineStats = { torrents: number; downloading: number; queued: number; seeding: number; completed: number; downloadSpeed: number; uploadSpeed: number; history?: SpeedSample[] };
type SystemStats = { disk: { total: number; free: number } | null };

function linePoints(history: SpeedSample[], key: "downloadSpeed" | "uploadSpeed", width = 260, height = 72) {
  const values = history.map((sample) => sample[key]);
  const max = Math.max(1, ...values);
  return values.map((value, index) => {
    const x = history.length <= 1 ? 0 : (index / (history.length - 1)) * width;
    const y = height - (value / max) * (height - 8) - 4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

/** Real engine samples, shared by every browser through /api/engine/stats. */
export function DownloadLiveStats() {
  const t = useT();
  const user = useCurrentUser();
  const [requestingRestart, setRequestingRestart] = useState(false);
  const { data: restartStatus, mutate: mutateRestart } = useSWR<{ restarting: boolean; error: string | null }>(
    user?.role === "admin" ? "/api/engine/client-restart" : null,
    { refreshInterval: (status) => status?.restarting ? 1000 : 15_000, dedupingInterval: 500, revalidateOnFocus: true },
  );
  const restarting = requestingRestart || !!restartStatus?.restarting;
  const restartClient = async () => {
    if (restarting) return;
    setRequestingRestart(true);
    try {
      const res = await fetch("/api/engine/client-restart", { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
      await mutateRestart(await res.json(), { revalidate: false });
    } catch {
      toast("error", t("common.actionFailed"));
      await mutateRestart();
    } finally {
      setRequestingRestart(false);
      await mutateInstances();
    }
  };
  const { data } = useSWR<EngineStats>("/api/engine/stats", { refreshInterval: 5000, revalidateOnFocus: false });
  const { data: systemStats } = useSWR<SystemStats>("/api/stats", { refreshInterval: 30_000, revalidateOnFocus: false });
  const { data: instanceData, mutate: mutateInstances } = useSWR<{ instances: EngineInstance[] }>("/api/engine/instances", { refreshInterval: 15_000, revalidateOnFocus: false });
  const history = data?.history?.slice(-60) ?? [];
  const down = linePoints(history, "downloadSpeed");
  const up = linePoints(history, "uploadSpeed");
  const primary = instanceData?.instances?.[0];
  const updatePrimary = async (patch: Partial<Pick<EngineInstance, "autoStart" | "sequential">>) => {
    if (!primary || !instanceData) return;
    // Optimistic flip, no revalidation yet — the toggle used to sit
    // unchanged until the next 15s poll even on success, reading as
    // unresponsive. On failure (e.g. a non-admin session silently 403'd by
    // the engine route) it now visibly snaps back instead of just staying
    // stuck on the pre-click value with no feedback at all.
    const optimistic = {
      ...instanceData,
      instances: instanceData.instances.map((inst) => inst.id === primary.id ? { ...inst, ...patch } : inst),
    };
    await mutateInstances(optimistic, { revalidate: false });
    try {
      const res = await fetch(`/api/engine/instances/${primary.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      toast("error", t("common.actionFailed"));
    } finally {
      await mutateInstances();
    }
  };

  return (
    <aside className="space-y-4">
      <section className="rounded-xl glass p-4">
        <div className="mb-4 flex items-center gap-2 text-sm font-bold text-ink">
          <Activity className="h-4 w-4 text-brand-glow" /> {t("activity.title")}
        </div>
        <svg viewBox="0 0 260 72" role="img" data-nx-dl-chart aria-label={t("downloads.down")} className="h-[72px] w-full overflow-visible">
          <defs>
            <linearGradient id="nxDownloadSpeed" x1="0" x2="1">
              <stop stopColor="var(--color-brand)" />
              <stop offset="1" stopColor="var(--color-magenta)" />
            </linearGradient>
          </defs>
          <path d="M0 68H260" stroke="rgba(174,180,214,0.16)" />
          {down && <polyline fill="none" stroke="url(#nxDownloadSpeed)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={down} />}
          {up && <polyline fill="none" stroke="var(--color-cyan)" strokeOpacity="0.65" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={up} />}
        </svg>
        <div className="nx-dl-rates mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-brand/25 bg-brand/10 p-2.5">
            <span className="flex items-center gap-1 text-[11px] font-semibold text-ink-dim"><ArrowDown className="h-3 w-3 text-brand-glow" /> {t("downloads.down")}</span>
            <strong className="mt-1 block text-sm text-ink">{formatSpeed(data?.downloadSpeed ?? 0)}</strong>
          </div>
          <div className="rounded-lg border border-cyan/20 bg-cyan/5 p-2.5">
            <span className="flex items-center gap-1 text-[11px] font-semibold text-ink-dim"><ArrowUp className="h-3 w-3 text-cyan" /> {t("downloads.up")}</span>
            <strong className="mt-1 block text-sm text-ink">{formatSpeed(data?.uploadSpeed ?? 0)}</strong>
          </div>
        </div>
      </section>
      <section className="rounded-xl glass p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink"><Download className="h-4 w-4 text-cyan" /> {t("downloads.title")}</div>
        <dl className="nx-dl-stats grid grid-cols-2 gap-x-3 gap-y-3 text-xs">
          <div><dt className="text-ink-dim">{t("activity.status.downloading")}</dt><dd className="mt-0.5 text-lg font-black text-cyan">{data?.downloading ?? 0}</dd></div>
          <div><dt className="text-ink-dim">{t("activity.status.completed")}</dt><dd className="mt-0.5 text-lg font-black text-ok">{data?.completed ?? 0}</dd></div>
          <div><dt className="text-ink-dim">{t("activity.status.seeding")}</dt><dd className="mt-0.5 text-lg font-black text-brand-glow">{data?.seeding ?? 0}</dd></div>
          <div><dt className="text-ink-dim">{t("common.all")}</dt><dd className="mt-0.5 text-lg font-black text-ink">{data?.torrents ?? 0}</dd></div>
          <div><dt className="text-ink-dim">{t("activity.status.queued")}</dt><dd className="mt-0.5 text-lg font-black text-brand-glow">{data?.queued ?? 0}</dd></div>
          <div><dt className="text-ink-dim">{t("stats.free")}</dt><dd className="mt-0.5 text-sm font-black text-ok">{systemStats?.disk ? formatBytes(systemStats.disk.free) : "—"}</dd></div>
        </dl>
      </section>
      <section className="rounded-xl glass p-4">
        <div className="mb-3 text-sm font-bold text-ink">{t("settings.quickDownloadSettings")}</div>
        {primary ? (
          <div className="space-y-3 text-xs">
            <div className="flex min-h-8 items-center justify-between gap-3">
              <span className="text-ink-soft">{t("settings.autoStart")}</span>
              <Toggle on={primary.autoStart} onChange={() => updatePrimary({ autoStart: !primary.autoStart })} />
            </div>
            <div className="flex min-h-8 items-center justify-between gap-3">
              <span className="text-ink-soft">{t("downloads.seq")}</span>
              <Toggle on={primary.sequential} onChange={() => updatePrimary({ sequential: !primary.sequential })} />
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-white/8 pt-3 text-ink-dim"><span>{t("settings.speedLimit")}</span><span className="font-semibold text-ink">{primary.downloadLimitKbps > 0 ? `${primary.downloadLimitKbps} KB/s` : "∞"}</span></div>
          </div>
        ) : <p className="text-xs text-ink-dim">—</p>}
        {user?.role === "admin" && (
          <div className="mt-3" aria-live="polite">
            <button type="button" onClick={restartClient} disabled={restarting} className="nx-dl-restart flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-brand/30 bg-brand/10 px-3 text-xs font-bold text-brand-glow hover:bg-brand/20 disabled:cursor-wait disabled:opacity-70">
              <RotateCw className={`h-4 w-4 shrink-0 ${restarting ? "animate-spin" : ""}`} />
              {t(restarting ? "settings.restartingTorrentClient" : "settings.restartTorrentClient")}
            </button>
            {!restarting && restartStatus?.error && <p role="alert" className="mt-2 text-xs text-red-400">{t("common.actionFailed")}</p>}
          </div>
        )}
        <Link href="/settings?tab=clients" className="mt-3 inline-flex min-h-11 items-center text-xs font-bold text-brand-glow hover:text-white">
          {t("settings.manageDownloadClients")} <span aria-hidden="true" className="ml-1">→</span>
        </Link>
      </section>
    </aside>
  );
}
