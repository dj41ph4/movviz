package com.movviz.tv.ui.home

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.tween
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.*
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.focusRestorer
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.zIndex
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.foundation.focusGroup
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.foundation.lazy.list.TvLazyColumn
import androidx.tv.foundation.lazy.list.TvLazyRow
import androidx.tv.foundation.lazy.list.rememberTvLazyListState
import androidx.tv.foundation.lazy.list.itemsIndexed as tvItemsIndexed
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.tv.material3.Border
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import coil.imageLoader
import coil.compose.rememberAsyncImagePainter
import coil.request.ImageRequest
import coil.size.Size
import com.movviz.tv.ui.theme.AnimatedLogo
import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color as AndroidColor
import android.graphics.drawable.BitmapDrawable
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.movviz.tv.AppViewModel
import com.movviz.tv.data.QueueItemDto
import com.movviz.tv.data.TrailerSourceDto
import com.movviz.tv.data.TvPreviewDto
import com.movviz.tv.ui.theme.MovvizAmber
import com.movviz.tv.ui.theme.MovvizBrand
import com.movviz.tv.ui.theme.MovvizBrand2
import com.movviz.tv.ui.theme.MovvizBrand3
import com.movviz.tv.ui.theme.MovvizBrandGlow
import com.movviz.tv.ui.theme.MovvizCardShape
import com.movviz.tv.ui.theme.MovvizCyan
import com.movviz.tv.ui.theme.MovvizDown
import com.movviz.tv.ui.theme.MovvizInk
import com.movviz.tv.ui.theme.MovvizInkDim
import com.movviz.tv.ui.theme.MovvizInkSoft
import com.movviz.tv.ui.theme.MovvizIconCheck
import com.movviz.tv.ui.theme.MovvizIconPlay
import com.movviz.tv.ui.theme.MovvizIconStar
import androidx.tv.material3.Icon
import com.movviz.tv.ui.theme.MovvizOk
import com.movviz.tv.ui.theme.MovvizSurfaceStrong
import com.movviz.tv.ui.theme.StaticLogoWithGlow
import com.movviz.tv.ui.theme.QualityPill
import com.movviz.tv.ui.theme.RatingBadge
import com.movviz.tv.ui.theme.StatusPill
import com.movviz.tv.ui.theme.statusTone
import com.movviz.tv.ui.theme.tvFocusLift
import com.movviz.tv.ui.theme.tvCardFocusHalo
import com.movviz.tv.ui.theme.tvPointerClick
import com.movviz.tv.ui.theme.withTvPrefetchDisabled
import kotlinx.coroutines.delay
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView

private const val TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500"
private const val TMDB_LOGO_BASE = "https://image.tmdb.org/t/p/w500"
// w1280, PAS "original" : un backdrop plein écran en "original" télécharge
// jusqu'à 4000px de large (plusieurs Mo décodés en bitmap complet) pour un
// écran TV 1080p qui n'en montre que 1920px — le gaspillage réseau/mémoire
// était visible sur Chromecast 4K. Netflix/Apple TV servent du 1080p max.
private const val TMDB_BACKDROP_BASE = "https://image.tmdb.org/t/p/w1280"
private const val HERO_ROTATE_MS = 8_000L
private const val HERO_COUNT = 5

/** Intervalle de rafraîchissement de la file de téléchargement sur l'accueil
 *  — plus lâche que le polling 500ms de QueueTab.tsx (fait pour un tableau
 *  admin dense) : ici c'est juste une rangée parmi d'autres, pas l'écran
 *  principal de suivi, donc pas besoin de la même fréquence. */
private const val QUEUE_POLL_INTERVAL_MS = 8000L

/** Titre unifié film/série pour l'affichage des rangées et du hero — évite de
 *  dupliquer la Card pour deux types quasi identiques à l'écran. `internal`
 *  (pas `private`) : TitleDetailScreen réutilise TvTitleCard/TitleRow/
 *  PosterCard telles quelles pour sa rangée "Titres similaires", même style
 *  visuel que l'accueil plutôt qu'une variante dupliquée. `status` est null
 *  pour les séries : contrairement aux films, l'API ne renvoie aucun champ de
 *  statut au niveau série (voir le commentaire sur LibrarySeriesDto) donc la
 *  pastille de statut ne s'affiche que sur les posters film. */
internal data class TvTitleCard(
    val id: String,
    val title: String,
    val posterPath: String?,
    val backdropPath: String?,
    val tmdbId: Int,
    val isMovie: Boolean,
    val year: Int? = null,
    val rating: Double = 0.0,
    val genres: List<String> = emptyList(),
    val status: String? = null,
    /** Non-null uniquement pour une carte "Continuer à regarder" — affiche
     *  une fine barre de progression en bas du poster. */
    val progressPercent: Int? = null,
    /** Minutes restantes estimées (durationMs - offsetMs)/60000, si le
     * serveur les fournit. Null pour les entrées sans durée. */
    val remainingMinutes: Int? = null,
    /** Vrai seulement pour le rail « Continuer à regarder ». Les données
     * d'un épisode ajouté peuvent contenir une position héritée, mais ne
     * doivent jamais devenir une fausse reprise. */
    val isResumeCard: Boolean = false,
    /** "4K"/"1080p"/... — voir resolutionLabel(). Absent pour tout ce qui
     *  n'a pas de fichier réel en bibliothèque (séries, découverte). */
    val qualityLabel: String? = null,
    val hasHdr: Boolean = false,
    /** Pastille "VF" de la maquette Accueil — même règle que
     *  qualityLabel/hasHdr : jamais fabriquée. Reste false tant que le
     *  serveur ne renvoie pas la langue audio par titre (aucun champ VF
     *  dans MetaDetailDto/dashboard aujourd'hui). */
    val hasVf: Boolean = false,
    val overview: String = "",
    val runtime: Int? = null,
    val trailerKeys: List<String> = emptyList(),
    /** Source directe prioritaire (MP4/HLS/DASH), avec YouTube en repli. */
    val directTrailerSources: List<TrailerSourceDto> = emptyList(),
    /** Non-null uniquement pour une carte "Continuer à regarder" d'une
     *  série — épisode précis en cours, pour ouvrir directement dessus au
     *  lieu de retomber sur la saison 1 (voir onOpenEpisode). */
    val resumeSeasonNumber: Int? = null,
    val resumeEpisodeNumber: Int? = null,
    /** Titre de l'épisode repris. Il complète Sxx:Eyy dans les rangées TV :
     *  le poster reste celui de la série, donc le contexte doit rester
     *  visible sans ouvrir sa fiche. */
    val resumeEpisodeTitle: String? = null,
    /** Still TMDb de l'épisode repris — distinct du poster vertical de la
     * série, réservé à « Continuer à regarder ». */
    val resumeEpisodeStillPath: String? = null,
    /** Contexte d'épisode éditorial. Contrairement aux champs `resume*`, il
     * n'implique jamais une reprise ni une barre de progression. Il sert aux
     * rangées « Épisodes récemment ajoutés ». */
    val episodeSeasonNumber: Int? = null,
    val episodeNumber: Int? = null,
    val episodeTitle: String? = null,
    /** Carte « saison » d'une rangée d'ajouts récents : plusieurs épisodes
     *  d'une même série arrivés ensemble sont regroupés en UNE carte, jamais
     *  côte à côte. `unwatchedCount` = épisodes de cette saison pas encore
     *  vus (pastille en haut à droite), null quand tout est vu. */
    val seasonLabel: String? = null,
    val unwatchedCount: Int? = null,
    /** Saison (ou épisode) entièrement vu : coche à la place du compteur. */
    val fullyWatched: Boolean = false,
    /** Vrai si ce film figure dans `watchStatus.movies` (vu manuellement ou
     *  via Plex). V1 : jamais calculé pour les séries — voir le plan de
     *  finalisation watch-state, phase 12-13. */
    val watched: Boolean = false,
)

/** Rangée d'accueil multi-type. Accueil est le seul endroit où films et séries
 * sont volontairement entrelacés ; Films/Séries gardent leurs hubs séparés. */
private data class HomeEditorialRow(val key: String, val heading: String, val cards: List<TvTitleCard>)

/** Applique la pastille "vu" aux cartes film d'une liste, à partir des ids
 *  tmdb présents dans `watchStatus.movies`. V1 : jamais les séries — voir le
 *  plan de finalisation watch-state, phase 12-13. `internal` (pas `private`) :
 *  réutilisé par Discover/PersonScreen/TitleDetailScreen/Catalog/RowDetail. */
internal fun List<TvTitleCard>.withWatchedMovies(watchedMovieIds: Set<Int>): List<TvTitleCard> {
    if (watchedMovieIds.isEmpty()) return this
    return map { if (it.isMovie && it.tmdbId in watchedMovieIds) it.copy(watched = true) else it }
}

/** Ajouts récents de séries, une carte PAR série : un seul épisode arrivé →
 *  carte épisode ; plusieurs → carte de la saison la plus récente avec le
 *  nombre d'épisodes non vus. Le décompte porte sur les épisodes récents
 *  renvoyés par le serveur (les plus récents, en nombre limité). */
private fun groupRecentEpisodes(
    episodes: List<com.movviz.tv.data.RecentEpisodeDto>,
    watched: Set<Triple<Int, Int, Int>>,
    availableBySeason: Map<Int, Map<String, Int>>,
): List<TvTitleCard> =
    episodes.groupBy { it.tmdbId }.values.map { group ->
        val latest = group.maxBy { it.addedAt }
        val card = if (group.size == 1) {
            TvTitleCard(
                id = "recent-episode-${latest.tmdbId}-${latest.seasonNumber}-${latest.episodeNumber}",
                title = latest.seriesTitle, posterPath = latest.posterPath, backdropPath = latest.backdropPath,
                tmdbId = latest.tmdbId, isMovie = false, rating = latest.rating,
                episodeSeasonNumber = latest.seasonNumber, episodeNumber = latest.episodeNumber,
                episodeTitle = latest.episodeTitle,
                fullyWatched = Triple(latest.tmdbId, latest.seasonNumber, latest.episodeNumber) in watched,
            )
        } else {
            val season = latest.seasonNumber
            // Toute la saison si le serveur donne le total disponible ; sinon
            // repli sur les seuls épisodes récents connus.
            val seasonTotal = availableBySeason[latest.tmdbId]?.get(season.toString())
            val unwatched = if (seasonTotal != null) {
                val seen = watched.count { it.first == latest.tmdbId && it.second == season }
                (seasonTotal - seen).coerceAtLeast(0)
            } else {
                group.count { it.seasonNumber == season && Triple(it.tmdbId, it.seasonNumber, it.episodeNumber) !in watched }
            }
            TvTitleCard(
                id = "recent-season-${latest.tmdbId}-$season",
                title = latest.seriesTitle, posterPath = latest.posterPath, backdropPath = latest.backdropPath,
                tmdbId = latest.tmdbId, isMovie = false, rating = latest.rating,
                seasonLabel = if (season == 0) "Spéciaux" else "Saison $season",
                unwatchedCount = unwatched.takeIf { it > 0 },
                fullyWatched = unwatched == 0,
            )
        }
        latest.addedAt to card
    }.sortedByDescending { it.first }.map { it.second }

