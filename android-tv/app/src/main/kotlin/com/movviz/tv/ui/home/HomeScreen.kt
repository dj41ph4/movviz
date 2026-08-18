package com.movviz.tv.ui.home

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.tween
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
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
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import coil.compose.rememberAsyncImagePainter
import com.movviz.tv.AppViewModel
import com.movviz.tv.ui.theme.MovvizBrand
import com.movviz.tv.ui.theme.MovvizBrand2
import com.movviz.tv.ui.theme.MovvizInk
import com.movviz.tv.ui.theme.MovvizInkSoft
import com.movviz.tv.ui.theme.MovvizSurfaceStrong
import com.movviz.tv.ui.theme.RatingBadge
import com.movviz.tv.ui.theme.StatusPill
import com.movviz.tv.ui.theme.tvPointerClick
import kotlinx.coroutines.delay

private const val TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w342"
private const val TMDB_BACKDROP_BASE = "https://image.tmdb.org/t/p/original"
private const val HERO_ROTATE_MS = 8_000L
private const val HERO_COUNT = 5

/** Titre unifié film/série pour l'affichage des rangées et du hero — évite de
 *  dupliquer la Card pour deux types quasi identiques à l'écran. `status` est
 *  null pour les séries : contrairement aux films, l'API ne renvoie aucun
 *  champ de statut au niveau série (voir le commentaire sur LibrarySeriesDto)
 *  donc la pastille de statut ne s'affiche que sur les posters film. */
private data class TvTitleCard(
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
)

