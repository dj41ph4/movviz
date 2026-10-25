package com.movviz.tv.ui.discover

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.foundation.lazy.list.TvLazyColumn
import androidx.tv.foundation.lazy.list.items
import androidx.tv.foundation.lazy.list.rememberTvLazyListState
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import com.movviz.tv.AppViewModel
import com.movviz.tv.data.ApiResult
import com.movviz.tv.data.MovvizRepository
import com.movviz.tv.data.ProviderRowDescDto
import com.movviz.tv.ui.home.TitleRow
import com.movviz.tv.ui.home.TvTitleCard
import com.movviz.tv.ui.home.requestFocusSafely
import com.movviz.tv.ui.home.withWatchedMovies
import com.movviz.tv.ui.theme.AnimatedLogo
import com.movviz.tv.ui.theme.LocalMovvizBeta
import com.movviz.tv.ui.theme.MovvizFocusTarget
import com.movviz.tv.ui.theme.MovvizInkDim
import com.movviz.tv.ui.theme.MovvizTheme
import com.movviz.tv.ui.theme.withTvPrefetchDisabled
import kotlinx.coroutines.launch

/** État d'une rangée de la page plateforme — chargée à la demande. */
private class ProviderRowState {
    var cards by mutableStateOf<List<TvTitleCard>>(emptyList())
    var page by mutableStateOf(0)
    var totalPages by mutableStateOf(1)
    var loading by mutableStateOf(false)
    var loaded by mutableStateOf(false)
}

/**
 * Page « plateforme » (Netflix, Disney+…) : comme Découverte, mais limitée
 * au catalogue de la plateforme — une rangée par catégorie (Tendances,
 * Nouveautés, Les mieux notés, puis les genres), films ET séries mélangés
 * côté serveur (providerCatalog.ts). Chaque rangée se charge quand elle
 * approche de l'écran, s'allonge à l'infini en allant à droite (onNearEnd)
 * et se termine par « Voir tout » (grille complète de la rangée). Une rangée
 * sans aucun titre sur la plateforme disparaît après son premier chargement.
 */
