/**
 * Movviz unified domain model.
 *
 * A single coherent model that lets one UI reason about the full media
 * lifecycle end to end: discover → request → index → grab → library.
 * Indexing, movies, series and requests all share these types so nothing is
 * siloed the way legacy tools split them across separate apps.
 */

export type MediaType = "movie" | "series";

export type MediaStatus =
  | "available" // present & playable in the library
  | "downloading" // grab in progress
  | "monitored" // watched for new/better releases
  | "wanted" // monitored but not yet found
  | "requested" // user asked for it, awaiting approval/search
  | "declined"; // request rejected

export type Protocol = "torrent" | "usenet";

export interface Genre {
  id: number;
  name: string;
}

export interface MediaItem {
  id: string;
  tmdbId: number;
  type: MediaType;
  title: string;
  year: number;
  overview: string;
  posterPath: string | null; // TMDB-style path, e.g. /abc.jpg
  backdropPath: string | null;
  rating: number; // 0..10
  genres: string[];
  status: MediaStatus;
  quality: string; // e.g. "2160p", "1080p Bluray"
  progress?: number; // 0..100 when downloading
  runtime?: number; // minutes (movie) or avg episode (series)
  seasons?: number; // series only
  addedAt?: string; // ISO
  accent?: string; // hero tint hint
}

export interface Indexer {
  id: string;
  name: string;
  protocol: Protocol;
  status: "healthy" | "degraded" | "down";
  latencyMs: number;
  categories: string[];
  grabs: number; // total grabs routed
  enabled: boolean;
  priority: number;
}

/**
 * A download client instance bound to a single media category. Movies and
 * series each run their own independent instance — separate client, folders,
 * limits and priorities — but all are administered from one place. This is the
 * "unified, yet independent per category" model.
 */
export interface DownloadInstance {
  id: string;
  category: MediaType; // one instance per category
  name: string;
  client: string; // engine/client name
  protocol: Protocol;
  downloadPath: string;
  completedPath: string;
  maxActive: number;
  speedLimitMbps: number | null; // null = unlimited
  seedRatio: number;
  autoStart: boolean; // launch this instance when the service boots
  status: "healthy" | "degraded" | "down";
  active: number; // current active transfers
}

/** Live torrent as reported by the download engine (port 9820). */
export interface EngineTorrent {
  infoHash: string;
  name: string;
  magnetURI: string;
  instanceId: string;
  category: MediaType;
  state: "metadata" | "downloading" | "seeding" | "paused" | "queued" | "stalled" | "completed";
  progress: number; // 0..1
  size: number; // bytes
  downloaded: number;
  uploaded: number;
  ratio: number;
  downloadSpeed: number; // bytes/s
  uploadSpeed: number;
  numPeers: number;
  timeRemaining: number | null; // ms
  sequential: boolean;
  savePath: string;
  addedAt: number | null;
  completedAt: number | null;
  files?: { name: string; length: number; progress: number }[];
  /** Links this torrent to a monitored library entry, e.g. "movie:mv_xxx". */
  libraryRef: string | null;
  /** True for a torrent restored from history after a restart — already imported, no live transfer behind it. */
  imported?: boolean;
}

/** Live instance summary from the engine. */
export interface EngineInstance {
  id: string;
  category: MediaType;
  name: string;
  downloadPath: string;
  completedPath: string;
  maxActive: number;
  downloadLimitKbps: number;
  uploadLimitKbps: number;
  seedRatio: number;
  sequential: boolean;
  autoStart: boolean;
  autoMoveOnComplete: boolean;
  dht: boolean;
  pex: boolean;
  maxPeers: number;
  uploadSlots: number;
  active: number;
  seeding: number;
  total: number;
  downloadSpeed: number;
  uploadSpeed: number;
  /** Set when the instance's folders can't be created/written — the engine
   * stays up but downloads are blocked until the paths are fixed. */
  folderError?: string | null;
}

export interface DownloadItem {
  id: string;
  title: string;
  mediaType: MediaType;
  client: string; // nom du client externe (ex. qBittorrent)
  protocol: Protocol;
  progress: number; // 0..100
  sizeGb: number;
  speedMbps: number;
  etaMinutes: number;
  status: "downloading" | "queued" | "paused" | "completed" | "stalled";
  indexer: string;
}

export interface RequestItem {
  id: string;
  media: MediaItem;
  user: { name: string; avatarHue: number };
  requestedAt: string; // ISO
  status: "pending" | "approved" | "declined" | "available";
}

export interface ActivityEvent {
  id: string;
  kind: "grab" | "import" | "request" | "upgrade" | "health";
  title: string;
  detail: string;
  at: string; // ISO
}

export interface ServiceHealth {
  id: string;
  label: string; // Indexers, Downloaders, Discovery...
  status: "healthy" | "degraded" | "down";
  detail: string;
}
