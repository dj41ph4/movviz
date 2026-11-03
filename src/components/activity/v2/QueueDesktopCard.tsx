"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Film, Tv, Pause, Play, Search, Trash2, ChevronDown, Loader, Copy, Check, RefreshCw, Ban, Share2, X, AlertCircle,
} from "lucide-react";
import { activityTitle, activitySeason, activityEpisode } from "@/lib/activity/v2/types";
import type { QueueItem } from "@/lib/activity/v2/types";
import { cn, formatBytes, formatSpeed, formatEta, formatDateTime } from "@/lib/utils";
import { parseRelease } from "@/lib/naming/parser";
import { TmdbImage } from "@/components/media/TmdbImage";

const pad = (n: number) => String(n).padStart(2, "0");

type Action = "pause" | "resume" | "restart" | "retry" | "search" | "block";
type Translate = (k: string, params?: Record<string, string | number>) => string;

interface Props {
  item: QueueItem;
  isExpanded: boolean;
  actionLoading: string | null;
  t: Translate;
  locale: string;
  progress: number;
  canManage: boolean;
  onToggleExpand: (id: string) => void;
  onAction: (id: string, action: Action) => void;
  onSetPriority: (id: string, priority: "high" | "medium" | "low") => void;
  onToggleSeed: (id: string, turnOn: boolean) => void;
  onRemove: (id: string, withData: boolean) => void;
}

/** Couleur de la barre latérale, de la barre de progression et de la pastille d'état. */
const TONES: Record<string, { bar: string; fill: string; pill: string; card: string }> = {
  active: { bar: "bg-brand-glow", fill: "brand-gradient", pill: "border-ok/35 bg-ok/10 text-ok", card: "border-white/8" },
  stalled: { bar: "bg-amber", fill: "bg-gradient-to-r from-amber to-orange-500", pill: "border-amber/40 bg-amber/12 text-amber", card: "border-amber/30 bg-gradient-to-r from-amber/10 to-transparent" },
  paused: { bar: "bg-ink-dim", fill: "bg-ink-dim", pill: "border-white/15 bg-white/8 text-ink-soft", card: "border-white/8" },
  queued: { bar: "bg-cyan", fill: "bg-cyan/70", pill: "border-cyan/30 bg-cyan/10 text-cyan", card: "border-white/8" },
  done: { bar: "bg-ok", fill: "bg-ok", pill: "border-ok/35 bg-ok/10 text-ok", card: "border-white/8" },
};

function toneOf(status: QueueItem["status"]) {
  if (status === "stalled") return TONES.stalled;
  if (status === "paused") return TONES.paused;
  if (status === "queued") return TONES.queued;
  if (status === "seeding" || status === "completed") return TONES.done;
  return TONES.active;
}

function CopyButton({ value, label, copiedLabel }: { value: string; label: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          timer.current = setTimeout(() => setCopied(false), 1500);
        });
      }}
      title={copied ? copiedLabel : label}
      aria-label={copied ? copiedLabel : label}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-dim transition-colors hover:bg-white/10 hover:text-ink"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-ok" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

const roundBtn = "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[.06] text-brand-glow transition-colors hover:border-brand/50 hover:bg-brand/30 hover:text-white disabled:opacity-40";

/** Carte de file d'attente (desktop) : état lisible d'un coup d'œil, nom du
 *  fichier visible, détails (chemin, hash, fichiers, transfert) au clic. */