@OptIn(ExperimentalComposeUiApi::class, ExperimentalFoundationApi::class)
@Composable
fun HomeScreen(
    viewModel: AppViewModel,
    onOpenTitle: (type: String, tmdbId: Int) -> Unit,
    onOpenEpisode: (tmdbId: Int, season: Int, episode: Int) -> Unit = { _, _, _ -> },
    onSeeAllRow: (mediaType: String, key: String, label: String) -> Unit = { _, _, _ -> },
    entryFocusRequester: FocusRequester? = null,
    // Destination GAUCHE vers la NavRail. Le déplacement vertical reste
    // entièrement géré par les listes TV natives.
    navRailFocusRequester: FocusRequester? = null,
    onScrollChanged: (Boolean) -> Unit = {},
    // Retour d'une fiche : la liste rend la rangée d'où l'on venait, dont le
    // propre focusRestorer rend la carte (voir MainActivity.enterContent).
    restoreFocusRequester: FocusRequester? = null,
) {
    val streamedMovies by viewModel.movies.collectAsState()
    val streamedSeries by viewModel.series.collectAsState()
    val streamedRecentEpisodes by viewModel.recentEpisodes.collectAsState()
    val streamedContinueWatching by viewModel.continueWatching.collectAsState()
    val rewatchResults by viewModel.rewatch.collectAsState()
    val queue by viewModel.queue.collectAsState()
    val streamedMovieRows by viewModel.movieRows.collectAsState()
    val streamedSeriesRows by viewModel.seriesRows.collectAsState()
    val streamedMovieRecommendations by viewModel.movieLibraryRecommendations.collectAsState()
    val streamedSeriesRecommendations by viewModel.seriesLibraryRecommendations.collectAsState()
    val streamedDashboardHero by viewModel.dashboardHero.collectAsState()
    val streamedDashboardLayout by viewModel.dashboardLayout.collectAsState()
    val heroLogos by viewModel.heroLogos.collectAsState()
    val homeUiState by viewModel.homeUiState.collectAsState()
    // Tuiles "Plateformes" de l'accueil — même liste curated que Discover
    // (GET /api/metadata/logos?kind=watchProvider), chargée via
    // loadDiscoverLogos() ci-dessous. Vide tant que le serveur n'a pas
    // répondu : la rangée est alors simplement absente, jamais un trou vide.
    val watchProviderTiles by viewModel.watchProviderTiles.collectAsState()
    // Pastille "vu" (phase 12-13 watch-state) — films uniquement, voir
    // TvTitleCard.watched. `watchStatus` est chargé au bootstrap (voir
    // AppViewModel.bootstrapHome) donc déjà prêt avant le premier rendu.
    val homeWatchStatus by viewModel.watchStatus.collectAsState()
    val watchedMovieIds = remember(homeWatchStatus) { homeWatchStatus?.movies?.toSet().orEmpty() }
    // Un snapshot P0/P1 est publié en une seule transition. Cela évite les
    // recompositions et déplacements de focus produits par dix StateFlow
    // successifs. Sans snapshot (compatibilité serveur ancien), les flows
    // historiques continuent de fournir le Home.
    val homeSnapshot = homeUiState.snapshot
    val movies = homeSnapshot?.movies ?: streamedMovies
    val series = homeSnapshot?.series ?: streamedSeries
    val recentEpisodes = homeSnapshot?.recentEpisodes ?: streamedRecentEpisodes
    val continueWatching = homeSnapshot?.continueWatching ?: streamedContinueWatching
    val movieRows = homeSnapshot?.movieRows ?: streamedMovieRows
    val seriesRows = homeSnapshot?.seriesRows ?: streamedSeriesRows
    val movieRecommendations = homeSnapshot?.movieRecommendations ?: streamedMovieRecommendations
    val seriesRecommendations = homeSnapshot?.seriesRecommendations ?: streamedSeriesRecommendations
    val dashboardHero = homeSnapshot?.dashboardHero ?: streamedDashboardHero
    val dashboardLayout = homeSnapshot?.dashboardLayout ?: streamedDashboardLayout
    // Une TV modeste ne doit jamais décoder le hero et une carte à la fois.
    // Cette clé est levée uniquement lorsqu'une carte a effectivement une
    // source prête : le hero s'éteint alors sans toucher au focus D-pad.
    var activeCardPreviewKey by remember { mutableStateOf<String?>(null) }
    val onCardPreviewStateChanged: (String, Boolean) -> Unit = { key, active ->
        if (active) activeCardPreviewKey = key
        else if (activeCardPreviewKey == key) activeCardPreviewKey = null
    }

    // Le composable ne pilote plus le réseau : bootstrapHome publie d'abord
    // le snapshot local puis orchestre P0/P1/P2 dans le ViewModel.
    // loadDiscoverLogos charge en parallèle les tuiles Plateformes ci-dessus
    // (indépendant du snapshot Home, même route que Discover).
    LaunchedEffect(Unit) { viewModel.bootstrapHome(); viewModel.loadDiscoverLogos() }
    var firstContentFrameReported by remember { mutableStateOf(false) }
    LaunchedEffect(homeUiState.hasUsableContent) {
        if (homeUiState.hasUsableContent && !firstContentFrameReported) {
            withFrameNanos { }
            firstContentFrameReported = true
            Log.d("TV-PERF", "HOME_FIRST_FRAME ${viewModel.homeBootstrapElapsedMs()} ms")
            viewModel.onHomeFirstFrameDrawn()
        }
    }

    val minYear = dashboardLayout.hero.minYear
    fun yearAllowed(year: Int?): Boolean = minYear == null || (year ?: 0) >= minYear
    fun searchCard(item: com.movviz.tv.data.SearchResultDto, prefix: String) = TvTitleCard(
        id = "$prefix-${item.type}-${item.tmdbId}",
        title = item.title,
        posterPath = item.posterPath,
        backdropPath = item.backdropPath,
        tmdbId = item.tmdbId,
        isMovie = item.type == "movie",
        year = item.year,
        rating = item.rating,
    )

    val continueCards = remember(continueWatching, movies, series, watchedMovieIds) {
        // Une même reprise peut être remontée deux fois pendant la fusion
        // locale/Plex. Une ligne TV ne doit jamais l'afficher deux fois — et
        // TvLazyRow exige des clés uniques. L'ordre de l'API est conservé,
        // donc la première (la plus récente) reste la référence visuelle.
        continueWatching.map { resume ->
            // Plex/on-deck fournit le poster et la position, mais pas le
            // backdrop. On complète avec l'entrée Movviz correspondante :
            // une reprise obtient ainsi le même visuel sans logo imprimé que
            // les autres rangées, quelle que soit sa plateforme d'origine.
            val libraryBackdrop = if (resume.type == "movie") {
                movies.firstOrNull { it.tmdbId == resume.tmdbId }?.let { it.customBackdropPath ?: it.backdropPath }
            } else {
                series.firstOrNull { it.tmdbId == resume.tmdbId }?.let { it.customBackdropPath ?: it.backdropPath }
            }
            val remaining = resume.durationMs?.let { dur ->
                val rem = ((dur - resume.offsetMs).coerceAtLeast(0L) / 60_000L).toInt()
                if (rem in 1..1000) rem else null
            }
            TvTitleCard(
                id = "cw-${resume.type}-${resume.tmdbId}-${resume.seasonNumber}-${resume.episodeNumber}",
                title = resume.title ?: "—",
                posterPath = resume.posterPath,
                backdropPath = libraryBackdrop,
                tmdbId = resume.tmdbId,
                isMovie = resume.type == "movie",
                rating = resume.rating,
                progressPercent = resume.progressPercent,
                remainingMinutes = remaining,
                isResumeCard = true,
                resumeSeasonNumber = resume.seasonNumber,
                resumeEpisodeNumber = resume.episodeNumber,
                resumeEpisodeTitle = resume.episodeTitle,
                resumeEpisodeStillPath = resume.episodeStillPath,
                episodeSeasonNumber = resume.seasonNumber,
                episodeNumber = resume.episodeNumber,
                episodeTitle = resume.episodeTitle,
            )
        }.distinctBy { it.id }.withWatchedMovies(watchedMovieIds)
    }
    val watchedEpisodeTriples = remember(homeWatchStatus) {
        homeWatchStatus?.episodes.orEmpty().map { Triple(it.tmdbId, it.season, it.episode) }.toSet()
    }
    val groupedRecentCards = remember(recentEpisodes, watchedEpisodeTriples, series) {
        groupRecentEpisodes(recentEpisodes, watchedEpisodeTriples, series.associate { it.tmdbId to it.availableBySeason })
    }
    val recentEpisodeCards = remember(groupedRecentCards) { groupedRecentCards.take(20) }
    // Les vignettes de reprise sont déjà visibles au premier frame : charger
    // leurs logos en parallèle (et non seulement au focus) évite le texte
    // de repli sur chaque carte alors qu'un logo officiel existe. Le
    // ViewModel déduplique les requêtes et conserve le cache partagé.
    // Films ET séries : un film repris (« 300 », « 100 Millions ! ») a
    // autant droit à son logo qu'une série — seul le repli affiche encore
    // le nom écrit, jamais les deux à la fois.
    LaunchedEffect(continueCards) {
        continueCards
            .map { if (it.isMovie) "movie" to it.tmdbId else "series" to it.tmdbId }
            .distinct()
            .forEach { (type, tmdbId) -> viewModel.requestHeroLogo(type, tmdbId) }
    }

    // Même source et même fusion que DashboardRows desktop.
    val recommendationCards = remember(movieRecommendations, seriesRecommendations, minYear, watchedMovieIds) {
        movieRecommendations.filter { yearAllowed(it.year) }.map { searchCard(it, "rec") }
            .zipInterleave(seriesRecommendations.filter { yearAllowed(it.year) }.map { searchCard(it, "rec") })
            .distinctBy { "${it.isMovie}-${it.tmdbId}" }
            .take(20)
            .withWatchedMovies(watchedMovieIds)
    }
    // « À revoir sans modération » : déjà vus, encore lisibles (serveur : rewatch.ts).
    val rewatchCards = remember(rewatchResults, watchedMovieIds) {
        rewatchResults.map { searchCard(it, "rw") }
            .distinctBy { "${it.isMovie}-${it.tmdbId}" }
            .take(20)
            .withWatchedMovies(watchedMovieIds)
    }
    val trendingCards = remember(movieRows, seriesRows, minYear, watchedMovieIds) {
        val movie = movieRows.firstOrNull { it.key == "trendingPopular" || it.key == "trending" }
            ?.results.orEmpty().filter { yearAllowed(it.year) }.map { searchCard(it, "trend") }
        val tv = seriesRows.firstOrNull { it.key == "trendingPopular" || it.key == "trending" }
            ?.results.orEmpty().filter { yearAllowed(it.year) }.map { searchCard(it, "trend") }
        movie.zipInterleave(tv).distinctBy { "${it.isMovie}-${it.tmdbId}" }.take(10).withWatchedMovies(watchedMovieIds)
    }
    // L'accueil ne s'arrête pas aux quelques blocs du dashboard : comme un
    // vrai écran de streaming, il prolonge le héros et la reprise avec les
    // étagères éditoriales de tous les services, dans un flux films + séries.
    // Les hubs Films/Séries affichent les mêmes données sans les mélanger.
    val editorialHomeRows = remember(movieRows, seriesRows, minYear, watchedMovieIds) {
        val keys = (movieRows.map { it.key } + seriesRows.map { it.key }).distinct()
        keys.mapNotNull { key ->
            // Les blocs déjà exprimés au début de l'accueil restent uniques.
            if (key in setOf("trending", "trendingPopular", "kids")) return@mapNotNull null
            val movie = movieRows.firstOrNull { it.key == key }?.results.orEmpty()
                .filter { yearAllowed(it.year) }.map { searchCard(it, "home-$key") }
            val tv = seriesRows.firstOrNull { it.key == key }?.results.orEmpty()
                .filter { yearAllowed(it.year) }.map { searchCard(it, "home-$key") }
            val cards = movie.zipInterleave(tv)
                .distinctBy { "${it.isMovie}-${it.tmdbId}" }
                .take(20)
                .withWatchedMovies(watchedMovieIds)
            cards.takeIf { it.isNotEmpty() }?.let { HomeEditorialRow(key, homeEditorialLabel(key, movieRows, seriesRows), it) }
        }
    }

    // Films et séries construits séparément (20 chacun) : deux rangées
    // « Récemment ajouté dans Films / Séries TV » comme sur Plex. Découper
    // après coup un top 20 mélangé laisserait une rangée quasi vide.
    val availableSplit = remember(movies, series, minYear, watchedMovieIds) {
        val movie = movies.filter { it.status == "available" && yearAllowed(it.year) }.map {
            it.addedAt to TvTitleCard(
                id = "available-movie-${it.tmdbId}", title = it.title, posterPath = it.posterPath,
                backdropPath = it.customBackdropPath ?: it.backdropPath, tmdbId = it.tmdbId, isMovie = true,
                year = it.year, rating = it.rating, genres = it.genres, status = it.status,
                qualityLabel = resolutionLabel(it.file?.resolution), hasHdr = !it.file?.hdr.isNullOrBlank(),
            )
        }
        val shows = series.filter { it.hasAvailableEpisode && yearAllowed(it.year) }.map {
            it.addedAt to TvTitleCard(
                id = "available-series-${it.tmdbId}", title = it.title, posterPath = it.posterPath,
                backdropPath = it.customBackdropPath ?: it.backdropPath, tmdbId = it.tmdbId, isMovie = false,
                year = it.year, rating = it.rating, genres = it.genres,
            )
        }
        val recent = { list: List<Pair<Long, TvTitleCard>> ->
            list.sortedByDescending { it.first }.map { it.second }.take(20).withWatchedMovies(watchedMovieIds)
        }
        recent(movie) to recent(shows)
    }
    val availableMovieCards = availableSplit.first
    // Séries : arrivées récentes regroupées par série (voir
    // groupRecentEpisodes), puis les séries disponibles sans arrivée récente
    // connue pour compléter la rangée.
    val availableSeriesCards = remember(groupedRecentCards, availableSplit) {
        val grouped = groupedRecentCards.filter { card -> availableSplit.second.any { it.tmdbId == card.tmdbId } }
        val groupedIds = grouped.map { it.tmdbId }.toSet()
        (grouped + availableSplit.second.filter { it.tmdbId !in groupedIds }).take(20)
    }
    // Liste mélangée, gardée pour le hero de secours.
    val availableNowCards = remember(availableSplit) {
        (availableSplit.first + availableSplit.second)
    }
    val shortSessionCards = remember(movies, minYear, watchedMovieIds) {
        movies.filter { it.status == "available" && it.runtime != null && it.runtime in 10..40 && yearAllowed(it.year) }
            .sortedByDescending { it.addedAt }
            .take(20)
            .map {
                TvTitleCard(
                    id = "short-${it.tmdbId}", title = it.title, posterPath = it.posterPath,
                    backdropPath = it.customBackdropPath ?: it.backdropPath, tmdbId = it.tmdbId, isMovie = true,
                    year = it.year, rating = it.rating, genres = it.genres, runtime = it.runtime,
                    qualityLabel = resolutionLabel(it.file?.resolution), hasHdr = !it.file?.hdr.isNullOrBlank(),
                )
            }.withWatchedMovies(watchedMovieIds)
    }
    val comingSoonCards = remember(movies, minYear, watchedMovieIds) {
        movies.filter { it.status == "upcoming" && yearAllowed(it.year) }
            .sortedBy { it.vfReleaseDate ?: it.releaseDate ?: "9999-99-99" }
            .take(20)
            .map {
                TvTitleCard(
                    id = "soon-${it.tmdbId}", title = it.title, posterPath = it.posterPath,
                    backdropPath = it.customBackdropPath ?: it.backdropPath, tmdbId = it.tmdbId, isMovie = true,
                    year = it.year, rating = it.rating, genres = it.genres, status = it.status,
                )
            }.withWatchedMovies(watchedMovieIds)
    }

    val heroFallback = remember(availableNowCards, recommendationCards) {
        (recommendationCards + availableNowCards)
            .filter { it.backdropPath != null }
            .distinctBy { "${it.isMovie}-${it.tmdbId}" }
            .sortedByDescending { it.rating }
    }
    val heroItems = remember(dashboardHero, heroFallback, dashboardLayout.hero.enabled, minYear) {
        if (!dashboardLayout.hero.enabled) emptyList() else {
            val exact = dashboardHero.map { slide ->
                val detail = slide.detail
                TvTitleCard(
                    id = "hero-${detail.type}-${detail.tmdbId}", title = detail.title,
                    posterPath = detail.posterPath, backdropPath = detail.backdropPath, tmdbId = detail.tmdbId,
                    isMovie = detail.type == "movie", year = detail.year, rating = detail.rating,
                    genres = detail.genres, status = slide.libraryStatus, overview = detail.overview,
                    runtime = detail.runtime, trailerKeys = detail.ambientVideoKeys,
                )
            }.filter { it.backdropPath != null && yearAllowed(it.year) }
            (exact + heroFallback.filter { it.tmdbId !in exact.map { h -> h.tmdbId } }).take(HERO_COUNT)
        }
    }

    var heroIndex by remember { mutableStateOf(0) }
    LaunchedEffect(heroItems) {
        if (heroIndex !in heroItems.indices) heroIndex = 0
        val movieIds = heroItems.filter { it.isMovie }.map { it.tmdbId }
        val seriesIds = heroItems.filter { !it.isMovie }.map { it.tmdbId }
        if (movieIds.isNotEmpty()) viewModel.loadHeroLogos("movie", movieIds)
        if (seriesIds.isNotEmpty()) viewModel.loadHeroLogos("series", seriesIds)
    }
    LaunchedEffect(heroItems, dashboardLayout.hero.slideshowSpeedSec) {
        if (heroItems.size < 2) return@LaunchedEffect
        val interval = dashboardLayout.hero.slideshowSpeedSec.coerceIn(5, 60) * 1_000L
        while (true) {
            delay(interval)
            if (heroItems.size < 2) return@LaunchedEffect
            heroIndex = (heroIndex + 1) % heroItems.size
        }
    }
    val activeHero = heroItems.getOrNull(heroIndex.coerceIn(0, (heroItems.size - 1).coerceAtLeast(0)))

    val visibleSections = remember(
        dashboardLayout.sections, continueCards, recentEpisodeCards, recommendationCards, shortSessionCards,
        trendingCards, availableNowCards, comingSoonCards,
    ) {
        val configured = dashboardLayout.sections.filter { it.visible }.mapNotNull { section ->
            val hasContent = when (section.id) {
                "continueWatching" -> continueCards.isNotEmpty()
                "becauseYouLike" -> recommendationCards.isNotEmpty()
                "rewatch" -> rewatchCards.isNotEmpty()
                "shortSessions" -> shortSessionCards.isNotEmpty()
                "discover" -> trendingCards.isNotEmpty()
                "availableNow" -> availableNowCards.isNotEmpty()
                "comingSoon" -> comingSoonCards.isNotEmpty()
                else -> false
            }
            section.id.takeIf { hasContent }
        }
        // La reprise est une promesse fonctionnelle, pas une option de mise
        // en page : si le compte a un média à reprendre, cette rangée reste
        // systématiquement la première, même si une ancienne disposition de
        // dashboard l'avait masquée ou déplacée.
        buildList {
            if (continueCards.isNotEmpty()) add("continueWatching")
            if (recentEpisodeCards.isNotEmpty()) add("recentEpisodes")
            addAll(configured.filter { it != "continueWatching" })
        }
    }
    val firstVisibleSection = visibleSections.firstOrNull()
    // NX suit le langage Netflix : le hero n'est pas un écran d'attente,
    // il installe l'univers visuel de l'accueil. Les rangées — notamment
    // Reprendre — restent immédiatement sous lui et ne sont jamais masquées.
    val showHero = heroItems.isNotEmpty()
    val contentFocus = entryFocusRequester ?: remember { FocusRequester() }
    // Quand le hero est présent, son CTA reste la cible d'entrée depuis la
    // sidebar, mais DOWN doit viser une vraie carte déjà connue plutôt que
    // dépendre de la recherche spatiale entre deux items d'une TvLazyColumn.
    // Sur certaines TV, la première rangée n'est pas encore une candidate
    // spatiale tant qu'elle n'a pas commencé à entrer dans le viewport : le
    // hero devient alors une île de focus jusqu'au premier scroll.
    val firstRowFocus = remember { FocusRequester() }
    val topAnchor = remember { FocusRequester() }
    val listState = rememberTvLazyListState().withTvPrefetchDisabled()
    val hasScrolled by remember {
        derivedStateOf {
            listState.firstVisibleItemIndex > 0 || listState.firstVisibleItemScrollOffset > 12
        }
    }
    LaunchedEffect(hasScrolled) { onScrollChanged(hasScrolled) }

    Box(
        modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)
            .focusProperties {
                exit = { focusDirection ->
                    if (focusDirection == androidx.compose.ui.focus.FocusDirection.Left) navRailFocusRequester ?: androidx.compose.ui.focus.FocusRequester.Default else androidx.compose.ui.focus.FocusRequester.Default
                }
            }
            .focusGroup(),
    ) {
        TvLazyColumn(
            modifier = Modifier.fillMaxSize()
                .let { if (restoreFocusRequester != null) it.focusRequester(restoreFocusRequester) else it }
                .focusRestorer()
                .focusGroup(),
            state = listState,
            // Le rail possède désormais sa propre colonne hors de cet écran.
            // Le hero peut donc occuper toute la largeur de la zone contenu,
            // sans marge à gauche ni recouvrement sous la navigation. Les
            // rangées gardent leurs propres marges internes (LazyRow/heading).
            contentPadding = PaddingValues(bottom = 54.dp),
        ) {
            item(contentType = "topAnchor") {
                // Tant qu'aucune donnée n'est arrivée (ni hero ni la moindre
                // rangée), contentFocus (cible de NxTopNav pour BAS) n'est
                // rattachée à AUCUN nœud composé : requestFocus() échoue
                // silencieusement et BAS depuis Accueil semble figé sur la
                // barre — signalé en direct, reproductible surtout sur
                // connexion lente au serveur. Cette ancre est TOUJOURS
                // composée dès la première frame (contrairement au hero/aux
                // rangées) : elle reprend temporairement contentFocus le
                // temps du chargement, puis la repasse au vrai premier
                // élément dès qu'il existe (recomposition normale).
                val anchorOwnsContentFocus = !showHero && firstVisibleSection == null
                // Ancre invisible uniquement focusable quand elle porte
                // réellement contentFocus (écran vide en chargement). Sinon
                // elle créait un nœud fantôme [168,0][1920,2] qui captait UP
                // depuis le hero/1ère rangée et affichait un focus invisible
                // (piège #2 du rapport D-pad 1.25.6).
                Box(
                    modifier = Modifier.fillMaxWidth().height(1.dp)
                        .let {
                            if (anchorOwnsContentFocus) it.focusRequester(contentFocus)
                                .focusRequester(topAnchor).focusable()
                            else it.focusRequester(topAnchor)
                        },
                )
            }
            if (showHero) {
                item(contentType = "hero") {
                    HeroCarousel(
                        items = heroItems,
                        currentIndex = heroIndex,
                        logoPath = activeHero?.let { heroLogos["${if (it.isMovie) "movie" else "series"}-${it.tmdbId}"] },
                        onSelectIndex = { heroIndex = it },
                        ctaFocusRequester = contentFocus,
                        downFocusRequester = if (firstVisibleSection != null) firstRowFocus else null,
                        trailerAutoplay = dashboardLayout.hero.trailerAutoplay && activeCardPreviewKey == null,
                        onOpen = { card -> onOpenTitle(if (card.isMovie) "movie" else "series", card.tmdbId) },
                        navRailFocusRequester = navRailFocusRequester,
                    )
                }
            }

            visibleSections.forEach { sectionId ->
                when (sectionId) {
                    "continueWatching" -> item(contentType = "row") {
                        // Variant paysage maquette (pas TitleRow) : cartes
                        // 270x150 fixes, still d'épisode, progression
                        // incrustée — aucun trailer ambiant ici, la rangée
                        // reste une liste de reprise statique et sobre.
                        ContinueWatchingRow(
                            items = continueCards,
                            onClick = { card ->
                                val season = card.resumeSeasonNumber
                                val episode = card.resumeEpisodeNumber
                                if (!card.isMovie && season != null && episode != null) onOpenEpisode(card.tmdbId, season, episode)
                                else onOpenTitle(if (card.isMovie) "movie" else "series", card.tmdbId)
                            },
                            firstItemFocusRequester = if (firstVisibleSection == sectionId) { if (showHero) firstRowFocus else contentFocus } else null,
                            navRailFocusRequester = navRailFocusRequester,
                            titleLogoPaths = heroLogos,
                        )
                    }
                    "recentEpisodes" -> item(contentType = "row") {
                        TitleRow(
                            heading = "Épisodes récemment ajoutés", items = recentEpisodeCards,
                            onClick = { onOpenTitle("series", it.tmdbId) },
                            firstItemFocusRequester = if (firstVisibleSection == sectionId) { if (showHero) firstRowFocus else contentFocus } else null,
                            titleLogoPaths = heroLogos,
                            onFocusedCard = { requestHeroLogoAndPrefetch(viewModel, "series", it.tmdbId) },
                            previewLoader = { viewModel.loadTvPreview("series", it.tmdbId) },
                            onPreviewStateChanged = onCardPreviewStateChanged,
                            navRailFocusRequester = navRailFocusRequester,
                        )
                    }
                    "becauseYouLike" -> item(contentType = "row") {
                        TitleRow(
                            heading = "Sélection pour vous", items = recommendationCards,
                            onClick = { onOpenTitle(if (it.isMovie) "movie" else "series", it.tmdbId) },
                            firstItemFocusRequester = if (firstVisibleSection == sectionId) { if (showHero) firstRowFocus else contentFocus } else null,
                            titleLogoPaths = heroLogos,
                            onFocusedCard = { requestHeroLogoAndPrefetch(viewModel, if (it.isMovie) "movie" else "series", it.tmdbId) },
                            previewLoader = { viewModel.loadTvPreview(if (it.isMovie) "movie" else "series", it.tmdbId) },
                            onPreviewStateChanged = onCardPreviewStateChanged,
                            showTypeBadge = true,
                            navRailFocusRequester = navRailFocusRequester,
                        )
                    }
                    "rewatch" -> item(contentType = "row") {
                        TitleRow(
                            heading = "À revoir sans modération", items = rewatchCards,
                            onClick = { onOpenTitle(if (it.isMovie) "movie" else "series", it.tmdbId) },
                            firstItemFocusRequester = if (firstVisibleSection == sectionId) { if (showHero) firstRowFocus else contentFocus } else null,
                            titleLogoPaths = heroLogos,
                            onFocusedCard = { requestHeroLogoAndPrefetch(viewModel, if (it.isMovie) "movie" else "series", it.tmdbId) },
                            previewLoader = { viewModel.loadTvPreview(if (it.isMovie) "movie" else "series", it.tmdbId) },
                            onPreviewStateChanged = onCardPreviewStateChanged,
                            showTypeBadge = true,
                            navRailFocusRequester = navRailFocusRequester,
                        )
                    }
                    "shortSessions" -> item(contentType = "row") {
                        TitleRow(
                            heading = "Moins de 40 minutes", items = shortSessionCards,
                            onClick = { onOpenTitle("movie", it.tmdbId) },
                            firstItemFocusRequester = if (firstVisibleSection == sectionId) { if (showHero) firstRowFocus else contentFocus } else null,
                            titleLogoPaths = heroLogos,
                            onFocusedCard = { requestHeroLogoAndPrefetch(viewModel, if (it.isMovie) "movie" else "series", it.tmdbId) },
                            previewLoader = { viewModel.loadTvPreview(if (it.isMovie) "movie" else "series", it.tmdbId) },
                            onPreviewStateChanged = onCardPreviewStateChanged,
                        )
                    }
                    "discover" -> item(contentType = "row") {
                        TitleRow(
                            heading = "Tendances Movviz", items = trendingCards,
                            onClick = { onOpenTitle(if (it.isMovie) "movie" else "series", it.tmdbId) },
                            firstItemFocusRequester = if (firstVisibleSection == sectionId) { if (showHero) firstRowFocus else contentFocus } else null,
                            titleLogoPaths = heroLogos,
                            onFocusedCard = { requestHeroLogoAndPrefetch(viewModel, if (it.isMovie) "movie" else "series", it.tmdbId) },
                            previewLoader = { viewModel.loadTvPreview(if (it.isMovie) "movie" else "series", it.tmdbId) },
                            onPreviewStateChanged = onCardPreviewStateChanged,
                            showTypeBadge = true,
                        )
                    }
                    "availableNow" -> {
                        if (availableMovieCards.isNotEmpty()) item(contentType = "row") {
                            TitleRow(
                                heading = "Récemment ajouté dans Films", items = availableMovieCards,
                                onClick = { onOpenTitle("movie", it.tmdbId) },
                                firstItemFocusRequester = if (firstVisibleSection == sectionId) { if (showHero) firstRowFocus else contentFocus } else null,
                                titleLogoPaths = heroLogos,
                                onFocusedCard = { requestHeroLogoAndPrefetch(viewModel, "movie", it.tmdbId) },
                                previewLoader = { viewModel.loadTvPreview("movie", it.tmdbId) },
                                onPreviewStateChanged = onCardPreviewStateChanged,
                            )
                        }
                        if (availableSeriesCards.isNotEmpty()) item(contentType = "row") {
                            TitleRow(
                                heading = "Récemment ajouté dans Séries TV", items = availableSeriesCards,
                                onClick = { onOpenTitle("series", it.tmdbId) },
                                firstItemFocusRequester = if (firstVisibleSection == sectionId && availableMovieCards.isEmpty()) { if (showHero) firstRowFocus else contentFocus } else null,
                                titleLogoPaths = heroLogos,
                                onFocusedCard = { requestHeroLogoAndPrefetch(viewModel, "series", it.tmdbId) },
                                previewLoader = { viewModel.loadTvPreview("series", it.tmdbId) },
                                onPreviewStateChanged = onCardPreviewStateChanged,
                            )
                        }
                    }
                    "comingSoon" -> item(contentType = "row") {
                        TitleRow(
                            heading = "Prochainement", items = comingSoonCards,
                            onClick = { onOpenTitle("movie", it.tmdbId) },
                            firstItemFocusRequester = if (firstVisibleSection == sectionId) { if (showHero) firstRowFocus else contentFocus } else null,
                            titleLogoPaths = heroLogos,
                            onFocusedCard = { requestHeroLogoAndPrefetch(viewModel, if (it.isMovie) "movie" else "series", it.tmdbId) },
                            previewLoader = { viewModel.loadTvPreview("movie", it.tmdbId) },
                            onPreviewStateChanged = onCardPreviewStateChanged,
                        )
                    }
                }
                if (sectionId == "becauseYouLike" && queue.isNotEmpty()) {
                    item(contentType = "queue") { DownloadQueueRow(items = queue, onOpenTitle = onOpenTitle) }
                }
            }

            // Rangée "Plateformes" de la maquette Accueil — mêmes tuiles et
            // même ordre que Discover (watchProviderTiles), affichée après
            // les sections éditoriales et avant les rangées éditoriales
            // mélangées. Pas de focus initial ici : contentFocus reste sur
            // le hero / la première section, la rangée est atteignable en
            // descendant. Absente tant que les logos ne sont pas chargés.
            if (watchProviderTiles.isNotEmpty()) {
                item(contentType = "platforms") {
                    PlatformRow(
                        tiles = watchProviderTiles,
                        onSelect = { tile ->
                            onSeeAllRow("movie", "providerSuggested:${tile.id}", "Suggestion ${tile.name} pour vous")
                        },
                        navRailFocusRequester = navRailFocusRequester,
                    )
                }
            }

            editorialHomeRows.forEach { row ->
                item(key = "editorial-${row.key}", contentType = "editorial-row") {
                    TitleRow(
                        heading = row.heading,
                        items = row.cards,
                        onClick = { onOpenTitle(if (it.isMovie) "movie" else "series", it.tmdbId) },
                        titleLogoPaths = heroLogos,
                        onFocusedCard = { requestHeroLogoAndPrefetch(viewModel, if (it.isMovie) "movie" else "series", it.tmdbId) },
                        previewLoader = { viewModel.loadTvPreview(if (it.isMovie) "movie" else "series", it.tmdbId) },
                        onPreviewStateChanged = onCardPreviewStateChanged,
                        showTypeBadge = true,
                    )
                }
            }

            if (visibleSections.isEmpty() && heroItems.isEmpty()) {
                item(contentType = "loading") {
                    Box(
                        modifier = Modifier.fillMaxWidth().height(315.dp).padding(top = 36.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            MovvizBootScreen(
                                progress = homeUiState.bootProgress,
                                message = homeUiState.bootMessage,
                            )
                        }
                    }
                }
            }
        }
        // Signal passif : le cache reste pleinement navigable, sans modal ni
        // focus supplémentaire qui perturberait la télécommande.
        if (homeUiState.offline && (showHero || visibleSections.isNotEmpty())) {
            Box(
                modifier = Modifier.align(Alignment.TopEnd).padding(top = 99.dp, end = 36.dp)
                    .clip(RoundedCornerShape(14.dp)).background(Color.Black.copy(alpha = .72f)),
            ) {
                Text(
                    "Hors ligne · contenu enregistré",
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp),
                    style = MaterialTheme.typography.labelMedium,
                    color = Color.White.copy(alpha = .85f),
                )
            }
        }
    }
}

