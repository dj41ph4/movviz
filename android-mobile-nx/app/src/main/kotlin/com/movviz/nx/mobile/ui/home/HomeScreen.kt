package com.movviz.nx.mobile.ui.home

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
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.tv.material3.Border
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import coil.imageLoader
import coil.compose.rememberAsyncImagePainter
import coil.request.ImageRequest
import coil.size.Size
import com.movviz.nx.mobile.ui.theme.AnimatedLogo
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
import com.movviz.nx.mobile.AppViewModel
import com.movviz.nx.mobile.data.QueueItemDto
import com.movviz.nx.mobile.data.TrailerSourceDto
import com.movviz.nx.mobile.data.TvPreviewDto
import com.movviz.nx.mobile.ui.theme.MovvizAmber
import com.movviz.nx.mobile.ui.theme.MovvizBrand
import com.movviz.nx.mobile.ui.theme.MovvizBrand2
import com.movviz.nx.mobile.ui.theme.MovvizCardShape
import com.movviz.nx.mobile.ui.theme.MovvizCyan
import com.movviz.nx.mobile.ui.theme.MovvizDown
import com.movviz.nx.mobile.ui.theme.MovvizInk
import com.movviz.nx.mobile.ui.theme.MovvizInkDim
import com.movviz.nx.mobile.ui.theme.MovvizInkSoft
import com.movviz.nx.mobile.ui.theme.MovvizIconPlay
import com.movviz.nx.mobile.ui.theme.MovvizIconStar
import com.movviz.nx.mobile.ui.theme.MovvizIconFilm
import androidx.tv.material3.Icon
import com.movviz.nx.mobile.ui.theme.MovvizOk
import com.movviz.nx.mobile.ui.theme.MovvizSurfaceStrong
import com.movviz.nx.mobile.ui.theme.StaticLogoWithGlow
import com.movviz.nx.mobile.ui.theme.RatingBadge
import com.movviz.nx.mobile.ui.theme.StatusPill
import com.movviz.nx.mobile.ui.theme.statusTone
import com.movviz.nx.mobile.ui.theme.tvFocusLift
import com.movviz.nx.mobile.ui.theme.tvCardFocusHalo
import com.movviz.nx.mobile.ui.theme.tvPointerClick
import com.movviz.nx.mobile.ui.theme.withTvPrefetchDisabled
import kotlinx.coroutines.delay
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView

private const val TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500"
private const val TMDB_LOGO_BASE = "https://image.tmdb.org/t/p/w500"
// w1280, PAS "original" : un backdrop plein écran en "original" télécharge
// jusqu'à 4000px de large (plusieurs Mo décodés en bitmap complet) pour un
// écran TV 1080p qui n'en montre que 1920px — le gaspillage réseau/mémoire
// était visible sur Chromecast 4K. Netflix/Apple TV servent du 1080p max.
private const val TMDB_BACKDROP_BASE = "https://image.tmdb.org/t/p/w1280"

/** "Bonsoir, {prénom}" — jamais de prénom en dur (esquisse section 18 : pas
 *  de données de démonstration). Replié sur "Bonsoir" seul si le profil actif
 *  n'a pas encore été chargé. */
private fun greetingFor(profileName: String?): String {
    val hour = java.time.LocalTime.now().hour
    val salutation = when {
        hour < 5 -> "Bonne nuit"
        hour < 18 -> "Bonjour"
        else -> "Bonsoir"
    }
    return if (profileName.isNullOrBlank()) salutation else "$salutation, $profileName"
}

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
    /** Vrai seulement pour le rail « Continuer à regarder ». Les données
     * d'un épisode ajouté peuvent contenir une position héritée, mais ne
     * doivent jamais devenir une fausse reprise. */
    val isResumeCard: Boolean = false,
    /** "4K"/"1080p"/... — voir resolutionLabel(). Absent pour tout ce qui
     *  n'a pas de fichier réel en bibliothèque (séries, découverte). */
    val qualityLabel: String? = null,
    val hasHdr: Boolean = false,
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
)

/** Rangée d'accueil multi-type. Accueil est le seul endroit où films et séries
 * sont volontairement entrelacés ; Films/Séries gardent leurs hubs séparés. */
private data class HomeEditorialRow(val key: String, val heading: String, val cards: List<TvTitleCard>)

