import { checkQualityUpgrades, searchReleasedMissingMovies, searchMissingMovies } from "@/lib/library/autoGrab";
import { searchReleasedMissingEpisodes, searchMissingEpisodes } from "@/lib/library/autoGrabSeries";
import { rssMatchIndexers } from "@/lib/library/rssScan";
import { refreshRssCache } from "@/lib/indexers/rssCache";
import { reconcileDownloadingItems } from "@/lib/library/downloadState";
import { reconcileLibrary } from "@/lib/library/reconcile";
import { loadIndexers, updateIndexer } from "@/lib/indexers/store";
import { testIndexer } from "@/lib/indexers/torznab";
import { purgeExpiredSessions, loadUsers } from "@/lib/auth/store";
import { emitNotification } from "@/lib/notifications/store";
import { getPlexWatchlist } from "@/lib/plex/client";
import { requestMedia } from "@/lib/requests/requestMedia";
import { syncPlexLibrary } from "@/lib/plex/librarySync";
import { syncUserWatchStatus } from "@/lib/plex/watchSync";
import { loadPlexConfig } from "@/lib/plex/store";
import { refreshLibraryMetadata } from "@/lib/library/metadataRefresh";
import { allAnimeVfLaunches } from "@/lib/metadata/animeVfCalendar";
import { purgeExpiredTrash } from "@/lib/library/trashPurge";
import { mapWithConcurrency } from "@/lib/concurrency";

export interface ScheduledTask {
  id: string;
  name: string;
  intervalMs: number;
  run: () => Promise<void>;
}

