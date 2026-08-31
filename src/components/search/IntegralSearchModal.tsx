"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/i18n/provider";
import { encodeLibraryRef } from "@/lib/library/types";
import type { IndexerRelease } from "@/lib/indexers/types";
import { ManualSearchReleaseRow } from "./ManualSearchReleaseRow";
import { Loader2, X, Layers, Check, Wand2 } from "lucide-react";

/**
 * Complete-series pack selection popup — the manual "Intégrale" flow. Lists
 * every integral candidate found by the exact same search as the automatic
 * flow (same backend function, same cache/direct fallback, same scoring) and
 * grabs the user's pick through the regular grab route with a
 * `series`-kind libraryRef, so the download, status flips and activity log
 * are identical to an automatic integral grab.
 */
export function IntegralSearchModal({
  open,
  onClose,
  seriesId,
  title,
  tmdbId,
  seasonCount,
  onGrabbed,
  onAutoSearch,
}: {
  open: boolean;
  onClose: () => void;
  seriesId: string;
  title: string;
  tmdbId: number;
  seasonCount?: number;
  onGrabbed?: () => void;
  /** When set, an "auto-grab the best candidate" fallback button is shown. */
  onAutoSearch?: () => void;
}) {
  const t = useT();
  const [releases, setReleases] = useState<IndexerRelease[]>([]);
  const [loading, setLoading] = useState(false);
  const [grabbing, setGrabbing] = useState<string | null>(null);
  const [grabbed, setGrabbed] = useState<Set<string>>(new Set());
  const [resultCount, setResultCount] = useState(0);

  useEffect(() => {
    if (!open) return;
    setReleases([]);
    setGrabbed(new Set());
    setGrabbing(null);
    setResultCount(0);
    const run = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/library/series/${seriesId}/integral-candidates`, { cache: "no-store" });
        const data = await res.json();
        setReleases(data.candidates ?? []);
        setResultCount(data.episodeCount ?? 0);
      } catch {
        setReleases([]);
      } finally {
        setLoading(false);
      }
    };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const grab = async (r: IndexerRelease) => {
    setGrabbing(r.guid);
    try {
      const res = await fetch("/api/indexers/grab", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          magnetUrl: r.magnetUrl,
          downloadUrl: r.downloadUrl,
          indexerId: r.indexerId,
          category: "series",
          libraryRef: encodeLibraryRef({ kind: "series", seriesId }),
          title,
          tmdbId,
          indexerName: r.indexer,
          score: r.score,
          size: r.size,
          protocol: r.protocol,
          seeders: r.seeders,
          leechers: r.leechers,
        }),
      });
      if (res.ok) {
        setGrabbed((s) => new Set(s).add(r.guid));
        onGrabbed?.();
      }
    } finally {
      setGrabbing(null);
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[8vh] backdrop-blur-sm" onClick={onClose}>
      <div
        className="mx-4 max-h-[80vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/10 bg-void shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/8 px-6 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
              <Layers className="h-5 w-5 text-brand-glow" />
              {t("activity.integralSearchFor", { title })}
            </h2>
            {seasonCount != null && seasonCount > 0 && (
              <p className="mt-0.5 text-xs text-ink-dim">
                {t("activity.integralSearchHint", { count: resultCount, seasons: seasonCount })}
              </p>
            )}
          </div>
          <button onClick={onClose} aria-label={t("common.close")} className="ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl glass-strong text-ink-dim hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-12 text-ink-dim">
              <Loader2 className="h-5 w-5 animate-spin" /> {t("search.searching")}
            </div>
          )}

          {!loading && releases.length > 0 && (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs text-ink-dim">
                <Check className="h-3.5 w-3.5 text-ok" />
                <span>{t("activity.integralCovers", { count: resultCount })}</span>
              </div>
              <div className="space-y-1">
                {releases.map((r) => (
                  <ManualSearchReleaseRow
                    key={r.guid}
                    release={r}
                    category="series"
                    grabbing={grabbing === r.guid}
                    grabbed={grabbed.has(r.guid)}
                    onGrab={grab}
                  />
                ))}
              </div>
            </>
          )}

          {!loading && releases.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-12">
              <p className="text-center text-sm text-ink-dim">{t("activity.integralNoResults")}</p>
              {onAutoSearch && (
                <button
                  onClick={onAutoSearch}
                  className="flex h-11 items-center gap-2 rounded-xl brand-gradient px-4 text-sm font-bold text-white transition-transform hover:scale-105"
                >
                  <Wand2 className="h-4 w-4" />
                  {t("activity.integralAutoSearch")}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
