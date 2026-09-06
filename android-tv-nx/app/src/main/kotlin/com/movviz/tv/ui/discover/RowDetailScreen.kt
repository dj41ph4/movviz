package com.movviz.tv.ui.discover

import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.foundation.lazy.grid.TvGridCells
import androidx.tv.foundation.lazy.grid.TvLazyVerticalGrid
import androidx.tv.foundation.lazy.grid.itemsIndexed
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import com.movviz.tv.AppViewModel
import com.movviz.tv.data.ApiResult
import com.movviz.tv.data.MovvizRepository
import com.movviz.tv.data.RowMetaDto
import com.movviz.tv.data.SearchResultDto
import com.movviz.tv.ui.home.PosterCard
import com.movviz.tv.ui.home.TvTitleCard
import com.movviz.tv.ui.theme.AnimatedLogo
import com.movviz.tv.ui.theme.MovvizInkDim
import kotlinx.coroutines.launch

/**
 * Grille "Voir tout" d'une rangée éditoriale OU d'un genre — même contenu que
 * le bouton "Tout voir" / la sélection Genres du Discover desktop
 * (discover/page.tsx), en grille paginée plutôt qu'un scroll infini : sur TV,
 * charger une page à la volée quand la dernière carte visible approche évite
 * de télécharger des dizaines d'images d'un coup sur un boîtier bas de
 * gamme (priorité perf de cette tâche) — même esprit que l'IntersectionObserver
 * du desktop, porté en "carte sentinelle" (voir LoadMoreSentinel plus bas).
 *
 * `mode` distingue les deux sources possibles derrière la même grille :
 * - "row" : GET /api/metadata/row-page?type=&key=&page= (rangée éditoriale,
 *   `rowKey` est la clé de rangée, ex. "acclaimed" ou "becauseYouWatched:123").
 * - "genre" : GET /api/metadata/discover?type=&genre=&page= (sélecteur
 *   Genres, `rowKey` est soit un id TMDb numérique en string, soit l'un des
 *   deux ids synthétiques "anime"/"teen", voir genreTaxonomy.ts).
 */
private data class PageResult(
    val results: List<SearchResultDto>,
    val page: Int,
    val totalPages: Int,
    val meta: RowMetaDto?,
)

