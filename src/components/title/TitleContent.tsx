"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/provider";
import { cn, openPlexLink } from "@/lib/utils";
import { encodeLibraryRef } from "@/lib/library/types";
import type { MetaDetail } from "@/lib/metadata/types";
import type { LibraryStatus, LibraryFile, LibraryFileVersion } from "@/lib/library/types";
import { daysUntil } from "@/lib/library/releaseSchedule";
import { SeasonAccordion } from "@/components/title/SeasonAccordion";
import { ManualSearchModal } from "@/components/search/ManualSearchModal";
import { IntegralSearchModal } from "@/components/search/IntegralSearchModal";
import { VersionsPanel } from "@/components/title/VersionsPanel";
import { BrandIcon } from "@/components/ui/BrandIcon";
import { TagEditor } from "@/components/library/TagEditor";
import { MediaBadges, buildMediaBadgeItems } from "@/components/library/MediaBadges";
import { TrailerHeader, TrailerModalPlayer } from "@/components/media/TrailerHeader";
import { ReportIssueButton } from "@/components/issues/ReportIssueButton";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { reportIssue } from "@/lib/issues/store";
import { VideoPlayer, PREBUFFER_SECONDS } from "@/components/player/VideoPlayer";
import { useJobRunning, useActiveJobSuffix } from "@/lib/jobs/useJobRunning";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { useBetaPlayer } from "@/lib/settings/useBetaPlayer";
import {
  Star, Plus, Check, Loader2, Bookmark,
  Clock, HardDriveDownload, Search, SearchCheck, Hash, Play,
  ListFilter, Layers, ChevronDown, Calendar, X, Trash2, RefreshCw,
  type LucideIcon,
} from "lucide-react";

/* ────────────────────────────────────────────── constants & helpers ─── */

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
  upcoming: Calendar,
  missing: Clock,
};

const INTL_LOCALE: Record<string, string> = {
  fr: "fr-FR", en: "en-US", it: "it-IT", nl: "nl-NL", de: "de-DE",
};

function formatBitrate(kbps: number): string {
  if (kbps >= 10_000) return `${(kbps / 1000).toFixed(0)} Mbps`;
  if (kbps >= 1000) return `${(kbps / 1000).toFixed(1)} Mbps`;
  return `${kbps} kbps`;
}

function formatFullDate(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(INTL_LOCALE[locale] ?? "fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });
}

function formatCurrency(amount: number, locale: string): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale] ?? "fr-FR", {
    style: "currency", currency: "USD",
  }).format(amount);
}

function overallSeriesStatus(
  series: { seasons: { episodes: { monitored: boolean; status: LibraryStatus }[] }[] },
): LibraryStatus {
  const episodes = series.seasons.flatMap((s) => s.episodes).filter((e) => e.monitored);
  if (episodes.length === 0) return "missing";
  if (episodes.every((e) => e.status === "available")) return "available";
  if (episodes.some((e) => e.status === "downloading")) return "downloading";
  if (episodes.some((e) => e.status === "searching")) return "searching";
  if (episodes.every((e) => e.status === "upcoming")) return "upcoming";
  return "missing";
}

function InfoRow({
  label, value, icon: Icon,
}: { label: string; value: string; icon?: LucideIcon }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-ink-dim">{label}</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-soft">
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-ink-dim" />}
        {value}
      </p>
    </div>
  );
}

/** Studios list, collapsed to 3 by default. */
function StudiosRow({
  studios, label, showMoreLabel, showLessLabel,
}: { studios: string[]; label: string; showMoreLabel: string; showLessLabel: string }) {
  const [expanded, setExpanded] = useState(false);
  if (studios.length === 0) return null;
  const visible = expanded ? studios : studios.slice(0, 3);
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-ink-dim">{label}</p>
      <div className="mt-0.5 text-sm text-ink-soft">
        {visible.map((s) => <p key={s}>{s}</p>)}
      </div>
      {studios.length > 3 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 flex items-center gap-1 text-xs font-semibold text-brand-glow hover:text-brand"
        >
          <ChevronDown className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")} />
          {expanded ? showLessLabel : showMoreLabel}
        </button>
      )}
    </div>
  );
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/* ─────────────────────────────────────────────────── types ──────────── */

type LibraryListItem = {
  id?: string;
  tmdbId: number;
  status?: LibraryStatus;
  file?: LibraryFile | null;
  versions?: LibraryFileVersion[];
  monitored?: boolean;
  plexUrl?: string | null;
  plexRatingKey?: string | null;
  tags?: string[];
  plexMediaInfo?: {
    container: string | null;
    bitrate: number | null;
    audioStreams: {
      codec: string; channels: number | null; layout: string | null;
      language: string | null; title: string | null;
    }[];
    subtitleStreams: {
      codec: string; language: string | null; title: string | null; forced: boolean;
    }[];
    chapters: { title: string | null; startTimeOffset: number }[];
  } | null;
  seasons?: {
    seasonNumber?: number;
    episodes: {
      monitored: boolean; status: LibraryStatus; episodeNumber?: number;
      title?: string; airDate?: string | null; activeInfoHash?: string | null;
      file?: LibraryFile | null;
    }[];
  }[];
};

export interface TitleContentProps {
  tmdbId: number;
  type: "movie" | "series";
}

/* ─────────────────────────────────────────────────── component ─────── */

