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
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
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
import androidx.tv.foundation.lazy.list.items
import androidx.tv.material3.Border
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import coil.compose.rememberAsyncImagePainter
import com.movviz.tv.AppViewModel

private const val TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w342"
private const val TMDB_BACKDROP_BASE = "https://image.tmdb.org/t/p/original"

/** Titre unifié film/série pour l'affichage des rangées — évite de dupliquer
 *  la Card pour deux types quasi identiques à l'écran. */
private data class TvTitleCard(
    val id: String,
    val title: String,
    val posterPath: String?,
    val backdropPath: String?,
    val tmdbId: Int,
    val isMovie: Boolean,
)

@Composable
fun HomeScreen(viewModel: AppViewModel, onOpenTitle: (type: String, tmdbId: Int) -> Unit) {
    val movies by viewModel.movies.collectAsState()
    val series by viewModel.series.collectAsState()

    LaunchedEffect(Unit) { viewModel.loadLibrary() }

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
    // Même idée que le hero cinématique du dashboard desktop (backdrop plein
    // écran + dégradé) — juste sans slideshow/rotation, un seul titre en
    // fond derrière les rangées plutôt qu'un aplat noir uni.
    val heroBackdrop = remember(recentMovies, recentSeries) {
        (recentMovies + recentSeries).firstOrNull { it.backdropPath != null }?.backdropPath
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
                    )
                }
            }

            if (recentSeries.isNotEmpty()) {
                item {
                    TitleRow(
                        heading = "Séries",
                        items = recentSeries,
                        onClick = { card -> onOpenTitle("series", card.tmdbId) },
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
private fun TitleRow(heading: String, items: List<TvTitleCard>, onClick: (TvTitleCard) -> Unit) {
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
            items(items, key = { it.id }) { card ->
                PosterCard(card = card, onClick = { onClick(card) })
            }
        }
    }
}

/** Carte poster — l'effet "focus" central du 10-foot UI : agrandissement +
 *  liseré au dégradé de marque quand la carte prend le focus D-pad. */
@Composable
private fun PosterCard(card: TvTitleCard, onClick: () -> Unit) {
    var focused by remember { mutableStateOf(false) }
    val posterUrl = card.posterPath?.let { "$TMDB_IMAGE_BASE$it" }

    Column(modifier = Modifier.width(140.dp)) {
        // Surface (tv-material3) gère nativement le focus D-pad + le clic
        // OK — c'est ce qui rend la carte réellement navigable, contrairement
        // à un simple Box/Column avec juste onFocusChanged.
        Surface(
            onClick = onClick,
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(2f / 3f)
                .scale(if (focused) 1.12f else 1f)
                .onFocusChanged { focused = it.isFocused },
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
