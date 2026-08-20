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

private const val TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w342"
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
    /** "4K"/"1080p"/... — voir resolutionLabel(). Absent pour tout ce qui
     *  n'a pas de fichier réel en bibliothèque (séries, découverte). */
    val qualityLabel: String? = null,
    val hasHdr: Boolean = false,
    val overview: String = "",
    val runtime: Int? = null,
    val trailerKeys: List<String> = emptyList(),
    /** Non-null uniquement pour une carte "Continuer à regarder" d'une
     *  série — épisode précis en cours, pour ouvrir directement dessus au
     *  lieu de retomber sur la saison 1 (voir onOpenEpisode). */
    val resumeSeasonNumber: Int? = null,
    val resumeEpisodeNumber: Int? = null,
)

@Composable
fun HomeScreen(
    viewModel: AppViewModel,
    onOpenTitle: (type: String, tmdbId: Int) -> Unit,
    onOpenEpisode: (tmdbId: Int, season: Int, episode: Int) -> Unit = { _, _, _ -> },
    // Cible D-pad « flèche bas depuis la NavRail » (voir MainScreen/NavRail)
    // — attachée plus bas au même élément que le focus initial (CTA hero ou
    // première carte, les deux sont mutuellement exclusifs), jamais appelée
    // automatiquement ici : elle ne sert que de destination quand l'utilisateur
    // appuie réellement sur bas depuis la nav.
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
        viewModel.loadContinueWatching()
        viewModel.loadDiscovery()
        viewModel.loadDashboardHero()
    }

    // La file de téléchargement change en continu (vitesse/progression) tant
    // que l'accueil est visible — seule rangée avec un polling actif, les
    // autres (bibliothèque/découverte/reprise) sont chargées une fois et ne
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
                    // overview sert au call-out Netflix sous la rangée (synopsis
                    // 1 ligne) — déjà renvoyé par /api/library/movies.
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
                title = it.title ?: "—",
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
    // Découverte — tendances TMDb pas encore dans la bibliothèque locale.
    // Le filtrage se refait à chaque recomposition de movies/series pour
    // qu'un ajout depuis la fiche titre fasse disparaître la carte de cette
    // rangée sans nouvel appel réseau (mêmes listes déjà chargées).
    val ownedMovieIds = remember(movies) { movies.map { it.tmdbId }.toSet() }
    val ownedSeriesIds = remember(series) { series.map { it.tmdbId }.toSet() }
    val discoverCards = remember(trendingMovies, trendingSeries, ownedMovieIds, ownedSeriesIds) {
        val moviesRow = trendingMovies.filter { it.tmdbId !in ownedMovieIds }
            .map { TvTitleCard(it.tmdbId.toString(), it.title, it.posterPath, null, it.tmdbId, isMovie = true) }
        val seriesRow = trendingSeries.filter { it.tmdbId !in ownedSeriesIds }
            .map { TvTitleCard(it.tmdbId.toString(), it.title, it.posterPath, null, it.tmdbId, isMovie = false) }
        // Alterné plutôt que "tous les films puis toutes les séries" — une
        // rangée Découverte doit ressembler à un mélange éditorial, pas à
        // une simple concaténation de deux listes.
        moviesRow.zipInterleave(seriesRow).take(20)
    }

    // Les mêmes rangées éditoriales que le dashboard desktop. Elles arrivent
    // déjà ordonnées depuis /api/metadata/rows : la TV ne fabrique donc pas
    // de faux contenus et reste cohérente avec les préférences du serveur.
    val editorialCards = remember(movieRows, seriesRows) {
        (movieRows + seriesRows).mapNotNull { row ->
            val cards = row.results.map {
                TvTitleCard("editorial-${row.key}-${it.type}-${it.tmdbId}", it.title, it.posterPath, null,
                    it.tmdbId, it.type == "movie", it.year, it.rating)
            }
            if (cards.isEmpty()) null else row.key to cards
        }
    }

    // Même sélection personnalisée que le dashboard web : trailerKeys,
    // synopsis et statut viennent de /api/dashboard/hero. Le tri local reste
    // un repli instantané pendant le chargement ou hors-ligne.
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
    LaunchedEffect(activeHero?.tmdbId, activeHero?.isMovie) {
        activeHero?.let { viewModel.loadHeroLogo(if (it.isMovie) "movie" else "series", it.tmdbId) }
    }
    LaunchedEffect(heroItems) {
        if (heroItems.size < 2) return@LaunchedEffect
        while (true) {
            delay(HERO_ROTATE_MS)
            heroIndex = (heroIndex + 1) % heroItems.size
        }
    }

    // Le héros reste au repos visuel au démarrage. Demander immédiatement le
    // focus au CTA fait déclencher le scroll-into-view de TvLazyColumn et
    // pousse le logo sous la barre transparente avant toute action utilisateur.
    // Le CTA reste focusable : il est atteint naturellement avec DPAD_DOWN
    // depuis la navigation, sans déplacer l'accueil tout seul.
    // Une seule cible pour le CTA hero ET la première carte : les deux
    // branches ci-dessous sont mutuellement exclusives (jamais de hero ET de
    // firstRealRowKey en même temps), donc réutiliser le même FocusRequester
    // le fait toujours pointer vers le seul élément réellement composé — et
    // c'est cette même cible que la NavRail vise pour la flèche bas.
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
    // La toute première rangée réellement affichée (Continuer > Films >
    // Séries, dans l'ordre où elles sont composées ci-dessous) est la seule
    // à recevoir le focus initial quand il n'y a pas de hero — sinon deux
    // rangées se disputeraient le même FocusRequester au premier rendu.
    val firstRealRowKey = when {
        continueCards.isNotEmpty() -> "continue"
        recentMovies.isNotEmpty() -> "movies"
        recentSeries.isNotEmpty() -> "series"
        else -> null
    }

    Box(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        TvLazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 48.dp),
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
                        heading = "Continuer à regarder",
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
                        heading = "Séries",
                        items = recentSeries,
                        onClick = { card -> onOpenTitle("series", card.tmdbId) },
                        firstItemFocusRequester = if (heroItems.isEmpty() && firstRealRowKey == "series") firstCardFocus else null,
                    )
                }
            }

            if (discoverCards.isNotEmpty()) {
                item(contentType = "row") {
                    TitleRow(
                        heading = "Découverte",
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
                    // écran de chargement a désormais une vraie cible visible et
                    // focusable, plutôt qu'un texte statique inerte.
                    Box(
                        modifier = Modifier.fillMaxWidth().padding(top = 48.dp, bottom = 24.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Box(
                                modifier = if (heroItems.isEmpty() && firstRealRowKey == null) {
                                    // Rien d'autre à l'écran ne dispute firstCardFocus dans
                                    // ce cas précis (voir firstRealRowKey ci-dessus) — seule
                                    // cible réelle et visible au tout premier rendu, plus
                                    // besoin de retomber sur l'ancre invisible de MainScreen.
                                    Modifier.focusRequester(firstCardFocus).focusable()
                                } else {
                                    Modifier
                                },
                            ) {
                                AnimatedLogo(size = 64.dp)
                            }
                            Text(
                                text = "Chargement de ta bibliothèque…",
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
    "recommendedTop" -> "Sélection pour vous"
    "trendingPopular", "trending" -> "Tendances Movviz"
    "upcoming", "upcomingVod" -> "Prochainement"
    "onAir" -> "En ce moment"
    "newSeriesRenewed" -> "Nouvelles séries"
    "nowPlayingBoxOffice" -> "En salles"
    "kids" -> "Jeunesse"
    else -> key.replace(Regex("([a-z])([A-Z])"), "$1 $2").replaceFirstChar { it.uppercase() }
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

    // --- Ultra hero : précharge prédictive des 2 prochains backdrops dès la
    // rotation — au lieu de charger pendant le crossfade (pop-in/flou).
    // Même cache mémoire Coil que l'affichage ; après le premier passage le
    // disque sert de source, aucun réseau en plus.
    LaunchedEffect(currentIndex, items) {
        if (items.size < 2) return@LaunchedEffect
        val loader = imageLoader ?: return@LaunchedEffect
        for (offset in 1..2) {
            val next = items[(currentIndex + offset) % items.size]
            loader.enqueue(
                ImageRequest.Builder(context)
                    .data("$TMDB_BACKDROP_BASE${next.backdropPath}")
                    .size(Size(1280, 720))
                    .build(),
            )
        }
    }

    // clipToBounds() est indispensable ici : le zoom Ken Burns agrandit
    // l'image avec scale() (une transformation de dessin, pas de layout) et
    // Compose ne rogne rien par défaut — sans ça l'image zoomée déborde
    // visiblement de la bannière et empiète sur les rangées en dessous.
    // Hauteur volontairement contenue : le focus D-pad initial atterrit sur
    // le CTA en bas du bloc de texte, et TvLazyColumn fait défiler pour
    // l'amener pleinement visible — avec un hero trop haut, ce
    // scroll-into-view pousse le HAUT du bloc (le titre) hors de l'écran
    // avant même que l'utilisateur n'ait touché une touche. 720dp (pas
    // 560dp) : un titre anglais long sur 2 lignes pleines ("Akashic Records
    // of Bastard Magic Instructor") a un bloc de texte plus haut qu'un
    // titre court — 560dp coupait le badge FILM/SÉRIE et le haut du titre
    // dans ce cas précis, constaté en direct sur émulateur. Les 80dp
    // supplémentaires laissent le hero s'étendre sous la barre transparente
    // sans placer le texte sous celle-ci.
    // Hauteur contenue pour que le héros reste entièrement dans le viewport
    // TV. Le focus initial n'est plus forcé : le logo ne passe donc plus sous
    // la barre transparente avant la première action de l'utilisateur.
    Box(modifier = Modifier.fillMaxWidth().height(720.dp).clipToBounds()) {
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

        AmbientTrailer(
            trailerKeys = current.trailerKeys,
            title = current.title,
            modifier = Modifier.fillMaxSize(),
        )

        // Scrim vertical — force animée selon la luminosité du backdrop
        // (scrimAlpha, calculé plus haut). Le dégradé reste ancré sur
        // MaterialTheme.colorScheme.background pour fondre proprement dans
        // le fond de l'écran.
        Box(
            modifier = Modifier.fillMaxSize().background(
                Brush.verticalGradient(
                    colors = listOf(
                        Color.Transparent,
                        MaterialTheme.colorScheme.background.copy(alpha = animatedScrimAlpha),
                        MaterialTheme.colorScheme.background,
                    ),
                    startY = 0f,
                ),
            ),
        )
        Box(
            modifier = Modifier.fillMaxSize().background(
                Brush.horizontalGradient(
                    colors = listOf(MaterialTheme.colorScheme.background.copy(alpha = 0.85f), Color.Transparent),
                    endX = 900f,
                ),
            ),
        )

        // Grain cinéma : un léger bruit photo par-dessus image et vidéo,
        // signature visuelle des apps premium (Netflix/Apple TV en posent
        // un très discret). Bitmap généré UNE FOIS par process et étalé en
        // TileMode.Repeat via un shader Android natif — un seul draw call
        // par frame, coût négligeable pour l'effet obtenu. (Le Paint natif
        // est requis : les shaders Compose n'existent pas dans cette
        // version de Compose TV — see nativeCanvas.)
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
                // Le CTA doit rester posé contre le bas du viewport, comme
                // sur la fiche desktop/TV : pas de grand vide sous « Voir la
                // fiche », tout en gardant le bouton entièrement cliquable.
                .offset(y = (-200).dp)
                .padding(start = 64.dp, end = 48.dp, bottom = 18.dp)
                .widthIn(max = 760.dp),
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
                style = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.Bold, color = MovvizBrand2, letterSpacing = 2.2.sp),
            )
            Spacer(modifier = Modifier.height(8.dp))
            if (logoPath != null) {
                Image(
                    painter = rememberAsyncImagePainter(model = "https://image.tmdb.org/t/p/w500$logoPath"),
                    contentDescription = current.title,
                    contentScale = ContentScale.Fit,
                    alignment = Alignment.CenterStart,
                    // PAS d'offset x négatif ici : un -140dp était appliqué à
                    // tous les logos pour recentrer un asset TMDb précis dont
                    // la marge transparente à gauche était inhabituellement
                    // large — mais la plupart des logos TMDb sont déjà
                    // recadrés au plus près, donc ce décalage aveugle les
                    // poussait hors de l'écran à gauche (confirmé en direct :
                    // "Jackass: Best and Last" et "Les aventures de Porcinet"
                    // tous deux tronqués, contentDescription visible via
                    // uiautomator dump mais premiers caractères hors-écran).
                    modifier = Modifier
                        .heightIn(max = 88.dp)
                        .width(480.dp),
                )
            } else if (showTitleFallback) {
                Text(
                    text = current.title,
                    style = TextStyle(fontSize = 42.sp, fontWeight = FontWeight.Black, color = MovvizInk, lineHeight = 46.sp),
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            } else {
                // Réserve la place du logo pendant son chargement : aucun
                // titre texte ne clignote avant de laisser sa place au logo.
                Spacer(modifier = Modifier.height(88.dp).widthIn(max = 480.dp))
            }
            Spacer(modifier = Modifier.height(8.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (current.rating > 0) {
                    Text(text = "★ ${"%.1f".format(current.rating)}", style = TextStyle(fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Color(0xFFF5C542)))
                    Spacer(modifier = Modifier.width(10.dp))
                }
                current.year?.let {
                    Text(text = "$it", style = TextStyle(fontSize = 15.sp, color = MovvizInkSoft))
                    Spacer(modifier = Modifier.width(10.dp))
                }
                current.runtime?.let {
                    Text(text = "$it min", style = TextStyle(fontSize = 15.sp, color = MovvizInkSoft))
                }
            }
            if (current.genres.isNotEmpty()) {
                Spacer(modifier = Modifier.height(10.dp))
                // Pastilles de genre, pas du texte "Comédie, Crime, Mystère"
                // brut — même langage pill que le reste de l'appli (voir
                // ui/theme/Badges.kt) et que le hero desktop.
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    current.genres.take(3).forEach { genre ->
                        Box(
                            modifier = Modifier
                                .background(Color.White.copy(alpha = 0.1f), RoundedCornerShape(50))
                                .border(1.dp, Color.White.copy(alpha = 0.18f), RoundedCornerShape(50))
                                .padding(horizontal = 12.dp, vertical = 5.dp),
                        ) {
                            Text(text = genre, style = TextStyle(fontSize = 13.sp, fontWeight = FontWeight.Medium, color = MovvizInkSoft))
                        }
                    }
                }
            }
            if (current.overview.isNotBlank()) {
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = current.overview,
                    style = TextStyle(fontSize = 14.sp, color = MovvizInkSoft, lineHeight = 20.sp),
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.widthIn(max = 620.dp),
                )
            }
            }
            Spacer(modifier = Modifier.height(24.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                var focused by remember(current.id) { mutableStateOf(false) }
                // Action primaire = dégradé de marque, jamais un simple
                // blanc/noir (CLAUDE.md : "Primary actions: brand-gradient
                // text-white font-bold rounded-xl") — c'était le seul CTA
                // primaire de toute l'appli TV encore en noir/blanc.
                Surface(
                    onClick = { onOpen(current) },
                    modifier = Modifier
                        .focusRequester(ctaFocusRequester)
                        // tvFocusLift (Theme.kt) plutôt qu'un scale() isolé —
                        // même lift Apple TV (scale + ombre) que toute autre
                        // carte/bouton focusable de l'appli ; c'était le
                        // dernier CTA à n'avoir qu'un zoom plat sans ombre.
                        .tvFocusLift(focused, shape = RoundedCornerShape(50))
                        .onFocusChanged { focused = it.isFocused }
                        .tvPointerClick { onOpen(current) },
                    // rounded-full (pill), pas un simple rectangle arrondi —
                    // même forme que les boutons d'action du hero desktop
                    // (Informations/Ajouter à la bibliothèque/Pourquoi ce
                    // contenu ?).
                    shape = ClickableSurfaceDefaults.shape(shape = RoundedCornerShape(50)),
                    colors = ClickableSurfaceDefaults.colors(containerColor = Color.Transparent, contentColor = Color.White),
                    border = ClickableSurfaceDefaults.border(
                        focusedBorder = Border(border = androidx.compose.foundation.BorderStroke(3.dp, Color.White), shape = RoundedCornerShape(50)),
                    ),
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .background(Brush.horizontalGradient(listOf(MovvizBrand, MovvizBrand2)))
                            .padding(horizontal = 28.dp, vertical = 14.dp),
                    ) {
                        Text(text = "▶", style = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Color.White))
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(text = "Voir la fiche", style = TextStyle(fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Color.White))
                    }
                }

                if (items.size > 1) {
                    Spacer(modifier = Modifier.width(20.dp))
                    // Purement décoratif — juste l'état de rotation, pas une
                    // cible D-pad de plus à côté du CTA (un point de 8dp est
                    // de toute façon un cible tactile trop petite sur TV).
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        items.indices.forEach { index ->
                            val active = index == currentIndex
                            Box(
                                modifier = Modifier
                                    .size(if (active) 22.dp else 8.dp, 8.dp)
                                    .clip(RoundedCornerShape(4.dp))
                                    .background(
                                        if (active) Brush.horizontalGradient(listOf(MovvizBrand, MovvizBrand2))
                                        else Brush.horizontalGradient(listOf(Color.White.copy(alpha = 0.25f), Color.White.copy(alpha = 0.25f))),
                                    ),
                            )
                        }
                    }
                }
            }
        }
    }
}