/** Every real background job Movviz runs, driven by the scheduler engine. */
export const TASKS: ScheduledTask[] = [
  {
    id: "quality-upgrade-check",
    name: "Vérification des mises à niveau qualité",
    intervalMs: 60 * 60 * 1000, // hourly
    run: async () => {
      await checkQualityUpgrades();
    },
  },
  {
    id: "indexer-health-check",
    name: "Vérification des indexeurs",
    intervalMs: 6 * 60 * 60 * 1000, // every 6 hours
    run: async () => {
      for (const ix of loadIndexers().filter((i) => i.enabled)) {
        const result = await testIndexer(ix);
        updateIndexer(ix.id, { lastTest: { ok: result.ok, at: Date.now(), detail: result.detail }, caps: result.caps });
      }
    },
  },
  {
    id: "library-reconcile",
    name: "Réconciliation bibliothèque / disque",
    intervalMs: 24 * 60 * 60 * 1000, // daily
    run: async () => {
      const issues = await reconcileLibrary();
      if (issues.length > 0) {
        emitNotification("reconcile_issues", `Réconciliation : ${issues.length} anomalie(s) détectée(s)`, "/library", { count: issues.length });
      }
    },
  },
  {
    id: "session-cleanup",
    name: "Nettoyage des sessions expirées",
    intervalMs: 24 * 60 * 60 * 1000, // daily
    run: async () => {
      purgeExpiredSessions();
    },
  },
  {
    id: "plex-watchlist-sync",
    name: "Synchronisation de la liste de suivi Plex",
    intervalMs: 15 * 60 * 1000, // every 15 minutes
    run: async () => {
      if (!loadPlexConfig().watchlistSyncEnabled) return;
      const users = loadUsers().filter((u) => u.autoRequestFromWatchlist && u.plexToken);
      for (const user of users) {
        const items = await getPlexWatchlist(user.plexToken!);
        for (const item of items) {
          if (item.tmdbId == null) continue;
          await requestMedia(user, item.type, item.tmdbId);
        }
      }
    },
  },
  {
    id: "plex-library-sync",
    name: "Synchronisation de la bibliothèque Plex",
    intervalMs: 5 * 60 * 1000, // every 5 minutes — incremental (only recent adds/changes), so this stays cheap
    run: async () => {
      if (!loadPlexConfig().syncLibrary) return;
      const result = await syncPlexLibrary();
      if (result && (result.moviesAdded || result.seriesAdded)) {
        emitNotification(
          "plex_sync_imported",
          `Plex : ${result.moviesAdded} film(s) et ${result.seriesAdded} série(s) importés depuis la bibliothèque`,
          "/library",
          { movies: result.moviesAdded, series: result.seriesAdded }
        );
      }
    },
  },
  {
    id: "plex-watch-sync",
    name: "Synchronisation des vues Plex",
    intervalMs: 15 * 60 * 1000, // every 15 minutes, alongside the watchlist poll
    run: async () => {
      const users = loadUsers().filter((u) => u.plexToken);
      // Was one user at a time — combined with the per-show sequential calls
      // this fixed in watchSync.ts, a library with several Plex users could
      // hold the single active job slot for many minutes straight.
      await mapWithConcurrency(users, 3, (user) => syncUserWatchStatus(user));
    },
  },
  {
    id: "plex-full-reconcile",
    name: "Réconciliation complète Plex",
    intervalMs: 24 * 60 * 60 * 1000, // daily
    // The 5-minute plex-library-sync only looks at items Plex touched since the
    // last watermark, so a title added to Movviz's library *before* Plex ever
    // indexed it — and never touched again since — is never picked up by it and
    // stays stuck on "missing" forever even though it's genuinely in Plex. A
    // full (non-incremental) pass once a day catches those, for movies and
    // series/episodes alike.
    run: async () => {
      if (!loadPlexConfig().syncLibrary) return;
      const result = await syncPlexLibrary({ force: true });
      if (result && (result.moviesAdded || result.moviesMatched || result.seriesAdded || result.seriesMatched)) {
        emitNotification(
          "plex_full_reconcile",
          `Réconciliation Plex complète : ${result.moviesMatched} film(s) et ${result.seriesMatched} série(s) mis à jour`,
          "/library",
          { movies: result.moviesMatched, series: result.seriesMatched }
        );
      }
    },
  },
  {
    id: "release-day-search",
    name: "Recherche des sorties du jour",
    intervalMs: 8 * 60 * 60 * 1000, // 3x/day
    // Movies/episodes stay "missing" indefinitely once their release date is
    // set but no release has appeared yet — this retries them once they've
    // actually released (VF digital/physical date for movies, air date for
    // episodes), a few times a day rather than waiting on a manual search.
    run: async () => {
      await searchReleasedMissingMovies();
      await searchReleasedMissingEpisodes();
    },
  },
  {
    id: "metadata-refresh",
    name: "Rafraîchissement des métadonnées TMDb",
    intervalMs: 24 * 60 * 60 * 1000, // daily
    run: async () => {
      await refreshLibraryMetadata();
    },
  },
  {
    id: "rss-indexer-scan",
    name: "Scan RSS des indexeurs",
    intervalMs: 60 * 60 * 1000, // hourly
    // 1. Refresh the in-memory RSS cache from every enabled indexer.
    //    If an indexer is currently rate-limited (429 in the last 10 min)
    //    it is skipped — we don't hammer it.
    // 2. Match the cached releases against everything currently missing.
    //    Zero direct indexer calls during matching: 429 rate-limits in
    //    this phase are impossible.
    run: async () => {
      await refreshRssCache();
      await rssMatchIndexers();
    },
  },
  {
    id: "retry-missing-movies",
    name: "Relance des films manquants",
    intervalMs: 6 * 60 * 60 * 1000, // every 6 hours
    // Movies that auto-search initially failed on (indexer had no results,
    // engine was down, etc.) stay "missing" unless the RSS scan picks them
    // up. RSS only catches releases in its feed window, so older releases
    // or titles from indexers with poor RSS are never re-tried. This task
    // re-searches them directly (title+year query) respecting all quality
    // rules via the normal searchAndGrabMovie pipeline.
    run: async () => {
      await searchMissingMovies(50);
      await searchMissingEpisodes(20);
    },
  },
  {
    id: "download-state-reconcile",
    name: "Réconciliation des téléchargements en cours",
    intervalMs: 10 * 60 * 1000, // every 10 minutes
    // Items stuck on "downloading" whose torrent no longer exists in the
    // engine (deleted, wiped, lost on crash) go back to "missing" so the
    // wanted list and RSS scan pick them up again.
    run: async () => {
      await reconcileDownloadingItems();
    },
  },
  {
    id: "anime-vf-calendar-refresh",
    name: "Rafraîchissement du calendrier VF anime",
    intervalMs: 24 * 60 * 60 * 1000, // daily
    // Best-effort scrape of anime VF dub launch dates (no official API for
    // this exists — see animeVfCalendar.ts). Keeps the cache warm so the
    // calendar page never has to eat the scrape's latency itself.
    run: async () => {
      await allAnimeVfLaunches();
    },
  },
  {
    id: "trash-purge",
    name: "Purge de la corbeille",
    intervalMs: 30 * 24 * 60 * 60 * 1000, // every 30 days
    run: async () => {
      await purgeExpiredTrash();
    },
  },
];
