package com.movviz.tv.ui.title

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.activity.compose.BackHandler
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.focusRestorer
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.foundation.focusGroup
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.layout
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.foundation.lazy.list.TvLazyColumn
import androidx.compose.foundation.gestures.BringIntoViewSpec
import androidx.compose.foundation.gestures.LocalBringIntoViewSpec
import androidx.compose.runtime.CompositionLocalProvider
import androidx.tv.foundation.lazy.list.TvLazyRow
import androidx.tv.foundation.lazy.list.items
import androidx.tv.foundation.lazy.list.itemsIndexed
import androidx.tv.foundation.lazy.list.rememberTvLazyListState
import androidx.tv.foundation.lazy.grid.TvLazyVerticalGrid
import androidx.tv.foundation.lazy.grid.rememberTvLazyGridState
import androidx.tv.foundation.lazy.grid.items
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.tv.material3.Border
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.Icon
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import coil.compose.rememberAsyncImagePainter
import com.movviz.tv.AppViewModel
import com.movviz.tv.data.ApiResult
import com.movviz.tv.data.episodePlaybackTarget
import com.movviz.tv.data.SeriesEpisodeDto
import com.movviz.tv.data.SeriesSeasonDto
import com.movviz.tv.data.MetadataEpisodeDto
import com.movviz.tv.data.QueueItemDto
import com.movviz.tv.ui.home.TitleRow
import com.movviz.tv.ui.home.TvTitleCard
import com.movviz.tv.ui.home.withWatchedMovies
import com.movviz.tv.ui.home.AmbientPreview
import com.movviz.tv.ui.player.QueueItem
import com.movviz.tv.ui.theme.MovvizBrand
import com.movviz.tv.ui.theme.MovvizBrand2
import com.movviz.tv.ui.theme.MovvizBrand3
import com.movviz.tv.ui.theme.MovvizSurface
import com.movviz.tv.ui.theme.MovvizBrandGlow
import com.movviz.tv.ui.theme.MovvizAmber
import com.movviz.tv.ui.theme.MovvizBackground
import com.movviz.tv.ui.theme.MovvizBorder
import com.movviz.tv.ui.theme.MovvizCyan
import com.movviz.tv.ui.theme.MovvizDown
import com.movviz.tv.ui.theme.MovvizIconCheck
import com.movviz.tv.ui.theme.MovvizIconDownload
import com.movviz.tv.ui.theme.MovvizIconFilm
import com.movviz.tv.ui.theme.MovvizIconInfo
import com.movviz.tv.ui.theme.MovvizIconPlay
import com.movviz.tv.ui.theme.MovvizIconPlus
import com.movviz.tv.ui.theme.MovvizIconReplay
import com.movviz.tv.ui.theme.MovvizIconStar
import com.movviz.tv.ui.theme.MovvizInk
import com.movviz.tv.ui.theme.MovvizInkDim
import com.movviz.tv.ui.theme.MovvizInkSoft
import com.movviz.tv.ui.theme.MovvizOk
import com.movviz.tv.ui.theme.MovvizSurfaceStrong
import com.movviz.tv.ui.theme.statusTone
import com.movviz.tv.ui.theme.tvFocusLift
import com.movviz.tv.ui.theme.tvCardFocusHalo
import com.movviz.tv.ui.theme.tvPointerClick
import com.movviz.tv.ui.theme.withTvPrefetchDisabled
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.draw.clip
import kotlinx.coroutines.delay
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import kotlinx.coroutines.launch

// w1280, PAS "original" : un backdrop plein écran en "original" télécharge
// jusqu'à 4000px de large pour un écran TV 1080p — gaspillage réseau et
// mémoire inutile (même raisonnement que le hero, HomeScreen.kt).
private val BACKDROP_HEIGHT = 480.dp
private const val TMDB_BACKDROP_BASE = "https://image.tmdb.org/t/p/w1280"
// Les captures d'épisode sont affichées en petits formats : w780 suffit
// largement, l'original est du gaspillage pur.
private const val TMDB_STILL_BASE = "https://image.tmdb.org/t/p/w780"
private const val TMDB_SEASON_POSTER_BASE = "https://image.tmdb.org/t/p/w500"
private const val TMDB_PROFILE_BASE = "https://image.tmdb.org/t/p/w185"
private const val TMDB_LOGO_BASE = "https://image.tmdb.org/t/p/w500"

private data class EpisodeSelection(
    val season: SeriesSeasonDto,
    val episode: SeriesEpisodeDto,
    val metadata: MetadataEpisodeDto?,
)

/**
 * Fiche titre — même composition que le hero desktop (TitleContent.tsx) :
 * backdrop plein écran + dégradé, pastille de statut, titre, ligne méta
 * (étoile/année/durée/genres), tagline, synopsis, puis une rangée d'actions
 * avec un bouton principal en dégradé de marque. Adaptée au 10-foot UI :
 * pas de survol souris, tout doit rester utilisable au D-pad seul, donc les
 * actions sont deux Surface focusables plutôt que des boutons cliqués à la
 * souris.
 */
@OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)
@Composable
fun TitleDetailScreen(
    viewModel: AppViewModel,
    type: String,
    tmdbId: Int,
    /** `resumeMs` : position annoncée par le bouton « Reprendre à … » — le
     *  lecteur la reprend telle quelle au lieu de la recalculer. */
    onPlay: (title: String, queue: List<QueueItem>, startIndex: Int, posterPath: String?, resumeMs: Long?) -> Unit,
    onPlayFromStart: (title: String, queue: List<QueueItem>, startIndex: Int, posterPath: String?) -> Unit,
    // Navigation vers un AUTRE titre depuis cette même fiche — sert la
    // rangée "Titres similaires" plus bas (clic → nouvelle fiche, poussée
    // sur la pile de nav, exactement Netflix/Apple TV). Optionnel : les
    // quelques autres call sites potentiels (aucun aujourd'hui) n'ont pas
    // à le fournir.
    onOpenTitle: (type: String, tmdbId: Int) -> Unit = { _, _ -> },
    // Distribution → fiche acteur avec sa filmographie complète.
    onOpenPerson: (personId: Int) -> Unit = {},
    // Ouverture depuis "Continuer à regarder" pour une série : la saison en
    // cours plutôt que la saison 1 par défaut (voir plus bas, la sélection
    // de saison ne l'écrase jamais une fois initialisée).
    initialSeasonNumber: Int? = null,
    initialEpisodeNumber: Int? = null,
    // Cible D-pad « flèche bas depuis la barre » : la fiche emploie sa zone
    // visuelle logo/titre comme première cible, même sans CTA générique.
    entryFocusRequester: FocusRequester? = null,
) {
    val detail by viewModel.detail.collectAsState()
    val detailError by viewModel.detailError.collectAsState()
    // Même artwork de titre que TitleContent sur desktop : le logo officiel
    // TMDb est préféré au texte brut, qui reste le repli si TMDb n'en a pas.
    val heroLogos by viewModel.heroLogos.collectAsState()
    val addingToLibrary by viewModel.addingToLibrary.collectAsState()
    val seasons by viewModel.seriesSeasons.collectAsState()
    val seasonMetadata by viewModel.seasonMetadata.collectAsState()
    val searchingSeason by viewModel.searchingSeason.collectAsState()
    val scope = rememberCoroutineScope()
    var addError by remember { mutableStateOf<String?>(null) }
    var selectedSeasonNumber by remember(type, tmdbId) { mutableStateOf<Int?>(null) }
    // Une saison n'est pas un accordéon perdu au bas de la fiche. Elle ouvre
    // son propre écran, comme dans Plex : la fiche série reste un sommaire et
    // la liste d'épisodes garde tout l'espace et un parcours D-pad simple.
    var openSeasonNumber by remember(type, tmdbId) { mutableStateOf<Int?>(initialSeasonNumber) }
    var selectedEpisode by remember(type, tmdbId) { mutableStateOf<EpisodeSelection?>(null) }
    // Cartes de saison de la fiche : au retour d'une page de saison, le focus
    // revient sur la carte d'où l'on vient, jamais vers la sidebar.
    val seasonCardFocus = remember(type, tmdbId) { mutableMapOf<Int, FocusRequester>() }
    // Bande-annonce plein écran (même source que le desktop) : niveau d'écran
    // au-dessus de la fiche ; à sa fermeture le focus revient sur son bouton.
    var trailerOpen by remember(type, tmdbId) { mutableStateOf(false) }
    var trailerWasOpened by remember(type, tmdbId) { mutableStateOf(false) }
    val trailerButtonFocus = remember(type, tmdbId) { FocusRequester() }
    LaunchedEffect(trailerOpen) {
        if (trailerOpen) { trailerWasOpened = true; return@LaunchedEffect }
        if (!trailerWasOpened) return@LaunchedEffect
        repeat(20) { attempt ->
            if (runCatching { trailerButtonFocus.requestFocus() }.getOrDefault(false)) return@LaunchedEffect
            if (attempt < 19) withFrameNanos { }
        }
    }
    var lastOpenedSeason by remember(type, tmdbId) { mutableStateOf<Int?>(null) }
    // Une fiche ouverte depuis Reprendre attend la résolution locale avant de
    // choisir son CTA : Plex est optionnel, l'index de fichiers fait foi.
    var libraryResolved by remember(type, tmdbId) { mutableStateOf(false) }
    // Repli de focus pour les fiches sans action principale (une série, un
    // téléchargement, ou une erreur). Un film disponible doit en revanche
    // arriver directement sur sa première action, « Lire ».
    // DEUX rôles distincts, longtemps portés par la même instance :
    //  - `entryFocusRequester` vient de MainActivity et est l'instance
    //    PARTAGÉE que la NavRail vise pour entrer dans le contenu ;
    //  - la fiche a besoin, elle, d'une cible bien à elle pour poser son
    //    focus initial.
    // Les confondre rendait la demande d'ouverture ambiguë : elle pouvait
    // se résoudre ailleurs que sur l'ancre de cette fiche, et le focus
    // restait alors sur le rail — la fiche s'ouvrait « coincée dans la
    // sidebar ». Les deux requesters sont donc chaînés sur le MÊME nœud
    // (motif déjà utilisé par l'accueil), chacun gardant son rôle.
    val ownEntryFocusRequester = remember { FocusRequester() }
    val initialFocusRequester = ownEntryFocusRequester
    val primaryActionFocusRequester = remember { FocusRequester() }

    val movies by viewModel.movies.collectAsState()
    val series by viewModel.series.collectAsState()
    val inLibrary by remember(type, tmdbId, movies, series) {
        derivedStateOf {
            if (type == "movie") movies.any { it.tmdbId == tmdbId }
            else series.any { it.tmdbId == tmdbId }
        }
    }

    // File de téléchargement partagée (même StateFlow que la rangée accueil)
    // — source RÉACTIVE de l'état en cours pour CE titre : progression,
    // vitesse, ETA. Le badge et le CTA se mettent à jour sans aucune
    // action utilisateur quand le téléchargement avance ou se termine.
    val queue by viewModel.queue.collectAsState()
    val activeDownload = remember(queue, type, tmdbId) {
        queue.firstOrNull { it.media.tmdbId == tmdbId && it.status != "completed" && it.status != "seeding" }
    }
    // Fichiers en cours de téléchargement pour CETTE série, indexés
    // "saison.épisode" — permet à chaque EpisodeCard d'afficher SA PROPRE
    // progression en direct (voir SeasonEpisodeList/EpisodeCard plus bas),
    // au lieu d'un statut unique pour toute la série (parité avec le pill
    // par épisode du mobile, poussée jusqu'à la vraie progression puisque
    // la donnée queue est déjà chargée sur cette même fiche).
    val episodeDownloads = remember(queue, type, tmdbId) {
        if (type != "series") emptyMap()
        else queue.filter { it.media.tmdbId == tmdbId && it.media.season != null && it.media.episode != null }
            .associateBy { "${it.media.season}.${it.media.episode}" }
    }

    LaunchedEffect(type, tmdbId) {
        viewModel.resolveTitleLibraryEntry(type, tmdbId)
        libraryResolved = true
        viewModel.loadDetail(type, tmdbId)
        viewModel.loadHeroLogo(type, tmdbId)
        // On-deck chargé pour les DEUX types : le libellé « S1 · Ép 3 — titre »
        // + le CTA « Reprendre » d'une série en cours dépendent de
        // continueWatching (il n'était chargé que pour les films — une série
        // ouverte depuis « Continuer à regarder » se comportait comme un film).
        viewModel.loadContinueWatching()
        // Statut "vu" manuel — utile aux deux types (badge "Vu" sur un film
        // terminé, coche par épisode pour une série), voir /api/watch-status.
        viewModel.loadWatchStatus(type, tmdbId)
        // Positions de reprise NON dédupliquées — uniquement pour une série :
        // c'est la seule vue où plusieurs épisodes entamés coexistent et
        // méritent chacun leur barre de progression.
        if (type == "series") viewModel.loadPlaybackProgress()
    }

    // PlayerActivity vit au-dessus de cette fiche. Quand elle se ferme, la
    // composition est conservée : le LaunchedEffect(type, tmdbId) ne repart
    // donc pas. On recharge explicitement le on-deck à ON_RESUME pour que le
    // CTA passe immédiatement de « Lire » à « Reprendre à HH:MM:SS ».
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner, type, tmdbId) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                viewModel.loadContinueWatching()
                viewModel.loadWatchStatus(type, tmdbId)
                if (type == "series") viewModel.loadPlaybackProgress()
                if (viewModel.isInLibrary(type, tmdbId)) {
                    viewModel.refreshTitleLibraryEntry(type, tmdbId)
                }
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    // Même état vivant que la fiche desktop : après l'ajout, la même fiche
    // passe naturellement de "Recherche" à "Téléchargement" puis à la
    // disponibilité Plex. L'endpoint accepte tmdbId, donc on actualise
    // seulement ce titre et jamais toute la médiathèque à intervalle fixe.
    // Rythme accéléré (4s) tant qu'un téléchargement est actif pour CE
    // titre : le passage "Téléchargement en cours…" → "Lire" doit être
    // quasi immédiat à la fin du download, sans attendre un cycle long.
    LaunchedEffect(type, tmdbId, inLibrary) {
        if (!inLibrary) return@LaunchedEffect
        viewModel.refreshTitleLibraryEntry(type, tmdbId)
        while (true) {
            delay(if (activeDownload != null) 4_000 else 8_000)
            viewModel.refreshTitleLibraryEntry(type, tmdbId)
        }
    }

    // Polling de la file partagée pendant que la fiche est ouverte —
    // alimente progression % / vitesse / ETA en direct (même source que la
    // rangée "Téléchargements en cours" de l'accueil).
    LaunchedEffect(type, tmdbId, inLibrary) {
        if (!inLibrary) return@LaunchedEffect
        while (true) {
            viewModel.loadQueue()
            delay(3_000)
        }
    }

    // Saisons : chargées à l'ajout PUIS rafraîchies en boucle tant que la
    // fiche reste ouverte — sans cette boucle (avant ce correctif, un seul
    // chargement), le statut de chaque épisode restait figé sur "Recherche…"
    // /"Téléchargement" même une fois le fichier réellement prêt côté Plex,
    // contrairement au film qui a déjà sa propre boucle ci-dessus. Rythme
    // accéléré (4s) tant qu'un épisode de CETTE série est activement en
    // cours (mêmes seuils que le film), sinon 10s — pas la peine de re-tirer
    // toute la liste des saisons aussi souvent qu'une seule entrée film.
    LaunchedEffect(type, tmdbId, inLibrary) {
        if (type != "series" || !inLibrary) return@LaunchedEffect
        viewModel.loadSeriesSeasons(tmdbId)
        while (true) {
            val active = viewModel.seriesSeasons.value.any { s -> s.episodes.any { it.status == "downloading" || it.status == "searching" } }
            delay(if (active) 4_000 else 10_000)
            viewModel.loadSeriesSeasons(tmdbId)
        }
    }

    val plexRatingKey by remember(type, tmdbId, movies) {
        derivedStateOf {
            if (type == "movie") movies.firstOrNull { it.tmdbId == tmdbId }?.plexRatingKey
            else null
        }
    }
    val localMovieId = remember(type, tmdbId, movies) {
        if (type == "movie") movies.firstOrNull { it.tmdbId == tmdbId && it.playbackSource == "movviz" }?.id else null
    }
    // Fichier déplacé + renommé au bon endroit = lisible immédiatement, sans
    // attendre Plex : dès que le file est enregistré (import engine, même si
    // playbackSource n'est pas encore positionné et Plex n'a pas scanné), la
    // fiche propose "Lire" via une clé synthétique Movviz (même mécanisme que
    // les épisodes via episodePlaybackTarget) résolue en local par le player
    // (localMovieUrl). Ne s'active jamais sans file : un téléchargement en
    // cours sans fichier garde sa pilule de progression.
    val localPlayableId = remember(type, tmdbId, movies) {
        if (type == "movie") movies.firstOrNull { it.tmdbId == tmdbId && it.file != null }?.id else null
    }
    // Au premier rendu, la fiche TMDb arrive souvent avant l'entrée locale.
    // Cette clé réactive indique précisément le moment où le premier CTA
    // utilisable (« Lire » ou « Ajouter ») est réellement composé.
    val moviePrimaryActionReady = type == "movie" && (
        plexRatingKey != null ||
            localPlayableId != null ||
            (libraryResolved && !inLibrary && activeDownload == null)
        )
    val localSeriesId = remember(type, tmdbId, series) {
        if (type == "series") series.firstOrNull { it.tmdbId == tmdbId }?.id else null
    }

    // Reprise pour un film déjà entamé — via /api/plex/on-deck (déjà chargé
    // pour la rangée "Continuer à regarder" de l'accueil), PAS un stockage
    // local à l'appareil : la position doit être la même quel que soit
    // l'appareil utilisé (TV, desktop...), donc côté serveur/compte Plex,
    // jamais un cache propre à un seul écran.
    val continueWatching by viewModel.continueWatching.collectAsState()
    val movieResume = remember(continueWatching, type, tmdbId) {
        if (type != "movie") null
        else continueWatching.firstOrNull { it.type == "movie" && it.tmdbId == tmdbId && it.offsetMs > 5_000L }
    }
    // Même logique côté série : l'épisode en cours de visionnage, pas juste
    // "la série est en bibliothèque" — sans ça la fiche d'une série se
    // comportait comme si de rien n'était, aucune indication de l'épisode
    // en cours ni moyen direct de le reprendre (signalé en direct : "il
    // réagit comme un film" au lieu de proposer l'épisode en cours).
    val episodeResume = remember(continueWatching, type, tmdbId) {
        if (type != "series") null
        else continueWatching.firstOrNull { it.type == "episode" && it.tmdbId == tmdbId && it.offsetMs > 5_000L }
    }

    // Statut "vu" manuel par utilisateur — /api/watch-status, distinct de
    // LibraryStatus (qui dit si le FICHIER existe, pas si on l'a regardé).
    // Le CTA actuel ne distinguait que "jamais commencé" vs "en cours" ;
    // "déjà terminé" est un troisième état réel qu'aucun autre signal ne
    // couvre (movieResume exige un offset > 5s ET vient d'une source
    // différente — le on-deck Plex, pas ce toggle manuel).
    val watchStatus by viewModel.watchStatus.collectAsState()
    val movieWatched = remember(watchStatus, type, tmdbId) {
        type == "movie" && watchStatus?.movies?.contains(tmdbId) == true
    }
    // Clés "saison.épisode" déjà vues pour CETTE série — watchStatus.episodes
    // est global à l'utilisateur (toutes séries confondues, tmdbId = id de
    // la série), donc filtré ici avant de passer aux rangées de saisons.
    val watchedEpisodeKeys = remember(watchStatus, type, tmdbId) {
        if (type != "series") emptySet()
        else watchStatus?.episodes
            ?.filter { it.tmdbId == tmdbId }
            ?.map { "${it.season}.${it.episode}" }
            ?.toSet()
            ?: emptySet()
    }

    // File de lecture épisode par épisode — à plat sur toutes les saisons,
    // dans l'ordre d'affichage, pour que suivant/précédent dans le lecteur
    // puisse traverser une frontière de saison naturellement (S1E10 → S2E1).
    val playableEpisodes = remember(seasons, localSeriesId) {
        seasons.flatMap { season ->
            season.episodes
                .mapNotNull { ep ->
                    if (ep.status != "available") return@mapNotNull null
                    val target = episodePlaybackTarget(
                        seriesId = localSeriesId,
                        plexRatingKey = ep.plexRatingKey,
                        playbackSource = ep.playbackSource,
                        seasonNumber = season.seasonNumber,
                        episodeNumber = ep.episodeNumber,
                    ) ?: return@mapNotNull null
                    QueueItem(
                        ratingKey = target.ratingKey,
                        label = "S${season.seasonNumber} · Ép ${ep.episodeNumber} · ${ep.title}",
                        seasonNumber = season.seasonNumber,
                        episodeNumber = ep.episodeNumber,
                        localKey = target.localSeriesId,
                    )
                }
        }
    }

    // Progression par épisode, indexée "saison.épisode". La jointure se fait
    // sur la CLÉ DE LECTURE et non sur un couple saison/épisode : c'est
    // exactement la clé envoyée à /api/playback/sessions par cette app, donc
    // la correspondance est exacte, alors que seasonNumber/episodeNumber
    // restent vides côté serveur pour tout ce qui a été lancé depuis la TV.
    // Source volontairement différente de continueWatching, dédupliqué à une
    // seule reprise par série — voir PlaybackProgressDto.
    val playbackProgress by viewModel.playbackProgress.collectAsState()
    val episodeProgress = remember(seasons, localSeriesId, playbackProgress, continueWatching) {
        if (type != "series" || (playbackProgress.isEmpty() && continueWatching.isEmpty())) emptyMap()
        else buildMap {
            seasons.forEach { season ->
                season.episodes.forEach { ep ->
                    val target = episodePlaybackTarget(
                        seriesId = localSeriesId,
                        plexRatingKey = ep.plexRatingKey,
                        playbackSource = ep.playbackSource,
                        seasonNumber = season.seasonNumber,
                        episodeNumber = ep.episodeNumber,
                    ) ?: return@forEach
                    playbackProgress[target.ratingKey]?.let {
                        put("${season.seasonNumber}.${ep.episodeNumber}", it)
                    }
                }
            }
            // La reprise vue sur l'accueil (Continuer à regarder) doit aussi
            // apparaître sur la fiche : quand les deux sources ne s'accordent pas
            // sur la clé de l'épisode, l'entrée « on-deck » complète la carte au
            // lieu de laisser « Lecture » repartir du début.
            continueWatching
                .filter { it.type == "episode" && it.tmdbId == tmdbId && it.seasonNumber != null && it.episodeNumber != null && it.offsetMs > 0L }
                .forEach { entry ->
                    val key = "${entry.seasonNumber}.${entry.episodeNumber}"
                    if (!containsKey(key)) {
                        put(key, com.movviz.tv.data.PlaybackProgressDto(ratingKey = "", mediaType = "episode", durationMs = entry.durationMs ?: 0L, resumeOffsetMs = entry.offsetMs))
                    }
                }
        }
    }

    // Comme Netflix : une seule saison développée à la fois. Dès que les
    // saisons Plex arrivent, S1 est la valeur stable par défaut, sans jamais
    // remplacer un choix D-pad déjà effectué.
    // Saison 0 = bonus/spéciaux : elle ne doit jamais PRENDRE LA PLACE des
    // saisons de l'histoire principale, mais l'exclure totalement rendait ses
    // épisodes inatteignables depuis la TV. Elle est donc reléguée en fin de
    // rangée, exactement comme Plex la place après les saisons numérotées.
    val visibleSeasons = remember(seasons) {
        seasons.filter { it.seasonNumber > 0 } + seasons.filter { it.seasonNumber == 0 && it.episodes.isNotEmpty() }
    }
    // Saisons réellement "histoire principale" — base de tous les calculs de
    // complétion : un lot de bonus jamais regardé ne doit pas empêcher une
    // série d'être considérée comme vue (même règle que le serveur).
    val mainSeasons = remember(visibleSeasons) { visibleSeasons.filter { it.seasonNumber > 0 } }
    val seriesWatchTargets = remember(mainSeasons) {
        mainSeasons.flatMap { season ->
            season.episodes.filter { it.status != "upcoming" }
                .map { com.movviz.tv.data.WatchToggleEpisodeDto(season.seasonNumber, it.episodeNumber) }
        }
    }
    val allSeriesWatched = seriesWatchTargets.isNotEmpty() && seriesWatchTargets.all {
        watchedEpisodeKeys.contains("${it.season}.${it.episode}")
    }
    // Prochain épisode à lire — le premier non vu de l'histoire principale,
    // et à défaut le tout premier épisode disponible (série entièrement vue :
    // le bouton relance depuis le début plutôt que de disparaître). Les
    // bonus/spéciaux n'entrent jamais dans ce choix, ils ne sont pas la
    // continuité de la série. -1 = rien de lisible du tout.
    val nextEpisodeIndex = remember(playableEpisodes, watchedEpisodeKeys) {
        val main = playableEpisodes.withIndex().filter { it.value.seasonNumber > 0 }
        val next = main.firstOrNull { !watchedEpisodeKeys.contains("${it.value.seasonNumber}.${it.value.episodeNumber}") }
        (next ?: main.firstOrNull())?.index ?: -1
    }
    val nextEpisode = playableEpisodes.getOrNull(nextEpisodeIndex)
    LaunchedEffect(visibleSeasons) {
        // Ne choisir la saison par défaut qu'à l'OUVERTURE (null) : un
        // rafraîchissement du titre toutes les 8 s ne doit jamais écraser
        // la sélection D-pad (sinon retour à la saison 1 après chaque poll).
        if (selectedSeasonNumber == null && visibleSeasons.isNotEmpty()) {
            val wanted = initialSeasonNumber?.let { s -> visibleSeasons.firstOrNull { it.seasonNumber == s } }
            selectedSeasonNumber = (wanted ?: visibleSeasons.first()).seasonNumber
        }
    }
    val selectedSeason = visibleSeasons.firstOrNull { it.seasonNumber == selectedSeasonNumber }
    // Les jaquettes ne viennent pas de Plex : elles sont portées par le
    // détail TMDb de chaque saison. Les charger dès que la liste Plex est
    // connue permet d'afficher les cartes avant même l'ouverture d'une
    // saison, avec le repli gradient si TMDb n'a aucune image.
    LaunchedEffect(visibleSeasons, type, tmdbId, inLibrary) {
        if (type == "series" && inLibrary) {
            visibleSeasons.forEach { season ->
                viewModel.loadSeasonMetadata(tmdbId, season.seasonNumber)
            }
        }
    }
    val seasonMetadataByNumber = remember(seasonMetadata, tmdbId) {
        seasonMetadata
            .filterKeys { it.startsWith("$tmdbId-") }
            .values
            .associateBy { it.seasonNumber }
    }

    // Arrivée depuis « Continuer à regarder » (onOpenEpisode) : ouvre
    // DIRECTEMENT la fiche de l'épisode en cours (EpisodeDetailOverlay),
    // au lieu de laisser l'utilisateur la chercher dans la liste des
    // saisons. Une seule ouverture automatique — un retour (Retour) ne la
    // rouvre jamais, et un changement de saison manuel non plus.
    var didOpenInitialEpisode by remember(type, tmdbId) { mutableStateOf(false) }
    LaunchedEffect(selectedSeason, seasonMetadata, initialEpisodeNumber) {
        if (didOpenInitialEpisode) return@LaunchedEffect
        if (initialEpisodeNumber == null || selectedSeason == null) return@LaunchedEffect
        val episode = selectedSeason.episodes.firstOrNull { it.episodeNumber == initialEpisodeNumber } ?: return@LaunchedEffect
        didOpenInitialEpisode = true
        selectedEpisode = EpisodeSelection(selectedSeason, episode, null)
    }

    // Focus initial déterministe. Pour un film disponible, la priorité est
    // l'action « Lire » : l'utilisateur vient de valider une carte et peut
    // lancer immédiatement la lecture. Les autres fiches retombent sur
    // l'ancre visuelle logo/titre, qui est toujours déjà composée.
    // Toujours repartir au début réel de la fiche à son ouverture.
    val lazyListState = rememberTvLazyListState().withTvPrefetchDisabled()
    var hasRequestedInitialFocus by remember { mutableStateOf(false) }
    var hasRequestedPrimaryActionFocus by remember(type, tmdbId) { mutableStateOf(false) }
    LaunchedEffect(detail) {
        if (hasRequestedInitialFocus) return@LaunchedEffect
        if (detail == null) return@LaunchedEffect
        hasRequestedInitialFocus = true
        lazyListState.scrollToItem(0)
        // Le tout premier `item{}` composé peut prendre une frame — on
        // retente sur quelques frames plutôt que de laisser un crash D-pad
        // silencieux (constaté en direct) sortir l'utilisateur de l'app.
        repeat(10) { attempt ->
            // L'action principale n'existe que pour les films prêts ou à
            // ajouter. Si elle n'est pas composée, l'ancre de titre reste le
            // repli fiable pour les séries et états transitoires.
            val granted = lastOpenedSeason?.let { seasonCardFocus[it] }?.let { card -> runCatching { card.requestFocus() }.getOrDefault(false) } == true ||
                runCatching { primaryActionFocusRequester.requestFocus() }.getOrDefault(false) ||
                runCatching { initialFocusRequester.requestFocus() }.getOrDefault(false)
            if (granted) return@LaunchedEffect
            if (attempt < 9) withFrameNanos { }
        }
    }

    // Fermeture d'un écran posé par-dessus la fiche (saison, épisode) : le
    // sous-arbre de la fiche vient d'être réactivé, mais plus personne ne
    // demande le focus — la demande d'ouverture, elle, n'a lieu qu'une fois.
    // Sans ceci, Retour depuis une saison rendait la main à la barre de
    // navigation au lieu de la fiche, et il fallait retraverser le rail pour
    // revenir au contenu.
    val anyOverlayOpen = openSeasonNumber != null || selectedEpisode != null
    LaunchedEffect(anyOverlayOpen) {
        if (anyOverlayOpen || detail == null) return@LaunchedEffect
        repeat(20) { attempt ->
            val granted = runCatching { primaryActionFocusRequester.requestFocus() }.getOrDefault(false) ||
                runCatching { initialFocusRequester.requestFocus() }.getOrDefault(false)
            if (granted) return@LaunchedEffect
            if (attempt < 19) withFrameNanos { }
        }
    }

    // L'index local peut arriver après le détail : dans ce cas l'ancre a
    // déjà reçu le focus. Dès que l'action primaire est effectivement
    // composée, on la sélectionne une seule fois — sans perturber la suite
    // de navigation D-pad de l'utilisateur.
    LaunchedEffect(moviePrimaryActionReady) {
        if (!moviePrimaryActionReady || hasRequestedPrimaryActionFocus) return@LaunchedEffect
        repeat(10) { attempt ->
            if (runCatching { primaryActionFocusRequester.requestFocus() }.getOrDefault(false)) {
                hasRequestedPrimaryActionFocus = true
                return@LaunchedEffect
            }
            if (attempt < 9) withFrameNanos { }
        }
    }

    // Parallax du backdrop (effet profondeur Apple TV) : l'image glisse à
    // 0.4x la vitesse de la liste pendant le scroll. Limité aux premiers
    // ~200dp de scroll — le backdrop sort du champ ensuite, l'effet est
    // plafonné et invisible de toute façon. Les voiles ont la même hauteur
    // que l'image (BACKDROP_HEIGHT) : le bas reste opaque et aucun bord
    // d'image ne se devine, même décalé par la parallaxe.
    val parallaxOffset by remember {
        derivedStateOf {
            val scroll = if (lazyListState.firstVisibleItemIndex == 0) {
                lazyListState.firstVisibleItemScrollOffset
            } else {
                Int.MAX_VALUE
            }
            -(minOf(scroll * 0.4f, 60f).toInt()).toFloat()
        }
    }

    // Même pipeline que le hero desktop et les cartes NX : on résout la
    // meilleure source seulement après avoir reçu la fiche, puis le lecteur
    // muet reste derrière le texte et les actions. Sans cet appel, les fiches
    // ne pouvaient afficher qu'un backdrop statique, même lorsqu'un aperçu
    // existait côté Movviz.
    var ambientPreview by remember(type, tmdbId) { mutableStateOf<com.movviz.tv.data.TvPreviewDto?>(null) }
    LaunchedEffect(detail?.tmdbId, type) {
        if (detail == null) return@LaunchedEffect
        delay(900)
        ambientPreview = viewModel.loadTvPreview(type, tmdbId)
    }

    Box(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        val backdropUrl = detail?.backdropPath?.let { "$TMDB_BACKDROP_BASE$it" }
        if (backdropUrl != null) {
            Image(
                painter = rememberAsyncImagePainter(model = backdropUrl),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(BACKDROP_HEIGHT)
                    .graphicsLayer { translationY = parallaxOffset },
            )
        } else {
            Box(modifier = Modifier.fillMaxWidth().height(420.dp).background(MaterialTheme.colorScheme.surface))
        }

        // L'aperçu est placé AU-DESSUS de l'image mais SOUS les dégradés : le
        // titre, synopsis et CTA gardent le même contraste à distance. Le
        // fallback TMDb est utile le temps que les sources directes arrivent.
        val preview = ambientPreview
        val previewKeys = preview?.ambientVideoKeys ?: detail?.ambientVideoKeys.orEmpty()
        if (preview != null || previewKeys.isNotEmpty()) {
            AmbientPreview(
                directSources = preview?.directSources.orEmpty(),
                trailerKeys = previewKeys,
                title = preview?.title ?: detail?.title.orEmpty(),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(BACKDROP_HEIGHT)
                    .graphicsLayer { translationY = parallaxOffset },
            )
        }

        // Même double dégradé que le web (vertical pour la lisibilité du bas,
        // horizontal pour ancrer le texte à gauche) — juste transposé à des
        // Brush Compose au lieu de classes Tailwind.
        // Les voiles couvrent TOUTE la hauteur de l image (480dp) : à 420dp ils
        // laissaient 60dp d image à nu puis une coupure nette en bas.
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(BACKDROP_HEIGHT)
                .background(
                    Brush.verticalGradient(
                        colors = listOf(Color.Transparent, MaterialTheme.colorScheme.background.copy(alpha = 0.75f), MaterialTheme.colorScheme.background),
                    ),
                ),
        )
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(BACKDROP_HEIGHT)
                .background(
                    Brush.horizontalGradient(
                        colors = listOf(MaterialTheme.colorScheme.background.copy(alpha = 0.55f), Color.Transparent),
                    ),
                ),
        )

        if (detail == null) {
            if (detailError == null) {
                Text(
                    text = "Chargement…",
                    style = TextStyle(fontSize = 12.sp, color = MaterialTheme.colorScheme.onBackground),
                    modifier = Modifier.padding(start = 42.dp, top = 240.dp),
                )
            } else {
                Column(
                    modifier = Modifier.padding(start = 84.dp, top = 233.dp),
                    verticalArrangement = Arrangement.spacedBy(11.dp),
                ) {
                    Text(
                        text = "Impossible de charger cette fiche",
                        style = TextStyle(fontSize = 18.sp, fontWeight = FontWeight.Bold, color = MovvizInk),
                    )
                    Text(
                        text = "Vérifiez la connexion puis réessayez.",
                        style = TextStyle(fontSize = 11.sp, color = MovvizInkSoft),
                    )
                    Surface(
                        onClick = { viewModel.loadDetail(type, tmdbId) },
                        modifier = Modifier.focusRequester(initialFocusRequester).tvPointerClick { viewModel.loadDetail(type, tmdbId) },
                        shape = ClickableSurfaceDefaults.shape(RoundedCornerShape(18.dp)),
                        scale = ClickableSurfaceDefaults.scale(focusedScale = 1f), colors = ClickableSurfaceDefaults.colors(
                            containerColor = MovvizBrand,
                            focusedContainerColor = MovvizBrand2,
                            contentColor = Color.White,
                            focusedContentColor = Color.White,
                        ),
                    ) {
                        Text("Réessayer", style = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.Bold), modifier = Modifier.padding(horizontal = 17.dp, vertical = 9.dp))
                    }
                }
                LaunchedEffect(detailError) {
                    repeat(10) { attempt ->
                        if (runCatching { initialFocusRequester.requestFocus() }.getOrDefault(false)) return@LaunchedEffect
                        if (attempt < 9) withFrameNanos { }
                    }
                }
            }
            return@Box
        }
        val d = detail!!
        // Fenêtre d'ouverture de la fiche : si le focus tombe tout seul sur une
        // carte de saison (l'action principale vient d'être recomposée et a
        // perdu le focus), on le rend à l'action principale au lieu de laisser
        // la saison 1 encadrée comme si elle était choisie.
        val detailReadyAt = remember(d.tmdbId) { android.os.SystemClock.uptimeMillis() }
        var seasonFocusGuardUsed by remember(d.tmdbId) { mutableStateOf(false) }
        // UN SEUL chemin de lecture d'un épisode pour tous les boutons (série,
        // saison, fiche épisode) : la position de reprise vient de la même
        // source que le libellé « Reprendre à … » et est transmise au lecteur ;
        // sans reprise, l'épisode démarre du début (jamais d'une position
        // périmée). Un épisode introuvable dans la file le dit au lieu de ne
        // rien faire.
        val playContext = androidx.compose.ui.platform.LocalContext.current
        fun episodeResumeMs(seasonNumber: Int, episodeNumber: Int): Long? {
            val key = "$seasonNumber.$episodeNumber"
            if (watchedEpisodeKeys.contains(key)) return null
            return episodeProgress[key]?.resumeOffsetMs?.takeIf { it > 5_000L }
        }
        fun playEpisode(seasonNumber: Int, episodeNumber: Int, resumeMs: Long?, fromStart: Boolean = false) {
            val index = playableEpisodes.indexOfFirst {
                it.seasonNumber == seasonNumber && it.episodeNumber == episodeNumber
            }
            if (index < 0) {
                android.widget.Toast.makeText(playContext, "Cet épisode n'est pas encore lisible", android.widget.Toast.LENGTH_SHORT).show()
                return
            }
            if (fromStart || resumeMs == null) onPlayFromStart(d.title, playableEpisodes, index, d.posterPath)
            else onPlay(d.title, playableEpisodes, index, d.posterPath, resumeMs)
        }
        val titleLogoPath = heroLogos["$type-$tmdbId"]
        var showTitleFallback by remember(titleLogoPath, d.tmdbId) { mutableStateOf(false) }
        LaunchedEffect(titleLogoPath, d.tmdbId) {
            showTitleFallback = false
            if (titleLogoPath == null) {
                delay(3_000)
                showTitleFallback = true
            }
        }

        // Rangée "Titres similaires" — même esprit Netflix/Apple TV que le
        // web (TitleContent.tsx, "title.similar") : d.similar vient du même
        // /api/metadata/detail déjà appelé pour cette fiche (recommandations
        // TMDb), pas un appel réseau séparé. Calculé ici (hors du DSL
        // LazyColumn, où `remember` n'est pas utilisable) puis réutilisé via
        // TitleRow/TvTitleCard de l'accueil pour rester visuellement
        // identique aux autres rangées de posters de l'app.
        val similarWatchedMovieIds = remember(watchStatus) { watchStatus?.movies?.toSet().orEmpty() }
        val similarCards = remember(d, similarWatchedMovieIds) {
            d.similar
                .filter { !(it.tmdbId == tmdbId && it.type == type) }
                .map { TvTitleCard(it.tmdbId.toString(), it.title, it.posterPath, it.backdropPath, it.tmdbId, isMovie = it.type == "movie") }
                .withWatchedMovies(similarWatchedMovieIds)
        }

        // Spec de scroll MINIMAL (comportement mobile) au lieu du pivot TV :
        // le pivot par défaut (~30% du bord) faisait DÉFILER la fiche à
        // l'ouverture dès que le focus initial atterrissait sur le CTA —
        // l'utilisateur voyait la fiche bouger toute seule ("auto scroll"
        // demandé en direct). Avec la spec vide, le scroll ne survient que
        // si l'élément focalisé est hors champ (saisons/épisodes plus bas).
        // Un overlay opaque ne retire PAS ses frères de l'arbre de focus :
        // l'écran de saison se dessine par-dessus cette fiche, mais la fiche
        // reste composée et focusable en dessous, donc la recherche spatiale
        // peut y envoyer le focus — qui disparaît alors de l'écran. Le
        // groupe est désactivé tant que l'écran de saison est ouvert : rien
        // n'est démonté (le retour retrouve exactement le même état et la
        // même carte focalisée), c'est seulement inatteignable au D-pad.
        val seasonPageOpen = visibleSeasons.any { it.seasonNumber == openSeasonNumber }
        val episodePageOpen = selectedEpisode != null
        CompositionLocalProvider(
            LocalBringIntoViewSpec provides object : BringIntoViewSpec {},
        ) {
        TvLazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(start = 42.dp, end = 42.dp, bottom = 30.dp)
                // Appliqué UNIQUEMENT quand un écran est posé au-dessus :
                // `focusGroup()` crée un focus target, donc le poser en
                // permanence change le parcours du cas normal (focus initial
                // capturé par le groupe au lieu d'atteindre la cible
                // d'entrée). Hors overlay, la chaîne doit rester exactement
                // celle d'avant.
                .then(
                    if (seasonPageOpen || episodePageOpen || trailerOpen) {
                        Modifier.focusProperties { canFocus = false }.focusGroup()
                    } else Modifier,
                ),
            state = lazyListState,
            // La barre supérieure flotte au-dessus du backdrop : une zone
            // sûre explicite empêche logo, titre et première ligne de passer
            // sous elle, en 1080p comme en 4K.
            contentPadding = PaddingValues(top = 84.dp),
        ) {
            item {
            // Première cible D-pad = la zone VISUELLE du logo/titre, jamais
            // une ligne technique invisible. Elle garde l'ouverture en haut
            // de la fiche et donne un point d'ancrage réel au premier UP.
            var topAnchorFocused by remember { mutableStateOf(false) }
            LaunchedEffect(topAnchorFocused) {
                if (topAnchorFocused) lazyListState.animateScrollToItem(0)
            }
            Box(
                modifier = Modifier
                    .width(540.dp)
                    .heightIn(min = 87.dp)
                    // Les deux requesters sur le même nœud : celui de la
                    // fiche (focus d'ouverture) et celui, partagé, que la
                    // NavRail vise pour entrer dans le contenu.
                    .focusRequester(initialFocusRequester)
                    .let { if (entryFocusRequester != null) it.focusRequester(entryFocusRequester) else it }
                    .focusable()
                    // La destination spatiale par défaut privilégiait le
                    // bouton d'état (« Marquer vu ») situé plus bas. Depuis
                    // l'en-tête d'une fiche film, BAS mène toujours à la
                    // première action utile : « Lire ».
                    .onPreviewKeyEvent { event ->
                        if (
                            event.type == KeyEventType.KeyDown &&
                            event.key == Key.DirectionDown &&
                            moviePrimaryActionReady
                        ) {
                            runCatching { primaryActionFocusRequester.requestFocus() }.getOrDefault(false)
                        } else {
                            false
                        }
                    }
                    .onFocusChanged { topAnchorFocused = it.isFocused }
                    // Le focus est volontairement discret, mais réel : le
                    // logo/titre devient son propre repère au lieu d'une
                    // ancre technique minuscule et invisible.
                    .background(
                        if (topAnchorFocused) Color.White.copy(alpha = 0.07f) else Color.Transparent,
                        RoundedCornerShape(9.dp),
                    ),
            ) {
                if (titleLogoPath != null) {
                    Image(
                        painter = rememberAsyncImagePainter(model = "$TMDB_LOGO_BASE$titleLogoPath"),
                        contentDescription = d.title,
                        contentScale = ContentScale.Fit,
                        alignment = Alignment.CenterStart,
                        modifier = Modifier
                            .heightIn(max = 87.dp)
                            .width(465.dp),
                    )
                } else if (showTitleFallback) {
                    Text(
                        text = d.title,
                        style = TextStyle(fontSize = 33.sp, fontWeight = FontWeight.Black, color = MovvizInk),
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.widthIn(max = 540.dp),
                    )
                }
            }

            // Les états appartiennent au titre qu'on vient de lire : juste
            // sous le logo officiel, jamais avant lui.
            if (inLibrary || movieWatched) {
                Spacer(modifier = Modifier.height(9.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    // Badge d'état RÉACTIF : reflète la file en direct
                    // (Recherche…/Téléchargement) plutôt qu'un statut
                    // bibliothèque figé — la fin du download bascule seul
                    // vers "Disponible" (movies rafraîchies toutes les 4s).
                    if (inLibrary) {
                        val libEntry = if (type == "movie") movies.firstOrNull { it.tmdbId == tmdbId } else null
                        when {
                            activeDownload != null -> StatusBadge(
                                if (activeDownload.status == "searching") "Recherche…" else "Téléchargement",
                                MovvizCyan,
                            )
                            libEntry?.status != null -> {
                                val tone = statusTone(libEntry.status)
                                StatusBadge(tone.label, tone.color)
                            }
                            else -> StatusBadge("Dans la bibliothèque", MovvizOk)
                        }
                    }
                    if (movieWatched) StatusBadge("Vu", MovvizCyan, icon = MovvizIconCheck)
                }
            }

            // Titre original — affiché seulement s'il diffère réellement du
            // titre localisé (ex: "The Dark Knight" sous "The Dark Knight :
            // Le Chevalier noir"), confirmé en direct contre
            // /api/metadata/detail. Un titre déjà identique (le cas le plus
            // fréquent) n'affiche rien de plus.
            if (!d.originalTitle.isNullOrBlank() && !d.originalTitle.equals(d.title, ignoreCase = true)) {
                Text(
                    text = "Titre original : ${d.originalTitle}",
                    style = TextStyle(fontSize = 10.sp, color = MovvizInkDim),
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                // Pas de note TMDb (rating = 0) → pas d'étoile du tout :
                // "★ 0.0" est trompeur, une valeur absente n'est pas zéro.
                if (d.rating > 0) {
                    Icon(
                        imageVector = MovvizIconStar,
                        contentDescription = null,
                        tint = Color(0xFFF5C144),
                        modifier = Modifier.size(11.dp),
                    )
                    Text(
                        text = "%.1f".format(d.rating),
                        style = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFFF5C144)),
                    )
                    MetaSep()
                }
                Text(text = d.year?.toString() ?: "—", style = metaStyle())
                d.runtime?.let {
                    MetaSep()
                    Text(text = "$it min", style = metaStyle())
                }
                if (d.genres.isNotEmpty()) {
                    MetaSep()
                    Text(
                        text = d.genres.take(3).joinToString("  •  "),
                        style = metaStyle(),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.widthIn(max = 240.dp),
                    )
                }
            }

            d.crew.firstOrNull { it.job == "Director" }?.let { director ->
                Spacer(modifier = Modifier.height(5.dp))
                Row {
                    Text(text = "Réalisation ", style = TextStyle(fontSize = 10.sp, color = MovvizInkDim))
                    Text(text = director.name, style = TextStyle(fontSize = 10.sp, fontWeight = FontWeight.SemiBold, color = MovvizInkSoft))
                }
            }

            // Saga TMDb (belongs_to_collection) — simple mention texte, pas
            // de duplication d'un écran Collections qui n'existe pas côté TV.
            // Zone secondaire discrète, jamais la hiérarchie principale.
            d.collection?.let { collection ->
                Spacer(modifier = Modifier.height(5.dp))
                Row {
                    Text(text = "Fait partie de ", style = TextStyle(fontSize = 10.sp, color = MovvizInkDim))
                    Text(text = collection.name, style = TextStyle(fontSize = 10.sp, fontWeight = FontWeight.SemiBold, color = MovvizInkSoft))
                }
            }

            if (d.tagline.isNotBlank()) {
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = d.tagline,
                    style = TextStyle(fontSize = 11.sp, fontStyle = FontStyle.Italic, color = MovvizInkSoft),
                    modifier = Modifier.widthIn(max = 480.dp),
                )
            }

            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = d.overview,
                style = TextStyle(fontSize = 11.sp, color = MovvizInkSoft, lineHeight = 15.sp),
                maxLines = 4,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.widthIn(max = 480.dp),
            )

            Spacer(modifier = Modifier.height(18.dp))

            // Actions secondaires posées sur la MÊME ligne que le CTA (plus
            // en colonne dessous) : bande-annonce, puis « vu » en simple icône.
            // Chaque Row qui les reçoit est en spacedBy(9.dp) : une action
            // absente n'ajoute donc aucun espace fantôme.
            // Bande-annonce : clés YouTube de la fiche (contexte "Trailer",
            // comme le bouton du desktop) puis sources directes de
            // /api/tv/preview.
            val trailerDirectSources = ambientPreview?.directSources.orEmpty()
            val trailerAction: @Composable () -> Unit = {
                if (hasTrailer(d.trailerKeys, trailerDirectSources)) {
                    PrimaryPill(
                        text = "Bande-annonce",
                        brush = null,
                        icon = MovvizIconFilm,
                        focusRequester = trailerButtonFocus,
                    ) { trailerOpen = true }
                }
            }
            val seriesWatchAction: @Composable () -> Unit = {
                if (type == "series" && seriesWatchTargets.isNotEmpty()) {
                    WatchedToggle(
                        watched = allSeriesWatched,
                        label = if (allSeriesWatched) "Série vue — marquer comme non vue" else "Marquer toute la série comme vue",
                        // Dernier filet : une série EN bibliothèque dont aucun
                        // épisode n'est encore téléchargé n'affiche ni reprise
                        // ni bouton de lecture — aucune branche du CTA ne rend
                        // quoi que ce soit. Sans cette cible, la fiche
                        // s'ouvrait sans action focusable et le focus restait
                        // sur le rail (cas confirmé sur émulateur avec une
                        // série non téléchargée). Elle ne prend le rôle que si
                        // aucun vrai CTA n'existe, pour ne jamais voler le
                        // focus à « Lire ».
                        focusRequester = if (episodeResume == null && nextEpisode == null) primaryActionFocusRequester else null,
                    ) {
                        viewModel.toggleEpisodesWatched(tmdbId, d.title, seriesWatchTargets, !allSeriesWatched, scope = "series")
                    }
                }
            }

            // Film : un seul CTA (Lire si le fichier est prêt, sinon Ajouter).
            // Série : Ajouter tant qu'elle n'est pas en bibliothèque — une
            // fois dedans, la lecture se fait épisode par épisode plus bas,
            // pas de CTA générique unique (mêmes hiérarchie qu'un show sur
            // Plex/Netflix : jamais un simple bouton "Lire" sur une série).
            if (type == "movie") {
                Column {
                    Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                        val plexKey = plexRatingKey
                        // "Lire" dès que le fichier est prêt côté Movviz, sans
                        // attendre la clé Plex (scan Plex + sync, plusieurs
                        // minutes). playKey synthétique = id Movviz, résolu en
                        // local via localKey (voir localMovieUrl) — Plex ne
                        // fournit qu'un enrichissement async, jamais bloquant.
                        val playKey = plexKey ?: localPlayableId
                        if (playKey != null) {
                            val ctaText = if (movieResume != null) "Reprendre à ${formatResumeTime(movieResume.offsetMs)}" else "Lire"
                            PrimaryPill(
                                text = ctaText,
                                brush = null,

                                icon = MovvizIconPlay,
                                focusRequester = primaryActionFocusRequester,
                            ) {
                                val movieQueue = listOf(QueueItem(playKey, null, -1, -1, localMovieId ?: localPlayableId))
                                if (movieResume != null) onPlay(d.title, movieQueue, 0, d.posterPath, movieResume.offsetMs)
                                else onPlayFromStart(d.title, movieQueue, 0, d.posterPath)
                            }
                            if (movieResume != null) {
                                PrimaryPill(text = "Lire depuis le début", brush = null, icon = MovvizIconReplay) {
                                    onPlayFromStart(d.title, listOf(QueueItem(playKey, null, -1, -1, localMovieId ?: localPlayableId)), 0, d.posterPath)
                                }
                            }
                        } else if (!libraryResolved) {
                            PrimaryPill(text = "Vérification du fichier…", brush = null, enabled = false, onClick = {})
                        } else if (!inLibrary) {
                            PrimaryPill(
                                text = if (addingToLibrary) "Ajout…" else "Ajouter à la bibliothèque",
                                brush = Brush.horizontalGradient(listOf(MovvizBrand, MovvizBrand2)),

                                enabled = !addingToLibrary,
                                icon = if (addingToLibrary) null else MovvizIconPlus,
                                focusRequester = primaryActionFocusRequester,
                            ) {
                                scope.launch {
                                    when (val result = viewModel.addCurrentToLibrary(type, tmdbId)) {
                                        is ApiResult.Failure -> addError = friendlyAddError(result.message)
                                        else -> addError = null
                                    }
                                }
                            }
                        } else if (activeDownload != null) {
                            // Téléchargement en cours pour CE titre : pilule
                            // vivante avec % + vitesse + ETA + barre de
                            // progression — se met à jour toute seule (queue
                            // pollée 3s) et disparaît au profit de "Lire"
                            // dès que le fichier est prêt.
                            DownloadProgressPill(
                                progress = activeDownload.download.progress,
                                speedBytesPerSec = activeDownload.download.downloadSpeed,
                                etaSeconds = activeDownload.download.eta,
                                searching = activeDownload.status == "searching",
                            )
                        } else {
                            val movieStatus = remember(type, tmdbId, movies) {
                                if (type == "movie") movies.firstOrNull { it.tmdbId == tmdbId }?.status else null
                            }
                            PrimaryPill(text = movieStatusLabel(movieStatus), brush = null, enabled = false) {}
                        }
                        trailerAction()
                        WatchedToggle(
                            watched = movieWatched,
                            label = if (movieWatched) "Vu — marquer comme non vu" else "Marquer comme vu",
                        ) {
                            viewModel.toggleMovieWatched(tmdbId, d.title, !movieWatched)
                        }
                    }
                    // Fine barre de progression sous le CTA de reprise — même
                    // esprit que le hero de l'accueil (progressPercent sur
                    // PosterCard), juste sous un bouton plutôt que sur un
                    // poster ici.
                    movieResume?.let { resume ->
                        Spacer(modifier = Modifier.height(6.dp))
                        Box(
                            modifier = Modifier
                                .width(150.dp)
                                .height(2.dp)
                                .background(Color.White.copy(alpha = 0.15f), RoundedCornerShape(2.dp)),
                        ) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth(fraction = (resume.progressPercent / 100f).coerceIn(0f, 1f))
                                    .fillMaxHeight()
                                    .background(Brush.horizontalGradient(listOf(MovvizBrand, MovvizBrand2)), RoundedCornerShape(2.dp)),
                            )
                        }
                    }
                    // Infos techniques du fichier RÉELLEMENT en bibliothèque
                    // (pas des infos TMDb) — résolution/codecs/HDR/source, tels
                    // que Plex les a analysés (confirmé en direct contre
                    // /api/library/movies : file.resolution/videoCodec/
                    // audioCodec/hdr/source). Zone secondaire discrète sous le
                    // CTA, jamais la hiérarchie principale de la fiche.
                    if (plexRatingKey != null) {
                        val movieFile = remember(type, tmdbId, movies) {
                            if (type == "movie") movies.firstOrNull { it.tmdbId == tmdbId }?.file else null
                        }
                        movieFile?.let { file ->
                            FileTechInfoRow(file)
                        }
                    }
                }
            } else if (!libraryResolved) {
                Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                    PrimaryPill(text = "Vérification du fichier…", brush = null, enabled = false, onClick = {})
                    trailerAction()
                    seriesWatchAction()
                }
            } else if (!inLibrary) {
                Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                    PrimaryPill(
                        text = if (addingToLibrary) "Ajout…" else "+  Ajouter à la bibliothèque",
                        brush = Brush.horizontalGradient(listOf(MovvizBrand, MovvizBrand2)),

                        enabled = !addingToLibrary,
                        // Cible du focus d'ouverture pour un titre PAS encore
                        // en bibliothèque : sans elle, cette fiche n'avait
                        // aucune action focusable et s'ouvrait sur le rail.
                        focusRequester = primaryActionFocusRequester,
                    ) {
                        scope.launch {
                            when (val result = viewModel.addCurrentToLibrary(type, tmdbId)) {
                                is ApiResult.Failure -> addError = friendlyAddError(result.message)
                                else -> addError = null
                            }
                        }
                    }
                    trailerAction()
                }
            } else if (episodeResume != null) {
                // Série en bibliothèque avec un épisode en cours : même
                // traitement que "Reprendre" côté film (CTA + libellé de
                // l'épisode juste en dessous du titre), pour que l'ouverture
                // depuis "Continuer à regarder" mène droit à la reprise au
                // lieu de laisser deviner où chercher plus bas dans la liste
                // des saisons.
                Column {
                    Text(
                        text = "S${episodeResume.seasonNumber} · Ép ${episodeResume.episodeNumber}" +
                            (episodeResume.episodeTitle?.let { " — $it" } ?: ""),
                        style = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = MovvizInkSoft),
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                        PrimaryPill(
                            text = "Reprendre à ${formatResumeTime(episodeResume.offsetMs)}",
                            brush = null,

                            icon = MovvizIconPlay,
                            // Sans ce requester, la demande de focus
                            // d'ouverture n'avait AUCUNE cible sur une fiche
                            // série (il n'était attaché qu'aux CTA de film) :
                            // le focus restait sur la NavRail et la fiche
                            // s'ouvrait « coincée dans la sidebar ».
                            focusRequester = primaryActionFocusRequester,
                        ) {
                            val resumeSeason = episodeResume.seasonNumber
                            val resumeEpisode = episodeResume.episodeNumber
                            if (resumeSeason != null && resumeEpisode != null) playEpisode(resumeSeason, resumeEpisode, episodeResume.offsetMs)
                        }
                        trailerAction()
                        seriesWatchAction()
                    }
                }
            } else if (type == "series" && nextEpisode != null) {
                // Série en bibliothèque mais AUCUNE reprise en cours : la
                // fiche n'avait tout simplement aucun bouton de lecture, il
                // fallait ouvrir une saison pour espérer lancer quoi que ce
                // soit. Le bouton pointe ici sur le prochain épisode non vu
                // (ou le premier, série entièrement vue), comme le « Lire »
                // d'une fiche série Plex.
                val nextWatched = watchedEpisodeKeys.contains("${nextEpisode.seasonNumber}.${nextEpisode.episodeNumber}")
                val nextResume = episodeResumeMs(nextEpisode.seasonNumber, nextEpisode.episodeNumber)
                Column {
                    Text(
                        text = "S${nextEpisode.seasonNumber} · Ép ${nextEpisode.episodeNumber}",
                        style = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = MovvizInkSoft),
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                        PrimaryPill(
                            text = when {
                                nextWatched -> "Revoir depuis le début"
                                nextResume != null -> "Reprendre à ${formatResumeTime(nextResume)}"
                                else -> "Lire S${nextEpisode.seasonNumber} · Ép ${nextEpisode.episodeNumber}"
                            },
                            brush = null,

                            icon = if (nextWatched) MovvizIconReplay else MovvizIconPlay,
                            // Même raison que la branche « Reprendre » : c'est
                            // la cible du focus d'ouverture d'une fiche série.
                            focusRequester = primaryActionFocusRequester,
                        ) {
                            playEpisode(nextEpisode.seasonNumber, nextEpisode.episodeNumber, nextResume, fromStart = nextWatched)
                        }
                        trailerAction()
                        seriesWatchAction()
                    }
                }
            } else {
                // Série en bibliothèque sans épisode lisible : pas de CTA, mais
                // la bande-annonce et « vu » restent sur leur propre ligne.
                Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                    trailerAction()
                    seriesWatchAction()
                }
            }

            addError?.let {
                Spacer(modifier = Modifier.height(6.dp))
                Text(text = it, style = TextStyle(fontSize = 9.sp, color = MovvizDown))
            }
            } // item

            if (type == "series" && inLibrary) {
                item { Spacer(modifier = Modifier.height(21.dp)) }
                if (seasons.isEmpty()) {
                    item {
                        Text(
                            text = "Chargement des épisodes…",
                            style = TextStyle(fontSize = 10.sp, color = MovvizInkDim),
                        )
                    }
                } else if (visibleSeasons.isEmpty()) {
                    item { Text(text = "Aucune saison principale disponible.", style = TextStyle(fontSize = 10.sp, color = MovvizInkDim)) }
                } else {
                    item {
                        SeasonSelector(
                            seasons = visibleSeasons,
                            metadataBySeasonNumber = seasonMetadataByNumber,
                            watchedEpisodeKeys = watchedEpisodeKeys,
                            focusRequesterFor = { seasonCardFocus.getOrPut(it) { FocusRequester() } },
                            onCardFocused = {
                                if (!seasonFocusGuardUsed && lastOpenedSeason == null &&
                                    android.os.SystemClock.uptimeMillis() - detailReadyAt < 2_000L
                                ) {
                                    seasonFocusGuardUsed = true
                                    scope.launch {
                                        repeat(10) { attempt ->
                                            if (runCatching { primaryActionFocusRequester.requestFocus() }.getOrDefault(false) ||
                                                runCatching { initialFocusRequester.requestFocus() }.getOrDefault(false)
                                            ) return@launch
                                            if (attempt < 9) withFrameNanos { }
                                        }
                                    }
                                }
                            },
                            onSelect = {
                                selectedSeasonNumber = it
                                lastOpenedSeason = it
                                openSeasonNumber = it
                            },
                        )
                    }
                }
            }

            if (d.cast.isNotEmpty()) {
                item { Spacer(modifier = Modifier.height(21.dp)) }
                item { CastRow(cast = d.cast, onOpenPerson = onOpenPerson) }
            }

            // Rangée "Titres similaires" — voir similarCards ci-dessus
            // (calculé hors du DSL LazyColumn, `remember` n'est pas
            // utilisable directement dans le corps d'un `item {}` builder).
            if (similarCards.isNotEmpty()) {
                item { Spacer(modifier = Modifier.height(21.dp)) }
                item {
                    TitleRow(
                        heading = "Titres similaires",
                        items = similarCards,
                        onClick = { card -> onOpenTitle(if (card.isMovie) "movie" else "series", card.tmdbId) },
                        titleLogoPaths = heroLogos,
                        onFocusedCard = { viewModel.requestHeroLogo(if (it.isMovie) "movie" else "series", it.tmdbId) },
                    )
                }
            }
        }
        }

        // Écran de saison au-dessus de la fiche série : il ne laisse ni les
        // épisodes ni la navigation générale se superposer à la hiérarchie.
        // Retour referme exactement ce niveau, avant de quitter la fiche.
        val openSeason = visibleSeasons.firstOrNull { it.seasonNumber == openSeasonNumber }
        if (openSeason != null) {
            SeasonPageOverlay(
                seriesTitle = d.title,
                season = openSeason,
                metadata = seasonMetadata[viewModel.seasonMetadataKey(tmdbId, openSeason.seasonNumber)],
                watchedEpisodeKeys = watchedEpisodeKeys,
                downloading = searchingSeason == openSeason.seasonNumber,
                episodeDownloads = episodeDownloads,
                episodeProgress = episodeProgress,
                focusLocked = episodePageOpen,
                railEntryFocusRequester = entryFocusRequester,
                onBack = { openSeasonNumber = null },
                onDownloadSeason = { viewModel.downloadSeason(tmdbId, openSeason.seasonNumber) },
                onToggleEpisodesWatched = { episodes, watched ->
                    viewModel.toggleEpisodesWatched(tmdbId, d.title, episodes, watched, scope = "season", season = openSeason.seasonNumber)
                },
                onPlayEpisode = { episode ->
                    playEpisode(
                        openSeason.seasonNumber,
                        episode.episodeNumber,
                        episodeResumeMs(openSeason.seasonNumber, episode.episodeNumber),
                    )
                },
                onOpenEpisode = { episode, metadataEpisode ->
                    selectedEpisode = EpisodeSelection(openSeason, episode, metadataEpisode)
                },
            )
        }

        // Fiche d'épisode — troisième et dernier niveau, posé au-dessus des
        // deux autres pour la même raison : un overlay ne retire pas ses
        // frères de l'arbre de focus, donc chaque niveau désactive celui du
        // dessous plutôt que de compter sur la géométrie.
        selectedEpisode?.let { selection ->
            val episodeKey = "${selection.season.seasonNumber}.${selection.episode.episodeNumber}"
            // Fiche ouverte depuis « Continuer à regarder » : la sélection naît sans
            // métadonnées ; on les relit ici dès que la saison est chargée, pour que
            // capture, synopsis, durée et note apparaissent.
            val liveSelection = if (selection.metadata != null) selection else selection.copy(
                metadata = seasonMetadata[viewModel.seasonMetadataKey(tmdbId, selection.season.seasonNumber)]
                    ?.episodes?.firstOrNull { it.episodeNumber == selection.episode.episodeNumber },
            )
            EpisodeDetailOverlay(
                seriesTitle = d.title,
                selection = liveSelection,
                downloading = searchingSeason == selection.season.seasonNumber,
                watched = watchedEpisodeKeys.contains(episodeKey),
                progress = episodeProgress[episodeKey],
                onDismiss = { selectedEpisode = null },
                onPlay = {
                    val resume = episodeResumeMs(selection.season.seasonNumber, selection.episode.episodeNumber)
                    selectedEpisode = null
                    playEpisode(selection.season.seasonNumber, selection.episode.episodeNumber, resume)
                },
                onPlayFromStart = {
                    selectedEpisode = null
                    playEpisode(selection.season.seasonNumber, selection.episode.episodeNumber, null, fromStart = true)
                },
                onToggleWatched = { watched ->
                    viewModel.toggleEpisodeWatched(
                        tmdbId,
                        d.title,
                        selection.season.seasonNumber,
                        selection.episode.episodeNumber,
                        watched,
                    )
                },
                onDownloadSeason = { viewModel.downloadSeason(tmdbId, selection.season.seasonNumber) },
            )
        }

        if (trailerOpen) {
            TrailerOverlay(
                title = d.title,
                youtubeKeys = d.trailerKeys,
                directSources = ambientPreview?.directSources.orEmpty(),
                originUrl = viewModel.serverUrl.value,
                onClose = { trailerOpen = false },
            )
        }
    }
}

