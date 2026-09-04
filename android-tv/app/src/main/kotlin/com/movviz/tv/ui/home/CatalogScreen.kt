package com.movviz.tv.ui.home

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.foundation.lazy.grid.TvGridCells
import androidx.tv.foundation.lazy.grid.TvLazyVerticalGrid
import androidx.tv.foundation.lazy.grid.itemsIndexed
import androidx.tv.material3.Border
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import com.movviz.tv.AppViewModel
import com.movviz.tv.data.GenreDto
import com.movviz.tv.ui.theme.MovvizInk
import com.movviz.tv.ui.theme.MovvizInkDim
import com.movviz.tv.ui.theme.MovvizInkSoft
import com.movviz.tv.ui.theme.tvFocusLift
import com.movviz.tv.ui.theme.tvPointerClick

private enum class CatalogSort(val label: String) {
    NAME("Nom"),
    RATING("Note"),
    YEAR("Année"),
}

/**
 * Catalogue Films/Séries TV : bibliothèque complète en grille, triable
 * (nom/note/année) et filtrable par genre — Découverte (DiscoverScreen)
 * couvre désormais le hero et les rangées éditoriales façon Netflix ; cet
 * écran-ci est le vrai inventaire, demandé en direct comme "une liste
 * complète de la bibliothèque avec tri par genre nom note etc".
 */
@Composable
fun CatalogScreen(
    viewModel: AppViewModel,
    type: HomeTab,
    onOpenTitle: (String, Int) -> Unit,
    entryFocusRequester: FocusRequester? = null,
) {
    val movies by viewModel.movies.collectAsState()
    val series by viewModel.series.collectAsState()
    val movieGenres by viewModel.movieGenres.collectAsState()
    val seriesGenres by viewModel.seriesGenres.collectAsState()
    val heroLogos by viewModel.heroLogos.collectAsState()
    LaunchedEffect(Unit) { viewModel.loadLibrary() }
    val wantedType = if (type == HomeTab.MOVIES) "movie" else "series"
    LaunchedEffect(wantedType) { viewModel.loadGenres(wantedType) }
    val genres = if (type == HomeTab.MOVIES) movieGenres else seriesGenres

    val cards = remember(movies, series, type) {
        if (type == HomeTab.MOVIES) {
            movies.map { TvTitleCard(it.id, it.title, it.posterPath, it.backdropPath, it.tmdbId, true, it.year, it.rating, it.genres, it.status, qualityLabel = resolutionLabelForCatalog(it.file?.resolution), hasHdr = !it.file?.hdr.isNullOrBlank()) }
        } else {
            series.map { TvTitleCard(it.id, it.title, it.posterPath, it.backdropPath, it.tmdbId, false, it.year, it.rating, it.genres) }
        }
    }

    var sort by remember(type) { mutableStateOf(CatalogSort.NAME) }
    var selectedGenre by remember(type) { mutableStateOf<CatalogGenreSelection?>(null) }

    val filtered = remember(cards, selectedGenre) {
        val selection = selectedGenre
        if (selection == null) cards else cards.filter { cardMatchesCatalogGenre(it, selection) }
    }
    val sorted = remember(filtered, sort) {
        when (sort) {
            CatalogSort.NAME -> filtered.sortedBy { it.title.lowercase() }
            CatalogSort.RATING -> filtered.sortedByDescending { it.rating }
            CatalogSort.YEAR -> filtered.sortedByDescending { it.year ?: 0 }
        }
    }

    val topAnchor = remember { FocusRequester() }

    Column(Modifier.fillMaxSize().padding(start = 48.dp, top = 96.dp, end = 48.dp, bottom = 30.dp)) {
        Text(
            text = "${type.label} · ${sorted.size}",
            style = TextStyle(fontSize = 28.sp, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.onBackground),
        )
        androidx.compose.foundation.layout.Spacer(modifier = Modifier.height(18.dp))
        SortRow(sort = sort, onSelect = { sort = it })
        androidx.compose.foundation.layout.Spacer(modifier = Modifier.height(14.dp))
        if (genres.isNotEmpty()) {
            CatalogGenreRow(genres = genres, selected = selectedGenre, onSelect = { selectedGenre = if (selectedGenre?.key == it.key) null else it })
            androidx.compose.foundation.layout.Spacer(modifier = Modifier.height(20.dp))
        }
        when {
            sorted.isEmpty() -> Box(
                modifier = Modifier.fillMaxWidth().padding(top = 24.dp)
                    .focusRequester(entryFocusRequester ?: topAnchor).focusable(),
            ) {
                Text(text = "Aucun titre pour le moment", color = MovvizInkDim, style = TextStyle(fontSize = 15.sp))
            }
            else -> TvLazyVerticalGrid(
                columns = TvGridCells.Adaptive(minSize = 230.dp),
                horizontalArrangement = Arrangement.spacedBy(14.dp),
                verticalArrangement = Arrangement.spacedBy(18.dp),
                modifier = Modifier.fillMaxSize(),
            ) {
                itemsIndexed(sorted, key = { _, c -> c.id }, contentType = { _, _ -> "card" }) { index, card ->
                    PosterCard(
                        card = card,
                        onClick = { onOpenTitle(if (card.isMovie) "movie" else "series", card.tmdbId) },
                        focusRequester = if (index == 0) entryFocusRequester else null,
                        // Même principe que les rangées Netflix : affiche
                        // portrait sans logo au repos, logo officiel posé
                        // dessus au focus — mais la carte NE grandit PAS en
                        // paysage ici (grille verticale, pas de rangée : un
                        // agrandissement décalerait les cartes voisines).
                        aspectRatio = 2f / 3f,
                        preferPosterArt = true,
                        showCaption = false,
                        titleLogoPath = heroLogos["${if (card.isMovie) "movie" else "series"}-${card.tmdbId}"],
                        onFocusedChange = { focused ->
                            if (focused) viewModel.requestHeroLogo(if (card.isMovie) "movie" else "series", card.tmdbId)
                        },
                    )
                }
            }
        }
    }
}