/** État de démarrage visible seulement sans Home local utilisable. La barre
 * représente des étapes réelles du bootstrap, jamais un minuteur décoratif. */
@Composable
private fun MovvizBootScreen(progress: Int, message: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        AnimatedLogo(size = 62.dp)
        Spacer(Modifier.height(15.dp))
        Text("Préparation de ton cinéma", style = MaterialTheme.typography.titleMedium, color = Color.White)
        Spacer(Modifier.height(14.dp))
        Box(
            modifier = Modifier.width(240.dp).height(6.dp)
                .clip(RoundedCornerShape(6.dp)).background(Color.White.copy(alpha = .16f)),
        ) {
            Box(
                modifier = Modifier.fillMaxHeight().fillMaxWidth((progress.coerceIn(0, 100) / 100f))
                    .background(MovvizBrand),
            )
        }
        Spacer(Modifier.height(9.dp))
        Text("$progress %  ·  $message", style = MaterialTheme.typography.labelLarge, color = Color.White.copy(alpha = .7f))
    }
}

/** Même mapping que la pastille résolution desktop (MediaBadges.tsx) : 2160→4K,
 *  4320→8K, 1080/720 en toutes lettres, sinon la valeur brute — jamais le
 *  "2160p" cru. null si aucun fichier réel (pas encore en bibliothèque). */
private fun resolutionLabel(resolution: String?): String? = when {
    resolution == null -> null
    resolution.startsWith("2160") -> "4K"
    resolution.startsWith("4320") -> "8K"
    resolution.startsWith("1080") -> "1080p"
    resolution.startsWith("720") -> "720p"
    else -> resolution
}

/** Fusion en alternance ([a1,b1,a2,b2,...]) — pas d'appariement strict par
 *  index, continue de piocher dans la liste la plus longue une fois l'autre
 *  épuisée. */
