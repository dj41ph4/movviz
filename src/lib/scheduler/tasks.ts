import { checkQualityUpgrades, searchReleasedMissingMovies, searchMissingMovies, transitionUpcomingMovies, autoUpgradeAll } from "@/lib/library/autoGrab";
import { searchReleasedMissingEpisodes, searchMissingEpisodes, transitionUpcomingEpisodes } from "@/lib/library/autoGrabSeries";
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
import { importSeerrRequests } from "@/lib/seerr/importRequests";
import { seerrConfigured } from "@/lib/seerr/store";
import { incrementalDiskScan } from "@/lib/library/diskScan";
import { runLibraryHealthCheck } from "@/lib/library/libraryHealthCheck";
import { findUpgradeCandidates } from "@/lib/library/searchAndReplace";
import { findEpisodeUpgradeCandidates } from "@/lib/library/searchAndReplaceSeries";
import { backfillMovieLanguages, backfillSeriesLanguages } from "@/lib/tasks/languageDetectionTask";
import { syncPlexMarkers } from "@/lib/plex/markerSync";

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
    id: "search-and-replace-check",
    name: "Vérification des remplacements suggérés",
    // "Rechercher et remplacer" (searchAndReplace.ts) was on-demand only —
    // nothing ever ran it unless an admin happened to open the panel. This
    // surfaces the same read-only candidates (language-upgrade target and
    // custom-format preferences) proactively, still never grabbing anything
    // on its own — purely a heads-up notification, exactly like
    // library-reconcile above.
    intervalMs: 24 * 60 * 60 * 1000, // daily
    run: async () => {
      // Sequential, not Promise.all — see the same comment on the API route:
      // each of these already runs its own sequential indexer fallback, so
      // running both at once would double the concurrent request stream.
      const candidates = await findUpgradeCandidates();
      const episodeCandidates = await findEpisodeUpgradeCandidates();
      const count = candidates.length + episodeCandidates.length;
      if (count > 0) {
        emitNotification(
          "upgrade_candidates_found",
          `${count} remplacement(s) suggéré(s) disponible(s)`,
          "/library",
          { count }
        );
      }
    },
  },
  {
    id: "language-detection",
    name: "Détection des langues (Plex + nom de fichier)",
    intervalMs: 24 * 60 * 60 * 1000, // daily
    run: async () => {
      await backfillMovieLanguages();
      await backfillSeriesLanguages();
    },
  },
  {
    id: "auto-upgrade-all",
    name: "Mise à niveau automatique (Rechercher et remplacer)",
    intervalMs: 6 * 60 * 60 * 1000, // every 6 hours
    run: async () => {
      const result = await autoUpgradeAll();
      if (result.movies > 0 || result.episodes > 0) {
        emitNotification(
          "upgrade_candidates_found",
          result.movies + " film(s) et " + result.episodes + " épisode(s) mis à niveau automatiquement",
          "/library",
          { count: result.movies + result.episodes }
        );
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
    intervalMs: 60 * 1000, // every minute
    run: async () => {
      if (!loadPlexConfig().watchlistSyncEnabled) return;
      const users = loadUsers().filter((u) => u.autoRequestFromWatchlist && u.plexToken);
      for (const user of users) {
        const items = await getPlexWatchlist(user.plexToken!);
        for (const item of items) {
          if (item.tmdbId == null) continue;
          const result = await requestMedia(user, item.type, item.tmdbId);
          if ("error" in result) {
            console.error(`[PlexWatchlist] ${item.type} ${item.tmdbId} for ${user.username}: ${result.error}`);
          }
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
    id: "plex-marker-sync",
    name: "Synchronisation des intros et génériques Plex",
    // Quotidien — PAS toutes les 5 minutes : la synchro bibliothèque
    // alimente la dirty-list à chaque passage, mais le fetch markers
    // n'a pas besoin de repartir si souvent (découplage voulu, on ne
    // surcharge pas Plex).
    intervalMs: 24 * 60 * 60 * 1000,
    run: async () => {
      if (!loadPlexConfig().markerSyncEnabled) return;
      await syncPlexMarkers({ mode: "incremental" });
    },
  },
  {
    id: "plex-watch-sync",
    name: "Synchronisation des vues Plex",
    intervalMs: 2 * 60 * 60 * 1000, // every 2 hours
    run: async () => {
      // Bug fix (confirmed live — "chaque profil doit être indépendant"):
      // this used to require the user's OWN `plexToken`, which only exists
      // for someone who logged into Movviz via Plex OAuth directly. A Plex
      // Home-managed profile (assigned by the admin via PlexSettings →
      // /api/plex/assign-profile, `plexManagedUserId` set, `plexToken`
      // null) was silently excluded from every single sync run — their
      // watch status simply never populated from Plex, forever. Also
      // covers watchSync.ts's own fix for the same field.
      const users = loadUsers().filter((u) => u.plexToken || u.plexManagedUserId);
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
    intervalMs: 6 * 60 * 60 * 1000, // 4x/day (matin/midi/après-midi/soir)
    // 1. Flip anything "upcoming" whose release/air date has now passed to
    //    "missing" — this is what makes it eligible for search at all (see
    //    LibraryStatus's "upcoming" doc). 2. Immediately retry everything
    //    "missing" whose date is within the last 14 days, so a title that
    //    just released (or was just flipped above) gets searched several
    //    times a day instead of waiting on a manual search or the 6h retry
    //    task — releases routinely land on indexers a bit late.
    run: async () => {
      transitionUpcomingMovies();
      transitionUpcomingEpisodes();
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
    intervalMs: 5 * 60 * 1000, // every 5 min — hourly was too slow, stuck "downloading" badges persisted far too long
    // Items stuck on "downloading" whose torrent no longer exists in the
    // engine (deleted, wiped, lost on crash) go back to "missing" so the
    // wanted list and RSS scan pick them up again.
    run: async () => {
      await reconcileDownloadingItems();
    },
  },
  {
    id: "stuck-downloads-recover",
    name: "Récupération des téléchargements terminés non importés",
    intervalMs: 30 * 60 * 1000, // every 30 min
    // A completed torrent whose import callback never landed (engine crash
    // between completion and import, failed move, lost callback) leaves its
    // files in the download folder while the library item stays stuck on
    // "downloading" — invisible to the wanted list AND never re-searchable.
    // This used to only call detectStuckDownloads() first and bail out
    // entirely when it found nothing — but that function requires the
    // torrent to STILL be present and completed/seeding in the engine's own
    // list. Confirmed live, repeatedly, this session: a torrent can vanish
    // from the engine ENTIRELY (crash, restart, manual cleanup) while its
    // files sit untouched on disk — invisible to detectStuckDownloads, only
    // ever found by the full blind scan the manual "Récupérer les
    // téléchargements" button runs. That gap meant genuinely recoverable
    // files (Law & Order, Dr. Stone, Doctor Who, Pokémon — all hit live) sat
    // unrecovered until someone remembered to click the button by hand. Runs
    // the same full scan on a schedule now that this session's fixes
    // (originalTitle matching, folder-name fallback, movie-in-series-pack
    // fallback, post-import blocklist re-check) have made it safe and
    // reliable enough to trust unattended.
    run: async () => {
      const { recoverDownloads } = await import("@/lib/library/recoverDownloads");
      try {
        const result = await recoverDownloads();
        if (result.recovered.length > 0) {
          emitNotification("downloads_recovered", `${result.recovered.length} téléchargement(s) terminé(s) récupéré(s) depuis le dossier de téléchargement`, "/activity?tab=queue", { count: result.recovered.length });
        }
        console.log(`[scheduler] stuck-downloads-recover: ${result.recovered.length} récupéré(s), ${result.failed.length} ignoré(s), ${result.duplicates.length} doublon(s)`);
      } catch (e) {
        console.error("[scheduler] stuck-downloads-recover failed:", (e as Error).message);
      }
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
    id: "seerr-import",
    name: "Import des demandes Overseerr/Seerr",
    intervalMs: 60 * 1000, // every minute
    run: async () => {
      if (!seerrConfigured()) return;
      await importSeerrRequests();
    },
  },
  {
    id: "disk-scan",
    name: "Scan disque local",
    intervalMs: 60 * 60 * 1000, // hourly
    run: async () => {
      await incrementalDiskScan();
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
  {
    id: "library-health-check",
    name: "Diagnostic bibliothèque",
    intervalMs: 30 * 24 * 60 * 60 * 1000, // every 30 days
    // Read-only: never searches, never downloads. Only prepares data
    // (statuses incohérents, langue non détectée, sorties pas rattrapées,
    // métadonnées incomplètes) — see libraryHealthCheck.ts for the full
    // rationale. Manually launchable like any task via /api/tasks/[id]/run.
    run: async () => {
      await runLibraryHealthCheck();
    },
  },
];
