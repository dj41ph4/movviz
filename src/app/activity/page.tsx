"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useActivitySettings } from "@/lib/settings/useActivitySettings";
import { Suspense, useRef, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader } from "@/components/ui/PageHeader";
import { useT } from "@/i18n/provider";
import { cn, formatBytes, formatSpeed, formatEtaMs, relativeTime } from "@/lib/utils";
import type { EngineTorrent, EngineInstance, MediaType } from "@/lib/types";
import type { ActivityEntry } from "@/lib/activity/types";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import {
  Plus, Pause, Play, Trash2, ArrowDownToLine, ArrowUpFromLine,
  Users, Film, Tv, ListOrdered, Magnet, WifiOff, Paperclip, ListX,
  Download, History, Check, X, PackageCheck, AlertCircle, RefreshCw,
} from "lucide-react";

export default function ActivityPage() {
  const { settings, loaded } = useActivitySettings();
  const router = useRouter();

  useEffect(() => {
    if (loaded && settings.version === "v2") {
      router.replace("/activity/v2");
    }
  }, [loaded, settings.version, router]);

  if (!loaded || settings.version === "v2") {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <ActivityPageV1 />
    </Suspense>
  );
}

/** Encode bytes to base64 in chunks (avoids call-stack limits on large files). */
function toBase64(bytes: Uint8Array) {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

const STATE_TONE: Record<EngineTorrent["state"], string> = {
  downloading: "text-cyan bg-cyan/12 border-cyan/25",
  seeding: "text-ok bg-ok/12 border-ok/25",
  completed: "text-ok bg-ok/12 border-ok/25",
  paused: "text-ink-dim bg-white/5 border-white/10",
  queued: "text-amber bg-amber/12 border-amber/25",
  metadata: "text-brand-glow bg-brand/12 border-brand/25",
  stalled: "text-down bg-down/12 border-down/25",
};

const TABS = [
  { id: "downloads", labelKey: "nav.downloads", icon: Download },
  { id: "history", labelKey: "activity.title", icon: History, adminOnly: true },
  { id: "failures", labelKey: "activity.title", icon: AlertCircle, adminOnly: true },
] as const;

function ActivityPageV1() {
  return (
    <Suspense fallback={null}>
      <ActivityPageInner />
    </Suspense>
  );
}

function ActivityPageInner() {
  const t = useT();
  const user = useCurrentUser();
  const params = useSearchParams();
  const visibleTabs = TABS.filter((tb) => !("adminOnly" in tb) || user?.role === "admin");
  const initialTab = visibleTabs.find((tb) => tb.id === params.get("tab"))?.id ?? "downloads";
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>(initialTab);

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader eyebrow={t("discover.eyebrow")} title={t("downloads.title")} description={t("downloads.description")} />

      {visibleTabs.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-1.5">
          {visibleTabs.map((tb) => (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors",
                tab === tb.id ? "brand-gradient text-white shadow-lg" : "glass text-ink-soft hover:text-ink"
              )}
            >
              <tb.icon className="h-4 w-4" />
              {t(tb.labelKey)}
            </button>
          ))}
        </div>
      )}

      {tab === "downloads" && <DownloadsTab />}
      {tab === "history" && user?.role === "admin" && <HistoryTab />}
      {tab === "failures" && user?.role === "admin" && <HistoryTab failuresOnly />}
    </div>
  );
}

