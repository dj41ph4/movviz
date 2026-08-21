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
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.foundation.lazy.list.TvLazyColumn
import androidx.tv.foundation.lazy.list.TvLazyRow
import androidx.tv.foundation.lazy.list.itemsIndexed
import androidx.tv.material3.Border
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import coil.compose.LocalImageLoader
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
import com.movviz.tv.AppViewModel
import com.movviz.tv.data.QueueItemDto
import com.movviz.tv.ui.theme.MovvizAmber
import com.movviz.tv.ui.theme.MovvizBrand
import com.movviz.tv.ui.theme.MovvizBrand2
import com.movviz.tv.ui.theme.MovvizCardShape
import com.movviz.tv.ui.theme.MovvizCyan
import com.movviz.tv.ui.theme.MovvizDown
import com.movviz.tv.ui.theme.MovvizInk
import com.movviz.tv.ui.theme.MovvizInkDim
import com.movviz.tv.ui.theme.MovvizInkSoft
import com.movviz.tv.ui.theme.MovvizOk
import com.movviz.tv.ui.theme.MovvizSurfaceStrong
import com.movviz.tv.ui.theme.StaticLogoWithGlow
import com.movviz.tv.ui.theme.RatingBadge
import com.movviz.tv.ui.theme.StatusPill
import com.movviz.tv.ui.theme.tvFocusLift
import com.movviz.tv.ui.theme.tvPointerClick
import kotlinx.coroutines.delay

private const val TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500"
// w1280, PAS "original" : un backdrop plein Ã©cran en "original" tÃ©lÃ©charge
// jusqu'Ã  4000px de large (plusieurs Mo dÃ©codÃ©s en bitmap complet) pour un
// Ã©cran TV 1080p qui n'en montre que 1920px â€” le gaspillage rÃ©seau/mÃ©moire
// Ã©tait visible sur Chromecast 4K. Netflix/Apple TV servent du 1080p max.
private const val TMDB_BACKDROP_BASE = "https://image.tmdb.org/t/p/w1280"
private const val HERO_ROTATE_MS = 8_000L
private const val HERO_COUNT = 5

/** Intervalle de rafraÃ®chissement de la file de tÃ©lÃ©chargement sur l'accueil
 *  â€” plus lÃ¢che que le polling 500ms de QueueTab.tsx (fait pour un tableau
 *  admin dense) : ici c'est juste une rangÃ©e parmi d'autres, pas l'Ã©cran
 *  principal de suivi, donc pas besoin de la mÃªme frÃ©quence. */
private const val QUEUE_POLL_INTERVAL_MS = 8000L

/** Titre unifiÃ© film/sÃ©rie pour l'affichage des rangÃ©es et du hero â€” Ã©vite de
 *  dupliquer la Card pour deux types quasi identiques Ã  l'Ã©cran. `internal`
 *  (pas `private`) : TitleDetailScreen rÃ©utilise TvTitleCard/TitleRow/
 *  PosterCard telles quelles pour sa rangÃ©e "Titres similaires", mÃªme style
 *  visuel que l'accueil plutÃ´t qu'une variante dupliquÃ©e. `status` est null
 *  pour les sÃ©ries : contrairement aux films, l'API ne renvoie aucun champ de
 *  statut au niveau sÃ©rie (voir le commentaire sur LibrarySeriesDto) donc la
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
    /** Non-null uniquement pour une carte "Continuer Ã  regarder" â€” affiche
     *  une fine barre de progression en bas du poster. */
    val progressPercent: Int? = null,
    /** "4K"/"1080p"/... â€” voir resolutionLabel(). Absent pour tout ce qui
     *  n'a pas de fichier rÃ©el en bibliothÃ¨que (sÃ©ries, dÃ©couverte). */
    val qualityLabel: String? = null,
    val hasHdr: Boolean = false,
    val overview: String = "",
    val runtime: Int? = null,
    val trailerKeys: List<String> = emptyList(),
    /** Non-null uniquement pour une carte "Continuer Ã  regarder" d'une
     *  sÃ©rie â€” Ã©pisode prÃ©cis en cours, pour ouvrir directement dessus au
     *  lieu de retomber sur la saison 1 (voir onOpenEpisode). */
    val resumeSeasonNumber: Int? = null,
    val resumeEpisodeNumber: Int? = null,
)

