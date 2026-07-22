"use client";

import useSWR from "swr";
import { useT } from "@/i18n/provider";
import { Film, Tv, PackageCheck, Inbox } from "lucide-react";

interface Stats {
  totalMovies: number;
  totalSeries: number;
  totalEpisodes: number;
  requests: { pending: number; approved: number; declined: number };
  indexerCount: number;
  grabsByDay: { date: string; count: number }[];
  disk: { total: number; free: number } | null;
}

function Tile({ label, value, icon: Icon }: { label: string; value: number; icon: React.ElementType }) {
  return (
    <div className="rounded-2xl glass p-5">
      <div className="mb-2 flex items-center gap-2 text-ink-dim">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-3xl font-black text-ink">{value}</p>
    </div>
  );
}

export function StatsPanel() {
  const t = useT();
  // Cached by SWR: instant paint on revisit, background revalidation.
  const { data: stats } = useSWR<Stats>("/api/stats");

  if (!stats) return null;

  const maxGrabs = Math.max(1, ...stats.grabsByDay.map((d) => d.count));

  return (
    <div>
      <h3 className="mb-4 text-sm font-bold text-ink-soft">{t("stats.title")}</h3>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Tile label={t("stats.totalMovies")} value={stats.totalMovies} icon={Film} />
        <Tile label={t("stats.totalSeries")} value={stats.totalSeries} icon={Tv} />
        <Tile label={t("stats.totalEpisodes")} value={stats.totalEpisodes} icon={PackageCheck} />
        <Tile label={t("stats.totalRequests")} value={stats.requests.pending + stats.requests.approved + stats.requests.declined} icon={Inbox} />
      </div>

      <div className="mt-6 rounded-2xl glass p-5">
        <h3 className="mb-4 text-sm font-bold text-ink-soft">{t("stats.grabsByDay")}</h3>
        <div className="flex h-32 items-end gap-3">
          {stats.grabsByDay.map((d) => (
            <div key={d.date} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex h-24 w-full items-end">
                <div className="w-full rounded-t-lg brand-gradient" style={{ height: `${Math.max(4, (d.count / maxGrabs) * 100)}%` }} />
              </div>
              <span className="text-[10px] text-ink-dim">{d.date.slice(5)}</span>
            </div>
          ))}
        </div>
      </div>

      {stats.disk && (
        <div className="mt-6 rounded-2xl glass p-5">
          <h3 className="mb-3 text-sm font-bold text-ink-soft">{t("stats.diskUsage")}</h3>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full brand-gradient" style={{ width: `${Math.round(((stats.disk.total - stats.disk.free) / stats.disk.total) * 100)}%` }} />
          </div>
          <p className="mt-2 text-xs text-ink-dim">
            {((stats.disk.total - stats.disk.free) / 1024 ** 3).toFixed(1)} GB {t("stats.used")} · {(stats.disk.free / 1024 ** 3).toFixed(1)} GB {t("stats.free")}
          </p>
        </div>
      )}
    </div>
  );
}
