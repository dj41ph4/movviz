package com.movviz.mobile.library

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Movie
import androidx.compose.material.icons.rounded.Tv
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.movviz.mobile.MobileViewModel
import com.movviz.mobile.ui.theme.MovvizAmber
import com.movviz.mobile.ui.theme.MovvizBrand
import com.movviz.mobile.ui.theme.MovvizBrand2
import com.movviz.mobile.ui.theme.MovvizCyan
import com.movviz.mobile.ui.theme.MovvizDown
import com.movviz.mobile.ui.theme.MovvizInk
import com.movviz.mobile.ui.theme.MovvizInkDim
import com.movviz.mobile.ui.theme.MovvizInkSoft
import com.movviz.mobile.ui.theme.MovvizSurface
import com.movviz.mobile.ui.theme.MovvizSurfaceStrong
import com.movviz.tv.data.LibraryMovieDto
import com.movviz.tv.data.LibrarySeriesDto

private const val POSTER_SM = "https://image.tmdb.org/t/p/w342"
private val CardShape = RoundedCornerShape(14.dp)

private enum class LibrarySort(val label: String) {
    NAME("Nom"),
    RATING("Note"),
    YEAR("Année"),
}

private data class LibraryCard(
    val tmdbId: Int,
    val title: String,
    val posterPath: String?,
    val rating: Double,
    val year: Int?,
    val genres: List<String>,
    val isMovie: Boolean,
    val status: String?,
)

/**
 * Bibliothèque : catalogue local complet, triable (nom/note/année) et
 * filtrable par genre — même principe que l'écran Films/Séries de la
 * version TV (CatalogScreen.kt), remplace le placeholder "Ma liste" jamais
 * implémenté. Découverte reste l'écran pour trouver du contenu à AJOUTER ;
 * celui-ci est l'inventaire de ce qui est déjà dans la bibliothèque.
 */
@Composable
fun LibraryScreen(padding: PaddingValues, vm: MobileViewModel, onTitleClick: (String, Int) -> Unit) {
    val movies by vm.movies.collectAsState()
    val series by vm.series.collectAsState()

    var isMovies by remember { mutableStateOf(true) }
    var sort by remember { mutableStateOf(LibrarySort.NAME) }
    var selectedGenre by remember { mutableStateOf<String?>(null) }

    val cards = remember(movies, series, isMovies) {
        if (isMovies) {
            movies.map { LibraryCard(it.tmdbId, it.title, it.posterPath, it.rating, it.year, it.genres, true, it.status) }
        } else {
            series.map { LibraryCard(it.tmdbId, it.title, it.posterPath, it.rating, it.year, it.genres, false, null) }
        }
    }
    val genres = remember(cards) { cards.flatMap { it.genres }.distinct().sorted() }
    val filtered = remember(cards, selectedGenre) {
        if (selectedGenre == null) cards else cards.filter { selectedGenre in it.genres }
    }
    val sorted = remember(filtered, sort) {
        when (sort) {
            LibrarySort.NAME -> filtered.sortedBy { it.title.lowercase() }
            LibrarySort.RATING -> filtered.sortedByDescending { it.rating }
            LibrarySort.YEAR -> filtered.sortedByDescending { it.year ?: 0 }
        }
    }

    Column(Modifier.fillMaxSize().background(Color.Black)) {
        Column(Modifier.statusBarsPadding().padding(start = 20.dp, end = 20.dp, top = 12.dp, bottom = 10.dp)) {
            Text("Bibliothèque", color = MovvizInk, fontSize = 26.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.4).sp)
            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TypePill("Films", Icons.Rounded.Movie, isMovies) { isMovies = true; selectedGenre = null }
                TypePill("Séries", Icons.Rounded.Tv, !isMovies) { isMovies = false; selectedGenre = null }
            }
        }
        Row(Modifier.padding(horizontal = 20.dp).padding(bottom = 10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            LibrarySort.entries.forEach { option ->
                SortChip(option.label, sort == option) { sort = option }
            }
        }
        if (genres.isNotEmpty()) {
            LazyRow(
                contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(genres) { g ->
                    GenreChip(g, selectedGenre == g) { selectedGenre = if (selectedGenre == g) null else g }
                }
            }
        }
        when {
            sorted.isEmpty() -> Box(Modifier.fillMaxSize().padding(top = 40.dp), contentAlignment = Alignment.TopCenter) {
                Text("Aucun titre pour le moment", color = MovvizInkDim, fontSize = 13.sp)
            }
            else -> LazyVerticalGrid(
                columns = GridCells.Fixed(3),
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = padding.calculateBottomPadding() + 24.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                items(sorted, key = { "${it.isMovie}-${it.tmdbId}" }) { c ->
                    LibraryPosterCard(c, onClick = { onTitleClick(if (c.isMovie) "movie" else "series", c.tmdbId) })
                }
            }
        }
    }
}

@Composable
private fun TypePill(label: String, icon: androidx.compose.ui.graphics.vector.ImageVector, active: Boolean, onClick: () -> Unit) {
    Row(
        Modifier.clip(RoundedCornerShape(12.dp))
            .background(if (active) Brush.linearGradient(listOf(MovvizBrand, MovvizBrand2)) else Brush.linearGradient(listOf(MovvizSurfaceStrong, MovvizSurfaceStrong)))
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Icon(icon, null, tint = if (active) Color.White else MovvizInkSoft, modifier = Modifier.size(15.dp))
        Text(label, color = if (active) Color.White else MovvizInkSoft, fontSize = 13.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun SortChip(label: String, active: Boolean, onClick: () -> Unit) {
    Box(
        Modifier.clip(RoundedCornerShape(50))
            .background(if (active) Color.White.copy(0.18f) else Color.White.copy(0.06f))
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 7.dp),
    ) {
        Text(label, color = if (active) Color.White else MovvizInkSoft, fontSize = 12.sp, fontWeight = if (active) FontWeight.Bold else FontWeight.SemiBold)
    }
}

@Composable
private fun GenreChip(label: String, active: Boolean, onClick: () -> Unit) {
    Box(
        Modifier.clip(RoundedCornerShape(50))
            .background(if (active) MovvizInk.copy(0.9f) else MovvizInk.copy(0.08f))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 6.dp),
    ) {
        Text(label, color = if (active) Color.Black else MovvizInkSoft, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun LibraryPosterCard(card: LibraryCard, onClick: () -> Unit) {
    Column(Modifier.fillMaxWidth().clickable(onClick = onClick)) {
        Box(Modifier.fillMaxWidth().aspectRatio(2f / 3f).clip(CardShape).background(MovvizSurfaceStrong)) {
            if (card.posterPath != null) {
                AsyncImage(POSTER_SM + card.posterPath, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
            } else {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text("○", color = MovvizInkDim, fontSize = 20.sp) }
            }
            card.status?.let { status ->
                if (status != "available") {
                    val (label, color) = when (status) {
                        "downloading", "searching" -> "..." to MovvizAmber
                        "missing" -> "Manquant" to MovvizDown
                        "upcoming" -> "À venir" to MovvizAmber
                        else -> status to MovvizInkDim
                    }
                    Box(
                        Modifier.align(Alignment.TopEnd).padding(6.dp).clip(RoundedCornerShape(6.dp))
                            .background(Color.Black.copy(0.65f)).padding(horizontal = 6.dp, vertical = 2.dp),
                    ) {
                        Text(label, color = color, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
        Spacer(Modifier.height(6.dp))
        Text(card.title, color = MovvizInk, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
        if (card.rating > 0) Text("★ ${"%.1f".format(card.rating)}", color = MovvizInkDim, fontSize = 11.sp)
    }
}