@Composable
fun HomeScreen(
    viewModel: AppViewModel,
    onOpenTitle: (type: String, tmdbId: Int) -> Unit,
    onOpenEpisode: (tmdbId: Int, season: Int, episode: Int) -> Unit = { _, _, _ -> },
    // Cible D-pad Â« flÃ¨che bas depuis la NavRail Â» (voir MainScreen/NavRail)
    // â€” attachÃ©e plus bas au mÃªme Ã©lÃ©ment que le focus initial (CTA hero ou
    // premiÃ¨re carte, les deux sont mutuellement exclusifs), jamais appelÃ©e
    // automatiquement ici : elle ne sert que de destination quand l'utilisateur
    // appuie rÃ©ellement sur bas depuis la nav.
    entryFocusRequester: FocusRequester? = null,
) {
    val movies by viewModel.movies.collectAsState()
    val series by viewModel.series.collectAsState()
    val continueWatching by viewModel.continueWatching.collectAsState()
    val queue by viewModel.queue.collectAsState()
    val trendingMovies by viewModel.trendingMovies.collectAsState()
    val trendingSeries by viewModel.trendingSeries.collectAsState()
    val movieRows by viewModel.movieRows.collectAsState()
    val seriesRows by viewModel.seriesRows.collectAsState()
    val dashboardHero by viewModel.dashboardHero.collectAsState()
    val heroLogos by viewModel.heroLogos.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.loadLibrary()
        delay(200)
        viewModel.loadContinueWatching()
        delay(200)
        viewModel.loadDiscovery()
        delay(200)
        viewModel.loadDashboardHero()
    }

    // La file de tÃ©lÃ©chargement change en continu (vitesse/progression) tant
    // que l'accueil est visible â€” seule rangÃ©e avec un polling actif, les
    // autres (bibliothÃ¨que/dÃ©couverte/reprise) sont chargÃ©es une fois et ne
    // bougent pas seconde par seconde.
    LaunchedEffect(Unit) {
        while (true) {
            viewModel.loadQueue()
            delay(QUEUE_POLL_INTERVAL_MS)
        }
    }

    val recentMovies = remember(movies) {
        movies.take(20).map {
TvTitleCard(
                    it.tmdbId.toString(), it.title, it.posterPath, it.backdropPath, it.tmdbId, isMovie = true,
                    year = it.year, rating = it.rating, genres = it.genres, status = it.status,
                    // overview sert au call-out Netflix sous la rangÃ©e (synopsis
                    // 1 ligne) â€” dÃ©jÃ  renvoyÃ© par /api/library/movies.
                    overview = it.overview,
                    qualityLabel = resolutionLabel(it.file?.resolution), hasHdr = !it.file?.hdr.isNullOrBlank(),
                )
        }
    }
    val recentSeries = remember(series) {
        series.take(20).map {
            TvTitleCard(it.tmdbId.toString(), it.title, it.posterPath, it.backdropPath, it.tmdbId, isMovie = false, year = it.year, rating = it.rating, genres = it.genres, overview = it.overview, status = null)
        }
    }
    val continueCards = remember(continueWatching) {
        continueWatching.map {
            TvTitleCard(
                id = "cw-${it.type}-${it.tmdbId}-${it.seasonNumber}-${it.episodeNumber}",
                title = it.title ?: "â€”",
                posterPath = it.posterPath,
                backdropPath = null,
                tmdbId = it.tmdbId,
                isMovie = it.type == "movie",
                progressPercent = it.progressPercent,
                resumeSeasonNumber = it.seasonNumber,
                resumeEpisodeNumber = it.episodeNumber,
            )
        }
    }
    // DÃ©couverte â€” tendances TMDb pas encore dans la bibliothÃ¨que locale.
    // Le filtrage se refait Ã  chaque recomposition de movies/series pour
    // qu'un ajout depuis la fiche titre fasse disparaÃ®tre la carte de cette
    // rangÃ©e sans nouvel appel rÃ©seau (mÃªmes listes dÃ©jÃ  chargÃ©es).
    val ownedMovieIds = remember(movies) { movies.map { it.tmdbId }.toSet() }
    val ownedSeriesIds = remember(series) { series.map { it.tmdbId }.toSet() }
    val discoverCards = remember(trendingMovies, trendingSeries, ownedMovieIds, ownedSeriesIds) {
        val moviesRow = trendingMovies.filter { it.tmdbId !in ownedMovieIds }
            .map { TvTitleCard(it.tmdbId.toString(), it.title, it.posterPath, null, it.tmdbId, isMovie = true) }
        val seriesRow = trendingSeries.filter { it.tmdbId !in ownedSeriesIds }
            .map { TvTitleCard(it.tmdbId.toString(), it.title, it.posterPath, null, it.tmdbId, isMovie = false) }
        // AlternÃ© plutÃ´t que "tous les films puis toutes les sÃ©ries" â€” une
        // rangÃ©e DÃ©couverte doit ressembler Ã  un mÃ©lange Ã©ditorial, pas Ã 
        // une simple concatÃ©nation de deux listes.
        moviesRow.zipInterleave(seriesRow).take(20)
    }

    // Les mÃªmes rangÃ©es Ã©ditoriales que le dashboard desktop. Elles arrivent
    // dÃ©jÃ  ordonnÃ©es depuis /api/metadata/rows : la TV ne fabrique donc pas
    // de faux contenus et reste cohÃ©rente avec les prÃ©fÃ©rences du serveur.
    val editorialCards = remember(movieRows, seriesRows) {
        (movieRows + seriesRows).mapNotNull { row ->
            val cards = row.results.map {
                TvTitleCard("editorial-${row.key}-${it.type}-${it.tmdbId}", it.title, it.posterPath, null,
                    it.tmdbId, it.type == "movie", it.year, it.rating)
            }
            if (cards.isEmpty()) null else row.key to cards
        }
    }

    // MÃªme sÃ©lection personnalisÃ©e que le dashboard web : trailerKeys,
    // synopsis et statut viennent de /api/dashboard/hero. Le tri local reste
    // un repli instantanÃ© pendant le chargement ou hors-ligne.
    val heroItems = remember(dashboardHero, recentMovies, recentSeries) {
        dashboardHero.map { slide ->
            val detail = slide.detail
            TvTitleCard(
                id = "hero-${detail.type}-${detail.tmdbId}",
                title = detail.title,
                posterPath = detail.posterPath,
                backdropPath = detail.backdropPath,
                tmdbId = detail.tmdbId,
                isMovie = detail.type == "movie",
                year = detail.year,
                rating = detail.rating,
                genres = detail.genres,
                status = slide.libraryStatus,
                overview = detail.overview,
                runtime = detail.runtime,
                trailerKeys = detail.trailerKeys,
            )
        }.filter { it.backdropPath != null }.take(HERO_COUNT).ifEmpty {
            (recentMovies + recentSeries)
                .filter { it.backdropPath != null }
                .sortedByDescending { it.rating }
                .take(HERO_COUNT)
        }
    }

    var heroIndex by remember { mutableStateOf(0) }
    val activeHero = heroItems.getOrNull(heroIndex.coerceIn(0, (heroItems.size - 1).coerceAtLeast(0)))
    // Précharge les logos de TOUTES les vedettes dès que la liste change
    // (plutôt que de charger uniquement le hero actif au fil des rotations).
    // Sans ça, les 4 autres heroes restaient sans logo pendant le premier
    // cycle complet (40 s) et le timer 3 s du fallback texte se déclenchait
    // systématiquement — d'où le chargement à 1 chance sur 3.
    LaunchedEffect(heroItems) {
        val movieIds = heroItems.filter { it.isMovie }.map { it.tmdbId }
        val seriesIds = heroItems.filter { !it.isMovie }.map { it.tmdbId }
        if (movieIds.isNotEmpty()) viewModel.loadHeroLogos("movie", movieIds)
        if (seriesIds.isNotEmpty()) viewModel.loadHeroLogos("series", seriesIds)
    }
    LaunchedEffect(heroItems) {
        if (heroItems.size < 2) return@LaunchedEffect
        while (true) {
            delay(HERO_ROTATE_MS)
            heroIndex = (heroIndex + 1) % heroItems.size
        }
    }

    // Le héros reste au repos visuel au démarrage. Demander immédiatement le
    // focus au CTA fait dÃ©clencher le scroll-into-view de TvLazyColumn et
    // pousse le logo sous la barre transparente avant toute action utilisateur.
    // Le CTA reste focusable : il est atteint naturellement avec DPAD_DOWN
    // depuis la navigation, sans dÃ©placer l'accueil tout seul.
    // Une seule cible pour le CTA hero ET la premiÃ¨re carte : les deux
    // branches ci-dessous sont mutuellement exclusives (jamais de hero ET de
    // firstRealRowKey en mÃªme temps), donc rÃ©utiliser le mÃªme FocusRequester
    // le fait toujours pointer vers le seul Ã©lÃ©ment rÃ©ellement composÃ© â€” et
    // c'est cette mÃªme cible que la NavRail vise pour la flÃ¨che bas.
    val heroCtaFocus = entryFocusRequester ?: remember { FocusRequester() }
    val firstCardFocus = heroCtaFocus
    var hasRequestedInitialFocus by remember { mutableStateOf(false) }
    LaunchedEffect(heroItems, continueCards, recentMovies, recentSeries) {
        if (hasRequestedInitialFocus) return@LaunchedEffect
        if (heroItems.isNotEmpty()) {
            hasRequestedInitialFocus = true
        } else if (continueCards.isNotEmpty() || recentMovies.isNotEmpty() || recentSeries.isNotEmpty()) {
            hasRequestedInitialFocus = true
            firstCardFocus.requestFocus()
        }
    }
    // La toute premiÃ¨re rangÃ©e rÃ©ellement affichÃ©e (Continuer > Films >
    // SÃ©ries, dans l'ordre oÃ¹ elles sont composÃ©es ci-dessous) est la seule
    // Ã  recevoir le focus initial quand il n'y a pas de hero â€” sinon deux
    // rangÃ©es se disputeraient le mÃªme FocusRequester au premier rendu.
    val firstRealRowKey = when {
        continueCards.isNotEmpty() -> "continue"
        recentMovies.isNotEmpty() -> "movies"
        recentSeries.isNotEmpty() -> "series"
        else -> null
    }

    Box(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        TvLazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 80.dp),
        ) {
            if (heroItems.isNotEmpty()) {
                item(contentType = "hero") {
                    HeroCarousel(
                        items = heroItems,
                        currentIndex = heroIndex,
                        logoPath = activeHero?.let { heroLogos["${if (it.isMovie) "movie" else "series"}-${it.tmdbId}"] },
                        onSelectIndex = { heroIndex = it },
                        ctaFocusRequester = heroCtaFocus,
                        onOpen = { card -> onOpenTitle(if (card.isMovie) "movie" else "series", card.tmdbId) },
                    )
                }
            }

            if (queue.isNotEmpty()) {
                item(contentType = "row") { DownloadQueueRow(items = queue, onOpenTitle = onOpenTitle) }
            }

            if (continueCards.isNotEmpty()) {
                item(contentType = "row") {
                    TitleRow(
                        heading = "Continuer Ã  regarder",
                        items = continueCards,
                        onClick = { card ->
                            val season = card.resumeSeasonNumber
                            val episode = card.resumeEpisodeNumber
                            if (!card.isMovie && season != null && episode != null) {
                                onOpenEpisode(card.tmdbId, season, episode)
                            } else {
                                onOpenTitle(if (card.isMovie) "movie" else "series", card.tmdbId)
                            }
                        },
                        firstItemFocusRequester = if (heroItems.isEmpty() && firstRealRowKey == "continue") firstCardFocus else null,
                    )
                }
            }

            if (recentMovies.isNotEmpty()) {
                item(contentType = "row") {
                    TitleRow(
                        heading = "Films",
                        items = recentMovies,
                        onClick = { card -> onOpenTitle("movie", card.tmdbId) },
                        firstItemFocusRequester = if (heroItems.isEmpty() && firstRealRowKey == "movies") firstCardFocus else null,
                    )
                }
            }

            if (recentSeries.isNotEmpty()) {
                item(contentType = "row") {
                    TitleRow(
                        heading = "SÃ©ries",
                        items = recentSeries,
                        onClick = { card -> onOpenTitle("series", card.tmdbId) },
                        firstItemFocusRequester = if (heroItems.isEmpty() && firstRealRowKey == "series") firstCardFocus else null,
                    )
                }
            }

            if (discoverCards.isNotEmpty()) {
                item(contentType = "row") {
                    TitleRow(
                        heading = "DÃ©couverte",
                        items = discoverCards,
                        onClick = { card -> onOpenTitle(if (card.isMovie) "movie" else "series", card.tmdbId) },
                    )
                }
            }

            editorialCards.forEach { (key, cards) ->
                item(contentType = "row") {
                    TitleRow(
                        heading = homeRowLabel(key),
                        items = cards,
                        onClick = { card -> onOpenTitle(if (card.isMovie) "movie" else "series", card.tmdbId) },
                    )
                }
            }

            if (recentMovies.isEmpty() && recentSeries.isEmpty()) {
                item(contentType = "loading") {
                    // Prend le focus (firstCardFocus == contentFocusRequester) au lieu
                    // de laisser MainScreen retomber sur son ancre invisible : cet
                    // Ã©cran de chargement a dÃ©sormais une vraie cible visible et
                    // focusable, plutÃ´t qu'un texte statique inerte.
                    Box(
                        modifier = Modifier.fillMaxWidth().padding(top = 48.dp, bottom = 24.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Box(
                                modifier = if (heroItems.isEmpty() && firstRealRowKey == null) {
                                    // Rien d'autre Ã  l'Ã©cran ne dispute firstCardFocus dans
                                    // ce cas prÃ©cis (voir firstRealRowKey ci-dessus) â€” seule
                                    // cible rÃ©elle et visible au tout premier rendu, plus
                                    // besoin de retomber sur l'ancre invisible de MainScreen.
                                    Modifier.focusRequester(firstCardFocus).focusable()
                                } else {
                                    Modifier
                                },
                            ) {
                                AnimatedLogo(size = 64.dp)
                            }
                            Text(
                                text = "Chargement de ta bibliothÃ¨queâ€¦",
                                style = MaterialTheme.typography.bodyMedium.copy(color = MaterialTheme.colorScheme.onBackground.copy(alpha = .7f)),
                                modifier = Modifier.padding(top = 16.dp),
                            )
                        }
                    }
                }
            }
        }
    }
}

