import { checkQualityUpgrades, searchReleasedMissingMovies, searchMissingMovies, transitionUpcomingMovies, autoUpgradeAll } from "@/lib/library/autoGrab";
import { searchReleasedMissingEpisodes, searchMissingEpisodes, transitionUpcomingEpisodes } from "@/lib/library/autoGrabSeries";
import { queueRssMatch } from "@/lib/scheduler/rssMatchJob";
import { refreshRssCache } from "@/lib/indexers/rssCache";
import { reconcileDownloadingItems } from "@/lib/library/downloadState";
import { reconcileLibrary } from "@/lib/library/reconcile";
import { applyMissingFileTrash } from "@/lib/library/reconcileTrash";
import { loadIndexers, updateIndexer } from "@/lib/indexers/store";
import { testIndexer } from "@/lib/indexers/torznab";
import { purgeExpiredSessions, loadUsers } from "@/lib/auth/store";
import { emitNotification } from "@/lib/notifications/store";
import { syncPlexLibrary } from "@/lib/plex/librarySync";
import { syncUserWatchStatus } from "@/lib/plex/watchSync";
import { getBootstrapState } from "@/lib/plex/plexHistoryBootstrap";
import { loadPlexConfig, plexConfigured } from "@/lib/plex/store";
import { refreshLibraryMetadata } from "@/lib/library/metadataRefresh";
import { syncSeriesEpisodes } from "@/lib/library/episodeSync";
import { allAnimeVfLaunches } from "@/lib/metadata/animeVfCalendar";
import { purgeExpiredTrash } from "@/lib/library/trashPurge";
import { isAutoSearchMissingEnabled } from "@/lib/settings/automation";
import { mapWithConcurrency } from "@/lib/concurrency";
import { syncPlexUserMedia } from "@/lib/plex/userMediaSync";
import { retryPendingPlexWatchedState } from "@/lib/plex/watchWrite";
import { importSeerrRequests } from "@/lib/seerr/importRequests";
import { seerrConfigured } from "@/lib/seerr/store";
import { incrementalDiskScan } from "@/lib/library/diskScan";
import { runLibraryHealthCheck } from "@/lib/library/libraryHealthCheck";
import { findUpgradeCandidates } from "@/lib/library/searchAndReplace";
import { loadReleaseRules } from "@/lib/library/releaseRules";
import { findEpisodeUpgradeCandidates } from "@/lib/library/searchAndReplaceSeries";
import { backfillMovieLanguages, backfillSeriesLanguages } from "@/lib/tasks/languageDetectionTask";
import { isFfprobeEnabled } from "@/lib/settings/ffprobe";
import { probeAllLibraryMovies, probeAllLibrarySeries } from "@/lib/playback/engine/probeLibrary";
import { syncPlexMarkers } from "@/lib/plex/markerSync";
import { loadMarkerSyncState } from "@/lib/plex/markerSyncState";
import { syncIntroDbLibrary } from "@/lib/playback/markers/librarySync";
import { externalMarkersEnabled, plexMarkersEnabled } from "@/lib/settings/markerSources";
import { runArtworkCacheWarm } from "@/lib/metadata/artworkCacheWarm";
import { JobCancelledError, reportJobProgress, trackJobProgress } from "@/lib/jobs/cancelScope";
import { refreshPendingEpisodeMeta } from "@/lib/library/episodeMeta";
import { engineGet } from "@/lib/engine/server";
import { readState, writeState } from "@/lib/library/taskMemory";

export interface ScheduledTask {
  id: string;
  name: string;
  intervalMs: number;
  /** Plage horaire appliquée une fois, la première fois que la tâche existe
   *  (modifiable ensuite dans Réglages → Tâches planifiées). */
  defaultWindow?: { startHour: number; endHour: number };
  /** Tâche mise en pause par un réglage (ex. Plex désactivé pour les repères
   *  de saut) : elle ne démarre pas et l'interface l'indique. */
  isEnabled?: () => boolean;
  run: () => Promise<void>;
}

