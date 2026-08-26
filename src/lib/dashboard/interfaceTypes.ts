import type { DashboardWidgetId } from "@/lib/dashboard/types";
import type { LibraryMovie, LibraryStatus } from "@/lib/library/types";

export interface DashboardFileTechnical {
  resolution: string | null;
  videoCodec: string | null;
  audioCodec: string | null;
  hdr: string | null;
}

export interface DashboardLibraryMovie {
  id: string;
  tmdbId: number;
  title: string;
  year: number | null;
  releaseDate: string | null;
  vfReleaseDate: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  customBackdropPath?: string | null;
  customLogoPath?: string | null;
  rating: number;
  runtime: number | null;
  genres: string[];
  status: LibraryStatus;
  file: DashboardFileTechnical | null;
  activeInfoHash: string | null;
  addedAt: number;
  plexRatingKey: string | null;
  plexUrl?: string | null;
}

export interface DashboardLibrarySeries {
  id: string;
  tmdbId: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  backdropPath: string | null;
  customBackdropPath?: string | null;
  customLogoPath?: string | null;
  rating: number;
  genres: string[];
  addedAt: number;
  hasAvailableEpisode: boolean;
}

/** A concrete file that arrived in a series.  This deliberately models an
 * episode rather than just its parent show so editorial shelves can answer
 * the useful question “what is new to watch?” without loading every full
 * season tree into the dashboard. */
export interface DashboardRecentEpisode {
  seriesId: string;
  tmdbId: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  backdropPath: string | null;
  customBackdropPath?: string | null;
  customLogoPath?: string | null;
  rating: number;
  genres: string[];
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string;
  addedAt: number;
  plexRatingKey: string | null;
  plexUrl?: string | null;
  file: DashboardFileTechnical | null;
}

export interface DashboardInterfaceData {
  movies: DashboardLibraryMovie[];
  series: DashboardLibrarySeries[];
  widgetValues: Record<DashboardWidgetId, number>;
  compactRecentMovies: LibraryMovie[];
  recentEpisodes: DashboardRecentEpisode[];
}
