package com.movviz.tv.ui.home

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
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
import com.movviz.tv.ui.theme.MovvizSurfaceStrong
import com.movviz.tv.ui.theme.RatingBadge
import com.movviz.tv.ui.theme.StatusPill
import com.movviz.tv.ui.theme.tvPointerClick

private const val TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w342"
private const val TMDB_BACKDROP_BASE = "https://image.tmdb.org/t/p/original"

/** Titre unifié film/série pour l'affichage des rangées — évite de dupliquer
 *  la Card pour deux types quasi identiques à l'écran. `status` est null
 *  pour les séries : contrairement aux films, l'API ne renvoie aucun champ
 *  de statut au niveau série (voir le commentaire sur LibrarySeriesDto) donc
 *  la pastille de statut ne s'affiche que sur les posters film. */
private data class TvTitleCard(
    val id: String,
    val title: String,
    val posterPath: String?,
    val backdropPath: String?,
    val tmdbId: Int,
    val isMovie: Boolean,
    val rating: Double,
    val status: String?,
)

@Composable
fun HomeScreen(viewModel: AppViewModel, onOpenTitle: (type: String, tmdbId: Int) -> Unit) {
    val movies by viewModel.movies.collectAsState()
    val series by viewModel.series.collectAsState()

    LaunchedEffect(Unit) { viewModel.loadLibrary() }

    val recentMovies = remember(movies) {
        movies.take(20).map {
            TvTitleCard(it.tmdbId.toString(), it.title, it.posterPath, it.backdropPath, it.tmdbId, isMovie = true, rating = it.rating, status = it.status)
        }
    }
    val recentSeries = remember(series) {
        series.take(20).map {
            TvTitleCard(it.tmdbId.toString(), it.title, it.posterPath, it.backdropPath, it.tmdbId, isMovie = false, rating = it.rating, status = null)
        }
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
    LaunchedEffect(recentMovies, recentSeries) {
        if (!hasRequestedInitialFocus && (recentMovies.isNotEmpty() || recentSeries.isNotEmpty())) {
            hasRequestedInitialFocus = true
            firstCardFocus.requestFocus()
        }
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

            if (recentMovies.isNotEmpty()) {
                item {
                    TitleRow(
                        heading = "Films",
                        items = recentMovies,
                        onClick = { card -> onOpenTitle("movie", card.tmdbId) },
                        firstItemFocusRequester = firstCardFocus,
                    )
                }
            }

            if (recentSeries.isNotEmpty()) {
                item {
                    TitleRow(
                        heading = "Séries",
                        items = recentSeries,
                        onClick = { card -> onOpenTitle("series", card.tmdbId) },
                        // La rangée Films passe déjà le requester si elle
                        // existe — seule la toute première rangée réelle
                        // (Séries si aucun film) doit recevoir le focus initial.
                        firstItemFocusRequester = if (recentMovies.isEmpty()) firstCardFocus else null,
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