/** Empreinte des torrents du moteur (identifiant, avancement entier) : change quand un torrent est ajouté, terminé ou retiré. */
async function currentEngineSignature(): Promise<string | null> {
  const data = await engineGet<{ torrents?: { infoHash: string; progress?: number; state?: string }[] }>("torrents").catch(() => null);
  if (!data?.torrents) return null;
  return data.torrents
    .map((t) => `${t.infoHash}:${(t.progress ?? 0) >= 1 ? "done" : "wip"}`)
    .sort()
    .join("|");
}

/** Every real background job Movviz runs, driven by the scheduler engine. */
export const TASKS: ScheduledTask[] = [
  {
    id: "quality-upgrade-check",
    name: "Recherche de versions de meilleure qualité des titres déjà présents",
    intervalMs: 60 * 60 * 1000, // hourly
    run: async () => {
      await checkQualityUpgrades();
    },
  },
  {
    id: "indexer-health-check",
    name: "Test de connexion de chaque indexeur",
    intervalMs: 6 * 60 * 60 * 1000, // every 6 hours
    run: async () => {
      const enabled = loadIndexers().filter((i) => i.enabled);
      const tick = trackJobProgress(enabled.length);
      for (const ix of enabled) {
        tick();
        const result = await testIndexer(ix);
        updateIndexer(ix.id, { lastTest: { ok: result.ok, at: Date.now(), detail: result.detail }, caps: result.caps });
      }
    },
  },
  {
    id: "library-reconcile",
    name: "Vérification que chaque fichier de la bibliothèque existe encore sur le disque",
    intervalMs: 24 * 60 * 60 * 1000, // daily
    run: async () => {
      const issues = await reconcileLibrary();
      const trashed = applyMissingFileTrash(issues);
      const trashedCount = trashed.movies + trashed.episodes + trashed.series;
      if (trashed.blockedMissing) {
        emitNotification(
          "reconcile_issues",
          `Réconciliation suspendue : ${trashed.blockedMissing} fichier(s) introuvables d'un coup, probablement un stockage indisponible. Rien n'a été déplacé vers la corbeille.`,
          "/library",
          { count: trashed.blockedMissing }
        );
      } else if (trashedCount > 0) {
        emitNotification(
          "reconcile_issues",
          `Réconciliation : ${trashedCount} fichier(s) disparu(s) du disque déplacé(s) vers la corbeille`,
          "/trash",
          { count: trashedCount }
        );
      } else if (issues.length > 0) {
        emitNotification("reconcile_issues", `Réconciliation : ${issues.length} anomalie(s) détectée(s)`, "/library", { count: issues.length });
      }
    },
  },
  {
    id: "search-and-replace-check",
    name: "Repérage des remplacements possibles par une meilleure version (ne télécharge rien)",
    // "Rechercher et remplacer" (searchAndReplace.ts) was on-demand only —
    // nothing ever ran it unless an admin happened to open the panel. This
    // surfaces the same read-only candidates (language-upgrade target and
    // custom-format preferences) proactively, still never grabbing anything
    // on its own — purely a heads-up notification, exactly like
    // library-reconcile above.
    intervalMs: 24 * 60 * 60 * 1000, // daily
    // Remplacement automatique désactivé : l'administrateur ne veut aucune
    // recherche de remplacements en arrière-plan (des centaines de requêtes
    // aux indexeurs). La tâche est donc en pause ; l'analyse à la demande du
    // panneau « Rechercher et remplacer » reste disponible.
    isEnabled: () => loadReleaseRules().autoUpgradeEnabled,
    run: async () => {
      // Mise à niveau automatique activée : elle fait exactement la même
      // recherche toutes les 12 h et télécharge chaque candidat trouvé, puis
      // signale elle-même ceux qu'elle n'a pas pu télécharger. Refaire ce
      // calcul ici n'apporterait aucune information de plus.
      if (loadReleaseRules().autoUpgradeEnabled) return;
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
    name: "Détection de la langue audio de chaque fichier (Plex et nom du fichier)",
    intervalMs: 24 * 60 * 60 * 1000, // daily
    run: async () => {
      await backfillMovieLanguages();
      await backfillSeriesLanguages();
    },
  },
  {
    id: "media-probe-library",
    name: "Analyse des fichiers (ffprobe) : pistes audio, sous-titres, codecs",
    // Incrémentale : getOrProbeMediaDescriptor saute tout fichier inchangé
    // (chemin/taille/date), donc seuls les fichiers jamais analysés coûtent un
    // ffprobe. Ancre dans la mémoire de Movviz ce que Plex avait fourni — la
    // bibliothèque ne dépend alors plus de Plex pour ses pistes ni ses langues.
    intervalMs: 6 * 60 * 60 * 1000,
    run: async () => {
      if (!isFfprobeEnabled()) return;
      // Avancement n/total : films puis épisodes (deux étapes, chacune son total).
      await probeAllLibraryMovies(reportJobProgress);
      await probeAllLibrarySeries(reportJobProgress);
    },
  },
  {
    id: "auto-upgrade-all",
    name: "Remplacement automatique des fichiers par de meilleures versions",
    // Toutes les 12 h (était 6 h) : jusqu'à ~300 requêtes aux indexeurs par
    // passage pour améliorer des fichiers déjà présents — jamais urgent.
    intervalMs: 12 * 60 * 60 * 1000,
    isEnabled: () => loadReleaseRules().autoUpgradeEnabled,
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
      if (result.notGrabbed > 0) {
        emitNotification(
          "upgrade_candidates_found",
          `${result.notGrabbed} remplacement(s) suggéré(s) disponible(s)`,
          "/library",
          { count: result.notGrabbed }
        );
      }
    },
  },
  {
    id: "session-cleanup",
    name: "Suppression des sessions de connexion expirées",
    intervalMs: 24 * 60 * 60 * 1000, // daily
    run: async () => {
      purgeExpiredSessions();
    },
  },
  {
    id: "plex-watchlist-sync",
    name: "Plex : synchronisation des listes de suivi et envoi des statuts « vu »",
    // Toutes les 5 min (était 1 min) : un appel plex.tv par utilisateur à
    // chaque passage pour une liste de suivi qui change rarement.
    intervalMs: 5 * 60 * 1000,
    run: async () => {
      // Phase 7 du plan de finalisation (2026-09) : filet de sécurité de
      // l'outbox Movviz -> Plex (statut vu), réutilise cette tâche à la
      // minute plutôt que d'en créer une nouvelle (§53-54 du plan) —
      // délibérément PAS derrière le drapeau watchlistSyncEnabled
      // ci-dessous, un concept indépendant (export du statut vu, pas import
      // de la liste de suivi).
      await retryPendingPlexWatchedState().catch(() => {});

      // Watchlist is a user intent, never an acquisition trigger. The
      // historical task id is retained for scheduler compatibility; the
      // bidirectional user-media adapter owns synchronization here.
      if (!loadPlexConfig().watchlistSyncEnabled) return;
      // `undefined` means a pre-setting account and deliberately migrates to
      // enabled: those users already supplied a personal Plex token. Only an
      // explicit false pauses their personal watchlist synchronisation.
      for (const user of loadUsers().filter((candidate) => candidate.plexToken && candidate.autoRequestFromWatchlist !== false)) {
        await syncPlexUserMedia(user);
      }
    },
  },
  {
    id: "plex-library-sync",
    name: "Plex : import des films et séries ajoutés ou modifiés (passage rapide)",
    intervalMs: 5 * 60 * 1000, // every 5 minutes — incremental (only recent adds/changes), so this stays cheap
    run: async () => {
      if (!plexConfigured()) return;
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
    name: "Plex : récupération des repères d'intro et de générique",
    // Quotidien — PAS toutes les 5 minutes : la synchro bibliothèque
    // alimente la dirty-list à chaque passage, mais le fetch markers
    // n'a pas besoin de repartir si souvent (découplage voulu, on ne
    // surcharge pas Plex).
    intervalMs: 24 * 60 * 60 * 1000,
    // En pause quand Réglages → Métadonnées est sur « API uniquement ».
    isEnabled: plexMarkersEnabled,
    run: async () => {
      if (!plexConfigured()) return;
      if (!loadPlexConfig().markerSyncEnabled) return;
      // Complète seulement tant qu'aucune n'a abouti ou si une est restée en cours (reprise après un arrêt) ;
      // ensuite toujours incrémentale (nouveautés, échecs, audit tournant d'un septième de la bibliothèque).
      // La purge des repères de médias disparus reste possible à la demande (bouton « complète »).
      const markerState = loadMarkerSyncState();
      const fullDue = !markerState.lastFullAt || !!markerState.fullRun;
      await syncPlexMarkers({ mode: fullDue ? "full" : "incremental", setProgress: reportJobProgress });
    },
  },
  {
    id: "introdb-marker-sync",
    name: "TheIntroDB : repères de saut de toute la bibliothèque (récap, intro, générique, aperçu)",
    // Une fois par nuit. La toute première passe est longue (un appel par
    // titre) : plafonnée par nuit pour ménager le quota de l'API, elle se
    // poursuit les nuits suivantes, puis ne traite plus que les nouveautés
    // et les résultats anciens.
    intervalMs: 24 * 60 * 60 * 1000,
    defaultWindow: { startHour: 3, endHour: 6 },
    isEnabled: externalMarkersEnabled,
    run: async () => {
      await syncIntroDbLibrary("full");
    },
  },
  {
    id: "introdb-new-items",
    name: "TheIntroDB : repères de saut des titres tout juste ajoutés",
    // Un film ou un épisode qui arrive dans la bibliothèque (Plex,
    // téléchargement terminé, import) obtient ses repères en quelques minutes,
    // sans attendre la nuit. Aucun effet tant que la première passe complète
    // de nuit n'est pas terminée.
    intervalMs: 5 * 60 * 1000,
    isEnabled: externalMarkersEnabled,
    run: async () => {
      await syncIntroDbLibrary("new");
    },
  },
  {
    id: "plex-watch-sync",
    name: "Plex : récupération du statut « vu » de chaque utilisateur",
    intervalMs: 2 * 60 * 60 * 1000, // every 2 hours
    run: async () => {
      if (!plexConfigured()) return;
      // Bug fix (confirmed live — "chaque profil doit être indépendant"):
      // this used to require the user's OWN `plexToken`, which only exists
      // for someone who logged into Movviz via Plex OAuth directly. A Plex
      // Home-managed profile (assigned by the admin via PlexSettings →
      // /api/plex/assign-profile, `plexManagedUserId` set, `plexToken`
      // null) was silently excluded from every single sync run — their
      // watch status simply never populated from Plex, forever. Also
      // covers watchSync.ts's own fix for the same field.
      //
      // Second bug fix (audit ciblé, 2026-09) : ce filtre excluait encore un
      // troisième cas — un compte "ami" importé (plexId renseigné,
      // plexToken ET plexManagedUserId tous les deux null tant que cette
      // personne ne s'est jamais connectée elle-même) n'était JAMAIS
      // synchronisé en arrière-plan, même après la correction de
      // watchSync.ts qui sait désormais résoudre son identité via
      // getPlexFriends(). `plexId` est le vrai marqueur d'identité Plex,
      // pas `plexToken` (une conséquence de connexion, pas une condition).
      const users = loadUsers().filter((u) => u.plexId || u.plexManagedUserId);
      // Full history bootstrap can involve thousands of events per user and must
      // not monopolize the process with 15 parallel full scans. Keep at most
      // one full bootstrap at a time (owner snapshot and history can both be heavy).
      const tickUser = trackJobProgress(users.length);
      await mapWithConcurrency(users, 1, async (user) => { try { await syncUserWatchStatus(user); } finally { tickUser(); } });
    },
  },
  {
    id: "plex-watch-bootstrap",
    name: "Plex : reprise de l'historique de visionnage complet (première synchro)",
    intervalMs: 5 * 60 * 1000,
    run: async () => {
      if (!plexConfigured()) return;
      const machineIdentifier = loadPlexConfig().machineIdentifier;
      if (!machineIdentifier) return;
      // A page is a resource budget, not a history cutoff. Resume unfinished
      // accounts frequently while leaving regular completed-account polling
      // at its existing two-hour cadence.
      const users = loadUsers().filter((user) => {
        if (!user.plexId && !user.plexManagedUserId) return false;
        const state = getBootstrapState(user.id, machineIdentifier);
          return state == null || state.status !== "COMPLETED";
      });
      const tickUser = trackJobProgress(users.length);
      await mapWithConcurrency(users, 1, async (user) => { try { await syncUserWatchStatus(user); } finally { tickUser(); } });
    },
  },
  {
    id: "plex-full-reconcile",
    name: "Plex : rapprochement complet de toute la bibliothèque (quotidien)",
    intervalMs: 24 * 60 * 60 * 1000, // daily
    // The 5-minute plex-library-sync only looks at items Plex touched since the
    // last watermark, so a title added to Movviz's library *before* Plex ever
    // indexed it — and never touched again since — is never picked up by it and
    // stays stuck on "missing" forever even though it's genuinely in Plex. A
    // full (non-incremental) pass once a day catches those, for movies and
    // series/episodes alike.
    run: async () => {
      if (!plexConfigured()) return;
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
    name: "Recherche des titres sortis aujourd'hui ou ces deux dernières semaines",
    intervalMs: 6 * 60 * 60 * 1000, // 4x/day (matin/midi/après-midi/soir)
    // 1. Flip anything "upcoming" whose release/air date has now passed to
    //    "missing" — this is what makes it eligible for search at all (see
    //    LibraryStatus's "upcoming" doc). 2. Immediately retry everything
    //    "missing" whose date is within the last 14 days, so a title that
    //    just released (or was just flipped above) gets searched several
    //    times a day instead of waiting on a manual search or the 6h retry
    //    task — releases routinely land on indexers a bit late.
    run: async () => {
      // The upcoming→missing status transition always runs — it's just
      // bookkeeping (makes a title show correctly and searchable by hand),
      // not itself a search/grab. Only the actual search step is gated by
      // the kill switch, same as the other two auto-search tasks.
      transitionUpcomingMovies();
      transitionUpcomingEpisodes();
      if (!isAutoSearchMissingEnabled()) return;
      await searchReleasedMissingMovies();
      await searchReleasedMissingEpisodes();
    },
  },
  {
    id: "metadata-refresh",
    name: "Mise à jour des fiches TMDb (titres, synopsis, notes, affiches)",
    intervalMs: 24 * 60 * 60 * 1000, // daily
    run: async () => {
      await refreshLibraryMetadata();
    },
  },
  {
    id: "series-episodes-sync",
    name: "Détection des nouveaux épisodes et saisons des séries",
    intervalMs: 24 * 60 * 60 * 1000, // daily
    // New episodes/seasons, episode titles and air dates published after a
    // series was added (see episodeSync.ts).
    run: async () => {
      await syncSeriesEpisodes();
    },
  },
  {
    id: "episode-metadata-pending",
    name: "Titres et synopsis des épisodes récents encore sans titre",
    // Légère : ne regarde que les épisodes sortis récemment (ou déjà présents) dont le titre manque,
    // et recharge leur saison depuis TMDb en ignorant le cache. Un épisode qui devient disponible est
    // de plus rechargé aussitôt (episodeMeta.ts), cette tâche rattrape ceux dont TMDb n'avait pas
    // encore le titre à ce moment-là.
    intervalMs: 3 * 60 * 60 * 1000,
    run: async () => {
      await refreshPendingEpisodeMeta();
    },
  },
  {
    id: "artwork-cache-refresh",
    name: "Téléchargement des affiches et visuels TMDb manquants",
    intervalMs: 24 * 60 * 60 * 1000, // daily safety net; visible titles fill immediately
    run: async () => {
      // New library/search titles cache themselves in real time. This small
      // daily pass only recovers titles created off-screen or a transient
      // earlier TMDb failure, never re-downloads known immutable images.
      await runArtworkCacheWarm("incremental", { limit: 30 });
    },
  },
  {
    id: "rss-indexer-scan",
    name: "Lecture des flux RSS des indexeurs pour repérer les nouvelles sorties",
    // Every 15 min: indexers only expose their latest ~100 releases, so an
    // hourly read let busy hours slip past the feed window unseen. A pass is
    // one request per indexer (~1 s in prod) — the RSS feed, not the heavy
    // missing-titles retry, is what should catch a missing title first.
    intervalMs: 15 * 60 * 1000,
    // 1. Reconcile release dates so a newly released title is eligible now,
    //    without waiting for the separate six-hour release-day task.
    // 2. Refresh the RSS cache from every enabled indexer.
    //    If an indexer is currently rate-limited (429 in the last 10 min)
    //    it is skipped — we don't hammer it.
    // 3. Match missing titles and use the normal quality-filtered grab path.
    run: async () => {
      // Admin kill switch (Réglages → Automatisation, explicit request):
      // never search/grab anything unattended when off.
      if (!isAutoSearchMissingEnabled()) return;
      transitionUpcomingMovies();
      transitionUpcomingEpisodes();
      await refreshRssCache();
      // Feed collection must stay on its 15-minute cadence. Matching and
      // grabbing can be heavy, so it runs as a separate serial heavy job.
      queueRssMatch();
    },
  },
  {
    id: "retry-missing-movies",
    name: "Nouvelle recherche des films et épisodes manquants",
    // Every 8 h (was 6 h — 8 h is the acquisition floor, see interval.ts):
    // the 15-min RSS scan catches new releases, and titles already searched
    // in vain wait 1 then 3 days (missingSearchBackoff), so most passes only
    // search titles that have never been tried or are due again.
    intervalMs: 8 * 60 * 60 * 1000,
    // Movies that auto-search initially failed on (indexer had no results,
    // engine was down, etc.) stay "missing" unless the RSS scan picks them
    // up. RSS only catches releases in its feed window, so older releases
    // or titles from indexers with poor RSS are never re-tried. This task
    // re-searches them directly (title+year query) respecting all quality
    // rules via the normal searchAndGrabMovie pipeline.
    run: async () => {
      if (!isAutoSearchMissingEnabled()) return;
      await searchMissingMovies(50);
      await searchMissingEpisodes(20);
    },
  },
  {
    id: "download-state-reconcile",
    name: "Suivi des téléchargements : passage en « disponible » des fichiers terminés",
    intervalMs: 2 * 60 * 1000, // every 2 min — a finished file must flip to "available" fast so the Play button appears without waiting for Plex; this is a single engineGet("torrents") + in-memory loops, cheap enough to run often
    // Items stuck on "downloading" whose torrent no longer exists in the
    // engine (deleted, wiped, lost on crash) go back to "missing" so the
    // wanted list and RSS scan pick them up again.
    run: async () => {
      await reconcileDownloadingItems();
    },
  },
  {
    id: "stuck-downloads-recover",
    name: "Import des téléchargements terminés restés dans le dossier de téléchargement",
    intervalMs: 15 * 60 * 1000, // every 15 min — scans download folders for orphaned files; scheduled as heavy so it does not delay the interface
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
      // Le balayage complet du dossier de téléchargement n'a de raison d'être que si quelque chose a
      // changé côté moteur (torrent ajouté, terminé ou disparu), sinon il relit à l'identique des
      // milliers de fichiers. Un balayage complet a quand même lieu toutes les 3 h pour les fichiers
      // arrivés sans passer par le moteur ; moteur injoignable : comportement d'avant.
      const engineSignature = await currentEngineSignature();
      const previous = readState<{ signature: string; at: number } | null>("stuck-downloads-recover", null);
      if (engineSignature && previous && previous.signature === engineSignature && Date.now() - previous.at < 3 * 60 * 60 * 1000) return;
      const { recoverDownloads } = await import("@/lib/library/recoverDownloads");
      try {
        const result = await recoverDownloads(undefined, { background: true });
        if (result.recovered.length > 0) {
          emitNotification("downloads_recovered", `${result.recovered.length} téléchargement(s) terminé(s) récupéré(s) depuis le dossier de téléchargement`, "/downloads?tab=queue", { count: result.recovered.length });
        }
        console.log(`[scheduler] stuck-downloads-recover: ${result.recovered.length} récupéré(s), ${result.failed.length} ignoré(s), ${result.duplicates.length} doublon(s)`);
        // Des fichiers ont été récupérés : le prochain passage ne doit pas être sauté.
        if (engineSignature && result.recovered.length === 0) writeState("stuck-downloads-recover", { signature: engineSignature, at: Date.now() });
        else writeState("stuck-downloads-recover", null);
      } catch (e) {
        if (e instanceof JobCancelledError) throw e;
        console.error("[scheduler] stuck-downloads-recover failed:", (e as Error).message);
      }
    },
  },
  {
    id: "anime-vf-calendar-refresh",
    name: "Mise à jour du calendrier de sortie des doublages VF d'anime",
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
    name: "Import des demandes Seerr / Overseerr (films et séries à télécharger)",
    intervalMs: 60 * 1000, // every minute
    run: async () => {
      if (!seerrConfigured()) return;
      await importSeerrRequests();
    },
  },
  {
    id: "disk-scan",
    name: "Détection des nouveaux fichiers sur le disque local",
    // Reste à 1 h : c'est lui qui donne l'emplacement disque local d'un
    // fichier arrivé par Plex (lecture directe). Désormais asynchrone et
    // limité aux fichiers pas encore rattachés, il ne fige plus le serveur.
    intervalMs: 60 * 60 * 1000, // hourly
    run: async () => {
      await incrementalDiskScan();
    },
  },
  {
    id: "trash-purge",
    name: "Vidage définitif des éléments trop anciens de la corbeille",
    intervalMs: 30 * 24 * 60 * 60 * 1000, // every 30 days
    run: async () => {
      await purgeExpiredTrash();
    },
  },
  {
    id: "library-health-check",
    name: "Diagnostic de la bibliothèque (statuts incohérents, langues, métadonnées incomplètes)",
    intervalMs: 30 * 24 * 60 * 60 * 1000, // every 30 days
    // Read-only: never searches, never downloads. Only prepares data
    // (statuses incohérents, langue non détectée, sorties pas rattrapées,
    // métadonnées incomplètes) — see libraryHealthCheck.ts for the full
    // rationale. Manually launchable like any task via /api/tasks/[id]/run.
    run: async () => {
      await runLibraryHealthCheck();
    },
  },
  {
    id: "server-benchmark",
    name: "Mesure de la puissance du serveur (vitesse de transcodage)",
    intervalMs: 30 * 24 * 60 * 60 * 1000, // every 30 days — explicit user request (2026-08-24)
    // Third of the benchmark's three triggers (see serverBenchmark.ts's own
    // header) — hardware doesn't change often, but ffmpeg builds, kernel
    // updates, or a Docker host migration genuinely can shift real
    // transcode speed over time without a Movviz version bump ever
    // happening (which is what the OTHER trigger, instrumentation.ts's
    // shouldAutoRunBenchmark(), actually watches for). Manually launchable
    // like any task via /api/tasks/[id]/run, same as library-health-check
    // above.
    run: async () => {
      const { runServerBenchmark } = await import("@/lib/playback/engine/serverBenchmark");
      await runServerBenchmark();
    },
  },
];
