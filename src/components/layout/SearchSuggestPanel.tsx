"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Clock, TrendingUp, X } from "lucide-react";
import { useT } from "@/i18n/provider";
import { TmdbImage } from "@/components/media/TmdbImage";
import { bleachTitleHref } from "@/lib/metadata/bleachPresentation";
import type { MetaSearchResult } from "@/lib/metadata/types";
import { clearRecentSearches, forgetSearch, readRecentSearches, subscribeRecentSearches } from "@/lib/nav/recentSearches";

/** Shown under the nav search box while it is focused and empty: the
 *  user's recent searches, then a few trending titles — never a blank box. */
export function SearchSuggestPanel({ onPick, onNavigate }: { onPick: (query: string) => void; onNavigate: () => void }) {
  const t = useT();
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => {
    const sync = () => setRecent(readRecentSearches());
    sync();
    return subscribeRecentSearches(sync);
  }, []);
  const { data: movies } = useSWR<{ results?: MetaSearchResult[] }>("/api/metadata/trending?type=movie");
  const { data: series } = useSWR<{ results?: MetaSearchResult[] }>("/api/metadata/trending?type=series");
  const trending = interleave(movies?.results ?? [], series?.results ?? []).slice(0, 6);
  const trendingLoading = !movies && !series;

  return (
    <div
      data-search-panel
      className="absolute inset-x-0 top-full z-40 mt-2 max-h-[70vh] overflow-y-auto rounded-2xl border border-white/10 bg-surface p-2 shadow-2xl"
    >
      {recent.length > 0 && (
        <div className="pb-2">
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wide text-ink-dim">{t("discover.searchRecent")}</span>
            <button type="button" onClick={clearRecentSearches} className="rounded-lg px-2 py-0.5 text-[11px] font-semibold text-ink-dim hover:text-ink">
              {t("discover.searchClearRecent")}
            </button>
          </div>
          {recent.map((q) => (
            <div key={q} className="group flex items-center rounded-xl hover:bg-white/6 focus-within:bg-white/6">
              <button type="button" onClick={() => onPick(q)} className="flex min-w-0 flex-1 items-center gap-2.5 px-2 py-2 text-left text-sm text-ink-soft outline-none group-hover:text-ink">
                <Clock className="h-3.5 w-3.5 shrink-0 text-ink-dim" />
                <span className="truncate">{q}</span>
              </button>
              <button
                type="button"
                onClick={() => forgetSearch(q)}
                aria-label={t("discover.searchRemoveRecent")}
                title={t("discover.searchRemoveRecent")}
                className="mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-ink-dim hover:text-ink"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className={recent.length > 0 ? "border-t border-white/8 pt-2" : undefined}>
        <span className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-dim">
          <TrendingUp className="h-3.5 w-3.5" /> {t("discover.searchTrending")}
        </span>
        {trendingLoading
          ? [...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-2 py-1.5">
                <div className="aspect-video w-16 shrink-0 animate-pulse rounded-lg bg-white/8" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-white/8" />
              </div>
            ))
          : trending.map((r) => (
              <Link
                key={`${r.type}:${r.tmdbId}`}
                href={bleachTitleHref(r.tmdbId, r.type, r.seriesPart)}
                onClick={onNavigate}
                className="flex items-center gap-3 rounded-xl px-2 py-1.5 outline-none hover:bg-white/6 focus-visible:bg-white/6"
              >
                <div className="aspect-video w-16 shrink-0 overflow-hidden rounded-lg bg-white/6">
                  <TmdbImage path={r.backdropPath ?? r.posterPath} size="w300" alt="" className="h-full w-full object-cover" />
                </div>
                <span className="min-w-0 flex-1 truncate text-sm text-ink-soft">{r.title}</span>
                {r.year && <span className="shrink-0 text-xs text-ink-dim">{r.year}</span>}
              </Link>
            ))}
      </div>
    </div>
  );
}

function interleave<T>(a: T[], b: T[]): T[] {
  const out: T[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i]) out.push(a[i]);
    if (b[i]) out.push(b[i]);
  }
  return out;
}