/** Distribution — déjà renvoyée par /api/metadata/detail (cast/crew), juste
 *  jamais affichée côté TV jusqu'ici. Portraits ronds + nom + rôle, même
 *  esprit que la section Distribution du desktop (TitleContent.tsx) mais en
 *  rangée horizontale scrollable, plus naturel au D-pad qu'une grille. */
@Composable
private fun CastRow(cast: List<com.movviz.tv.data.MetaCastMemberDto>, onOpenPerson: (Int) -> Unit) {
    Column(modifier = Modifier.padding(bottom = 6.dp)) {
        Text(
            text = "Distribution",
            style = TextStyle(fontSize = 15.sp, fontWeight = FontWeight.Bold, color = MovvizInk),
            modifier = Modifier.padding(start = 36.dp, bottom = 9.dp),
        )
        TvLazyRow(
            state = rememberTvLazyListState().withTvPrefetchDisabled(),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 36.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            items(cast.take(15), key = { it.id }) { member ->
                val shape = androidx.compose.foundation.shape.RoundedCornerShape(9.dp)
                Surface(
                    onClick = { onOpenPerson(member.id) },
                    modifier = Modifier.width(63.dp).tvPointerClick { onOpenPerson(member.id) },
                    shape = ClickableSurfaceDefaults.shape(shape),
                    scale = ClickableSurfaceDefaults.scale(focusedScale = 1f), colors = ClickableSurfaceDefaults.colors(containerColor = Color.Transparent),
                    border = ClickableSurfaceDefaults.border(
                        focusedBorder = Border(border = androidx.compose.foundation.BorderStroke(2.dp, MaterialTheme.colorScheme.primary), shape = shape),
                    ),
                ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier
                        .width(63.dp)
                        .clip(shape)
                        .background(MovvizSurfaceStrong),
                ) {
                    val photoUrl = member.profilePath?.let { "$TMDB_PROFILE_BASE$it" }
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(69.dp)
                            .background(MovvizSurfaceStrong),
                    ) {
                        if (photoUrl != null) {
                            androidx.compose.foundation.Image(
                                painter = coil.compose.rememberAsyncImagePainter(model = photoUrl),
                                contentDescription = member.name,
                                contentScale = androidx.compose.ui.layout.ContentScale.Crop,
                                modifier = Modifier.fillMaxSize(),
                            )
                        }
                    }
                    // Les visages peuvent être très clairs : le texte ne
                    // repose jamais sur la photo. Ce socle opaque reste
                    // lisible même sur les portraits blancs de casting.
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xF0121218))
                            .padding(horizontal = 4.dp, vertical = 5.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text(
                            text = member.name,
                            style = TextStyle(fontSize = 10.sp, fontWeight = FontWeight.SemiBold, color = Color.White),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                        )
                        if (member.character.isNotBlank()) {
                            Text(
                                text = member.character,
                                style = TextStyle(fontSize = 8.sp, color = Color.White.copy(alpha = 0.72f)),
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                            )
                        }
                    }
                }
                }
            }
        }

}
}

