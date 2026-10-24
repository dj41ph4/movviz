"use client";

import { use as usePromise, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/provider";
import { cn, openPlexLink } from "@/lib/utils";
import type { LibrarySeries, LibraryEpisode, LibraryStatus } from "@/lib/library/types";
import type { MetaEpisode } from "@/lib/metadata/types";
import { useBetaPlayer } from "@/lib/settings/useBetaPlayer";
import { usePlayer } from "@/lib/player/PlayerProvider";
import { usePlayLabel } from "@/lib/player/usePlayLabel";
import { Play, Check, Search, Clock, HardDriveDownload, ArrowLeft, Tv, Calendar, Trash2, Loader2, X } from "lucide-react";
import { TmdbImage } from "@/components/media/TmdbImage";
import { useTmdbImageUrl } from "@/lib/settings/useTmdbImageUrl";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { toast } from "@/components/ui/Toast";

type EpisodeWithPlexUrl = LibraryEpisode & { plexUrl?: string | null };

const STATUS_TONE: Record<LibraryStatus, string> = {
  available: "text-ok bg-ok/12 border-ok/25",
  downloading: "text-cyan bg-cyan/12 border-cyan/25",
  searching: "text-brand-glow bg-brand/12 border-brand/25",
  missing: "text-amber bg-amber/12 border-amber/25",
  upcoming: "text-ink-dim bg-white/6 border-white/10",
};
const STATUS_ICON: Record<LibraryStatus, React.ElementType> = {
  available: Check,
  downloading: HardDriveDownload,
  searching: Search,
  missing: Clock,
  upcoming: Calendar,
};

export default function EpisodeDetailPage({
  params,
}: {
  params: Promise<{ id: string; season: string; episode: string }>;
}) {
  const { id, season, episode } = usePromise(params);
  const seasonNumber = Number(season);
  const episodeNumber = Number(episode);
  const { t, locale } = useI18n();
  const router = useRouter();
  const user = useCurrentUser();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const { enabled: betaPlayer } = useBetaPlayer();
  const { play } = usePlayer();
  // Same SWR key as the series detail page: navigating from there paints
  // this page instantly instead of waiting for a fresh fetch.
  const { data: seriesData } = useSWR<LibrarySeries & { plexUrl?: string | null; id?: string }>(
    `/api/library/series/${id}`
  );
  const series = seriesData?.id ? seriesData : null;
  const { data: seasonData } = useSWR<{ episodes: MetaEpisode[] }>(
    series ? `/api/metadata/season?tmdbId=${series.tmdbId}&season=${seasonNumber}&locale=${locale}` : null
  );
  const meta = (seasonData?.episodes ?? []).find((e) => e.episodeNumber === episodeNumber) ?? null;
  const seasonObj = series?.seasons.find((s) => s.seasonNumber === seasonNumber);
  const ep = seasonObj?.episodes.find((e) => e.episodeNumber === episodeNumber) as EpisodeWithPlexUrl | undefined;
  // Hooks must run unconditionally on every render — computed above the
  // loading-state early returns below (via optional chaining) rather than
  // after them, or this would violate rules-of-hooks the moment `ep` is
  // still unknown on first paint.
  const { label: playLabel } = usePlayLabel(ep?.plexRatingKey);
  const stillPath = meta?.stillPath ?? null;
  // Only needed for play()'s backdropUrl below (Tier 3, no fallback — see
  // useTmdbImageUrl's doc comment); the <img> further down resolves its own
  // CDN-vs-local (with fallback) directly via TmdbImage.
  //
  // Hoisted here for the same reason as usePlayLabel above, and it was not:
  // on a cold SWR cache the first render exits at `if (!series)` below, so
  // calling this after that point registered useTmdbImageUrl's own hooks
  // (useCdnImages / useLocalNetworkPriority / useIsLocalNetwork — three
  // useSWR/useState chains) only from the second render on. SWR re-renders
  // the same instance rather than remounting it, so React saw the hook count
  // grow between two renders of one component: "Rendered more hooks than
  // during the previous render", i.e. the page crashed to its error boundary
  // on any cold entry (direct URL, bookmark, notification deep link, F5) —
  // never when arriving from the series page, which shares this SWR key and
  // so already has the data on the very first render.
  const still = useTmdbImageUrl(stillPath, "original");

  const removeEpisode = async (deleteFiles: boolean) => {
    setRemoving(true);
    try {
      const res = await fetch(`/api/library/series/${id}/episode/${seasonNumber}/${episodeNumber}?deleteFiles=${deleteFiles}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast("error", body.error === "shared_file" ? t("library.removeEpisodeShared") : body.error === "episode_busy" ? t("library.removeEpisodeBusy") : body.error === "file_removal_failed" && typeof body.detail === "string" ? `${t("library.removeEpisodeFailed")} ${body.detail}` : t("library.removeEpisodeFailed"));
        return;
      }
      router.push(`/title/series/${series?.tmdbId ?? ""}`);
    } catch {
      toast("error", t("library.removeEpisodeFailed"));
    } finally {
      setRemoving(false);
    }
  };

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

  if (!ep) return (
    <div className="mx-auto max-w-[1000px] text-center py-24 text-sm text-ink-dim">{t("common.loading")}</div>
  );

  const Icon = STATUS_ICON[ep.status];

  return (
    <div className="mx-auto max-w-[1000px]">
      <Link href={`/title/series/${series.tmdbId}`} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-dim hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> {series.title}
      </Link>

      <div className="relative -mx-6 mb-6 aspect-video overflow-hidden rounded-2xl border border-white/5 bg-surface sm:-mx-0">
        {stillPath ? (
          <TmdbImage path={stillPath} size="original" alt={ep.title} loading="lazy" decoding="async" className="h-full w-full object-cover" />
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
          betaPlayer && ep.plexRatingKey ? (
            <button
              onClick={(e) => play({
                ratingKey: ep.plexRatingKey!,
                movvizId: `${series.id}:s${seasonNumber}e${episodeNumber}`,
                seriesId: series.id,
                plexUrl: ep.plexUrl!,
                title: ep.title,
                useTranscode: betaPlayer,
                tmdbId: series.tmdbId,
                type: "series",
                seasonNumber,
                episodeNumber,
                originRect: e.currentTarget.getBoundingClientRect(),
                backdropUrl: still,
              })}
              className="flex h-9 items-center gap-2 rounded-xl bg-amber px-4 text-sm font-bold text-black"
            >
              <Play className="h-4 w-4 fill-black" /> {playLabel}
            </button>
          ) : (
            <a
              href={ep.plexUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => openPlexLink(e, ep.plexUrl!)}
              className="flex h-9 items-center gap-2 rounded-xl bg-amber px-4 text-sm font-bold text-black"
            >
              <Play className="h-4 w-4 fill-black" /> {t("library.watchOnPlex")}
            </a>
          )
        )}
        {user?.role === "admin" && (
          confirmRemove ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-down/30 bg-down/10 p-2">
              <button onClick={() => void removeEpisode(false)} disabled={removing} className="rounded-lg px-3 py-2 text-xs font-bold text-down hover:bg-down/10 disabled:opacity-50">{t("library.removeEpisodeOnly")}</button>
              {ep.file && !ep.combinedFile && <button onClick={() => void removeEpisode(true)} disabled={removing} className="rounded-lg bg-down px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{t("library.removeEpisodeFiles")}</button>}
              <button onClick={() => setConfirmRemove(false)} disabled={removing} aria-label={t("common.cancel")} className="rounded-lg p-2 text-ink-dim hover:text-ink">{removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}</button>
            </div>
          ) : (
            <button onClick={() => setConfirmRemove(true)} className="flex h-9 items-center gap-2 rounded-xl border border-down/25 px-3 text-sm font-semibold text-down hover:bg-down/10"><Trash2 className="h-4 w-4" />{t("library.removeEpisode")}</button>
          )
        )}
      </div>

      <h1 className="mt-3 text-2xl font-black text-ink">{ep.title}</h1>
      {ep.airDate && <p className="mt-1 text-sm text-ink-dim">{ep.airDate}</p>}
      <p className="mt-4 max-w-2xl text-sm text-ink-soft">{meta?.overview || t("title.noSynopsis")}</p>
    </div>
  );
}