export function QueueDesktopCard({
  item, isExpanded, actionLoading, t, locale, progress, canManage,
  onToggleExpand, onAction, onSetPriority, onToggleSeed, onRemove,
}: Props) {
  const tone = toneOf(item.status);
  const parsed = parseRelease(item.release.releaseTitle);
  const isActive = item.status === "downloading" || item.status === "importing" || item.status === "verifying";
  const finished = item.status === "completed" || item.status === "seeding";
  // Téléchargement complet dont l'import en bibliothèque est refusé : le
  // torrent est sain (il continue d'envoyer), ce n'est pas une source morte.
  const importPending = item.status === "stalled" && !!item.replacementFailure && progress >= 1;
  const stalled = item.status === "stalled" && !importPending;
  const pct = finished ? 100 : Math.round(progress * 100);
  const season = activitySeason(item.media);
  const episode = activityEpisode(item.media);
  const episodeTag = item.media.isCompleteSeriesPack
    ? t("search.fullPack")
    : season != null ? (episode != null ? `S${pad(season)}E${pad(episode)}` : `S${pad(season)}`) : null;
  const pills = [episodeTag, parsed.resolution, parsed.source, parsed.videoCodec, parsed.audioCodec, parsed.hdr, formatBytes(item.release.size), item.release.indexer && item.release.indexer !== "Inconnu" ? item.release.indexer : null]
    .filter(Boolean) as string[];
  const statusLabel = importPending ? t("downloads.importPending") : stalled ? t("downloads.waitingSources") : t(`activity.status.${item.status}`);
  const busy = actionLoading !== null;
  const loadingKey = (a: string) => actionLoading === `${a}_${item.id}`;
  const stats: { label: string; value: string }[] = finished
    ? [
        { label: t("downloads.up"), value: item.download.uploadSpeed > 0 ? formatSpeed(item.download.uploadSpeed) : "—" },
        { label: t("downloads.ratio"), value: item.download.ratio.toFixed(2) },
        { label: t("downloads.peers"), value: item.download.peers > 0 ? String(item.download.peers) : "—" },
      ]
    : [
        { label: t("downloads.down"), value: item.download.downloadSpeed > 0 ? formatSpeed(item.download.downloadSpeed) : "—" },
        { label: t("downloads.etaShort"), value: item.status === "downloading" && item.download.eta > 0 ? formatEta(Math.round(item.download.eta / 60)) : "—" },
        { label: t("downloads.colSources"), value: item.download.peers > 0 ? String(item.download.peers) : "—" },
      ];
  const priority = item.priority ?? "medium";

  return (
    <div
      data-status={item.status}
      className={cn("nx-dlq-card group relative hidden overflow-hidden rounded-3xl border bg-white/[.035] transition-colors hover:border-brand/40 hover:bg-white/[.06] lg:block", tone.card, isExpanded && "border-brand/40 bg-white/[.06]")}
    >
      <span aria-hidden className={cn("absolute bottom-[18px] left-0 top-[18px] w-[3px] rounded-r-full", tone.bar)} />
      <div
        className="grid cursor-pointer grid-cols-[76px_minmax(0,1fr)_auto] items-center gap-5 p-3.5 pr-4 xl:grid-cols-[76px_minmax(0,1fr)_20.5rem_auto]"
        onClick={() => onToggleExpand(item.id)}
      >
        {item.media.linked === false ? (
          <span className="flex h-[108px] w-[76px] items-center justify-center overflow-hidden rounded-2xl bg-white/5 text-ink-dim shadow-[0_14px_28px_-12px_#000]" title={t("activity.queueUnlinkedHint")}>
            {item.media.posterPath ? <TmdbImage path={item.media.posterPath} size="w154" alt="" className="h-full w-full object-cover" /> : item.media.type === "movie" ? <Film className="h-5 w-5" /> : <Tv className="h-5 w-5" />}
          </span>
        ) : (
          <Link href={item.media.href ?? "#"} onClick={(e) => e.stopPropagation()} className="flex h-[108px] w-[76px] items-center justify-center overflow-hidden rounded-2xl bg-white/5 text-ink-dim shadow-[0_14px_28px_-12px_#000]">
            {item.media.posterPath ? <TmdbImage path={item.media.posterPath} size="w154" alt="" className="h-full w-full object-cover" /> : item.media.type === "movie" ? <Film className="h-5 w-5" /> : <Tv className="h-5 w-5" />}
          </Link>
        )}

        <div className="min-w-0">
          {item.media.linked === false ? (
            <p className="truncate text-base font-bold text-ink" title={t("activity.queueUnlinkedHint")}>{item.media.title}</p>
          ) : (
            <Link href={item.media.href ?? "#"} onClick={(e) => e.stopPropagation()} className="block truncate text-base font-bold text-ink hover:text-brand-glow">{activityTitle(item.media)}</Link>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold", tone.pill)}>
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_8px_currentColor]" />
              {statusLabel}
            </span>
            {pills.map((p, i) => <span key={`${p}-${i}`} className="rounded-full border border-white/12 bg-white/5 px-2.5 py-0.5 text-[11px] font-bold text-ink-soft">{p}</span>)}
            {item.media.linked === false && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber/25 bg-amber/12 px-2 py-0.5 text-[10px] font-bold text-amber">
                <AlertCircle className="h-2.5 w-2.5" /> {t("activity.queueUnlinkedBadge")}
              </span>
            )}
          </div>
          <div className="mt-2 flex min-w-0 items-center gap-1">
            <code className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-ink-dim" title={item.release.releaseTitle}>{item.release.releaseTitle}</code>
            <CopyButton value={item.release.releaseTitle} label={t("downloads.copy")} copiedLabel={t("downloads.copied")} />
          </div>
          <div className="mt-2.5 flex items-center gap-3">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/10 shadow-[inset_0_1px_2px_rgba(0,0,0,.5)]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className={cn("h-full rounded-full transition-[width] duration-700 ease-out", tone.fill, isActive && "shadow-[0_0_14px_rgba(124,92,255,.6)]")} style={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%` }} />
            </div>
            <span className="w-11 text-right text-sm font-extrabold tabular-nums text-ink">{pct} %</span>
          </div>
          {importPending && item.replacementFailure && (
            <div className="mt-3 flex items-center gap-2.5 rounded-2xl border border-amber/25 bg-amber/10 py-2 pl-3.5 pr-3.5 text-sm font-semibold text-amber-100" onClick={(e) => e.stopPropagation()}>
              <span className="min-w-0 flex-1">{t("downloads.importPendingHint")} · {t(`downloads.replacement.${item.replacementFailure.reason}`)}</span>
            </div>
          )}
          {stalled && (
            <div className="mt-3 flex items-center gap-2.5 rounded-2xl border border-amber/25 bg-amber/10 py-2 pl-3.5 pr-2 text-sm font-semibold text-amber-100" onClick={(e) => e.stopPropagation()}>
              <span className="min-w-0 flex-1">{t("downloads.noSources")}</span>
              <button type="button" onClick={() => onAction(item.id, "restart")} disabled={busy} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-amber/40 bg-amber/15 px-3.5 text-xs font-bold text-amber-50 transition-colors hover:bg-amber/30 disabled:opacity-50">
                {loadingKey("restart") ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}{t("downloads.restart")}
              </button>
              <button type="button" onClick={() => onAction(item.id, "search")} disabled={busy} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-amber/40 bg-amber/15 px-3.5 text-xs font-bold text-amber-50 transition-colors hover:bg-amber/30 disabled:opacity-50">
                <Search className="h-3.5 w-3.5" />{t("downloads.replace")}
              </button>
            </div>
          )}
        </div>

        <div className="col-span-full row-start-2 grid grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1fr)] gap-1.5 xl:col-span-1 xl:row-start-auto">
          {stats.map((s) => (
            <div key={s.label} className="min-w-0 rounded-2xl border border-white/5 bg-black/25 px-3 py-2">
              <p className="truncate text-[10px] font-bold uppercase tracking-[.07em] text-ink-dim">{s.label}</p>
              <p className="mt-0.5 truncate text-sm font-bold tabular-nums text-ink">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {(item.status === "downloading" || item.status === "paused" || item.status === "queued") && (
            <button type="button" onClick={() => onAction(item.id, item.status === "downloading" ? "pause" : "resume")} disabled={busy} title={item.status === "downloading" ? t("downloads.pause") : item.status === "queued" ? t("downloads.startNow") : t("downloads.resume")} aria-label={item.status === "downloading" ? t("downloads.pause") : t("downloads.resume")} className={roundBtn}>
              {loadingKey("pause") || loadingKey("resume") ? <Loader className="h-4 w-4 animate-spin" /> : item.status === "downloading" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
          )}
          {(item.status === "downloading" || item.status === "paused" || stalled) && (
            <button type="button" onClick={() => onAction(item.id, "search")} disabled={busy} title={stalled ? t("downloads.replace") : t("downloads.manual")} aria-label={stalled ? t("downloads.replace") : t("downloads.manual")} className={roundBtn}>
              <Search className="h-4 w-4" />
            </button>
          )}
          <button type="button" onClick={() => onRemove(item.id, false)} disabled={busy} title={t("downloads.remove")} aria-label={t("downloads.remove")} className={cn(roundBtn, "text-ink-soft hover:border-down/50 hover:bg-down/30")}>
            {loadingKey("remove") ? <Loader className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
          <button type="button" onClick={() => onToggleExpand(item.id)} aria-expanded={isExpanded} title={t("common.details")} aria-label={t("common.details")} className={cn(roundBtn, "text-ink-soft")}>
            <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isExpanded && "rotate-180")} />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="grid grid-cols-2 gap-x-8 gap-y-5 border-t border-white/8 bg-black/20 p-5" onClick={(e) => e.stopPropagation()}>
          <section className="min-w-0">
            <h4 className="mb-2.5 text-[11px] font-bold uppercase tracking-[.08em] text-ink-dim">{t("downloads.fileName")}</h4>
            <div className="flex items-start gap-1">
              <code className="min-w-0 flex-1 break-all font-mono text-xs leading-relaxed text-ink">{item.release.releaseTitle}</code>
              <CopyButton value={item.release.releaseTitle} label={t("downloads.copy")} copiedLabel={t("downloads.copied")} />
            </div>
            <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-xs">
              <dt className="text-ink-dim">{t("search.size")}</dt><dd className="text-ink">{formatBytes(item.release.size)}</dd>
              <dt className="text-ink-dim">{t("filters.quality")}</dt><dd className="text-ink">{item.release.quality}</dd>
              <dt className="text-ink-dim">{t("search.indexer")}</dt><dd className="text-ink">{item.release.indexer}</dd>
              <dt className="text-ink-dim">{t("search.score")}</dt><dd className="text-ink">{item.release.score}</dd>
              <dt className="text-ink-dim">{t("activity.addedAt")}</dt><dd className="text-ink">{formatDateTime(item.addedAt, locale)}</dd>
              {item.release.customFormats.length > 0 && (<><dt className="text-ink-dim">{t("customFormats.title")}</dt><dd className="text-ink">{item.release.customFormats.join(", ")}</dd></>)}
            </dl>
          </section>

          <section className="min-w-0">
            <h4 className="mb-2.5 text-[11px] font-bold uppercase tracking-[.08em] text-ink-dim">{t("downloads.transfer")}</h4>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-xs">
              <dt className="text-ink-dim">{t("downloads.down")}</dt><dd className="tabular-nums text-ink">{formatSpeed(item.download.downloadSpeed)}{item.download.downloaded != null && <span className="text-ink-dim"> · {formatBytes(item.download.downloaded)}</span>}</dd>
              <dt className="text-ink-dim">{t("downloads.up")}</dt><dd className="tabular-nums text-ink">{formatSpeed(item.download.uploadSpeed)}{item.download.uploaded != null && <span className="text-ink-dim"> · {formatBytes(item.download.uploaded)}</span>}</dd>
              <dt className="text-ink-dim">{t("downloads.ratio")}</dt><dd className="tabular-nums text-ink">{item.download.ratio.toFixed(2)}</dd>
              <dt className="text-ink-dim">{t("downloads.peers")}</dt><dd className="tabular-nums text-ink">{item.download.peers}</dd>
              {item.download.infoHash && (<><dt className="text-ink-dim">{t("downloads.infoHash")}</dt><dd className="flex min-w-0 items-center gap-1"><code className="min-w-0 truncate font-mono text-[11px] text-ink" title={item.download.infoHash}>{item.download.infoHash}</code><CopyButton value={item.download.infoHash} label={t("downloads.copy")} copiedLabel={t("downloads.copied")} /></dd></>)}
              {item.download.savePath && (<><dt className="text-ink-dim">{t("downloads.savePath")}</dt><dd className="flex min-w-0 items-center gap-1"><code className="min-w-0 truncate font-mono text-[11px] text-ink" title={item.download.savePath}>{item.download.savePath}</code><CopyButton value={item.download.savePath} label={t("downloads.copy")} copiedLabel={t("downloads.copied")} /></dd></>)}
            </dl>
          </section>

          {item.download.files && item.download.files.length > 0 && (
            <section className="col-span-2 min-w-0">
              <h4 className="mb-2.5 text-[11px] font-bold uppercase tracking-[.08em] text-ink-dim">{t("downloads.files")} · {item.download.fileCount ?? item.download.files.length}</h4>
              <ul className="space-y-1">
                {item.download.files.map((f) => (
                  <li key={f.name} className="flex items-center gap-3 rounded-xl bg-white/[.04] px-3 py-1.5 text-xs">
                    <code className="min-w-0 flex-1 truncate font-mono text-ink-soft" title={f.name}>{f.name}</code>
                    <span className="shrink-0 tabular-nums text-ink-dim">{formatBytes(f.length)}</span>
                    <span className="w-10 shrink-0 text-right font-bold tabular-nums text-ink">{Math.round(f.progress * 100)} %</span>
                  </li>
                ))}
                {(item.download.fileCount ?? 0) > item.download.files.length && (
                  <li className="px-3 text-xs text-ink-dim">{t("downloads.moreFiles", { n: (item.download.fileCount ?? 0) - item.download.files.length })}</li>
                )}
              </ul>
            </section>
          )}

          <div className="col-span-2 flex flex-wrap items-center gap-2 border-t border-white/8 pt-4">
            {canManage && (item.status === "downloading" || item.status === "paused" || item.status === "stalled" || item.status === "queued") && (
              <div className="mr-2 flex items-center gap-1 rounded-full bg-black/30 p-1" role="group" aria-label={t("downloads.priorityLabel")}>
                {(["high", "medium", "low"] as const).map((p) => (
                  <button key={p} type="button" onClick={() => onSetPriority(item.id, p)} aria-pressed={priority === p} className={cn("min-h-8 rounded-full px-3.5 text-xs font-semibold transition-colors", priority === p ? "brand-gradient text-white" : "text-ink-soft hover:text-ink")}>
                    {t(`downloads.priority.${p}`)}
                  </button>
                ))}
              </div>
            )}
            {(item.status === "completed" || (item.status === "seeding" && item.seeding) || item.seedStatus?.state === "verifying") && canManage && (
              <button type="button" onClick={() => onToggleSeed(item.id, !item.seeding && item.seedStatus?.state !== "verifying")} disabled={busy} className="inline-flex h-9 items-center gap-2 rounded-full border border-white/12 bg-white/6 px-4 text-xs font-semibold text-ink-soft transition-colors hover:bg-white/12 hover:text-ink disabled:opacity-40">
                {loadingKey("seed") ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
                {item.seeding || item.seedStatus?.state === "verifying" ? t("downloads.unseed") : t("downloads.seed")}
              </button>
            )}
            {stalled && (
              <button type="button" onClick={() => onAction(item.id, "restart")} disabled={busy} className="inline-flex h-9 items-center gap-2 rounded-full border border-white/12 bg-white/6 px-4 text-xs font-semibold text-ink-soft transition-colors hover:bg-white/12 hover:text-ink disabled:opacity-40">
                <RefreshCw className="h-3.5 w-3.5" />{t("downloads.restart")}
              </button>
            )}
            <span className="flex-1" />
            {canManage && (
              <button type="button" onClick={() => onAction(item.id, "block")} disabled={busy} className="inline-flex h-9 items-center gap-2 rounded-full border border-down/30 bg-down/10 px-4 text-xs font-semibold text-down transition-colors hover:bg-down/20 disabled:opacity-40">
                {loadingKey("block") ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}{t("blockedTorrents.block")}
              </button>
            )}
            <button type="button" onClick={() => onRemove(item.id, true)} disabled={busy} className="inline-flex h-9 items-center gap-2 rounded-full border border-down/30 bg-down/10 px-4 text-xs font-semibold text-down transition-colors hover:bg-down/20 disabled:opacity-40">
              <Trash2 className="h-3.5 w-3.5" /><X className="-ml-1.5 h-3 w-3" />{t("downloads.removeData")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