/** Sommaire d'une série : les saisons sont des destinations, pas des onglets
 * qui déploient une seconde page au milieu de la première. */
@Composable
private fun SeasonSelector(
    seasons: List<SeriesSeasonDto>,
    metadataBySeasonNumber: Map<Int, com.movviz.tv.data.MetadataSeasonDto> = emptyMap(),
    watchedEpisodeKeys: Set<String> = emptySet(),
    focusRequesterFor: (Int) -> FocusRequester,
    onCardFocused: (Int) -> Unit = {},
    onSelect: (Int) -> Unit,
) {
    Column(modifier = Modifier.padding(bottom = 15.dp)) {
        Text(text = "Saisons", style = TextStyle(fontSize = 19.sp, fontWeight = FontWeight.Bold, color = MovvizInk))
        Spacer(modifier = Modifier.height(9.dp))
        TvLazyRow(state = rememberTvLazyListState().withTvPrefetchDisabled(), horizontalArrangement = Arrangement.spacedBy(11.dp)) {
            items(seasons, key = { it.seasonNumber }) { season ->
                val seasonPosterPath = metadataBySeasonNumber[season.seasonNumber]?.posterPath
                var focused by remember { mutableStateOf(false) }
                val shape = RoundedCornerShape(8.dp)
                // Avancement de la saison. L'indicateur porte sur le VU, pas
                // sur ce qu'il reste : c'est la sémantique retenue pour tout
                // le client (pastille sur l'épisode vu), et deux sémantiques
                // opposées sur le même écran se liraient de travers.
                val watchable = season.episodes.filter { it.status != "upcoming" }
                val watchedCount = watchable.count { watchedEpisodeKeys.contains("${season.seasonNumber}.${it.episodeNumber}") }
                val seasonComplete = watchable.isNotEmpty() && watchedCount == watchable.size
                val seasonLabel = season.name.ifBlank {
                    if (season.seasonNumber == 0) "Spéciaux" else "Saison ${season.seasonNumber}"
                }
                Column(
                    modifier = Modifier.width(99.dp),
                    horizontalAlignment = Alignment.Start,
                ) {
                    // Vignette verticale façon Plex (pas de texte long dans la
                    // carte) : numéro de saison en grand sur un aplat teinté de
                    // marque, badge du nombre d'épisodes en haut à droite —
                    // remplace l'ancienne carte paysage tout-texte qui jurait
                    // avec le reste de l'app (retour utilisateur direct).
                    Surface(
                        onClick = { onSelect(season.seasonNumber) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .aspectRatio(2f / 3f)
                            .focusRequester(focusRequesterFor(season.seasonNumber))
                            .tvCardFocusHalo(focused, shape)
                            .onFocusChanged {
                                focused = it.isFocused
                                if (it.isFocused) onCardFocused(season.seasonNumber)
                            }
                            .tvPointerClick { onSelect(season.seasonNumber) },
                        shape = ClickableSurfaceDefaults.shape(shape),
                        scale = ClickableSurfaceDefaults.scale(focusedScale = 1f), colors = ClickableSurfaceDefaults.colors(containerColor = Color.Transparent),
                        border = ClickableSurfaceDefaults.border(
                            border = Border(
                                border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.12f)),
                                shape = shape,
                            ),
                            focusedBorder = Border(
                                border = androidx.compose.foundation.BorderStroke(2.dp, MovvizBrand2),
                                shape = shape,
                            ),
                        ),
                    ) {
                        Box(
                            modifier = Modifier.fillMaxSize(),
                        ) {
                            if (seasonPosterPath != null) {
                                Image(
                                    painter = rememberAsyncImagePainter("$TMDB_SEASON_POSTER_BASE$seasonPosterPath"),
                                    contentDescription = seasonLabel,
                                    contentScale = ContentScale.Crop,
                                    modifier = Modifier.fillMaxSize(),
                                )
                                // Voile léger pour conserver la lisibilité du
                                // numéro et du badge sur les jaquettes claires.
                                Box(
                                    modifier = Modifier
                                        .fillMaxSize()
                                        .background(Color.Black.copy(alpha = 0.28f)),
                                )
                            } else {
                                Box(
                                    modifier = Modifier
                                        .fillMaxSize()
                                        .background(
                                            Brush.linearGradient(listOf(MovvizSurfaceStrong, MovvizSurface)),
                                        ),
                                )
                            }
                            // Comme sur Plex : un simple chiffre sur fond noir en
                            // haut à droite = épisodes pas encore vus ; une coche
                            // quand toute la saison est vue ; rien tant que la
                            // saison n'a aucun épisode à voir.
                            if (seasonComplete) {
                                Box(
                                    modifier = Modifier
                                        .align(Alignment.TopEnd)
                                        .background(Color.Black.copy(alpha = 0.88f), RoundedCornerShape(bottomStart = 6.dp))
                                        .padding(horizontal = 8.dp, vertical = 5.dp),
                                ) {
                                    Icon(imageVector = MovvizIconCheck, contentDescription = "Saison vue", tint = Color.White, modifier = Modifier.size(10.dp))
                                }
                            } else if (watchable.isNotEmpty()) {
                                Text(
                                    text = "${watchable.size - watchedCount}",
                                    style = TextStyle(fontSize = 10.sp, fontWeight = FontWeight.Black, color = Color.White),
                                    maxLines = 1,
                                    modifier = Modifier
                                        .align(Alignment.TopEnd)
                                        .background(Color.Black.copy(alpha = 0.88f), RoundedCornerShape(bottomStart = 6.dp))
                                        .padding(horizontal = 8.dp, vertical = 4.dp),
                                )
                            }
                            // Liseré d'avancement collé au bas de la jaquette
                            // — même grammaire que la barre de reprise d'une
                            // vignette d'épisode, en plus discret.
                            if (watchedCount > 0 && !seasonComplete) {
                                Box(
                                    modifier = Modifier
                                        .align(Alignment.BottomStart)
                                        .fillMaxWidth()
                                        .height(3.dp)
                                        .background(Color.Black.copy(alpha = 0.55f)),
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth(fraction = (watchedCount.toFloat() / watchable.size.coerceAtLeast(1)).coerceIn(0f, 1f))
                                            .fillMaxHeight()
                                            .background(Brush.horizontalGradient(listOf(MovvizBrand, MovvizBrand2))),
                                    )
                                }
                            }
                        }
                    }
                    Spacer(Modifier.height(6.dp))
                    Text(
                        text = seasonLabel,
                        style = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.Bold, color = if (focused) Color.White else MovvizInkSoft),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }
    }
}
/**
 * Teinte ambiante extraite de l'affiche.
 *
 * L'écran de saison reprend le parti pris de Plex : le fond n'est pas noir,
 * il prend la couleur dominante de la jaquette. On échantillonne l'image en
 * 24×24 via Coil — pas de bibliothèque de palette en plus pour une seule
 * couleur — en écartant les pixels trop sombres, trop clairs ou trop ternes,
 * qui tirent toutes les affiches vers le même gris. Sans pixel exploitable,
 * on retombe sur la surface de marque plutôt que d'inventer une teinte.
 */