private fun homeRowLabel(key: String): String = when (key) {
    "recommendedTop" -> "SÃ©lection pour vous"
    "trendingPopular", "trending" -> "Tendances Movviz"
    "upcoming", "upcomingVod" -> "Prochainement"
    "onAir" -> "En ce moment"
    "newSeriesRenewed" -> "Nouvelles sÃ©ries"
    "nowPlayingBoxOffice" -> "En salles"
    "kids" -> "Jeunesse"
    else -> key.replace(Regex("([a-z])([A-Z])"), "$1 $2").replaceFirstChar { it.uppercase() }
}

/** MÃªme mapping que la pastille rÃ©solution desktop (MediaBadges.tsx) : 2160â†’4K,
 *  4320â†’8K, 1080/720 en toutes lettres, sinon la valeur brute â€” jamais le
 *  "2160p" cru. null si aucun fichier rÃ©el (pas encore en bibliothÃ¨que). */
private fun resolutionLabel(resolution: String?): String? = when {
    resolution == null -> null
    resolution.startsWith("2160") -> "4K"
    resolution.startsWith("4320") -> "8K"
    resolution.startsWith("1080") -> "1080p"
    resolution.startsWith("720") -> "720p"
    else -> resolution
}

/** Fusion en alternance ([a1,b1,a2,b2,...]) â€” pas d'appariement strict par
 *  index, continue de piocher dans la liste la plus longue une fois l'autre
 *  Ã©puisÃ©e. */
