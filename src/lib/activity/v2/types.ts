export type ActivityKind =
  | "requested"      // Demande créée par un utilisateur
  | "approved"      // Demande approuvée par un admin
  | "declined"      // Demande refusée par un admin
  | "searching"     // Recherche en cours pour ce média
  | "grabbed"       // Release récupérée depuis un indexeur
  | "downloading"   // Téléchargement en cours (avec progression)
  | "importing"     // Import en cours dans la bibliothèque
  | "imported"      // Import terminé avec succès
  | "upgraded"      // Mise à niveau qualité réussie
  | "failed"        // Échec à n'importe quelle étape
  | "removed"       // Suppression manuelle
  | "blocked";      // Release bloquée manuellement

export interface ActivityMedia {
  id: string;
  title: string;
  type: "movie" | "series";
  season?: number;
  episode?: number;
  /** Number of episodes sharing this same torrent (a season pack) — omitted/1 for a single episode. */
  packEpisodeCount?: number;
  /** Number of distinct seasons covered by this same torrent (a complete-series pack) — set alongside packEpisodeCount when the download is a whole-series intégrale. */
  seasonCount?: number;
  posterPath?: string | null;
  href: string;
  tmdbId?: number;
  /** False only for a torrent the engine has no library association for at
   *  all (no matching activeInfoHash, no resolvable libraryRef — e.g. added
   *  by hand outside Movviz's own search/grab flow, or the release title
   *  never matched anything). `title` is then just a best-effort guess
   *  parsed from the raw torrent name, not a confirmed library match —
   *  omitted (implicitly true) everywhere else. */
  linked?: boolean;
}

export interface ActivityRelease {
  indexer: string;
  releaseTitle: string;
  protocol: "torrent" | "usenet";
  size: number;
  seeders?: number;
  leechers?: number;
  age?: number;
  score: number;
  quality: string;
  customFormats: string[];
}

export interface ActivityDownload {
  client: string;
  infoHash?: string;
  progress: number;
  downloadSpeed: number;
  uploadSpeed: number;
  eta: number; // seconds
  ratio: number;
  peers: number;
  state: "downloading" | "paused" | "queued" | "completed" | "seeding" | "stalled";
}

export interface ActivityImport {
  destinationPath: string;
  fileSize: number;
  fileName: string;
  qualityDetected: string;
  languages: string[];
  subtitles: string[];
}

export interface ActivityFailureReason {
  code:
    | "quality_profile_mismatch"
    | "custom_format_score_too_low"
    | "blocked_word"
    | "duplicate"
    | "size_too_large"
    | "size_too_small"
    | "no_files"
    | "unrecognized_files"
    | "disk_space"
    | "permission_denied"
    | "import_failed"
    | "download_failed"
    | "timeout"
    | "manual_block"
    | "no_indexers"
    | "no_release_found";
  message: string;
  details?: Record<string, unknown>;
}

export interface ActivityEntry {
  id: string;
  kind: ActivityKind;
  media: ActivityMedia;
  actor: string; // username ou "system"
  timestamp: number;
  release?: ActivityRelease;
  download?: ActivityDownload;
  import?: ActivityImport;
  failure?: ActivityFailureReason;
  metadata?: {
    requestId?: string;
    requester?: string;
    profile?: string;
    cutoff?: string;
    [key: string]: unknown;
  };
}

// Timeline complète pour un média
export interface MediaTimeline {
  media: ActivityMedia;
  events: ActivityEntry[];
  currentStatus: {
    state: "pending" | "downloading" | "importing" | "available" | "failed" | "blocked";
    progress?: number;
    eta?: number;
    error?: string;
  };
}

// État de la queue
export interface QueueItem {
  id: string;
  media: ActivityMedia;
  release: ActivityRelease;
  download: ActivityDownload;
  status: "queued" | "downloading" | "paused" | "importing" | "seeding" | "completed" | "failed" | "stalled";
  priority?: "high" | "medium" | "low";
  /** Manual post-completion seed toggle — only meaningful when status === "completed";
   *  distinct from the transitional "seeding" status above (torrent finished
   *  downloading but not yet marked completed). Never true for anything else. */
  seeding?: boolean;
  addedAt: number;
  estimatedCompletion?: number;
}

// Filtres pour l'historique
export type HistoryFilter =
  | "all"
  | "movies"
  | "series"
  | "requests"
  | "searches"
  | "grabs"
  | "downloads"
  | "imports"
  | "failures"
  | "upgrades"
  | "removals"
  | "user"
  | "indexer";

export interface HistoryFilters {
  types: HistoryFilter[];
  users?: string[];
  indexers?: string[];
  dateRange?: { from: number; to: number };
  search?: string;
  status?: "success" | "failed" | "blocked";
}

// Wanted item avec cutoff
export interface WantedItem {
  media: ActivityMedia;
  monitored: boolean;
  status: "missing" | "cutoff_unmet";
  currentQuality?: string;
  targetQuality: string;
  releaseDate?: string;
  lastSearch?: number;
  nextSearch?: number;
  availableReleases?: ActivityRelease[];
}