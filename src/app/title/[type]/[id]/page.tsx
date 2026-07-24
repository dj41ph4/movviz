"use client";

import { useState, useEffect, use as usePromise } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { encodeLibraryRef } from "@/lib/library/types";
import type { MetaDetail } from "@/lib/metadata/types";
import type { LibraryStatus, LibraryFile } from "@/lib/library/types";
import { RequestMovieModal } from "@/components/requests/RequestMovieModal";
import { RequestSeriesModal } from "@/components/requests/RequestSeriesModal";
import { SeasonAccordion } from "@/components/title/SeasonAccordion";
import { ManualSearchModal } from "@/components/search/ManualSearchModal";
import { BrandIcon } from "@/components/ui/BrandIcon";
import { TagEditor } from "@/components/library/TagEditor";
import { MediaBadges } from "@/components/library/MediaBadges";
import { ReportIssueButton } from "@/components/issues/ReportIssueButton";
import { VideoPlayer } from "@/components/player/VideoPlayer";
import { useJobRunning, useActiveJobSuffix } from "@/lib/jobs/useJobRunning";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { useBetaPlayer } from "@/lib/settings/useBetaPlayer";
import { Star, Plus, Check, Loader2, Bookmark, Film, Tv, Clock, HardDriveDownload, Search, SearchCheck, Hash, Play, ListFilter, Layers, ChevronDown, Calendar, X, Trash2, RefreshCw, type LucideIcon } from "lucide-react";

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

function formatBitrate(kbps: number): string {
  if (kbps >= 10000) return `${(kbps / 1000).toFixed(0)} Mbps`;
  if (kbps >= 1000) return `${(kbps / 1000).toFixed(1)} Mbps`;
  return `${kbps} kbps`;
}