private fun <T> List<T>.zipInterleave(other: List<T>): List<T> {
    val out = ArrayList<T>(size + other.size)
    val max = maxOf(size, other.size)
    for (i in 0 until max) {
        if (i < size) out.add(this[i])
        if (i < other.size) out.add(other[i])
    }
    return out
}

/** Vedette plein écran en rotation automatique — backdrop en Ken Burns lent,
 *  titre/méta, CTA "Voir la fiche" et indicateurs de progression décoratifs,
 *  façon bannière "Featured" Netflix plutôt que le simple aplat statique
 *  d'avant. */
@Composable
internal fun HeroCarousel(
    items: List<TvTitleCard>,
    currentIndex: Int,
    logoPath: String?,
    onSelectIndex: (Int) -> Unit,
    ctaFocusRequester: FocusRequester,
    // Première carte réelle sous le hero. Utilisée uniquement par le moteur
    // de focus Compose : aucune touche n'est interceptée/consommée ici.
    downFocusRequester: FocusRequester? = null,
    trailerAutoplay: Boolean = true,
    onOpen: (TvTitleCard) -> Unit,
    navRailFocusRequester: FocusRequester? = null,
) {
    val current = items[currentIndex.coerceIn(0, items.size - 1)]
    var showTitleFallback by remember(current.id, logoPath) { mutableStateOf(false) }
    LaunchedEffect(current.id, logoPath) {
        showTitleFallback = false
        if (logoPath == null) {
            delay(3_000)
            showTitleFallback = true
        }
    }

    // --- Ultra hero : texte révélé en fondu + glissement à chaque rotation.
    // Seule la zone texte est animée ; le CTA reste stable en dessous pour
    // ne jamais perturber le focus D-pad (le focus initial atterrit dessus).
    var textRevealed by remember(current.id) { mutableStateOf(false) }
    LaunchedEffect(current.id) { textRevealed = true }
    val textAlpha by animateFloatAsState(
        targetValue = if (textRevealed) 1f else 0f,
        animationSpec = tween(450),
        label = "hero_text_alpha",
    )
    val textSlide by animateFloatAsState(
        targetValue = if (textRevealed) 0f else 20f,
        animationSpec = tween(450),
        label = "hero_text_slide",
    )

    // --- Ultra hero : scrim adaptatif à la luminosité réelle du backdrop.
    // Moyenne de luminance pondérée (Rec. 709), calculée une fois par image
    // via un échantillon 64x36, mise en cache : backdrop sombre → scrim
    // léger (l'image porte sa propre lisibilité), backdrop clair → scrim
    // renforcé. Un dégradé statique rendait les titres clairs illisibles et
    // surassombrissait les plans de nuit.
    var scrimAlpha by remember(current.id) { mutableStateOf(0.55f) }
    val animatedScrimAlpha by animateFloatAsState(scrimAlpha, tween(600), label = "hero_scrim_alpha")
    val context = LocalContext.current
    val imageLoader = context.imageLoader
    LaunchedEffect(current.id) {
        val url = "$TMDB_BACKDROP_BASE${current.backdropPath}"
        val cached = luminanceCache[url]
        if (cached != null) {
            scrimAlpha = scrimStrengthFor(cached)
            return@LaunchedEffect
        }
        val loader = imageLoader ?: return@LaunchedEffect
        loader.enqueue(
            ImageRequest.Builder(context)
                .data(url)
                .size(Size(64, 36))
                // Clé de cache à part : sans elle, cette vignette 64×36 était
                // resservie aux cartes qui affichent la même image (le cache
                // accepte une version plus petite que demandée) — cartes floues
                // jusqu'à ce qu'un focus recharge la vraie taille.
                .memoryCacheKey("luminance:$url")
                .target(
                    onStart = {},
                    onError = {},
                    onSuccess = { drawable ->
                        val bmp = (drawable as? BitmapDrawable)?.bitmap
                        if (bmp != null) {
                            val lum = averageLuminance(bmp)
                            luminanceCache[url] = lum
                            scrimAlpha = scrimStrengthFor(lum)
                        }
                    },
                )
                .build(),
        )
    }

    // --- Ultra hero : précharge prédictive des 2 prochains backdrops dès la
    // rotation — au lieu de charger pendant le crossfade (pop-in/flou).
    // Même cache mémoire Coil que l'affichage ; après le premier passage le
    // disque sert de source, aucun réseau en plus.
    LaunchedEffect(currentIndex, items) {
        if (items.size < 2) return@LaunchedEffect
        val loader = imageLoader ?: return@LaunchedEffect
        for (offset in 1..1) {
            val next = items[(currentIndex + offset) % items.size]
            loader.enqueue(
                ImageRequest.Builder(context)
                    .data("$TMDB_BACKDROP_BASE${next.backdropPath}")
                    .size(Size(1280, 720))
                    .build(),
            )
        }
    }

    // Hero maquette Accueil : 46% du viewport plafonné à 500px — la
    // première rangée reste visible sous la vedette, la page est
    // immédiatement parcourable à la télécommande au lieu d'exiger un
    // défilement devant une affiche géante.
    val screenHeightDp = androidx.compose.ui.platform.LocalConfiguration.current.screenHeightDp
    val heroHeight = (screenHeightDp * 0.46f).coerceIn(340f, 500f)
    Box(modifier = Modifier.fillMaxWidth().height(heroHeight.dp).clipToBounds()) {
        androidx.compose.animation.AnimatedContent(
            targetState = current,
            transitionSpec = { fadeIn(tween(700)) togetherWith fadeOut(tween(700)) },
            label = "hero_backdrop",
            modifier = Modifier.fillMaxSize(),
        ) { item ->
            val infinite = rememberInfiniteTransition(label = "hero_ken_burns")
            val zoom by infinite.animateFloat(
                initialValue = 1f,
                targetValue = 1.12f,
                animationSpec = infiniteRepeatable(tween(HERO_ROTATE_MS.toInt() * 3, easing = LinearEasing), RepeatMode.Reverse),
                label = "zoom",
            )
            Image(
                painter = rememberAsyncImagePainter(model = "$TMDB_BACKDROP_BASE${item.backdropPath}", contentScale = ContentScale.Crop),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                alignment = Alignment.TopCenter,
                // graphicsLayer (pas .scale(zoom)) : .scale() avec une valeur
                // lue depuis un State (ici animateFloat en continu tant que
                // le hero est affiché) force une recomposition du composable
                // Image à CHAQUE frame Choreographer, en boucle infinie —
                // mesuré : 61,71% de frames janky à l'accueil totalement
                // inactif (dumpsys gfxinfo, 700 frames/26s). graphicsLayer{}
                // lit le State uniquement en phase de dessin (juste un
                // re-layer, pas de recomposition), le zoom Ken Burns reste
                // fluide sans repasser par toute la composition à 60fps.
                modifier = Modifier.fillMaxSize().graphicsLayer { scaleX = zoom; scaleY = zoom },
            )
        }

        if (trailerAutoplay) {
            AmbientTrailer(
                trailerKeys = current.trailerKeys,
                title = current.title,
                modifier = Modifier.fillMaxSize(),
            )
        }

        // Netflix-style gradient scrim — strong bottom, subtle left.
        Box(
            modifier = Modifier.fillMaxSize().background(
                Brush.verticalGradient(
                    colors = listOf(
                        Color.Transparent,
                        Color.Black.copy(alpha = 0.2f),
                        Color.Black.copy(alpha = 0.55f),
                        Color.Black.copy(alpha = 0.85f),
                    ),
                    startY = 0f,
                ),
            ),
        )
        Box(
            modifier = Modifier.fillMaxSize().background(
                Brush.horizontalGradient(
                    colors = listOf(Color.Black.copy(alpha = 0.45f), Color.Transparent),
                    endX = 800f,
                ),
            ),
        )

        Column(
            modifier = Modifier
                .align(Alignment.BottomStart)
                // bottom = dépassement du hero sous le pli (40dp) + marge
                // visuelle : le CTA reste ENTièrement au-dessus de l'écran.
                .padding(start = 52.dp, end = 40.dp, bottom = 46.dp)
                .widthIn(max = 620.dp),
        ) {
            // Zone texte animée en fondu + glissement à chaque rotation.
            // Le CTA (plus bas) reste HORS de cette colonne : le focus D-pad
            // initial atterrit dessus, l'animation ne doit pas le perturber.
            Column(
                modifier = Modifier
                    .alpha(textAlpha)
                    .offset(y = textSlide.dp),
            ) {
            Text(
                text = "À LA UNE  ·  " + if (current.isMovie) "FILM" else "SÉRIE",
                style = TextStyle(fontSize = 8.sp, fontWeight = FontWeight.Bold, color = Color.White.copy(alpha = 0.7f), letterSpacing = 2.4.sp),
            )
            Spacer(modifier = Modifier.height(6.dp))
            if (logoPath != null) {
                // BOÎTE FIXE + Fit : les assets TMDb ont des tailles/ratios
                // très variables (intrinsèque ÷ densité 2 = minuscule sans
                // dimension fixe ; FillHeight = géant et tronqué pour les
                // wordmarks larges type "Annabelle"). La boîte contraint tout :
                // large → limité par 520dp de large, carré → limité par
                // 104dp de haut, ratio toujours préservé.
                Image(
                    painter = rememberAsyncImagePainter(model = "https://image.tmdb.org/t/p/w500$logoPath"),
                    contentDescription = current.title,
                    contentScale = ContentScale.Fit,
                    alignment = Alignment.CenterStart,
                    modifier = Modifier
                        .width(330.dp)
                        .height(62.dp),
                )
            } else if (showTitleFallback) {
                Text(
                    text = current.title,
                    style = TextStyle(fontSize = 30.sp, fontWeight = FontWeight.Black, color = MovvizInk, lineHeight = 33.sp),
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            } else {
                // Réserve la place du logo pendant son chargement : aucun
                // titre texte ne clignote avant de laisser sa place au logo.
                Spacer(modifier = Modifier.height(68.dp).widthIn(max = 345.dp))
            }
            // Badge statut bibliothèque (même pastille que la fiche titre)
            current.status?.let { st ->
                if (st != "available") {
                    Spacer(modifier = Modifier.height(6.dp))
                    val tone = statusTone(st)
                    Box(
                        modifier = Modifier
                            .background(tone.color.copy(alpha = 0.12f), RoundedCornerShape(50))
                            .border(1.dp, tone.color.copy(alpha = 0.25f), RoundedCornerShape(50))
                            .padding(horizontal = 9.dp, vertical = 3.dp),
                    ) {
                        Text(text = tone.label, style = TextStyle(fontSize = 9.sp, fontWeight = FontWeight.Bold, color = tone.color))
                    }
                }
            }
            Spacer(modifier = Modifier.height(6.dp))
            // Même ligne méta que la fiche : ★ · année · durée · genres inline
            // (les chips séparées prenaient une rangée entière pour rien).
            Row(verticalAlignment = Alignment.CenterVertically) {
                // Pastilles techniques (maquette) : uniquement quand la carte
                // porte un vrai fichier local — jamais fabriquées pour un
                // titre de découverte sans qualityLabel.
                if (current.qualityLabel != null) {
                    QualityPill(current.qualityLabel, MovvizCyan)
                    Spacer(modifier = Modifier.width(5.dp))
                }
                if (current.hasHdr) {
                    QualityPill("HDR", MovvizAmber)
                    Spacer(modifier = Modifier.width(5.dp))
                }
                // Pastille "VF" maquette — uniquement sur donnée réelle
                // (hasVf), jamais affichée par défaut, voir TvTitleCard.
                if (current.hasVf) {
                    QualityPill("VF", MovvizOk)
                    Spacer(modifier = Modifier.width(5.dp))
                }
                if (current.rating > 0) {
                    // Icône vectorielle : le glyphe ★ n'existe pas dans Inter
                    // (rendu fallback système cassé sur Google TV).
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                        Icon(
                            imageVector = MovvizIconStar,
                            contentDescription = null,
                            tint = Color(0xFFF5C542),
                            modifier = Modifier.size(10.dp),
                        )
                        Text(text = "%.1f".format(current.rating), style = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFFF5C542)))
                    }
                    HeroMetaDot()
                }
                current.year?.let {
                    Text(text = "$it", style = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.Medium, color = MovvizInkSoft))
                    HeroMetaDot()
                }
                current.runtime?.let {
                    Text(text = "$it min", style = TextStyle(fontSize = 11.sp, color = MovvizInkSoft))
                    if (current.genres.isNotEmpty()) HeroMetaDot()
                }
                Text(
                    text = current.genres.take(3).joinToString("  •  "),
                    style = TextStyle(fontSize = 11.sp, color = MovvizInkSoft),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            if (current.overview.isNotBlank()) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = current.overview,
                    style = TextStyle(fontSize = 10.sp, color = MovvizInkSoft, lineHeight = 14.sp),
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.widthIn(max = 435.dp),
                )
            }
            }
            Spacer(modifier = Modifier.height(12.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                var focused by remember(current.id) { mutableStateOf(false) }
                // CTA principal : "Lire" par défaut, "Reprendre" seulement avec une progression réelle.
                // Même construction que l'item actif de NavRail (Surface
                // transparente + fond dégradé interne) : le dégradé reste
                // intact au focus, seuls le lift et la bordure blanche
                // bougent. L'action reste onOpen — c'est la fiche titre qui
                // gère la reprise précise (S/E en cours). ctaFocusRequester
                // est et reste le SEUL focus initial de l'écran : aucune
                // demande de focus n'est jamais refaite ici (ni au rotate,
                // piloté par HomeScreen, ni au changement de slide).
                Surface(
                    onClick = { onOpen(current) },
                    modifier = Modifier
                        .focusRequester(ctaFocusRequester)
                        .focusProperties {
                            left = navRailFocusRequester ?: FocusRequester.Default
                            down = downFocusRequester ?: FocusRequester.Default
                        }
                        .tvFocusLift(focused, shape = RoundedCornerShape(5.dp), maxElevation = 12.dp)
                        .onFocusChanged { focused = it.isFocused }
                        .tvPointerClick { onOpen(current) },
                    shape = ClickableSurfaceDefaults.shape(shape = RoundedCornerShape(5.dp)),
                    scale = ClickableSurfaceDefaults.scale(focusedScale = 1f), colors = ClickableSurfaceDefaults.colors(
                        containerColor = Color.Transparent,
                        focusedContainerColor = Color.Transparent,
                        contentColor = Color.White,
                        focusedContentColor = Color.White,
                    ),
                    border = ClickableSurfaceDefaults.border(
                        focusedBorder = Border(border = androidx.compose.foundation.BorderStroke(2.dp, Color.White), shape = RoundedCornerShape(5.dp)),
                    ),
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .background(
                                Brush.linearGradient(listOf(MovvizBrand3, MovvizBrand, MovvizBrand2)),
                                RoundedCornerShape(5.dp),
                            )
                            .padding(horizontal = 15.dp, vertical = 8.dp),
                    ) {
                        Icon(
                            imageVector = MovvizIconPlay,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(11.dp),
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(text = if (current.isResumeCard && (current.progressPercent ?: 0) > 0) "Reprendre" else "Lire", style = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color.White))
                    }
                }

                Spacer(modifier = Modifier.width(9.dp))

                // "Plus d'infos" button — dark glass, secondary action.
                var infoFocused by remember(current.id) { mutableStateOf(false) }
                Surface(
                    onClick = { onOpen(current) },
                    modifier = Modifier
                        .focusProperties {
                            down = downFocusRequester ?: FocusRequester.Default
                        }
                        .tvFocusLift(infoFocused, shape = RoundedCornerShape(5.dp), maxElevation = 12.dp)
                        .onFocusChanged { infoFocused = it.isFocused }
                        .tvPointerClick { onOpen(current) },
                    shape = ClickableSurfaceDefaults.shape(shape = RoundedCornerShape(5.dp)),
                    scale = ClickableSurfaceDefaults.scale(focusedScale = 1f), colors = ClickableSurfaceDefaults.colors(
                        containerColor = Color.White.copy(alpha = 0.15f),
                        focusedContainerColor = Color.White.copy(alpha = 0.26f),
                        contentColor = Color.White,
                        focusedContentColor = Color.White,
                    ),
                    border = ClickableSurfaceDefaults.border(
                        focusedBorder = Border(border = androidx.compose.foundation.BorderStroke(2.dp, Color.White.copy(alpha = 0.6f)), shape = RoundedCornerShape(5.dp)),
                    ),
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(horizontal = 15.dp, vertical = 8.dp),
                    ) {
                        // Le glyphe ℹ rendait en carré (pas dans Inter) —
                        // simple pastille "i" dessinée en vectoriel local.
                        Box(
                            modifier = Modifier
                                .size(12.dp)
                                .border(1.4.dp, Color.White, RoundedCornerShape(50)),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(text = "i", style = TextStyle(fontSize = 8.sp, fontWeight = FontWeight.Bold, fontStyle = FontStyle.Italic, color = Color.White))
                        }
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(text = "Plus d'infos", style = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = Color.White))
                    }
                }
            }
        }
        // Dots maquette bas-droite — décoratifs (Box sans onClick), jamais
        // focusables, pilotés par currentIndex comme la rotation elle-même.
        if (items.size > 1) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(5.dp),
                modifier = Modifier.align(Alignment.BottomEnd).padding(end = 30.dp, bottom = 12.dp),
            ) {
                items.indices.forEach { index ->
                    Box(
                        modifier = Modifier
                            .size(5.dp)
                            .clip(RoundedCornerShape(50))
                            .background(if (index == currentIndex) Color(0xFFC04BFF) else Color(0xFF3D4A7A)),
                    )
                }
            }
        }
    }
}

