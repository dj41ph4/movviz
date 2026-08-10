"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import useSWR from "swr";

import { useI18n } from "@/i18n/provider";
import { cn, formatDate } from "@/lib/utils";
import { ChevronDown, Check, Clock, HardDriveDownload, Search, Loader2, ListFilter, Eye, Calendar } from "lucide-react";
import type { LibraryStatus, LibraryFile } from "@/lib/library/types";
import { MediaBadges } from "@/components/library/MediaBadges";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const STATUS_ICON: Record<LibraryStatus, React.ElementType> = {
  available: Check,
  downloading: HardDriveDownload,
  searching: Search,
  missing: Clock,
  upcoming: Calendar,
};

interface SeasonInfo {
  seasonNumber: number;
  name: string;
  episodeCount: number;
}

interface LibraryEpisodeInfo {
  monitored: boolean;
  status: LibraryStatus;
  episodeNumber?: number;
  title?: string;
  airDate?: string | null;
  activeInfoHash?: string | null;
  file?: LibraryFile | null;
}

interface LibrarySeasonInfo {
  seasonNumber?: number;
  monitored?: boolean;
  episodes: LibraryEpisodeInfo[];
}

interface TmdbEpisode {
  episodeNumber: number;
  title: string;
  airDate: string | null;
  overview?: string;
  stillPath?: string | null;
}

interface TmdbSeasonData {
  episodes: TmdbEpisode[];
}

const STATUS_TONE: Record<LibraryStatus, string> = {
  available: "text-ok bg-ok/12 border-ok/25",
  downloading: "text-cyan bg-cyan/12 border-cyan/25",
  searching: "text-brand-glow bg-brand/12 border-brand/25",
  missing: "text-amber bg-amber/12 border-amber/25",
  upcoming: "text-ink-dim bg-white/6 border-white/10",
};

const STATUS_LABEL: Record<LibraryStatus, string> = {
  available: "available",
  downloading: "downloading",
  searching: "searching",
  missing: "missing",
  upcoming: "upcoming",
};

function seasonStatus(librarySeason: LibrarySeasonInfo | undefined): LibraryStatus {
  if (!librarySeason || !librarySeason.episodes) return "missing";
  const monitored = librarySeason.episodes.filter((e) => e.monitored);
  if (monitored.length === 0) return "missing";
  if (monitored.every((e) => e.status === "upcoming")) return "upcoming";
  if (monitored.some((e) => e.status === "downloading" || e.status === "searching")) return "downloading";
  if (monitored.every((e) => e.status === "available" || e.status === "upcoming")) return "available";
  return "missing";
}