private fun <T> List<T>.zipInterleave(other: List<T>): List<T> {
    val out = ArrayList<T>(size + other.size)
    val max = maxOf(size, other.size)
    for (i in 0 until max) {
        if (i < size) out.add(this[i])
        if (i < other.size) out.add(other[i])
    }
    return out
}

/** Vedette plein Ã©cran en rotation automatique â€” backdrop en Ken Burns lent,
 *  titre/mÃ©ta, CTA "Voir la fiche" et indicateurs de progression dÃ©coratifs,
 *  faÃ§on banniÃ¨re "Featured" Netflix plutÃ´t que le simple aplat statique
 *  d'avant. */
@Composable
internal fun HeroCarousel(
    items: List<TvTitleCard>,
    currentIndex: Int,
    logoPath: String?,
    onSelectIndex: (Int) -> Unit,
    ctaFocusRequester: FocusRequester,
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

    // --- Ultra hero : texte rÃ©vÃ©lÃ© en fondu + glissement Ã  chaque rotation.
    // Seule la zone texte est animÃ©e ; le CTA reste stable en dessous pour
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

    // --- Ultra hero : scrim adaptatif Ã  la luminositÃ© rÃ©elle du backdrop.
    // Moyenne de luminance pondÃ©rÃ©e (Rec. 709), calculÃ©e une fois par image
    // via un Ã©chantillon 64x36, mise en cache : backdrop sombre â†’ scrim
    // lÃ©ger (l'image porte sa propre lisibilitÃ©), backdrop clair â†’ scrim
    // renforcÃ©. Un dÃ©gradÃ© statique rendait les titres clairs illisibles et
    // surassombrissait les plans de nuit.
    var scrimAlpha by remember(current.id) { mutableStateOf(0.55f) }
    val animatedScrimAlpha by animateFloatAsState(scrimAlpha, tween(600), label = "hero_scrim_alpha")
    val context = LocalContext.current
    val imageLoader = LocalImageLoader.current
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

    // --- Ultra hero : prÃ©charge prÃ©dictive des 2 prochains backdrops dÃ¨s la
    // rotation â€” au lieu de charger pendant le crossfade (pop-in/flou).
    // MÃªme cache mÃ©moire Coil que l'affichage ; aprÃ¨s le premier passage le
    // disque sert de source, aucun rÃ©seau en plus.
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

    // Hero height ~65% of 1080p TV screen (780dp). Netflix-style: hero
    // dominates the screen, content rows peek below.
    Box(modifier = Modifier.fillMaxWidth().height(780.dp).clipToBounds()) {
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
                // le hero est affichÃ©) force une recomposition du composable
                // Image Ã  CHAQUE frame Choreographer, en boucle infinie â€”
                // mesurÃ© : 61,71% de frames janky Ã  l'accueil totalement
                // inactif (dumpsys gfxinfo, 700 frames/26s). graphicsLayer{}
                // lit le State uniquement en phase de dessin (juste un
                // re-layer, pas de recomposition), le zoom Ken Burns reste
                // fluide sans repasser par toute la composition Ã  60fps.
                modifier = Modifier.fillMaxSize().graphicsLayer { scaleX = zoom; scaleY = zoom },
            )
        }

        AmbientTrailer(
            trailerKeys = current.trailerKeys,
            title = current.title,
            modifier = Modifier.fillMaxSize(),
        )

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

        // Grain cinÃ©ma : un lÃ©ger bruit photo par-dessus image et vidÃ©o,
        // signature visuelle des apps premium (Netflix/Apple TV en posent
        // un trÃ¨s discret). Bitmap gÃ©nÃ©rÃ© UNE FOIS par process et Ã©talÃ© en
        // TileMode.Repeat via un shader Android natif â€” un seul draw call
        // par frame, coÃ»t nÃ©gligeable pour l'effet obtenu. (Le Paint natif
        // est requis : les shaders Compose n'existent pas dans cette
        // version de Compose TV â€” see nativeCanvas.)
        val grainBitmap = remember { createFilmGrain() }
        val grainPaint = remember {
            android.graphics.Paint().apply {
                isAntiAlias = false
                shader = android.graphics.BitmapShader(
                    grainBitmap,
                    android.graphics.Shader.TileMode.REPEAT,
                    android.graphics.Shader.TileMode.REPEAT,
                )
                alpha = 26
            }
        }
        Box(
            modifier = Modifier
                .fillMaxSize()
                .drawBehind {
                    drawContext.canvas.nativeCanvas.drawRect(0f, 0f, size.width, size.height, grainPaint)
                },
        )

        Column(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .offset(y = (-180).dp)
                .padding(start = 64.dp, end = 48.dp, bottom = 20.dp)
                .widthIn(max = 760.dp),
        ) {
            // Zone texte animÃ©e en fondu + glissement Ã  chaque rotation.
            // Le CTA (plus bas) reste HORS de cette colonne : le focus D-pad
            // initial atterrit dessus, l'animation ne doit pas le perturber.
            Column(
                modifier = Modifier
                    .alpha(textAlpha)
                    .offset(y = textSlide.dp),
            ) {
            Text(
                text = "Ã€ LA UNE  Â·  " + if (current.isMovie) "FILM" else "SÃ‰RIE",
                style = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color.White.copy(alpha = 0.7f), letterSpacing = 2.5.sp),
            )
            Spacer(modifier = Modifier.height(8.dp))
            if (logoPath != null) {
                Image(
                    painter = rememberAsyncImagePainter(model = "https://image.tmdb.org/t/p/w500$logoPath"),
                    contentDescription = current.title,
                    contentScale = ContentScale.Fit,
                    alignment = Alignment.CenterStart,
                    // PAS d'offset x nÃ©gatif ici : un -140dp Ã©tait appliquÃ© Ã 
                    // tous les logos pour recentrer un asset TMDb prÃ©cis dont
                    // la marge transparente Ã  gauche Ã©tait inhabituellement
                    // large â€” mais la plupart des logos TMDb sont dÃ©jÃ 
                    // recadrÃ©s au plus prÃ¨s, donc ce dÃ©calage aveugle les
                    // poussait hors de l'Ã©cran Ã  gauche (confirmÃ© en direct :
                    // "Jackass: Best and Last" et "Les aventures de Porcinet"
                    // tous deux tronquÃ©s, contentDescription visible via
                    // uiautomator dump mais premiers caractÃ¨res hors-Ã©cran).
                    modifier = Modifier
                        .heightIn(max = 120.dp)
                        .width(560.dp),
                )
            } else if (showTitleFallback) {
                Text(
                    text = current.title,
                    style = TextStyle(fontSize = 48.sp, fontWeight = FontWeight.Black, color = MovvizInk, lineHeight = 52.sp),
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            } else {
                // RÃ©serve la place du logo pendant son chargement : aucun
                // titre texte ne clignote avant de laisser sa place au logo.
                Spacer(modifier = Modifier.height(120.dp).widthIn(max = 560.dp))
            }
            Spacer(modifier = Modifier.height(8.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (current.rating > 0) {
                    Text(text = "â˜… ${"%.1f".format(current.rating)}", style = TextStyle(fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Color(0xFFF5C542)))
                    Spacer(modifier = Modifier.width(12.dp))
                }
                current.year?.let {
                    Text(text = "$it", style = TextStyle(fontSize = 14.sp, fontWeight = FontWeight.Medium, color = MovvizInkSoft))
                    Spacer(modifier = Modifier.width(12.dp))
                }
                current.runtime?.let {
                    Text(text = "$it min", style = TextStyle(fontSize = 14.sp, color = MovvizInkSoft))
                }
            }
            if (current.genres.isNotEmpty()) {
                Spacer(modifier = Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    current.genres.take(3).forEach { genre ->
                        Box(
                            modifier = Modifier
                                .background(Color.White.copy(alpha = 0.08f), RoundedCornerShape(50))
                                .border(1.dp, Color.White.copy(alpha = 0.12f), RoundedCornerShape(50))
                                .padding(horizontal = 16.dp, vertical = 7.dp),
                        ) {
                            Text(text = genre, style = TextStyle(fontSize = 14.sp, fontWeight = FontWeight.Medium, color = MovvizInkSoft))
                        }
                    }
                }
            }
            if (current.overview.isNotBlank()) {
                Spacer(modifier = Modifier.height(10.dp))
                Box(modifier = Modifier.widthIn(max = 580.dp)) {
                    Text(
                        text = current.overview,
                        style = TextStyle(fontSize = 14.sp, color = MovvizInkSoft, lineHeight = 21.sp),
                        maxLines = 3,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Box(
                        modifier = Modifier
                            .matchParentSize()
                            .background(
                                Brush.verticalGradient(
                                    colors = listOf(Color.Transparent, MaterialTheme.colorScheme.background),
                                    startY = 0f,
                                ),
                            ),
                    )
                }
            }
            }
            Spacer(modifier = Modifier.height(16.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                var focused by remember(current.id) { mutableStateOf(false) }
                // Netflix-style "Lire" button â€” white solid, bold.
                Surface(
                    onClick = { onOpen(current) },
                    modifier = Modifier
                        .focusRequester(ctaFocusRequester)
                        .tvFocusLift(focused, shape = RoundedCornerShape(6.dp), maxScale = 1.04f, maxElevation = 16.dp)
                        .onFocusChanged { focused = it.isFocused }
                        .tvPointerClick { onOpen(current) },
                    shape = ClickableSurfaceDefaults.shape(shape = RoundedCornerShape(6.dp)),
                    colors = ClickableSurfaceDefaults.colors(containerColor = Color.White, contentColor = Color.Black),
                    border = ClickableSurfaceDefaults.border(
                        focusedBorder = Border(border = androidx.compose.foundation.BorderStroke(2.dp, Color.White), shape = RoundedCornerShape(6.dp)),
                    ),
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(horizontal = 28.dp, vertical = 12.dp),
                    ) {
                        Text(text = "â–¶", style = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Color.Black))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(text = "Lire", style = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Color.Black))
                    }
                }

                Spacer(modifier = Modifier.width(12.dp))

                // "Plus d'infos" button â€” dark glass, secondary action.
                var infoFocused by remember(current.id) { mutableStateOf(false) }
                Surface(
                    onClick = { onOpen(current) },
                    modifier = Modifier
                        .tvFocusLift(infoFocused, shape = RoundedCornerShape(6.dp), maxScale = 1.04f, maxElevation = 16.dp)
                        .onFocusChanged { infoFocused = it.isFocused }
                        .tvPointerClick { onOpen(current) },
                    shape = ClickableSurfaceDefaults.shape(shape = RoundedCornerShape(6.dp)),
                    colors = ClickableSurfaceDefaults.colors(containerColor = Color.White.copy(alpha = 0.15f), contentColor = Color.White),
                    border = ClickableSurfaceDefaults.border(
                        focusedBorder = Border(border = androidx.compose.foundation.BorderStroke(2.dp, Color.White.copy(alpha = 0.6f)), shape = RoundedCornerShape(6.dp)),
                    ),
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(horizontal = 24.dp, vertical = 12.dp),
                    ) {
                        Text(text = "â„¹", style = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Color.White))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(text = "Plus d'infos", style = TextStyle(fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = Color.White))
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

/** DÃ©lai avant le lancement du trailer ambiant (ms) â€” Netflix laisse
 * ~2-3s le temps au backdrop Ken Burns de s'installer avant de lancer
 * la bande-annonce. */
private const val AMBIENT_TRAILER_DELAY_MS = 2_200L

/** Variante TV de TrailerHeader : le backdrop reste la couche de base, et
 * l'iframe YouTube muette ne devient visible qu'aprÃ¨s l'Ã©vÃ©nement PLAYING.
 * Une vidÃ©o bloquÃ©e ou un rÃ©seau absent laisse donc exactement l'image de
 * fond, sans chrome YouTube ni perte du focus D-pad.
 *
 * Comportement Netflix : le trailer ne se lance qu'aprÃ¨s un dÃ©lai de
 * ~2.2s pour laisser l'utilisateur admirer le backdrop Ken Burns ;
 * une fois lancÃ©, le fade-in est doux (400ms) au lieu du snap binaire
 * d'avant. */
@Composable
private fun AmbientTrailer(trailerKeys: List<String>, title: String, modifier: Modifier = Modifier) {
    val key = trailerKeys.firstOrNull { it.matches(Regex("[A-Za-z0-9_-]{6,}")) } ?: return
    val context = LocalContext.current
    val activityManager = remember { context.getSystemService(android.content.Context.ACTIVITY_SERVICE) as android.app.ActivityManager }
    val memInfo = remember { android.app.ActivityManager.MemoryInfo() }
    activityManager.getMemoryInfo(memInfo)
    if (memInfo.totalMem < 4L * 1024 * 1024 * 1024) return
    var ready by remember(key) { mutableStateOf(false) }
    var playing by remember(key) { mutableStateOf(false) }
    val mainHandler = remember { Handler(Looper.getMainLooper()) }
    val bridge = remember(key) {
        AmbientTrailerBridge(
            onPlaying = { mainHandler.post { playing = true } },
            onError = { mainHandler.post { ready = false } },
        )
    }

    // DÃ©lai avant le lancement du trailer â€” Netflix laisse ~2-3s le temps
    // au backdrop Ken Burns de s'installer avant de lancer la bande-annonce.
    // `ready` passe Ã  true aprÃ¨s le dÃ©lai, ce qui dÃ©clenche le chargement
    // de la WebView. Si la clÃ© change pendant le dÃ©lai, l'ancien LaunchedEffect
    // est annulÃ© proprement.
    LaunchedEffect(key) {
        playing = false
        ready = false
        delay(AMBIENT_TRAILER_DELAY_MS)
        ready = true
    }

    // Fade-in doux quand le trailer commence Ã  jouer â€” au lieu du snap
    // binaire alpha=0â†’1, on anime sur 400ms pour une transition Netflix-like.
    val trailerAlpha by animateFloatAsState(
        targetValue = if (playing) 1f else 0f,
        animationSpec = tween(
            durationMillis = if (playing) 400 else 250,
        ),
        label = "trailer_alpha",
    )

    // LA MÃŠME WebView sert pendant toute la durÃ©e du hero : le factory ne
    // capture rien (donc stable â€” AndroidView garde la vue) et chaque
    // rotation recharge juste la vidÃ©o via update. Avant ce correctif : une
    // WebView NEUVE Ã  chaque rotation, jamais dÃ©truite â€” les moteurs
    // s'empilaient en mÃ©moire (fuite visible sur Chromecast 4K) et chaque
    // rotation payait la crÃ©ation du moteur + le rechargement de l'iframe
    // API YouTube (jank au moment du changement).
    if (ready) {
        AndroidView(
            factory = { ctx: Context -> TrailerWebViewPool.obtain(ctx) },
            update = { view -> TrailerWebViewPool.prepare(view, key, title, bridge) },
            onRelease = { view -> TrailerWebViewPool.release(view) },
            modifier = modifier.graphicsLayer { alpha = trailerAlpha },
        )
    }
}

private class AmbientTrailerBridge(
    private val onPlaying: () -> Unit,
    private val onError: () -> Unit = {},
) {
    @JavascriptInterface fun playing() = onPlaying()
    @JavascriptInterface fun error() = onError()
}

/** Pool de WebViews de bandes-annonces ambiantes : maximum 2 instances
 *  vivantes (une Ã  l'Ã©cran, une au repos), aucune crÃ©ation/destruction Ã 
 *  chaque rotation du hero. La prÃ©paration est idempotente : update est
 *  appelÃ© Ã  chaque recomposition, prepare ne recharge la vidÃ©o que si la
 *  clÃ© (trailer) a changÃ©. */
@SuppressLint("SetJavaScriptEnabled")
private object TrailerWebViewPool {
    private val idle = ArrayDeque<WebView>()
    private const val MAX_IDLE = 2

    fun obtain(context: Context): WebView =
        idle.removeLastOrNull() ?: WebView(context).apply {
            setBackgroundColor(AndroidColor.TRANSPARENT)
            isFocusable = false
            isFocusableInTouchMode = false
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            webChromeClient = WebChromeClient()
            webViewClient = WebViewClient()
        }

    fun release(view: WebView) {
        view.stopLoading()
        view.removeJavascriptInterface("MovvizAmbient")
        if (idle.size < MAX_IDLE) idle.addLast(view) else view.destroy()
    }

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
                // RedÃ©marrer le loop proprement si l'API looprate
                e.target.seekTo(0, true);
                e.target.playVideo();
              }
            },
            onError:function(e){
              // e.data: 2=paramÃ¨tre, 3=HTML5, 5=vidÃ©o non trouvÃ©e,
              // 100=privÃ©e/supprimÃ©e, 101/150=dÃ©sactivÃ©e intÃ©gration
              MovvizAmbient.error();
            }
          }
        });
      }
    </script></body></html>
