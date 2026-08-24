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
import androidx.compose.ui.focus.focusRestorer
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
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed as foundationItemsIndexed
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.ui.ExperimentalComposeUiApi
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
import com.movviz.tv.data.MetadataRowDto
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
import com.movviz.tv.ui.theme.MovvizIconPlay
import com.movviz.tv.ui.theme.MovvizIconStar
import androidx.tv.material3.Icon
import com.movviz.tv.ui.theme.MovvizOk
import com.movviz.tv.ui.theme.MovvizSurfaceStrong
import com.movviz.tv.ui.theme.StaticLogoWithGlow
import com.movviz.tv.ui.theme.RatingBadge
import com.movviz.tv.ui.theme.StatusPill
import com.movviz.tv.ui.theme.statusTone
import com.movviz.tv.ui.theme.tvFocusLift
import com.movviz.tv.ui.theme.tvCardFocusHalo
import com.movviz.tv.ui.theme.tvPointerClick
import kotlinx.coroutines.delay

private const val TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500"
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
    // "Voir tout" d'une rangée éditoriale — ouvre la grille paginée
    // (RowDetailScreen, GET /api/metadata/row-page), même route que le
    // bouton "Tout voir" du Discover desktop.
    onSeeAllRow: (mediaType: String, key: String, label: String) -> Unit = { _, _, _ -> },
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
        delay(200)
        viewModel.loadContinueWatching()
        delay(200)
        viewModel.loadDiscovery()
        delay(200)
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
            .map { TvTitleCard(it.tmdbId.toString(), it.title, it.posterPath, it.backdropPath, it.tmdbId, isMovie = true) }
        val seriesRow = trendingSeries.filter { it.tmdbId !in ownedSeriesIds }
            .map { TvTitleCard(it.tmdbId.toString(), it.title, it.posterPath, it.backdropPath, it.tmdbId, isMovie = false) }
        // Alterné plutôt que "tous les films puis toutes les séries" — une
        // rangée Découverte doit ressembler à un mélange éditorial, pas à
        // une simple concaténation de deux listes.
        moviesRow.zipInterleave(seriesRow).take(20)
    }

    // Les mêmes rangées éditoriales que le dashboard desktop. Elles arrivent
    // déjà ordonnées depuis /api/metadata/rows : la TV ne fabrique donc pas
    // de faux contenus et reste cohérente avec les préférences du serveur.
    // Films et séries sont traités SÉPARÉMENT (pas fusionnés dans un seul
    // filterNot+mapNotNull comme avant) : chaque rangée doit garder son
    // propre type "movie"/"series" pour que "Voir tout" sache quelle route
    // /api/metadata/row-page interroger (le desktop garde cette distinction
    // via son état mediaType, ici il n'existe pas de tel état global).
    val editorialSections = remember(movieRows, seriesRows) {
        buildEditorialSections(movieRows, "movie") + buildEditorialSections(seriesRows, "series")
    }

    // Même sélection personnalisée que le dashboard web : ambientVideoKeys
    // (contexte carrousel, Teaser > Trailer — voir selectMediaVideo() dans
    // tmdb.ts), synopsis et statut viennent de /api/dashboard/hero. Le tri
    // local reste un repli instantané pendant le chargement ou hors-ligne.
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
                trailerKeys = detail.ambientVideoKeys,
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
    // Palier invisible au-dessus du hero — voir le premier item de la
    // LazyColumn plus bas (UP depuis le CTA : scroll retour en haut avant
    // la NavRail).
    val heroTopAnchor = remember { FocusRequester() }
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
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 80.dp),
        ) {
            // Palier D-pad invisible TOUT EN HAUT du contenu (demandé en
            // direct) : UP depuis le CTA du hero y atterrit d'abord — le
            // bringIntoView ramène alors le scroll à l'offset 0, carrousel
            // entier redevient visible sous la barre de nav — et un second
            // UP seulement rejoint la NavRail. Sans ce palier, la dernière
            // étape avant la nav restait "Lire" et le carrousel demeurait
            // à moitié caché derrière elle.
            item(contentType = "topAnchor") {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(1.dp)
                        .focusRequester(heroTopAnchor)
                        .focusable(),
                )
            }
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

            editorialSections.forEach { section ->
                item(contentType = "row") {
                    val label = homeRowLabel(section.key, section.meta)
                    TitleRow(
                        heading = label,
                        items = section.cards,
                        onClick = { card -> onOpenTitle(if (card.isMovie) "movie" else "series", card.tmdbId) },
                        onSeeAll = { onSeeAllRow(section.mediaType, section.key, label) },
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

/** Une rangée éditoriale de l'accueil, avec son type de média propre (voir
 *  le commentaire sur editorialSections plus haut) — nécessaire pour que
 *  "Voir tout" sache quelle route interroger, et pour résoudre le libellé
 *  dynamique "becauseYouWatched:*" (meta). */
private data class EditorialRowSection(
    val key: String,
    val mediaType: String,
    val meta: com.movviz.tv.data.RowMetaDto?,
    val cards: List<TvTitleCard>,
)

private fun buildEditorialSections(rows: List<MetadataRowDto>, mediaType: String): List<EditorialRowSection> =
    // La TV Movviz ne propose pas d'espace Jeunesse : ne jamais faire
    // réapparaître cette rangée au gré d'un changement d'algorithme côté
    // serveur. Les profils ne sont pas segmentés par âge, donc afficher
    // "kids" ici serait à la fois une régression produit et un faux
    // raccourci de navigation.
    rows.filterNot { it.key == "kids" }.mapNotNull { row ->
        val cards = row.results.map {
            TvTitleCard("editorial-${row.key}-${it.type}-${it.tmdbId}", it.title, it.posterPath, it.backdropPath,
                it.tmdbId, it.type == "movie", it.year, it.rating)
        }
        if (cards.isEmpty()) null else EditorialRowSection(row.key, mediaType, row.meta, cards)
    }

/** `meta` n'est renseigné que pour la clé dynamique "becauseYouWatched:{id}"
 *  (voir becauseYouWatched.ts côté serveur) — même deux formulations que
 *  discover.rowBecauseYouWatched/rowBecauseYouLiked en fr.ts, le reste des
 *  clés est un simple switch statique comme avant. */
private fun homeRowLabel(key: String, meta: com.movviz.tv.data.RowMetaDto?): String {
    if (key.startsWith("becauseYouWatched:") && meta != null) {
        return if (meta.verb == "liked") "Puisque ${meta.anchorTitle} vous a plu" else "Dans la lignée de ${meta.anchorTitle}"
    }
    return when (key) {
        "recommendedTop" -> "Sélection pour vous"
        "trendingPopular", "trending" -> "Tendances Movviz"
        "upcoming", "upcomingVod" -> "Prochainement"
        "onAir" -> "En ce moment"
        "newSeriesRenewed" -> "Nouvelles séries"
        "nowPlayingBoxOffice" -> "En salles"
        "acclaimed" -> "Salué par la critique"
        "anime" -> "Univers anime"
        "teen" -> "Romance ado"
        "shortFormat" -> "Format court, grand impact"
        "genreAction" -> "Action"
        "genreComedy" -> "Comédie"
        "genreHorror" -> "Frissons garantis"
        "genreSciFi" -> "Science-fiction"
        else -> key.replace(Regex("([a-z])([A-Z])"), "$1 $2").replaceFirstChar { it.uppercase() }
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
    val screenHeightDp = androidx.compose.ui.platform.LocalConfiguration.current.screenHeightDp
    val heroHeight = (screenHeightDp * 0.62f).coerceIn(390f, 600f)
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
                        .width(440.dp)
                        .height(82.dp),
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
                Spacer(modifier = Modifier.height(90.dp).widthIn(max = 460.dp))
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
                    text = current.genres.take(3).joinToString(", "),
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
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.widthIn(max = 580.dp),
                )
            }
            }
            Spacer(modifier = Modifier.height(16.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                var focused by remember(current.id) { mutableStateOf(false) }
                // Netflix-style "Lire" button — white solid, bold.
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
                        modifier = Modifier.padding(horizontal = 20.dp, vertical = 10.dp),
                    ) {
                        // Icône vectorielle : le glyphe ▶ rendait en carré
                        // (pas dans Inter).
                        Icon(
                            imageVector = MovvizIconPlay,
                            contentDescription = null,
                            tint = Color.Black,
                            modifier = Modifier.size(15.dp),
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(text = "Lire", style = TextStyle(fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Color.Black))
                    }
                }

                Spacer(modifier = Modifier.width(12.dp))

                // "Plus d'infos" button — dark glass, secondary action.
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
                        modifier = Modifier.padding(horizontal = 20.dp, vertical = 10.dp),
                    ) {
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
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(text = "Plus d'infos", style = TextStyle(fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = Color.White))
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
private const val AMBIENT_TRAILER_DELAY_MS = 2_200L

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
    // "Voir tout" — même route que le bouton du même nom sur le Discover
    // desktop (GET /api/metadata/row-page). Rendu comme une tuile finale de
    // la rangée plutôt qu'un bouton séparé dans l'en-tête : ça garde le
    // parcours D-pad naturel (continuer à droite depuis la dernière carte)
    // au lieu d'ajouter une seconde cible de focus dans RowHeading, qui
    // compliquerait la remontée UP déjà réglée avec soin (MainScreen).
    onSeeAll: (() -> Unit)? = null,
) {
    // État de focus partagé par toutes les cartes de la rangée — il vit ici
    // (pas dans PosterCard) pour survivre à la destruction des items par la
    // LazyRow, et n'est lu QUE par les deux enfants dédiés (précharge des
    // images + call-out Netflix) : la rangée elle-même et ses cartes ne
    // recomposent JAMAIS pendant un scroll latéral, seul le bandeau bouge.
    val focusedCardState = remember { mutableStateOf<TvTitleCard?>(null) }
    Column(modifier = Modifier.padding(bottom = 32.dp)) {
        RowHeading(heading)
        LazyRow(
            modifier = Modifier.focusRestorer(),
            contentPadding = PaddingValues(start = 52.dp, end = 52.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            foundationItemsIndexed(items, key = { _, item -> item.id }, contentType = { _, _ -> "card" }) { index, card ->
                PosterCard(
                    card = card,
                    onClick = { onClick(card) },
                    focusRequester = if (index == 0) firstItemFocusRequester else null,
                    onFocusedChange = { focused -> focusedCardState.value = if (focused) card else null },
                )
            }
            if (onSeeAll != null) {
                item(contentType = "see-all") { SeeAllTile(onClick = onSeeAll) }
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
                            .size(Size(500, 750))
                            .memoryCachePolicy(coil.request.CachePolicy.DISABLED)
                            .build()
                    )
                }
            }
        }
        // Bandeau call-out Netflix : carte semi-transparente avec titre
        // en gras, métadonnées, synopsis tronqué et lien CTA — compact,
        // pas dominateur. L'ensemble vit dans un fond glass dark pour
        // séparer visuellement le call-out des cartes postérieures.
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
                        .padding(start = 52.dp, top = 6.dp, end = 52.dp)
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
                        // Ligne de métadonnées : année · durée · genre · type
                        val meta = listOfNotNull(
                            card.year?.toString(),
                            card.runtime?.let { "$it min" },
                            card.genres.firstOrNull(),
                            if (card.isMovie) "Film" else "Série",
                        ).joinToString("  ·  ")
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
                        // Lien CTA « Voir la fiche › » — pas un bouton
                        // focusable (D-pad reste sur la carte), juste un
                        // indicateur visuel que l'action est disponible.
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Voir la fiche ›",
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

/** Titre de rangée — style titleLarge Netflix, marge basse cohérente,
 *  padding start identique au padding de la LazyRow pour un alignement
 *  parfait avec la première carte. */
@Composable
private fun RowHeading(text: String) {
        Text(
            text = text,
            style = MaterialTheme.typography.titleLarge,
            color = MaterialTheme.colorScheme.onBackground,
            modifier = Modifier.padding(start = 52.dp, bottom = 12.dp),
        )
}

/** Tuile finale d'une rangée éditoriale — même gabarit que PosterCard (230dp,
 *  16:9, MovvizCardShape) pour que le D-pad continue sans à-coup après la
 *  dernière carte, mais un fond glass discret plutôt qu'une image : c'est
 *  une action, pas un titre. Ouvre RowDetailScreen (GET /api/metadata/
 *  row-page), même contenu que "Tout voir" sur le Discover desktop. */
@Composable
private fun SeeAllTile(onClick: () -> Unit) {
    var focused by remember { mutableStateOf(false) }
    Column(modifier = Modifier.width(230.dp)) {
        Surface(
            onClick = onClick,
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(16f / 9f)
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
                    Text(text = "›", style = TextStyle(fontSize = 26.sp, fontWeight = FontWeight.Bold, color = MovvizInk))
                    Text(text = "Tout voir", style = TextStyle(fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = MovvizInkSoft))
                }
            }
        }
        // Espace réservé sous la tuile, symétrique au titre+métadonnées des
        // PosterCard voisines — évite un décalage vertical visible dans la
        // rangée quand cette tuile est la dernière alignée avec les autres.
        Spacer(modifier = Modifier.height(6.dp).fillMaxWidth())
    }
}

/** Carte poster — le focus Netflix garde la grille stable : aucun scale ni
 * déplacement des voisins, seulement un contour blanc et un halo doux
 * pulsant. `onFocusedChange` remonte l'état à la rangée pour la précharge et
 * le call-out, sans refaire composer les autres cartes. */
@Composable
internal fun PosterCard(
    card: TvTitleCard,
    onClick: () -> Unit,
    focusRequester: FocusRequester? = null,
    onFocusedChange: ((Boolean) -> Unit)? = null,
) {
    var focused by remember { mutableStateOf(false) }
    val posterUrl = card.posterPath?.let { "$TMDB_IMAGE_BASE$it" }

    // Les rangées d'accueil utilisent le format paysage, plus dense et plus
    // confortable à balayer au D-pad qu'une succession de grands posters.
    // Le fallback poster reste volontaire : certaines réponses anciennes ne
    // fournissent pas encore backdropPath, mais ne doivent jamais créer une
    // carte vide.
    val visualUrl = card.backdropPath?.let { "$TMDB_BACKDROP_BASE$it" } ?: posterUrl
    Column(modifier = Modifier.width(230.dp)) {
        // Surface (tv-material3) gère nativement le focus D-pad + le clic OK,
        // mais PAS le clic souris/tactile (confirmé : un tap synthétique sur
        // l'émulateur ne déclenchait rien) — tvPointerClick comble ce trou
        // sans dupliquer le déclenchement côté D-pad (voir Theme.kt).
        Surface(
            onClick = onClick,
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(16f / 9f)
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
                focusedBorder = Border(
                    border = androidx.compose.foundation.BorderStroke(2.5.dp, Color.White.copy(alpha = 0.85f)),
                    shape = MovvizCardShape,
                ),
            ),
        ) {
            Box(modifier = Modifier.fillMaxSize()) {
                if (visualUrl != null) {
                    val painter = rememberAsyncImagePainter(model = visualUrl)
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
                        modifier = Modifier.align(Alignment.TopStart).padding(5.dp),
                    )
                }
                card.status?.let { status ->
                    StatusPill(
                        status = status,
                        modifier = Modifier.align(Alignment.BottomStart).padding(5.dp),
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
                            .padding(5.dp)
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
                .padding(top = 6.dp),
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
                .padding(top = 1.dp),
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
@OptIn(ExperimentalFoundationApi::class, ExperimentalComposeUiApi::class)
private fun DownloadQueueRow(items: List<QueueItemDto>, onOpenTitle: (type: String, tmdbId: Int) -> Unit) {
    Column(modifier = Modifier.padding(bottom = 48.dp)) {
        Text(
            text = "Téléchargements en cours",
            style = MaterialTheme.typography.titleLarge,
            color = MaterialTheme.colorScheme.onBackground,
            modifier = Modifier.padding(start = 64.dp, bottom = 16.dp),
        )
        LazyRow(
            modifier = Modifier.focusRestorer(),
            contentPadding = PaddingValues(horizontal = 64.dp),
            horizontalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            foundationItemsIndexed(items, key = { _, item -> item.id }) { _, item ->
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

/** Grain cinéma : bitmap de bruit 256x128 généré UNE FOIS par process, puis
 *  étalé en motif répété par l'overlay du hero (BitmapShader Repeat).
 *  Blanc/noir aléatoire à alpha très faible — texture photo discrète, pas
 *  un effet « neige d'écran ». */
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
