package com.movviz.nx.mobile.ui.discover

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Text
import com.movviz.nx.mobile.AppViewModel
import com.movviz.nx.mobile.data.ApiResult
import com.movviz.nx.mobile.data.MovvizRepository
import com.movviz.nx.mobile.data.ProviderRowDescDto
import com.movviz.nx.mobile.data.SearchResultDto
import com.movviz.nx.mobile.ui.home.TitleRow
import com.movviz.nx.mobile.ui.home.TvTitleCard
import com.movviz.nx.mobile.ui.home.withWatchedMovies
import com.movviz.nx.mobile.ui.theme.AnimatedLogo
import com.movviz.nx.mobile.ui.theme.MovvizIconBack
import com.movviz.nx.mobile.ui.theme.MovvizInkDim
import com.movviz.nx.mobile.ui.theme.tvPointerClick
import kotlinx.coroutines.launch

/** Rangée « Sélection pour vous » (classement personnalisé existant) gardée
 *  en tête de la page plateforme : aucune perte par rapport à l'ancien écran. */
private const val FOR_YOU_KEY = "__foryou"

private class ProviderRowState {
    var cards by mutableStateOf<List<TvTitleCard>>(emptyList())
    var page by mutableStateOf(0)
    var totalPages by mutableStateOf(1)
    var loading by mutableStateOf(false)
    var loaded by mutableStateOf(false)
}

/**
 * Page « plateforme » mobile (Netflix, Disney+…) — même contenu que sur
 * Android TV : une rangée par catégorie, films ET séries mélangés côté
 * serveur (providerCatalog.ts), chargée à l'approche, allongée à l'infini en
 * faisant défiler à droite, avec « Voir tout » en fin de rangée. Les rangées
 * sans titre sur la plateforme disparaissent après leur premier chargement.
 */