""".trimIndent()

@Composable
internal fun TitleRow(
    heading: String,
    items: List<TvTitleCard>,
    onClick: (TvTitleCard) -> Unit,
    firstItemFocusRequester: FocusRequester? = null,
) {
    // Ã‰tat de focus partagÃ© par toutes les cartes de la rangÃ©e â€” il vit ici
    // (pas dans PosterCard) pour survivre Ã  la destruction des items par la
    // LazyRow, et n'est lu QUE par les deux enfants dÃ©diÃ©s (prÃ©charge des
    // images + call-out Netflix) : la rangÃ©e elle-mÃªme et ses cartes ne
    // recomposent JAMAIS pendant un scroll latÃ©ral, seul le bandeau bouge.
    val focusedCardState = remember { mutableStateOf<TvTitleCard?>(null) }
    Column(modifier = Modifier.padding(bottom = 48.dp)) {
        RowHeading(heading)
        TvLazyRow(
            contentPadding = PaddingValues(start = 64.dp, end = 64.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            itemsIndexed(items, key = { _, item -> item.id }, contentType = { _, _ -> "card" }) { index, card ->
                PosterCard(
                    card = card,
                    onClick = { onClick(card) },
                    focusRequester = if (index == 0) firstItemFocusRequester else null,
                    onFocusedChange = { focused -> focusedCardState.value = if (focused) card else null },
                )
            }
        }
        // PrÃ©charge des 2 posters suivants la carte focalisÃ©e (zÃ©ro pop-in)
        // + call-out Netflix (synopsis/mÃ©tadonnÃ©es) â€” voir chaque composable.
        val ctx = LocalContext.current
        val imageLoader = LocalImageLoader.current
        LaunchedEffect(focusedCardState.value) {
            val focused = focusedCardState.value ?: return@LaunchedEffect
            val idx = items.indexOf(focused)
            if (idx < 0) return@LaunchedEffect
            for (offset in 1..2) {
                val next = items.getOrNull(idx + offset) ?: continue
                next.posterPath?.let { path ->
                    imageLoader.enqueue(
                        ImageRequest.Builder(ctx)
                            .data("$TMDB_IMAGE_BASE$path")
                            .size(Size(500, 750))
                            .memoryCachePolicy(coil.request.CachePolicy.DISABLED)
                            .build()
                    )
                }
            }
        }
        // Bandeau call-out Netflix : carte semi-transparente avec titre
        // en gras, mÃ©tadonnÃ©es, synopsis tronquÃ© et lien CTA â€” compact,
        // pas dominateur. L'ensemble vit dans un fond glass dark pour
        // sÃ©parer visuellement le call-out des cartes postÃ©rieures.
        // Netflix-style call-out tooltip — clean dark glass card
        val focusedCard = focusedCardState.value
        AnimatedVisibility(
            visible = focusedCard != null,
            enter = fadeIn(tween(200)) + expandVertically(tween(200)),
            exit = fadeOut(tween(150)) + shrinkVertically(tween(150)),
        ) {
            focusedCard?.let { card ->
                Box(
                    modifier = Modifier
                        .padding(start = 64.dp, top = 8.dp, end = 64.dp)
                        .fillMaxWidth()
                        .background(
                            Color.Black.copy(alpha = 0.7f),
                            RoundedCornerShape(8.dp),
                        )
                        .border(1.dp, Color.White.copy(alpha = 0.06f), RoundedCornerShape(8.dp))
                        .padding(horizontal = 20.dp, vertical = 14.dp),
                ) {
                    Column {
                        Text(
                            text = card.title,
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontWeight = FontWeight.Bold,
                                color = Color.White,
                            ),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        // Ligne de mÃ©tadonnÃ©es : annÃ©e Â· durÃ©e Â· genre Â· type
                        val meta = listOfNotNull(
                            card.year?.toString(),
                            card.runtime?.let { "$it min" },
                            card.genres.firstOrNull(),
                            if (card.isMovie) "Film" else "SÃ©rie",
                        ).joinToString("  Â·  ")
                        if (meta.isNotEmpty()) {
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = meta,
                                style = MaterialTheme.typography.labelSmall,
                                color = MovvizInkSoft,
                                maxLines = 1,
                            )
                        }
                        // Synopsis 2 lignes max avec ellipsis
                        card.overview?.takeIf { it.isNotBlank() }?.let { overview ->
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = overview,
                                style = MaterialTheme.typography.bodyMedium,
                                color = MovvizInkSoft,
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                        // Lien CTA Â« Voir la fiche â€º Â» â€” pas un bouton
                        // focusable (D-pad reste sur la carte), juste un
                        // indicateur visuel que l'action est disponible.
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Voir la fiche â€º",
                            style = MaterialTheme.typography.labelLarge.copy(
                                color = Color.White.copy(alpha = 0.8f),
                            ),
                        )
                    }
                }
            }
        }
    }
}

/** Titre de rangÃ©e â€” style titleLarge Netflix, marge basse cohÃ©rente,
 *  padding start identique au padding de la LazyRow pour un alignement
 *  parfait avec la premiÃ¨re carte. */
@Composable
private fun RowHeading(text: String) {
        Text(
            text = text,
            style = MaterialTheme.typography.titleLarge,
            color = MaterialTheme.colorScheme.onBackground,
            modifier = Modifier.padding(start = 64.dp, bottom = 20.dp),
        )
}

/** Carte poster â€” l'effet "focus" central du 10-foot UI : agrandissement
 *  (tvFocusLift, scale ~1.08) + liserÃ© blanc subtil quand la carte prend le
 *  focus D-pad, faÃ§on Netflix â€” une bordure nette (2dp, blanc Ã  90%) se lit
 *  depuis le canapÃ©, lÃ  oÃ¹ le dÃ©gradÃ© de marque passait pour du flou Ã 
 *  distance. `onFocusedChange` remonte l'Ã©tat de focus Ã  la rangÃ©e pour la
 *  prÃ©charge et le call-out, sans faire recomposer la rangÃ©e elle-mÃªme. */
@Composable
internal fun PosterCard(
    card: TvTitleCard,
    onClick: () -> Unit,
    focusRequester: FocusRequester? = null,
    onFocusedChange: ((Boolean) -> Unit)? = null,
) {
    var focused by remember { mutableStateOf(false) }
    val posterUrl = card.posterPath?.let { "$TMDB_IMAGE_BASE$it" }

    Column(modifier = Modifier.width(200.dp)) {
        // Surface (tv-material3) gÃ¨re nativement le focus D-pad + le clic OK,
        // mais PAS le clic souris/tactile (confirmÃ© : un tap synthÃ©tique sur
        // l'Ã©mulateur ne dÃ©clenchait rien) â€” tvPointerClick comble ce trou
        // sans dupliquer le dÃ©clenchement cÃ´tÃ© D-pad (voir Theme.kt).
        Surface(
            onClick = onClick,
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(2f / 3f)
                .let { if (focusRequester != null) it.focusRequester(focusRequester) else it }
                .tvFocusLift(focused, shape = MovvizCardShape, maxScale = 1.06f, maxElevation = 24.dp)
                .onFocusChanged {
                    focused = it.isFocused
                    onFocusedChange?.invoke(it.isFocused)
                }
                .tvPointerClick(onClick),
            shape = androidx.tv.material3.ClickableSurfaceDefaults.shape(shape = MovvizCardShape),
            colors = androidx.tv.material3.ClickableSurfaceDefaults.colors(containerColor = MovvizSurfaceStrong),
            border = androidx.tv.material3.ClickableSurfaceDefaults.border(
                focusedBorder = Border(
                    border = androidx.compose.foundation.BorderStroke(2.5.dp, Color.White.copy(alpha = 0.85f)),
                    shape = MovvizCardShape,
                ),
            ),
        ) {
            Box(modifier = Modifier.fillMaxSize()) {
                if (posterUrl != null) {
                    val painter = rememberAsyncImagePainter(model = posterUrl)
                    Image(
                        painter = painter,
                        contentDescription = card.title,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
                    )
                } else {
                    // Repli dashboard : tuile noire marquÃ©e Movviz, fixe et
                    // sans animation pour rester calme au milieu des posters.
                    Box(
                        modifier = Modifier.fillMaxSize().background(Color.Black),
                        contentAlignment = Alignment.Center,
                    ) {
                        StaticLogoWithGlow(size = 54.dp)
                    }
                }
                // MÃªme paire de pastilles que la grille bibliothÃ¨que desktop
                // (note â˜… en haut-gauche, statut en bas-gauche) â€” voir
                // ui/theme/Badges.kt. Le statut n'existe que pour les films
                // (LibrarySeriesDto n'a pas ce champ cÃ´tÃ© API) donc absent
                // pour une carte sÃ©rie.
                // Certaines sources (titres similaires, dÃ©couverte) ne
                // renvoient pas toujours de note â€” 0.0 par dÃ©faut n'est pas
                // une vraie note "zÃ©ro Ã©toile", juste une valeur absente,
                // donc pas de pastille du tout dans ce cas plutÃ´t que "â˜…0.0"
                // trompeur.
                if (card.rating > 0) {
                    RatingBadge(
                        rating = card.rating,
                        modifier = Modifier.align(Alignment.TopStart).padding(6.dp),
                    )
                }
                card.status?.let { status ->
                    StatusPill(
                        status = status,
                        modifier = Modifier.align(Alignment.BottomStart).padding(6.dp),
                    )
                }
                // QualitÃ© rÃ©elle du fichier (pas TMDb) â€” mÃªme donnÃ©e que les
                // badges FHD/4K/HDR de la grille bibliothÃ¨que desktop
                // (MediaBadges.tsx), jusqu'ici jamais mappÃ©e cÃ´tÃ© TV.
                if (card.qualityLabel != null) {
                    Text(
                        text = if (card.hasHdr) "${card.qualityLabel} HDR" else card.qualityLabel,
                        style = TextStyle(fontSize = 9.sp, fontWeight = FontWeight.Bold, color = MovvizInk),
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .padding(6.dp)
                            .background(Color.Black.copy(alpha = 0.6f), RoundedCornerShape(4.dp))
                            .padding(horizontal = 6.dp, vertical = 2.dp),
                    )
                }
                if (card.progressPercent != null) {
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
        Text(
            text = card.title,
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onBackground,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 8.dp),
        )
        val metadata = listOfNotNull(card.year?.toString(), if (card.isMovie) "Film" else "Série").joinToString("  ·  ")
        Text(
            text = metadata,
            style = MaterialTheme.typography.labelSmall,
            color = MovvizInkDim,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 2.dp),
        )
    }
}

/**
 * RangÃ©e "TÃ©lÃ©chargements en cours" â€” c'est tout l'intÃ©rÃªt de Movviz par
 * rapport Ã  un simple client de lecture faÃ§on Plex : la recherche/le
 * tÃ©lÃ©chargement de nouveau contenu est le cÅ“ur du produit, pas un
 * dÃ©tail admin cantonnÃ© Ã  un Ã©cran sÃ©parÃ©. Cartes horizontales (pas des
 * posters) avec barre de progression, vitesse et statut â€” mÃªme modÃ¨le de
 * donnÃ©es que QueueTab.tsx/DownloadQueue.tsx cÃ´tÃ© desktop, condensÃ© pour le
 * 10-foot UI.
 */
@Composable
private fun DownloadQueueRow(items: List<QueueItemDto>, onOpenTitle: (type: String, tmdbId: Int) -> Unit) {
    Column(modifier = Modifier.padding(bottom = 48.dp)) {
        Text(
            text = "TÃ©lÃ©chargements en cours",
            style = MaterialTheme.typography.titleLarge,
            color = MaterialTheme.colorScheme.onBackground,
            modifier = Modifier.padding(start = 64.dp, bottom = 16.dp),
        )
        TvLazyRow(
            contentPadding = PaddingValues(horizontal = 64.dp),
            horizontalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            itemsIndexed(items, key = { _, item -> item.id }) { _, item ->
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

    // Une entrÃ©e de file n'est pas un poster tronquÃ©. C'est une carte de
    // travail : artwork Ã  gauche, informations et progression Ã  droite, avec
    // un vrai Ã©tat de focus qui dit sans ambiguÃ¯tÃ© qu'elle ouvre la fiche.
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
                        text = "â†“",
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

/** Pastille de statut de FILE DE TÃ‰LÃ‰CHARGEMENT (torrent) â€” distincte de
 *  StatusPill (ui/theme/Badges.kt) qui couvre le statut de DISPONIBILITÃ‰
 *  bibliothÃ¨que (available/downloading/searching/upcoming/missing) : ce sont
 *  deux domaines de valeurs diffÃ©rents (ex. "seeding"/"stalled"/"verifying"
 *  n'existent pas cÃ´tÃ© bibliothÃ¨que), d'oÃ¹ un nom distinct plutÃ´t qu'une
 *  redÃ©finition qui masquerait silencieusement l'autre dans ce fichier. */
@Composable
private fun QueueStatusPill(status: String, modifier: Modifier = Modifier) {
    val (label, color) = when (status) {
        "downloading" -> "TÃ©lÃ©chargement" to MovvizCyan
        "queued" -> "En attente" to MovvizAmber
        "paused" -> "En pause" to MovvizAmber
        "stalled" -> "BloquÃ©" to MovvizDown
        "verifying" -> "VÃ©rification" to MovvizCyan
        "importing" -> "Import" to MovvizCyan
        "seeding" -> "Partage" to MovvizOk
        "completed" -> "TerminÃ©" to MovvizOk
        "failed" -> "Ã‰chec" to MovvizDown
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

/** "68% Â· 4,2 Mo/s" ou "TerminÃ© Â· scÃ¨ne partagÃ©e" selon l'Ã©tat â€” mÃªme esprit
 *  que formatSpeed/formatEta cÃ´tÃ© desktop (src/lib/utils.ts), version
 *  compacte pour une carte de 140dp de large. */
private fun downloadSubtitle(item: QueueItemDto): String {
    val percent = Math.round(item.download.progress * 100).coerceIn(0, 100)
    val speed = formatSpeed(item.download.downloadSpeed)
    return if (speed != null) "$percent% Â· $speed" else "$percent%"
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

/** Grain cinÃ©ma : bitmap de bruit 256x128 gÃ©nÃ©rÃ© UNE FOIS par process, puis
 *  Ã©talÃ© en motif rÃ©pÃ©tÃ© par l'overlay du hero (BitmapShader Repeat).
 *  Blanc/noir alÃ©atoire Ã  alpha trÃ¨s faible â€” texture photo discrÃ¨te, pas
 *  un effet Â« neige d'Ã©cran Â». */
private fun createFilmGrain(): Bitmap {
    val bmp = Bitmap.createBitmap(256, 128, Bitmap.Config.ARGB_8888)
    val rnd = java.util.Random()
    val pixels = IntArray(256 * 128)
    for (i in pixels.indices) {
        val alpha = 12 + rnd.nextInt(16)
        pixels[i] = if (rnd.nextBoolean())
            AndroidColor.argb(alpha, 255, 255, 255)
        else
            AndroidColor.argb(alpha, 0, 0, 0)
    }
    bmp.setPixels(pixels, 0, 256, 0, 0, 256, 128)
    return bmp
}

/** Cache des luminances moyennes par URL de backdrop â€” calculÃ©es une fois,
 *  jamais recalculÃ©es Ã  chaque rotation du hero. */
private val luminanceCache = HashMap<String, Float>()

/** Luminance moyenne pondÃ©rÃ©e (Rec. 709) d'un Ã©chantillon 64x36 : 0 = noir
 *  profond, 1 = blanc. Un sous-Ã©chantillon de 1 pixel sur 2 suffit pour une
 *  valeur stable Ã  Â±0.02 prÃ¨s. */
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

/** Force du scrim vertical selon la luminositÃ© du backdrop : sombre â†’ scrim
 *  lÃ©ger (l'image porte sa propre lisibilitÃ©), clair â†’ scrim renforcÃ© pour
 *  garder le texte blanc lisible. */
private fun scrimStrengthFor(luminance: Float): Float = when {
    luminance < 0.2f -> 0.45f
    luminance < 0.4f -> 0.55f
    else -> 0.68f
}