/** Séparateur "·" de la ligne méta hero — même style que la fiche titre. */
@Composable
private fun HeroMetaDot() {
    Text(
        text = "  ·  ",
        style = TextStyle(fontSize = 11.sp, color = MovvizInkDim),
    )
}

/** Délai avant le lancement du trailer ambiant (ms) — Netflix laisse
 * ~2-3s le temps au backdrop Ken Burns de s'installer avant de lancer
 * la bande-annonce. */
// NX previews react after the focus animation has settled, but before a user
// feels the UI has paused.  The WebView pool below guarantees one player.
private const val AMBIENT_TRAILER_DELAY_MS = 850L

/** Variante TV de TrailerHeader : le backdrop reste la couche de base, et
 * l'iframe YouTube muette ne devient visible qu'après l'événement PLAYING.
 * Une vidéo bloquée ou un réseau absent laisse donc exactement l'image de
 * fond, sans chrome YouTube ni perte du focus D-pad.
 *
 * Comportement Netflix : le trailer ne se lance qu'après un délai de
 * ~2.2s pour laisser l'utilisateur admirer le backdrop Ken Burns ;
 * une fois lancé, le fade-in est doux (400ms) au lieu du snap binaire
 * d'avant. */
@Composable
private fun AmbientTrailer(trailerKeys: List<String>, title: String, modifier: Modifier = Modifier) {
    val key = trailerKeys.firstOrNull { it.matches(Regex("[A-Za-z0-9_-]{6,}")) } ?: return
    val appContext = LocalContext.current.applicationContext
    val activityManager = remember(appContext) { appContext.getSystemService(Context.ACTIVITY_SERVICE) as android.app.ActivityManager }
    var canUseWebView by remember { mutableStateOf(true) }
    LaunchedEffect(Unit) {
        val memInfo = android.app.ActivityManager.MemoryInfo()
        activityManager.getMemoryInfo(memInfo)
        // Les boîtiers Android TV 1080p (et l'émulateur officiel) disposent
        // souvent de 1 à 1,5 Go. Le précédent seuil « total >= 2 Go »
        // désactivait donc silencieusement TOUT aperçu YouTube, même avec
        // largement assez de mémoire libre. On ne bloque désormais que sous
        // 160 Mo réellement disponibles, où WebView risquerait un OOM.
        canUseWebView = memInfo.availMem >= 160L * 1024 * 1024
    }
    if (!canUseWebView) return
    var ready by remember(key) { mutableStateOf(false) }
    var playing by remember(key) { mutableStateOf(false) }
    val mainHandler = remember { Handler(Looper.getMainLooper()) }
    val bridge = remember(key) {
        AmbientTrailerBridge(
            onPlaying = { mainHandler.post { playing = true } },
            onError = { mainHandler.post { ready = false } },
        )
    }

    // Délai avant le lancement du trailer — Netflix laisse ~2-3s le temps
    // au backdrop Ken Burns de s'installer avant de lancer la bande-annonce.
    // `ready` passe à true après le délai, ce qui déclenche le chargement
    // de la WebView. Si la clé change pendant le délai, l'ancien LaunchedEffect
    // est annulé proprement.
    LaunchedEffect(key) {
        playing = false
        ready = false
        delay(AMBIENT_TRAILER_DELAY_MS)
        ready = true
    }

    // Fade-in doux quand le trailer commence à jouer — au lieu du snap
    // binaire alpha=0→1, on anime sur 400ms pour une transition Netflix-like.
    val trailerAlpha by animateFloatAsState(
        targetValue = if (playing) 1f else 0f,
        animationSpec = tween(
            durationMillis = if (playing) 400 else 250,
        ),
        label = "trailer_alpha",
    )

    // LA MÊME WebView sert pendant toute la durée du hero : le factory ne
    // capture rien (donc stable — AndroidView garde la vue) et chaque
    // rotation recharge juste la vidéo via update. Avant ce correctif : une
    // WebView NEUVE à chaque rotation, jamais détruite — les moteurs
    // s'empilaient en mémoire (fuite visible sur Chromecast 4K) et chaque
    // rotation payait la création du moteur + le rechargement de l'iframe
    // API YouTube (jank au moment du changement).
    if (ready) {
        AndroidView(
            factory = { TrailerWebViewPool.obtain(appContext) },
            update = { view -> TrailerWebViewPool.prepare(view, key, title, bridge) },
            onRelease = { view -> TrailerWebViewPool.release(view) },
            modifier = modifier.graphicsLayer { alpha = trailerAlpha },
        )
    }
    DisposableEffect(Unit) { onDispose { TrailerWebViewPool.clearAll() } }
}

private fun homeEditorialLabel(
    key: String,
    movieRows: List<com.movviz.tv.data.MetadataRowDto>,
    seriesRows: List<com.movviz.tv.data.MetadataRowDto>,
): String {
    val meta = movieRows.firstOrNull { it.key == key }?.meta
        ?: seriesRows.firstOrNull { it.key == key }?.meta
    if (key.startsWith("providerSuggested:") && meta?.providerName != null) return "Suggestion ${meta.providerName} pour vous"
    if (key.startsWith("providerNew:") && meta?.providerName != null) return "Nouveautés ${meta.providerName} pour vous"
    if (key.startsWith("becauseYouWatched:") && meta?.anchorTitle != null) {
        return if (meta.verb == "liked") "Puisque ${meta.anchorTitle} vous a plu" else "Dans la lignée de ${meta.anchorTitle}"
    }
    return when (key) {
        "recommendedTop" -> "Trouve ton prochain coup de cœur"
        "nowPlayingBoxOffice" -> "En salles"
        "upcomingVod", "upcoming" -> "Prochainement"
        "acclaimed" -> "Salué par la critique"
        "anime" -> "Anime et animation japonaise"
        "teen" -> "Romance ado"
        "shortFormat" -> "Format court, grand impact"
        "genreAction" -> "Passez à l'action"
        "genreComedy" -> "Besoin de rire ?"
        "genreHorror" -> "Frissons garantis"
        "genreSciFi" -> "Science-fiction et fantastique"
        "newSeriesRenewed" -> "Nouvelles séries et renouvellements"
        else -> key.replace(Regex("([a-z])([A-Z])"), "$1 $2").replaceFirstChar { it.uppercase() }
    }
}

/**
 * Même ordre que TrailerHeader/TrailerModalPlayer desktop : les clés YouTube
 * TMDb (identity-checked, context "carousel") passent TOUJOURS avant les
 * sources directes. Les sources directes sont une recherche par titre
 * Apple/IMDb/Prime — approximative, elle confond remakes et homonymes :
 * les jouer en premier affichait sur TV une autre œuvre que celle du
 * desktop (qui ne joue que YouTube), d'où des bandes-annonces "jamais les
 * bonnes" sur TV. Le direct ne sert qu'en dernier recours, quand aucune
 * clé YouTube n'existe. Le composable ne vit que sur la carte actuellement
 * focalisée, donc il ne peut ni détourner le focus D-pad ni accumuler des
 * lecteurs en arrière-plan.
 */
@Composable
fun AmbientPreview(
    directSources: List<TrailerSourceDto>,
    trailerKeys: List<String>,
    title: String,
    modifier: Modifier = Modifier,
) {
    var directFailed by remember(directSources) { mutableStateOf(false) }
    val youtubeKeys = remember(trailerKeys) {
        trailerKeys.filter { it.matches(Regex("[A-Za-z0-9_-]{6,}")) }
    }
    val direct = directSources.firstOrNull { it.url.startsWith("https://") || it.url.startsWith("http://") }
    if (youtubeKeys.isNotEmpty()) {
        AmbientTrailer(trailerKeys = youtubeKeys, title = title, modifier = modifier)
    } else if (direct != null && !directFailed) {
        DirectAmbientTrailer(source = direct, modifier = modifier, onError = { directFailed = true })
    }
}

@Composable
private fun DirectAmbientTrailer(
    source: TrailerSourceDto,
    modifier: Modifier = Modifier,
    onError: () -> Unit,
) {
    val context = LocalContext.current.applicationContext
    val mainHandler = remember { Handler(Looper.getMainLooper()) }
    val player = remember(source.url) {
        ExoPlayer.Builder(context).build().apply {
            volume = 0f
            repeatMode = Player.REPEAT_MODE_ONE
        }
    }
    var firstFrame by remember(source.url) { mutableStateOf(false) }
    val previewAlpha by animateFloatAsState(
        targetValue = if (firstFrame) 1f else 0f,
        animationSpec = tween(if (firstFrame) 400 else 180),
        label = "direct_preview_alpha",
    )
    DisposableEffect(player) {
        val listener = object : Player.Listener {
            override fun onRenderedFirstFrame() {
                mainHandler.post { firstFrame = true }
            }
            override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                mainHandler.post(onError)
            }
        }
        player.addListener(listener)
        onDispose {
            player.removeListener(listener)
            player.release()
        }
    }
    LaunchedEffect(player, source.url) {
        delay(AMBIENT_TRAILER_DELAY_MS)
        player.setMediaItem(MediaItem.fromUri(source.url))
        player.prepare()
        player.playWhenReady = true
    }
    AndroidView(
        factory = { ctx ->
            PlayerView(ctx).apply {
                useController = false
                setPlayer(player)
                isFocusable = false
                isFocusableInTouchMode = false
                setShutterBackgroundColor(AndroidColor.TRANSPARENT)
                // RESIZE_MODE_ZOOM (crop-to-fill) pour matcher exactement le
                // ContentScale.Crop du backdrop statique derrière : le mode
                // par défaut (FIT/letterbox) recadrait différemment et créait
                // une bande visible entre l'image et la vidéo à la bascule.
                resizeMode = AspectRatioFrameLayout.RESIZE_MODE_ZOOM
            }
        },
        update = { it.player = player },
        modifier = modifier.graphicsLayer { alpha = previewAlpha },
    )
}

private class AmbientTrailerBridge(
    private val onPlaying: () -> Unit,
    private val onError: () -> Unit = {},
) {
    @JavascriptInterface fun playing() = onPlaying()
    @JavascriptInterface fun error() = onError()
}

/** Pool WebView : 1 idle max, applicationContext, pas de fuite Activity. */
@SuppressLint("SetJavaScriptEnabled")
private object TrailerWebViewPool {
    private val idle = ArrayDeque<WebView>()
    private const val MAX_IDLE = 1

    fun obtain(context: Context): WebView =
        idle.removeLastOrNull()?.also { it.tag = null } ?: WebView(context.applicationContext).apply {
            setBackgroundColor(AndroidColor.TRANSPARENT)
            isFocusable = false; isFocusableInTouchMode = false
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = false
            settings.mediaPlaybackRequiresUserGesture = false
            webChromeClient = WebChromeClient(); webViewClient = WebViewClient()
        }

    fun release(view: WebView) {
        view.stopLoading(); view.loadUrl("about:blank")
        view.removeJavascriptInterface("MovvizAmbient")
        view.clearHistory(); view.tag = null
        if (idle.size < MAX_IDLE) idle.addLast(view) else view.destroy()
    }
    fun clearAll() { while (idle.isNotEmpty()) idle.removeLast().destroy() }

    fun prepare(view: WebView, key: String, title: String, bridge: AmbientTrailerBridge) {
        if (view.tag == key) return
        view.tag = key
        view.removeJavascriptInterface("MovvizAmbient")
        view.addJavascriptInterface(bridge, "MovvizAmbient")
        view.loadDataWithBaseURL(
            "https://www.youtube.com",
            ambientTrailerHtml(key, title),
            "text/html",
            "utf-8",
            null,
        )
    }
}

// Même « cover trick » que le hero web (TrailerHeader.tsx) : sans lui,
// l'iframe YouTube gardait sa taille d'embed par défaut (letterboxée, ancrée
// en haut-gauche) au lieu de recadrer plein cadre comme le backdrop statique
// (ContentScale.Crop) derrière — décalage visible à la bascule image→vidéo.
private fun ambientTrailerHtml(key: String, title: String): String = """
    <!doctype html><html><body style="margin:0;background:transparent;overflow:hidden">
    <style>
      #player, #player iframe {
        position:absolute; top:50%; left:50%;
        width:100vw; height:56.25vw; min-width:177.78vh; min-height:100vh;
        transform:translate(-50%,-50%);
      }
    </style>
    <div id="player"></div><script src="https://www.youtube.com/iframe_api"></script>
    <script>
      var p; function onYouTubeIframeAPIReady(){
        p=new YT.Player('player',{
          videoId:'$key',
          playerVars:{
            autoplay:1,
            mute:1,
            controls:0,
            playsinline:1,
            rel:0,
            modestbranding:1,
            loop:1,
            playlist:'$key',
            disablekb:1,
            fs:0,
            iv_load_policy:3,
            cc_load_policy:0
          },
          events:{
            onReady:function(e){
              e.target.mute();
              e.target.playVideo();
            },
            onStateChange:function(e){
              if(e.data===YT.PlayerState.PLAYING){
                MovvizAmbient.playing();
              } else if(e.data===YT.PlayerState.ENDED){
                // Redémarrer le loop proprement si l'API looprate
                e.target.seekTo(0, true);
                e.target.playVideo();
              }
            },
            onError:function(e){
              // e.data: 2=paramètre, 3=HTML5, 5=vidéo non trouvée,
              // 100=privée/supprimée, 101/150=désactivée intégration
              MovvizAmbient.error();
            }
          }
        });
      }
    </script></body></html>
""".trimIndent()

