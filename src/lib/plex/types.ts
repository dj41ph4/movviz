export interface PlexServerConfig {
  hostname: string;
  port: number;
  useSsl: boolean;
  /** The Plex account token of whoever connected the server (usually the owner/admin). */
  adminToken: string | null;
  /** Random per-install identifier Plex requires to tell OAuth sessions apart. */
  clientId: string;
  /** When true, the scheduler periodically imports/matches the real Plex library into Movviz. */
  syncLibrary: boolean;
  /** Master switch for the watchlist-sync scheduled job — off pauses it for every user regardless of their own per-user toggle. */
  watchlistSyncEnabled: boolean;
  /** Synchronisation automatique des markers intro/credits détectés par
   *  Plex (tâche quotidienne). false par défaut : une upgrade ne doit pas
   *  déclencher spontanément un énorme premier scan Plex — l'admin active,
   *  puis lance idéalement une synchronisation complète manuelle. */
  markerSyncEnabled: boolean;
  /** Server's own id — resolved once from /identity, needed to build "Watch on Plex" deep links. */
  machineIdentifier: string | null;
}

/** Marker BRUT Plex (Metadata.Marker) — interne à la couche Plex.
 *  Le player Android ne reçoit jamais ce type : il passe par la
 *  normalisation PlaybackMarker (markerSync.ts) et le store Movviz. */
export interface PlexMarker {
  id: string | null;
  /** "intro" | "credits" côté Plex — d'autres types peuvent apparaître un
   *  jour, le moteur ne conserve que ceux supportés en V1. */
  type: string;
  startTimeOffset: number; // ms
  endTimeOffset: number; // ms
  final: boolean;
  /** version du marker côté Plex (analyse ré-passée), informatif. */
  version: number | null;
}

export interface PlexSection {
  key: string;
  type: "movie" | "show";
  title: string;
}

/** One `<Media>` entry parsed off a Plex item — see parseAllMediaVersions in client.ts. */
export interface PlexMediaVersion {
  file: { path: string; size: number; resolution: string | null };
  videoCodec: string | null;
  audioCodec: string | null;
  hdr: string | null;
}

export interface PlexLibraryItem {
  ratingKey: string;
  tmdbId: number | null;
  title: string;
  year: number | null;
  viewCount: number;
  addedAt: number; // unix seconds, as Plex reports it
  updatedAt: number; // unix seconds — bumps on new episodes/file changes, used for incremental sync
  /** Only present on movies/episodes fetched with a Media/Part payload. */
  file: { path: string; size: number; resolution: string | null } | null;
  /** Video codec from Plex stream analysis (e.g. "HEVC", "H.264"). */
  videoCodec: string | null;
  /** Primary audio codec from Plex stream analysis (e.g. "DTS", "EAC3"). */
  audioCodec: string | null;
  /** HDR type from Plex stream analysis (e.g. "HDR10", "Dolby Vision"). */
  hdr: string | null;
  /**
   * Set only when Plex reports more than one `<Media>` entry for this item
   * (a genuine multi-version title, e.g. 2160p HDR10 + 1080p VF) — absent
   * for the overwhelming majority of single-file items, same convention as
   * `LibraryMovie.versions` on the Movviz side.
   */
  mediaVersions?: PlexMediaVersion[];
  /** Rich media metadata (streams, chapters, container, bitrate). */
  mediaDetail: PlexMediaInfo | null;
}

export interface PlexEpisodeItem extends PlexLibraryItem {
  seasonNumber: number;
  episodeNumber: number;
}

export interface PlexAccount {
  id: string; // Plex account id, stable across the account's lifetime
  uuid: string;
  username: string;
  email: string;
  thumb: string | null;
  authToken: string;
}

export interface PlexFriend {
  id: string;
  username: string;
  email: string;
  thumb: string | null;
}

export interface PlexHomeUser {
  id: string;
  title: string;
  thumb: string | null;
}

export interface PlexWatchlistItem {
  title: string;
  type: "movie" | "series";
  tmdbId: number | null;
  addedAt?: number | null;
  plexGuid?: string | null;
  discoverRatingKey?: string | null;
}

// ── Rich media detail from Plex (streams, chapters, container, bitrate) ──────

export interface PlexVideoStream {
  codec: string;
  bitDepth: number | null;
  chromaSubsampling: string | null;
  frameRate: string | null;
  width: number | null;
  height: number | null;
  language: string | null;
}

export interface PlexAudioStream {
  codec: string;
  channels: number | null;
  layout: string | null;
  bitrate: number | null;
  language: string | null;
  title: string | null;
  selected: boolean;
}

export interface PlexSubtitleStream {
  codec: string;
  language: string | null;
  title: string | null;
  forced: boolean;
  selected: boolean;
}

export interface PlexChapter {
  title: string | null;
  startTimeOffset: number; // milliseconds
}

export interface PlexCollectionSummary {
  ratingKey: string;
  title: string;
  thumb: string | null;
  childCount: number;
  sectionKey: string;
}

export interface PlexMediaInfo {
  container: string | null;
  bitrate: number | null; // kbps
  videoStreams: PlexVideoStream[];
  audioStreams: PlexAudioStream[];
  subtitleStreams: PlexSubtitleStream[];
  chapters: PlexChapter[];
}
