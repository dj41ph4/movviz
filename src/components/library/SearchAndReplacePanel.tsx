"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { useT } from "@/i18n/provider";
import { formatBytes } from "@/lib/utils";
import { Loader2, X, ArrowRight, RefreshCw, Check, Languages, Sparkles, Cpu, HardDrive, Tv, EyeOff, Music, Monitor } from "lucide-react";
import { toast } from "@/components/ui/Toast";

interface MovieUpgradeCandidate {
  movieId: string;
  title: string;
  currentVersion: string;
  currentFormatScore: number;
  currentSize: number;
  detectedVersion: string;
  detectedFormatScore: number;
  size: number;
  reasonKey: "languageUpgrade" | "audioCodecUpgrade" | "videoCodecUpgrade" | "customFormatUpgrade" | "codecUpgrade";
  reasonParams?: Record<string, string>;
}

interface EpisodeUpgradeCandidate {
  seriesId: string;
  seriesTitle: string;
  seasonNumber: number;
  episodeNumber: number;
  currentVersion: string;
  currentSize: number;
  detectedVersion: string;
  size: number;
  reasonKey: "languageUpgrade" | "audioCodecUpgrade" | "videoCodecUpgrade";
  reasonParams: { from: string; to: string };
}

/** Single shape both candidate kinds get flattened into for rendering — one row component, not two near-identical ones. */
interface Row {
  key: string;
  kind: "movie" | "episode";
  title: string;
  subtitle?: string;
  currentVersion: string;
  currentSize: number;
  detectedVersion: string;
  size: number;
  reasonKey: "languageUpgrade" | "audioCodecUpgrade" | "videoCodecUpgrade" | "customFormatUpgrade" | "codecUpgrade";
  reasonParams?: Record<string, string>;
  grabUrl: string;
}

function episodeCode(season: number, episode: number): string {
  return `S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`;
}