@Composable
fun HomeScreen(
    viewModel: AppViewModel,
    onOpenTitle: (type: String, tmdbId: Int) -> Unit,
    onOpenEpisode: (tmdbId: Int, season: Int, episode: Int) -> Unit = { _, _, _ -> },
    onSeeAllRow: (mediaType: String, key: String, label: String) -> Unit = { _, _, _ -> },
    entryFocusRequester: FocusRequester? = null,
    // Destination UP uniquement depuis l'ancre réellement située au sommet.
    // Ne jamais l'employer depuis une carte : TvLazyColumn doit d'abord
    // résoudre la rangée précédente et faire défiler le contenu.
    navRailFocusRequester: FocusRequester? = null,
    onScrollChanged: (Boolean) -> Unit = {},
) {
    val compactPortrait = androidx.compose.ui.platform.LocalConfiguration.current.let {
        it.screenWidthDp < 600 && it.screenHeightDp > it.screenWidthDp
    }
    val streamedMovies by viewModel.movies.collectAsState()
    val streamedSeries by viewModel.series.collectAsState()
    val streamedRecentEpisodes by viewModel.recentEpisodes.collectAsState()
    val streamedContinueWatching by viewModel.continueWatching.collectAsState()
    val queue by viewModel.queue.collectAsState()
    val streamedMovieRows by viewModel.movieRows.collectAsState()
    val streamedSeriesRows by viewModel.seriesRows.collectAsState()
    val streamedMovieRecommendations by viewModel.movieLibraryRecommendations.collectAsState()
    val streamedSeriesRecommendations by viewModel.seriesLibraryRecommendations.collectAsState()
    val streamedDashboardHero by viewModel.dashboardHero.collectAsState()
    val streamedDashboardLayout by viewModel.dashboardLayout.collectAsState()
    val heroLogos by viewModel.heroLogos.collectAsState()
    val homeUiState by viewModel.homeUiState.collectAsState()
    // Rail "Plateformes" en tête de l'accueil portrait (esquisse mobile
    // section 8) — même source que le rail homonyme de Découverte
    // (DiscoverScreen.kt), déclenchée ici aussi si pas déjà chargée.
    val watchProviderTiles by viewModel.watchProviderTiles.collectAsState()
    val activeHomeProfile by viewModel.activeProfile.collectAsState()
    LaunchedEffect(Unit) { if (watchProviderTiles.isEmpty()) viewModel.loadDiscoverLogos() }
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
    LaunchedEffect(Unit) { viewModel.bootstrapHome() }
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
    fun searchCard(item: com.movviz.nx.mobile.data.SearchResultDto, prefix: String) = TvTitleCard(
        id = "$prefix-${item.type}-${item.tmdbId}",
        title = item.title,
        posterPath = item.posterPath,
        backdropPath = item.backdropPath,
        tmdbId = item.tmdbId,
        isMovie = item.type == "movie",
        year = item.year,
        rating = item.rating,
    )

    val continueCards = remember(continueWatching, movies, series) {
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
            TvTitleCard(
                id = "cw-${resume.type}-${resume.tmdbId}-${resume.seasonNumber}-${resume.episodeNumber}",
                title = resume.title ?: "—",
                posterPath = resume.posterPath,
                backdropPath = libraryBackdrop,
                tmdbId = resume.tmdbId,
                isMovie = resume.type == "movie",
                rating = resume.rating,
                progressPercent = resume.progressPercent,
                isResumeCard = true,
                resumeSeasonNumber = resume.seasonNumber,
                resumeEpisodeNumber = resume.episodeNumber,
                resumeEpisodeTitle = resume.episodeTitle,
                resumeEpisodeStillPath = resume.episodeStillPath,
                episodeSeasonNumber = resume.seasonNumber,
                episodeNumber = resume.episodeNumber,
                episodeTitle = resume.episodeTitle,
            )
        }.distinctBy { it.id }
    }
    val recentEpisodeCards = remember(recentEpisodes) {
        recentEpisodes.sortedByDescending { it.addedAt }.map { episode ->
            TvTitleCard(
                id = "recent-episode-${episode.tmdbId}-${episode.seasonNumber}-${episode.episodeNumber}",
                title = episode.seriesTitle, posterPath = episode.posterPath, backdropPath = episode.backdropPath,
                tmdbId = episode.tmdbId, isMovie = false, rating = episode.rating,
                episodeSeasonNumber = episode.seasonNumber, episodeNumber = episode.episodeNumber,
                episodeTitle = episode.episodeTitle,
            )
        }.distinctBy { it.id }.take(20)
    }
    // Les vignettes de reprise sont déjà visibles au premier frame : charger
    // leurs logos en parallèle (et non seulement au focus) évite le texte
    // de repli sur chaque carte alors qu'un logo officiel existe. Le
    // ViewModel déduplique les requêtes et conserve le cache partagé.
    LaunchedEffect(continueCards) {
        continueCards
            .filter { !it.isMovie && it.resumeSeasonNumber != null && it.resumeEpisodeNumber != null }
            .map { it.tmdbId }
            .distinct()
            .forEach { viewModel.requestHeroLogo("series", it) }
    }

    // Même source et même fusion que DashboardRows desktop.
    val recommendationCards = remember(movieRecommendations, seriesRecommendations, minYear) {
        movieRecommendations.filter { yearAllowed(it.year) }.map { searchCard(it, "rec") }
            .zipInterleave(seriesRecommendations.filter { yearAllowed(it.year) }.map { searchCard(it, "rec") })
            .distinctBy { "${it.isMovie}-${it.tmdbId}" }
            .take(20)
    }
    val trendingCards = remember(movieRows, seriesRows, minYear) {
        val movie = movieRows.firstOrNull { it.key == "trendingPopular" || it.key == "trending" }
            ?.results.orEmpty().filter { yearAllowed(it.year) }.map { searchCard(it, "trend") }
        val tv = seriesRows.firstOrNull { it.key == "trendingPopular" || it.key == "trending" }
            ?.results.orEmpty().filter { yearAllowed(it.year) }.map { searchCard(it, "trend") }
        movie.zipInterleave(tv).distinctBy { "${it.isMovie}-${it.tmdbId}" }.take(10)
    }
    // L'accueil ne s'arrête pas aux quelques blocs du dashboard : comme un
    // vrai écran de streaming, il prolonge le héros et la reprise avec les
    // étagères éditoriales de tous les services, dans un flux films + séries.
    // Les hubs Films/Séries affichent les mêmes données sans les mélanger.
    val editorialHomeRows = remember(movieRows, seriesRows, minYear) {
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
            cards.takeIf { it.isNotEmpty() }?.let { HomeEditorialRow(key, homeEditorialLabel(key, movieRows, seriesRows), it) }
        }
    }

    val availableNowCards = remember(movies, series, minYear) {
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
        (movie + shows).sortedByDescending { it.first }.map { it.second }.take(20)
    }
    val shortSessionCards = remember(movies, minYear) {
        movies.filter { it.status == "available" && it.runtime != null && it.runtime <= 40 && yearAllowed(it.year) }
            .sortedByDescending { it.addedAt }
            .take(20)
            .map {
                TvTitleCard(
                    id = "short-${it.tmdbId}", title = it.title, posterPath = it.posterPath,
                    backdropPath = it.customBackdropPath ?: it.backdropPath, tmdbId = it.tmdbId, isMovie = true,
                    year = it.year, rating = it.rating, genres = it.genres, runtime = it.runtime,
                    qualityLabel = resolutionLabel(it.file?.resolution), hasHdr = !it.file?.hdr.isNullOrBlank(),
                )
            }
    }
    val comingSoonCards = remember(movies, minYear) {
        movies.filter { it.status == "upcoming" && yearAllowed(it.year) }
            .sortedBy { it.vfReleaseDate ?: it.releaseDate ?: "9999-99-99" }
            .take(20)
            .map {
                TvTitleCard(
                    id = "soon-${it.tmdbId}", title = it.title, posterPath = it.posterPath,
                    backdropPath = it.customBackdropPath ?: it.backdropPath, tmdbId = it.tmdbId, isMovie = true,
                    year = it.year, rating = it.rating, genres = it.genres, status = it.status,
                )
            }
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
    val topAnchor = remember { FocusRequester() }
    val listState = rememberTvLazyListState().withTvPrefetchDisabled()
    val hasScrolled by remember {
        derivedStateOf {
            listState.firstVisibleItemIndex > 0 || listState.firstVisibleItemScrollOffset > 12
        }
    }
    LaunchedEffect(hasScrolled) { onScrollChanged(hasScrolled) }

    Box(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        TvLazyColumn(
            modifier = Modifier.fillMaxSize(),
            state = listState,
            // Le rail possède désormais sa propre colonne hors de cet écran.
            // Le hero peut donc occuper toute la largeur de la zone contenu,
            // sans marge à gauche ni recouvrement sous la navigation. Les
            // rangées gardent leurs propres marges internes (LazyRow/heading).
            contentPadding = PaddingValues(bottom = if (compactPortrait) 156.dp else 72.dp),
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
                Box(
                    modifier = Modifier.fillMaxWidth().height(1.dp)
                        .let { if (anchorOwnsContentFocus) it.focusRequester(contentFocus) else it }
                        .focusRequester(topAnchor).focusable()
                        .onPreviewKeyEvent { event ->
                            if (event.type == KeyEventType.KeyDown && event.key == Key.DirectionUp) {
                                navRailFocusRequester?.let {
                                    runCatching { it.requestFocus() }.isSuccess
                                } == true
                            } else {
                                false
                            }
                        },
                )
            }
            // Accueil portrait (esquisse mobile section 8) : pas de hero
            // plein écran — l'écran ouvre sur un message d'accueil puis les
            // plateformes configurées, immédiatement suivis des rangées de
            // reprise. Le hero reste la porte d'entrée TV/paysage, inchangée.
            if (compactPortrait) {
                item(contentType = "greeting") {
                    Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)) {
                        Text(
                            text = greetingFor(activeHomeProfile?.name),
                            style = TextStyle(fontSize = 22.sp, fontWeight = FontWeight.Bold, color = MovvizInk),
                        )
                        Text(
                            text = "Prêt pour une nouvelle histoire ?",
                            color = MovvizInkDim,
                            fontSize = 13.sp,
                            modifier = Modifier.padding(top = 2.dp),
                        )
                    }
                }
                if (watchProviderTiles.isNotEmpty()) {
                    item(contentType = "platforms") {
                        Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)) {
                            Text(
                                text = "Plateformes",
                                style = TextStyle(fontSize = 19.sp, fontWeight = FontWeight.Bold, color = MovvizInk),
                                modifier = Modifier.padding(bottom = 12.dp),
                            )
                            // Icônes carrées (esquisse mobile section 8), pas les
                            // puces arrondies à largeur variable de Découverte/TV
                            // — même action : ouvre la suggestion personnalisée
                            // pour cette plateforme. Aucun type fixe sur
                            // l'accueil (rails mixtes) — "movie" par défaut.
                            com.movviz.nx.mobile.ui.mobile.MovvizPlatformRow(
                                tiles = watchProviderTiles,
                                onSelect = { tile -> onSeeAllRow("movie", "providerSuggested:${tile.id}", "Suggestion ${tile.name} pour vous") },
                            )
                        }
                    }
                }
            } else if (showHero) {
                item(contentType = "hero") {
                    HeroCarousel(
                        items = heroItems,
                        currentIndex = heroIndex,
                        logoPath = activeHero?.let { heroLogos["${if (it.isMovie) "movie" else "series"}-${it.tmdbId}"] },
                        onSelectIndex = { heroIndex = it },
                        ctaFocusRequester = contentFocus,
                        trailerAutoplay = dashboardLayout.hero.trailerAutoplay && activeCardPreviewKey == null,
                        onOpen = { card -> onOpenTitle(if (card.isMovie) "movie" else "series", card.tmdbId) },
                    )
                }
            }

            visibleSections.forEach { sectionId ->
                when (sectionId) {
                    "continueWatching" -> if (compactPortrait) {
                        // Esquisse mobile : "Reprendre vos films"/"Reprendre
                        // vos séries" scindés plutôt qu'une seule rangée
                        // mixte "Continuer à regarder" (conservée telle
                        // quelle en paysage/TV, ci-dessous).
                        // Pas de remember() ici : ce bloc s'exécute dans le
                        // DSL LazyListScope.forEach, hors contexte composable
                        // (remember exige une composition active).
                        val resumeMovies = continueCards.filter { it.isMovie }
                        val resumeSeries = continueCards.filterNot { it.isMovie }
                        if (resumeMovies.isNotEmpty()) {
                            item(contentType = "row") {
                                TitleRow(
                                    heading = "Reprendre vos films", items = resumeMovies,
                                    onClick = { card -> onOpenTitle("movie", card.tmdbId) },
                                    firstItemFocusRequester = if (firstVisibleSection == sectionId) contentFocus else null,
                                    titleLogoPaths = heroLogos,
                                    onFocusedCard = { viewModel.requestHeroLogo("movie", it.tmdbId) },
                                    previewLoader = { viewModel.loadTvPreview("movie", it.tmdbId) },
                                    onPreviewStateChanged = onCardPreviewStateChanged,
                                )
                            }
                        }
                        if (resumeSeries.isNotEmpty()) {
                            item(contentType = "row") {
                                TitleRow(
                                    heading = "Reprendre vos séries", items = resumeSeries,
                                    onClick = { card ->
                                        val season = card.resumeSeasonNumber
                                        val episode = card.resumeEpisodeNumber
                                        if (season != null && episode != null) onOpenEpisode(card.tmdbId, season, episode)
                                        else onOpenTitle("series", card.tmdbId)
                                    },
                                    firstItemFocusRequester = if (resumeMovies.isEmpty() && firstVisibleSection == sectionId) contentFocus else null,
                                    titleLogoPaths = heroLogos,
                                    onFocusedCard = { viewModel.requestHeroLogo("series", it.tmdbId) },
                                    previewLoader = { viewModel.loadTvPreview("series", it.tmdbId) },
                                    onPreviewStateChanged = onCardPreviewStateChanged,
                                )
                            }
                        }
                    } else item(contentType = "row") {
                        TitleRow(
                            heading = "Continuer à regarder", items = continueCards,
                            onClick = { card ->
                                val season = card.resumeSeasonNumber
                                val episode = card.resumeEpisodeNumber
                                if (!card.isMovie && season != null && episode != null) onOpenEpisode(card.tmdbId, season, episode)
                                else onOpenTitle(if (card.isMovie) "movie" else "series", card.tmdbId)
                            },
                            firstItemFocusRequester = if (!showHero && firstVisibleSection == sectionId) contentFocus else null,
                            titleLogoPaths = heroLogos,
                            onFocusedCard = { viewModel.requestHeroLogo(if (it.isMovie) "movie" else "series", it.tmdbId) },
                            previewLoader = { viewModel.loadTvPreview(if (it.isMovie) "movie" else "series", it.tmdbId) },
                            onPreviewStateChanged = onCardPreviewStateChanged,
                        )
                    }
                    "recentEpisodes" -> item(contentType = "row") {
                        TitleRow(
                            heading = "Épisodes récemment ajoutés", items = recentEpisodeCards,
                            onClick = { onOpenTitle("series", it.tmdbId) },
                            firstItemFocusRequester = if (!showHero && firstVisibleSection == sectionId) contentFocus else null,
                            titleLogoPaths = heroLogos,
                            onFocusedCard = { viewModel.requestHeroLogo("series", it.tmdbId) },
                            previewLoader = { viewModel.loadTvPreview("series", it.tmdbId) },
                            onPreviewStateChanged = onCardPreviewStateChanged,
                        )
                    }
                    "becauseYouLike" -> item(contentType = "row") {
                        TitleRow(
                            heading = "Sélection pour vous", items = recommendationCards,
                            onClick = { onOpenTitle(if (it.isMovie) "movie" else "series", it.tmdbId) },
                            firstItemFocusRequester = if (!showHero && firstVisibleSection == sectionId) contentFocus else null,
                            titleLogoPaths = heroLogos,
                            onFocusedCard = { viewModel.requestHeroLogo(if (it.isMovie) "movie" else "series", it.tmdbId) },
                            previewLoader = { viewModel.loadTvPreview(if (it.isMovie) "movie" else "series", it.tmdbId) },
                            onPreviewStateChanged = onCardPreviewStateChanged,
                        )
                    }
                    "shortSessions" -> item(contentType = "row") {
                        TitleRow(
                            heading = "Moins de 40 minutes", items = shortSessionCards,
                            onClick = { onOpenTitle("movie", it.tmdbId) },
                            firstItemFocusRequester = if (!showHero && firstVisibleSection == sectionId) contentFocus else null,
                            titleLogoPaths = heroLogos,
                            onFocusedCard = { viewModel.requestHeroLogo(if (it.isMovie) "movie" else "series", it.tmdbId) },
                            previewLoader = { viewModel.loadTvPreview(if (it.isMovie) "movie" else "series", it.tmdbId) },
                            onPreviewStateChanged = onCardPreviewStateChanged,
                        )
                    }
                    "discover" -> item(contentType = "row") {
                        TitleRow(
                            heading = "Tendances Movviz", items = trendingCards,
                            onClick = { onOpenTitle(if (it.isMovie) "movie" else "series", it.tmdbId) },
                            firstItemFocusRequester = if (!showHero && firstVisibleSection == sectionId) contentFocus else null,
                            titleLogoPaths = heroLogos,
                            onFocusedCard = { viewModel.requestHeroLogo(if (it.isMovie) "movie" else "series", it.tmdbId) },
                            previewLoader = { viewModel.loadTvPreview(if (it.isMovie) "movie" else "series", it.tmdbId) },
                            onPreviewStateChanged = onCardPreviewStateChanged,
                        )
                    }
                    "availableNow" -> item(contentType = "row") {
                        TitleRow(
                            heading = "Ajoutés récemment", items = availableNowCards,
                            onClick = { onOpenTitle(if (it.isMovie) "movie" else "series", it.tmdbId) },
                            firstItemFocusRequester = if (!showHero && firstVisibleSection == sectionId) contentFocus else null,
                            titleLogoPaths = heroLogos,
                            onFocusedCard = { viewModel.requestHeroLogo(if (it.isMovie) "movie" else "series", it.tmdbId) },
                            previewLoader = { viewModel.loadTvPreview(if (it.isMovie) "movie" else "series", it.tmdbId) },
                            onPreviewStateChanged = onCardPreviewStateChanged,
                        )
                    }
                    "comingSoon" -> item(contentType = "row") {
                        TitleRow(
                            heading = "Prochainement", items = comingSoonCards,
                            onClick = { onOpenTitle("movie", it.tmdbId) },
                            firstItemFocusRequester = if (!showHero && firstVisibleSection == sectionId) contentFocus else null,
                            titleLogoPaths = heroLogos,
                            onFocusedCard = { viewModel.requestHeroLogo(if (it.isMovie) "movie" else "series", it.tmdbId) },
                            previewLoader = { viewModel.loadTvPreview("movie", it.tmdbId) },
                            onPreviewStateChanged = onCardPreviewStateChanged,
                        )
                    }
                }
                if (sectionId == "becauseYouLike" && queue.isNotEmpty()) {
                    item(contentType = "queue") { DownloadQueueRow(items = queue, onOpenTitle = onOpenTitle) }
                }
            }

            editorialHomeRows.forEach { row ->
                item(key = "editorial-${row.key}", contentType = "editorial-row") {
                    TitleRow(
                        heading = row.heading,
                        items = row.cards,
                        onClick = { onOpenTitle(if (it.isMovie) "movie" else "series", it.tmdbId) },
                        titleLogoPaths = heroLogos,
                        onFocusedCard = { viewModel.requestHeroLogo(if (it.isMovie) "movie" else "series", it.tmdbId) },
                        previewLoader = { viewModel.loadTvPreview(if (it.isMovie) "movie" else "series", it.tmdbId) },
                        onPreviewStateChanged = onCardPreviewStateChanged,
                    )
                }
            }

            if (visibleSections.isEmpty() && heroItems.isEmpty()) {
                item(contentType = "loading") {
                    val bootProfile by viewModel.activeProfile.collectAsState()
                    Box(
                        modifier = Modifier.fillMaxWidth().height(560.dp).padding(top = 24.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            MovvizBootScreen(
                                progress = homeUiState.bootProgress,
                                message = homeUiState.bootMessage,
                                profileName = bootProfile?.name,
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
                modifier = Modifier.align(Alignment.TopEnd).padding(top = 132.dp, end = 48.dp)
                    .clip(RoundedCornerShape(18.dp)).background(Color.Black.copy(alpha = .72f)),
            ) {
                Text(
                    "Hors ligne · contenu enregistré",
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 9.dp),
                    style = MaterialTheme.typography.labelMedium,
                    color = Color.White.copy(alpha = .85f),
                )
            }
        }
    }
}

