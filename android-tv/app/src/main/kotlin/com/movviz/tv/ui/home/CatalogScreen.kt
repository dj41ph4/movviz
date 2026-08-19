package com.movviz.tv.ui.home

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.tv.foundation.lazy.list.TvLazyColumn
import androidx.tv.foundation.lazy.list.items
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.sp
import com.movviz.tv.AppViewModel

/** Catalogue Films/Séries TV : même carte et même statut que l'accueil,
 * mais avec une destination dédiée utilisable au D-pad. */
@Composable
fun CatalogScreen(viewModel: AppViewModel, type: HomeTab, onOpenTitle: (String, Int) -> Unit) {
    val movies by viewModel.movies.collectAsState()
    val series by viewModel.series.collectAsState()
    val movieRows by viewModel.movieRows.collectAsState()
    val seriesRows by viewModel.seriesRows.collectAsState()
    val editorialRows = if (type == HomeTab.MOVIES) movieRows else seriesRows
    LaunchedEffect(Unit) {
        viewModel.loadLibrary()
        viewModel.loadDiscovery()
    }
    val cards = if (type == HomeTab.MOVIES) {
        movies.map { TvTitleCard(it.id, it.title, it.posterPath, it.backdropPath, it.tmdbId, true, it.year, it.rating, it.genres, it.status, qualityLabel = resolutionLabelForCatalog(it.file?.resolution), hasHdr = !it.file?.hdr.isNullOrBlank()) }
    } else {
        series.map { TvTitleCard(it.id, it.title, it.posterPath, it.backdropPath, it.tmdbId, false, it.year, it.rating, it.genres) }
    }
    val editorial = editorialRows.mapNotNull { row ->
        val rowCards = row.results.map {
            TvTitleCard("${row.key}-${it.type}-${it.tmdbId}", it.title, it.posterPath, null, it.tmdbId,
                isMovie = it.type == "movie", year = it.year, rating = it.rating)
        }
        if (rowCards.isEmpty()) null else row.key to rowCards
    }
    val rows = buildList {
        addAll(editorial)
        if (cards.isNotEmpty()) add("library" to cards)
    }
    Column(Modifier.fillMaxSize().padding(top = 18.dp)) {
        Text(type.label, style = TextStyle(fontSize = 30.sp, color = MaterialTheme.colorScheme.onBackground), modifier = Modifier.padding(start = 64.dp, bottom = 18.dp))
        if (rows.isEmpty()) Text("Aucun titre pour le moment", color = MaterialTheme.colorScheme.onBackground, modifier = Modifier.padding(start = 64.dp))
        else TvLazyColumn(Modifier.fillMaxSize()) {
            items(rows.size) { index ->
                val (key, rowCards) = rows[index]
                TitleRow(
                    heading = if (key == "library") type.label else catalogRowLabel(key),
                    items = rowCards,
                    onClick = { onOpenTitle(if (it.isMovie) "movie" else "series", it.tmdbId) },
                )
            }
        }
    }
}

private fun catalogRowLabel(key: String): String = when (key) {
    "recommendedTop" -> "Sélection pour vous"
    "trendingPopular", "trending" -> "Tendances"
    "upcoming", "upcomingVod" -> "Prochainement"
    "onAir" -> "En ce moment"
    "newSeriesRenewed" -> "Nouvelles séries et renouvellements"
    "nowPlayingBoxOffice" -> "En salles"
    "kids" -> "Jeunesse"
    else -> key.replace(Regex("([a-z])([A-Z])"), "$1 $2").replaceFirstChar { it.uppercase() }
}

private fun resolutionLabelForCatalog(resolution: String?): String? = when {
    resolution == null -> null
    resolution.startsWith("2160") -> "4K"
    resolution.startsWith("1080") -> "1080p"
    resolution.startsWith("720") -> "720p"
    else -> resolution
}