export function SearchAndReplacePanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [allRows, setAllRows] = useState<Row[]>([]);
  const [visibleRows, setVisibleRows] = useState<Row[]>([]);
  const [grabbing, setGrabbing] = useState<string | null>(null);
  const [grabbed, setGrabbed] = useState<Set<string>>(new Set());
  const revealTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Progressive reveal — items appear one by one every 60ms.
  useEffect(() => {
    if (revealTimer.current) clearInterval(revealTimer.current);
    if (allRows.length === 0) { setVisibleRows([]); return; }
    let i = 0;
    setVisibleRows([allRows[0]]);
    revealTimer.current = setInterval(() => {
      i++;
      if (i >= allRows.length) { clearInterval(revealTimer.current!); return; }
      setVisibleRows((prev) => [...prev, allRows[i]]);
    }, 60);
    return () => { if (revealTimer.current) clearInterval(revealTimer.current); };
  }, [allRows]);

  useEffect(() => {
    if (!open) { setAllRows([]); setVisibleRows([]); return; }
    setGrabbed(new Set());
    setAllRows([]);
    setLoading(true);
    fetch("/api/library/upgrade-candidates", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const movieRows: Row[] = ((d.candidates ?? []) as MovieUpgradeCandidate[]).map((c) => ({
          key: `movie-${c.movieId}`,
          kind: "movie" as const,
          title: c.title,
          currentVersion: c.currentVersion,
          currentSize: c.currentSize,
          detectedVersion: c.detectedVersion,
          size: c.size,
          reasonKey: c.reasonKey,
          reasonParams: c.reasonParams,
          grabUrl: `/api/library/upgrade-candidates/${c.movieId}/grab`,
        }));
        const episodeRows: Row[] = ((d.episodeCandidates ?? []) as EpisodeUpgradeCandidate[]).map((c) => ({
          key: `episode-${c.seriesId}-${c.seasonNumber}-${c.episodeNumber}`,
          kind: "episode" as const,
          title: c.seriesTitle,
          subtitle: episodeCode(c.seasonNumber, c.episodeNumber),
          currentVersion: c.currentVersion,
          currentSize: c.currentSize,
          detectedVersion: c.detectedVersion,
          size: c.size,
          reasonKey: c.reasonKey,
          reasonParams: c.reasonParams,
          grabUrl: `/api/library/upgrade-candidates/episode/${c.seriesId}/${c.seasonNumber}/${c.episodeNumber}/grab`,
        }));
        setAllRows([...movieRows, ...episodeRows]);
      })
      .finally(() => setLoading(false));
  }, [open]);

  const grab = async (row: Row) => {
    setGrabbing(row.key);
    try {
      const res = await fetch(row.grabUrl, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setGrabbed((s) => new Set(s).add(row.key));
        toast("success", t("library.searchAndReplaceGrabbed", { title: row.title }));
      } else {
        toast("error", data.error ?? "Échec du remplacement");
      }
    } catch {
      toast("error", "Moteur injoignable");
    } finally {
      setGrabbing(null);
    }
  };

  const ignore = async (row: Row) => {
    setGrabbing(row.key);
    try {
      await fetch(`/api/library/upgrade-candidates/${row.grabUrl.split("/").slice(-2)[0]}/ignore`, { method: "POST" });
      setAllRows((prev) => prev.filter((r) => r.key !== row.key));
      toast("info", t("library.searchAndReplaceIgnored", { title: row.title }));
    } catch {
      toast("error", "Erreur");
    } finally {
      setGrabbing(null);
    }
  };

  const totalCount = allRows.length;
  const visibleCount = visibleRows.length;
  const progress = totalCount > 0 ? visibleCount / totalCount : 0;

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[8vh] backdrop-blur-sm" onClick={onClose}>
      <div
        className="mx-4 max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-void shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/8 px-6 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-ink">{t("library.searchAndReplace")}</h2>
            <p className="mt-0.5 text-xs text-ink-dim">{t("library.searchAndReplaceHint")}</p>
          </div>
          <button onClick={onClose} aria-label={t("common.close")} className="ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl glass-strong text-ink-dim hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6">
          {loading && (
            <div className="flex flex-col items-center gap-4 py-10">
              <Loader2 className="h-6 w-6 animate-spin text-brand-glow" />
              <p className="text-sm text-ink-dim">{t("library.searchAndReplaceAnalyzing")}</p>
              <div className="h-1 w-48 overflow-hidden rounded-full bg-white/5">
                <motion.div
                  className="h-full rounded-full brand-gradient"
                  animate={{ width: ["0%", "90%", "0%"] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>
            </div>
          )}
          {!loading && totalCount > 0 && visibleCount < totalCount && (
            <div className="mb-4 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink-dim">{t("library.searchAndReplaceProgress", { current: visibleCount, total: totalCount })}</span>
                <span className="font-semibold text-brand-glow">{Math.round(progress * 100)}%</span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-white/5">
                <motion.div className="h-full rounded-full brand-gradient" animate={{ width: `${progress * 100}%` }} transition={{ duration: 0.3, ease: "easeOut" }} />
              </div>
            </div>
          )}
          {!loading && totalCount > 0 && visibleCount >= totalCount && (
            <p className="mb-4 text-center text-xs font-semibold text-ok">{t("library.searchAndReplaceComplete", { count: totalCount })}</p>
          )}

          {!loading && visibleRows.length === 0 && allRows.length === 0 && (
            <p className="py-10 text-center text-sm text-ink-dim">{t("library.searchAndReplaceEmpty")}</p>
          )}

          {(!loading || visibleRows.length > 0) && visibleRows.length > 0 && (
            <div className="space-y-2.5">
              {visibleRows.map((row) => {
                const isGrabbed = grabbed.has(row.key);
                const isLanguageUpgrade = row.reasonKey === "languageUpgrade";
                const isAudioCodecUpgrade = row.reasonKey === "audioCodecUpgrade";
                const isVideoCodecUpgrade = row.reasonKey === "videoCodecUpgrade";
                const isCodecUpgrade = row.reasonKey === "codecUpgrade";
                const sizeDelta = row.size - row.currentSize;
                return (
                  <div key={row.key} className="rounded-xl border border-white/8 bg-black/20 p-3.5 transition-colors hover:border-white/14">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="flex min-w-0 items-center gap-1.5 truncate text-sm font-bold text-ink">
                        {row.kind === "episode" && <Tv className="h-3.5 w-3.5 shrink-0 text-ink-dim" />}
                        <span className="truncate">{row.title}</span>
                        {row.subtitle && (
                          <span className="shrink-0 rounded-md border border-white/10 bg-black/30 px-1.5 py-0.5 font-mono text-[10px] text-ink-dim">{row.subtitle}</span>
                        )}
                      </p>
                      <span
                        className={
                          isLanguageUpgrade
                            ? "inline-flex shrink-0 items-center gap-1 rounded-full border border-cyan/25 bg-cyan/12 px-2 py-0.5 text-[10px] font-bold text-cyan"
                            : isAudioCodecUpgrade
                              ? "inline-flex shrink-0 items-center gap-1 rounded-full border border-ok/25 bg-ok/12 px-2 py-0.5 text-[10px] font-bold text-ok"
                              : isVideoCodecUpgrade
                                ? "inline-flex shrink-0 items-center gap-1 rounded-full border border-blue-400/25 bg-blue-400/12 px-2 py-0.5 text-[10px] font-bold text-blue-400"
                                : isCodecUpgrade
                                  ? "inline-flex shrink-0 items-center gap-1 rounded-full border border-purple/25 bg-purple/12 px-2 py-0.5 text-[10px] font-bold text-purple"
                                  : "inline-flex shrink-0 items-center gap-1 rounded-full border border-brand/25 bg-brand/12 px-2 py-0.5 text-[10px] font-bold text-brand-glow"
                        }
                      >
                        {isLanguageUpgrade ? <Languages className="h-2.5 w-2.5" /> : isAudioCodecUpgrade ? <Music className="h-2.5 w-2.5" /> : isVideoCodecUpgrade ? <Monitor className="h-2.5 w-2.5" /> : isCodecUpgrade ? <Cpu className="h-2.5 w-2.5" /> : <Sparkles className="h-2.5 w-2.5" />}
                        {t(`library.searchAndReplaceReasons.${row.reasonKey}`, row.reasonParams)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                      <span className="rounded-md border border-white/8 bg-black/20 px-2 py-1 font-mono">{row.currentVersion}</span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-dim" />
                      <span className="rounded-md border border-brand/25 bg-brand/12 px-2 py-1 font-mono text-brand-glow">{row.detectedVersion}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-dim">
                      <HardDrive className="h-3 w-3" />
                      <span>{formatBytes(row.currentSize)}</span>
                      <ArrowRight className="h-3 w-3 shrink-0" />
                      <span className="font-semibold text-ink-soft">{formatBytes(row.size)}</span>
                      {sizeDelta !== 0 && (
                        <span className={sizeDelta > 0 ? "text-amber" : "text-ok"}>
                          ({sizeDelta > 0 ? "+" : ""}{formatBytes(Math.abs(sizeDelta))})
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => grab(row)}
                        disabled={grabbing === row.key || isGrabbed}
                        className="mt-3 flex h-8 items-center gap-1.5 rounded-lg brand-gradient px-3 text-xs font-bold text-white transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100">
                        {grabbing === row.key ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : isGrabbed ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          t("library.searchAndReplaceAction")
                        )}
                      </button>
                      {!isGrabbed && (
                        <button
                          onClick={() => ignore(row)}
                          disabled={grabbing === row.key}
                          className="mt-3 flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-black/20 px-3 text-xs font-bold text-ink-dim transition-colors hover:text-ink hover:border-white/20 disabled:opacity-50">
                          <EyeOff className="h-3.5 w-3.5" />
                          {t("library.searchAndReplaceIgnore")}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