/** Étape 4/5 premier démarrage — "Préparation de votre espace".
 * Maquette : logo + wordmark, titre, sous-titre synchro, barre dégradé
 * avec % à droite, ligne "Profil X · Serveur connecté". Progrès réel du bootstrap. */
@Composable
private fun MovvizBootScreen(progress: Int, message: String, profileName: String? = null) {
    Column(
        modifier = Modifier
            .widthIn(min = 300.dp, max = 460.dp)
            .fillMaxWidth()
            .padding(horizontal = 20.dp)
            .clip(RoundedCornerShape(26.dp))
            .background(Color(0xFF101330).copy(alpha = 0.94f))
            .border(1.dp, Color.White.copy(alpha = 0.09f), RoundedCornerShape(26.dp))
            .padding(horizontal = 24.dp, vertical = 30.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        AnimatedLogo(size = 72.dp)
        Spacer(Modifier.height(10.dp))
        com.movviz.nx.mobile.ui.theme.MovvizWordmark(fontSize = 24.sp)
        Spacer(Modifier.height(22.dp))
        Text(
            "Préparation de votre espace",
            style = TextStyle(fontSize = 19.sp, fontWeight = FontWeight.ExtraBold, color = Color.White, textAlign = androidx.compose.ui.text.style.TextAlign.Center),
        )
        Spacer(Modifier.height(6.dp))
        Text(
            message.ifBlank { "Synchronisation de votre bibliothèque..." },
            style = TextStyle(fontSize = 13.sp, color = Color.White.copy(alpha = 0.60f), textAlign = androidx.compose.ui.text.style.TextAlign.Center),
        )
        Spacer(Modifier.height(22.dp))
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier.weight(1f).height(8.dp)
                    .clip(RoundedCornerShape(8.dp)).background(Color.White.copy(alpha = 0.14f)),
            ) {
                Box(
                    modifier = Modifier.fillMaxHeight().fillMaxWidth((progress.coerceIn(0, 100) / 100f))
                        .background(Brush.horizontalGradient(listOf(MovvizBrand, MovvizBrand2)), RoundedCornerShape(8.dp)),
                )
            }
            Spacer(Modifier.width(10.dp))
            Text("$progress %", style = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.White.copy(alpha = 0.85f)))
        }
        Spacer(Modifier.height(14.dp))
        Text(
            if (profileName != null) "Profil $profileName · Serveur connecté" else "Serveur connecté",
            style = TextStyle(fontSize = 12.sp, color = Color.White.copy(alpha = 0.55f), textAlign = androidx.compose.ui.text.style.TextAlign.Center),
        )
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
    trailerAutoplay: Boolean = true,
    onOpen: (TvTitleCard) -> Unit,
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

    // Un hero TV ne doit jamais monopoliser tout le viewport : on garde une
    // rangée visible sous la vedette, comme les références Netflix fournies.
    // Cela rend la page immédiatement parcourable avec la télécommande au
    // lieu de donner l'impression d'une affiche géante à faire défiler.
    val configuration = androidx.compose.ui.platform.LocalConfiguration.current
    val compactPortrait = configuration.screenWidthDp < 600 && configuration.screenHeightDp > configuration.screenWidthDp
    // Le hero paysage reste strictement inchangé. En portrait, la même
    // vedette ne doit pas consommer tout le premier écran ni recadrer le
    // visage du film derrière une colonne de texte : une hauteur bornée
    // laisse immédiatement voir la première rangée et garde les CTA tactiles
    // dans le viewport.
    val heroHeight = if (compactPortrait) {
        (configuration.screenHeightDp * 0.45f).coerceIn(300f, 420f)
    } else {
        (configuration.screenHeightDp * 0.62f).coerceIn(390f, 600f)
    }
    // Portrait : carte à coins arrondis avec marge horizontale — pas un
    // visuel plein-écran bord à bord (esquisse mobile 2026-09, les 5 écrans
    // montrent tous une carte hero distincte, jamais un backdrop plein cadre).
    // Le paysage/TV garde le hero plein-écran existant, inchangé.
    val heroShape = if (compactPortrait) RoundedCornerShape(20.dp) else androidx.compose.ui.graphics.RectangleShape
    Box(
        modifier = Modifier.fillMaxWidth()
            .then(if (compactPortrait) Modifier.padding(horizontal = 16.dp) else Modifier)
            .height(heroHeight.dp)
            .clip(heroShape)
            .clipToBounds(),
    ) {
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
                painter = rememberAsyncImagePainter(model = "$TMDB_BACKDROP_BASE${item.backdropPath}"),
                contentDescription = null,
                contentScale = ContentScale.Crop,
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

        // Pastille "★ note" en haut à gauche du visuel — portrait uniquement
        // (esquisse mobile 2026-09) ; le paysage/TV affiche déjà la note dans
        // la ligne méta sous le titre, pas besoin d'une seconde pastille.
        if (compactPortrait && current.rating > 0) {
            com.movviz.nx.mobile.ui.theme.RatingBadge(
                rating = current.rating,
                modifier = Modifier.align(Alignment.TopStart).padding(14.dp),
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
                .padding(
                    start = if (compactPortrait) 20.dp else 52.dp,
                    end = if (compactPortrait) 20.dp else 40.dp,
                    bottom = if (compactPortrait) 24.dp else 46.dp,
                )
                .widthIn(max = if (compactPortrait) (configuration.screenWidthDp - 40).dp else 620.dp),
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
                style = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color.White.copy(alpha = 0.7f), letterSpacing = 2.5.sp),
            )
            Spacer(modifier = Modifier.height(8.dp))
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
                        .width(if (compactPortrait) 260.dp else 440.dp)
                        .height(if (compactPortrait) 58.dp else 82.dp),
                )
            } else if (showTitleFallback) {
                Text(
                    text = current.title,
                    style = TextStyle(fontSize = 40.sp, fontWeight = FontWeight.Black, color = MovvizInk, lineHeight = 44.sp),
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            } else {
                // Réserve la place du logo pendant son chargement : aucun
                // titre texte ne clignote avant de laisser sa place au logo.
                Spacer(modifier = Modifier.height(if (compactPortrait) 64.dp else 90.dp).widthIn(max = if (compactPortrait) 260.dp else 460.dp))
            }
            // Badge statut bibliothèque (même pastille que la fiche titre)
            current.status?.let { st ->
                if (st != "available") {
                    Spacer(modifier = Modifier.height(8.dp))
                    val tone = statusTone(st)
                    Box(
                        modifier = Modifier
                            .background(tone.color.copy(alpha = 0.12f), RoundedCornerShape(50))
                            .border(1.dp, tone.color.copy(alpha = 0.25f), RoundedCornerShape(50))
                            .padding(horizontal = 12.dp, vertical = 4.dp),
                    ) {
                        Text(text = tone.label, style = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.Bold, color = tone.color))
                    }
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
            // Même ligne méta que la fiche : ★ · année · durée · genres inline
            // (les chips séparées prenaient une rangée entière pour rien).
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (current.rating > 0) {
                    // Icône vectorielle : le glyphe ★ n'existe pas dans Inter
                    // (rendu fallback système cassé sur Google TV).
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        Icon(
                            imageVector = MovvizIconStar,
                            contentDescription = null,
                            tint = Color(0xFFF5C542),
                            modifier = Modifier.size(13.dp),
                        )
                        Text(text = "%.1f".format(current.rating), style = TextStyle(fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Color(0xFFF5C542)))
                    }
                    HeroMetaDot()
                }
                current.year?.let {
                    Text(text = "$it", style = TextStyle(fontSize = 14.sp, fontWeight = FontWeight.Medium, color = MovvizInkSoft))
                    HeroMetaDot()
                }
                current.runtime?.let {
                    Text(text = "$it min", style = TextStyle(fontSize = 14.sp, color = MovvizInkSoft))
                    if (current.genres.isNotEmpty()) HeroMetaDot()
                }
                Text(
                    text = current.genres.take(3).joinToString("  •  "),
                    style = TextStyle(fontSize = 14.sp, color = MovvizInkSoft),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            if (current.overview.isNotBlank()) {
                Spacer(modifier = Modifier.height(10.dp))
                Text(
                    text = current.overview,
                    style = TextStyle(fontSize = 13.sp, color = MovvizInkSoft, lineHeight = 19.sp),
                    maxLines = if (compactPortrait) 1 else 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.widthIn(max = 580.dp),
                )
            }
            }
            Spacer(modifier = Modifier.height(16.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                var focused by remember(current.id) { mutableStateOf(false) }
                // Portrait : pilule "Voir" en dégradé de marque plein (esquisse
                // mobile 2026-09). Paysage/TV : bouton "Lire" blanc solide,
                // inchangé — même action (onOpen), seul l'habillage change.
                Surface(
                    onClick = { onOpen(current) },
                    modifier = Modifier
                        .focusRequester(ctaFocusRequester)
                        .tvFocusLift(focused, shape = RoundedCornerShape(6.dp), maxScale = 1.04f, maxElevation = 16.dp)
                        .onFocusChanged { focused = it.isFocused }
                        .tvPointerClick { onOpen(current) },
                    shape = ClickableSurfaceDefaults.shape(shape = RoundedCornerShape(if (compactPortrait) 24.dp else 6.dp)),
                    colors = ClickableSurfaceDefaults.colors(
                        containerColor = if (compactPortrait) Color.Transparent else Color.White,
                        focusedContainerColor = if (compactPortrait) Color.Transparent else Color.White,
                        contentColor = if (compactPortrait) Color.White else Color.Black,
                        focusedContentColor = if (compactPortrait) Color.White else Color.Black,
                    ),
                    border = ClickableSurfaceDefaults.border(
                        focusedBorder = Border(border = androidx.compose.foundation.BorderStroke(2.dp, Color.White), shape = RoundedCornerShape(if (compactPortrait) 24.dp else 6.dp)),
                    ),
                ) {
                    Box(
                        modifier = Modifier.then(
                            if (compactPortrait) Modifier.background(Brush.linearGradient(listOf(MovvizBrand, MovvizBrand2)), RoundedCornerShape(24.dp))
                            else Modifier,
                        ),
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(horizontal = 20.dp, vertical = 10.dp),
                        ) {
                            // Icône vectorielle : le glyphe ▶ rendait en carré
                            // (pas dans Inter).
                            Icon(
                                imageVector = MovvizIconPlay,
                                contentDescription = null,
                                tint = if (compactPortrait) Color.White else Color.Black,
                                modifier = Modifier.size(15.dp),
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = if (compactPortrait) "Voir" else "Lire",
                                style = TextStyle(fontSize = 15.sp, fontWeight = FontWeight.Bold, color = if (compactPortrait) Color.White else Color.Black),
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.width(12.dp))

                // Portrait : pilule "Bande-annonce" en contour (esquisse mobile
                // 2026-09). Paysage/TV : bouton "Plus d'infos", inchangé — même
                // action (onOpen, ouvre la fiche) ; aucune lecture de trailer
                // dédiée n'existe hors fiche détail, donc le libellé reste la
                // seule différence visuelle, pas une nouvelle fonctionnalité.
                var infoFocused by remember(current.id) { mutableStateOf(false) }
                Surface(
                    onClick = { onOpen(current) },
                    modifier = Modifier
                        .tvFocusLift(infoFocused, shape = RoundedCornerShape(if (compactPortrait) 24.dp else 6.dp), maxScale = 1.04f, maxElevation = 16.dp)
                        .onFocusChanged { infoFocused = it.isFocused }
                        .tvPointerClick { onOpen(current) },
                    shape = ClickableSurfaceDefaults.shape(shape = RoundedCornerShape(if (compactPortrait) 24.dp else 6.dp)),
                    colors = ClickableSurfaceDefaults.colors(
                        containerColor = Color.White.copy(alpha = 0.15f),
                        focusedContainerColor = Color.White.copy(alpha = 0.26f),
                        contentColor = Color.White,
                        focusedContentColor = Color.White,
                    ),
                    border = ClickableSurfaceDefaults.border(
                        border = if (compactPortrait) Border(border = androidx.compose.foundation.BorderStroke(1.5.dp, Color.White.copy(alpha = 0.5f)), shape = RoundedCornerShape(24.dp)) else Border.None,
                        focusedBorder = Border(border = androidx.compose.foundation.BorderStroke(2.dp, Color.White.copy(alpha = 0.6f)), shape = RoundedCornerShape(if (compactPortrait) 24.dp else 6.dp)),
                    ),
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(horizontal = 20.dp, vertical = 10.dp),
                    ) {
                        if (compactPortrait) {
                            Icon(
                                imageVector = MovvizIconFilm,
                                contentDescription = null,
                                tint = Color.White,
                                modifier = Modifier.size(14.dp),
                            )
                        } else {
                            // Le glyphe ℹ rendait en carré (pas dans Inter) —
                            // simple pastille "i" dessinée en vectoriel local.
                            Box(
                                modifier = Modifier
                                    .size(16.dp)
                                    .border(1.5.dp, Color.White, RoundedCornerShape(50)),
                                contentAlignment = Alignment.Center,
                            ) {
                                Text(text = "i", style = TextStyle(fontSize = 10.sp, fontWeight = FontWeight.Bold, fontStyle = FontStyle.Italic, color = Color.White))
                            }
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = if (compactPortrait) "Bande-annonce" else "Plus d'infos",
                            style = TextStyle(fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = Color.White),
                        )
                    }
                }

                if (items.size > 1) {
                    Spacer(modifier = Modifier.width(24.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        items.indices.forEach { index ->
                            val active = index == currentIndex
                            Box(
                                modifier = Modifier
                                    .size(if (active) 24.dp else 8.dp, 8.dp)
                                    .clip(RoundedCornerShape(4.dp))
                                    .background(
                                        if (active) Color.White else Color.White.copy(alpha = 0.3f),
                                    ),
                            )
                        }
                    }
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
        style = TextStyle(fontSize = 14.sp, color = MovvizInkDim),
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
private fun AmbientTrailer(
    trailerKeys: List<String>,
    title: String,
    modifier: Modifier = Modifier,
    onPlayingChange: (Boolean) -> Unit = {},
) {
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
            onPlaying = { mainHandler.post { playing = true; onPlayingChange(true) } },
            onError = { mainHandler.post { ready = false; onPlayingChange(false) } },
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
    movieRows: List<com.movviz.nx.mobile.data.MetadataRowDto>,
    seriesRows: List<com.movviz.nx.mobile.data.MetadataRowDto>,
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
 * Même ordre de préférence que TrailerHeader desktop : une source directe
 * offre un démarrage plus net et ne dépend pas du chrome WebView ; YouTube
 * reste le repli silencieux si le flux ne peut pas être lu. Le composable ne
 * vit que sur la carte actuellement focalisée, donc il ne peut ni détourner
 * le focus D-pad ni accumuler des lecteurs en arrière-plan.
 */
@Composable
fun AmbientPreview(
    directSources: List<TrailerSourceDto>,
    trailerKeys: List<String>,
    title: String,
    modifier: Modifier = Modifier,
) {
    // Bug confirmé (retour utilisateur + repro live) : Apple/Netflix/Disney+/
    // Prime Video/IMDb (directSources) matchent par SIMILARITÉ DE TITRE, pas
    // par tmdbId — un identifiant fiable existe pourtant déjà côté TMDb
    // (trailerKeys). Sur "Demon Slayer : Kimetsu no Yaiba La Forteresse
    // Infinie", Prime Video avait accroché une bande-annonce prise de vue
    // réelle (tour de guet, homme en armure) totalement étrangère au film —
    // vérifié : les 2 vraies bandes-annonces TMDb de ce titre sont bien en
    // 2D animée. Le web (TrailerHeader.tsx) ne fait JAMAIS confiance à
    // directSources pour l'aperçu ambiant, exactement pour cette raison
    // ("must never select an ambient preview").
    //
    // Mais couper directSources net a cassé la lecture : sur cet émulateur
    // (et potentiellement certains appareils réels), l'iframe YouTube
    // n'atteint jamais l'état PLAYING (réseau/WebView), laissant l'aperçu
    // figé sur le backdrop — repro confirmée en direct. TMDb (trailerKeys)
    // reste donc tenté EN PREMIER (fiable côté identité), mais un délai
    // ("le temps de laisser sa chance à YouTube") bascule sur directSources
    // si aucune vidéo TMDb n'a réellement démarré — mieux vaut une bande-
    // annonce occasionnellement mal identifiée qu'aucune vidéo du tout.
    var directFailed by remember(directSources) { mutableStateOf(false) }
    var youtubePlaying by remember(trailerKeys) { mutableStateOf(false) }
    var youtubeGaveUp by remember(trailerKeys) { mutableStateOf(trailerKeys.isEmpty()) }
    LaunchedEffect(trailerKeys) {
        if (trailerKeys.isEmpty()) return@LaunchedEffect
        delay(AMBIENT_DIRECT_FALLBACK_TIMEOUT_MS)
        if (!youtubePlaying) youtubeGaveUp = true
    }
    val direct = directSources.firstOrNull { it.url.startsWith("https://") || it.url.startsWith("http://") }
    if (youtubeGaveUp && direct != null && !directFailed) {
        DirectAmbientTrailer(source = direct, modifier = modifier, onError = { directFailed = true })
    } else if (!youtubeGaveUp) {
        AmbientTrailer(
            trailerKeys = trailerKeys,
            title = title,
            modifier = modifier,
            onPlayingChange = { youtubePlaying = it },
        )
    }
}

// Budget total laissé à l'iframe YouTube (delay interne AMBIENT_TRAILER_
// DELAY_MS + chargement de l'API + démarrage réel de la vidéo) avant de
// basculer sur une source directe si elle en a une. Généreux mais borné :
// jamais un aperçu figé indéfiniment faute de réseau/WebView fonctionnel.
private const val AMBIENT_DIRECT_FALLBACK_TIMEOUT_MS = 4500L

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

private fun ambientTrailerHtml(key: String, title: String): String = """
    <!doctype html><html><body style="margin:0;background:transparent;overflow:hidden">
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
) {
    val compactPortrait = androidx.compose.ui.platform.LocalConfiguration.current.let {
        it.screenWidthDp < 600 && it.screenHeightDp > it.screenWidthDp
    }
    // Largeur portrait calculée pour afficher exactement 3 cartes plein cadre
    // comme l'esquisse 01 (avant : 118.dp fixe → 2.5 visibles sur 360dp).
    // Viewport - paddings (16+16) - spacings (2×10) divisé par 3, borné pour
    // les petits (320dp) et grands (430dp+) écrans.
    val configuration = androidx.compose.ui.platform.LocalConfiguration.current
    val portraitCardWidth = if (compactPortrait) {
        // Ajustement exact au viewport : 3 cartes + 2 spacings + paddings =
        // largeur écran, la 4e reste hors champ (pas de plafond max — un
        // coerceIn(.., 120.dp) laissait dépasser un bout de 4e carte sur les
        // écrans larges, constaté sur capture).
        (((configuration.screenWidthDp - 32 - 20) / 3).dp).coerceAtLeast(88.dp)
    } else {
        132.dp
    }
    // État de focus partagé par toutes les cartes — il vit ici (pas dans
    // PosterCard) pour survivre à la destruction des items par la
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
    Column(modifier = Modifier.padding(bottom = 32.dp)) {
        RowHeading(heading)
        TvLazyRow(
            state = rememberTvLazyListState().withTvPrefetchDisabled(),
            modifier = Modifier.focusRestorer(),
            contentPadding = PaddingValues(
                start = if (compactPortrait) 16.dp else 52.dp,
                end = if (compactPortrait) 16.dp else 52.dp,
            ),
            horizontalArrangement = Arrangement.spacedBy(if (compactPortrait) 10.dp else 12.dp),
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
                    focusRequester = if (index == 0) firstItemFocusRequester else null,
                    onFocusedChange = { focused ->
                        focusedCardState.value = if (focused) card else null
                        if (focused) onFocusedCard(card)
                        else onPreviewStateChanged(card.id, false)
                    },
                    // NX reprend le mouvement de la nouvelle interface TV
                    // Netflix : une affiche reste compacte au repos puis la
                    // carte active devient le seul aperçu 16:9 de sa rangée.
                    // Les autres éléments conservent leur gabarit portrait.
                    // Esquisse 01 : 3 cartes plein cadre en portrait — largeur
                    // calculée au-dessus (viewport-32-20)/3. En paysage le
                    // gabarit TV de 132dp est rigoureusement conservé.
                    width = portraitCardWidth,
                    aspectRatio = 2f / 3f,
                    preferPosterArt = true,
                    // Le slot LazyRow ne bouge jamais. La mini-fiche est une
                    // surcouche de rangée (ci-dessous), jamais un reflow.
                    expandToLandscapeOnFocus = true,
                    // La carte active conserve exactement la hauteur de
                    // l'affiche (132 × 3/2 = 198dp) : seul son ratio change.
                    // En 16:9, cela donne 352×198dp, un vrai passage au
                    // paysage plutôt qu'une carte qui rétrécit au focus.
                    expandedWidth = 352.dp,
                    // Sur téléphone aucune affiche n'est anonyme : le titre
                    // reste hors image, donc lisible même sur un poster clair
                    // ou très sombre. La présentation paysage sans légende
                    // demeure identique.
                    showCaption = compactPortrait,
                    showTechnicalBadges = false,
                    titleLogoPath = titleLogoPaths["${if (card.isMovie) "movie" else "series"}-${card.tmdbId}"],
                )
            }
            if (onSeeAll != null) {
                item(contentType = "see-all") { SeeAllTile(onClick = onSeeAll, width = portraitCardWidth) }
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
        val compactPortrait = androidx.compose.ui.platform.LocalConfiguration.current.let {
            it.screenWidthDp < 600 && it.screenHeightDp > it.screenWidthDp
        }
        Text(
            text = text,
            style = MaterialTheme.typography.titleLarge,
            color = MaterialTheme.colorScheme.onBackground,
            modifier = Modifier.padding(start = if (compactPortrait) 16.dp else 52.dp, bottom = 12.dp),
        )
}

/** Dernière affiche de la rangée : indication « voir plus » légère, au format
 * portrait des cartes secondaires. Elle ouvre RowDetailScreen, sans rompre
 * la continuité horizontale par une grosse tuile d'action. */
@Composable
private fun SeeAllTile(onClick: () -> Unit, width: androidx.compose.ui.unit.Dp? = null) {
    var focused by remember { mutableStateOf(false) }
    val compactPortrait = androidx.compose.ui.platform.LocalConfiguration.current.let {
        it.screenWidthDp < 600 && it.screenHeightDp > it.screenWidthDp
    }
    // Même gabarit que les cartes de la rangée en portrait (3 plein cadre),
    // 154.dp historique en paysage/TV.
    val tileWidth = width ?: if (compactPortrait) {
        ((((androidx.compose.ui.platform.LocalConfiguration.current.screenWidthDp - 32 - 20) / 3).dp)).coerceAtLeast(88.dp)
    } else {
        154.dp
    }
    Column(modifier = Modifier.width(tileWidth)) {
        Surface(
            onClick = onClick,
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(2f / 3f)
                .tvCardFocusHalo(focused, shape = MovvizCardShape)
                .onFocusChanged { focused = it.isFocused }
                .tvPointerClick(onClick),
            shape = androidx.tv.material3.ClickableSurfaceDefaults.shape(shape = MovvizCardShape),
            colors = androidx.tv.material3.ClickableSurfaceDefaults.colors(containerColor = MovvizInk.copy(alpha = 0.08f)),
            border = androidx.tv.material3.ClickableSurfaceDefaults.border(
                focusedBorder = Border(
                    border = androidx.compose.foundation.BorderStroke(2.5.dp, Color.White.copy(alpha = 0.85f)),
                    shape = MovvizCardShape,
                ),
            ),
        ) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(text = "+", style = TextStyle(fontSize = 30.sp, fontWeight = FontWeight.Light, color = MovvizInk))
                    Text(text = "Voir plus", style = TextStyle(fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = MovvizInkSoft))
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
    width: androidx.compose.ui.unit.Dp = 230.dp,
    aspectRatio: Float = 16f / 9f,
    preferPosterArt: Boolean = false,
    expandToLandscapeOnFocus: Boolean = false,
    expandedWidth: androidx.compose.ui.unit.Dp = width,
    showCaption: Boolean = true,
    showTechnicalBadges: Boolean = true,
    titleLogoPath: String? = null,
) {
    var focused by remember { mutableStateOf(false) }
    val posterUrl = card.posterPath?.let { "$TMDB_IMAGE_BASE$it" }
    val backdropUrl = card.backdropPath?.let { "$TMDB_BACKDROP_BASE$it" }
    val expanded = focused && expandToLandscapeOnFocus
    // Liseré mauve permanent sur les affiches en portrait (demandé en
    // direct par l'utilisateur en pointant la maquette) — jamais en
    // paysage/TV, qui gardent leur halo de focus D-pad blanc inchangé.
    val compactPortrait = androidx.compose.ui.platform.LocalConfiguration.current.let {
        it.screenWidthDp < 600 && it.screenHeightDp > it.screenWidthDp
    }
    // L'affiche portrait est une image éditoriale fixe, pas un backdrop à
    // zoomer. L'ancienne interpolation largeur+ratio étirait son contenu
    // durant ~220 ms, ce qui donnait un effet "cheap" très visible. La
    // bascule de surface est désormais nette ; l'animation reste réservée
    // au fondu vidéo du paysage, jamais à l'affiche elle-même.
    val renderedWidth = if (expanded) expandedWidth else width
    val renderedAspect = if (expanded) 16f / 9f else aspectRatio
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
            colors = androidx.tv.material3.ClickableSurfaceDefaults.colors(containerColor = MovvizSurfaceStrong),
            border = androidx.tv.material3.ClickableSurfaceDefaults.border(
                border = if (compactPortrait) Border(
                    border = androidx.compose.foundation.BorderStroke(1.5.dp, com.movviz.nx.mobile.ui.theme.MovvizElectricBorder),
                    shape = MovvizCardShape,
                ) else Border.None,
                focusedBorder = Border(
                    border = androidx.compose.foundation.BorderStroke(2.5.dp, Color.White.copy(alpha = 0.85f)),
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
                        painter = rememberAsyncImagePainter(model = activeImage),
                        contentDescription = card.title,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
                    )
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
                            StaticLogoWithGlow(size = 54.dp)
                        }
                    }
                }
                // Le badge S/E est un contexte éditorial d'épisode. Il peut
                // donc apparaître dans « Épisodes récemment ajoutés » comme
                // dans « Continuer à regarder », sans transformer la carte
                // récente en fausse reprise.
                val episodeBadge = card.episodeSeasonNumber != null && card.episodeNumber != null
                if (episodeBadge) {
                    Text(
                        text = "S${card.episodeSeasonNumber.toString().padStart(2, '0')} · E${card.episodeNumber.toString().padStart(2, '0')}",
                        style = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color.White),
                        maxLines = 1,
                        modifier = Modifier
                            .align(Alignment.TopStart)
                            .padding(7.dp)
                            .background(Color.Black.copy(alpha = 0.82f), RoundedCornerShape(5.dp))
                            .padding(horizontal = 7.dp, vertical = 4.dp),
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
                            .height(86.dp)
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
                            .padding(16.dp)
                            .heightIn(max = 54.dp)
                            .widthIn(max = 220.dp),
                    )
                } else if (focused || usesEpisodeResumeArtwork) {
                    // Grilles (catalogue, "voir tout") : contrairement à
                    // TitleRow, qui affiche un bandeau de contexte sous la
                    // rangée pour la carte active, une grille verticale n'a
                    // pas cet espace. Sans repli, un titre sans logo TMDb (ou
                    // dont le logo n'a pas encore fini de charger) restait
                    // muet au focus — rien n'identifiait la carte avant OK.
                    Text(
                        text = card.title,
                        style = TextStyle(
                            fontSize = if (expanded || usesEpisodeResumeArtwork) 18.sp else 9.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                        ),
                        maxLines = if (expanded || usesEpisodeResumeArtwork) 2 else 3,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier
                            .align(Alignment.BottomStart)
                            .padding(12.dp)
                            .background(Color.Black.copy(alpha = 0.52f), RoundedCornerShape(4.dp))
                            .padding(horizontal = if (expanded || usesEpisodeResumeArtwork) 10.dp else 5.dp, vertical = if (expanded || usesEpisodeResumeArtwork) 6.dp else 3.dp)
                            .widthIn(max = if (expanded || usesEpisodeResumeArtwork) 220.dp else 92.dp),
                    )
                }
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
                        modifier = Modifier.align(Alignment.TopStart).padding(5.dp),
                    )
                }
                card.status?.takeIf { showTechnicalBadges && focused }?.let { status ->
                    StatusPill(
                        status = status,
                        modifier = Modifier.align(Alignment.BottomStart).padding(5.dp),
                    )
                }
                // Qualité réelle du fichier (pas TMDb) — même donnée que les
                // badges FHD/4K/HDR de la grille bibliothèque desktop
                // (MediaBadges.tsx), jusqu'ici jamais mappée côté TV.
                if (showTechnicalBadges && focused && card.qualityLabel != null) {
                    Text(
                        text = if (card.hasHdr) "${card.qualityLabel} HDR" else card.qualityLabel,
                        style = TextStyle(fontSize = 9.sp, fontWeight = FontWeight.Bold, color = MovvizInk),
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .padding(5.dp)
                            .background(Color.Black.copy(alpha = 0.6f), RoundedCornerShape(4.dp))
                            .padding(horizontal = 6.dp, vertical = 2.dp),
                    )
                }
                if (card.isResumeCard && card.progressPercent != null) {
                    Box(
                        modifier = Modifier
                            .align(Alignment.BottomStart)
                            .fillMaxWidth()
                            .height(4.dp)
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
                    .padding(top = 6.dp),
            )
            AnimatedVisibility(
                visible = expanded,
                enter = fadeIn(tween(160)) + expandVertically(tween(180)),
                exit = fadeOut(tween(100)) + shrinkVertically(tween(120)),
            ) {
                Column(Modifier.padding(top = 4.dp)) {
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
    Column(modifier = Modifier.padding(bottom = 48.dp)) {
        Text(
            text = "Téléchargements en cours",
            style = MaterialTheme.typography.titleLarge,
            color = MaterialTheme.colorScheme.onBackground,
            modifier = Modifier.padding(start = 64.dp, bottom = 16.dp),
        )
        TvLazyRow(
            state = rememberTvLazyListState().withTvPrefetchDisabled(),
            modifier = Modifier.focusRestorer(),
            contentPadding = PaddingValues(horizontal = 64.dp),
            horizontalArrangement = Arrangement.spacedBy(14.dp),
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
    val shape = RoundedCornerShape(14.dp)

    // Une entrée de file n'est pas un poster tronqué. C'est une carte de
    // travail : artwork à gauche, informations et progression à droite, avec
    // un vrai état de focus qui dit sans ambiguïté qu'elle ouvre la fiche.
    Surface(
        onClick = onClick,
        enabled = clickable,
        modifier = Modifier
            .width(310.dp)
            .height(166.dp)
            .tvFocusLift(focused && clickable, shape = shape)
            .onFocusChanged { focused = it.isFocused }
            .let { if (clickable) it.tvPointerClick(onClick) else it },
        shape = androidx.tv.material3.ClickableSurfaceDefaults.shape(shape = shape),
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
                    .width(108.dp)
                    .fillMaxHeight()
                    .background(Brush.verticalGradient(listOf(MovvizBrand.copy(alpha = 0.35f), MovvizSurfaceStrong.copy(alpha = 0.8f), MovvizSurfaceStrong))),
                contentAlignment = Alignment.Center,
            ) {
                if (posterUrl != null) {
                    Image(
                        painter = rememberAsyncImagePainter(model = posterUrl),
                        contentDescription = item.media.title,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
                    )
                    Box(modifier = Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.2f)))
                } else {
                    Text(
                        text = "↓",
                        style = TextStyle(fontSize = 38.sp, fontWeight = FontWeight.Light, color = Color.White.copy(alpha = 0.85f)),
                    )
                }
            }
            Column(modifier = Modifier.weight(1f).padding(horizontal = 14.dp, vertical = 13.dp)) {
                QueueStatusPill(status = item.status)
                Spacer(modifier = Modifier.height(9.dp))
                Text(
                    text = item.media.title,
                    style = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onBackground),
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(modifier = Modifier.weight(1f))
                Text(
                    text = downloadSubtitle(item),
                    style = TextStyle(fontSize = 12.sp, color = Color.White.copy(alpha = 0.72f)),
                    maxLines = 1,
                )
                Spacer(modifier = Modifier.height(7.dp))
                Box(modifier = Modifier.fillMaxWidth().height(5.dp).background(Color.White.copy(alpha = 0.14f), RoundedCornerShape(50))) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(fraction = item.download.progress.toFloat().coerceIn(0f, 1f))
                            .fillMaxHeight()
                            .background(Brush.horizontalGradient(listOf(MovvizBrand, MovvizBrand2)), RoundedCornerShape(50)),
                    )
                }
                if (clickable) {
                    Spacer(modifier = Modifier.height(5.dp))
                    Text(text = "Ouvrir la fiche", style = TextStyle(fontSize = 10.sp, fontWeight = FontWeight.SemiBold, color = MovvizCyan))
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
            .padding(horizontal = 8.dp, vertical = 3.dp),
    ) {
        Text(text = label, style = TextStyle(fontSize = 10.sp, fontWeight = FontWeight.Bold, color = color))
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