@Composable
fun ProviderHubScreen(
    viewModel: AppViewModel,
    providerId: Int,
    providerName: String,
    onOpenTitle: (type: String, tmdbId: Int) -> Unit,
    onSeeAll: (rowKey: String, label: String) -> Unit,
    entryFocusRequester: FocusRequester? = null,
) {
    val baseUrl by viewModel.serverUrl.collectAsState()
    val heroLogos by viewModel.heroLogos.collectAsState()
    val providerTiles by viewModel.watchProviderTiles.collectAsState()
    val watchStatus by viewModel.watchStatus.collectAsState()
    val watchedMovieIds = remember(watchStatus) { watchStatus?.movies?.toSet().orEmpty() }
    val repository = remember(baseUrl) { baseUrl?.let { MovvizRepository(it) } }
    val scope = rememberCoroutineScope()
    val beta = LocalMovvizBeta.current

    var rows by remember(providerId) { mutableStateOf<List<ProviderRowDescDto>?>(null) }
    var rowsFailed by remember(providerId) { mutableStateOf(false) }
    val states = remember(providerId) { mutableStateMapOf<String, ProviderRowState>() }
    val firstCardFocus = remember { FocusRequester() }
    val statusFocus = remember { FocusRequester() }
    val entryFocus = rememberTvScreenEntryFocus()

    suspend fun loadRows() {
        val repo = repository ?: return
        rowsFailed = false
        when (val r = repo.providerRows()) {
            is ApiResult.Success -> rows = r.data
            else -> rowsFailed = true
        }
    }

    suspend fun loadRowPage(key: String, target: Int) {
        val repo = repository ?: return
        val state = states.getOrPut(key) { ProviderRowState() }
        if (state.loading || (target > 1 && target > state.totalPages)) return
        state.loading = true
        try {
            when (val r = repo.providerRow(providerId, key, target)) {
                is ApiResult.Success -> {
                    val newCards = r.data.results.map {
                        TvTitleCard("provider-${it.type}-${it.tmdbId}", it.title, it.posterPath, it.backdropPath, it.tmdbId, it.type == "movie", it.year, it.rating)
                    }.withWatchedMovies(watchedMovieIds)
                    state.cards = (if (target == 1) newCards else state.cards + newCards).distinctBy { it.id }
                    state.page = r.data.page
                    state.totalPages = r.data.totalPages
                }
                else -> Unit
            }
        } finally {
            state.loading = false
            state.loaded = true
        }
    }

    LaunchedEffect(providerId, repository) {
        if (providerTiles.isEmpty()) viewModel.loadDiscoverLogos()
        loadRows()
    }
    // Premier écran : charge les rangées dans l'ordre jusqu'à la première
    // qui contient des titres (une plateforme peut n'avoir aucun titre dans
    // les premières catégories) ; les suivantes se chargent ensuite à
    // l'approche, depuis la liste.
    LaunchedEffect(rows) {
        for (row in rows.orEmpty()) {
            if (states[row.key]?.loaded != true) loadRowPage(row.key, 1)
            if (states[row.key]?.cards?.isNotEmpty() == true) break
        }
    }

    val visibleRows = rows.orEmpty().filter { row -> states[row.key]?.let { !it.loaded || it.cards.isNotEmpty() } ?: true }
    val firstRowKey = visibleRows.firstOrNull { states[it.key]?.cards?.isNotEmpty() == true }?.key
    // Focus initial : repère de chargement, puis première carte de la
    // première rangée remplie — jamais repris si l'utilisateur est parti.
    LaunchedEffect(firstRowKey, rows, rowsFailed) {
        when {
            firstRowKey != null -> entryFocus.requestFinal { firstCardFocus.requestFocusSafely() }
            rowsFailed -> entryFocus.requestFinal { statusFocus.requestFocusSafely() }
            else -> entryFocus.requestPending { statusFocus.requestFocusSafely() }
        }
    }

    val listState = rememberTvLazyListState().withTvPrefetchDisabled()
    Column(
        modifier = Modifier.fillMaxSize()
            .then(entryFocus.observerModifier())
            .padding(top = 40.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(start = 39.dp, end = 39.dp, bottom = 6.dp)) {
            val brandLogo = com.movviz.tv.ui.theme.providerBrandAsset(providerId)
            val logoModel = brandLogo ?: providerTiles.firstOrNull { it.id == providerId }?.logoPath?.let { "https://image.tmdb.org/t/p/w500$it" }
            if (logoModel != null) {
                coil.compose.AsyncImage(
                    model = logoModel,
                    contentDescription = providerName,
                    contentScale = ContentScale.Fit,
                    modifier = Modifier.padding(end = 18.dp).size(width = if (brandLogo != null) 132.dp else 96.dp, height = 46.dp),
                )
            }
            Column {
                Text(
                    text = providerName,
                    style = if (beta) MaterialTheme.typography.headlineMedium else TextStyle(fontSize = 22.sp, fontWeight = FontWeight.Bold),
                    color = if (beta) MovvizTheme.palette.ink else MaterialTheme.colorScheme.onBackground,
                )
                Text(
                    text = "Films et séries par catégorie",
                    color = if (beta) MovvizTheme.palette.inkDim else MovvizInkDim,
                    style = if (beta) MaterialTheme.typography.bodyMedium else TextStyle(fontSize = 11.sp),
                )
            }
        }
        when {
            rows == null && !rowsFailed || (rows != null && firstRowKey == null && visibleRows.isNotEmpty()) -> {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    MovvizFocusTarget(
                        modifier = Modifier.then(if (entryFocusRequester != null) Modifier.focusRequester(entryFocusRequester) else Modifier),
                        focusRequester = statusFocus,
                    ) { Box(Modifier.padding(12.dp)) { AnimatedLogo(size = 42.dp) } }
                }
            }
            rowsFailed || visibleRows.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                MovvizFocusTarget(
                    modifier = Modifier.then(if (entryFocusRequester != null) Modifier.focusRequester(entryFocusRequester) else Modifier),
                    focusRequester = statusFocus,
                    onClick = { scope.launch { loadRows() } },
                ) {
                    Text(
                        text = if (rowsFailed) "Impossible de charger $providerName — OK pour réessayer" else "Aucun titre pour le moment",
                        color = if (beta) MovvizTheme.palette.inkDim else MovvizInkDim,
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                    )
                }
            }
            else -> TvLazyColumn(
                state = listState,
                modifier = Modifier.fillMaxSize()
                    .then(if (entryFocusRequester != null) Modifier.focusRequester(entryFocusRequester) else Modifier),
                contentPadding = PaddingValues(start = 18.dp, bottom = 40.dp),
            ) {
                items(visibleRows, key = { it.key }, contentType = { "provider-row" }) { row ->
                    val state = states.getOrPut(row.key) { ProviderRowState() }
                    // Chargement à l'approche : composer la rangée suffit
                    // (TvLazyColumn ne compose que l'écran et sa bordure).
                    LaunchedEffect(row.key) { if (!state.loaded) loadRowPage(row.key, 1) }
                    if (state.cards.isEmpty()) {
                        // Hauteur d'une vraie rangée tant qu'elle charge : seules les
                        // rangées proches de l'écran sont composées, donc chargées.
                        Box(Modifier.height(if (state.loaded) 1.dp else 270.dp))
                    } else {
                        TitleRow(
                            heading = row.label,
                            items = state.cards,
                            rowKey = "provider-$providerId-${row.key}",
                            onClick = { onOpenTitle(if (it.isMovie) "movie" else "series", it.tmdbId) },
                            firstItemFocusRequester = if (row.key == firstRowKey) firstCardFocus else null,
                            onSeeAll = { onSeeAll(row.key, "${row.label} · $providerName") },
                            titleLogoPaths = heroLogos,
                            onFocusedCard = {
                                val type = if (it.isMovie) "movie" else "series"
                                viewModel.requestHeroLogo(type, it.tmdbId)
                                viewModel.scheduleDetailPrefetch(type, it.tmdbId)
                            },
                            onNearEnd = { if (state.page < state.totalPages) scope.launch { loadRowPage(row.key, state.page + 1) } },
                            previewLoader = { viewModel.loadTvPreview(if (it.isMovie) "movie" else "series", it.tmdbId) },
                            showTypeBadge = true,
                        )
                    }
                }
            }
        }
    }
}