/** Variante TV de TrailerHeader : le backdrop reste la couche de base, et
 * l'iframe YouTube muette ne devient visible qu'après l'événement PLAYING.
 * Une vidéo bloquée ou un réseau absent laisse donc exactement l'image de
 * fond, sans chrome YouTube ni perte du focus D-pad. */
@Composable
private fun AmbientTrailer(trailerKeys: List<String>, title: String, modifier: Modifier = Modifier) {
    val key = trailerKeys.firstOrNull { it.matches(Regex("[A-Za-z0-9_-]{6,}")) } ?: return
    var playing by remember(key) { mutableStateOf(false) }
    val mainHandler = remember { Handler(Looper.getMainLooper()) }
    val bridge = remember(key) {
        AmbientTrailerBridge { mainHandler.post { playing = true } }
    }
    LaunchedEffect(key) { playing = false }

    // LA MÊME WebView sert pendant toute la durée du hero : le factory ne
    // capture rien (donc stable — AndroidView garde la vue) et chaque
    // rotation recharge juste la vidéo via update. Avant ce correctif : une
    // WebView NEUVE à chaque rotation, jamais détruite — les moteurs
    // s'empilaient en mémoire (fuite visible sur Chromecast 4K) et chaque
    // rotation payait la création du moteur + le rechargement de l'iframe
    // API YouTube (jank au moment du changement).
    AndroidView(
        factory = remember { { ctx: Context -> TrailerWebViewPool.obtain(ctx) } },
        update = { view -> TrailerWebViewPool.prepare(view, key, title, bridge) },
        onRelease = { view -> TrailerWebViewPool.release(view) },
        modifier = modifier.graphicsLayer { alpha = if (playing) 1f else 0f },
    )
}