@Composable
private fun SortRow(sort: CatalogSort, onSelect: (CatalogSort) -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        CatalogSort.entries.forEach { option ->
            SortChip(label = option.label, active = sort == option, onClick = { onSelect(option) })
        }
    }
}

@Composable
private fun SortChip(label: String, active: Boolean, onClick: () -> Unit) {
    var focused by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(50)
    Surface(
        onClick = onClick,
        modifier = Modifier.onFocusChanged { focused = it.isFocused }.tvPointerClick(onClick),
        shape = ClickableSurfaceDefaults.shape(shape = shape),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = if (active) Color.White.copy(alpha = 0.20f) else Color.White.copy(alpha = 0.06f),
            focusedContainerColor = Color.White.copy(alpha = 0.26f),
            contentColor = if (active) Color.White else MovvizInkSoft,
            focusedContentColor = Color.White,
        ),
        border = ClickableSurfaceDefaults.border(
            focusedBorder = Border(border = androidx.compose.foundation.BorderStroke(2.dp, Color.White.copy(alpha = 0.75f)), shape = shape),
        ),
    ) {
        Text(
            text = label,
            style = TextStyle(fontSize = 13.sp, fontWeight = if (active) FontWeight.Bold else FontWeight.SemiBold),
            modifier = Modifier.padding(horizontal = 18.dp, vertical = 8.dp),
        )
    }
}

private data class CatalogGenreSelection(val key: String, val label: String)
private val SYNTHETIC_GENRES = listOf("anime" to "Anime", "teen" to "Romance ado")

private fun normalizedGenre(value: String): String =
    java.text.Normalizer.normalize(value, java.text.Normalizer.Form.NFD)
        .replace("\\p{M}+".toRegex(), "")
        .trim()
        .lowercase()

private fun cardMatchesCatalogGenre(card: TvTitleCard, selection: CatalogGenreSelection): Boolean {
    val names = card.genres.map(::normalizedGenre).toSet()
    return when (selection.key) {
        "anime" -> "animation" in names || "anime" in names
        "teen" -> {
            val family = "familial" in names || "family" in names || "kids" in names
            if (family) false
            else if (card.isMovie) {
                "romance" in names && ("comedie" in names || "comedy" in names || "drame" in names || "drama" in names)
            } else {
                "soap" in names || (("drame" in names || "drama" in names) && ("comedie" in names || "comedy" in names))
            }
        }
        else -> normalizedGenre(selection.label) in names
    }
}

@Composable
private fun CatalogGenreRow(genres: List<GenreDto>, selected: CatalogGenreSelection?, onSelect: (CatalogGenreSelection) -> Unit) {
    LazyRow(
        contentPadding = PaddingValues(end = 24.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        items(SYNTHETIC_GENRES, key = { "synth-${it.first}" }) { (id, label) ->
            val value = CatalogGenreSelection(id, label)
            CatalogGenreChip(label = label, active = selected?.key == id, onClick = { onSelect(value) })
        }
        items(genres, key = { "tmdb-${it.id}" }) { g ->
            val value = CatalogGenreSelection(g.id.toString(), g.name)
            CatalogGenreChip(label = g.name, active = selected?.key == value.key, onClick = { onSelect(value) })
        }
    }
}

@Composable
private fun CatalogGenreChip(label: String, active: Boolean, onClick: () -> Unit) {
    var focused by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(50)
    Surface(
        onClick = onClick,
        modifier = Modifier
            .tvFocusLift(focused, shape = shape, maxScale = 1.04f)
            .onFocusChanged { focused = it.isFocused }
            .tvPointerClick(onClick),
        shape = ClickableSurfaceDefaults.shape(shape = shape),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = if (active) MovvizInk.copy(alpha = 0.9f) else MovvizInk.copy(alpha = 0.08f),
            contentColor = if (active) Color.White else MovvizInk,
        ),
        border = ClickableSurfaceDefaults.border(
            focusedBorder = Border(border = androidx.compose.foundation.BorderStroke(2.dp, Color.White.copy(alpha = 0.85f)), shape = shape),
        ),
    ) {
        Text(
            text = label,
            style = TextStyle(fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = if (focused || active) Color.White else MovvizInkSoft),
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
        )
    }
}

private fun resolutionLabelForCatalog(resolution: String?): String? = when {
    resolution == null -> null
    resolution.startsWith("2160") -> "4K"
    resolution.startsWith("1080") -> "1080p"
    resolution.startsWith("720") -> "720p"
    else -> resolution
}
