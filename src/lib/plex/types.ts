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
  /** Server's own id — resolved once from /identity, needed to build "Watch on Plex" deep links. */
  machineIdentifier: string | null;
}

export interface PlexSection {
  key: string;
  type: "movie" | "show";
  title: string;
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

export interface PlexMediaInfo {
  container: string | null;
  bitrate: number | null; // kbps
  videoStreams: PlexVideoStream[];
  audioStreams: PlexAudioStream[];
  subtitleStreams: PlexSubtitleStream[];
  chapters: PlexChapter[];
}