private class AmbientTrailerBridge(private val onPlaying: () -> Unit) {
    @JavascriptInterface fun playing() = onPlaying()
}

/** Pool de WebViews de bandes-annonces ambiantes : maximum 2 instances
 *  vivantes (une à l'écran, une au repos), aucune création/destruction à
 *  chaque rotation du hero. La préparation est idempotente : update est
 *  appelé à chaque recomposition, prepare ne recharge la vidéo que si la
 *  clé (trailer) a changé. */
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
      var p; function onYouTubeIframeAPIReady(){p=new YT.Player('player',{videoId:'$key',playerVars:{autoplay:1,mute:1,controls:0,playsinline:1,rel:0,modestbranding:1,loop:1,playlist:'$key'},events:{onReady:function(e){e.target.mute();e.target.playVideo()},onStateChange:function(e){if(e.data===YT.PlayerState.PLAYING){MovvizAmbient.playing()}},onError:function(){}}})}
    </script></body></html>
""".trimIndent()

@Composable
internal fun TitleRow(
    heading: String,
    items: List<TvTitleCard>,
    onClick: (TvTitleCard) -> Unit,
    firstItemFocusRequester: FocusRequester? = null,
) {
    // État de focus partagé par toutes les cartes de la rangée — il vit ici
    // (pas dans PosterCard) pour survivre à la destruction des items par la
    // LazyRow, et n'est lu QUE par les deux enfants dédiés (précharge des
    // images + call-out Netflix) : la rangée elle-même et ses cartes ne
    // recomposent JAMAIS pendant un scroll latéral, seul le bandeau bouge.
    val focusedCardState = remember { mutableStateOf<TvTitleCard?>(null) }
    Column(modifier = Modifier.padding(bottom = 32.dp)) {
        RowHeading(heading)
        TvLazyRow(
            // Padding end négatif = "peaking" Netflix : la dernière carte de
            // la rangée reste légèrement coupée au bord droit, signalant
            // qu'il y a encore du contenu à faire défiler (au lieu d'un
            // vide de 64dp en fin de rangée).
            contentPadding = PaddingValues(start = 64.dp, end = (-12).dp),
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
        // Précharge des 2 posters suivants la carte focalisée (zéro pop-in)
        // + call-out Netflix (synopsis/métadonnées) — voir chaque composable.
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
                            .size(Size(342, 513))
                            .memoryCachePolicy(coil.request.CachePolicy.DISABLED)
                            .build()
                    )
                }
            }
        }
        // Bandeau call-out Netflix : synopsis + métadonnées de la carte
        // focalisée, avec debounce pour éviter le scintillement pendant le
        // scroll rapide. Seul ce composable se recompose au changement de
        // focus — la rangée et ses cartes restent intactes.
        val focusedCard = focusedCardState.value
        AnimatedVisibility(
            visible = focusedCard != null,
            enter = fadeIn(tween(200)) + expandVertically(tween(200)),
            exit = fadeOut(tween(150)) + shrinkVertically(tween(150)),
        ) {
            focusedCard?.let { card ->
                Column(modifier = Modifier.padding(start = 64.dp, top = 8.dp, end = 64.dp)) {
                    card.overview?.let { overview ->
                        Text(
                            text = overview,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MovvizInkSoft,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                    val meta = listOfNotNull(
                        card.year?.toString(),
                        if (card.isMovie) "Film" else "Série",
                    ).joinToString("  ·  ")
                    if (meta.isNotEmpty()) {
                        Text(
                            text = meta,
                            style = MaterialTheme.typography.labelSmall,
                            color = MovvizInkDim,
                            maxLines = 1,
                        )
                    }
                }
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
        modifier = Modifier.padding(start = 64.dp, bottom = 12.dp),
    )
}

/** Carte poster — l'effet "focus" central du 10-foot UI : agrandissement
 *  (tvFocusLift, scale ~1.08) + liseré blanc subtil quand la carte prend le
 *  focus D-pad, façon Netflix — une bordure nette (2dp, blanc à 90%) se lit
 *  depuis le canapé, là où le dégradé de marque passait pour du flou à
 *  distance. `onFocusedChange` remonte l'état de focus à la rangée pour la
 *  précharge et le call-out, sans faire recomposer la rangée elle-même. */
@Composable
internal fun PosterCard(
    card: TvTitleCard,
    onClick: () -> Unit,
    focusRequester: FocusRequester? = null,
    onFocusedChange: ((Boolean) -> Unit)? = null,
) {
    var focused by remember { mutableStateOf(false) }
    val posterUrl = card.posterPath?.let { "$TMDB_IMAGE_BASE$it" }

    Column(modifier = Modifier.width(160.dp)) {
        // Surface (tv-material3) gère nativement le focus D-pad + le clic OK,
        // mais PAS le clic souris/tactile (confirmé : un tap synthétique sur
        // l'émulateur ne déclenchait rien) — tvPointerClick comble ce trou
        // sans dupliquer le déclenchement côté D-pad (voir Theme.kt).
        Surface(
            onClick = onClick,
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(2f / 3f)
                .let { if (focusRequester != null) it.focusRequester(focusRequester) else it }
                .tvFocusLift(focused, shape = MovvizCardShape, maxScale = 1.08f, maxElevation = 28.dp)
                .onFocusChanged {
                    focused = it.isFocused
                    onFocusedChange?.invoke(it.isFocused)
                }
                .tvPointerClick(onClick),
            shape = androidx.tv.material3.ClickableSurfaceDefaults.shape(shape = MovvizCardShape),
            colors = androidx.tv.material3.ClickableSurfaceDefaults.colors(containerColor = MovvizSurfaceStrong),
            border = androidx.tv.material3.ClickableSurfaceDefaults.border(
                focusedBorder = Border(
                    border = androidx.compose.foundation.BorderStroke(2.dp, Color.White.copy(alpha = 0.9f)),
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
                    // Repli dashboard : tuile noire marquée Movviz, fixe et
                    // sans animation pour rester calme au milieu des posters.
                    Box(
                        modifier = Modifier.fillMaxSize().background(Color.Black),
                        contentAlignment = Alignment.Center,
                    ) {
                        StaticLogoWithGlow(size = 54.dp)
                    }
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
                // Qualité réelle du fichier (pas TMDb) — même donnée que les
                // badges FHD/4K/HDR de la grille bibliothèque desktop
                // (MediaBadges.tsx), jusqu'ici jamais mappée côté TV.
                if (card.qualityLabel != null) {
                    Text(
                        text = if (card.hasHdr) "${card.qualityLabel} HDR" else card.qualityLabel,
                        style = TextStyle(fontSize = 9.sp, fontWeight = FontWeight.Bold, color = MovvizInk),
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .padding(6.dp)
                            .background(Color.Black.copy(alpha = 0.55f), RoundedCornerShape(50))
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
            modifier = Modifier.padding(top = 8.dp),
        )
        val metadata = listOfNotNull(card.year?.toString(), if (card.isMovie) "Film" else "Série").joinToString("  ·  ")
        Text(
            text = metadata,
            style = MaterialTheme.typography.labelSmall,
            color = MovvizInkDim,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 3.dp),
        )
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
private fun DownloadQueueRow(items: List<QueueItemDto>, onOpenTitle: (type: String, tmdbId: Int) -> Unit) {
    Column(modifier = Modifier.padding(bottom = 32.dp)) {
        Text(
            text = "Téléchargements en cours",
            style = TextStyle(fontSize = 20.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onBackground),
            modifier = Modifier.padding(start = 48.dp, bottom = 12.dp),
        )
        TvLazyRow(
            contentPadding = PaddingValues(horizontal = 48.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
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
                border = androidx.compose.foundation.BorderStroke(3.dp, Color.White),
                shape = shape,
            ),
        ),
    ) {
        Row(modifier = Modifier.fillMaxSize()) {
            Box(
                modifier = Modifier
                    .width(108.dp)
                    .fillMaxHeight()
                    .background(Brush.verticalGradient(listOf(MovvizBrand.copy(alpha = 0.56f), MovvizSurfaceStrong))),
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
                        style = TextStyle(fontSize = 38.sp, fontWeight = FontWeight.Light, color = Color.White.copy(alpha = 0.9f)),
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

/** Grain cinéma : bitmap de bruit 256x128 généré UNE FOIS par process, puis
 *  étalé en motif répété par l'overlay du hero (BitmapShader Repeat).
 *  Blanc/noir aléatoire à alpha très faible — texture photo discrète, pas
 *  un effet « neige d'écran ». */
private fun createFilmGrain(): Bitmap {
    val bmp = Bitmap.createBitmap(256, 128, Bitmap.Config.ARGB_8888)
    val rnd = java.util.Random()
    for (y in 0 until 128) {
        for (x in 0 until 256) {
            val alpha = 12 + rnd.nextInt(16)
            val white = rnd.nextBoolean()
            bmp.setPixel(x, y, if (white) AndroidColor.argb(alpha, 255, 255, 255) else AndroidColor.argb(alpha, 0, 0, 0))
        }
    }
    return bmp
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
