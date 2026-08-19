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
    LaunchedEffect(Unit) { viewModel.loadLibrary() }
    val cards = if (type == HomeTab.MOVIES) {
        movies.map { TvTitleCard(it.id, it.title, it.posterPath, it.backdropPath, it.tmdbId, true, it.year, it.rating, it.genres, it.status, qualityLabel = resolutionLabelForCatalog(it.file?.resolution), hasHdr = !it.file?.hdr.isNullOrBlank()) }
    } else {
        series.map { TvTitleCard(it.id, it.title, it.posterPath, it.backdropPath, it.tmdbId, false, it.year, it.rating, it.genres) }
    }
    Column(Modifier.fillMaxSize().padding(top = 18.dp)) {
        Text(type.label, style = TextStyle(fontSize = 30.sp, color = MaterialTheme.colorScheme.onBackground), modifier = Modifier.padding(start = 64.dp, bottom = 18.dp))
        if (cards.isEmpty()) Text("Aucun titre pour le moment", color = MaterialTheme.colorScheme.onBackground, modifier = Modifier.padding(start = 64.dp))
        else TvLazyColumn(Modifier.fillMaxSize()) { item { TitleRow(type.label, cards, { onOpenTitle(if (it.isMovie) "movie" else "series", it.tmdbId) }) } }
    }
}

private fun resolutionLabelForCatalog(resolution: String?): String? = when {
    resolution == null -> null
    resolution.startsWith("2160") -> "4K"
    resolution.startsWith("1080") -> "1080p"
    resolution.startsWith("720") -> "720p"
    else -> resolution
}