function DownloadsTab() {
  const t = useT();
  const user = useCurrentUser();
  const [magnet, setMagnet] = useState("");
  const [category, setCategory] = useState<MediaType>("movie");
  const [adding, setAdding] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);
  const [filter, setFilter] = useState<"all" | "downloading" | "completed" | "stalled">("all");
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: torrentsData, error: torrentsError, mutate: mutateTorrents } = useSWR<{ torrents: EngineTorrent[] }>(
    "/api/engine/torrents", { refreshInterval: 1500 }
  );
  const { data: instancesData, error: instancesError, mutate: mutateInstances } = useSWR<{ instances: EngineInstance[] }>(
    "/api/engine/instances", { refreshInterval: 1500 }
  );
  const torrents = torrentsData?.torrents ?? [];
  const instances = instancesData?.instances ?? [];
  const online = torrentsError || instancesError ? false : torrentsData && instancesData ? true : null;
  const sessionExpired = (torrentsError as { status?: number } | undefined)?.status === 401
    || (instancesError as { status?: number } | undefined)?.status === 401;
  const poll = () => { mutateTorrents(); mutateInstances(); };

  const filtered = torrents.filter((tr) => {
    if (filter === "downloading") return tr.state === "downloading" || tr.state === "metadata" || tr.state === "queued";
    if (filter === "completed") return tr.state === "completed" || tr.state === "seeding";
    if (filter === "stalled") return tr.state === "stalled";
    return true;
  });

  const add = async () => {
    if (!magnet.trim()) return;
    setAdding(true);
    try {
      await fetch("/api/engine/torrents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ torrentId: magnet.trim(), category }),
      });
      setMagnet("");
      poll();
    } finally {
      setAdding(false);
    }
  };

  const addFile = async (file: File) => {
    setAdding(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      await fetch("/api/engine/torrents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ torrentFile: toBase64(bytes), category }),
      });
      poll();
    } finally {
      setAdding(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const action = async (infoHash: string, path: string, method = "POST") => {
    await fetch(`/api/engine/torrents/${infoHash}/${path}`, { method });
    poll();
  };
  const remove = async (infoHash: string, withData: boolean) => {
    if (!confirm(withData ? t("downloads.confirmRemove") : t("downloads.confirmRemoveKeep"))) return;
    await fetch(`/api/engine/torrents/${infoHash}?deleteData=${withData ? 1 : 0}`, { method: "DELETE" });
    poll();
  };

  const clearFinished = async () => {
    if (!confirm(t("downloads.confirmClearFinished"))) return;
    setClearing(true);
    try {
      await fetch("/api/engine/torrents/clear-finished", { method: "POST" });
      poll();
    } finally {
      setClearing(false);
    }
  };

  const clearAll = async () => {
    if (!confirm(t("downloads.confirmClearAll"))) return;
    setClearingAll(true);
    try {
      await fetch("/api/engine/torrents/clear-all", { method: "POST" });
      poll();
    } finally {
      setClearingAll(false);
    }
  };

  const finishedCount = torrents.filter((tr) => tr.state === "completed" || tr.state === "seeding").length;

  return (
    <div>
      {/* Add bar */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 items-center gap-3 rounded-2xl glass px-5 focus-within:border-brand/40">
          <Magnet className="h-5 w-5 text-ink-dim" />
          <input
            value={magnet}
            onChange={(e) => setMagnet(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder={t("downloads.addPlaceholder")}
            className="h-13 flex-1 bg-transparent py-3.5 text-sm text-ink outline-none placeholder:text-ink-dim"
          />
          <input
            ref={fileRef}
            type="file"
            accept=".torrent,application/x-bittorrent"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) addFile(f);
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            title={t("downloads.addFile")}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-dim transition-colors hover:bg-white/5 hover:text-brand-glow"
          >
            <Paperclip className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-1 rounded-2xl glass p-1">
          {(["movie", "series"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
                category === c ? "brand-gradient text-white" : "text-ink-soft hover:text-ink"
              )}
            >
              {c === "movie" ? <Film className="h-4 w-4" /> : <Tv className="h-4 w-4" />}
              {c === "movie" ? t("common.movies") : t("common.series")}
            </button>
          ))}
        </div>
        <button
          onClick={add}
          disabled={adding || !magnet.trim()}
          className="flex h-13 items-center justify-center gap-2 rounded-2xl brand-gradient px-7 py-3.5 text-sm font-bold text-white shadow-xl transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-40"
        >
          <Plus className="h-4 w-4" /> {t("downloads.add")}
        </button>
      </div>

      {/* Instance summary */}
      {online && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {instances.map((i) => (
            <div key={i.id} className="flex items-center gap-4 rounded-2xl glass p-4">
              <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl", i.category === "movie" ? "bg-brand/12 text-brand-glow" : "bg-cyan/12 text-cyan")}>
                {i.category === "movie" ? <Film className="h-5 w-5" /> : <Tv className="h-5 w-5" />}
              </span>
              <div className="flex-1">
                <h3 className="font-bold text-ink">{i.name}</h3>
                <p className="text-xs text-ink-dim">{i.total} torrents · {i.active} {t("status.downloading").toLowerCase()} · {i.seeding} {t("status.available").toLowerCase()}</p>
              </div>
              <div className="text-right text-xs">
                <p className="flex items-center justify-end gap-1 font-semibold text-cyan"><ArrowDownToLine className="h-3 w-3" />{formatSpeed(i.downloadSpeed)}</p>
                <p className="flex items-center justify-end gap-1 text-ink-dim"><ArrowUpFromLine className="h-3 w-3" />{formatSpeed(i.uploadSpeed)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Engine offline / session expired */}
      {online === false && (
        <div className="flex flex-col items-center gap-3 rounded-2xl glass py-16 text-center">
          <WifiOff className="h-8 w-8 text-down" />
          {sessionExpired ? (
            <>
              <p className="font-semibold text-ink">{t("downloads.sessionExpired")}</p>
              <Link href="/login" className="mt-1 rounded-xl brand-gradient px-4 py-2 text-sm font-bold text-white">
                {t("downloads.sessionExpiredCta")}
              </Link>
            </>
          ) : (
            <>
              <p className="font-semibold text-ink">{t("downloads.engineOffline")}</p>
              <p className="max-w-md text-sm text-ink-dim">{t("downloads.engineOfflineHint")}</p>
            </>
          )}
        </div>
      )}

      {/* Torrent list */}
      {online && (
        <div className="space-y-3">
          {/* Filter tabs */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex gap-1 rounded-xl glass p-0.5">
              {(["all", "downloading", "completed", "stalled"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                    filter === f ? "brand-gradient text-white shadow" : "text-ink-dim hover:text-ink"
                  )}
                >
                  {t(`downloads.filter.${f}`)}
                  {f === "stalled" && torrents.filter((tr) => tr.state === "stalled").length > 0 && (
                    <span className="ml-1.5 rounded-full bg-down/20 px-1.5 py-0.5 text-[10px] text-down">
                      {torrents.filter((tr) => tr.state === "stalled").length}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {finishedCount > 0 && (
                <button
                  onClick={clearFinished}
                  disabled={clearing}
                  title={t("downloads.clearFinishedHint")}
                  className="flex items-center gap-2 rounded-xl glass px-3.5 py-2 text-xs font-semibold text-ink-soft transition-colors hover:text-ink disabled:opacity-50"
                >
                  <ListX className="h-3.5 w-3.5" /> {t("downloads.clearFinished")}
                </button>
              )}
              {user?.role === "admin" && torrents.length > 0 && (
                <button
                  onClick={clearAll}
                  disabled={clearingAll}
                  title={t("downloads.clearAllHint")}
                  className="flex items-center gap-2 rounded-xl glass px-3.5 py-2 text-xs font-semibold text-down transition-colors hover:bg-down/10 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" /> {t("downloads.clearAll")}
                </button>
              )}
            </div>
          </div>
          <AnimatePresence mode="popLayout">
            {filtered.map((tr) => (
              <motion.div
                key={tr.infoHash}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="rounded-2xl glass p-4"
              >
                <div className="flex items-start gap-3">
                  <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", tr.category === "movie" ? "bg-brand/12 text-brand-glow" : "bg-cyan/12 text-cyan")}>
                    {tr.category === "movie" ? <Film className="h-4 w-4" /> : <Tv className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-semibold text-ink">{tr.name}</h3>
                      <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold", STATE_TONE[tr.state])}>
                        {t(`downloads.states.${tr.state}`)}
                      </span>
                      {tr.sequential && (
                        <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-semibold text-ink-dim">
                          <ListOrdered className="mr-1 inline h-3 w-3" />{t("downloads.seq")}
                        </span>
                      )}
                    </div>

                    {/* Progress */}
                    <div className="mt-2 flex items-center gap-3">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/40">
                        <div className={cn("h-full rounded-full", tr.state === "stalled" ? "bg-down" : tr.state === "seeding" || tr.state === "completed" ? "bg-ok" : "brand-gradient")} style={{ width: `${Math.round(tr.progress * 100)}%` }} />
                      </div>
                      <span className="w-12 text-right text-xs font-semibold text-ink-soft">{((tr.progress ?? 0) * 100).toFixed(1)}%</span>
                    </div>

                    {/* Stats */}
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-dim">
                      <span>{formatBytes(tr.downloaded)} / {formatBytes(tr.size)}</span>
                      <span className="flex items-center gap-1 text-cyan"><ArrowDownToLine className="h-3 w-3" />{formatSpeed(tr.downloadSpeed)}</span>
                      <span className="flex items-center gap-1"><ArrowUpFromLine className="h-3 w-3" />{formatSpeed(tr.uploadSpeed)}</span>
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{tr.numPeers} {t("downloads.peers")}</span>
                      <span>{t("downloads.ratio")} {(tr.ratio ?? 0).toFixed(2)}</span>
                      <span>{t("downloads.eta")} {formatEtaMs(tr.timeRemaining)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 gap-1.5">
                    {tr.state === "paused" ? (
                      <IconBtn onClick={() => action(tr.infoHash, "resume")} title={t("downloads.resume")}><Play className="h-4 w-4" /></IconBtn>
                    ) : tr.state !== "completed" && tr.state !== "seeding" ? (
                      <IconBtn onClick={() => action(tr.infoHash, "pause")} title={t("downloads.pause")}><Pause className="h-4 w-4" /></IconBtn>
                    ) : null}
                    {tr.state === "stalled" && (
                      <IconBtn onClick={() => action(tr.infoHash, "restart")} title={t("downloads.restart")}><RefreshCw className="h-4 w-4" /></IconBtn>
                    )}
                    <IconBtn onClick={() => remove(tr.infoHash, false)} title={t("downloads.remove")} danger><Trash2 className="h-4 w-4" /></IconBtn>
                    <IconBtn onClick={() => remove(tr.infoHash, true)} title={t("downloads.removeData")} danger><Trash2 className="h-4 w-4" /> <X className="h-3 w-3" /></IconBtn>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {filtered.length === 0 && (
            <div className="rounded-2xl glass py-16 text-center text-sm text-ink-dim">{t("downloads.empty")}</div>
          )}
        </div>
      )}
    </div>
  );
}

function IconBtn({ children, onClick, title, danger }: { children: React.ReactNode; onClick: () => void; title: string; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-xl glass transition-colors",
        danger ? "hover:bg-down/15 hover:text-down" : "hover:bg-brand/15 hover:text-brand-glow"
      )}
    >
      {children}
    </button>
  );
}

const KIND_ICON: Record<ActivityEntry["kind"], React.ElementType> = {
  added: Plus,
  approved: Check,
  declined: X,
  removed: Trash2,
  grabbed: Download,
  imported: PackageCheck,
  failed: AlertCircle,
  upgraded: Download,
};
const KIND_TONE: Record<ActivityEntry["kind"], string> = {
  added: "text-brand-glow bg-brand/12",
  approved: "text-ok bg-ok/12",
  declined: "text-down bg-down/12",
  removed: "text-down bg-down/12",
  grabbed: "text-cyan bg-cyan/12",
  imported: "text-ok bg-ok/12",
  failed: "text-down bg-down/12",
  upgraded: "text-brand-glow bg-brand/12",
};

const KIND_LABEL: Record<ActivityEntry["kind"], string> = {
  added: "added",
  approved: "approved",
  declined: "declined",
  removed: "removed",
  grabbed: "grabbed",
  imported: "imported",
  failed: "failed",
  upgraded: "upgraded",
};

function HistoryTab({ failuresOnly = false }: { failuresOnly?: boolean }) {
  const t = useT();
  const { data } = useSWR<{ entries: ActivityEntry[] }>("/api/activity");
  const entries = (data?.entries ?? []).filter((entry) => !failuresOnly || entry.kind === "failed");

  return (
    <div className="mx-auto max-w-[900px] space-y-1.5">
      {entries.map((e) => {
        const Icon = KIND_ICON[e.kind];
        const content = (
          <div className="flex items-center gap-3 rounded-xl glass px-4 py-3">
            <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", KIND_TONE[e.kind])}>
              <Icon className="h-4 w-4" />
            </span>
            <p className="min-w-0 flex-1 truncate text-sm text-ink-soft">
              <span className="font-semibold text-ink">{e.actor}</span> {t("activity.kinds." + KIND_LABEL[e.kind])} <span className="font-semibold text-ink">{e.subject}</span>
            </p>
            {e.details?.error && <span className="max-w-56 truncate text-xs text-down">{e.details.error}</span>}
            <span className="shrink-0 text-xs text-ink-dim">{relativeTime(new Date(e.createdAt).toISOString())}</span>
          </div>
        );
        return e.href ? <Link key={e.id} href={e.href}>{content}</Link> : <div key={e.id}>{content}</div>;
      })}
      {entries.length === 0 && <div className="rounded-2xl glass py-16 text-center text-ink-dim">{t("activity.empty")}</div>}
    </div>
  );
}