@Composable
private fun rememberAmbientTint(imageUrl: String?): Color {
    val context = androidx.compose.ui.platform.LocalContext.current
    var tint by remember(imageUrl) { mutableStateOf(MovvizSurface) }
    LaunchedEffect(imageUrl) {
        val url = imageUrl ?: return@LaunchedEffect
        val bitmap = runCatching {
            val request = coil.request.ImageRequest.Builder(context)
                .data(url)
                .size(24, 24)
                // Un bitmap matériel n'est pas lisible par getPixel().
                .allowHardware(false)
                .build()
            (coil.Coil.imageLoader(context).execute(request).drawable as? android.graphics.drawable.BitmapDrawable)?.bitmap
        }.getOrNull() ?: return@LaunchedEffect
        var r = 0L
        var g = 0L
        var b = 0L
        var kept = 0
        val hsv = FloatArray(3)
        for (x in 0 until bitmap.width) {
            for (y in 0 until bitmap.height) {
                val pixel = bitmap.getPixel(x, y)
                android.graphics.Color.colorToHSV(pixel, hsv)
                if (hsv[2] < 0.22f || hsv[2] > 0.95f || hsv[1] < 0.20f) continue
                r += android.graphics.Color.red(pixel)
                g += android.graphics.Color.green(pixel)
                b += android.graphics.Color.blue(pixel)
                kept++
            }
        }
        if (kept == 0) return@LaunchedEffect
        tint = Color((r / kept).toInt(), (g / kept).toInt(), (b / kept).toInt())
    }
    val animated by animateColorAsState(targetValue = tint, animationSpec = tween(520), label = "ambientTint")
    return animated
}

