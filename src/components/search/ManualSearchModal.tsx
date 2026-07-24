"use client";

import { useEffect, useMemo, useState } from "react";
import { cn, formatBytes, relativeTime } from "@/lib/utils";
import { useT } from "@/i18n/provider";
import type { IndexerRelease } from "@/lib/indexers/types";
import {
  Search, Magnet, Server, Download, Loader2, Check, X, Settings, AlertTriangle,
} from "lucide-react";
import Link from "next/link";

export function ManualSearchModal({
  open, onClose, libraryRef, query, category, refTitle, year, title, tmdbId, imdbId,
}: {
  open: boolean;
  onClose: () => void;
  libraryRef: string;
  query: string;
  category: "movie" | "series";
  refTitle: string;
  year?: string;
  title: string;
  tmdbId?: number;
  imdbId?: string;
}) {
  const t = useT();
  const [releases, setReleases] = useState<IndexerRelease[]>([]);
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [grabbing, setGrabbing] = useState<string | null>(null);
  const [grabbed, setGrabbed] = useState<Set<string>>(new Set());
  const [indexerErrors, setIndexerErrors] = useState<{ indexer: string; detail: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    setReleases([]);
    setConfigured(null);
    setGrabbed(new Set());
    setGrabbing(null);
    setIndexerErrors([]);
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const run = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const p = new URLSearchParams({ q: query.trim(), category });
      if (refTitle) p.set("refTitle", refTitle);
      if (year) p.set("year", year);
      if (tmdbId) p.set("tmdbId", String(tmdbId));
      if (imdbId) p.set("imdbId", imdbId);
      const res = await fetch(`/api/indexers/search?${p.toString()}`, { cache: "no-store" });
      const data = await res.json();
      setConfigured(data.configured);
      setReleases(data.releases ?? []);
      setIndexerErrors(data.errors ?? []);
    } catch {
      setConfigured(false);
      setReleases([]);
      setIndexerErrors([]);
    } finally {
      setLoading(false);
    }
  };

  const grab = async (r: IndexerRelease) => {
    setGrabbing(r.guid);
    const quality = (r.title.match(/\b(4320p|2160p|1080p|720p|480p)\b/i)?.[0]?.toLowerCase() ?? "Inconnue");
    try {
      const res = await fetch("/api/indexers/grab", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          magnetUrl: r.magnetUrl,
          downloadUrl: r.downloadUrl,
          indexerId: r.indexerId,
          category,
          libraryRef,
          title: refTitle,
          year: year ? Number(year) : null,
          indexerName: r.indexer,
          quality,
          score: r.score,
          size: r.size,
          protocol: r.protocol,
          seeders: r.seeders,
          leechers: r.leechers,
        }),
      });
      if (res.ok) setGrabbed((s) => new Set(s).add(r.guid));
    } finally {
      setGrabbing(null);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[8vh] backdrop-blur-sm" onClick={onClose}>
      <div
        className="mx-4 max-h-[80vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/10 bg-void shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/8 px-6 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-ink">{t("search.manualFor", { title })}</h2>
          </div>
          <button onClick={onClose} aria-label={t("common.close")} className="ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl glass-strong text-ink-dim hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {indexerErrors.length > 0 && (
            <div className="mb-4 flex flex-col gap-1.5 rounded-xl border border-down/25 bg-down/10 px-4 py-2.5 text-sm text-down">
              {indexerErrors.map((e) => (
                <div key={e.indexer} className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span><strong>{e.indexer}</strong> — {e.detail}</span>
                </div>
              ))}
            </div>
          )}

          {configured === false && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <Settings className="h-7 w-7 text-brand-glow" />
              <p className="font-semibold text-ink">{t("search.noIndexers")}</p>
              <p className="text-sm text-ink-dim">{t("search.noIndexersHint")}</p>
              <Link href="/settings" className="mt-1 rounded-xl brand-gradient px-4 py-2 text-sm font-bold text-white" onClick={onClose}>
                {t("search.goToSettings")}
              </Link>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center gap-2 py-12 text-ink-dim">
              <Loader2 className="h-5 w-5 animate-spin" /> {t("search.searching")}
            </div>
          )}

          {!loading && configured !== false && releases.length > 0 && (
            <div className="space-y-1">
              {releases.map((r) => (
                <div key={r.guid} className="flex items-center gap-3 rounded-xl border border-white/5 bg-black/20 px-4 py-3 transition-colors hover:bg-white/[0.03]">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", r.protocol === "torrent" ? "bg-cyan/12 text-cyan" : "bg-brand/12 text-brand-glow")}>
                      {r.protocol === "torrent" ? <Magnet className="h-4 w-4" /> : <Server className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm text-ink">{r.title}</p>
                      <div className="flex items-center gap-3 text-[11px] text-ink-dim">
                        <span>{r.indexer}</span>
                        <span>{r.publishDate ? relativeTime(r.publishDate) : "—"}</span>
                        <span>{formatBytes(r.size)}</span>
                        {r.seeders != null && <span>{r.seeders} ↑</span>}
                        <span className={cn("font-bold", r.score >= 90 ? "text-ok" : r.score >= 75 ? "text-amber" : "text-ink-soft")}>
                          {r.score}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => grab(r)}
                    disabled={grabbing === r.guid || grabbed.has(r.guid)}
                    className={cn(
                      "flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-4 text-xs font-bold transition-transform hover:scale-105 disabled:opacity-60",
                      grabbed.has(r.guid) ? "bg-ok/15 text-ok" : "brand-gradient text-white"
                    )}
                  >
                    {grabbing === r.guid ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : grabbed.has(r.guid) ? <Check className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
                    {grabbed.has(r.guid) ? t("search.grabbed") : t("common.grab")}
                  </button>
                </div>
              ))}
            </div>
          )}

          {!loading && configured && releases.length === 0 && (
            <div className="py-12 text-center text-sm text-ink-dim">{t("search.noResults")}</div>
          )}
        </div>
      </div>
    </div>
  );
}
