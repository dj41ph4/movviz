"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { ChevronDown, Check, Clock, HardDriveDownload, Search, Loader2, ListFilter, Eye, Calendar } from "lucide-react";
import type { LibraryStatus, LibraryFile } from "@/lib/library/types";
import { MediaBadges } from "@/components/library/MediaBadges";

const STATUS_ICON: Record<LibraryStatus, React.ElementType> = {
  available: Check,
  downloading: HardDriveDownload,
  searching: Search,
  missing: Clock,
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

const STATUS_TONE: Record<LibraryStatus, string> = {
  available: "text-ok bg-ok/12 border-ok/25",
  downloading: "text-cyan bg-cyan/12 border-cyan/25",
  searching: "text-brand-glow bg-brand/12 border-brand/25",
  missing: "text-amber bg-amber/12 border-amber/25",
};

const STATUS_LABEL: Record<LibraryStatus, string> = {
  available: "available",
  downloading: "downloading",
  searching: "searching",
  missing: "missing",
};

function seasonStatus(librarySeason: LibrarySeasonInfo | undefined): LibraryStatus {
  if (!librarySeason || !librarySeason.episodes) return "missing";
  const monitored = librarySeason.episodes.filter((e) => e.monitored);
  if (monitored.length === 0) return "missing";
  if (monitored.every((e) => e.status === "available")) return "available";
  if (monitored.some((e) => e.status === "downloading" || e.status === "searching")) return "downloading";
  return "missing";
}

export function SeasonAccordion({
  seriesId,
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
  /** Internal library id (not the TMDb id) — needed to link into the
   *  episode-detail sub-route, which is still keyed by it. */
  seriesId?: string;
  seasons: SeasonInfo[];
  librarySeasons?: LibrarySeasonInfo[];
  onSearchSeason?: (seasonNumber: number) => void;
  onManualSearchSeason?: (seasonNumber: number) => void;
  onSearchEpisode?: (seasonNumber: number, episodeNumber: number) => void;
  onManualSearchEpisode?: (seasonNumber: number, episodeNumber: number) => void;
  searchingSeason?: number | null;
  /** `"${season}.${episode}"` of the episode currently being searched, if any. */
  searchingEpisodeKey?: string | null;
  /** `"${season}.${episode}"` keys of episodes already watched. */
  watchedEpisodes?: Set<string>;
}) {
  const t = useT();
  const [expanded, setExpanded] = useState<number | null>(null);

  // When the library has more seasons than TMDb (e.g. after a TVDB resync
  // for anime), derive the visible list from the library data so every
  // season the user owns actually shows up in the UI.
  const effectiveSeasons = useMemo(() => {
    if (librarySeasons && librarySeasons.length > seasons.length) {
      return librarySeasons.map((ls) => ({
        seasonNumber: ls.seasonNumber ?? 0,
        name: seasons.find((s) => s.seasonNumber === ls.seasonNumber)?.name ?? `Saison ${ls.seasonNumber}`,
        episodeCount: ls.episodes.length,
      }));
    }
    return seasons;
  }, [seasons, librarySeasons]);

  const sorted = [...effectiveSeasons].sort((a, b) => b.seasonNumber - a.seasonNumber);

  return (
    <div className="space-y-2">
      {sorted.map((season) => {
        const libSeason = librarySeasons?.find((s) => s.seasonNumber === season.seasonNumber);
        const status = seasonStatus(libSeason);
        const isExpanded = expanded === season.seasonNumber;
        const StatusIcon = STATUS_ICON[status];
        const monitored = (libSeason?.episodes ?? []).filter((e) => e.monitored);
        const available = monitored.filter((e) => e.status === "available").length;

        // Several episodes sharing the same activeInfoHash means one torrent
        // covers all of them — a season pack, or a fallback grab that pulled
        // the pack for a single missing episode. Surface that as one banner
        // instead of identical "downloading" badges on each episode.
        const packCounts = new Map<string, number>();
        for (const e of libSeason?.episodes ?? []) {
          if (e.status === "downloading" && e.activeInfoHash) {
            packCounts.set(e.activeInfoHash, (packCounts.get(e.activeInfoHash) ?? 0) + 1);
          }
        }
        const packCount = [...packCounts.values()].find((c) => c >= 2) ?? null;

        return (
          <div key={season.seasonNumber} className="rounded-xl glass overflow-hidden">
            {/* A <div role="button">, not a nested <button> — the season's own
                search buttons live inside this clickable row, and a <button>
                can't legally contain another <button> in HTML (React logs a
                hydration error for it). Keyboard behavior is preserved via
                tabIndex + onKeyDown. */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => setExpanded(isExpanded ? null : season.seasonNumber)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setExpanded(isExpanded ? null : season.seasonNumber);
                }
              }}
              className="flex w-full cursor-pointer flex-col gap-2 p-4 transition-colors hover:bg-white/5 sm:flex-row sm:items-center sm:gap-3"
            >
              {/* Line 1 on mobile (name + status — the two things worth seeing
                  at a glance); on sm+ this and the line below become plain
                  flex items of the row above via `contents`, restoring the
                  original single-row layout. */}
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
              {/* Line 2 on mobile (counts + action icons). */}
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

            <AnimatePresence initial={false}>
              {isExpanded && libSeason && (
              <motion.div
                key="content"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="overflow-hidden"
              >
              <div className="border-t border-white/5 px-4 pb-3 pt-2">
                {packCount != null && (
                  <div className="mb-2 flex items-center gap-2 rounded-lg border border-cyan/25 bg-cyan/12 px-3 py-2 text-xs font-semibold text-cyan">
                    <HardDriveDownload className="h-3.5 w-3.5" />
                    {t("library.seasonPackDownloading", { count: packCount })}
                  </div>
                )}
                {libSeason.episodes.length === 0 ? (
                  <p className="py-4 text-center text-sm text-ink-dim">{t("title.noEpisodes")}</p>
                ) : (
                  <div className="space-y-1">
                    {libSeason.episodes.map((ep, idx) => {
                      const epNumber = ep.episodeNumber ?? idx + 1;
                      const epKey = `${season.seasonNumber}.${epNumber}`;
                      const watched = watchedEpisodes?.has(epKey) ?? false;
                      const rowContent = (
                        <>
      <span className="w-8 text-center text-xs font-bold text-ink-dim">{epNumber}</span>
      <span className="min-w-0 flex-1 truncate text-sm text-ink">{ep.title ?? `${t("title.episode")} ${epNumber}`}</span>
      {(ep.status === "available" || ep.status === "downloading") && <MediaBadges file={ep.file} className="relative static" variant="surface" />}
      {watched && (
                            <span title={t("watch.watched")} className="flex shrink-0 items-center gap-1 rounded-full border border-ok/25 bg-ok/12 px-2 py-0.5 text-[10px] font-semibold text-ok">
                              <Eye className="h-2.5 w-2.5" />
                            </span>
                          )}
                          {ep.airDate && (
                            <span className="flex shrink-0 items-center gap-1 text-[11px] text-ink-dim">
                              <Calendar className="h-2.5 w-2.5" /> {new Date(ep.airDate).toLocaleDateString()}
                            </span>
                          )}
                          <span className={cn(
                            "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold",
                            STATUS_TONE[ep.status]
                          )}>
                            {t(`status.${ep.status}`)}
                          </span>
                        </>
                      );
                      return (
                        <div key={idx} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/5">
                          {seriesId && ep.episodeNumber != null ? (
                            <Link
                              href={`/library/series/${seriesId}/season/${season.seasonNumber}/episode/${ep.episodeNumber}`}
                              className="flex min-w-0 flex-1 items-center gap-3"
                            >
                              {rowContent}
                            </Link>
                          ) : (
                            <div className="flex min-w-0 flex-1 items-center gap-3">{rowContent}</div>
                          )}
                          {ep.status !== "downloading" && ep.status !== "searching" && ep.episodeNumber != null && (
                            <>
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
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
