"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Activity, BarChart3, Clapperboard, Clock, Film, Globe, Inbox, Monitor, Pause, Play,
  Radio, Repeat, Smartphone, Trophy, Tv, Users as UsersIcon, Wifi,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { useT, useI18n } from "@/i18n/provider";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { usePlexActivity, type PlexSession } from "@/lib/plex/usePlexActivity";
import { useMovvizActivity, type MovvizSession } from "@/lib/playback/useMovvizActivity";
import { cn, relativeTime, formatDate } from "@/lib/utils";
import type { StatsResult, SourceSplit, StatsPeriod } from "@/lib/stats/playStats";

// Couleurs de source : mêmes que le moniteur d'activité (Plex = ambre, Movviz = marque).
const SOURCE_BAR = { movviz: "bg-brand", plex: "bg-amber" } as const;
const SOURCE_TEXT = { movviz: "text-brand-glow", plex: "text-amber" } as const;

const PERIODS: Array<{ value: StatsPeriod; labelKey: string }> = [
  { value: 7, labelKey: "playStats.period7" },
  { value: 30, labelKey: "playStats.period30" },
  { value: 90, labelKey: "playStats.period90" },
  { value: 365, labelKey: "playStats.period365" },
  { value: 0, labelKey: "playStats.periodAll" },
];

const SOURCES = [
  { value: "", labelKey: "playStats.sourceAll" },
  { value: "movviz", labelKey: "playStats.sourceMovviz" },
  { value: "plex", labelKey: "playStats.sourcePlex" },
] as const;

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((res) => {
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
});

