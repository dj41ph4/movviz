package com.movviz.tv.ui.home

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
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
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import coil.compose.rememberAsyncImagePainter
import com.movviz.tv.AppViewModel
import com.movviz.tv.data.QueueItemDto
import com.movviz.tv.ui.theme.MovvizAmber
import com.movviz.tv.ui.theme.MovvizBrand
import com.movviz.tv.ui.theme.MovvizBrand2
import com.movviz.tv.ui.theme.MovvizCyan
import com.movviz.tv.ui.theme.MovvizDown
import com.movviz.tv.ui.theme.MovvizOk
import com.movviz.tv.ui.theme.tvPointerClick
import kotlinx.coroutines.delay

private const val TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w342"
private const val TMDB_BACKDROP_BASE = "https://image.tmdb.org/t/p/original"

/** Intervalle de rafraîchissement de la file de téléchargement sur l'accueil
 *  — plus lâche que le polling 500ms de QueueTab.tsx (fait pour un tableau
 *  admin dense) : ici c'est juste une rangée parmi d'autres, pas l'écran
 *  principal de suivi, donc pas besoin de la même fréquence. */
private const val QUEUE_POLL_INTERVAL_MS = 4000L

/** Titre unifié film/série pour l'affichage des rangées — évite de dupliquer
 *  la Card pour deux types quasi identiques à l'écran. `internal` (pas
 *  `private`) : TitleDetailScreen réutilise TvTitleCard/TitleRow/PosterCard
 *  telles quelles pour sa rangée "Titres similaires", même style visuel que
 *  l'accueil plutôt qu'une variante dupliquée. */
internal data class TvTitleCard(
    val id: String,
    val title: String,
    val posterPath: String?,
    val backdropPath: String?,
    val tmdbId: Int,
    val isMovie: Boolean,
    /** Non-null uniquement pour une carte "Continuer à regarder" — affiche
     *  une fine barre de progression en bas du poster. */
    val progressPercent: Int? = null,
)