export default function TitleDetailPage({ params }: { params: Promise<{ type: string; id: string }> }) {
  const { type: rawType, id } = usePromise(params);
  const type = rawType === "series" ? "series" : "movie";
  const { locale, t } = useI18n();
  const router = useRouter();
  const user = useCurrentUser();
  const [adding, setAdding] = useState(false);
  const [resyncingAnime, setResyncingAnime] = useState(false);
  const [resyncResult, setResyncResult] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [watching, setWatching] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchingSeason, setSearchingSeason] = useState<number | null>(null);
  const [searchingEpisode, setSearchingEpisode] = useState<string | null>(null);
  const [searchingComplete, setSearchingComplete] = useState(false);
  const [manualSearch, setManualSearch] = useState<{ libraryRef: string; query: string; title: string; tmdbId?: number; imdbId?: string } | null>(null);
  const [showFullCrew, setShowFullCrew] = useState(false);
  const [showTrailer, setShowTrailer] = useState(false);
  const [tagsOverride, setTagsOverride] = useState<string[] | null>(null);
  const { enabled: betaPlayer } = useBetaPlayer();
  const [playRatingKey, setPlayRatingKey] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const fromPage = sessionStorage.getItem("movviz_from");
    if (fromPage !== "discover") {
      window.scrollTo(0, 0);
    }
    sessionStorage.removeItem("movviz_from");
  }, [type, id]);

  // All reads go through SWR: the detail comes back instantly when
  // revisiting a title, and the library/watchlist keys are shared with the
  // pages that already poll them — no duplicate fetch, no status pop-in.
  const { data: detailData } = useSWR<MetaDetail>(`/api/metadata/detail?type=${type}&tmdbId=${id}&lang=${locale}`);
  const detail = detailData?.tmdbId ? detailData : null;
  const { data: watchlistData, mutate: mutateWatchlist } = useSWR<{ items: { tmdbId: number; type: string }[] }>("/api/watchlist");
  const onWatchlist = (watchlistData?.items ?? []).some((x) => x.tmdbId === Number(id) && x.type === type);
  const { data: watchData } = useSWR<{ episodes: { tmdbId: number; season: number; episode: number }[] }>("/api/watch-status");
  const libraryEndpoint = type === "movie" ? "/api/library/movies" : "/api/library/series";
  type LibraryListItem = {
    id?: string;
    tmdbId: number;
    status?: LibraryStatus;
    file?: LibraryFile | null;
    monitored?: boolean;
    plexUrl?: string | null;
    plexRatingKey?: string | null;
    tags?: string[];
    plexMediaInfo?: {
      container: string | null;
      bitrate: number | null;
      audioStreams: { codec: string; channels: number | null; layout: string | null; language: string | null; title: string | null }[];
      subtitleStreams: { codec: string; language: string | null; title: string | null; forced: boolean }[];
      chapters: { title: string | null; startTimeOffset: number }[];
    } | null;
    seasons?: {
      seasonNumber?: number;
      episodes: { monitored: boolean; status: LibraryStatus; episodeNumber?: number; title?: string; airDate?: string | null; activeInfoHash?: string | null; file?: LibraryFile | null }[];
    }[];
  };
  const { data: libraryData, mutate: mutateLibrary } = useSWR<Record<string, LibraryListItem[]>>(libraryEndpoint);
  const libraryMatchRaw = ((type === "movie" ? libraryData?.movies : libraryData?.series) ?? [])
    .find((x) => x.tmdbId === Number(id));
  const libraryMatch = libraryMatchRaw && tagsOverride ? { ...libraryMatchRaw, tags: tagsOverride } : libraryMatchRaw;
  const libraryStatus: LibraryStatus | null = libraryMatch
    ? type === "movie"
      ? libraryMatch.status ?? null
      : overallSeriesStatus({ seasons: libraryMatch.seasons ?? [] })
    : added
      ? "searching"
      : null;
  const watchedEpisodes = new Set(
    (watchData?.episodes ?? [])
      .filter((e) => e.tmdbId === Number(id))
      .map((e) => `${e.season}.${e.episode}`)
  );
  // Reflects the real, server-side job state — not just this component's
  // own memory — so the button still shows as running if you navigate away
  // mid-search and come back before it's done. Called unconditionally,
  // ahead of the loading-skeleton early return below, so hook order never
  // changes between the loading and loaded renders.
  const searchSourceId = libraryMatch?.id
    ? type === "movie"
      ? `movie-search-${libraryMatch.id}`
      : `series-search-${libraryMatch.id}`
    : null;
  const jobSearching = useJobRunning(searchSourceId);
  const seasonSearchPrefix = libraryMatch?.id ? `season-search-${libraryMatch.id}-` : null;
  const activeJobSeason = useActiveJobSuffix(seasonSearchPrefix);
  const episodeSearchPrefix = libraryMatch?.id ? `episode-search-${libraryMatch.id}-` : null;
  const activeJobEpisodeRaw = useActiveJobSuffix(episodeSearchPrefix);
  // Job source id is "episode-search-{id}-{season}-{episode}" → suffix is
  // "{season}-{episode}"; the accordion keys episodes as "{season}.{episode}".
  const activeJobEpisode = activeJobEpisodeRaw ? activeJobEpisodeRaw.replace("-", ".") : null;
  const effectiveSearchingEpisode = searchingEpisode ?? activeJobEpisode;
  const completeSeriesJobSearching = useJobRunning(
    libraryMatch?.id ? `series-complete-search-${libraryMatch.id}` : null
  );
  const isSearchingCompleteSeries = searchingComplete || completeSeriesJobSearching;

  if (!detail) return (
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

  const backdrop = detail.backdropPath ? `https://image.tmdb.org/t/p/original${detail.backdropPath}` : null;
  const poster = detail.posterPath ? `https://image.tmdb.org/t/p/w500${detail.posterPath}` : null;

  const addToLibrary = async () => {
    setAdding(true);
    try {
      const endpoint = type === "movie" ? "/api/library/movies" : "/api/library/series";
      await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tmdbId: Number(id) }),
      });
      setAdded(true);
      mutateLibrary();
    } finally {
      setAdding(false);
    }
  };

  const toggleWatchlist = async () => {
    setWatching(true);
    // Fill/unfill the bookmark right away — waiting on the round-trip made a
    // single tap feel unresponsive for something this lightweight.
    const wasOnWatchlist = onWatchlist;
    mutateWatchlist(
      (current) =>
        current
          ? {
              items: wasOnWatchlist
                ? current.items.filter((x) => !(x.tmdbId === Number(id) && x.type === type))
                : [...current.items, { tmdbId: Number(id), type }],
            }
          : current,
      { revalidate: false }
    );
    try {
      if (wasOnWatchlist) {
        await fetch(`/api/watchlist/${type}/${id}`, { method: "DELETE" });
      } else {
        await fetch("/api/watchlist", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ tmdbId: Number(id), type, title: detail.title, posterPath: detail.posterPath, year: detail.year, rating: detail.rating }),
        });
      }
      await mutateWatchlist();
    } finally {
      setWatching(false);
    }
  };

  const inLibrary = added || libraryStatus !== null;

  const triggerSearch = async () => {
    if (!libraryMatch?.id) return;
    // This POST now just enqueues the search and returns immediately — the
    // actual indexer search + grab runs as a background job, so there's
    // nothing to await here beyond the enqueue itself. `jobSearching` (from
    // the shared job queue) is what actually drives the button's spinner.
    setSearching(true);
    try {
      const endpoint = type === "movie" ? "/api/library/movies" : "/api/library/series";
      await fetch(`${endpoint}/${libraryMatch.id}/search`, { method: "POST" });
      mutateLibrary();
    } finally {
      setSearching(false);
    }
  };
  const isSearching = searching || jobSearching;
  const effectiveSearchingSeason = searchingSeason ?? (activeJobSeason != null ? Number(activeJobSeason) : null);
  const searchSeason = async (seasonNumber: number) => {
    if (!libraryMatch?.id) return;
    setSearchingSeason(seasonNumber);
    try {
      await fetch(`/api/library/series/${libraryMatch.id}/season/${seasonNumber}/search`, { method: "POST" });
      mutateLibrary();
    } finally {
      setSearchingSeason(null);
    }
  };
  const searchEpisode = async (seasonNumber: number, episodeNumber: number) => {
    if (!libraryMatch?.id) return;
    setSearchingEpisode(`${seasonNumber}.${episodeNumber}`);
    try {
      await fetch(`/api/library/series/${libraryMatch.id}/episode/${seasonNumber}/${episodeNumber}/search`, { method: "POST" });
      mutateLibrary();
    } finally {
      setSearchingEpisode(null);
    }
  };
  const searchCompleteSeries = async () => {
    if (!libraryMatch?.id) return;
    setSearchingComplete(true);
    try {
      await fetch(`/api/library/series/${libraryMatch.id}/search-complete-series`, { method: "POST" });
      mutateLibrary();
    } finally {
      setSearchingComplete(false);
    }
  };
  const resyncAnime = async () => {
    if (!libraryMatch?.id) return;
    setResyncingAnime(true);
    setResyncResult(null);
    try {
      const res = await fetch(`/api/library/series/${libraryMatch.id}/resync-anime`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setResyncResult(t("library.resyncAnimeDone", { old: data.oldSeasonCount, new: data.newSeasonCount }));
        mutateLibrary();
      } else if (data.error === "not_more_granular") {
        setResyncResult(t("library.resyncAnimeNoChange"));
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
  };
  const pad = (n: number) => String(n).padStart(2, "0");
  const openManualSearch = () => {
    if (!libraryMatch?.id) return;
    if (type === "movie") {
      setManualSearch({ libraryRef: encodeLibraryRef({ kind: "movie", movieId: libraryMatch.id }), query: detail.title, title: detail.title, tmdbId: detail.tmdbId, imdbId: detail.imdbId ?? undefined });
      return;
    }
    // Not scoped to any one season the user is looking at, so default to
    // the first season that isn't fully available yet rather than always
    // season 1 — a finished show would otherwise always open on season 1.
    const target = libraryMatch.seasons?.find((s) =>
      s.episodes.some((e) => e.monitored) && !s.episodes.every((e) => !e.monitored || e.status === "available")
    )?.seasonNumber ?? detail.seasons?.[0]?.seasonNumber ?? 1;
    openManualSearchSeason(target);
  };
  const openManualSearchSeason = (seasonNumber: number) => {
    if (!libraryMatch?.id) return;
    setManualSearch({
      libraryRef: encodeLibraryRef({ kind: "season", seriesId: libraryMatch.id, season: seasonNumber }),
      query: `${detail.title} S${pad(seasonNumber)}`,
      title: `${detail.title} — S${pad(seasonNumber)}`,
    });
  };
  const openManualSearchEpisode = (seasonNumber: number, episodeNumber: number) => {
    if (!libraryMatch?.id) return;
    setManualSearch({
      libraryRef: encodeLibraryRef({ kind: "episode", seriesId: libraryMatch.id, season: seasonNumber, episode: episodeNumber }),
      query: `${detail.title} S${pad(seasonNumber)}E${pad(episodeNumber)}`,
      title: `${detail.title} — ${seasonNumber}x${pad(episodeNumber)}`,
    });
  };
  const setTags = async (tags: string[]) => {
    if (!libraryMatch?.id) return;
    setTagsOverride(tags);
    const endpoint = type === "movie" ? "/api/library/movies" : "/api/library/series";
    await fetch(`${endpoint}/${libraryMatch.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tags }),
    });
    await mutateLibrary();
    setTagsOverride(null);
  };
  const remove = async () => {
    if (!libraryMatch?.id) return;
    const endpoint = type === "movie" ? "/api/library/movies" : "/api/library/series";
    await fetch(`${endpoint}/${libraryMatch.id}`, { method: "DELETE" });
    router.push("/library");
  };
  const canSearch = inLibrary && libraryMatch?.id && libraryStatus !== "downloading" && libraryStatus !== "searching";
  const StatusIcon = libraryStatus ? STATUS_ICON[libraryStatus] : null;

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="relative -mx-6 -mt-6 mb-8 h-[180px] overflow-hidden sm:-mx-10 sm:-mt-10 sm:h-[320px]">
        {backdrop && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={backdrop} alt="" className="h-full w-full object-cover" loading="lazy" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-void via-void/60 to-transparent" />
        {libraryMatch?.id && (
          <div className="absolute right-4 top-4 z-10 flex items-center gap-2 sm:right-8 sm:top-8">
            <ReportIssueButton libraryType={type} libraryId={libraryMatch.id} className="h-10 w-10 backdrop-blur" />
            <button onClick={remove} className="flex h-10 w-10 items-center justify-center rounded-xl glass backdrop-blur text-down">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Side-by-side on desktop, stacked and centered on mobile — the poster
          (176px) plus a fixed gap left barely 150px for title/meta/buttons on
          a 375px viewport, wrapping every button label onto its own line. */}
      <div className="relative z-10 -mt-14 flex flex-col items-center gap-4 text-center sm:-mt-40 sm:flex-row sm:items-start sm:gap-6 sm:text-left">
        <div className="h-44 w-32 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-surface shadow-2xl sm:h-64 sm:w-44">
          {poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={poster} alt={detail.title} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              {type === "movie" ? <Film className="h-8 w-8 text-ink-soft/50" /> : <Tv className="h-8 w-8 text-ink-soft/50" />}
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col items-center pb-2 sm:items-start sm:justify-end">
          {libraryStatus && StatusIcon && (
            <span className={cn("mb-2 inline-flex w-fit items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold", STATUS_TONE[libraryStatus])}>
              <StatusIcon className="h-3 w-3" /> {t(`status.${libraryStatus}`)}
            </span>
          )}
          <h1 className="text-2xl font-black text-ink sm:text-3xl">{detail.title}</h1>
          <div className="mt-1.5 flex flex-wrap items-center justify-center gap-3 text-sm text-ink-soft sm:justify-start">
            <span className="flex items-center gap-1 font-semibold text-amber"><Star className="h-4 w-4 fill-amber" /> {detail.rating.toFixed(1)}</span>
            {detail.rtScore != null && (
              <span className="flex items-center gap-1 font-semibold">
                <BrandIcon name="rottenTomatoes" className="h-4 w-4 rounded" /> {detail.rtScore}%
              </span>
            )}
            {detail.metascore != null && (
              <span className="flex items-center gap-1 font-semibold">
                <span className="flex h-4 w-4 items-center justify-center rounded bg-[#54B848] text-[9px] font-black text-white">M</span> {detail.metascore}
              </span>
            )}
            {detail.imdbRating != null && (
              <span className="flex items-center gap-1 font-semibold">
                <BrandIcon name="imdb" className="h-4 w-4 rounded" /> {detail.imdbRating.toFixed(1)}
              </span>
            )}
            <span>{detail.year ?? "—"}</span>
            {detail.runtime ? <span>{detail.runtime} {t("title.minutes")}</span> : null}
            {type === "series" && detail.seasons && (
              <span>{detail.seasons.length} {t("title.seasonsCount")}</span>
            )}
            <span>{detail.genres.join(", ")}</span>
          </div>
          {detail.tagline && <p className="mt-2 max-w-2xl text-sm italic text-ink-dim">{detail.tagline}</p>}
          <p className="mt-3 max-w-2xl text-sm text-ink-soft">{detail.overview || t("title.noSynopsis")}</p>

          {type === "movie" && <MediaBadges file={libraryMatch?.file} className="relative static mt-3" variant="surface" />}

          <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
            {!inLibrary ? (
              <button
                onClick={() => setShowRequestModal(true)}
                className="flex h-10 items-center gap-2 rounded-xl brand-gradient px-5 text-sm font-bold text-white transition-transform hover:scale-105"
              >
                <Plus className="h-4 w-4" />
                {t("discover.addToLibrary")}
              </button>
            ) : (
              <>
                {libraryStatus === "available" && libraryMatch?.plexUrl && (
                  betaPlayer && libraryMatch?.plexRatingKey ? (
                    <button
                      onClick={() => setPlayRatingKey(libraryMatch.plexRatingKey!)}
                      className="flex h-10 items-center gap-2 rounded-xl bg-amber px-5 text-sm font-bold text-black transition-transform hover:scale-105"
                    >
                      <Play className="h-4 w-4 fill-black" />
                      {t("library.watchOnPlex")}
                    </button>
                  ) : (
                    <a
                      href={libraryMatch.plexUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex h-10 items-center gap-2 rounded-xl bg-amber px-5 text-sm font-bold text-black transition-transform hover:scale-105"
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
                    title={libraryStatus === "available" ? t("activity.upgrades.title") : undefined}
                    className={cn(
                      "flex h-10 items-center gap-2 rounded-xl px-5 text-sm font-bold transition-transform hover:scale-105",
                      libraryStatus === "available" ? "glass text-ink-soft hover:text-ink" : "bg-cyan/15 text-cyan"
                    )}
                  >
                    {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    {t("activity.searchNow")}
                  </button>
                )}
                {libraryMatch?.id && (
                  <button
                    onClick={openManualSearch}
                    title={t("library.manualSearch")}
                    className="flex h-10 items-center gap-2 rounded-xl glass px-5 text-sm font-bold text-ink-soft hover:text-ink transition-transform hover:scale-105"
                  >
                    <ListFilter className="h-4 w-4" />
                    {t("search.manualPick")}
                  </button>
                )}
              </>
            )}
            <button
              onClick={toggleWatchlist}
              disabled={watching}
              className={cn(
                "flex h-10 items-center gap-2 rounded-xl px-5 text-sm font-bold glass transition-transform hover:scale-105",
                onWatchlist ? "text-brand-glow" : "text-ink-soft"
              )}
            >
              {watching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bookmark className={cn("h-4 w-4", onWatchlist && "fill-brand-glow")} />}
              {onWatchlist ? t("watchlist.added") : t("watchlist.add")}
            </button>
            {detail.trailerKey && (
              <button
                onClick={() => setShowTrailer(true)}
                className="flex h-10 items-center gap-2 rounded-xl glass px-5 text-sm font-bold text-ink-soft hover:text-ink transition-transform hover:scale-105"
              >
                <Play className="h-4 w-4" />
                {t("title.trailer")}
              </button>
            )}
            {type === "movie" && detail.collection && (
              <Link
                href={`/collection/${detail.collection.id}`}
                className="flex h-10 items-center gap-2 rounded-xl glass px-5 text-sm font-bold text-ink-soft hover:text-ink transition-transform hover:scale-105"
              >
                <Layers className="h-4 w-4" />
                {t("title.saga")}
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_260px]">
        <div className="min-w-0 space-y-10">
          {detail.crew.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-bold text-ink">{t("title.crew")}</h2>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                {(showFullCrew ? detail.crew : detail.crew.slice(0, 6)).map((c) => (
                  <div key={`${c.id}-${c.job}`} className="min-w-0">
                    <p className="text-xs font-semibold text-ink-dim">{c.job}</p>
                    <p className="truncate text-sm text-ink">{c.name}</p>
                  </div>
                ))}
              </div>
              {detail.crew.length > 6 && (
                <button
                  onClick={() => setShowFullCrew((v) => !v)}
                  className="mt-3 flex items-center gap-1 text-xs font-semibold text-brand-glow hover:text-brand"
                >
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showFullCrew && "rotate-180")} />
                  {showFullCrew ? t("title.showLessCrew") : t("title.showFullCrew")}
                </button>
              )}
            </div>
          )}

          {detail.keywords.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-bold text-ink">{t("title.keywords")}</h2>
              <div className="flex flex-wrap gap-2">
                {detail.keywords.map((k) => (
                  <span key={k} className="flex items-center gap-1 rounded-full glass px-3 py-1 text-xs text-ink-soft">
                    <Hash className="h-3 w-3 text-ink-dim" /> {k}
                  </span>
                ))}
              </div>
            </div>
          )}

          {type === "series" && detail.seasons && detail.seasons.length > 0 && (
            <div>
              {resyncResult && (
                <p className="mb-3 rounded-lg bg-brand/10 px-3 py-2 text-xs font-semibold text-brand-glow">{resyncResult}</p>
              )}
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-ink">{t("title.seasons")}</h2>
                {libraryMatch?.id && (
                  <div className="flex flex-wrap gap-2">
                    {detail.isAnime && user?.role === "admin" && (
                      <button
                        onClick={resyncAnime}
                        disabled={resyncingAnime}
                        title={t("library.resyncAnime")}
                        className="flex h-9 shrink-0 items-center gap-2 rounded-xl bg-magenta/15 px-3.5 text-xs font-bold text-magenta transition-transform hover:scale-105 disabled:opacity-50 sm:px-4"
                      >
                        {resyncingAnime ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        <span className="hidden sm:inline">{t("library.resyncAnime")}</span>
                      </button>
                    )}
                    <button
                      onClick={searchCompleteSeries}
                      disabled={isSearchingCompleteSeries}
                      title={t("library.searchCompleteSeries")}
                      className="flex h-9 shrink-0 items-center gap-2 rounded-xl bg-brand/15 px-3.5 text-xs font-bold text-brand-glow transition-transform hover:scale-105 disabled:opacity-50 sm:px-4"
                    >
                      {isSearchingCompleteSeries ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Layers className="h-3.5 w-3.5" />}
                      <span className="hidden sm:inline">{t("library.searchCompleteSeries")}</span>
                    </button>
                    <button
                      onClick={triggerSearch}
                      disabled={isSearching}
                      title={t("library.searchMissingEpisodes")}
                      className="flex h-9 shrink-0 items-center gap-2 rounded-xl bg-cyan/15 px-3.5 text-xs font-bold text-cyan transition-transform hover:scale-105 disabled:opacity-50 sm:px-4"
                    >
                      {isSearching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SearchCheck className="h-3.5 w-3.5" />}
                      <span className="hidden sm:inline">{t("library.searchMissingEpisodes")}</span>
                    </button>
                  </div>
                )}
              </div>
              <SeasonAccordion
                seriesId={libraryMatch?.id}
                seasons={detail.seasons}
                librarySeasons={libraryMatch?.seasons}
                onSearchSeason={libraryMatch?.id ? searchSeason : undefined}
                onManualSearchSeason={libraryMatch?.id ? openManualSearchSeason : undefined}
                onSearchEpisode={libraryMatch?.id ? searchEpisode : undefined}
                onManualSearchEpisode={libraryMatch?.id ? openManualSearchEpisode : undefined}
                searchingSeason={effectiveSearchingSeason}
                searchingEpisodeKey={effectiveSearchingEpisode}
                watchedEpisodes={watchedEpisodes}
              />
            </div>
          )}

          {detail.cast.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-bold text-ink">{t("title.cast")}</h2>
              <div className="flex gap-4 overflow-x-auto pb-2">
                {detail.cast.map((c) => (
                  <Link key={c.id} href={`/person/${c.id}`} className="group w-24 shrink-0 text-center">
                    <div className="mx-auto h-24 w-24 overflow-hidden rounded-full bg-surface transition-transform group-hover:scale-105">
                      {c.profilePath ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`https://image.tmdb.org/t/p/w185${c.profilePath}`} alt={c.name} className="h-full w-full object-cover" loading="lazy" />
                      ) : null}
                    </div>
                    <p className="mt-1.5 truncate text-xs font-semibold text-ink group-hover:text-brand-glow">{c.name}</p>
                    <p className="truncate text-[11px] text-ink-dim">{c.character}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {detail.similar.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-bold text-ink">{t("title.similar")}</h2>
              <div className="grid grid-cols-3 gap-4 sm:grid-cols-4">
                {(() => {
                  const libraryTmdbIds = new Set(
                    ((type === "movie" ? libraryData?.movies : libraryData?.series) ?? [])
                      .map((x) => x.tmdbId)
                  );
                  return detail.similar.map((s) => {
                    const owned = libraryTmdbIds.has(s.tmdbId);
                    return (
                      <Link key={s.tmdbId} href={`/title/${type}/${s.tmdbId}`} className="group relative block">
                        <div className="aspect-[2/3] overflow-hidden rounded-xl border border-white/5 bg-surface">
                          {s.posterPath ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={`https://image.tmdb.org/t/p/w342${s.posterPath}`} alt={s.title} className="h-full w-full object-cover" loading="lazy" />
                          ) : null}
                          {owned && (
                            <div className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-md bg-ok px-1.5 py-0.5 text-[10px] font-bold text-black shadow">
                              <Check size={10} />
                              {t("status.available")}
                            </div>
                          )}
                        </div>
                        <p className="mt-1.5 truncate text-xs font-semibold text-ink">{s.title}</p>
                      </Link>
                    );
                  });
                })()}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4 lg:border-l lg:border-white/5 lg:pl-8">
          {libraryMatch?.id && (
            <div className="rounded-2xl glass p-4">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-dim">{t("library.tagsTitle")}</h3>
              <TagEditor tags={libraryMatch.tags ?? []} onChange={setTags} />
            </div>
          )}
          {libraryMatch?.plexMediaInfo && type === "movie" && (
            <div className="rounded-2xl glass p-5">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-dim">{t("title.technicalInfo")}</h3>
              <div className="space-y-2 text-xs text-ink">
                {libraryMatch.plexMediaInfo.container && (
                  <div className="flex items-center justify-between">
                    <span className="text-ink-dim">{t("title.container")}</span>
                    <span className="font-semibold uppercase">{libraryMatch.plexMediaInfo.container}</span>
                  </div>
                )}
                {libraryMatch.plexMediaInfo.bitrate != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-ink-dim">{t("title.bitrate")}</span>
                    <span className="font-semibold">{formatBitrate(libraryMatch.plexMediaInfo.bitrate)}</span>
                  </div>
                )}
                {libraryMatch.plexMediaInfo.audioStreams.length > 0 && (
                  <div>
                    <p className="mb-1 text-ink-dim">{t("title.audioTracks")}</p>
                    <div className="space-y-1">
                      {libraryMatch.plexMediaInfo.audioStreams.map((a, i) => (
                        <div key={i} className="flex items-center justify-between rounded-lg bg-white/5 px-2 py-1">
                          <span className="truncate">
                            {[a.language?.toUpperCase(), a.title].filter(Boolean).join(" • ")}
                          </span>
                          <span className="ml-2 shrink-0 font-semibold">
                            {a.codec}{a.layout ? ` ${a.layout}` : ""}{a.channels ? ` (${a.channels}ch)` : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {libraryMatch.plexMediaInfo.subtitleStreams.length > 0 && (
                  <div>
                    <p className="mb-1 text-ink-dim">{t("title.subtitles")}</p>
                    <div className="flex flex-wrap gap-1">
                      {libraryMatch.plexMediaInfo.subtitleStreams.map((s, i) => (
                        <span key={i} className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px]">
                          {s.language?.toUpperCase() || s.codec.toUpperCase()}
                          {s.forced ? " (F)" : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {libraryMatch.plexMediaInfo.chapters.length > 0 && (
                  <div>
                    <p className="mb-1 text-ink-dim">{t("title.chapters")} ({libraryMatch.plexMediaInfo.chapters.length})</p>
                  </div>
                )}
              </div>
            </div>
          )}
          <InfoRow label={t("title.originalTitle")} value={detail.originalTitle} />
          <InfoRow label={t("title.status")} value={detail.status} />
          {detail.releaseDateFull && (
            <InfoRow
              label={t(type === "movie" ? "title.releaseDate" : "title.firstAirDate")}
              value={formatFullDate(detail.releaseDateFull, locale)}
              icon={Calendar}
            />
          )}
          {detail.revenue != null && <InfoRow label={t("title.revenue")} value={formatCurrency(detail.revenue, locale)} />}
          {detail.budget != null && <InfoRow label={t("title.budget")} value={formatCurrency(detail.budget, locale)} />}
          <InfoRow label={t("title.originalLanguage")} value={detail.originalLanguage.toUpperCase()} />
          <InfoRow label={t("title.countries")} value={detail.countries.join(", ")} />
          <StudiosRow studios={detail.studios} label={t("title.studios")} showMoreLabel={t("title.showMore")} showLessLabel={t("title.showLessCrew")} />

          {detail.watchProviders.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-ink-dim">{t("title.availableOn")}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {detail.watchProviders.slice(0, 8).map((p) => (
                  <div key={p.providerId} title={p.name} className="h-8 w-8 overflow-hidden rounded-lg border border-white/10 bg-surface">
                    {p.logoPath ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`https://image.tmdb.org/t/p/w92${p.logoPath}`} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-white/5 pt-4">
            {libraryStatus === "available" && libraryMatch?.plexUrl && (
              betaPlayer && libraryMatch?.plexRatingKey ? (
                <button onClick={() => setPlayRatingKey(libraryMatch.plexRatingKey!)} title="Plex" className="h-8 w-8 shrink-0 overflow-hidden rounded-lg transition-transform hover:scale-110">
                  <BrandIcon name="plex" className="h-full w-full" />
                </button>
              ) : (
                <a href={libraryMatch.plexUrl} target="_blank" rel="noreferrer" title="Plex" className="h-8 w-8 shrink-0 overflow-hidden rounded-lg transition-transform hover:scale-110">
                  <BrandIcon name="plex" className="h-full w-full" />
                </a>
              )
            )}
            <a
              href={`https://www.themoviedb.org/${type === "movie" ? "movie" : "tv"}/${detail.tmdbId}`}
              target="_blank" rel="noreferrer" title="TMDb"
              className="h-8 w-8 shrink-0 overflow-hidden rounded-lg transition-transform hover:scale-110"
            >
              <BrandIcon name="tmdb" className="h-full w-full" />
            </a>
            {detail.imdbId && (
              <a href={`https://www.imdb.com/title/${detail.imdbId}`} target="_blank" rel="noreferrer" title="IMDb" className="h-8 w-8 shrink-0 overflow-hidden rounded-lg transition-transform hover:scale-110">
                <BrandIcon name="imdb" className="h-full w-full" />
              </a>
            )}
            <a
              href={`https://www.rottentomatoes.com/search?search=${encodeURIComponent(detail.title)}`}
              target="_blank" rel="noreferrer" title="Rotten Tomatoes"
              className="h-8 w-8 shrink-0 overflow-hidden rounded-lg transition-transform hover:scale-110"
            >
              <BrandIcon name="rottenTomatoes" className="h-full w-full" />
            </a>
            {type === "movie" && (
              <a
                href={`https://letterboxd.com/search/${encodeURIComponent(detail.title)}/`}
                target="_blank" rel="noreferrer" title="Letterboxd"
                className="h-8 w-8 shrink-0 overflow-hidden rounded-lg transition-transform hover:scale-110"
              >
                <BrandIcon name="letterboxd" className="h-full w-full" />
              </a>
            )}
          </div>
        </div>
      </div>

      {showTrailer && detail.trailerKey && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 p-4 pt-[12vh] backdrop-blur-sm"
          onClick={() => setShowTrailer(false)}
        >
          <div className="relative w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowTrailer(false)}
              className="absolute -top-10 right-0 flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft hover:text-ink"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${detail.trailerKey}?autoplay=1`}
                title={t("title.trailer")}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
          </div>
        </div>
      )}

      {showRequestModal && type === "movie" && (
        <RequestMovieModal
          detail={detail}
          onClose={() => setShowRequestModal(false)}
          onRequested={() => { setAdded(true); mutateLibrary(); }}
        />
      )}
      {showRequestModal && type === "series" && (
        <RequestSeriesModal
          detail={detail}
          onClose={() => setShowRequestModal(false)}
          onRequested={() => { setAdded(true); mutateLibrary(); }}
        />
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
      {playRatingKey && libraryMatch?.plexUrl && libraryMatch?.plexRatingKey && (
        <VideoPlayer
          ratingKey={playRatingKey}
          plexUrl={libraryMatch.plexUrl}
          title={detail?.title ?? ""}
          onClose={() => setPlayRatingKey(null)}
          useTranscode={betaPlayer}
        />
      )}
    </div>
  );
}

function InfoRow({ label, value, icon: Icon }: { label: string; value: string; icon?: LucideIcon }) {
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

/** Studios list, collapsed to 3 by default like the rest of the panel's compact rows — a title with a dozen co-production companies shouldn't push everything else down. */
function StudiosRow({ studios, label, showMoreLabel, showLessLabel }: { studios: string[]; label: string; showMoreLabel: string; showLessLabel: string }) {
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

const INTL_LOCALE: Record<string, string> = { fr: "fr-FR", en: "en-US", it: "it-IT", nl: "nl-NL", de: "de-DE" };

function formatFullDate(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(INTL_LOCALE[locale] ?? "fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function formatCurrency(amount: number, locale: string): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale] ?? "fr-FR", { style: "currency", currency: "USD" }).format(amount);
}

function overallSeriesStatus(series: { seasons: { episodes: { monitored: boolean; status: LibraryStatus }[] }[] }): LibraryStatus {
  const episodes = series.seasons.flatMap((s) => s.episodes).filter((e) => e.monitored);
  if (episodes.length === 0) return "missing";
  if (episodes.every((e) => e.status === "available")) return "available";
  if (episodes.some((e) => e.status === "downloading")) return "downloading";
  if (episodes.some((e) => e.status === "searching")) return "searching";
  return "missing";
}
