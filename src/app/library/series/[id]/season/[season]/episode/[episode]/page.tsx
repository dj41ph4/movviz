"use client";

import { use as usePromise } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import type { LibrarySeries, LibraryEpisode, LibraryStatus } from "@/lib/library/types";
import type { MetaEpisode } from "@/lib/metadata/types";
import { Play, Check, Search, Clock, HardDriveDownload, ArrowLeft, Tv } from "lucide-react";

type EpisodeWithPlexUrl = LibraryEpisode & { plexUrl?: string | null };

const STATUS_TONE: Record<LibraryStatus, string> = {
  available: "text-ok bg-ok/12 border-ok/25",
  downloading: "text-cyan bg-cyan/12 border-cyan/25",
  searching: "text-brand-glow bg-brand/12 border-brand/25",
  missing: "text-amber bg-amber/12 border-amber/25",
};
const STATUS_ICON: Record<LibraryStatus, React.ElementType> = {
  available: Check,
  downloading: HardDriveDownload,
  searching: Search,
  missing: Clock,
};

export default function EpisodeDetailPage({
  params,
}: {
  params: Promise<{ id: string; season: string; episode: string }>;
}) {
  const { id, season, episode } = usePromise(params);
  const seasonNumber = Number(season);
  const episodeNumber = Number(episode);
  const t = useT();
  // Same SWR key as the series detail page: navigating from there paints
  // this page instantly instead of waiting for a fresh fetch.
  const { data: seriesData } = useSWR<LibrarySeries & { plexUrl?: string | null; id?: string }>(
    `/api/library/series/${id}`
  );
  const series = seriesData?.id ? seriesData : null;
  const { data: seasonData } = useSWR<{ episodes: MetaEpisode[] }>(
    series ? `/api/metadata/season?tmdbId=${series.tmdbId}&season=${seasonNumber}` : null
  );
  const meta = (seasonData?.episodes ?? []).find((e) => e.episodeNumber === episodeNumber) ?? null;

  if (!series) return (
    <div className="mx-auto max-w-[1000px] animate-pulse">
      <div className="h-6 w-32 rounded bg-white/10" />
      <div className="mt-6 space-y-3">
        <div className="h-64 rounded-2xl bg-white/5" />
        <div className="h-6 w-1/2 rounded bg-white/10" />
        <div className="h-4 w-2/3 rounded bg-white/5" />
      </div>
    </div>
  );

  const seasonObj = series.seasons.find((s) => s.seasonNumber === seasonNumber);
  const ep = seasonObj?.episodes.find((e) => e.episodeNumber === episodeNumber) as EpisodeWithPlexUrl | undefined;
  if (!ep) return (
    <div className="mx-auto max-w-[1000px] text-center py-24 text-sm text-ink-dim">{t("common.loading")}</div>
  );

  const Icon = STATUS_ICON[ep.status];
  const still = meta?.stillPath ? `https://image.tmdb.org/t/p/original${meta.stillPath}` : null;

  return (
    <div className="mx-auto max-w-[1000px]">
      <Link href={`/title/series/${series.tmdbId}`} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-dim hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> {series.title}
      </Link>

      <div className="relative -mx-6 mb-6 aspect-video overflow-hidden rounded-2xl border border-white/5 bg-surface sm:-mx-0">
        {still ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={still} alt={ep.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Tv className="h-10 w-10 text-ink-soft/40" />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-bold text-ink-dim">
          {seasonNumber}x{String(episodeNumber).padStart(2, "0")}
        </span>
        <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold", STATUS_TONE[ep.status])}>
          <Icon className="h-3 w-3" /> {t(`status.${ep.status}`)}
        </span>
        {ep.plexUrl && (
          <a
            href={ep.plexUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-9 items-center gap-2 rounded-xl bg-amber px-4 text-sm font-bold text-black"
          >
            <Play className="h-4 w-4 fill-black" /> {t("library.watchOnPlex")}
          </a>
        )}
      </div>

      <h1 className="mt-3 text-2xl font-black text-ink">{ep.title}</h1>
      {ep.airDate && <p className="mt-1 text-sm text-ink-dim">{ep.airDate}</p>}
      <p className="mt-4 max-w-2xl text-sm text-ink-soft">{meta?.overview || t("title.noSynopsis")}</p>
    </div>
  );
}