@Composable
fun HomeScreen(viewModel: AppViewModel, onOpenTitle: (type: String, tmdbId: Int) -> Unit) {
    val movies by viewModel.movies.collectAsState()
    val series by viewModel.series.collectAsState()
    val continueWatching by viewModel.continueWatching.collectAsState()
    val queue by viewModel.queue.collectAsState()
    val trendingMovies by viewModel.trendingMovies.collectAsState()
    val trendingSeries by viewModel.trendingSeries.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.loadLibrary()
        viewModel.loadContinueWatching()
        viewModel.loadDiscovery()
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
            TvTitleCard(it.tmdbId.toString(), it.title, it.posterPath, it.backdropPath, it.tmdbId, isMovie = true)
        }
    }
    val recentSeries = remember(series) {
        series.take(20).map {
            TvTitleCard(it.tmdbId.toString(), it.title, it.posterPath, it.backdropPath, it.tmdbId, isMovie = false)
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

    // Même idée que le hero cinématique du dashboard desktop (backdrop plein
    // écran + dégradé) — juste sans slideshow/rotation, un seul titre en
    // fond derrière les rangées plutôt qu'un aplat noir uni.
    val heroBackdrop = remember(recentMovies, recentSeries) {
        (recentMovies + recentSeries).firstOrNull { it.backdropPath != null }?.backdropPath
    }

    // Focus initial explicite sur la toute première carte poster — pas de
    // LaunchedEffect(Unit) ici car les rangées se peuplent après la réponse
    // réseau de loadLibrary() : on attend que la première rangée existe
    // réellement, une seule fois (hasRequestedInitialFocus), pour ne jamais
    // voler le focus à l'utilisateur lors d'un rafraîchissement ultérieur.
    val firstCardFocus = remember { FocusRequester() }
    var hasRequestedInitialFocus by remember { mutableStateOf(false) }
    LaunchedEffect(continueCards, recentMovies, recentSeries) {
        if (!hasRequestedInitialFocus && (continueCards.isNotEmpty() || recentMovies.isNotEmpty() || recentSeries.isNotEmpty())) {
            hasRequestedInitialFocus = true
            firstCardFocus.requestFocus()
        }
    }
    // La toute première rangée réellement affichée (Continuer > Films >
    // Séries, dans l'ordre où elles sont composées ci-dessous) est la seule
    // à recevoir le focus initial — sinon deux rangées se disputeraient le
    // même FocusRequester au premier rendu.
    val firstRealRowKey = when {
        continueCards.isNotEmpty() -> "continue"
        recentMovies.isNotEmpty() -> "movies"
        recentSeries.isNotEmpty() -> "series"
        else -> null
    }

    Box(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        if (heroBackdrop != null) {
            HeroBackdrop(backdropPath = heroBackdrop)
        }

        TvLazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(top = if (heroBackdrop != null) 360.dp else 48.dp, bottom = 48.dp),
        ) {
            item {
                Text(
                    text = "Movviz",
                    style = TextStyle(fontSize = 36.sp, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.primary),
                    modifier = Modifier.padding(start = 48.dp, bottom = 24.dp),
                )
            }

            if (queue.isNotEmpty()) {
                item { DownloadQueueRow(items = queue, onOpenTitle = onOpenTitle) }
            }

            if (continueCards.isNotEmpty()) {
                item {
                    TitleRow(
                        heading = "Continuer à regarder",
                        items = continueCards,
                        onClick = { card -> onOpenTitle(if (card.isMovie) "movie" else "series", card.tmdbId) },
                        firstItemFocusRequester = if (firstRealRowKey == "continue") firstCardFocus else null,
                    )
                }
            }

            if (recentMovies.isNotEmpty()) {
                item {
                    TitleRow(
                        heading = "Films",
                        items = recentMovies,
                        onClick = { card -> onOpenTitle("movie", card.tmdbId) },
                        firstItemFocusRequester = if (firstRealRowKey == "movies") firstCardFocus else null,
                    )
                }
            }

            if (recentSeries.isNotEmpty()) {
                item {
                    TitleRow(
                        heading = "Séries",
                        items = recentSeries,
                        onClick = { card -> onOpenTitle("series", card.tmdbId) },
                        firstItemFocusRequester = if (firstRealRowKey == "series") firstCardFocus else null,
                    )
                }
            }

            if (discoverCards.isNotEmpty()) {
                item {
                    TitleRow(
                        heading = "Découverte",
                        items = discoverCards,
                        onClick = { card -> onOpenTitle(if (card.isMovie) "movie" else "series", card.tmdbId) },
                    )
                }
            }

            if (recentMovies.isEmpty() && recentSeries.isEmpty()) {
                item {
                    Text(
                        text = "Chargement de ta bibliothèque…",
                        style = TextStyle(fontSize = 18.sp, color = MaterialTheme.colorScheme.onBackground),
                        modifier = Modifier.padding(start = 48.dp),
                    )
                }
            }
        }
    }
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

/** Backdrop en fond de l'accueil — lent zoom continu (façon Ken Burns) sous
 *  un double dégradé pour que le texte/les rangées restent lisibles, même
 *  traitement que la fiche titre et le hero desktop. */
@Composable
private fun HeroBackdrop(backdropPath: String) {
    val infinite = rememberInfiniteTransition(label = "hero_ken_burns")
    val zoom by infinite.animateFloat(
        initialValue = 1f,
        targetValue = 1.12f,
        animationSpec = infiniteRepeatable(tween(30000, easing = LinearEasing), RepeatMode.Reverse),
        label = "zoom",
    )

    Box(modifier = Modifier.fillMaxWidth().height(520.dp)) {
        Image(
            painter = rememberAsyncImagePainter(model = "$TMDB_BACKDROP_BASE$backdropPath"),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize().scale(zoom),
        )
        Box(
            modifier = Modifier.fillMaxSize().background(
                Brush.verticalGradient(
                    colors = listOf(
                        MaterialTheme.colorScheme.background.copy(alpha = 0.15f),
                        MaterialTheme.colorScheme.background.copy(alpha = 0.85f),
                        MaterialTheme.colorScheme.background,
                    ),
                ),
            ),
        )
        Box(
            modifier = Modifier.fillMaxSize().background(
                Brush.horizontalGradient(
                    colors = listOf(MaterialTheme.colorScheme.background.copy(alpha = 0.5f), Color.Transparent),
                ),
            ),
        )
    }
}

@Composable
internal fun TitleRow(
    heading: String,
    items: List<TvTitleCard>,
    onClick: (TvTitleCard) -> Unit,
    firstItemFocusRequester: FocusRequester? = null,
) {
    Column(modifier = Modifier.padding(bottom = 32.dp)) {
        Text(
            text = heading,
            style = TextStyle(fontSize = 20.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onBackground),
            modifier = Modifier.padding(start = 48.dp, bottom = 12.dp),
        )
        TvLazyRow(
            contentPadding = PaddingValues(horizontal = 48.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            itemsIndexed(items, key = { _, item -> item.id }) { index, card ->
                PosterCard(
                    card = card,
                    onClick = { onClick(card) },
                    focusRequester = if (index == 0) firstItemFocusRequester else null,
                )
            }
        }
    }
}

/** Carte poster — l'effet "focus" central du 10-foot UI : agrandissement +
 *  liseré au dégradé de marque quand la carte prend le focus D-pad. */
@Composable
internal fun PosterCard(card: TvTitleCard, onClick: () -> Unit, focusRequester: FocusRequester? = null) {
    var focused by remember { mutableStateOf(false) }
    val posterUrl = card.posterPath?.let { "$TMDB_IMAGE_BASE$it" }

    Column(modifier = Modifier.width(140.dp)) {
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
                .scale(if (focused) 1.12f else 1f)
                .onFocusChanged { focused = it.isFocused }
                .tvPointerClick(onClick),
            shape = androidx.tv.material3.ClickableSurfaceDefaults.shape(shape = RoundedCornerShape(10.dp)),
            colors = androidx.tv.material3.ClickableSurfaceDefaults.colors(containerColor = Color(0xFF1D1D2B)),
            border = androidx.tv.material3.ClickableSurfaceDefaults.border(
                focusedBorder = Border(
                    border = androidx.compose.foundation.BorderStroke(3.dp, MaterialTheme.colorScheme.primary),
                    shape = RoundedCornerShape(10.dp),
                ),
            ),
        ) {
            if (posterUrl != null) {
                val painter = rememberAsyncImagePainter(model = posterUrl)
                Image(
                    painter = painter,
                    contentDescription = card.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
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
        Text(
            text = card.title,
            style = TextStyle(fontSize = 13.sp, color = MaterialTheme.colorScheme.onBackground),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 6.dp),
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
            horizontalArrangement = Arrangement.spacedBy(16.dp),
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
    val shape = RoundedCornerShape(10.dp)

    Column(modifier = Modifier.width(140.dp)) {
        Surface(
            onClick = onClick,
            enabled = clickable,
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(2f / 3f)
                .scale(if (focused && clickable) 1.12f else 1f)
                .onFocusChanged { focused = it.isFocused }
                .let { if (clickable) it.tvPointerClick(onClick) else it },
            shape = androidx.tv.material3.ClickableSurfaceDefaults.shape(shape = shape),
            colors = androidx.tv.material3.ClickableSurfaceDefaults.colors(containerColor = Color(0xFF1D1D2B)),
            border = androidx.tv.material3.ClickableSurfaceDefaults.border(
                focusedBorder = Border(
                    border = androidx.compose.foundation.BorderStroke(3.dp, MaterialTheme.colorScheme.primary),
                    shape = shape,
                ),
            ),
        ) {
            Box(modifier = Modifier.fillMaxSize()) {
                if (posterUrl != null) {
                    Image(
                        painter = rememberAsyncImagePainter(model = posterUrl),
                        contentDescription = item.media.title,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
                    )
                }
                // Voile sombre + pastille de statut en haut, comme une carte
                // "en cours" plutôt qu'un poster fini — cohérent avec le
                // trio texte/bg/border des pastilles de statut (CLAUDE.md).
                Box(modifier = Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.28f)))
                StatusPill(
                    status = item.status,
                    modifier = Modifier.align(Alignment.TopStart).padding(8.dp),
                )
                Box(
                    modifier = Modifier
                        .align(Alignment.BottomStart)
                        .fillMaxWidth()
                        .height(4.dp)
                        .background(Color.White.copy(alpha = 0.15f)),
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(fraction = item.download.progress.toFloat().coerceIn(0f, 1f))
                            .fillMaxHeight()
                            .background(Brush.horizontalGradient(listOf(MovvizBrand, MovvizBrand2))),
                    )
                }
            }
        }
        Text(
            text = item.media.title,
            style = TextStyle(fontSize = 13.sp, color = MaterialTheme.colorScheme.onBackground),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 6.dp),
        )
        Text(
            text = downloadSubtitle(item),
            style = TextStyle(fontSize = 11.sp, color = Color.White.copy(alpha = 0.6f)),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
private fun StatusPill(status: String, modifier: Modifier = Modifier) {
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

private fun formatSpeed(bytesPerSec: Long): String? {
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