@Composable
fun HomeScreen(viewModel: AppViewModel, onOpenTitle: (type: String, tmdbId: Int) -> Unit) {
    val movies by viewModel.movies.collectAsState()
    val series by viewModel.series.collectAsState()

    LaunchedEffect(Unit) { viewModel.loadLibrary() }

    val recentMovies = remember(movies) {
        movies.take(20).map {
            TvTitleCard(it.tmdbId.toString(), it.title, it.posterPath, it.backdropPath, it.tmdbId, isMovie = true, year = it.year, rating = it.rating, genres = it.genres, status = it.status)
        }
    }
    val recentSeries = remember(series) {
        series.take(20).map {
            TvTitleCard(it.tmdbId.toString(), it.title, it.posterPath, it.backdropPath, it.tmdbId, isMovie = false, year = it.year, rating = it.rating, genres = it.genres, status = null)
        }
    }

    // Vedettes du hero — les titres les mieux notés avec un backdrop
    // exploitable, façon "Featured" Netflix plutôt qu'un ordre d'ajout brut.
    val heroItems = remember(recentMovies, recentSeries) {
        (recentMovies + recentSeries)
            .filter { it.backdropPath != null }
            .sortedByDescending { it.rating }
            .take(HERO_COUNT)
    }

    var heroIndex by remember { mutableStateOf(0) }
    LaunchedEffect(heroItems) {
        if (heroItems.size < 2) return@LaunchedEffect
        while (true) {
            delay(HERO_ROTATE_MS)
            heroIndex = (heroIndex + 1) % heroItems.size
        }
    }

    // Focus initial sur le CTA du hero (comme Netflix : le premier appui
    // D-pad joue/ouvre directement la vedette), pas sur une carte de rangée.
    // Attend que le hero existe réellement (après le chargement réseau) et
    // ne redemande jamais le focus ensuite pour ne pas voler le focus de
    // l'utilisateur à chaque rotation ou rafraîchissement.
    val heroCtaFocus = remember { FocusRequester() }
    val firstCardFocus = remember { FocusRequester() }
    var hasRequestedInitialFocus by remember { mutableStateOf(false) }
    LaunchedEffect(heroItems, recentMovies, recentSeries) {
        if (hasRequestedInitialFocus) return@LaunchedEffect
        if (heroItems.isNotEmpty()) {
            hasRequestedInitialFocus = true
            heroCtaFocus.requestFocus()
        } else if (recentMovies.isNotEmpty() || recentSeries.isNotEmpty()) {
            hasRequestedInitialFocus = true
            firstCardFocus.requestFocus()
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        TvLazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 48.dp),
        ) {
            if (heroItems.isNotEmpty()) {
                item {
                    HeroCarousel(
                        items = heroItems,
                        currentIndex = heroIndex,
                        onSelectIndex = { heroIndex = it },
                        ctaFocusRequester = heroCtaFocus,
                        onOpen = { card -> onOpenTitle(if (card.isMovie) "movie" else "series", card.tmdbId) },
                    )
                }
            } else {
                item {
                    Text(
                        text = "Movviz",
                        style = TextStyle(fontSize = 36.sp, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.primary),
                        modifier = Modifier.padding(start = 48.dp, top = 48.dp, bottom = 24.dp),
                    )
                }
            }

            if (recentMovies.isNotEmpty()) {
                item {
                    TitleRow(
                        heading = "Films",
                        items = recentMovies,
                        onClick = { card -> onOpenTitle("movie", card.tmdbId) },
                        firstItemFocusRequester = if (heroItems.isEmpty()) firstCardFocus else null,
                    )
                }
            }

            if (recentSeries.isNotEmpty()) {
                item {
                    TitleRow(
                        heading = "Séries",
                        items = recentSeries,
                        onClick = { card -> onOpenTitle("series", card.tmdbId) },
                        firstItemFocusRequester = if (heroItems.isEmpty() && recentMovies.isEmpty()) firstCardFocus else null,
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

/** Vedette plein écran en rotation automatique — backdrop en Ken Burns lent,
 *  titre/méta/synopsis-less (pas de synopsis ici, la fiche titre s'en charge),
 *  CTA "Lire"/"Voir la fiche" et indicateurs de progression cliquables, façon
 *  bannière "Featured" Netflix plutôt que le simple aplat statique d'avant. */
@Composable
private fun HeroCarousel(
    items: List<TvTitleCard>,
    currentIndex: Int,
    onSelectIndex: (Int) -> Unit,
    ctaFocusRequester: FocusRequester,
    onOpen: (TvTitleCard) -> Unit,
) {
    val current = items[currentIndex.coerceIn(0, items.size - 1)]

    // clipToBounds() est indispensable ici : le zoom Ken Burns agrandit
    // l'image avec scale() (une transformation de dessin, pas de layout) et
    // Compose ne rogne rien par défaut — sans ça l'image zoomée déborde
    // visiblement de la bannière et empiète sur les rangées en dessous.
    Box(modifier = Modifier.fillMaxWidth().height(640.dp).clipToBounds()) {
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
                modifier = Modifier.fillMaxSize().scale(zoom),
            )
        }

        Box(
            modifier = Modifier.fillMaxSize().background(
                Brush.verticalGradient(
                    colors = listOf(
                        Color.Transparent,
                        MaterialTheme.colorScheme.background.copy(alpha = 0.55f),
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

        Column(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(start = 48.dp, end = 48.dp, bottom = 40.dp)
                .widthIn(max = 760.dp),
        ) {
            Text(
                text = if (current.isMovie) "FILM" else "SÉRIE",
                style = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.Bold, color = MovvizBrand2, letterSpacing = 2.sp),
            )
            Spacer(modifier = Modifier.height(10.dp))
            Text(
                text = current.title,
                style = TextStyle(fontSize = 44.sp, fontWeight = FontWeight.Black, color = MovvizInk),
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            Spacer(modifier = Modifier.height(10.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (current.rating > 0) {
                    Text(text = "★ ${"%.1f".format(current.rating)}", style = TextStyle(fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Color(0xFFF5C542)))
                    Spacer(modifier = Modifier.width(10.dp))
                }
                current.year?.let {
                    Text(text = "$it", style = TextStyle(fontSize = 15.sp, color = MovvizInkSoft))
                    Spacer(modifier = Modifier.width(10.dp))
                }
                if (current.genres.isNotEmpty()) {
                    Text(
                        text = current.genres.take(3).joinToString(", "),
                        style = TextStyle(fontSize = 15.sp, color = MovvizInkSoft),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
            Spacer(modifier = Modifier.height(24.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                var focused by remember(current.id) { mutableStateOf(false) }
                Surface(
                    onClick = { onOpen(current) },
                    modifier = Modifier
                        .focusRequester(ctaFocusRequester)
                        .scale(if (focused) 1.06f else 1f)
                        .onFocusChanged { focused = it.isFocused }
                        .tvPointerClick { onOpen(current) },
                    shape = ClickableSurfaceDefaults.shape(shape = RoundedCornerShape(12.dp)),
                    colors = ClickableSurfaceDefaults.colors(containerColor = Color.White, contentColor = Color.Black),
                    border = ClickableSurfaceDefaults.border(
                        focusedBorder = Border(border = androidx.compose.foundation.BorderStroke(3.dp, MovvizBrand), shape = RoundedCornerShape(12.dp)),
                    ),
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(horizontal = 28.dp, vertical = 14.dp),
                    ) {
                        Text(text = "▶", style = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Color.Black))
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(text = "Voir la fiche", style = TextStyle(fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Color.Black))
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

@Composable
private fun TitleRow(
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
private fun PosterCard(card: TvTitleCard, onClick: () -> Unit, focusRequester: FocusRequester? = null) {
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
                // Même intensité de zoom que la carte résultat de recherche
                // (SearchResultCard) — avant, l'accueil grossissait plus fort
                // (1.12) que la recherche (1.08) pour la même carte poster.
                .scale(if (focused) 1.08f else 1f)
                .onFocusChanged { focused = it.isFocused }
                .tvPointerClick(onClick),
            shape = androidx.tv.material3.ClickableSurfaceDefaults.shape(shape = RoundedCornerShape(10.dp)),
            colors = androidx.tv.material3.ClickableSurfaceDefaults.colors(containerColor = MovvizSurfaceStrong),
            border = androidx.tv.material3.ClickableSurfaceDefaults.border(
                focusedBorder = Border(
                    border = androidx.compose.foundation.BorderStroke(3.dp, MaterialTheme.colorScheme.primary),
                    shape = RoundedCornerShape(10.dp),
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
                }
                // Même paire de pastilles que la grille bibliothèque desktop
                // (note ★ en haut-gauche, statut en bas-gauche) — voir
                // ui/theme/Badges.kt. Le statut n'existe que pour les films
                // (LibrarySeriesDto n'a pas ce champ côté API, voir plus
                // haut) donc absent pour une carte série.
                RatingBadge(
                    rating = card.rating,
                    modifier = Modifier.align(Alignment.TopStart).padding(6.dp),
                )
                card.status?.let { status ->
                    StatusPill(
                        status = status,
                        modifier = Modifier.align(Alignment.BottomStart).padding(6.dp),
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