/** Même signal de focus que le logo hero (déjà déclenché carte par carte,
 *  sans coût réseau notable) : en profiter pour lancer aussi la précharge
 *  de la fiche, qui s'auto-annule si le focus repart avant 750 ms — voir
 *  AppViewModel.scheduleDetailPrefetch. */
internal fun requestHeroLogoAndPrefetch(viewModel: AppViewModel, type: String, tmdbId: Int) {
    viewModel.requestHeroLogo(type, tmdbId)
    viewModel.scheduleDetailPrefetch(type, tmdbId)
}

@OptIn(ExperimentalFoundationApi::class, ExperimentalComposeUiApi::class)
@Composable
internal fun TitleRow(
    heading: String,
    items: List<TvTitleCard>,
    onClick: (TvTitleCard) -> Unit,
    firstItemFocusRequester: FocusRequester? = null,
    // Même route que le bouton Discover desktop. Elle est rendue comme une
    // dernière affiche discrète : le parcours D-pad continue à droite sans
    // ajouter de chrome dans l'en-tête.
    onSeeAll: (() -> Unit)? = null,
    titleLogoPaths: Map<String, String> = emptyMap(),
    onFocusedCard: (TvTitleCard) -> Unit = {},
    /** Même contrat que DashboardPosterCard desktop : on ne résout une
     * prévisualisation qu'après avoir réellement posé le focus sur la carte.
     * Cela évite les appels réseau pour chaque affiche visible et garantit
     * qu'une navigation rapide au D-pad reste instantanée. */
    previewLoader: suspend (TvTitleCard) -> TvPreviewDto? = { null },
    /** Informe l'écran parent qu'une source est réellement prête sur la
     * carte active. Il peut alors couper le hero : un seul décodeur vidéo
     * actif à la fois sur Android TV. */
    onPreviewStateChanged: (cardId: String, active: Boolean) -> Unit = { _, _ -> },
    showTypeBadge: Boolean = false,
    navRailFocusRequester: FocusRequester? = null,
) {
    // État de focus partagé par toutes les cartes de la rangée — il vit ici
    // (pas dans PosterCard) pour survivre à la destruction des items par la
    // LazyRow, et n'est lu QUE par les deux enfants dédiés (précharge des
    // images + call-out Netflix) : la rangée elle-même et ses cartes ne
    // recomposent JAMAIS pendant un scroll latéral, seul le bandeau bouge.
    val focusedCardState = remember { mutableStateOf<TvTitleCard?>(null) }
    val previewsByCardId = remember { mutableStateMapOf<String, TvPreviewDto>() }

    // Une carte ne doit pas faire démarrer un trailer lors d'un passage D-pad
    // rapide. On attend que le focus soit resté stable puis on récupère les
    // mêmes candidats que le dashboard desktop (sources directes + YouTube).
    // La carte conserve son image si l'API ou YouTube ne répond pas.
    LaunchedEffect(focusedCardState.value?.id) {
        val card = focusedCardState.value ?: return@LaunchedEffect
        previewsByCardId[card.id]?.let { cached ->
            onPreviewStateChanged(card.id, cached.directSources.isNotEmpty() || cached.ambientVideoKeys.isNotEmpty())
            return@LaunchedEffect
        }
        delay(AMBIENT_TRAILER_DELAY_MS)
        if (focusedCardState.value?.id != card.id) return@LaunchedEffect
        val preview = previewLoader(card)
        if (focusedCardState.value?.id != card.id) return@LaunchedEffect
        if (preview != null) {
            previewsByCardId[card.id] = preview
            onPreviewStateChanged(card.id, preview.directSources.isNotEmpty() || preview.ambientVideoKeys.isNotEmpty())
        } else {
            onPreviewStateChanged(card.id, false)
        }
    }
    Column(modifier = Modifier.padding(bottom = 24.dp)) {
        RowHeading(heading)
        TvLazyRow(
            state = rememberTvLazyListState().withTvPrefetchDisabled(),
            // Entrée par la RANGÉE, pas par sa carte n°0 : défilée ou
            // réordonnée, la rangée n’a plus forcément cette carte composée,
            // et BAS depuis le hero (ou l’entrée initiale) visait alors un
            // élément absent — le D-pad restait bloqué. focusRestorer rend
            // la dernière carte choisie, sinon la première visible.
            modifier = Modifier
                .let { if (firstItemFocusRequester != null) it.focusRequester(firstItemFocusRequester) else it }
                .focusRestorer(),
            contentPadding = PaddingValues(start = 39.dp, end = 39.dp),
            horizontalArrangement = Arrangement.spacedBy(9.dp),
        ) {
            tvItemsIndexed(items, key = { _, item -> item.id }, contentType = { index, _ -> if (index == 0) "featured" else "poster" }) { index, card ->
                val preview = previewsByCardId[card.id]
                val renderedCard = if (preview == null) card else card.copy(
                    // On garde les chemins de la rangée tant qu'ils sont
                    // disponibles : l'aperçu ne doit jamais créer un flash
                    // noir à cause d'une métadonnée partielle.
                    backdropPath = preview.backdropPath ?: card.backdropPath,
                    trailerKeys = preview.ambientVideoKeys,
                    directTrailerSources = preview.directSources,
                    overview = preview.overview.ifBlank { card.overview },
                    runtime = preview.runtime ?: card.runtime,
                    genres = if (preview.genres.isNotEmpty()) preview.genres else card.genres,
                )
                PosterCard(
                    card = renderedCard,
                    onClick = { onClick(card) },
                    navRailFocusRequester = if (index == 0) navRailFocusRequester else null,
                    onFocusedChange = { focused ->
                        focusedCardState.value = if (focused) card else null
                        if (focused) onFocusedCard(card)
                        else onPreviewStateChanged(card.id, false)
                    },
                    // NX reprend le mouvement de la nouvelle interface TV
                    // Netflix : une affiche reste compacte au repos puis la
                    // carte active devient le seul aperçu 16:9 de sa rangée.
                    // Les autres éléments conservent leur gabarit portrait.
                    width = 99.dp,
                    aspectRatio = 2f / 3f,
                    preferPosterArt = true,
                    // Le slot LazyRow ne bouge jamais. La mini-fiche est une
                    // surcouche de rangée (ci-dessous), jamais un reflow.
                    // La carte active conserve exactement la hauteur de
                    // l'affiche (132 × 3/2 = 198dp) : seul son ratio change.
                    // En 16:9, cela donne 352×198dp, un vrai passage au
                    // paysage plutôt qu'une carte qui rétrécit au focus.
                    showCaption = false,
                    showTechnicalBadges = false,
                    titleLogoPath = titleLogoPaths["${if (card.isMovie) "movie" else "series"}-${card.tmdbId}"],
                    showTypeBadge = showTypeBadge,
                )
            }
            if (onSeeAll != null) {
                item(contentType = "see-all") { SeeAllTile(onClick = onSeeAll) }
            }
        }
        // Les affiches suivantes sont peu coûteuses ; les backdrops 1280×720
        // ne le sont pas. Sur une Google TV modeste, précharger trois grands
        // bitmaps à chaque mouvement D-pad provoquait de la contention avec
        // le rendu. Seule la carte focalisée a besoin de son backdrop.
        val ctx = LocalContext.current
        val imageLoader = ctx.imageLoader
        LaunchedEffect(focusedCardState.value) {
            val focused = focusedCardState.value ?: return@LaunchedEffect
            val idx = items.indexOf(focused)
            if (idx < 0) return@LaunchedEffect
            val cardsToPreload = buildList {
                add(focused)
                for (offset in 1..2) items.getOrNull(idx + offset)?.let(::add)
            }
            for (candidate in cardsToPreload) {
                candidate.posterPath?.let { path ->
                    imageLoader.enqueue(
                        ImageRequest.Builder(ctx)
                            .data("$TMDB_IMAGE_BASE$path")
                            .size(Size(500, 750))
                            .build()
                    )
                }
            }
            focused.backdropPath?.let { path ->
                imageLoader.enqueue(
                    ImageRequest.Builder(ctx)
                        .data("$TMDB_BACKDROP_BASE$path")
                        .size(Size(1280, 720))
                        .build()
                )
            }
        }
    }
}

/** Titre de rangée — style titleLarge Netflix, marge basse cohérente,
 *  padding start identique au padding de la LazyRow pour un alignement
 *  parfait avec la première carte. */
@Composable
private fun RowHeading(text: String) {
        Text(
            text = text,
            style = MaterialTheme.typography.titleLarge,
            color = MaterialTheme.colorScheme.onBackground,
            modifier = Modifier.padding(start = 39.dp, bottom = 9.dp),
        )
}

/** Rangée "Plateformes" de l'accueil (maquette : 8 tuiles 16/9 Netflix,
 *  Disney+, Prime Video, HBO Max, Apple TV+, YouTube, Crunchyroll, OCS).
 *  Mêmes tuiles curated que Discover (LogoTileDto via
 *  GET /api/metadata/logos?kind=watchProvider) — ici en tuiles paysage
 *  165dp 16/9 fond sombre, pas en pastilles. TvLazyRow + focusRestorer :
 *  chaque rangée garde sa position au retour D-pad, aucun requestFocus
 *  manuel. Le clic ouvre le même "Voir tout" personnalisé que Discover
 *  (providerSuggested), pas l'ordre TMDb brut. */
@Composable
internal fun PlatformRow(
    tiles: List<com.movviz.tv.data.LogoTileDto>,
    onSelect: (com.movviz.tv.data.LogoTileDto) -> Unit,
    navRailFocusRequester: FocusRequester? = null,
) {
    Column(modifier = Modifier.padding(bottom = 24.dp)) {
        RowHeading("Plateformes")
        TvLazyRow(
            state = rememberTvLazyListState().withTvPrefetchDisabled(),
            modifier = Modifier.focusRestorer(),
            contentPadding = PaddingValues(start = 39.dp, end = 39.dp),
            horizontalArrangement = Arrangement.spacedBy(11.dp),
        ) {
            tvItemsIndexed(tiles, key = { _, tile -> "platform-${tile.id}" }) { index, tile ->
                PlatformTile(tile = tile, onClick = { onSelect(tile) }, navRailFocusRequester = if (index == 0) navRailFocusRequester else null)
            }
        }
    }
}

/** Tuile plateforme 16/9 — Surface tv-material3 (focus D-pad natif + OK),
 *  halo blanc au focus comme PosterCard/SeeAllTile, logo TMDb en Fit centré
 *  avec repli texte si absent ou en échec de chargement. */
@Composable
private fun PlatformTile(
    tile: com.movviz.tv.data.LogoTileDto,
    onClick: () -> Unit,
    navRailFocusRequester: FocusRequester? = null,
) {
    var focused by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(5.dp)
    Surface(
        onClick = onClick,
        modifier = Modifier
            .width(124.dp)
            .aspectRatio(16f / 9f)
            .tvCardFocusHalo(focused, shape = shape)
            .onFocusChanged { focused = it.isFocused }
            .tvPointerClick(onClick),
        shape = ClickableSurfaceDefaults.shape(shape = shape),
        scale = ClickableSurfaceDefaults.scale(focusedScale = 1f), colors = ClickableSurfaceDefaults.colors(
            containerColor = Color(0xFF010511).copy(alpha = 0.72f),
            focusedContainerColor = MovvizSurfaceStrong,
        ),
        border = ClickableSurfaceDefaults.border(
            focusedBorder = Border(
                border = androidx.compose.foundation.BorderStroke(2.dp, Color.White.copy(alpha = 0.85f)),
                shape = shape,
            ),
        ),
    ) {
        Box(
            modifier = Modifier.fillMaxSize().padding(horizontal = 8.dp, vertical = 6.dp),
            contentAlignment = Alignment.Center,
        ) {
            if (tile.logoPath != null) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(36.dp)
                        .background(Color.White.copy(alpha = 0.95f), RoundedCornerShape(6.dp))
                        .padding(horizontal = 8.dp, vertical = 5.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    coil.compose.SubcomposeAsyncImage(
                        model = "$TMDB_LOGO_BASE${tile.logoPath}",
                        contentDescription = tile.name,
                        contentScale = ContentScale.Fit,
                        modifier = Modifier.fillMaxSize(),
                        loading = { PlatformTileFallback(name = tile.name, focused = focused) },
                        error = { PlatformTileFallback(name = tile.name, focused = focused) },
                    )
                }
            } else {
                PlatformTileFallback(name = tile.name, focused = focused)
            }
        }
    }
}

/** Repli texte immédiat — logo TMDb absent, lent ou en échec. Même rôle
 *  que DiscoverLogoTileFallback côté Discover. */
@Composable
private fun PlatformTileFallback(name: String, focused: Boolean) {
    Text(
        text = name,
        style = TextStyle(
            fontSize = 10.sp,
            fontWeight = FontWeight.SemiBold,
            color = if (focused) MovvizInk else MovvizInkSoft,
        ),
        maxLines = 2,
        overflow = TextOverflow.Ellipsis,
    )
}

/** Rangée "Continuer à regarder" maquette : cartes paysage fixes 270x150
 *  (still d'épisode quand il existe, sinon backdrop, sinon poster recadré),
 *  titre + contexte d'épisode sous la carte, fine barre de progression
 *  incrustée en bas d'image. TitleRow/PosterCard restent intacts pour les
 *  rangées affiches — ce variant ne partage que RowHeading et les tokens.
 *  TvLazyRow + focusRestorer : le retour fiche restaure la même carte,
 *  aucun requestFocus manuel. Réutilise TvTitleCard.isResumeCard, aucun
 *  nouveau modèle de carte. */
@Composable
internal fun ContinueWatchingRow(
    items: List<TvTitleCard>,
    onClick: (TvTitleCard) -> Unit,
    firstItemFocusRequester: FocusRequester? = null,
    navRailFocusRequester: FocusRequester? = null,
    titleLogoPaths: Map<String, String> = emptyMap(),
) {
    Column(modifier = Modifier.padding(bottom = 24.dp)) {
        RowHeading("Continuer à regarder")
        TvLazyRow(
            state = rememberTvLazyListState().withTvPrefetchDisabled(),
            // Entrée par la rangée (voir TitleRow) : la carte n°0 d’une
            // reprise réordonnée n’est plus forcément composée.
            modifier = Modifier
                .let { if (firstItemFocusRequester != null) it.focusRequester(firstItemFocusRequester) else it }
                .focusRestorer(),
            contentPadding = PaddingValues(start = 39.dp, end = 39.dp),
            horizontalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            tvItemsIndexed(items, key = { _, card -> card.id }) { index, card ->
                ResumeCard(
                    card = card,
                    onClick = { onClick(card) },
                    navRailFocusRequester = if (index == 0) navRailFocusRequester else null,
                    titleLogoPath = titleLogoPaths["${if (card.isMovie) "movie" else "series"}-${card.tmdbId}"],
                )
            }
        }
    }
}

/** Carte de reprise 270x150 — glow #A06BFF au focus (maquette), taille fixe :
 *  les voisines ne bougent jamais. Seule la Surface est focusable ; titre,
 *  méta et progression sont décoratifs et hors chaîne D-pad. */
