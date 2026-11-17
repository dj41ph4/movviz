"use client";

import Link from "next/link";
import useSWR from "swr";
import { Film, Tv } from "lucide-react";
import { useI18n, useT } from "@/i18n/provider";
import { TmdbImage } from "@/components/media/TmdbImage";
import type { WatchlistItem } from "@/lib/watchlist/types";
import { formatDate } from "@/lib/utils";
import { bleachTitleHref } from "@/lib/metadata/bleachPresentation";

type HistoryItem = Pick<WatchlistItem, "tmdbId" | "type" | "title" | "posterPath" | "year"> & {
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  watchedAt?: number | null;
};

export function PersonalLibraryTab({ history }: { history: boolean }) {
  const t = useT();
  const { locale } = useI18n();
  const { data, error, mutate } = useSWR<{ watchHistory: HistoryItem[]; items: WatchlistItem[] }>(
    history ? "/api/profile/media" : "/api/watchlist",
  );
  const items = history ? data?.watchHistory : data?.items;
  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 p-6 text-center text-sm">
        <p role="alert">{t("common.requestFailed")}</p>
        <button type="button" className="min-h-11 rounded-xl bg-brand/20 px-4" onClick={() => mutate()}>{t("common.retry")}</button>
      </div>
    );
  }
  if (!items) return <p role="status" className="text-sm text-ink-soft">{t("common.loading")}</p>;
  if (!items.length) {
    return <p className="rounded-2xl border border-white/10 p-6 text-center text-sm text-ink-soft">{t(history ? "nav.emptyWatchHistory" : "watchlist.empty")}</p>;
  }
  return (
    <div className="grid grid-cols-3 gap-x-2.5 gap-y-5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {items.map(item => {
        const isEpisode = item.type === "episode" && item.seasonNumber != null && item.episodeNumber != null;
        const part = "seriesPart" in item ? item.seriesPart : undefined;
        const href = bleachTitleHref(item.tmdbId, item.type === "episode" ? "series" : item.type, part);
        const episodeHref = isEpisode ? `${href}${href.includes("?") ? "&" : "?"}season=${item.seasonNumber}&episode=${item.episodeNumber}` : href;
        const date = "watchedAt" in item ? item.watchedAt : null;
        return (
          <Link key={`${item.type}:${item.tmdbId}:${item.seasonNumber ?? ""}:${item.episodeNumber ?? ""}:${part ?? ""}`}
            href={episodeHref} className="min-w-0 rounded-xl ring-focus">
            <div className="relative flex aspect-[2/3] items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-surface">
              {item.posterPath
                ? <TmdbImage path={item.posterPath} size="w342" alt="" loading="lazy" className="h-full w-full object-cover" />
                : item.type === "movie" ? <Film className="size-6 text-ink-dim" aria-hidden="true" /> : <Tv className="size-6 text-ink-dim" aria-hidden="true" />}
              {isEpisode && <span className="absolute inset-x-1 bottom-1 rounded-md bg-black/80 p-1 text-center text-[10px] font-bold text-white">
                S{item.seasonNumber} · E{item.episodeNumber}
              </span>}
            </div>
            <p className="mt-1.5 line-clamp-2 break-words text-xs font-semibold text-ink">{item.title}</p>
            {(date || item.year) && <p className="mt-0.5 text-[11px] text-ink-dim">{date ? formatDate(new Date(date).toISOString(), locale) : item.year}</p>}
          </Link>
        );
      })}
    </div>
  );
}