@Composable
fun RowDetailScreen(
    viewModel: AppViewModel,
    mode: String,
    mediaType: String,
    rowKey: String,
    label: String,
    onOpenTitle: (type: String, tmdbId: Int) -> Unit,
    // Même rôle que sur les autres écrans hors MainScreen (fiche titre/
    // acteur) : cible de la flèche bas depuis la NavRail.
    entryFocusRequester: FocusRequester? = null,
) {
    val baseUrl by viewModel.serverUrl.collectAsState()
    val heroLogos by viewModel.heroLogos.collectAsState()
    val repository = remember(baseUrl) { baseUrl?.let { MovvizRepository(it) } }
    val scope = rememberCoroutineScope()

    var cards by remember(mode, mediaType, rowKey) { mutableStateOf<List<TvTitleCard>>(emptyList()) }
    var page by remember(mode, mediaType, rowKey) { mutableStateOf(0) }
    var totalPages by remember(mode, mediaType, rowKey) { mutableStateOf(1) }
    var loading by remember(mode, mediaType, rowKey) { mutableStateOf(true) }
    var loadingMore by remember(mode, mediaType, rowKey) { mutableStateOf(false) }
    // La clé becauseYouWatched:* résout son propre libellé depuis la réponse
    // (meta.anchorTitle) même si `label` (venu du clic sur la rangée) est
    // déjà correct — un chargement direct sur cette route sans être passé
    // par la rangée n'a aujourd'hui pas d'entrée possible côté TV, mais ça
    // garde ce composable correct si une future deep-link en ajoutait une.
    var resolvedLabel by remember(mode, mediaType, rowKey) { mutableStateOf(label) }

    suspend fun loadPage(target: Int) {
        val repo = repository ?: return
        if (target == 1) loading = true else loadingMore = true
        try {
            val result = if (mode == "genre") {
                repo.discoverByGenre(mediaType, rowKey, target).let { r ->
                    when (r) {
                        is ApiResult.Success -> PageResult(r.data.results, r.data.page, r.data.totalPages, null)
                        else -> null
                    }
                }
            } else {
                repo.rowPage(mediaType, rowKey, target).let { r ->
                    when (r) {
                        is ApiResult.Success -> PageResult(r.data.results, r.data.page, r.data.totalPages, r.data.meta)
                        else -> null
                    }
                }
            }
            if (result != null) {
                val newCards = result.results.map {
                    TvTitleCard("browse-${it.type}-${it.tmdbId}", it.title, it.posterPath, it.backdropPath, it.tmdbId, it.type == "movie", it.year, it.rating)
                }
                cards = if (target == 1) newCards else cards + newCards
                page = result.page
                totalPages = result.totalPages
                result.meta?.let { m ->
                    resolvedLabel = if (m.verb == "liked") "Puisque ${m.anchorTitle} vous a plu" else "Dans la lignée de ${m.anchorTitle}"
                }
            }
        } finally {
            loading = false
            loadingMore = false
        }
    }

    LaunchedEffect(mode, mediaType, rowKey, baseUrl) {
        if (repository != null) loadPage(1)
    }

    Column(modifier = Modifier.fillMaxSize().padding(start = 52.dp, top = 64.dp, end = 52.dp, bottom = 30.dp)) {
        Text(
            text = resolvedLabel,
            style = TextStyle(fontSize = 26.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onBackground),
        )
        androidx.compose.foundation.layout.Spacer(modifier = Modifier.height(14.dp))
        when {
            loading && cards.isEmpty() -> Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                AnimatedLogo(size = 56.dp)
            }
            cards.isEmpty() -> Box(
                modifier = Modifier.fillMaxWidth().padding(top = 48.dp).focusRequester(entryFocusRequester ?: remember { FocusRequester() }).focusable(),
            ) {
                Text(text = "Aucun titre pour le moment", color = MovvizInkDim, style = TextStyle(fontSize = 15.sp))
            }
            else -> TvLazyVerticalGrid(
                columns = TvGridCells.FixedSize(154.dp),
                horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(16.dp),
                verticalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(20.dp),
                modifier = Modifier.fillMaxSize(),
            ) {
                itemsIndexed(cards, key = { _, c -> c.id }, contentType = { _, _ -> "card" }) { index, card ->
                    PosterCard(
                        card = card,
                        onClick = { onOpenTitle(if (card.isMovie) "movie" else "series", card.tmdbId) },
                        focusRequester = if (index == 0) entryFocusRequester else null,
                        width = 154.dp,
                        // Même principe portrait sans logo / logo posé au
                        // focus que le catalogue — voir CatalogScreen.kt.
                        aspectRatio = 2f / 3f,
                        preferPosterArt = true,
                        showCaption = false,
                        titleLogoPath = heroLogos["${if (card.isMovie) "movie" else "series"}-${card.tmdbId}"],
                        onFocusedChange = { focused ->
                            if (focused) viewModel.requestHeroLogo(if (card.isMovie) "movie" else "series", card.tmdbId)
                        },
                    )
                }
                // Carte sentinelle invisible : sa seule composition (donc son
                // entrée dans le viewport visible du D-pad, quand l'utilisateur
                // scrolle jusqu'à l'approcher) déclenche le chargement de la
                // page suivante — pas besoin d'introspecter l'état de scroll
                // de la grille, la recomposition paresseuse de Compose suffit.
                if (!loading && !loadingMore && page in 1 until totalPages) {
                    item(contentType = "load-more") {
                        LoadMoreSentinel { scope.launch { loadPage(page + 1) } }
                    }
                }
            }
        }
    }
}

@Composable
private fun LoadMoreSentinel(onAppear: () -> Unit) {
    LaunchedEffect(Unit) { onAppear() }
    Box(modifier = Modifier.size(1.dp))
}