@Composable
private fun ResumeCard(
    card: TvTitleCard,
    onClick: () -> Unit,
    focusRequester: FocusRequester? = null,
    navRailFocusRequester: FocusRequester? = null,
    titleLogoPath: String? = null,
) {
    var focused by remember(card.id) { mutableStateOf(false) }
    val tileShape = RoundedCornerShape(8.dp)
    // Paysage : le still d'épisode d'abord (différent du poster vertical de
    // la série), puis le backdrop bibliothèque, puis le poster recadré.
    val imageUrl = card.resumeEpisodeStillPath?.let { "$TMDB_BACKDROP_BASE$it" }
        ?: card.backdropPath?.let { "$TMDB_BACKDROP_BASE$it" }
        ?: card.posterPath?.let { "$TMDB_IMAGE_BASE$it" }
    val meta = resumeCardMeta(card)
    Column(modifier = Modifier.width(203.dp)) {
        Surface(
            onClick = onClick,
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(16f / 9f)
                .let { if (focusRequester != null) it.focusRequester(focusRequester) else it }
                // Glow violet maquette via graphicsLayer (même mécanisme que
                // le zoom Ken Burns du hero) : seule la bordure + ce halo
                // bougent au focus, la carte ne change jamais de taille.
                .graphicsLayer {
                    shadowElevation = if (focused) 14.dp.toPx() else 0f
                    shape = tileShape
                    ambientShadowColor = MovvizBrandGlow.copy(alpha = 0.55f)
                    spotShadowColor = Color.Black
                    clip = false
                }
                .onFocusChanged { focused = it.isFocused }
                .tvPointerClick(onClick),
            shape = ClickableSurfaceDefaults.shape(shape = tileShape),
            scale = ClickableSurfaceDefaults.scale(focusedScale = 1f), colors = ClickableSurfaceDefaults.colors(containerColor = MovvizSurfaceStrong),
            border = ClickableSurfaceDefaults.border(
                focusedBorder = Border(
                    border = androidx.compose.foundation.BorderStroke(2.dp, MovvizBrandGlow),
                    shape = tileShape,
                ),
            ),
        ) {
            Box(modifier = Modifier.fillMaxSize()) {
                if (imageUrl != null) {
                    Image(
                        painter = rememberAsyncImagePainter(model = imageUrl, contentScale = ContentScale.Crop),
                        contentDescription = card.title,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
                    )
                } else {
                    Box(
                        modifier = Modifier.fillMaxSize().background(Color.Black),
                        contentAlignment = Alignment.Center,
                    ) {
                        StaticLogoWithGlow(size = 33.dp)
                    }
                }
                // Logo officiel du titre en bas à gauche, sur un voile : il
                // remplace le nom écrit sous la carte quand il existe.
                if (titleLogoPath != null) {
                    Box(
                        modifier = Modifier
                            .align(Alignment.BottomCenter)
                            .fillMaxWidth()
                            .height(70.dp)
                            .background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(alpha = 0.78f)))),
                    )
                    Image(
                        painter = rememberAsyncImagePainter(model = "$TMDB_LOGO_BASE$titleLogoPath"),
                        contentDescription = card.title,
                        contentScale = ContentScale.Fit,
                        alignment = Alignment.BottomStart,
                        modifier = Modifier
                            .align(Alignment.BottomStart)
                            .padding(start = 10.dp, bottom = 10.dp)
                            .heightIn(max = 34.dp)
                            .widthIn(max = 130.dp),
                    )
                }
                // Barre de progression fine incrustée — décorative, jamais
                // focusable. progressPercent vient du on-deck Plex/serveur.
                val progress = card.progressPercent
                if (progress != null && progress > 0) {
                    Box(
                        modifier = Modifier
                            .align(Alignment.BottomCenter)
                            .fillMaxWidth()
                            .height(2.dp)
                            .background(Color.White.copy(alpha = 0.25f)),
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxHeight()
                                .fillMaxWidth(progress.coerceIn(0, 100) / 100f)
                                .background(MovvizBrandGlow),
                        )
                    }
                }
            }
        }
        Spacer(modifier = Modifier.height(6.dp))
        if (titleLogoPath == null) Text(
            text = card.title,
            style = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = MovvizInk),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        if (meta.isNotBlank()) {
            Text(
                text = meta,
                style = TextStyle(fontSize = 10.sp, color = MovvizInkDim),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

/** Contexte sous la carte de reprise — S/E + titre d'épisode pour les
 *  séries, durée restante si le serveur la fournit (durationMs), sinon
 *  sans. Pour les films : juste le temps restant quand disponible. */
private fun resumeCardMeta(card: TvTitleCard): String {
    val remainingSuffix = card.remainingMinutes?.let { " · $it min restantes" } ?: ""
    if (!card.isMovie && card.episodeSeasonNumber != null && card.episodeNumber != null) {
        val base = "S${card.episodeSeasonNumber} E${card.episodeNumber}"
        val epTitle = card.episodeTitle?.takeIf { it.isNotBlank() }
        val core = if (epTitle != null) "$base · $epTitle" else base
        return core + remainingSuffix
    }
    return remainingSuffix.trimStart(' ', '·').let { if (it.isNotBlank()) it else "" }
}

/** Dernière affiche de la rangée : indication « voir plus » légère, au format
 * portrait des cartes secondaires. Elle ouvre RowDetailScreen, sans rompre
 * la continuité horizontale par une grosse tuile d'action. */
@Composable
private fun SeeAllTile(onClick: () -> Unit) {
    var focused by remember { mutableStateOf(false) }
    Column(modifier = Modifier.width(116.dp)) {
        Surface(
            onClick = onClick,
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(2f / 3f)
                .tvCardFocusHalo(focused, shape = MovvizCardShape)
                .onFocusChanged { focused = it.isFocused }
                .tvPointerClick(onClick),
            shape = androidx.tv.material3.ClickableSurfaceDefaults.shape(shape = MovvizCardShape),
            scale = androidx.tv.material3.ClickableSurfaceDefaults.scale(focusedScale = 1f),
            colors = androidx.tv.material3.ClickableSurfaceDefaults.colors(containerColor = MovvizInk.copy(alpha = 0.08f)),
            border = androidx.tv.material3.ClickableSurfaceDefaults.border(
                focusedBorder = Border(
                    border = androidx.compose.foundation.BorderStroke(2.4.dp, Color.White.copy(alpha = 0.85f)),
                    shape = MovvizCardShape,
                ),
            ),
        ) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(text = "+", style = TextStyle(fontSize = 23.sp, fontWeight = FontWeight.Light, color = MovvizInk))
                    Text(text = "Voir plus", style = TextStyle(fontSize = 10.sp, fontWeight = FontWeight.SemiBold, color = MovvizInkSoft))
                }
            }
        }
    }
}

/** Carte de contenu NX. Le focus agrandit une seule carte, révèle le
 * contexte et conserve toutes les voisines compactes. */
@Composable
internal fun PosterCard(
    card: TvTitleCard,
    onClick: () -> Unit,
    focusRequester: FocusRequester? = null,
    onFocusedChange: ((Boolean) -> Unit)? = null,
    width: androidx.compose.ui.unit.Dp = 173.dp,
    aspectRatio: Float = 16f / 9f,
    preferPosterArt: Boolean = false,
    showCaption: Boolean = true,
    showTechnicalBadges: Boolean = true,
    titleLogoPath: String? = null,
    /** Pilule type FILM/SÉRIE pour les rangées mélangées (Home). Désactivé
     * par défaut pour ne pas surcharger les rails mono-type (Films, Séries). */
    showTypeBadge: Boolean = false,
    /** Routage LEFT explicite depuis la 1ère carte vers l'onglet sélectionné
     * de la NavRail — évite que la recherche spatiale ne choisisse un onglet
     * au hasard selon Y (piège Prochainement → Profil). */
    navRailFocusRequester: FocusRequester? = null,
) {
    var focused by remember { mutableStateOf(false) }
    val posterUrl = card.posterPath?.let { "$TMDB_IMAGE_BASE$it" }
    val backdropUrl = card.backdropPath?.let { "$TMDB_BACKDROP_BASE$it" }
    // Une carte ne change JAMAIS de géométrie au focus. L'élargissement en
    // paysage poussait ses voisines, remontait la carte focalisée hors de
    // l'alignement de sa rangée et recadrait l'image assez pour rogner le
    // badge « S01 · E05 » incrusté dessus — trois défauts pour un effet qui
    // n'apportait rien : le contour de focus dit déjà où l'on est.
    val expanded = false
    val renderedWidth = width
    val renderedAspect = aspectRatio
    // Une affiche reste une affiche : jamais de backdrop paysage recadré
    // dans un cadre 2:3. Le backdrop est réservé au seul état paysage.
    val resumeEpisodeStillUrl = card.resumeEpisodeStillPath?.let { "$TMDB_BACKDROP_BASE$it" }
    val usesEpisodeResumeArtwork = card.isResumeCard && card.progressPercent != null &&
        card.resumeSeasonNumber != null && card.resumeEpisodeNumber != null && resumeEpisodeStillUrl != null
    val portraitUrl = if (usesEpisodeResumeArtwork) resumeEpisodeStillUrl else posterUrl ?: backdropUrl
    Column(modifier = Modifier.width(renderedWidth).zIndex(if (expanded) 2f else 0f)) {
        // Surface (tv-material3) gère nativement le focus D-pad + le clic OK,
        // mais PAS le clic souris/tactile (confirmé : un tap synthétique sur
        // l'émulateur ne déclenchait rien) — tvPointerClick comble ce trou
        // sans dupliquer le déclenchement côté D-pad (voir Theme.kt).
        Surface(
            onClick = onClick,
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(renderedAspect)
                .let { if (focusRequester != null) it.focusRequester(focusRequester) else it }
                .tvCardFocusHalo(focused, shape = MovvizCardShape)
                .onFocusChanged {
                    focused = it.isFocused
                    onFocusedChange?.invoke(it.isFocused)
                }
                .tvPointerClick(onClick),
            shape = androidx.tv.material3.ClickableSurfaceDefaults.shape(shape = MovvizCardShape),
            // La librairie tv-material3 zoome de 10% au focus par défaut
            // (focusedScale=1.1) tant qu'on ne l'écrase pas explicitement —
            // c'est LE vrai zoom signalé en direct, jamais retiré ici alors
            // que `expanded` (l'agrandissement paysage maison) l'était déjà
            // depuis longtemps : deux mécanismes différents, un seul avait
            // été neutralisé.
            scale = androidx.tv.material3.ClickableSurfaceDefaults.scale(focusedScale = 1f),
            colors = androidx.tv.material3.ClickableSurfaceDefaults.colors(containerColor = MovvizSurfaceStrong),
            border = androidx.tv.material3.ClickableSurfaceDefaults.border(
                focusedBorder = Border(
                    border = androidx.compose.foundation.BorderStroke(2.4.dp, Color.White.copy(alpha = 0.85f)),
                    shape = MovvizCardShape,
                ),
            ),
        ) {
            Box(modifier = Modifier.fillMaxSize()) {
                val activeImage = if (expanded) backdropUrl ?: portraitUrl else portraitUrl
                if (activeImage != null) {
                    // L'affiche demeure derrière le backdrop pendant son
                    // chargement : aucune carte vide ou flash noir.
                    Image(
                        painter = rememberAsyncImagePainter(model = activeImage, contentScale = ContentScale.Crop),
                        contentDescription = card.title,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
                    )
                }
                // Pilule type FILM/SÉRIE pour les rangées mélangées — toujours
                // visible, même hors focus, pour démêler le fouilli à 3 m.
                // Placée en haut-fin (épisode badge est en haut-début) pour
                // éviter le chevauchement quand les deux sont présents.
                if (showTypeBadge) {
                    val typeLabel = if (card.isMovie) "FILM" else "SÉRIE"
                    val typeColor = if (card.isMovie) MovvizCyan else MovvizBrand
                    Box(
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .padding(5.dp)
                            .background(typeColor.copy(alpha = 0.92f), RoundedCornerShape(3.dp))
                            .padding(horizontal = 5.dp, vertical = 2.dp),
                    ) {
                        Text(
                            text = typeLabel,
                            style = TextStyle(fontSize = 7.sp, fontWeight = FontWeight.Black, color = Color.White, letterSpacing = 0.5.sp),
                            maxLines = 1,
                        )
                    }
                }
                // Une seule carte peut être expanded à la fois dans une
                // rangée. Le pool d'AmbientTrailer n'autorise qu'un lecteur,
                // donc le changement de focus coupe aussitôt l'aperçu ancien.
                if (expanded && (card.directTrailerSources.isNotEmpty() || card.trailerKeys.isNotEmpty())) {
                    AmbientPreview(
                        directSources = card.directTrailerSources,
                        trailerKeys = card.trailerKeys,
                        title = card.title,
                        modifier = Modifier.fillMaxSize(),
                    )
                }
                if (portraitUrl == null) {
                    run {
                        // Repli dashboard : tuile noire marquée Movviz, fixe
                        // et sans animation pour rester calme au milieu des
                        // posters incomplets.
                        Box(
                            modifier = Modifier.fillMaxSize().background(Color.Black),
                            contentAlignment = Alignment.Center,
                        ) {
                            StaticLogoWithGlow(size = 41.dp)
                        }
                    }
                }
                // Pastille "vu" — films uniquement (voir TvTitleCard.watched).
                // Même langage visuel que la coche "saison vue"/"épisode vu" :
                // pastille noire à coin arrondi en haut à droite, pas le
                // cercle dégradé d'avant — un seul symbole "vu" dans toute
                // l'app. Décalée sous la pilule FILM/SÉRIE quand les deux
                // coexistent (rangées mélangées de l'accueil) pour éviter le
                // chevauchement en TopEnd.
                if (card.watched) {
                    Box(
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .padding(top = if (showTypeBadge) 22.dp else 0.dp)
                            .background(Color.Black.copy(alpha = 0.88f), RoundedCornerShape(bottomStart = 6.dp))
                            .padding(horizontal = 7.dp, vertical = 5.dp),
                    ) {
                        Icon(imageVector = MovvizIconCheck, contentDescription = "Vu", tint = Color.White, modifier = Modifier.size(10.dp))
                    }
                }
                // Le badge S/E est un contexte éditorial d'épisode. Il peut
                // donc apparaître dans « Épisodes récemment ajoutés » comme
                // dans « Continuer à regarder », sans transformer la carte
                // récente en fausse reprise.
                if (card.seasonLabel != null) {
                    Text(
                        text = card.seasonLabel,
                        style = TextStyle(fontSize = 8.sp, fontWeight = FontWeight.Bold, color = Color.White),
                        maxLines = 1,
                        modifier = Modifier
                            .align(Alignment.TopStart)
                            .padding(5.dp)
                            .background(Color.Black.copy(alpha = 0.82f), RoundedCornerShape(4.dp))
                            .padding(horizontal = 5.dp, vertical = 3.dp),
                    )
                }
                if (card.fullyWatched) {
                    Box(
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .background(Color.Black.copy(alpha = 0.88f), RoundedCornerShape(bottomStart = 6.dp))
                            .padding(horizontal = 7.dp, vertical = 5.dp),
                    ) {
                        Icon(imageVector = MovvizIconCheck, contentDescription = "Vu", tint = Color.White, modifier = Modifier.size(10.dp))
                    }
                }
                // Compteur d'épisodes non vus de la saison, en haut à droite
                // comme sur Plex.
                if (card.unwatchedCount != null) {
                    Text(
                        text = "${card.unwatchedCount}",
                        style = TextStyle(fontSize = 10.sp, fontWeight = FontWeight.Black, color = Color.White),
                        maxLines = 1,
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .background(Color.Black.copy(alpha = 0.88f), RoundedCornerShape(bottomStart = 6.dp))
                            .padding(horizontal = 8.dp, vertical = 4.dp),
                    )
                }
                val episodeBadge = card.episodeSeasonNumber != null && card.episodeNumber != null
                if (episodeBadge) {
                    Text(
                        text = "S${card.episodeSeasonNumber.toString().padStart(2, '0')} · E${card.episodeNumber.toString().padStart(2, '0')}",
                        style = TextStyle(fontSize = 8.sp, fontWeight = FontWeight.Bold, color = Color.White),
                        maxLines = 1,
                        modifier = Modifier
                            .align(Alignment.TopStart)
                            .padding(5.dp)
                            .background(Color.Black.copy(alpha = 0.82f), RoundedCornerShape(4.dp))
                            .padding(horizontal = 5.dp, vertical = 3.dp),
                    )
                }
                // Contraste garanti pour le logo/titre de la carte active.
                // Les assets TMDb sont souvent blancs et un simple
                // drop-shadow devient invisible sur neige/ciel/visage clair.
                // Ce scrim n'existe qu'en paysage focalisé : l'affiche
                // portrait reste intacte et sans surcouche.
                if (expanded || usesEpisodeResumeArtwork) {
                    Box(
                        modifier = Modifier
                            .align(Alignment.BottomCenter)
                            .fillMaxWidth()
                            .height(65.dp)
                            .background(
                                Brush.verticalGradient(
                                    colors = listOf(Color.Transparent, Color.Black.copy(alpha = 0.78f)),
                                ),
                            ),
                    )
                }
                // Les affiches portrait restent strictement propres : ni
                // logo TMDb ni titre flottant. Le logo est réservé à la
                // carte active qui vient de basculer en paysage, où il sert
                // réellement de repère comme dans le preview desktop.
                val showLogo = titleLogoPath != null && (expanded || usesEpisodeResumeArtwork)
                if (showLogo) {
                    Image(
                        painter = rememberAsyncImagePainter(model = "$TMDB_LOGO_BASE$titleLogoPath"),
                        contentDescription = card.title,
                        contentScale = ContentScale.Fit,
                        alignment = Alignment.BottomStart,
                        modifier = Modifier
                            .align(Alignment.BottomStart)
                            .padding(12.dp)
                            .heightIn(max = 41.dp)
                            .widthIn(max = 165.dp),
                    )
                }
                // Aucun nom de titre incrusté sur les cartes : le logo (quand il
                // existe) suffit, le reste passe par l'image elle-même.
                // Même paire de pastilles que la grille bibliothèque desktop
                // (note ★ en haut-gauche, statut en bas-gauche) — voir
                // ui/theme/Badges.kt. Le statut n'existe que pour les films
                // (LibrarySeriesDto n'a pas ce champ côté API) donc absent
                // pour une carte série.
                // Certaines sources (titres similaires, découverte) ne
                // renvoient pas toujours de note — 0.0 par défaut n'est pas
                // une vraie note "zéro étoile", juste une valeur absente,
                // donc pas de pastille du tout dans ce cas plutôt que "★0.0"
                // trompeur.
                // Les posters restent silencieux hors focus. Les signaux de
                // bibliothèque ne s'affichent que sur l'élément actif : le
                // regard va d'abord à l'image, comme dans la référence.
                if (showTechnicalBadges && focused && card.rating > 0) {
                    RatingBadge(
                        rating = card.rating,
                        modifier = Modifier.align(Alignment.TopStart).padding(4.dp),
                    )
                }
                card.status?.takeIf { showTechnicalBadges && focused }?.let { status ->
                    StatusPill(
                        status = status,
                        modifier = Modifier.align(Alignment.BottomStart).padding(4.dp),
                    )
                }
                // Qualité réelle du fichier (pas TMDb) — même donnée que les
                // badges FHD/4K/HDR de la grille bibliothèque desktop
                // (MediaBadges.tsx), jusqu'ici jamais mappée côté TV.
                if (showTechnicalBadges && focused && card.qualityLabel != null) {
                    Text(
                        text = if (card.hasHdr) "${card.qualityLabel} HDR" else card.qualityLabel,
                        style = TextStyle(fontSize = 7.sp, fontWeight = FontWeight.Bold, color = MovvizInk),
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .padding(4.dp)
                            .background(Color.Black.copy(alpha = 0.6f), RoundedCornerShape(3.dp))
                            .padding(horizontal = 5.dp, vertical = 2.dp),
                    )
                }
                if (card.isResumeCard && card.progressPercent != null) {
                    Box(
                        modifier = Modifier
                            .align(Alignment.BottomStart)
                            .fillMaxWidth()
                            .height(3.dp)
                            .background(Color.White.copy(alpha = 0.15f)),
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth(fraction = (card.progressPercent / 100f).coerceIn(0f, 1f))
                                .fillMaxHeight()
                                .background(Brush.horizontalGradient(listOf(MovvizBrand, MovvizBrand2))),
                        )
                    }
                }
            }
        }
        if (showCaption) {
            Text(
                text = card.title,
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onBackground,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 5.dp),
            )
            AnimatedVisibility(
                visible = expanded,
                enter = fadeIn(tween(160)) + expandVertically(tween(180)),
                exit = fadeOut(tween(100)) + shrinkVertically(tween(120)),
            ) {
                Column(Modifier.padding(top = 3.dp)) {
                    Text(
                        text = listOfNotNull(card.genres.firstOrNull(), card.year?.toString(), card.runtime?.let { "${it} min" }).joinToString("  ·  "),
                        style = MaterialTheme.typography.labelMedium,
                        color = MovvizInkSoft,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    if (card.overview.isNotBlank()) Text(
                        text = card.overview,
                        style = MaterialTheme.typography.bodySmall,
                        color = MovvizInkDim,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
            }
        // Une carte de reprise TV représente la série, mais l'action ouvre
        // un épisode. Montrer Sxx:Eyy ici évite de faire croire que l'on va
        // recommencer la série et reproduit la densité d'information des
        // cartes de la référence, sans ajouter une nouvelle cible D-pad.
            // « Reprendre » est une action, jamais un libellé générique
            // d'épisode. Il exige une progression réelle provenant du rail
            // Continuer à regarder.
            val resumeMetadata = card.takeIf { it.isResumeCard }?.progressPercent?.let { card.resumeSeasonNumber }?.let { season ->
                buildString {
                    append("Reprendre · S")
                    append(season.toString().padStart(2, '0'))
                    card.resumeEpisodeNumber?.let { episode ->
                        append(":E")
                        append(episode.toString().padStart(2, '0'))
                    }
                }
            }
            val metadata = listOfNotNull(
                resumeMetadata,
                card.year?.toString(),
                if (card.isMovie) "Film" else "Série",
            ).joinToString("  ·  ")
            Text(
                text = metadata,
                style = MaterialTheme.typography.labelSmall,
                color = MovvizInkDim,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 1.dp),
            )
        }
    }
}

