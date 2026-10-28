import fs from "node:fs";
import path from "node:path";

/** Movviz-owned files only. Never recursively remove a directory that may hold media. */
export const RESET_STORE_FILES = [
  "activity-v2.json",
  "activity.json",
  "ai-debug-log.json",
  "ai-memory.json",
  "ai-model-probes.json",
  "ai-pick-of-the-day.json",
  "ai-presence.json",
  "ai-scene-cache.json",
  "ai-sessions.json",
  "ai-title-analysis.json",
  "ai-user-profiles.json",
  "ai.json",
  "anthology-pending-deletions.json",
  "auto-update.json",
  "automation-config.json",
  "beta-player.json",
  "blocked-releases.json",
  "blocked-youtube-videos.json",
  "blocklist.json",
  "c411-tmdb-cache.json",
  "cdn-images.json",
  "collections.json",
  "customFormats.json",
  "dashboards.json",
  "decision-log.json",
  "device-preferences.json",
  "discover-layout.json",
  "disk-scan-state.json",
  "failed-releases.json",
  "import-lists.json",
  "indexers.json",
  "job-priorities.json",
  "library-health-report.json",
  "library-movies.json",
  "library-series.json",
  "library-trash.json",
  "media-probe-cache.json",
  "media-probe-remote-cache.json",
  "missing-search-backoff.json",
  "naming.json",
  "notification-transports.json",
  "notifications.json",
  "omdb.json",
  "playback-markers.json",
  "playback-progress.json",
  "plex-bindings.json",
  "plex-circuit-breaker.json",
  "plex-history-bootstrap.json",
  "plex-history-cursors.json",
  "plex-marker-sync-state.json",
  "plex-media-identity-map.json",
  "plex-observed-state.json",
  "plex-path-mappings.json",
  "plex-sync-state.json",
  "plex-unmapped.json",
  "plex-watch-status.json",
  "plex-watchlist-observations.json",
  "plex.json",
  "quality-upgrades.json",
  "releaseRules.json",
  "replacement-retries.json",
  "requests.json",
  "resolver.json",
  "rss-cache.json",
  "scheduler.json",
  "search-corpus.json",
  "search-diagnostic-log.json",
  "seerr-media-map.json",
  "seerr.json",
  "server-benchmark.json",
  "status-transitions-log.json",
  "title-artwork-cache.json",
  "tmdb.json",
  "tokens.json",
  "trailer-sources.json",
  "trash-config.json",
  "trash-manifest.json",
  "tv-profiles.json",
  "tvdb.json",
  "user-preferences.json",
  "watch-reset.json",
  "watchlist.json",
  "webhook.json",
  "wizard-provenance.json",
  "youtube-orientation-cache-v2.json",
  "setup-pending",
  "sessions.json",
  "users.json",
] as const;

export function inspectResetStores(configDir: string, userIds: readonly string[] = []): string[] {
  const targets: string[] = [];
  for (const name of RESET_STORE_FILES) {
    const target = path.join(configDir, name);
    try {
      const stat = fs.lstatSync(target);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`invalid_reset_store: ${name}`);
      fs.accessSync(target, fs.constants.W_OK);
      targets.push(target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  const avatars = path.join(configDir, "avatars");
  try {
    const stat = fs.lstatSync(avatars);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("invalid_avatars_directory");
    for (const id of userIds) {
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new Error("invalid_user_id");
      for (const ext of ["png", "jpg", "jpeg", "webp", "gif"]) {
        const target = path.join(avatars, `${id}.${ext}`);
        try {
          const item = fs.lstatSync(target);
          if (!item.isFile() || item.isSymbolicLink()) throw new Error("invalid_avatar_file");
          fs.accessSync(target, fs.constants.W_OK);
          targets.push(target);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  // Leave the administrator/session stores until last so a failed deletion
  // can still be retried without locking the user out.
  return targets.sort((a, b) => {
    const rank = (p: string) => path.basename(p) === "users.json" ? 2 : path.basename(p) === "sessions.json" ? 1 : 0;
    return rank(a) - rank(b);
  });
}

/** Move only explicitly identified files; restore them if a later step fails. */
export function stageResetStores(configDir: string, targets: readonly string[]) {
  const staging = fs.mkdtempSync(path.join(configDir, ".movviz-reset-"));
  const moved: Array<{ original: string; staged: string }> = [];
  const rollback = () => {
    for (const item of [...moved].reverse()) {
      if (fs.existsSync(item.staged)) fs.renameSync(item.staged, item.original);
    }
    fs.rmdirSync(staging);
  };
  try {
    for (const [index, original] of targets.entries()) {
      const staged = path.join(staging, String(index));
      fs.renameSync(original, staged);
      moved.push({ original, staged });
    }
  } catch (error) {
    rollback();
    throw error;
  }
  return {
    rollback,
    commit() {
      for (const item of moved) fs.unlinkSync(item.staged);
      fs.rmdirSync(staging);
    },
  };
}
