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

export interface DashboardInterfaceData {
  movies: DashboardLibraryMovie[];
  series: DashboardLibrarySeries[];
  widgetValues: Record<DashboardWidgetId, number>;
  compactRecentMovies: LibraryMovie[];
}