/**
 * Rangée "Téléchargements en cours" — c'est tout l'intérêt de Movviz par
 * rapport à un simple client de lecture façon Plex : la recherche/le
 * téléchargement de nouveau contenu est le cœur du produit, pas un
 * détail admin cantonné à un écran séparé. Cartes horizontales (pas des
 * posters) avec barre de progression, vitesse et statut — même modèle de
 * données que QueueTab.tsx/DownloadQueue.tsx côté desktop, condensé pour le
 * 10-foot UI.
 */
@Composable
@OptIn(ExperimentalFoundationApi::class, ExperimentalComposeUiApi::class)
private fun DownloadQueueRow(items: List<QueueItemDto>, onOpenTitle: (type: String, tmdbId: Int) -> Unit) {
    Column(modifier = Modifier.padding(bottom = 36.dp)) {
        Text(
            text = "Téléchargements en cours",
            style = MaterialTheme.typography.titleLarge,
            color = MaterialTheme.colorScheme.onBackground,
            modifier = Modifier.padding(start = 48.dp, bottom = 12.dp),
        )
        TvLazyRow(
            state = rememberTvLazyListState().withTvPrefetchDisabled(),
            modifier = Modifier.focusRestorer(),
            contentPadding = PaddingValues(horizontal = 48.dp),
            horizontalArrangement = Arrangement.spacedBy(11.dp),
        ) {
            tvItemsIndexed(items, key = { _, item -> item.id }) { _, item ->
                DownloadCard(
                    item = item,
                    onClick = {
                        val tmdbId = item.media.tmdbId
                        if (tmdbId != null) onOpenTitle(if (item.media.type == "movie") "movie" else "series", tmdbId)
                    },
                )
            }
        }
    }
}

@Composable
private fun DownloadCard(item: QueueItemDto, onClick: () -> Unit) {
    var focused by remember { mutableStateOf(false) }
    val posterUrl = item.media.posterPath?.let { "$TMDB_IMAGE_BASE$it" }
    val clickable = item.media.tmdbId != null
    val shape = RoundedCornerShape(11.dp)

    // Une entrée de file n'est pas un poster tronqué. C'est une carte de
    // travail : artwork à gauche, informations et progression à droite, avec
    // un vrai état de focus qui dit sans ambiguïté qu'elle ouvre la fiche.
    Surface(
        onClick = onClick,
        enabled = clickable,
        modifier = Modifier
            .width(233.dp)
            .height(125.dp)
            .tvFocusLift(focused && clickable, shape = shape)
            .onFocusChanged { focused = it.isFocused }
            .let { if (clickable) it.tvPointerClick(onClick) else it },
        shape = androidx.tv.material3.ClickableSurfaceDefaults.shape(shape = shape),
        scale = androidx.tv.material3.ClickableSurfaceDefaults.scale(focusedScale = 1f),
        colors = androidx.tv.material3.ClickableSurfaceDefaults.colors(containerColor = MovvizSurfaceStrong),
        border = androidx.tv.material3.ClickableSurfaceDefaults.border(
            focusedBorder = Border(
                border = androidx.compose.foundation.BorderStroke(2.dp, Color.White.copy(alpha = 0.85f)),
                shape = shape,
            ),
        ),
    ) {
        Row(modifier = Modifier.fillMaxSize()) {
            Box(
                modifier = Modifier
                    .width(81.dp)
                    .fillMaxHeight()
                    .background(Brush.verticalGradient(listOf(MovvizBrand.copy(alpha = 0.35f), MovvizSurfaceStrong.copy(alpha = 0.8f), MovvizSurfaceStrong))),
                contentAlignment = Alignment.Center,
            ) {
                if (posterUrl != null) {
                    Image(
                        painter = rememberAsyncImagePainter(model = posterUrl, contentScale = ContentScale.Crop),
                        contentDescription = item.media.title,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
                    )
                    Box(modifier = Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.2f)))
                } else {
                    Text(
                        text = "↓",
                        style = TextStyle(fontSize = 29.sp, fontWeight = FontWeight.Light, color = Color.White.copy(alpha = 0.85f)),
                    )
                }
            }
            Column(modifier = Modifier.weight(1f).padding(horizontal = 11.dp, vertical = 10.dp)) {
                QueueStatusPill(status = item.status)
                Spacer(modifier = Modifier.height(7.dp))
                Text(
                    text = item.media.title,
                    style = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onBackground),
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(modifier = Modifier.weight(1f))
                Text(
                    text = downloadSubtitle(item),
                    style = TextStyle(fontSize = 9.sp, color = Color.White.copy(alpha = 0.72f)),
                    maxLines = 1,
                )
                Spacer(modifier = Modifier.height(5.dp))
                Box(modifier = Modifier.fillMaxWidth().height(4.dp).background(Color.White.copy(alpha = 0.14f), RoundedCornerShape(50))) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(fraction = item.download.progress.toFloat().coerceIn(0f, 1f))
                            .fillMaxHeight()
                            .background(Brush.horizontalGradient(listOf(MovvizBrand, MovvizBrand2)), RoundedCornerShape(50)),
                    )
                }
                if (clickable) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(text = "Ouvrir la fiche", style = TextStyle(fontSize = 8.sp, fontWeight = FontWeight.SemiBold, color = MovvizCyan))
                }
            }
        }
    }
}

/** Pastille de statut de FILE DE TÉLÉCHARGEMENT (torrent) — distincte de
 *  StatusPill (ui/theme/Badges.kt) qui couvre le statut de DISPONIBILITÉ
 *  bibliothèque (available/downloading/searching/upcoming/missing) : ce sont
 *  deux domaines de valeurs différents (ex. "seeding"/"stalled"/"verifying"
 *  n'existent pas côté bibliothèque), d'où un nom distinct plutôt qu'une
 *  redéfinition qui masquerait silencieusement l'autre dans ce fichier. */
@Composable
private fun QueueStatusPill(status: String, modifier: Modifier = Modifier) {
    val (label, color) = when (status) {
        "downloading" -> "Téléchargement" to MovvizCyan
        "queued" -> "En attente" to MovvizAmber
        "paused" -> "En pause" to MovvizAmber
        "stalled" -> "Bloqué" to MovvizDown
        "verifying" -> "Vérification" to MovvizCyan
        "importing" -> "Import" to MovvizCyan
        "seeding" -> "Partage" to MovvizOk
        "completed" -> "Terminé" to MovvizOk
        "failed" -> "Échec" to MovvizDown
        else -> status to MovvizCyan
    }
    Box(
        modifier = modifier
            .background(color.copy(alpha = 0.15f), RoundedCornerShape(50))
            .border(1.dp, color.copy(alpha = 0.3f), RoundedCornerShape(50))
            .padding(horizontal = 6.dp, vertical = 2.dp),
    ) {
        Text(text = label, style = TextStyle(fontSize = 8.sp, fontWeight = FontWeight.Bold, color = color))
    }
}

/** "68% · 4,2 Mo/s" ou "Terminé · scène partagée" selon l'état — même esprit
 *  que formatSpeed/formatEta côté desktop (src/lib/utils.ts), version
 *  compacte pour une carte de 140dp de large. */
private fun downloadSubtitle(item: QueueItemDto): String {
    val percent = Math.round(item.download.progress * 100).coerceIn(0, 100)
    val speed = formatSpeed(item.download.downloadSpeed)
    return if (speed != null) "$percent% · $speed" else "$percent%"
}

private fun formatSpeed(bytesPerSec: Double): String? {
    if (bytesPerSec < 1024) return null
    val units = listOf("Ko/s", "Mo/s", "Go/s")
    var value = bytesPerSec / 1024.0
    var unitIndex = 0
    while (value >= 1024 && unitIndex < units.lastIndex) {
        value /= 1024.0
        unitIndex++
    }
    return "%.1f %s".format(value, units[unitIndex])
}

/** Cache des luminances moyennes par URL de backdrop — calculées une fois,
 *  jamais recalculées à chaque rotation du hero. */
private val luminanceCache = HashMap<String, Float>()

/** Luminance moyenne pondérée (Rec. 709) d'un échantillon 64x36 : 0 = noir
 *  profond, 1 = blanc. Un sous-échantillon de 1 pixel sur 2 suffit pour une
 *  valeur stable à ±0.02 près. */
private fun averageLuminance(bmp: Bitmap): Float {
    var sum = 0.0
    var count = 0
    for (y in 0 until bmp.height step 2) {
        for (x in 0 until bmp.width step 2) {
            val p = bmp.getPixel(x, y)
            sum += (0.2126f * AndroidColor.red(p) + 0.7152f * AndroidColor.green(p) + 0.0722f * AndroidColor.blue(p)) / 255.0
            count++
        }
    }
    return if (count == 0) 0.5f else (sum / count).toFloat()
}

/** Force du scrim vertical selon la luminosité du backdrop : sombre → scrim
 *  léger (l'image porte sa propre lisibilité), clair → scrim renforcé pour
 *  garder le texte blanc lisible. */
private fun scrimStrengthFor(luminance: Float): Float = when {
    luminance < 0.2f -> 0.45f
    luminance < 0.4f -> 0.55f
    else -> 0.68f
}