/**
 * Page autonome de saison, construite comme un « preplay » Plex : fond
 * ambiant teinté par la jaquette, en-tête qui pose le contexte, barre
 * d'actions, puis les épisodes en GRILLE de vignettes 16:9.
 *
 * La grille (et non une liste dense) est un choix assumé : c'est la forme
 * de Plex, et au D-pad elle transforme une longue descente en un parcours à
 * deux dimensions — une saison de 24 épisodes tient en 6 rangées au lieu de
 * 24. Chaque carte garde une géométrie FIXE ; le focus l'éclaire, il ne la
 * redimensionne jamais.
 *
 * Les protections D-pad de cet écran sont toutes nécessaires et chacune
 * répare un blocage constaté : consommation de HAUT (sinon le conteneur de
 * fiche renvoie le focus derrière l'écran), cible d'entrée propre visée par
 * la barre de navigation (sinon la flèche droite vise le logo de la fiche,
 * invisible sous cet écran), restauration de la carte quittée, et verrou du
 * sous-arbre quand la fiche d'un épisode passe par-dessus.
 */
@OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class, androidx.compose.ui.ExperimentalComposeUiApi::class)
@Composable
private fun SeasonPageOverlay(
    seriesTitle: String,
    season: SeriesSeasonDto,
    metadata: com.movviz.tv.data.MetadataSeasonDto?,
    watchedEpisodeKeys: Set<String>,
    downloading: Boolean,
    episodeDownloads: Map<String, QueueItemDto>,
    episodeProgress: Map<String, com.movviz.tv.data.PlaybackProgressDto>,
    focusLocked: Boolean,
    railEntryFocusRequester: FocusRequester? = null,
    onBack: () -> Unit,
    onDownloadSeason: () -> Unit,
    onToggleEpisodesWatched: (List<com.movviz.tv.data.WatchToggleEpisodeDto>, Boolean) -> Unit,
    onPlayEpisode: (SeriesEpisodeDto) -> Unit,
    onOpenEpisode: (SeriesEpisodeDto, MetadataEpisodeDto?) -> Unit,
) {
    // Désactivé quand la fiche d'un épisode est ouverte : Retour doit fermer
    // UN niveau, jamais deux, sans dépendre d'un ordre d'enregistrement.
    BackHandler(enabled = !focusLocked, onBack = onBack)
    // Retour de la fiche d'un épisode : le focus revient sur SA carte dans la
    // grille, pas sur la sidebar ni sur le premier épisode.
    val episodeCardFocus = remember(season.seasonNumber) { mutableMapOf<Int, FocusRequester>() }
    var lastOpenedEpisode by remember(season.seasonNumber) { mutableStateOf<Int?>(null) }
    val metadataByEpisode = remember(metadata) { metadata?.episodes?.associateBy { it.episodeNumber }.orEmpty() }
    val firstEpisodeFocus = remember { FocusRequester() }
    val primaryActionFocus = remember { FocusRequester() }
    val backFocus = remember { FocusRequester() }
    var episodePageWasOpen by remember(season.seasonNumber) { mutableStateOf(false) }
    LaunchedEffect(focusLocked) {
        if (focusLocked) { episodePageWasOpen = true; return@LaunchedEffect }
        if (!episodePageWasOpen) return@LaunchedEffect
        // Carte d'origine si on la connaît ; sinon (fiche ouverte par « Continuer
        // à regarder ») le premier épisode lisible, puis les actions de l'en-tête :
        // le focus ne doit jamais retomber sur la sidebar ni se perdre.
        val targets = listOfNotNull(
            lastOpenedEpisode?.let { episodeCardFocus[it] },
            firstEpisodeFocus,
            primaryActionFocus,
            backFocus,
        )
        repeat(20) { attempt ->
            if (targets.any { runCatching { it.requestFocus() }.getOrDefault(false) }) return@LaunchedEffect
            if (attempt < 19) withFrameNanos { }
        }
    }
    fun playable(ep: SeriesEpisodeDto) =
        (ep.plexRatingKey != null || ep.playbackSource == "movviz") && ep.status == "available"
    val landingEpisode = remember(season, watchedEpisodeKeys) {
        season.episodes.firstOrNull { playable(it) && !watchedEpisodeKeys.contains("${season.seasonNumber}.${it.episodeNumber}") }
            ?: season.episodes.firstOrNull { playable(it) }
    }
    LaunchedEffect(season.seasonNumber, landingEpisode?.episodeNumber) {
        // Plusieurs cibles, sur plusieurs frames : la carte visée vit dans
        // une grille paresseuse et peut n'être composée que bien après
        // l'en-tête. Quand elle manquait, l'écran s'ouvrait sans AUCUN
        // élément focalisé et le D-pad paraissait mort.
        repeat(20) { attempt ->
            val targets = listOfNotNull(
                landingEpisode?.let { firstEpisodeFocus },
                primaryActionFocus,
                backFocus,
            )
            if (targets.any { runCatching { it.requestFocus() }.getOrDefault(false) }) return@LaunchedEffect
            if (attempt < 19) withFrameNanos { }
        }
    }
    val focusManager = androidx.compose.ui.platform.LocalFocusManager.current
    val ambient = rememberAmbientTint(metadata?.posterPath?.let { "$TMDB_SEASON_POSTER_BASE$it" })
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MovvizBackground)
            .background(
                Brush.verticalGradient(
                    listOf(
                        ambient.copy(alpha = 0.78f),
                        ambient.copy(alpha = 0.30f),
                        MovvizBackground,
                    ),
                ),
            ),
    ) {
        CompositionLocalProvider(LocalBringIntoViewSpec provides object : BringIntoViewSpec {}) {
            TvLazyVerticalGrid(
                columns = androidx.tv.foundation.lazy.grid.TvGridCells.Fixed(4),
                state = rememberTvLazyGridState().withTvPrefetchDisabled(),
                modifier = Modifier
                    .fillMaxSize()
                    // HAUT est CONSOMMÉ ici, toujours : le conteneur de la
                    // fiche bascule sur la barre de navigation dès qu'un
                    // moveFocus(Up) échoue, ce qui enverrait le focus
                    // derrière cet écran opaque.
                    .onKeyEvent { event ->
                        if (event.type == KeyEventType.KeyDown && event.key == Key.DirectionUp) {
                            focusManager.moveFocus(androidx.compose.ui.focus.FocusDirection.Up)
                            true
                        } else false
                    }
                    .then(if (focusLocked) Modifier.focusProperties { canFocus = false } else Modifier)
                    .then(
                        if (railEntryFocusRequester != null) Modifier.focusRequester(railEntryFocusRequester)
                        else Modifier,
                    )
                    .focusRestorer { firstEpisodeFocus }
                    .focusGroup(),
                contentPadding = PaddingValues(start = 42.dp, end = 42.dp, top = 96.dp, bottom = 40.dp),
                horizontalArrangement = Arrangement.spacedBy(18.dp),
                verticalArrangement = Arrangement.spacedBy(22.dp),
            ) {
                item(
                    key = "season-header",
                    span = { androidx.tv.foundation.lazy.grid.TvGridItemSpan(maxLineSpan) },
                ) {
                    SeasonPageHeader(
                        seriesTitle = seriesTitle,
                        season = season,
                        metadata = metadata,
                        watchedEpisodeKeys = watchedEpisodeKeys,
                        episodeProgress = episodeProgress,
                        downloading = downloading,
                        landingEpisode = landingEpisode,
                        primaryActionFocus = primaryActionFocus,
                        backFocus = backFocus,
                        onBack = onBack,
                        onDownloadSeason = onDownloadSeason,
                        onToggleEpisodesWatched = onToggleEpisodesWatched,
                        onPlayEpisode = onPlayEpisode,
                    )
                }
                items(season.episodes, key = { "episode-${it.episodeNumber}" }) { episode ->
                    val key = "${season.seasonNumber}.${episode.episodeNumber}"
                    EpisodeGridCard(
                        episode = episode,
                        metadata = metadataByEpisode[episode.episodeNumber],
                        watched = watchedEpisodeKeys.contains(key),
                        queueItem = episodeDownloads[key],
                        progress = episodeProgress[key],
                        focusRequester = if (episode.episodeNumber == landingEpisode?.episodeNumber) firstEpisodeFocus else null,
                        returnFocusRequester = episodeCardFocus.getOrPut(episode.episodeNumber) { FocusRequester() },
                        onOpenDetails = {
                            lastOpenedEpisode = episode.episodeNumber
                            onOpenEpisode(episode, metadataByEpisode[episode.episodeNumber])
                        },
                    )
                }
            }
        }
    }
}

/**
 * En-tête de l'écran de saison : jaquette, avancement, puis la barre
 * d'actions. Les actions tiennent sur UNE rangée — au D-pad, une barre qui
 * se replie sur deux lignes transforme un aller simple en labyrinthe.
 */
@Composable
private fun SeasonPageHeader(
    seriesTitle: String,
    season: SeriesSeasonDto,
    metadata: com.movviz.tv.data.MetadataSeasonDto?,
    watchedEpisodeKeys: Set<String>,
    episodeProgress: Map<String, com.movviz.tv.data.PlaybackProgressDto>,
    downloading: Boolean,
    landingEpisode: SeriesEpisodeDto?,
    primaryActionFocus: FocusRequester,
    backFocus: FocusRequester,
    onBack: () -> Unit,
    onDownloadSeason: () -> Unit,
    onToggleEpisodesWatched: (List<com.movviz.tv.data.WatchToggleEpisodeDto>, Boolean) -> Unit,
    onPlayEpisode: (SeriesEpisodeDto) -> Unit,
) {
    val watchable = season.episodes.filter { it.status != "upcoming" }
    val watchedCount = watchable.count { watchedEpisodeKeys.contains("${season.seasonNumber}.${it.episodeNumber}") }
    val allWatched = watchable.isNotEmpty() && watchedCount == watchable.size
    val missingCount = season.episodes.count { it.status == "missing" }
    val seasonLabel = season.name.ifBlank {
        if (season.seasonNumber == 0) "Spéciaux" else "Saison ${season.seasonNumber}"
    }
    val landingWatched = landingEpisode != null &&
        watchedEpisodeKeys.contains("${season.seasonNumber}.${landingEpisode.episodeNumber}")
    Column(modifier = Modifier.fillMaxWidth().padding(bottom = 14.dp)) {
        Row(verticalAlignment = Alignment.Top) {
            metadata?.posterPath?.let { poster ->
                Box {
                    Image(
                        painter = rememberAsyncImagePainter("$TMDB_SEASON_POSTER_BASE$poster"),
                        contentDescription = seasonLabel,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.width(112.dp).aspectRatio(2f / 3f).clip(RoundedCornerShape(8.dp)),
                    )
                    // Badge de comptage en coin de jaquette, comme Plex.
                    Text(
                        text = "${season.episodes.size}",
                        style = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color.White),
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .padding(6.dp)
                            .background(Color.Black.copy(alpha = 0.62f), RoundedCornerShape(5.dp))
                            .padding(horizontal = 6.dp, vertical = 2.dp),
                    )
                }
                Spacer(modifier = Modifier.width(20.dp))
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = seriesTitle,
                    style = TextStyle(fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = MovvizInkSoft),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = seasonLabel,
                    style = TextStyle(fontSize = 28.sp, fontWeight = FontWeight.Black, color = MovvizInk),
                )
                Spacer(modifier = Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = "${season.episodes.size} épisodes",
                        style = TextStyle(fontSize = 13.sp, fontWeight = FontWeight.Bold, color = MovvizInkSoft),
                    )
                    if (watchable.isNotEmpty()) {
                        Text(text = "·", style = TextStyle(fontSize = 13.sp, color = MovvizInkDim))
                        Text(
                            text = if (allWatched) "Saison vue" else "$watchedCount/${watchable.size} vus",
                            style = TextStyle(fontSize = 13.sp, fontWeight = FontWeight.Bold, color = if (allWatched) MovvizBrandGlow else MovvizInkSoft),
                        )
                    }
                    if (missingCount > 0) {
                        Text(text = "·", style = TextStyle(fontSize = 13.sp, color = MovvizInkDim))
                        StatusBadge(text = "$missingCount manquants", tone = MovvizAmber, fontSize = 11.sp)
                    }
                }
                Spacer(modifier = Modifier.height(18.dp))
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                    if (landingEpisode != null) {
                        val landingResume = if (landingWatched) null else
                            episodeProgress["${season.seasonNumber}.${landingEpisode.episodeNumber}"]?.resumeOffsetMs?.takeIf { it > 5_000L }
                        PrimaryPill(
                            text = when {
                                landingWatched -> "Revoir l'épisode ${landingEpisode.episodeNumber}"
                                landingResume != null -> "Reprendre l'épisode ${landingEpisode.episodeNumber} à ${formatResumeTime(landingResume)}"
                                else -> "Lire l'épisode ${landingEpisode.episodeNumber}"
                            },
                            brush = null,
                            icon = if (landingWatched) MovvizIconReplay else MovvizIconPlay,
                            focusRequester = primaryActionFocus,
                            onClick = { onPlayEpisode(landingEpisode) },
                        )
                    }
                    if (missingCount > 0) {
                        PrimaryPill(
                            text = if (downloading) "Recherche…" else "Compléter la saison",
                            brush = Brush.horizontalGradient(listOf(MovvizBrand, MovvizBrand2)),
                            enabled = !downloading,
                            icon = if (downloading) null else MovvizIconDownload,
                            focusRequester = if (landingEpisode == null) primaryActionFocus else null,
                            onClick = onDownloadSeason,
                        )
                    }
                    if (watchable.isNotEmpty()) {
                        val targets = watchable.map { com.movviz.tv.data.WatchToggleEpisodeDto(season.seasonNumber, it.episodeNumber) }
                        WatchedToggle(
                            watched = allWatched,
                            label = if (allWatched) "Saison vue — marquer comme non vue" else "Marquer la saison comme vue",
                            onClick = { onToggleEpisodesWatched(targets, !allWatched) },
                        )
                    }
                    PrimaryPill(text = "Retour", brush = null, focusRequester = backFocus, onClick = onBack)
                }
            }
        }
    }
}

/**
 * Une carte d'épisode dans la grille — vignette 16:9, puis le texte sous
 * l'image, exactement la forme d'une carte Plex.
 *
 * La carte a une hauteur FIXE : le titre est sur une ligne, la méta sur
 * une ligne, et la zone d'actions est réservée. Une carte qui grandit au
 * focus décale toute sa rangée et fait sortir les voisines du champ.
 *
 * Une seule cible au D-pad par carte : OK ouvre la fiche de l'épisode, où
 * se trouvent Lire / Reprendre et Marquer vu. Aucune action secondaire sous
 * la vignette, le parcours horizontal de la grille reste court.
 */