function SeasonRow({
  season,
  libSeason,
  seriesId,
  tmdbId,
  isExpanded,
  onToggle,
  onSearchSeason,
  onManualSearchSeason,
  onSearchEpisode,
  onManualSearchEpisode,
  searchingSeason,
  searchingEpisodeKey,
  watchedEpisodes,
}: {
  season: SeasonInfo;
  libSeason: LibrarySeasonInfo | undefined;
  seriesId?: string;
  tmdbId?: number;
  isExpanded: boolean;
  onToggle: () => void;
  onSearchSeason?: (n: number) => void;
  onManualSearchSeason?: (n: number) => void;
  onSearchEpisode?: (s: number, e: number) => void;
  onManualSearchEpisode?: (s: number, e: number) => void;
  searchingSeason?: number | null;
  searchingEpisodeKey?: string | null;
  watchedEpisodes?: Set<string>;
}) {
  const { t, locale } = useI18n();
  const status = seasonStatus(libSeason);
  const StatusIcon = STATUS_ICON[status];
  const monitored = (libSeason?.episodes ?? []).filter((e) => e.monitored);
  const available = monitored.filter((e) => e.status === "available").length;

  const packCounts = new Map<string, number>();
  for (const e of libSeason?.episodes ?? []) {
    if (e.status === "downloading" && e.activeInfoHash) {
      packCounts.set(e.activeInfoHash, (packCounts.get(e.activeInfoHash) ?? 0) + 1);
    }
  }
  const packCount = [...packCounts.values()].find((c) => c >= 2) ?? null;

  // Fetched regardless of ownership now — owned seasons only have
  // number/title/airDate/status stored locally (LibraryEpisode has no
  // stillPath/overview column), so the thumbnail+synopsis shown below for
  // owned episodes is merged in live from this same TMDb call rather than
  // requiring a schema change or a separate backfill.
  const tmdbKey = isExpanded && tmdbId
    ? `/api/metadata/season?tmdbId=${tmdbId}&season=${season.seasonNumber}`
    : null;
  const { data: tmdbSeason, isLoading: tmdbLoading } = useSWR<TmdbSeasonData>(tmdbKey, fetcher);
  const tmdbByEpisode = useMemo(() => {
    const m = new Map<number, TmdbEpisode>();
    for (const e of tmdbSeason?.episodes ?? []) m.set(e.episodeNumber, e);
    return m;
  }, [tmdbSeason]);

  return (
    <div className="rounded-xl glass overflow-hidden">
      {/* A <div role="button">, not a nested <button> — the season's own
          search buttons live inside this clickable row, and a <button>
          can't legally contain another <button> in HTML (React logs a
          hydration error for it). Keyboard behavior is preserved via
          tabIndex + onKeyDown. */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
        className="flex w-full cursor-pointer outline-none flex-col gap-2 p-4 transition-colors hover:bg-white/5 sm:flex-row sm:items-center sm:gap-3"
      >
        <div className="flex items-center gap-3 sm:contents">
          <ChevronDown className={cn("h-5 w-5 shrink-0 text-ink-dim transition-transform", isExpanded && "rotate-180")} />
          <span className="shrink-0 whitespace-nowrap font-bold text-ink">{season.name}</span>
          <span className={cn(
            "ml-auto shrink-0 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[10px] font-bold sm:ml-auto sm:order-last",
            STATUS_TONE[status]
          )}>
            <StatusIcon className="mr-1 inline h-3 w-3" />
            {t(`status.${STATUS_LABEL[status]}`)}
          </span>
        </div>
        <div className="flex items-center gap-3 pl-8 sm:contents sm:pl-0">
          <span className="shrink-0 whitespace-nowrap rounded-full bg-surface px-2.5 py-0.5 text-xs font-semibold text-ink-dim">
            {season.episodeCount} {t("title.episodes")}
          </span>
          {libSeason && monitored.length > 0 && (
            <span className="shrink-0 whitespace-nowrap text-xs text-ink-dim">{available}/{monitored.length}</span>
          )}
          {onSearchSeason && libSeason && (
            <button
              onClick={(e) => { e.stopPropagation(); onSearchSeason(season.seasonNumber); }}
              disabled={searchingSeason === season.seasonNumber}
              title={t("library.autoSearch")}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg glass-strong text-cyan disabled:opacity-40"
            >
              {searchingSeason === season.seasonNumber ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            </button>
          )}
          {onManualSearchSeason && libSeason && (
            <button
              onClick={(e) => { e.stopPropagation(); onManualSearchSeason(season.seasonNumber); }}
              title={t("library.manualSearch")}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg glass-strong text-ink-soft hover:text-ink"
            >
              <ListFilter className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div
        style={{
          maxHeight: isExpanded ? "9999px" : "0",
          overflow: "hidden",
          opacity: isExpanded ? 1 : 0,
          transition: "max-height 0.3s ease-in-out, opacity 0.2s ease-in-out",
        }}
      >
        <div className="border-t border-white/5 px-4 pb-3 pt-2">
          {libSeason ? (
            <>
              {packCount != null && (
                <div className="mb-2 flex items-center gap-2 rounded-lg border border-cyan/25 bg-cyan/12 px-3 py-2 text-xs font-semibold text-cyan">
                  <HardDriveDownload className="h-3.5 w-3.5" />
                  {t("library.seasonPackDownloading", { count: packCount })}
                </div>
              )}
              {libSeason.episodes.length === 0 ? (
                <p className="py-4 text-center text-sm text-ink-dim">{t("title.noEpisodes")}</p>
              ) : (
                <div className="space-y-1.5">
                  {libSeason.episodes.map((ep, idx) => {
                    const epNumber = ep.episodeNumber ?? idx + 1;
                    const epKey = `${season.seasonNumber}.${epNumber}`;
                    const watched = watchedEpisodes?.has(epKey) ?? false;
                    const tmdbEp = tmdbByEpisode.get(epNumber);
                    const rowContent = (
                      <>
                        <span className="w-6 shrink-0 pt-2 text-center text-xs font-bold text-ink-dim">{epNumber}</span>
                        {tmdbEp?.stillPath ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`/tmdb/w300${tmdbEp.stillPath}`}
                            alt=""
                            loading="lazy"
                            className="h-14 w-24 shrink-0 rounded-lg object-cover sm:h-16 sm:w-28"
                          />
                        ) : (
                          <div className="flex h-14 w-24 shrink-0 items-center justify-center rounded-lg bg-surface text-ink-dim sm:h-16 sm:w-28">
                            <Calendar className="h-4 w-4 opacity-40" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1 py-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{ep.title ?? `${t("title.episode")} ${epNumber}`}</span>
                            {(ep.status === "available" || ep.status === "downloading") && <MediaBadges file={ep.file} className="relative static" variant="surface" />}
                            {watched && (
                              <span title={t("watch.watched")} className="flex shrink-0 items-center gap-1 rounded-full border border-ok/25 bg-ok/12 px-2 py-0.5 text-[10px] font-semibold text-ok">
                                <Eye className="h-2.5 w-2.5" />
                              </span>
                            )}
                            {ep.airDate && (
                              <span className="flex shrink-0 items-center gap-1 text-[11px] text-ink-dim">
                                <Calendar className="h-2.5 w-2.5" /> {formatDate(ep.airDate, locale)}
                              </span>
                            )}
                            <span className={cn(
                              "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold",
                              STATUS_TONE[ep.status]
                            )}>
                              {t(`status.${ep.status}`)}
                            </span>
                          </div>
                          {tmdbEp?.overview && <p className="mt-0.5 line-clamp-2 text-xs text-ink-dim">{tmdbEp.overview}</p>}
                        </div>
                      </>
                    );
                    return (
                      <div key={idx} className="flex items-start gap-3 rounded-lg px-3 py-2 hover:bg-white/5">
                        {seriesId && ep.episodeNumber != null ? (
                          <Link
                            href={`/library/series/${seriesId}/season/${season.seasonNumber}/episode/${ep.episodeNumber}`}
                            className="flex min-w-0 flex-1 items-start gap-3"
                          >
                            {rowContent}
                          </Link>
                        ) : (
                          <div className="flex min-w-0 flex-1 items-start gap-3">{rowContent}</div>
                        )}
                        {ep.status !== "downloading" && ep.status !== "searching" && ep.episodeNumber != null && (
                          <div className="flex shrink-0 items-center gap-2 self-center">
                            {onSearchEpisode && (
                              <button
                                onClick={() => onSearchEpisode(season.seasonNumber, ep.episodeNumber!)}
                                disabled={searchingEpisodeKey === epKey}
                                title={t("library.autoSearch")}
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg glass-strong text-brand-glow disabled:opacity-50"
                              >
                                {searchingEpisodeKey === epKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                              </button>
                            )}
                            {onManualSearchEpisode && (
                              <button
                                onClick={() => onManualSearchEpisode(season.seasonNumber, ep.episodeNumber!)}
                                title={t("library.manualSearch")}
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg glass-strong text-ink-soft hover:text-ink"
                              >
                                <ListFilter className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : tmdbLoading ? (
            <div className="space-y-1 py-1">
              {Array.from({ length: Math.min(season.episodeCount, 5) }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2">
                  <div className="h-3 w-6 rounded bg-white/8 animate-pulse" />
                  <div className="h-3 flex-1 rounded bg-white/8 animate-pulse" style={{ maxWidth: `${50 + (i % 3) * 15}%` }} />
                </div>
              ))}
            </div>
          ) : tmdbSeason?.episodes?.length ? (
            <div className="space-y-1.5">
              {tmdbSeason.episodes.map((ep) => (
                <div key={ep.episodeNumber} className="flex items-start gap-3 rounded-lg p-2 hover:bg-white/5">
                  <span className="w-6 shrink-0 pt-2 text-center text-xs font-bold text-ink-dim">{ep.episodeNumber}</span>
                  {ep.stillPath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/tmdb/w300${ep.stillPath}`}
                      alt=""
                      loading="lazy"
                      className="h-14 w-24 shrink-0 rounded-lg object-cover sm:h-16 sm:w-28"
                    />
                  ) : (
                    <div className="flex h-14 w-24 shrink-0 items-center justify-center rounded-lg bg-surface text-ink-dim sm:h-16 sm:w-28">
                      <Calendar className="h-4 w-4 opacity-40" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1 py-0.5">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{ep.title || `${t("title.episode")} ${ep.episodeNumber}`}</span>
                      {ep.airDate && (
                        <span className="flex shrink-0 items-center gap-1 text-[11px] text-ink-dim">
                          <Calendar className="h-2.5 w-2.5" /> {formatDate(ep.airDate, locale)}
                        </span>
                      )}
                    </div>
                    {ep.overview && <p className="mt-0.5 line-clamp-2 text-xs text-ink-dim">{ep.overview}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-ink-dim">{t("title.noEpisodes")}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function SeasonAccordion({
  seriesId,
  tmdbId,
  seasons,
  librarySeasons,
  onSearchSeason,
  onManualSearchSeason,
  onSearchEpisode,
  onManualSearchEpisode,
  searchingSeason,
  searchingEpisodeKey,
  watchedEpisodes,
}: {
  seriesId?: string;
  tmdbId?: number;
  seasons: SeasonInfo[];
  librarySeasons?: LibrarySeasonInfo[];
  onSearchSeason?: (seasonNumber: number) => void;
  onManualSearchSeason?: (seasonNumber: number) => void;
  onSearchEpisode?: (seasonNumber: number, episodeNumber: number) => void;
  onManualSearchEpisode?: (seasonNumber: number, episodeNumber: number) => void;
  searchingSeason?: number | null;
  searchingEpisodeKey?: string | null;
  watchedEpisodes?: Set<string>;
}) {
  const { t, locale } = useI18n();
  const [expanded, setExpanded] = useState<number | null>(null);

  // When the library has more seasons than TMDb (e.g. after a TVDB resync
  // for anime), derive the visible list from the library data so every
  // season the user owns actually shows up in the UI.
  const effectiveSeasons = useMemo(() => {
    if (librarySeasons && librarySeasons.length > seasons.length) {
      return librarySeasons.map((ls) => ({
        seasonNumber: ls.seasonNumber ?? 0,
        name: seasons.find((s) => s.seasonNumber === ls.seasonNumber)?.name ?? `${t("title.season")} ${ls.seasonNumber}`,
        episodeCount: ls.episodes.length,
      }));
    }
    return seasons;
  }, [seasons, librarySeasons, t]);

  const sorted = [...effectiveSeasons].sort((a, b) => b.seasonNumber - a.seasonNumber);

  return (
    <div className="space-y-2">
      {sorted.map((season) => {
        const libSeason = librarySeasons?.find((s) => s.seasonNumber === season.seasonNumber);
        return (
          <SeasonRow
            key={season.seasonNumber}
            season={season}
            libSeason={libSeason}
            seriesId={seriesId}
            tmdbId={tmdbId}
            isExpanded={expanded === season.seasonNumber}
            onToggle={() => setExpanded(expanded === season.seasonNumber ? null : season.seasonNumber)}
            onSearchSeason={onSearchSeason}
            onManualSearchSeason={onManualSearchSeason}
            onSearchEpisode={onSearchEpisode}
            onManualSearchEpisode={onManualSearchEpisode}
            searchingSeason={searchingSeason}
            searchingEpisodeKey={searchingEpisodeKey}
            watchedEpisodes={watchedEpisodes}
          />
        );
      })}
    </div>
  );
}