function formatWatchTime(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${days} j ${hours} h`;
  if (hours > 0) return `${hours} h ${String(mins).padStart(2, "0")}`;
  return `${mins} min`;
}

type T = ReturnType<typeof useT>;

// ─── Primitives ──────────────────────────────────────────────────────────────

function Card({ title, hint, icon: Icon, children, className }: {
  title: string; hint?: string; icon?: React.ElementType; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={cn("rounded-2xl glass p-4 sm:p-5", className)}>
      <header className="mb-4 flex items-start gap-3">
        {Icon && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/6">
            <Icon className="h-4 w-4 text-brand-glow" />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-ink">{title}</h2>
          {hint && <p className="mt-0.5 text-xs text-ink-dim">{hint}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

function SourceBadge({ source, t }: { source: "movviz" | "plex"; t: T }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold",
      source === "plex" ? "border-amber/30 bg-amber/10 text-amber" : "border-brand/30 bg-brand/10 text-brand-glow",
    )}>
      <span className={cn("h-1.5 w-1.5 rounded-full", SOURCE_BAR[source])} />
      {source === "plex" ? t("playStats.sourcePlex") : t("playStats.sourceMovviz")}
    </span>
  );
}

function Legend({ t }: { t: T }) {
  return (
    <div className="flex items-center gap-3 text-[11px] text-ink-dim">
      {(["movviz", "plex"] as const).map((source) => (
        <span key={source} className="inline-flex items-center gap-1.5">
          <span className={cn("h-2 w-2 rounded-full", SOURCE_BAR[source])} />
          {source === "plex" ? t("playStats.sourcePlex") : t("playStats.sourceMovviz")}
        </span>
      ))}
    </div>
  );
}

/** Histogramme empilé Movviz / Plex en pur CSS (aucune dépendance de graphique). */
function StackedBars({ data, labelAt, height = 132, t }: {
  data: Array<SourceSplit & { label: string }>; labelAt: (index: number) => boolean; height?: number; t: T;
}) {
  const max = Math.max(1, ...data.map((d) => d.movviz + d.plex));
  return (
    <div>
      <div className="flex items-end gap-px sm:gap-0.5" style={{ height }} role="img" aria-label={t("playStats.chartAria")}>
        {data.map((d, i) => {
          const total = d.movviz + d.plex;
          return (
            <div
              key={i}
              title={`${d.label} — ${total} (${t("playStats.sourceMovviz")} ${d.movviz} · ${t("playStats.sourcePlex")} ${d.plex})`}
              className="group flex h-full min-w-0 flex-1 flex-col justify-end"
            >
              <div className="flex w-full flex-col-reverse overflow-hidden rounded-t-[3px] transition-opacity group-hover:opacity-80" style={{ height: `${(total / max) * 100}%`, minHeight: total > 0 ? 2 : 0 }}>
                {d.movviz > 0 && <div className={SOURCE_BAR.movviz} style={{ flexGrow: d.movviz }} />}
                {d.plex > 0 && <div className={SOURCE_BAR.plex} style={{ flexGrow: d.plex }} />}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-px text-[10px] text-ink-dim sm:gap-0.5">
        {data.map((d, i) => (
          <span key={i} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center">
            {labelAt(i) ? d.label : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

function HBars({ rows, empty }: { rows: Array<{ key: string; label: string; value: number }>; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="py-6 text-center text-xs text-ink-dim">{empty}</p>;
  return (
    <ul className="space-y-2.5">
      {rows.map((row) => (
        <li key={row.key}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
            <span className="truncate font-semibold text-ink">{row.label}</span>
            <span className="shrink-0 tabular-nums text-ink-dim">{row.value}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/6">
            <div className="h-full rounded-full bg-brand" style={{ width: `${(row.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Kpi({ label, value, sub, icon: Icon, tone }: { label: string; value: string; sub?: React.ReactNode; icon: React.ElementType; tone?: "ok" | "down" }) {
  return (
    <div className="rounded-2xl glass p-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-ink-dim">
        <Icon className="h-3.5 w-3.5" />
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-black tracking-tight text-ink sm:text-3xl">{value}</p>
      {sub && <p className={cn("mt-1 text-xs", tone === "ok" ? "text-ok" : tone === "down" ? "text-down" : "text-ink-dim")}>{sub}</p>}
    </div>
  );
}

// ─── Direct : sessions Plex + Movviz côte à côte ─────────────────────────────

type LiveSession = (PlexSession & { origin: "plex" }) | MovvizSession;

const MOVVIZ_DEVICE_KEYS: Record<string, string> = {
  "desktop-web": "movvizActivity.deviceWeb",
  "android-mobile": "movvizActivity.deviceAndroidMobile",
  "android-tv": "movvizActivity.deviceAndroidTv",
  cast: "movvizActivity.deviceCast",
  unknown: "movvizActivity.deviceUnknown",
};

function LiveRow({ s, t }: { s: LiveSession; t: T }) {
  const playing = s.state === "playing";
  const buffering = s.state === "buffering";
  const device = s.origin === "movviz"
    ? `${t(MOVVIZ_DEVICE_KEYS[s.device] ?? "movvizActivity.deviceUnknown")}${s.browser ? ` · ${s.browser}` : ""}`
    : s.device;
  const decision = s.transcodeDecision === "transcode"
    ? { text: t("plexActivity.transcoding"), cls: "border-amber/30 bg-amber/12 text-amber" }
    : s.transcodeDecision === "copy"
      ? { text: t("plexActivity.directStream"), cls: "border-cyan/30 bg-cyan/12 text-cyan" }
      : s.transcodeDecision === "directplay"
        ? { text: t("plexActivity.directPlay"), cls: "border-ok/30 bg-ok/12 text-ok" }
        : null;
  const thumb = s.thumb ? (s.origin === "plex" ? `/api/stream/plex-proxy${s.thumb}` : s.thumb) : null;
  const body = (
    <div className="flex gap-3 rounded-xl p-2.5 transition-colors hover:bg-white/5">
      <div className={cn("relative h-[72px] w-12 shrink-0 overflow-hidden rounded-lg bg-surface-2", !playing && "ring-1 ring-amber/30")}>
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-ink-dim">
            {s.type === "movie" ? <Film className="h-5 w-5" /> : <Tv className="h-5 w-5" />}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <SourceBadge source={s.origin} t={t} />
          <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold", buffering ? "text-amber" : playing ? "text-ok" : "text-ink-dim")}>
            {playing ? <Play className="h-3 w-3 fill-current" /> : <Pause className="h-3 w-3 fill-current" />}
            {buffering ? t("plexActivity.buffering") : playing ? t("plexActivity.live") : t("plexActivity.paused")}
          </span>
        </div>
        <p className="mt-1 truncate text-sm font-semibold text-ink">{s.title}</p>
        <p className="truncate text-xs text-ink-dim">{s.user} · {device}{s.resolution ? ` · ${s.resolution}` : ""}</p>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/8">
            <div className={cn("h-full rounded-full", SOURCE_BAR[s.origin])} style={{ width: `${s.progress}%` }} />
          </div>
          <span className="w-8 text-right text-[10px] tabular-nums text-ink-dim">{s.progress}%</span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {decision && <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold", decision.cls)}>{decision.text}</span>}
          {s.origin === "plex" && (
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-ink-dim">
              {s.location === "wan" ? <Globe className="h-3 w-3" /> : <Wifi className="h-3 w-3" />}
              {s.location === "wan" ? t("plexActivity.remote") : t("plexActivity.local")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
  return s.href ? <Link href={s.href} className="block">{body}</Link> : body;
}

function LiveSection({ t }: { t: T }) {
  const plex = usePlexActivity();
  const movviz = useMovvizActivity();
  const sessions: LiveSession[] = useMemo(
    () => [...movviz, ...plex.map((s) => ({ ...s, origin: "plex" as const }))],
    [movviz, plex],
  );
  const transcodes = sessions.filter((s) => s.transcodeDecision === "transcode").length;
  const remote = plex.filter((s) => s.location === "wan").length;
  const bandwidth = plex.reduce((sum, s) => sum + (s.bandwidth || 0), 0);

  return (
    <Card
      title={t("playStats.live")}
      hint={t("playStats.liveHint")}
      icon={Radio}
    >
      <div className="mb-3 flex flex-wrap gap-2">
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-ink-soft">
          {t(sessions.length === 1 ? "playStats.liveStream" : "playStats.liveStreams", { n: sessions.length })}
        </span>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-ink-soft">
          {t("playStats.liveTranscodes", { n: transcodes })}
        </span>
        {plex.length > 0 && (
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-ink-soft">
            {t("playStats.liveRemote", { n: remote })}
            {bandwidth > 0 ? ` · ${(bandwidth / 1000).toFixed(1)} Mbps` : ""}
          </span>
        )}
      </div>
      {sessions.length === 0 ? (
        <p className="rounded-xl bg-white/4 py-8 text-center text-sm text-ink-dim">{t("plexActivity.empty")}</p>
      ) : (
        <div className="grid gap-1 md:grid-cols-2">
          {sessions.map((s, i) => <LiveRow key={`${s.origin}-${s.user}-${s.title}-${i}`} s={s} t={t} />)}
        </div>
      )}
    </Card>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

const PAGE = 50;

export default function StatsPage() {
  const t = useT();
  const { locale } = useI18n();
  const me = useCurrentUser();
  const [period, setPeriod] = useState<StatsPeriod>(30);
  const [source, setSource] = useState("");
  const [userId, setUserId] = useState("");
  const [limit, setLimit] = useState(PAGE);

  const params = new URLSearchParams({ period: String(period), limit: String(limit) });
  if (source) params.set("source", source);
  if (userId) params.set("user", userId);
  const { data, isLoading, error } = useSWR<StatsResult>(me?.role === "admin" ? `/api/playback-stats?${params}` : null, fetcher, {
    refreshInterval: 30_000,
    keepPreviousData: true,
  });

  const weekdayLabels = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: "short" });
    // 2024-01-01 est un lundi.
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 0, 1 + i)));
  }, [locale]);

  const dayData = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
    return (data?.byDay ?? []).map((d) => ({ ...d, label: fmt.format(new Date(`${d.date}T12:00:00`)) }));
  }, [data?.byDay, locale]);

  if (me && me.role !== "admin") {
    return <div className="nx-manage-page mx-auto max-w-[1200px] py-20 text-center text-sm text-ink-dim">{t("playStats.adminOnly")}</div>;
  }

  const totals = data?.totals;
  const delta = totals && period !== 0 && totals.previousPlays > 0
    ? Math.round(((totals.plays - totals.previousPlays) / totals.previousPlays) * 100)
    : null;
  const empty = !isLoading && !error && totals?.plays === 0;
  const modeLabel = (key: string) =>
    key === "DIRECT_PLAY" ? t("plexActivity.directPlay")
    : key === "REMUX" ? t("plexActivity.directStream")
    : key === "DIRECT_STREAM" || key === "TRANSCODE" ? t("plexActivity.transcoding")
    : t("playStats.unknown");
  const platformLabel = (key: string) =>
    key === "web" ? t("playStats.platformWeb")
    : key.startsWith("web:") ? `${t("playStats.platformWeb")} · ${key.slice(4)}`
    : key === "app" ? t("playStats.platformApp")
    : t("playStats.unknown");

  return (
    <div data-manage="stats" className="nx-manage-page mx-auto max-w-[1200px] space-y-5">
      <PageHeader title={t("playStats.title")} description={t("playStats.description")} />

      <LiveSection t={t} />

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-0.5 rounded-2xl glass p-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => { setPeriod(p.value); setLimit(PAGE); }}
              className={cn("rounded-xl px-3 py-2 text-xs font-semibold transition-colors sm:px-3.5", period === p.value ? "brand-gradient text-white shadow-sm" : "text-ink-soft hover:text-ink")}
            >
              {t(p.labelKey)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-0.5 rounded-2xl glass p-1">
          {SOURCES.map((s) => (
            <button
              key={s.value}
              onClick={() => { setSource(s.value); setLimit(PAGE); }}
              className={cn("rounded-xl px-3 py-2 text-xs font-semibold transition-colors sm:px-3.5", source === s.value ? "brand-gradient text-white shadow-sm" : "text-ink-soft hover:text-ink")}
            >
              {t(s.labelKey)}
            </button>
          ))}
        </div>
        <select
          value={userId}
          onChange={(e) => { setUserId(e.target.value); setLimit(PAGE); }}
          aria-label={t("playStats.allUsers")}
          className="rounded-2xl glass px-3.5 py-2.5 text-xs font-semibold text-ink-soft outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
        >
          <option value="">{t("playStats.allUsers")}</option>
          {(data?.users ?? []).map((u) => <option key={u.id} value={u.id}>{u.username}</option>)}
        </select>
      </div>

      {error && <p className="rounded-2xl glass px-5 py-4 text-sm text-down">{t("playStats.loadError")}</p>}

      {isLoading && !data && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl glass" />)}
        </div>
      )}

      {empty && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-3 rounded-2xl glass py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5"><Inbox className="h-7 w-7 text-ink-dim" /></span>
          <p className="font-semibold text-ink">{t("playStats.empty")}</p>
          <p className="max-w-md px-4 text-sm text-ink-dim">{t("playStats.emptyHint")}</p>
        </motion.div>
      )}

      {data && totals && totals.plays > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              icon={Play}
              label={t("playStats.kpiPlays")}
              value={String(totals.plays)}
              sub={delta != null ? t("playStats.vsPrevious", { delta: `${delta > 0 ? "+" : ""}${delta}` }) : `${t("playStats.sourceMovviz")} ${totals.bySource.movviz} · ${t("playStats.sourcePlex")} ${totals.bySource.plex}`}
              tone={delta == null ? undefined : delta >= 0 ? "ok" : "down"}
            />
            <Kpi
              icon={Clock}
              label={t("playStats.kpiTime")}
              value={formatWatchTime(totals.watchedMs)}
              sub={totals.watchedEstimated ? t("playStats.kpiTimeEstimated") : undefined}
            />
            <Kpi icon={UsersIcon} label={t("playStats.kpiUsers")} value={String(totals.users)} />
            <Kpi
              icon={Clapperboard}
              label={t("playStats.kpiSplit")}
              value={`${totals.movies} / ${totals.episodes}`}
              sub={`${t("playStats.movies")} · ${t("playStats.episodes")}`}
            />
          </div>

          <Card
            title={t("playStats.chartDay")}
            icon={BarChart3}
          >
            <div className="mb-3 flex justify-end"><Legend t={t} /></div>
            {period === 0 ? (
              <p className="py-6 text-center text-xs text-ink-dim">{t("playStats.chartAllHint")}</p>
            ) : (
              <StackedBars
                t={t}
                data={dayData}
                labelAt={(i) => dayData.length <= 10 ? true : i % Math.ceil(dayData.length / 6) === 0}
              />
            )}
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card title={t("playStats.chartWeekday")} icon={Activity}>
              <StackedBars t={t} height={112} data={data.byWeekday.map((d, i) => ({ ...d, label: weekdayLabels[i] }))} labelAt={() => true} />
            </Card>
            <Card title={t("playStats.chartHour")} icon={Clock}>
              <StackedBars t={t} height={112} data={data.byHour.map((d, i) => ({ ...d, label: String(i) }))} labelAt={(i) => i % 3 === 0} />
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card title={t("playStats.platforms")} hint={t("playStats.platformsHint")} icon={Monitor}>
              <HBars
                empty={t("playStats.noDetail")}
                rows={data.byPlatform.map((p) => ({ key: p.key, label: platformLabel(p.key), value: p.plays }))}
              />
            </Card>
            <Card title={t("playStats.modes")} hint={t("playStats.modesHint")} icon={Repeat}>
              <HBars
                empty={t("playStats.noDetail")}
                rows={data.byMode.map((m) => ({ key: m.key, label: modeLabel(m.key), value: m.plays }))}
              />
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <Card title={t("playStats.topMovies")} icon={Film}>
              <TopList items={data.topMovies} hrefBase="/title/movie" t={t} />
            </Card>
            <Card title={t("playStats.topSeries")} icon={Tv}>
              <TopList items={data.topSeries} hrefBase="/title/series" t={t} />
            </Card>
            <Card title={t("playStats.topUsers")} icon={Trophy}>
              {data.topUsers.length === 0 ? (
                <p className="py-6 text-center text-xs text-ink-dim">{t("playStats.noDetail")}</p>
              ) : (
                <ol className="space-y-1">
                  {data.topUsers.slice(0, 10).map((u, i) => (
                    <li key={u.userId}>
                      <button
                        onClick={() => { setUserId(u.userId); setLimit(PAGE); }}
                        className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-white/5"
                      >
                        <span className="w-5 text-center text-xs font-black text-ink-dim">{i + 1}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-ink">{u.username}</span>
                          <span className="block truncate text-[11px] text-ink-dim">
                            {formatWatchTime(u.watchedMs)} · {relativeTime(new Date(u.lastAt).toISOString(), locale)}
                          </span>
                        </span>
                        <span className="text-right text-xs tabular-nums text-ink-dim">
                          {u.plays}
                          <span className="ml-1.5 inline-flex gap-1">
                            {u.bySource.movviz > 0 && <span className={SOURCE_TEXT.movviz}>●</span>}
                            {u.bySource.plex > 0 && <span className={SOURCE_TEXT.plex}>●</span>}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </div>

          <Card title={t("playStats.recent")} hint={t("playStats.recentHint")} icon={Smartphone}>
            <ul className="divide-y divide-white/6">
              {data.recent.map((r, i) => (
                <li key={`${r.at}-${r.userId}-${r.tmdbId}-${i}`} className="flex items-start gap-3 py-3">
                  <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/6", SOURCE_TEXT[r.source])}>
                    {r.mediaType === "movie" ? <Film className="h-4 w-4" /> : <Tv className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      {r.tmdbId > 0 ? (
                        <Link href={`/title/${r.mediaType === "movie" ? "movie" : "series"}/${r.tmdbId}`} className="text-sm font-semibold text-ink transition-colors hover:text-brand-glow">
                          {r.title}
                        </Link>
                      ) : (
                        <span className="text-sm font-semibold text-ink">{r.title}</span>
                      )}
                      {r.season != null && r.episode != null && (
                        <span className="text-xs font-semibold text-ink-dim">S{String(r.season).padStart(2, "0")}E{String(r.episode).padStart(2, "0")}</span>
                      )}
                      <SourceBadge source={r.source} t={t} />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-ink-dim">
                      {r.username}
                      {r.platform ? ` · ${platformLabel(r.platform === "web" && r.browser ? `web:${r.browser}` : r.platform)}` : ""}
                      {r.mode ? ` · ${modeLabel(r.mode)}` : ""}
                      {r.playedMs ? ` · ${formatWatchTime(r.playedMs)}` : ""}
                      {r.percent != null ? ` · ${r.percent}%` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-ink-dim" title={formatDate(new Date(r.at).toISOString(), locale) ?? ""}>
                    {relativeTime(new Date(r.at).toISOString(), locale)}
                  </span>
                </li>
              ))}
            </ul>
            {data.recent.length < data.recentTotal && (
              <button
                onClick={() => setLimit((n) => n + PAGE)}
                className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-semibold text-ink-soft transition-colors hover:text-ink"
              >
                {t("playStats.loadMore", { n: data.recentTotal - data.recent.length })}
              </button>
            )}
          </Card>

          <p className="px-1 text-[11px] leading-relaxed text-ink-dim">{t("playStats.mirrorNote")}</p>
        </>
      )}
    </div>
  );
}

function TopList({ items, hrefBase, t }: {
  items: Array<{ tmdbId: number; title: string; plays: number; users: number }>; hrefBase: string; t: T;
}) {
  if (items.length === 0) return <p className="py-6 text-center text-xs text-ink-dim">{t("playStats.noDetail")}</p>;
  return (
    <ol className="space-y-1">
      {items.map((item, i) => (
        <li key={item.tmdbId}>
          <Link href={item.tmdbId > 0 ? `${hrefBase}/${item.tmdbId}` : "#"} aria-disabled={item.tmdbId <= 0}
            onClick={(e) => { if (item.tmdbId <= 0) e.preventDefault(); }}
            className={cn("flex items-center gap-3 rounded-xl px-2 py-2 transition-colors", item.tmdbId > 0 ? "hover:bg-white/5" : "cursor-default")}>
            <span className="w-5 text-center text-xs font-black text-ink-dim">{i + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink">{item.title}</span>
              <span className="block text-[11px] text-ink-dim">{t(item.users === 1 ? "playStats.viewer" : "playStats.viewers", { n: item.users })}</span>
            </span>
            <span className="text-xs tabular-nums text-ink-dim">{item.plays}</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