@Composable
private fun EpisodeGridCard(
    episode: SeriesEpisodeDto,
    metadata: MetadataEpisodeDto?,
    watched: Boolean = false,
    queueItem: QueueItemDto? = null,
    progress: com.movviz.tv.data.PlaybackProgressDto? = null,
    focusRequester: FocusRequester? = null,
    returnFocusRequester: FocusRequester? = null,
    onOpenDetails: () -> Unit,
) {
    var focused by remember { mutableStateOf(false) }
    val available = (episode.plexRatingKey != null || episode.playbackSource == "movviz") &&
        episode.status == "available"
    val shape = RoundedCornerShape(8.dp)
    val downloading = queueItem != null && (episode.status == "downloading" || episode.status == "searching")
    val resumeFraction = progress?.let {
        if (it.durationMs > 0L) ((it.resumeOffsetMs ?: 0L).toFloat() / it.durationMs.toFloat()).coerceIn(0f, 1f) else null
    }?.takeIf { it > 0.01f }
    Column(modifier = Modifier.fillMaxWidth()) {
        Surface(
            onClick = onOpenDetails,
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(16f / 9f)
                .let { if (focusRequester != null) it.focusRequester(focusRequester) else it }
                .let { if (returnFocusRequester != null) it.focusRequester(returnFocusRequester) else it }
                .tvCardFocusHalo(focused, shape = shape)
                .onFocusChanged { focused = it.isFocused }
                .tvPointerClick(onOpenDetails),
            shape = ClickableSurfaceDefaults.shape(shape = shape),
            scale = ClickableSurfaceDefaults.scale(focusedScale = 1f),
            colors = ClickableSurfaceDefaults.colors(
                containerColor = MovvizSurface,
                focusedContainerColor = MovvizSurfaceStrong,
                contentColor = MovvizInk,
                focusedContentColor = MovvizInk,
            ),
            border = ClickableSurfaceDefaults.border(
                focusedBorder = Border(
                    border = androidx.compose.foundation.BorderStroke(2.dp, Color.White),
                    shape = shape,
                ),
            ),
        ) {
            Box(modifier = Modifier.fillMaxSize()) {
                if (metadata?.stillPath != null) {
                    Image(
                        painter = rememberAsyncImagePainter(model = "$TMDB_STILL_BASE${metadata.stillPath}"),
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
                    )
                } else {
                    Box(modifier = Modifier.fillMaxSize().background(MovvizSurfaceStrong), contentAlignment = Alignment.Center) {
                        Text(text = "ÉP. ${episode.episodeNumber}", style = TextStyle(fontSize = 13.sp, fontWeight = FontWeight.Bold, color = MovvizInkSoft))
                    }
                }
                // Voile bas : le texte incrusté doit rester lisible quelle
                // que soit la capture, y compris une image très claire.
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                            Brush.verticalGradient(
                                listOf(Color.Transparent, Color.Transparent, Color.Black.copy(alpha = 0.55f)),
                            ),
                        ),
                )
                Text(
                    text = "ÉP. ${episode.episodeNumber}",
                    style = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color.White),
                    modifier = Modifier
                        .align(Alignment.BottomStart)
                        .padding(8.dp),
                )
                if (watched) {
                    Box(
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .padding(6.dp)
                            .size(20.dp)
                            .background(Brush.linearGradient(listOf(MovvizBrand3, MovvizBrand, MovvizBrand2)), androidx.compose.foundation.shape.CircleShape),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(imageVector = MovvizIconCheck, contentDescription = "Vu", tint = Color.White, modifier = Modifier.size(11.dp))
                    }
                }
                if (!available) {
                    val tone = statusTone(episode.status)
                    Box(modifier = Modifier.align(Alignment.TopStart).padding(6.dp)) {
                        StatusBadge(text = tone.label, tone = tone.color, fontSize = 10.sp)
                    }
                }
                if (resumeFraction != null && !watched) {
                    Box(
                        modifier = Modifier
                            .align(Alignment.BottomStart)
                            .fillMaxWidth()
                            .height(5.dp)
                            .background(Color.Black.copy(alpha = 0.62f)),
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth(fraction = resumeFraction)
                                .fillMaxHeight()
                                .background(Brush.horizontalGradient(listOf(MovvizBrand, MovvizBrand2))),
                        )
                    }
                }
            }
        }
        Spacer(modifier = Modifier.height(8.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = episode.title,
                    style = TextStyle(fontSize = 14.sp, fontWeight = FontWeight.Bold, color = if (available) MovvizInk else MovvizInkSoft),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(modifier = Modifier.height(3.dp))
                if (downloading && queueItem != null) {
                    if (episode.status == "searching") {
                        Text(text = "Recherche en cours…", style = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = MovvizBrandGlow), maxLines = 1)
                    } else {
                        val pct = (queueItem.download.progress.coerceIn(0.0, 1.0) * 100).toInt()
                        Text(
                            text = listOfNotNull("$pct%", formatSpeedShort(queueItem.download.downloadSpeed)?.let { "$it/s" })
                                .joinToString(" · "),
                            style = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = MovvizCyan),
                            maxLines = 1,
                        )
                    }
                } else {
                    EpisodeMetaRow(episode = episode, metadata = metadata)
                }
            }
        }
    }
}

/** Ligne méta d'un épisode : note, durée, diffusion, définition du fichier
 *  réellement présent. Chaque morceau est optionnel — une fiche TMDb
 *  incomplète laisse simplement la ligne plus courte, jamais un tiret vide
 *  ni un « 0 min ». */
@Composable
private fun EpisodeMetaRow(episode: SeriesEpisodeDto, metadata: MetadataEpisodeDto?) {
    val parts = listOfNotNull(
        metadata?.runtime?.let { formatEpisodeRuntime(it) },
        formatAirDate(metadata?.airDate ?: episode.airDate),
        episode.file?.resolution,
        episode.file?.hdr,
    )
    val rating = metadata?.rating ?: 0.0
    if (parts.isEmpty() && rating <= 0.0) return
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        if (rating > 0.0) {
            Icon(imageVector = MovvizIconStar, contentDescription = null, tint = Color(0xFFF5C542), modifier = Modifier.size(11.dp))
            Text(
                text = "%.1f".format(rating),
                style = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFFF5C542)),
            )
        }
        if (parts.isNotEmpty()) {
            Text(
                text = parts.joinToString("  ·  "),
                style = TextStyle(fontSize = 11.sp, color = MovvizInkDim),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

/** "42 min" ou "1 h 12" — un épisode de plus d'une heure existe (finales,
 *  pilotes doubles) et "72 min" se lit mal de loin. */
private fun formatEpisodeRuntime(minutes: Int): String? {
    if (minutes <= 0) return null
    if (minutes < 60) return "$minutes min"
    val h = minutes / 60
    val m = minutes % 60
    return if (m == 0) "$h h" else "$h h $m"
}

private val MOIS_COURTS = arrayOf(
    "janv.", "févr.", "mars", "avr.", "mai", "juin",
    "juil.", "août", "sept.", "oct.", "nov.", "déc.",
)

/** "2024-01-12" → "12 janv. 2024". Formatage fait à la main plutôt que via
 *  DateTimeFormatter : la date arrive déjà normalisée en ISO côté serveur et
 *  la locale de l'appareil ne doit pas transformer un client francophone en
 *  affichage anglais. Une chaîne inattendue est simplement ignorée. */
private fun formatAirDate(iso: String?): String? {
    val raw = iso?.takeIf { it.length >= 10 } ?: return null
    val year = raw.substring(0, 4).toIntOrNull() ?: return null
    val month = raw.substring(5, 7).toIntOrNull() ?: return null
    val day = raw.substring(8, 10).toIntOrNull() ?: return null
    if (month !in 1..12 || day !in 1..31) return null
    return "$day ${MOIS_COURTS[month - 1]} $year"
}

/** Infos techniques du fichier réellement en bibliothèque (résolution,
 *  codecs, HDR, source) — zone secondaire discrète sous le CTA de lecture,
 *  jamais la hiérarchie principale de la fiche. Texte simple plutôt que les
 *  logos de format du desktop (FormatLogos.tsx) : pas la peine de porter tout
 *  ce système d'assets pour une seule ligne d'infos secondaires côté TV. */
@Composable
private fun FileTechInfoRow(file: com.movviz.tv.data.LibraryFileDto) {
    val parts = listOfNotNull(
        file.resolution,
        file.videoCodec,
        file.audioCodec,
        file.hdr,
        file.source,
    )
    if (parts.isEmpty()) return
    Spacer(modifier = Modifier.height(8.dp))
    Text(
        text = parts.joinToString("  ·  "),
        style = TextStyle(fontSize = 9.sp, color = MovvizInkDim),
    )
}

@Composable
private fun metaStyle() = TextStyle(fontSize = 11.sp, color = MovvizInkSoft)

@Composable
private fun StatusBadge(
    text: String,
    tone: Color,
    icon: ImageVector? = null,
    /** Les listes d'épisodes remontent d'un cran : à côté d'un titre de 15sp,
     *  une pastille de 9sp se lit mal de loin. Le reste de la fiche garde la
     *  densité d'origine. */
    fontSize: androidx.compose.ui.unit.TextUnit = 9.sp,
) {
    Box(
        modifier = Modifier
            .background(tone.copy(alpha = 0.12f), RoundedCornerShape(50))
            .border(1.dp, tone.copy(alpha = 0.25f), RoundedCornerShape(50))
            .padding(horizontal = 9.dp, vertical = 3.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            if (icon != null) {
                Icon(imageVector = icon, contentDescription = null, tint = tone, modifier = Modifier.size(fontSize.value.dp))
            }
            Text(text = text, style = TextStyle(fontSize = fontSize, fontWeight = FontWeight.Bold, color = tone))
        }
    }
}

/**
 * Fiche d'épisode — le niveau le plus profond de la hiérarchie série →
 * saison → épisode.
 *
 * Écran plein, et non plus un `Dialog` : une fenêtre flottante n'existe pas
 * dans le vocabulaire d'une interface de salon, et surtout elle se compose
 * dans sa PROPRE fenêtre, où le focus initial doit être arraché à la main et
 * où rien ne garantit que Retour referme le bon niveau. Ici, l'écran se
 * superpose comme celui de saison : même fond, même zone sûre haute, même
 * BackHandler qui referme exactement ce niveau.
 *
 * OK sur une carte d'épisode ouvre toujours cet écran : Lire / Reprendre,
 * Marquer vu, et le téléchargement d'un épisode qui manque.
 */
@Composable
private fun EpisodeDetailOverlay(
    seriesTitle: String,
    selection: EpisodeSelection,
    downloading: Boolean,
    watched: Boolean,
    progress: com.movviz.tv.data.PlaybackProgressDto?,
    onDismiss: () -> Unit,
    onPlay: () -> Unit,
    onPlayFromStart: () -> Unit,
    onToggleWatched: (Boolean) -> Unit,
    onDownloadSeason: () -> Unit,
) {
    BackHandler(onBack = onDismiss)
    val episode = selection.episode
    val available = (episode.plexRatingKey != null || episode.playbackSource == "movviz") &&
        episode.status == "available"
    val resumeOffset = progress?.resumeOffsetMs?.takeIf { it > 5_000L && !watched }
    // Focus initial sur l'action principale, retenté sur quelques frames : le
    // nœud n'est pas encore attaché à la première composition et
    // requestFocus() lève tant qu'il ne l'est pas.
    val primaryActionFocus = remember { FocusRequester() }
    LaunchedEffect(episode.seasonNumber, episode.episodeNumber) {
        repeat(10) { attempt ->
            if (runCatching { primaryActionFocus.requestFocus() }.getOrDefault(false)) return@LaunchedEffect
            if (attempt < 9) withFrameNanos { }
        }
    }
    val metadata = selection.metadata
    val stillUrl = metadata?.stillPath?.let { "$TMDB_STILL_BASE$it" }
    // Couleur dominante de la capture : elle teinte tout l'écran, comme la
    // fiche épisode de Plex, au lieu d'un fond noir uniforme.
    val tint = rememberAmbientTint(stillUrl)
    Box(modifier = Modifier.fillMaxSize().background(MovvizBackground)) {
        Box(
            modifier = Modifier.fillMaxSize().background(
                Brush.linearGradient(listOf(tint.copy(alpha = 0.92f), tint.copy(alpha = 0.42f), MovvizBackground)),
            ),
        )
        // Texture légère : la capture elle-même, très en retrait.
        if (stillUrl != null) {
            Image(
                painter = rememberAsyncImagePainter(model = stillUrl),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                alpha = 0.12f,
                modifier = Modifier.fillMaxSize(),
            )
        }
        // Voile bas : le tableau technique reste lisible sur toute teinte.
        Box(
            modifier = Modifier.fillMaxSize().background(
                Brush.verticalGradient(listOf(Color.Transparent, Color.Transparent, MovvizBackground.copy(alpha = 0.7f))),
            ),
        )
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(start = 42.dp, end = 42.dp, top = 84.dp, bottom = 30.dp),
            verticalAlignment = Alignment.Top,
        ) {
            Column(modifier = Modifier.width(300.dp)) {
                Box(modifier = Modifier.fillMaxWidth().aspectRatio(16f / 9f).clip(RoundedCornerShape(topStart = 10.dp, topEnd = 10.dp))) {
                    if (stillUrl != null) {
                        Image(
                            painter = rememberAsyncImagePainter(model = stillUrl),
                            contentDescription = null,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.fillMaxSize(),
                        )
                    } else {
                        Box(modifier = Modifier.fillMaxSize().background(MovvizSurfaceStrong), contentAlignment = Alignment.Center) {
                            Text(text = "ÉP. ${episode.episodeNumber}", style = TextStyle(fontSize = 15.sp, fontWeight = FontWeight.Bold, color = MovvizInkSoft))
                        }
                    }
                    if (resumeOffset != null && progress != null && progress.durationMs > 0L) {
                        Box(
                            modifier = Modifier
                                .align(Alignment.BottomStart)
                                .fillMaxWidth()
                                .height(4.dp)
                                .background(Color.Black.copy(alpha = 0.62f)),
                        ) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth(fraction = (resumeOffset.toFloat() / progress.durationMs.toFloat()).coerceIn(0f, 1f))
                                    .fillMaxHeight()
                                    .background(Brush.horizontalGradient(listOf(MovvizBrand, MovvizBrand2))),
                            )
                        }
                    }
                }
                // Bandeau d'état sous la capture, comme « Regardé » sur Plex.
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(30.dp)
                        .background(Color.Black.copy(alpha = 0.32f), RoundedCornerShape(bottomStart = 10.dp, bottomEnd = 10.dp)),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center,
                ) {
                    when {
                        watched -> {
                            Icon(imageVector = MovvizIconCheck, contentDescription = null, tint = MovvizInk, modifier = Modifier.size(12.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(text = "Regardé", style = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = MovvizInk))
                        }
                        resumeOffset != null -> Text(
                            text = "En cours · ${formatResumeTime(resumeOffset)}",
                            style = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = MovvizInk),
                        )
                        else -> Text(text = "Non regardé", style = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = MovvizInkSoft))
                    }
                }
            }
            Spacer(modifier = Modifier.width(30.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = seriesTitle,
                    style = TextStyle(fontSize = 34.sp, fontWeight = FontWeight.Black, color = MovvizInk),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(modifier = Modifier.height(3.dp))
                Text(
                    // Titre TMDb (dans la langue demandée) quand il existe : celui de la
                    // bibliothèque n'est souvent que « Épisode N ».
                    text = metadata?.title?.takeIf { it.isNotBlank() } ?: episode.title,
                    style = TextStyle(fontSize = 19.sp, fontWeight = FontWeight.Bold, color = MovvizInk.copy(alpha = 0.8f)),
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(modifier = Modifier.height(14.dp))
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    Text(
                        text = "Saison ${selection.season.seasonNumber}",
                        style = TextStyle(fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = MovvizInk),
                    )
                    Text(
                        text = "Épisode ${episode.episodeNumber}",
                        style = TextStyle(fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = MovvizInk),
                    )
                    if (!available) {
                        val tone = statusTone(episode.status)
                        StatusBadge(text = tone.label, tone = tone.color)
                    }
                }
                Spacer(modifier = Modifier.height(9.dp))
                // Ligne méta façon Plex : définition en pastille, date, durée,
                // note. Chaque morceau est optionnel, jamais de tiret vide.
                val resolution = episode.file?.resolution
                val rating = metadata?.rating ?: 0.0
                val date = formatAirDate(metadata?.airDate ?: episode.airDate)
                val runtime = metadata?.runtime?.let { formatEpisodeRuntime(it) }
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    if (resolution != null) {
                        Text(
                            text = listOfNotNull(resolution, episode.file?.hdr).joinToString(" "),
                            style = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.Black, color = MovvizInk),
                            modifier = Modifier
                                .background(Color.White.copy(alpha = 0.18f), RoundedCornerShape(4.dp))
                                .padding(horizontal = 7.dp, vertical = 2.dp),
                        )
                    }
                    date?.let { Text(text = it, style = TextStyle(fontSize = 13.sp, color = MovvizInk.copy(alpha = 0.85f))) }
                    runtime?.let { Text(text = it, style = TextStyle(fontSize = 13.sp, color = MovvizInk.copy(alpha = 0.85f))) }
                    if (rating > 0.0) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            Icon(imageVector = MovvizIconStar, contentDescription = null, tint = Color(0xFFF5C542), modifier = Modifier.size(12.dp))
                            Text(text = "%.1f".format(rating), style = TextStyle(fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color(0xFFF5C542)))
                        }
                    }
                }
                Spacer(modifier = Modifier.height(20.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                    if (available) {
                        PrimaryPill(
                            text = if (resumeOffset != null) "Reprendre à ${formatResumeTime(resumeOffset)}" else "Lecture",
                            brush = null,
                            icon = MovvizIconPlay,
                            focusRequester = primaryActionFocus,
                            onClick = onPlay,
                        )
                        if (resumeOffset != null) {
                            PrimaryPill(text = "Du début", brush = null, icon = MovvizIconReplay, onClick = onPlayFromStart)
                        }
                    } else {
                        PrimaryPill(
                            text = if (downloading) "Recherche…" else "Télécharger la saison",
                            brush = Brush.horizontalGradient(listOf(MovvizBrand, MovvizBrand2)),
                            enabled = !downloading,
                            icon = if (downloading) null else MovvizIconDownload,
                            focusRequester = primaryActionFocus,
                            onClick = onDownloadSeason,
                        )
                    }
                    if (episode.status != "upcoming") {
                        WatchedToggle(
                            watched = watched,
                            label = if (watched) "Vu — marquer comme non vu" else "Marquer comme vu",
                            onClick = { onToggleWatched(!watched) },
                        )
                    }
                    PrimaryPill(text = "Retour", brush = null, onClick = onDismiss)
                }
                metadata?.overview?.takeIf { it.isNotBlank() }?.let { overview ->
                    Spacer(modifier = Modifier.height(22.dp))
                    Text(
                        text = overview,
                        style = TextStyle(fontSize = 14.sp, color = MovvizInk.copy(alpha = 0.92f), lineHeight = 21.sp),
                        maxLines = 4,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                // Infos du fichier RÉELLEMENT importé. Réalisation et scénario
                // ne figurent pas ici : le serveur ne les renvoie pas.
                episode.file?.let { EpisodeFileTable(it) }
            }
        }
    }
}