@Composable
fun ProviderHubScreen(
    viewModel: AppViewModel,
    providerId: Int,
    providerName: String,
    onOpenTitle: (type: String, tmdbId: Int) -> Unit,
    onSeeAll: (rowKey: String, label: String) -> Unit,
    onSeeAllForYou: () -> Unit,
    onBack: () -> Unit,
) {
    val baseUrl by viewModel.serverUrl.collectAsState()
    val heroLogos by viewModel.heroLogos.collectAsState()
    val providerTiles by viewModel.watchProviderTiles.collectAsState()
    val watchStatus by viewModel.watchStatus.collectAsState()
    val watchedMovieIds = remember(watchStatus) { watchStatus?.movies?.toSet().orEmpty() }
    val repository = remember(baseUrl) { baseUrl?.let { MovvizRepository(it) } }
    val scope = rememberCoroutineScope()

    var rows by remember(providerId) { mutableStateOf<List<ProviderRowDescDto>?>(null) }
    var rowsFailed by remember(providerId) { mutableStateOf(false) }
    val states = remember(providerId) { mutableStateMapOf<String, ProviderRowState>() }

    fun toCards(results: List<SearchResultDto>) = results.map {
        TvTitleCard("provider-${it.type}-${it.tmdbId}", it.title, it.posterPath, it.backdropPath, it.tmdbId, it.type == "movie", it.year, it.rating)
    }.withWatchedMovies(watchedMovieIds)

    suspend fun loadRows() {
        val repo = repository ?: return
        rowsFailed = false
        when (val r = repo.providerRows(providerId)) {
            is ApiResult.Success -> rows = listOf(ProviderRowDescDto(FOR_YOU_KEY, "Sélection pour vous")) + r.data
            else -> rowsFailed = true
        }
    }

    suspend fun loadRowPage(key: String, target: Int) {
        val repo = repository ?: return
        val state = states.getOrPut(key) { ProviderRowState() }
        if (state.loading || (target > 1 && target > state.totalPages)) return
        state.loading = true
        try {
            val page = if (key == FOR_YOU_KEY) {
                when (val r = repo.rowPage("movie", "providerSuggested:$providerId", target)) {
                    is ApiResult.Success -> Triple(r.data.results, r.data.page, r.data.totalPages)
                    else -> null
                }
            } else {
                when (val r = repo.providerRow(providerId, key, target)) {
                    is ApiResult.Success -> Triple(r.data.results, r.data.page, r.data.totalPages)
                    else -> null
                }
            }
            if (page != null) {
                val newCards = toCards(page.first)
                state.cards = (if (target == 1) newCards else state.cards + newCards).distinctBy { it.id }
                state.page = page.second
                state.totalPages = page.third
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

    val visibleRows = rows.orEmpty().filter { row -> states[row.key]?.let { !it.loaded || it.cards.isNotEmpty() } ?: true }
    val anyLoaded = visibleRows.any { states[it.key]?.cards?.isNotEmpty() == true }

    Column(Modifier.fillMaxSize().background(com.movviz.nx.mobile.ui.theme.MovvizPage).statusBarsPadding()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            androidx.tv.material3.Surface(
                onClick = onBack,
                modifier = Modifier.size(36.dp).tvPointerClick(onBack),
                shape = androidx.tv.material3.ClickableSurfaceDefaults.shape(androidx.compose.foundation.shape.CircleShape),
                colors = androidx.tv.material3.ClickableSurfaceDefaults.colors(containerColor = Color.White.copy(alpha = 0.08f), contentColor = Color.White),
            ) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    androidx.tv.material3.Icon(MovvizIconBack, "Retour", modifier = Modifier.size(16.dp))
                }
            }
            Spacer(Modifier.width(14.dp))
            providerTiles.firstOrNull { it.id == providerId }?.logoPath?.let { logo ->
                coil.compose.AsyncImage(
                    model = "https://image.tmdb.org/t/p/w500$logo",
                    contentDescription = providerName,
                    contentScale = ContentScale.Fit,
                    modifier = Modifier.padding(end = 12.dp).size(width = 44.dp, height = 44.dp)
                        .clip(androidx.compose.foundation.shape.RoundedCornerShape(10.dp)),
                )
            }
            Column {
                Text(providerName, style = TextStyle(fontSize = 21.sp, fontWeight = FontWeight.Bold, color = Color.White), maxLines = 1)
                Text("Films et séries par catégorie", style = TextStyle(fontSize = 12.sp, color = MovvizInkDim))
            }
        }
        when {
            rowsFailed -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                androidx.tv.material3.Surface(
                    onClick = { scope.launch { loadRows() } },
                    modifier = Modifier.tvPointerClick { scope.launch { loadRows() } },
                    shape = androidx.tv.material3.ClickableSurfaceDefaults.shape(androidx.compose.foundation.shape.RoundedCornerShape(12.dp)),
                    colors = androidx.tv.material3.ClickableSurfaceDefaults.colors(containerColor = Color(0xFF2A2A31), contentColor = Color.White),
                ) {
                    Text("Impossible de charger $providerName — Réessayer", modifier = Modifier.padding(horizontal = 18.dp, vertical = 12.dp))
                }
            }
            rows != null && visibleRows.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("Aucun titre pour le moment", style = TextStyle(color = MovvizInkDim, fontSize = 14.sp))
            }
            else -> Box(Modifier.fillMaxSize()) {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(bottom = 156.dp),
                ) {
                    items(visibleRows, key = { it.key }, contentType = { "provider-row" }) { row ->
                        val state = states.getOrPut(row.key) { ProviderRowState() }
                        LaunchedEffect(row.key) { if (!state.loaded) loadRowPage(row.key, 1) }
                        if (state.cards.isEmpty()) {
                            // Hauteur d'une vraie rangée tant qu'elle charge : la liste
                            // ne compose ainsi que les rangées proches de l'écran
                            // (pas une vingtaine de requêtes d'un coup).
                            Spacer(Modifier.height(if (state.loaded) 1.dp else 230.dp))
                        } else {
                            TitleRow(
                                heading = row.label,
                                items = state.cards,
                                onClick = { onOpenTitle(if (it.isMovie) "movie" else "series", it.tmdbId) },
                                onSeeAll = {
                                    if (row.key == FOR_YOU_KEY) onSeeAllForYou() else onSeeAll(row.key, "${row.label} · $providerName")
                                },
                                titleLogoPaths = heroLogos,
                                onFocusedCard = { viewModel.requestHeroLogo(if (it.isMovie) "movie" else "series", it.tmdbId) },
                                onNearEnd = { if (state.page < state.totalPages) scope.launch { loadRowPage(row.key, state.page + 1) } },
                            )
                        }
                    }
                }
                if (rows == null || !anyLoaded) {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { AnimatedLogo(size = 42.dp) }
                }
            }
        }
    }
}