export function TitleContent({ tmdbId, type }: TitleContentProps) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const user = useCurrentUser();
  const { enabled: betaPlayer } = useBetaPlayer();

  /* ── data fetching ──────────────────────────────────────────────────── */

  const { data: detailData } = useSWR<MetaDetail>(
    `/api/metadata/detail?type=${type}&tmdbId=${tmdbId}&lang=${locale}`,
    fetcher,
  );
  const detail = detailData?.tmdbId ? detailData : null;

  const libEndpoint =
    type === "movie" ? "/api/library/movies" : "/api/library/series";

  const { data: libraryData, mutate: mutateLibrary } = useSWR<
    Record<string, LibraryListItem[]>
  >(`${libEndpoint}?tmdbId=${tmdbId}`, fetcher);

  const libraryMatchRaw = (
    (type === "movie" ? libraryData?.movies : libraryData?.series) ?? []
  ).find((x) => x.tmdbId === tmdbId) ?? null;

  const { data: watchlistData, mutate: mutateWatchlist } = useSWR<{
    items: { tmdbId: number; type: string }[];
  }>("/api/watchlist", fetcher);

  const onWatchlist = (watchlistData?.items ?? []).some(
    (x) => x.tmdbId === tmdbId && x.type === type,
  );

  const { data: watchData } = useSWR<{
    episodes: { tmdbId: number; season: number; episode: number }[];
  }>("/api/watch-status", fetcher);

  /* ── derived ────────────────────────────────────────────────────────── */

  const [tagsOverride, setTagsOverride] = useState<string[] | null>(null);
  const libraryMatch =
    libraryMatchRaw && tagsOverride
      ? { ...libraryMatchRaw, tags: tagsOverride }
      : libraryMatchRaw;

  const libraryStatus: LibraryStatus | null = libraryMatch
    ? type === "movie"
      ? libraryMatch.status ?? null
      : overallSeriesStatus({ seasons: libraryMatch.seasons ?? [] })
    : null;

  const watchedEpisodes = new Set(
    (watchData?.episodes ?? [])
      .filter((e) => e.tmdbId === tmdbId)
      .map((e) => `${e.season}.${e.episode}`),
  );

  const backdrop = detail?.backdropPath
    ? `/tmdb/original${detail.backdropPath}`
    : null;

  /* ── local state ────────────────────────────────────────────────────── */

  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(!!libraryMatch);
  const [watching, setWatching] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchingSeason, setSearchingSeason] = useState<number | null>(null);
  const [searchingEpisode, setSearchingEpisode] = useState<string | null>(null);
  const [searchingComplete, setSearchingComplete] = useState(false);
  const [integralSearchOpen, setIntegralSearchOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [manualSearch, setManualSearch] = useState<{
    libraryRef: string;
    query: string;
    title: string;
    tmdbId?: number;
    imdbId?: string;
  } | null>(null);
  const [showFullCrew, setShowFullCrew] = useState(false);
  const [showTrailer, setShowTrailer] = useState(false);
  const trailerModalRef = useRef<HTMLDivElement>(null);

  // Mobile only — the trailer modal is a real full-screen player now (see
  // below), so it should behave like one: go fullscreen and force landscape,
  // same as YouTube/Netflix's own mobile players, instead of leaving the
  // video letterboxed sideways in portrait. Fullscreen is required by every
  // browser that supports orientation locking at all (locking without it
  // throws) — requested on the modal's own element, not the whole document,
  // so it only ever affects this one overlay. Neither API is universally
  // supported (iOS Safari has no orientation-lock API whatsoever outside a
  // home-screen-installed PWA) — both calls are best-effort and silently
  // no-op where unavailable, since the modal already renders correctly
  // without them, just not force-rotated.
  useEffect(() => {
    if (!showTrailer || typeof window === "undefined" || window.innerWidth >= 640) return;
    let cancelled = false;
    (async () => {
      try {
        if (trailerModalRef.current && !document.fullscreenElement) {
          await trailerModalRef.current.requestFullscreen();
        }
        if (!cancelled) await (screen.orientation as any)?.lock?.("landscape");
      } catch { /* not supported on this browser/context — modal still works, just not rotated */ }
    })();
    return () => {
      cancelled = true;
      try { (screen.orientation as any)?.unlock?.(); } catch { /* unsupported */ }
      if (document.fullscreenElement) { try { document.exitFullscreen(); } catch { /* unsupported */ } }
    };
  }, [showTrailer]);
  const [playRatingKey, setPlayRatingKey] = useState<string | null>(null);
  const [resyncingAnime, setResyncingAnime] = useState(false);
  const [resyncResult, setResyncResult] = useState<string | null>(null);

  const inLibrary = added || libraryStatus !== null;
  const canSearch =
    inLibrary && libraryMatch?.id && libraryStatus !== "downloading" && libraryStatus !== "searching";

  /* ── job state (shared via job queue) ───────────────────────────────── */

  const searchSourceId = libraryMatch?.id
    ? type === "movie"
      ? `movie-search-${libraryMatch.id}`
      : `series-search-${libraryMatch.id}`
    : null;
  const jobSearching = useJobRunning(searchSourceId);
  const seasonSearchPrefix = libraryMatch?.id
    ? `season-search-${libraryMatch.id}-`
    : null;
  const activeJobSeason = useActiveJobSuffix(seasonSearchPrefix);
  const episodeSearchPrefix = libraryMatch?.id
    ? `episode-search-${libraryMatch.id}-`
    : null;
  const activeJobEpisodeRaw = useActiveJobSuffix(episodeSearchPrefix);
  const activeJobEpisode = activeJobEpisodeRaw
    ? activeJobEpisodeRaw.replace("-", ".")
    : null;
  const completeSeriesJobSearching = useJobRunning(
    libraryMatch?.id ? `series-complete-search-${libraryMatch.id}` : null,
  );

  const isSearching = searching || jobSearching;
  const effectiveSearchingSeason =
    searchingSeason ?? (activeJobSeason != null ? Number(activeJobSeason) : null);
  const effectiveSearchingEpisode = searchingEpisode ?? activeJobEpisode;
  const isSearchingCompleteSeries = searchingComplete || completeSeriesJobSearching;

  /* ── action handlers ────────────────────────────────────────────────── */

  const addToLibrary = useCallback(async () => {
    setAdding(true);
    try {
      await fetch(libEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tmdbId }),
      });
      setAdded(true);
      mutateLibrary();
    } finally {
      setAdding(false);
    }
  }, [libEndpoint, tmdbId, mutateLibrary]);

  const toggleWatchlist = useCallback(async () => {
    setWatching(true);
    const wasOnWatchlist = onWatchlist;
    mutateWatchlist(
      (current) =>
        current
          ? {
              items: wasOnWatchlist
                ? current.items.filter(
                    (x) => !(x.tmdbId === tmdbId && x.type === type),
                  )
                : [...current.items, { tmdbId, type }],
            }
          : current,
      { revalidate: false },
    );
    try {
      if (wasOnWatchlist) {
        await fetch(`/api/watchlist/${type}/${tmdbId}`, { method: "DELETE" });
      } else {
        await fetch("/api/watchlist", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            tmdbId,
            type,
            title: detail?.title,
            posterPath: detail?.posterPath,
            year: detail?.year,
            rating: detail?.rating,
          }),
        });
      }
      await mutateWatchlist();
    } finally {
      setWatching(false);
    }
  }, [onWatchlist, tmdbId, type, detail, mutateWatchlist]);

  const triggerSearch = useCallback(async () => {
    if (!libraryMatch?.id) return;
    setSearching(true);
    try {
      await fetch(`${libEndpoint}/${libraryMatch.id}/search`, {
        method: "POST",
      });
      mutateLibrary();
    } finally {
      setSearching(false);
    }
  }, [libraryMatch?.id, libEndpoint, mutateLibrary]);

  const searchSeason = useCallback(
    async (seasonNumber: number) => {
      if (!libraryMatch?.id) return;
      setSearchingSeason(seasonNumber);
      try {
        await fetch(
          `/api/library/series/${libraryMatch.id}/season/${seasonNumber}/search`,
          { method: "POST" },
        );
        mutateLibrary();
      } finally {
        setSearchingSeason(null);
      }
    },
    [libraryMatch?.id, mutateLibrary],
  );

  const searchEpisode = useCallback(
    async (seasonNumber: number, episodeNumber: number) => {
      if (!libraryMatch?.id) return;
      setSearchingEpisode(`${seasonNumber}.${episodeNumber}`);
      try {
        await fetch(
          `/api/library/series/${libraryMatch.id}/episode/${seasonNumber}/${episodeNumber}/search`,
          { method: "POST" },
        );
        mutateLibrary();
      } finally {
        setSearchingEpisode(null);
      }
    },
    [libraryMatch?.id, mutateLibrary],
  );

  const searchCompleteSeries = useCallback(() => {
    if (!libraryMatch?.id) return;
    // The integral button opens the selection popup instead of auto-grabbing
    // blindly — the user sees every complete-series pack the automatic flow
    // would have considered and picks the one they want.
    setIntegralSearchOpen(true);
  }, [libraryMatch?.id]);

  const autoSearchCompleteSeries = useCallback(async () => {
    if (!libraryMatch?.id) return;
    setSearchingComplete(true);
    setIntegralSearchOpen(false);
    try {
      await fetch(
        `/api/library/series/${libraryMatch.id}/search-complete-series`,
        { method: "POST" },
      );
      mutateLibrary();
    } finally {
      setSearchingComplete(false);
    }
  }, [libraryMatch?.id, mutateLibrary]);

  const resyncAnime = useCallback(async () => {
    if (!libraryMatch?.id) return;
    setResyncingAnime(true);
    setResyncResult(null);
    try {
      const res = await fetch(
        `/api/library/series/${libraryMatch.id}/resync-anime`,
        { method: "POST" },
      );
      const data = await res.json();
      if (res.ok) {
        setResyncResult(
          t("library.resyncAnimeDone", {
            old: data.oldSeasonCount,
            new: data.newSeasonCount,
          }),
        );
      } else if (data.error === "active_downloads") {
        setResyncResult(t("library.resyncAnimeActiveDownloads"));
      } else if (data.error === "no_disk_seasons") {
        setResyncResult(t("library.resyncAnimeNoDiskSeasons"));
      } else {
        setResyncResult(t("library.resyncAnimeNoMatch"));
      }
    } finally {
      setResyncingAnime(false);
    }
  }, [libraryMatch?.id, t]);

  const pad = (n: number) => String(n).padStart(2, "0");

  const openManualSearch = useCallback(() => {
    if (!libraryMatch?.id) return;
    if (type === "movie") {
      setManualSearch({
        libraryRef: encodeLibraryRef({ kind: "movie", movieId: libraryMatch.id }),
        query: detail?.title ?? "",
        title: detail?.title ?? "",
        tmdbId: detail?.tmdbId,
        imdbId: detail?.imdbId ?? undefined,
      });
      return;
    }
    const target =
      libraryMatch.seasons?.find(
        (s) =>
          s.episodes.some((e) => e.monitored) &&
          !s.episodes.every((e) => !e.monitored || e.status === "available"),
      )?.seasonNumber ?? detail?.seasons?.[0]?.seasonNumber ?? 1;
    openManualSearchSeason(target);
  }, [libraryMatch, type, detail]);

  const openManualSearchSeason = useCallback(
    (seasonNumber: number) => {
      if (!libraryMatch?.id) return;
      setManualSearch({
        libraryRef: encodeLibraryRef({
          kind: "season",
          seriesId: libraryMatch.id,
          season: seasonNumber,
        }),
        query: `${detail?.title} S${pad(seasonNumber)}`,
        title: `${detail?.title} — S${pad(seasonNumber)}`,
      });
    },
    [libraryMatch?.id, detail?.title],
  );

  const openManualSearchEpisode = useCallback(
    (seasonNumber: number, episodeNumber: number) => {
      if (!libraryMatch?.id) return;
      setManualSearch({
        libraryRef: encodeLibraryRef({
          kind: "episode",
          seriesId: libraryMatch.id,
          season: seasonNumber,
          episode: episodeNumber,
        }),
        query: `${detail?.title} S${pad(seasonNumber)}E${pad(episodeNumber)}`,
        title: `${detail?.title} — ${seasonNumber}x${pad(episodeNumber)}`,
      });
    },
    [libraryMatch?.id, detail?.title],
  );

  const setTags = useCallback(
    async (tags: string[]) => {
      if (!libraryMatch?.id) return;
      setTagsOverride(tags);
      await fetch(`${libEndpoint}/${libraryMatch.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tags }),
      });
      await mutateLibrary();
      setTagsOverride(null);
    },
    [libraryMatch?.id, libEndpoint, mutateLibrary],
  );

  const remove = useCallback(async () => {
    if (!libraryMatch?.id) return;
    await fetch(`${libEndpoint}/${libraryMatch.id}`, { method: "DELETE" });
    router.push("/library");
  }, [libraryMatch?.id, libEndpoint, router]);

  /* ═══════════════════════════════════════════════════════════════════════
     LOADING STATE
     ═══════════════════════════════════════════════════════════════════════ */

  if (!detail) {
    // Loading skeleton
    return (
      <div className="mx-auto max-w-[1200px] animate-pulse">
        <div className="h-[180px] rounded-2xl bg-white/5 sm:h-[320px]" />
        <div className="relative z-10 -mt-14 flex flex-col items-center gap-4 text-center sm:-mt-40 sm:flex-row sm:items-start sm:gap-6 sm:text-left">
          <div className="h-44 w-32 shrink-0 rounded-2xl bg-white/10 shadow-2xl sm:h-64 sm:w-44" />
          <div className="flex flex-1 flex-col items-center sm:items-start">
            <div className="mb-2 h-5 w-20 rounded-full bg-white/10" />
            <div className="h-7 w-64 rounded bg-white/10 sm:h-8 sm:w-80" />
            <div className="mt-2 flex flex-wrap gap-3">
              <div className="h-4 w-14 rounded bg-white/6" />
              <div className="h-4 w-12 rounded bg-white/6" />
              <div className="h-4 w-16 rounded bg-white/6" />
              <div className="h-4 w-20 rounded bg-white/6" />
            </div>
            <div className="mt-3 h-3.5 w-full max-w-lg rounded bg-white/6" />
            <div className="mt-1.5 h-3.5 w-3/4 max-w-lg rounded bg-white/6" />
            <div className="mt-4 flex flex-wrap gap-2">
              <div className="h-10 w-32 rounded-xl bg-white/10" />
              <div className="h-10 w-28 rounded-xl bg-white/8" />
              <div className="h-10 w-28 rounded-xl bg-white/8" />
              <div className="h-10 w-24 rounded-xl bg-white/8" />
            </div>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_260px]">
          <div className="space-y-6">
            <div className="h-5 w-32 rounded bg-white/8" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i}>
                  <div className="h-3 w-16 rounded bg-white/6" />
                  <div className="mt-1 h-3.5 w-24 rounded bg-white/8" />
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4 lg:border-l lg:border-white/5 lg:pl-8">
            <div className="rounded-2xl glass p-4 space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="h-3 w-20 rounded bg-white/6" />
                  <div className="h-3 w-24 rounded bg-white/8" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const StatusIcon = libraryStatus ? STATUS_ICON[libraryStatus] : null;
  // Same day-count treatment as the library card and dashboard row — "à
  // venir" alone doesn't say if that's tomorrow or in six months.
  const daysToRelease =
    type === "movie" && libraryStatus === "upcoming" ? daysUntil(detail?.vfReleaseDate ?? detail?.releaseDateFull ?? null) : null;

  const technicalContent = (
    <>
      {libraryMatch?.id && (
        <div className="rounded-2xl glass p-4">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-dim">
            {t("library.tagsTitle")}
          </h3>
          <TagEditor
            tags={libraryMatch.tags ?? []}
            onChange={setTags}
          />
        </div>
      )}

      {libraryMatch?.plexMediaInfo && type === "movie" && (
        <div className="rounded-2xl glass p-5">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-dim">
            {t("title.technicalInfo")}
          </h3>
          <div className="space-y-2 text-xs text-ink">
            {libraryMatch.plexMediaInfo.container && (
              <div className="flex items-center justify-between">
                <span className="text-ink-dim">
                  {t("title.container")}
                </span>
                <span className="font-semibold uppercase">
                  {libraryMatch.plexMediaInfo.container}
                </span>
              </div>
            )}
            {libraryMatch.plexMediaInfo.bitrate != null && (
              <div className="flex items-center justify-between">
                <span className="text-ink-dim">
                  {t("title.bitrate")}
                </span>
                <span className="font-semibold">
                  {formatBitrate(libraryMatch.plexMediaInfo.bitrate)}
                </span>
              </div>
            )}
            {libraryMatch.plexMediaInfo.audioStreams.length > 0 && (
              <div>
                <p className="mb-1 text-ink-dim">
                  {t("title.audioTracks")}
                </p>
                <div className="space-y-1">
                  {libraryMatch.plexMediaInfo.audioStreams.map(
                    (a, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-lg bg-white/5 px-2 py-1"
                      >
                        <span className="truncate">
                          {[a.language?.toUpperCase(), a.title]
                            .filter(Boolean)
                            .join(" • ")}
                        </span>
                        <span className="ml-2 shrink-0 font-semibold">
                          {a.codec}
                          {a.layout ? ` ${a.layout}` : ""}
                          {a.channels ? ` (${a.channels}ch)` : ""}
                        </span>
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}
            {libraryMatch.plexMediaInfo.subtitleStreams.length > 0 && (
              <div>
                <p className="mb-1 text-ink-dim">
                  {t("title.subtitles")}
                </p>
                <div className="flex flex-wrap gap-1">
                  {libraryMatch.plexMediaInfo.subtitleStreams.map(
                    (s, i) => (
                      <span
                        key={i}
                        className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px]"
                      >
                        {s.language?.toUpperCase() || s.codec.toUpperCase()}
                        {s.forced ? " (F)" : ""}
                      </span>
                    ),
                  )}
                </div>
              </div>
            )}
            {libraryMatch.plexMediaInfo.chapters.length > 0 && (
              <div>
                <p className="mb-1 text-ink-dim">
                  {t("title.chapters")} (
                  {libraryMatch.plexMediaInfo.chapters.length})
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <InfoRow
        label={t("title.originalTitle")}
        value={detail.originalTitle}
      />
      <InfoRow label={t("title.status")} value={detail.status} />
      {detail.releaseDateFull && (
        <InfoRow
          label={t(
            type === "movie"
              ? "title.releaseDate"
              : "title.firstAirDate",
          )}
          value={formatFullDate(detail.releaseDateFull, locale)}
          icon={Calendar}
        />
      )}
      {detail.revenue != null && (
        <InfoRow
          label={t("title.revenue")}
          value={formatCurrency(detail.revenue, locale)}
        />
      )}
      {detail.budget != null && (
        <InfoRow
          label={t("title.budget")}
          value={formatCurrency(detail.budget, locale)}
        />
      )}
      <InfoRow
        label={t("title.originalLanguage")}
        value={detail.originalLanguage.toUpperCase()}
      />
      <InfoRow
        label={t("title.countries")}
        value={detail.countries.join(", ")}
      />
      <StudiosRow
        studios={detail.studios}
        label={t("title.studios")}
        showMoreLabel={t("title.showMore")}
        showLessLabel={t("title.showLessCrew")}
      />

      {detail.watchProviders.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-ink-dim">
            {t("title.availableOn")}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {detail.watchProviders.slice(0, 8).map((p) => (
              <div
                key={p.providerId}
                title={p.name}
                className="h-8 w-8 overflow-hidden rounded-lg border border-white/10 bg-surface"
              >
                {p.logoPath ? (
                  <img
                    src={`/tmdb/w92${p.logoPath}`}
                    alt={p.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-white/5 pt-4">
        {libraryStatus === "available" && libraryMatch?.plexUrl && (
          betaPlayer && libraryMatch?.plexRatingKey ? (
            <button
              onClick={() => setPlayRatingKey(libraryMatch.plexRatingKey!)}
              title="Plex"
              className="h-8 w-8 shrink-0 overflow-hidden rounded-lg transition-transform hover:scale-110"
            >
              <BrandIcon name="plex" className="h-full w-full" />
            </button>
          ) : (
            <a
              href={libraryMatch.plexUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => openPlexLink(e, libraryMatch.plexUrl!)}
              title="Plex"
              className="h-8 w-8 shrink-0 overflow-hidden rounded-lg transition-transform hover:scale-110"
            >
              <BrandIcon name="plex" className="h-full w-full" />
            </a>
          )
        )}
        <a
          href={`https://www.themoviedb.org/${type === "movie" ? "movie" : "tv"}/${detail.tmdbId}`}
          target="_blank"
          rel="noreferrer"
          title="TMDb"
          className="h-8 w-8 shrink-0 overflow-hidden rounded-lg transition-transform hover:scale-110"
        >
          <BrandIcon name="tmdb" className="h-full w-full" />
        </a>
        {detail.imdbId && (
          <a
            href={`https://www.imdb.com/title/${detail.imdbId}`}
            target="_blank"
            rel="noreferrer"
            title="IMDb"
            className="h-8 w-8 shrink-0 overflow-hidden rounded-lg transition-transform hover:scale-110"
          >
            <BrandIcon name="imdb" className="h-full w-full" />
          </a>
        )}
        <a
          href={`https://www.rottentomatoes.com/search?search=${encodeURIComponent(detail.title)}`}
          target="_blank"
          rel="noreferrer"
          title="Rotten Tomatoes"
          className="h-8 w-8 shrink-0 overflow-hidden rounded-lg transition-transform hover:scale-110"
        >
          <BrandIcon
            name="rottenTomatoes"
            className="h-full w-full"
          />
        </a>
        {type === "movie" && (
          <a
            href={`https://letterboxd.com/search/${encodeURIComponent(detail.title)}/`}
            target="_blank"
            rel="noreferrer"
            title="Letterboxd"
            className="h-8 w-8 shrink-0 overflow-hidden rounded-lg transition-transform hover:scale-110"
          >
            <BrandIcon name="letterboxd" className="h-full w-full" />
          </a>
        )}
      </div>
    </>
  );

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════════ */

  return (
    <>
      {/*
       * ── HEADER ────────────────────────────────────────────────────
       * Full page layout (large backdrop + overlay).
       */}
      <div
        className="relative -mx-6 -mt-6 mb-8 h-[60vh] min-h-[320px] overflow-hidden sm:-mx-10 sm:-mt-10 sm:h-[75vh] sm:min-h-[420px]"
        style={{ contain: "paint" }}
      >
          <ErrorBoundary onError={(e) => reportIssue(`Trailer crash: ${e.message}`)} fallback={
            backdrop ? <img src={backdrop} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-void" />
          }>
            <TrailerHeader
              backdropUrl={backdrop}
              trailerKeys={detail.trailerKeys}
              title={detail.title}
              trigger="immediate"
              className="h-full w-full"
            />
          </ErrorBoundary>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-void via-void/70 to-transparent" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-void/60 via-transparent to-transparent" />
          {libraryMatch?.id && (
            <div className="absolute right-4 top-4 z-10 flex items-center gap-2 sm:right-8 sm:top-8">
              <ReportIssueButton
                libraryType={type}
                libraryId={libraryMatch.id}
                className="h-10 w-10 backdrop-blur"
              />
              <button
                onClick={remove}
                className="flex h-10 w-10 items-center justify-center rounded-xl glass backdrop-blur text-down"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}

          {/* Title + metadata + actions, overlaid bottom-left on the video —
              same composition as the Dashboard Cinematic Hero (reused, not
              reinvented): status pill, big title, compact meta line, then a
              primary action pill plus compact icon-only circles for the
              secondary ones, instead of a wall of full-width labeled
              buttons competing with the video for attention. */}
          <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-3 p-4 sm:p-10">
            {libraryStatus && StatusIcon && (
              <span
                className={cn(
                  "inline-flex w-fit items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold",
                  daysToRelease != null ? "border-brand/25 bg-brand/12 text-brand-glow" : STATUS_TONE[libraryStatus],
                )}
              >
                <StatusIcon className="h-3 w-3" />{" "}
                {daysToRelease != null
                  ? daysToRelease <= 1
                    ? t("dashboard.hero.inOneDay")
                    : t("dashboard.hero.inDays", { n: daysToRelease })
                  : t(`status.${libraryStatus}`)}
              </span>
            )}
            <h1 className="max-w-2xl text-3xl font-black tracking-tight text-white drop-shadow-lg sm:text-5xl">
              {detail.title}
              {detail.year ? (
                <span className="ml-2 inline-block align-baseline font-normal text-ink-dim text-lg sm:text-xl">
                  {detail.year}
                </span>
              ) : null}
              {libraryMatch?.file?.hdr ? (
                <span className="ml-2 inline-flex items-center gap-1 align-middle">
                  {buildMediaBadgeItems(
                    {
                      hdr: libraryMatch.file.hdr,
                      resolution: null,
                      videoCodec: null,
                      audioCodec: null,
                      source: null,
                      language: null,
                    },
                    "surface",
                  )}
                </span>
              ) : null}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-white/80">
              <span className="flex items-center gap-1 font-semibold text-amber">
                <Star className="h-4 w-4 fill-amber" />{" "}
                {detail.rating.toFixed(1)}
              </span>
              {detail.rtScore != null && (
                <span className="flex items-center gap-1 font-semibold">
                  <BrandIcon
                    name="rottenTomatoes"
                    className="h-4 w-4 rounded"
                  />{" "}
                  {detail.rtScore}%
                </span>
              )}
              {detail.metascore != null && (
                <span className="flex items-center gap-1 font-semibold">
                  <span className="flex h-4 w-4 items-center justify-center rounded bg-[#54B848] text-[9px] font-black text-white">
                    M
                  </span>{" "}
                  {detail.metascore}
                </span>
              )}
              {detail.imdbRating != null && (
                <span className="flex items-center gap-1 font-semibold">
                  <BrandIcon name="imdb" className="h-4 w-4 rounded" />{" "}
                  {detail.imdbRating.toFixed(1)}
                </span>
              )}
              <span>{detail.year ?? "—"}</span>
              {detail.runtime ? (
                <span>
                  {detail.runtime} {t("title.minutes")}
                </span>
              ) : null}
              {type === "series" && detail.seasons && (
                <span>
                  {detail.seasons.length} {t("title.seasonsCount")}
                </span>
              )}
              <span className="max-w-xs truncate sm:max-w-md">{detail.genres.join(", ")}</span>
            </div>
            {detail.tagline && (
              <p className="max-w-xl text-sm italic text-white/70">
                {detail.tagline}
              </p>
            )}
            {libraryMatch?.file && (
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <MediaBadges
                  file={libraryMatch.file}
                  plexMediaInfo={libraryMatch?.plexMediaInfo}
                  className="relative static"
                  variant="surface"
                />
              </div>
            )}
            {/* Action row */}
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {!inLibrary ? (
                <button
                  onClick={addToLibrary}
                  disabled={adding}
                  className="flex h-11 items-center gap-2 rounded-xl brand-gradient px-5 text-sm font-bold text-white transition-transform hover:scale-105 disabled:opacity-50"
                >
                  {adding ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {t("discover.addToLibrary")}
                </button>
              ) : (
                <>
                  {libraryStatus === "available" && libraryMatch?.plexUrl && (
                    betaPlayer && libraryMatch?.plexRatingKey ? (
                      <button
                        onClick={() => setPlayRatingKey(libraryMatch.plexRatingKey!)}
                        className="flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-black transition-transform hover:scale-105"
                      >
                        <Play className="h-4 w-4 fill-black" />
                        {t("library.watchOnPlex")}
                      </button>
                    ) : (
                      <a
                        href={libraryMatch.plexUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => openPlexLink(e, libraryMatch.plexUrl!)}
                        className="flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-black transition-transform hover:scale-105"
                      >
                        <Play className="h-4 w-4 fill-black" />
                        {t("library.watchOnPlex")}
                      </a>
                    )
                  )}
                  {canSearch && (
                    <button
                      onClick={triggerSearch}
                      disabled={isSearching}
                      title={
                        libraryStatus === "available"
                          ? t("activity.upgrades.title")
                          : t("activity.searchNow")
                      }
                      className={cn(
                        "flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-bold backdrop-blur transition-transform hover:scale-105",
                        libraryStatus === "available"
                          ? "bg-white/10 text-white/80 hover:text-white"
                          : "bg-cyan/80 text-white",
                      )}
                    >
                      {isSearching ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                      {libraryStatus === "available" ? "" : t("activity.searchNow")}
                    </button>
                  )}
                  {libraryMatch?.id && (
                    <button
                      onClick={openManualSearch}
                      title={t("library.manualSearch")}
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/80 backdrop-blur transition-transform hover:scale-110 hover:text-white"
                    >
                      <ListFilter className="h-4 w-4" />
                    </button>
                  )}
                  {type === "movie" && libraryStatus === "available" && libraryMatch?.file && libraryMatch?.id && (
                    <button
                      onClick={() => setVersionsOpen(true)}
                      title={
                        libraryMatch.versions && libraryMatch.versions.length > 1
                          ? t("title.versions.title", { count: libraryMatch.versions.length })
                          : t("title.versions.manage")
                      }
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/80 backdrop-blur transition-transform hover:scale-110 hover:text-white"
                    >
                      <Layers className="h-4 w-4" />
                    </button>
                  )}
                </>
              )}
              <button
                onClick={toggleWatchlist}
                disabled={watching}
                title={onWatchlist ? t("watchlist.added") : t("watchlist.add")}
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-full bg-white/10 backdrop-blur transition-transform hover:scale-110",
                  onWatchlist ? "text-brand-glow" : "text-white/80 hover:text-white",
                )}
              >
                {watching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Bookmark
                    className={cn(
                      "h-4 w-4",
                      onWatchlist && "fill-brand-glow",
                    )}
                  />
                )}
              </button>
              {detail.trailerKey && (
                <button
                  onClick={() => setShowTrailer(true)}
                  title={t("title.trailer")}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/80 backdrop-blur transition-transform hover:scale-110 hover:text-white"
                >
                  <Play className="h-4 w-4" />
                </button>
              )}
              {type === "movie" && detail.collection && (
                <Link
                  href={`/collection/${detail.collection.id}`}
                  title={t("title.saga")}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/80 backdrop-blur transition-transform hover:scale-110 hover:text-white"
                >
                  <Layers className="h-4 w-4" />
                </Link>
              )}
            </div>
          </div>
      </div>

    {/*
     * ── BODY ─────────────────────────────────────────────────────────
     * Full layout: main column + technical sidebar.
     */}
      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_260px]">
        {/* ── MAIN COLUMN ────────────────────────────────────────────── */}
        <div className="min-w-0 space-y-10">
          <div>
            <p className="max-w-3xl text-sm text-ink-soft">
              {detail.overview || t("title.noSynopsis")}
            </p>
          </div>

          {/* ── Cast ──────────────────────────────────────────────────── */}
          {detail.cast.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-bold text-ink">
                {t("title.cast")}
              </h2>
              <div className="flex gap-4 overflow-x-auto pb-2">
                {detail.cast.map(
                  (c) => (
                    <Link
                      key={c.id}
                      href={`/person/${c.id}`}
                      className="group w-24 shrink-0 text-center"
                    >
                      <div className="mx-auto h-24 w-24 overflow-hidden rounded-full bg-surface transition-transform group-hover:scale-105">
                        {c.profilePath ? (
                          <img
                            src={`/tmdb/w185${c.profilePath}`}
                            alt={c.name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : null}
                      </div>
                      <p className="mt-1.5 truncate text-xs font-semibold text-ink group-hover:text-brand-glow">
                        {c.name}
                      </p>
                      <p className="truncate text-[11px] text-ink-dim">
                        {c.character}
                      </p>
                    </Link>
                  ),
                )}
              </div>
            </div>
          )}

          {/* ── Crew ──────────────────────────────────────────────────── */}
          {detail.crew.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-bold text-ink">
                {t("title.crew")}
              </h2>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                {(showFullCrew ? detail.crew : detail.crew.slice(0, 6)).map(
                  (c) => (
                    <div key={`${c.id}-${c.job}`} className="min-w-0">
                      <p className="text-xs font-semibold text-ink-dim">
                        {c.job}
                      </p>
                      <p className="truncate text-sm text-ink">{c.name}</p>
                    </div>
                  ),
                )}
              </div>
              {detail.crew.length > 6 && (
                <button
                  onClick={() => setShowFullCrew((v) => !v)}
                  className="mt-3 flex items-center gap-1 text-xs font-semibold text-brand-glow hover:text-brand"
                >
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 transition-transform",
                      showFullCrew && "rotate-180",
                    )}
                  />
                  {showFullCrew
                    ? t("title.showLessCrew")
                    : t("title.showFullCrew")}
                </button>
              )}
            </div>
          )}

          {/* ── Keywords ──────────────────────────────────────────────── */}
          {detail.keywords.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-bold text-ink">
                {t("title.keywords")}
              </h2>
              <div className="flex flex-wrap gap-2">
                {detail.keywords.map((k) => (
                  <span
                    key={k}
                    className="flex items-center gap-1 rounded-full glass px-3 py-1 text-xs text-ink-soft"
                  >
                    <Hash className="h-3 w-3 text-ink-dim" /> {k}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Seasons accordion ──────────────────────────────────────── */}
          {type === "series" && detail.seasons && detail.seasons.length > 0 && (
            <div>
              {resyncResult && (
                <p className="mb-3 rounded-lg bg-brand/10 px-3 py-2 text-xs font-semibold text-brand-glow">
                  {resyncResult}
                </p>
              )}
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-ink">
                  {t("title.seasons")}
                </h2>
                {libraryMatch?.id && (
                  <div className="flex flex-wrap gap-2">
                    {detail.isAnime && user?.role === "admin" && (
                      <button
                        onClick={resyncAnime}
                        disabled={resyncingAnime}
                        title={t("library.resyncAnime")}
                        className="flex h-9 shrink-0 items-center gap-2 rounded-xl bg-magenta/15 px-3.5 text-xs font-bold text-magenta transition-transform hover:scale-105 disabled:opacity-50 sm:px-4"
                      >
                        {resyncingAnime ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                        <span className="hidden sm:inline">
                          {t("library.resyncAnime")}
                        </span>
                      </button>
                    )}
                    <button
                      onClick={searchCompleteSeries}
                      disabled={isSearchingCompleteSeries}
                      title={t("library.searchCompleteSeries")}
                      className="flex h-9 shrink-0 items-center gap-2 rounded-xl bg-brand/15 px-3.5 text-xs font-bold text-brand-glow transition-transform hover:scale-105 disabled:opacity-50 sm:px-4"
                    >
                      {isSearchingCompleteSeries ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Layers className="h-3.5 w-3.5" />
                      )}
                      <span className="hidden sm:inline">
                        {t("library.searchCompleteSeries")}
                      </span>
                    </button>
                    <button
                      onClick={triggerSearch}
                      disabled={isSearching}
                      title={t("library.searchMissingEpisodes")}
                      className="flex h-9 shrink-0 items-center gap-2 rounded-xl bg-cyan/15 px-3.5 text-xs font-bold text-cyan transition-transform hover:scale-105 disabled:opacity-50 sm:px-4"
                    >
                      {isSearching ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <SearchCheck className="h-3.5 w-3.5" />
                      )}
                      <span className="hidden sm:inline">
                        {t("library.searchMissingEpisodes")}
                      </span>
                    </button>
                  </div>
                )}
              </div>
              <SeasonAccordion
                seriesId={libraryMatch?.id}
                seasons={detail.seasons}
                librarySeasons={libraryMatch?.seasons}
                onSearchSeason={
                  libraryMatch?.id ? searchSeason : undefined
                }
                onManualSearchSeason={
                  libraryMatch?.id ? openManualSearchSeason : undefined
                }
                onSearchEpisode={
                  libraryMatch?.id ? searchEpisode : undefined
                }
                onManualSearchEpisode={
                  libraryMatch?.id
                    ? openManualSearchEpisode
                    : undefined
                }
                searchingSeason={effectiveSearchingSeason}
                searchingEpisodeKey={effectiveSearchingEpisode}
                watchedEpisodes={watchedEpisodes}
              />
            </div>
          )}

          {/* ── Similar titles ─────────────────────────────────────────── */}
          {detail.similar.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-bold text-ink">
                {t("title.similar")}
              </h2>
              <div className="grid grid-cols-3 gap-4 sm:grid-cols-4">
                {(() => {
                  const libraryTmdbIds = new Set(
                    (
                      (type === "movie"
                        ? libraryData?.movies
                        : libraryData?.series) ?? []
                    ).map((x) => x.tmdbId),
                  );
                  return detail.similar.map((s) => {
                    const owned = libraryTmdbIds.has(s.tmdbId);
                    return (
                      <Link
                        key={s.tmdbId}
                        href={`/title/${type}/${s.tmdbId}`}
                        className="group relative block"
                      >
                        <div className="overflow-hidden rounded-lg border border-white/5 bg-surface aspect-[2/3]">
                          {s.posterPath ? (
                            <img
                              src={`/tmdb/w342${s.posterPath}`}
                              alt={s.title}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : null}
                          {owned && (
                            <div className="absolute right-1 top-1 flex items-center gap-1 rounded bg-ok px-1 py-0.5 text-[8px] font-bold text-black">
                              <Check size={8} />
                            </div>
                          )}
                        </div>
                        <p className="mt-1.5 truncate text-xs font-semibold text-ink">
                          {s.title}
                        </p>
                      </Link>
                    );
                  });
                })()}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4 lg:border-l lg:border-white/5 lg:pl-8">
          {technicalContent}
        </div>
      </div>

      {/* ── MODALS ────────────────────────────────────────────────────── */}
      {showTrailer && detail.trailerKey && (
        // Full-bleed, edge-to-edge and vertically centered on a solid black
        // stage on mobile — a small max-w-3xl card floating near the top
        // (the sm:+ desktop treatment, untouched below) left most of the
        // screen as wasted blurred backdrop and squeezed the video into a
        // ~200px strip. From sm: up, back to the original floating card.
        <div
          ref={trailerModalRef}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black sm:items-start sm:bg-black/50 sm:p-4 sm:pt-[12vh] sm:backdrop-blur-sm"
          onClick={() => setShowTrailer(false)}
        >
          <div
            className="relative w-full sm:max-w-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowTrailer(false)}
              aria-label={t("common.close")}
              className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition-colors hover:bg-black/60 sm:-top-10 sm:right-0 sm:h-8 sm:w-8 sm:rounded-lg sm:bg-transparent sm:text-ink-soft sm:backdrop-blur-none sm:hover:bg-transparent sm:hover:text-ink"
            >
              <X className="h-5 w-5 sm:h-5 sm:w-5" />
            </button>
            <div className="aspect-video w-full overflow-hidden border-white/10 bg-black shadow-2xl sm:rounded-2xl sm:border">
              <ErrorBoundary onError={(e) => reportIssue(`Trailer modal crash: ${e.message}`)}>
                <TrailerModalPlayer trailerKeys={detail.trailerKeys} title={t("title.trailer")} />
              </ErrorBoundary>
            </div>
          </div>
        </div>
      )}

      {manualSearch && (
        <ManualSearchModal
          open={!!manualSearch}
          onClose={() => setManualSearch(null)}
          libraryRef={manualSearch.libraryRef}
          query={manualSearch.query}
          category={type}
          refTitle={detail.title}
          year={detail.year ? String(detail.year) : undefined}
          title={manualSearch.title}
          tmdbId={manualSearch.tmdbId}
          imdbId={manualSearch.imdbId}
        />
      )}

      {integralSearchOpen && libraryMatch?.id && (
        <IntegralSearchModal
          open={integralSearchOpen}
          onClose={() => setIntegralSearchOpen(false)}
          seriesId={libraryMatch.id}
          title={detail.title}
          tmdbId={tmdbId}
          seasonCount={detail.seasons?.length}
          onGrabbed={() => mutateLibrary()}
          onAutoSearch={() => void autoSearchCompleteSeries()}
        />
      )}

      {versionsOpen && libraryMatch?.id && (
        <VersionsPanel
          movieId={libraryMatch.id}
          title={detail.title}
          versions={libraryMatch.versions?.length ? libraryMatch.versions : libraryMatch.file ? [{ ...libraryMatch.file, id: "primary", versionSource: "unknown", reason: "Acquisition initiale", primary: true }] : []}
          onClose={() => setVersionsOpen(false)}
          onChange={() => mutateLibrary()}
        />
      )}

      {playRatingKey && libraryMatch?.plexUrl && libraryMatch?.plexRatingKey && (
        <VideoPlayer
          ratingKey={playRatingKey}
          plexUrl={libraryMatch.plexUrl}
          title={detail?.title ?? ""}
          onClose={() => setPlayRatingKey(null)}
          useTranscode={betaPlayer}
          prebufferSeconds={PREBUFFER_SECONDS}
        />
      )}
    </>
  );
}