/** Tableau libellé / valeur du fichier d'un épisode, sur deux colonnes comme
 *  la fiche Plex. Une ligne absente du fichier n'est pas affichée. */
@Composable
private fun EpisodeFileTable(file: com.movviz.tv.data.LibraryFileDto) {
    val video = listOfNotNull(file.resolution, file.videoCodec?.let { "($it)" }).joinToString(" ").ifBlank { null }
    val columns = listOf(
        listOfNotNull(video?.let { "Vidéo" to it }, file.audioCodec?.let { "Audio" to it }),
        listOfNotNull(file.hdr?.let { "HDR" to it }, file.source?.let { "Source" to it }),
    ).filter { it.isNotEmpty() }
    if (columns.isEmpty()) return
    Spacer(modifier = Modifier.height(26.dp))
    Row(horizontalArrangement = Arrangement.spacedBy(44.dp)) {
        columns.forEach { column ->
            Column {
                column.forEach { (label, value) ->
                    Row(modifier = Modifier.padding(vertical = 3.dp)) {
                        Text(
                            text = label,
                            style = TextStyle(fontSize = 12.sp, color = MovvizInk.copy(alpha = 0.55f)),
                            modifier = Modifier.width(64.dp),
                        )
                        Text(text = value, style = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = MovvizInk))
                    }
                }
            }
        }
    }
}

@Composable
private fun MetaSep() {
    Text(text = "  •  ", style = TextStyle(fontSize = 11.sp, color = MovvizInkDim))
}

/**
 * « Vu » en simple icône, à côté du CTA : éteint (gris, coche terne) tant que
 * ce n'est pas vu, ALLUMÉ (fond et coche verts, liseré vert) quand c'est vu.
 * Une icône seule ne se lit pas à la télécommande : dès qu'elle a le focus, son
 * libellé s'affiche juste en dessous, en surimpression — posé par un layout de
 * taille nulle, donc il ne décale JAMAIS les boutons voisins (géométrie fixe,
 * voir les pièges D-pad).
 * Repos gris / focus blanc, comme tous les boutons : le vert n'est que l'état.
 */
@Composable
private fun WatchedToggle(
    watched: Boolean,
    label: String,
    focusRequester: FocusRequester? = null,
    onClick: () -> Unit,
) {
    var focused by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(9.dp)
    val greenOnWhite = Color(0xFF0E9F63) // MovvizOk est trop clair sur fond blanc
    Box {
        Surface(
            onClick = onClick,
            modifier = Modifier
                .let { if (focusRequester != null) it.focusRequester(focusRequester) else it }
                .tvFocusLift(focused, shape = shape, maxElevation = 12.dp)
                .onFocusChanged { focused = it.isFocused }
                .tvPointerClick(onClick),
            shape = ClickableSurfaceDefaults.shape(shape = shape),
            scale = ClickableSurfaceDefaults.scale(focusedScale = 1f),
            colors = ClickableSurfaceDefaults.colors(
                containerColor = if (watched) MovvizOk.copy(alpha = 0.16f) else MovvizInk.copy(alpha = 0.1f),
                focusedContainerColor = Color.White,
                contentColor = if (watched) MovvizOk else MovvizInkDim,
                focusedContentColor = if (watched) greenOnWhite else Color.Black,
            ),
            border = ClickableSurfaceDefaults.border(
                border = if (watched) {
                    Border(border = androidx.compose.foundation.BorderStroke(1.5.dp, MovvizOk.copy(alpha = 0.75f)), shape = shape)
                } else {
                    Border.None
                },
                focusedBorder = Border(
                    border = androidx.compose.foundation.BorderStroke(2.dp, Brush.horizontalGradient(listOf(MovvizBrand, MovvizBrand2))),
                    shape = shape,
                ),
            ),
        ) {
            Box(modifier = Modifier.padding(horizontal = 14.dp, vertical = 11.dp)) {
                Icon(imageVector = MovvizIconCheck, contentDescription = label, modifier = Modifier.size(13.dp))
            }
        }
        if (focused) {
            Text(
                text = label,
                style = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = MovvizInk),
                maxLines = 1,
                softWrap = false,
                modifier = Modifier
                    // Taille 0×0 pour le parent : le libellé est dessiné hors
                    // flux, sous le bouton, et ne pousse aucun voisin.
                    .layout { measurable, _ ->
                        val placeable = measurable.measure(androidx.compose.ui.unit.Constraints())
                        layout(0, 0) { placeable.place(0, 42.dp.roundToPx()) }
                    }
                    .background(Color.Black.copy(alpha = 0.72f), RoundedCornerShape(6.dp))
                    .padding(horizontal = 8.dp, vertical = 4.dp),
            )
        }
    }
}

/** Bouton d'action principal — Surface focusable (obligatoire pour le D-pad),
 *  fond dégradé simulé via Modifier.background + containerColor transparent
 *  quand un Brush est fourni, sinon blanc plein (même distinction que
 *  "Lire" en blanc vs "Ajouter" en dégradé de marque côté web). */
@Composable
private fun PrimaryPill(
    text: String,
    brush: Brush?,
    enabled: Boolean = true,
    icon: ImageVector? = null,
    focusRequester: FocusRequester? = null,
    onClick: () -> Unit,
) {
    var focused by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(9.dp)
    Surface(
        onClick = onClick,
        enabled = enabled,
        modifier = Modifier
            .let { if (brush != null) it.background(brush, shape) else it }
            .let { if (focusRequester != null) it.focusRequester(focusRequester) else it }
            .tvFocusLift(focused && enabled, shape = shape, maxElevation = 12.dp)
            .onFocusChanged { focused = it.isFocused }
            .let { if (enabled) it.tvPointerClick(onClick) else it },
        shape = ClickableSurfaceDefaults.shape(shape = shape),
        scale = ClickableSurfaceDefaults.scale(focusedScale = 1f), colors = ClickableSurfaceDefaults.colors(
            // AUCUN bouton n'est blanc au repos : gris + texte blanc, et le
            // blanc (texte noir) est réservé à l'élément réellement focalisé.
            // Un bouton blanc en permanence criait plus fort que le focus
            // lui-même, donc on ne savait plus où l'on était à la
            // télécommande. Seul le variant en dégradé de marque garde son
            // fond propre, dessiné par Modifier.background.
            containerColor = if (brush != null) Color.Transparent else MovvizInk.copy(alpha = 0.1f),
            focusedContainerColor = if (brush != null) Color.Transparent else Color.White,
            contentColor = if (brush != null) Color.White else MovvizInk,
            focusedContentColor = if (brush != null) Color.White else Color.Black,
        ),
        // Le fond focalisé étant blanc, une bordure blanche serait invisible :
        // le liseré passe en dégradé de marque sur ces boutons-là, et reste
        // blanc sur le variant dégradé dont le fond est déjà coloré.
        border = ClickableSurfaceDefaults.border(
            focusedBorder = Border(
                border = if (brush == null) {
                    androidx.compose.foundation.BorderStroke(2.dp, Brush.horizontalGradient(listOf(MovvizBrand, MovvizBrand2)))
                } else {
                    androidx.compose.foundation.BorderStroke(2.dp, Color.White)
                },
                shape = shape,
            ),
        ),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            modifier = Modifier.padding(horizontal = 17.dp, vertical = 11.dp),
        ) {
            if (icon != null) {
                // Sans tint explicite : Icon hérite de LocalContentColor de la
                // Surface (noir sur pilule blanche, encre sinon) — le vecteur
                // est entièrement recoloré par le tint.
                Icon(imageVector = icon, contentDescription = null, modifier = Modifier.size(12.dp))
            }
            Text(
                text = text,
                style = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.Bold),
            )
        }
    }
}

/** Libellé français du vrai statut serveur (voir LibraryStatus dans
 *  src/lib/library/types.ts : upcoming/missing/searching/downloading/
 *  available) — remplace le texte générique "En attente de synchronisation"
 *  qui s'affichait auparavant pour TOUT film en bibliothèque sans fichier
 *  prêt, qu'il soit en recherche, en téléchargement, ou pas encore sorti. */
private fun movieStatusLabel(status: String?): String = when (status) {
    "upcoming" -> "Pas encore sorti"
    "missing" -> "En attente de recherche"
    "searching" -> "Recherche en cours…"
    "downloading" -> "Téléchargement en cours…"
    "available" -> "Import en cours…" // fichier trouvé côté serveur mais pas encore reflété ici (plexRatingKey null)
    else -> "En attente de synchronisation"
}

/** Pilule de téléchargement vivante — remplace le CTA figé pendant qu'un
 *  torrent est actif pour CE titre : pourcentage, vitesse, temps restant et
 *  barre de progression dans la pilule même (pattern Netflix "Downloading
 *  45%"). Non cliquable : la lecture n'est possible qu'une fois le fichier
 *  prêt, la bascule vers "Lire" se fait seule via les StateFlow. */
@Composable
private fun DownloadProgressPill(
    progress: Double,
    speedBytesPerSec: Double,
    etaSeconds: Long,
    searching: Boolean,
    focusRequester: FocusRequester? = null,
) {
    val shape = RoundedCornerShape(9.dp)
    var focused by remember { mutableStateOf(false) }
    val pct = (progress.coerceIn(0.0, 1.0) * 100).toInt()
    Surface(
        onClick = {},
        enabled = false,
        modifier = Modifier
            .let { if (focusRequester != null) it.focusRequester(focusRequester) else it }
            .tvFocusLift(focused, shape = shape)
            .onFocusChanged { focused = it.isFocused },
        shape = ClickableSurfaceDefaults.shape(shape = shape),
        scale = ClickableSurfaceDefaults.scale(focusedScale = 1f), colors = ClickableSurfaceDefaults.colors(
            containerColor = MovvizInk.copy(alpha = 0.14f),
            contentColor = MovvizInkSoft,
        ),
        border = ClickableSurfaceDefaults.border(
            focusedBorder = Border(
                border = androidx.compose.foundation.BorderStroke(2.dp, Color.White.copy(alpha = 0.5f)),
                shape = shape,
            ),
        ),
    ) {
        Column(modifier = Modifier.padding(horizontal = 17.dp, vertical = 9.dp)) {
            Text(
                text = if (searching) {
                    "Recherche en cours…"
                } else {
                    val speed = formatSpeedShort(speedBytesPerSec)
                    val eta = formatEta(etaSeconds)
                    listOfNotNull(
                        "Téléchargement $pct%",
                        speed?.let { "$it/s" },
                        eta?.let { "$it restantes" },
                    ).joinToString(" · ")
                },
                style = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.SemiBold),
            )
            if (!searching) {
                Spacer(modifier = Modifier.height(5.dp))
                Box(
                    modifier = Modifier
                        .width(165.dp)
                        .height(3.dp)
                        .background(Color.White.copy(alpha = 0.14f), RoundedCornerShape(2.dp)),
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(fraction = progress.coerceIn(0.0, 1.0).toFloat())
                            .fillMaxHeight()
                            .background(Brush.horizontalGradient(listOf(MovvizBrand, MovvizBrand2)), RoundedCornerShape(2.dp)),
                    )
                }
            }
        }
    }
}

/** "6.1 Mo" / "840 Ko" — débit brut du moteur BitTorrent (octets/s). */
private fun formatSpeedShort(bytesPerSec: Double): String? {
    if (bytesPerSec <= 0.0) return null
    return if (bytesPerSec >= 1_000_000) "%.1f Mo".format(bytesPerSec / 1_000_000)
    else "%d Ko".format((bytesPerSec / 1_000).toLong())
}

/** ETA secondes → "42 s" / "12 min" / "1 h 05". */
private fun formatEta(seconds: Long): String? {
    if (seconds <= 0L) return null
    return when {
        seconds < 60 -> "${seconds}s"
        seconds < 3600 -> "${seconds / 60} min"
        else -> "%d h %02d".format(seconds / 3600, (seconds % 3600) / 60)
    }
}

/** "1:23:45" ou "9:24" selon la présence d'heures — même format que
 *  formatResumeTime côté desktop (src/lib/player/watchProgress.ts), pour le
 *  CTA "Reprendre à…" d'un film déjà entamé. */
private fun formatResumeTime(offsetMs: Long): String {
    val totalSeconds = (offsetMs / 1000).coerceAtLeast(0)
    val h = totalSeconds / 3600
    val m = (totalSeconds % 3600) / 60
    val s = totalSeconds % 60
    return "%02d:%02d:%02d".format(h, m, s)
}

/** Traduit le message d'erreur brut du serveur en message lisible pour la TV.
 *  Le cas le plus fréquent est un TMDb injoignable (coupure réseau côté
 *  serveur) : l'ajout échoue avec "movie not found on TMDb" qui prête à
 *  confusion — le film n'est pas introuvable, il est juste inaccessible. */
private fun friendlyAddError(raw: String): String = when {
    raw.contains("TMDb", ignoreCase = true) ->
        "Impossible de joindre TMDb — vérifiez la connexion du serveur et réessayez"
    raw.contains("quotaReached") -> "Quota de demandes atteint pour ce compte"
    raw.contains("blocked") -> "Ce titre est bloqué"
    raw.contains("alreadyInLibrary") -> "Déjà dans la bibliothèque"
    raw.contains("duplicateRequest") -> "Demande déjà envoyée pour ce titre"
    else -> "Échec de l'ajout : $raw"
}
