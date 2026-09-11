package com.movviz.nx.mobile.ui.discover

import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.foundation.lazy.grid.TvGridCells
import androidx.tv.foundation.lazy.grid.TvLazyVerticalGrid
import androidx.tv.foundation.lazy.grid.itemsIndexed
import androidx.tv.foundation.lazy.grid.rememberTvLazyGridState
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import com.movviz.nx.mobile.AppViewModel
import com.movviz.nx.mobile.data.ApiResult
import com.movviz.nx.mobile.data.MovvizRepository
import com.movviz.nx.mobile.data.RowMetaDto
import com.movviz.nx.mobile.data.SearchResultDto
import com.movviz.nx.mobile.ui.home.PosterCard
import com.movviz.nx.mobile.ui.home.TvTitleCard
import com.movviz.nx.mobile.ui.theme.AnimatedLogo
import com.movviz.nx.mobile.ui.theme.MovvizIconBack
import com.movviz.nx.mobile.ui.theme.MovvizInkDim
import com.movviz.nx.mobile.ui.theme.MovvizBrand
import com.movviz.nx.mobile.ui.theme.MovvizBrand2
import com.movviz.nx.mobile.ui.theme.MovvizElectricBorder
import com.movviz.nx.mobile.ui.theme.MovvizSurfaceStrong
import com.movviz.nx.mobile.ui.theme.tvPointerClick
import com.movviz.nx.mobile.ui.theme.withTvPrefetchDisabled
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
    // Bouton retour portrait — cet écran vivait jusqu'ici seulement sous
    // NxTopNav (paysage/TV, jamais affichée en portrait) : en portrait, ni
    // l'en-tête ni la barre basse ne sont visibles sur les routes hors
    // "home", donc sans ce bouton la grille "Voir tout"/genre/plateforme
    // n'avait aucune navigation du tout (signalé en direct : page cassée
    // après un tap sur une tuile Plateformes/Humeur).
    onBack: () -> Unit = {},
) {
    val compactPortrait = androidx.compose.ui.platform.LocalConfiguration.current.let {
        it.screenWidthDp < 600 && it.screenHeightDp > it.screenWidthDp
    }
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
    val isProviderPage = mode == "row" && rowKey.startsWith("providerSuggested:")
    var providerSort by remember(mode, mediaType, rowKey) { mutableStateOf("personalized") }

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
                repo.rowPage(mediaType, rowKey, target, if (isProviderPage) providerSort else null).let { r ->
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
                    resolvedLabel = when {
                        rowKey.startsWith("becauseYouWatched:") && m.anchorTitle != null ->
                            if (m.verb == "liked") "Puisque ${m.anchorTitle} vous a plu" else "Dans la lignée de ${m.anchorTitle}"
                        rowKey.startsWith("providerNew:") && m.providerName != null ->
                            "Nouveautés ${m.providerName} pour vous"
                        rowKey.startsWith("providerSuggested:") && m.providerName != null ->
                            "Sélection ${m.providerName} pour vous"
                        else -> resolvedLabel
                    }
                }
            }
        } finally {
            loading = false
            loadingMore = false
        }
    }

    LaunchedEffect(mode, mediaType, rowKey, baseUrl, providerSort) {
        cards = emptyList()
        page = 0
        totalPages = 1
        if (repository != null) loadPage(1)
    }

    // Déplié : rail tactile, pas de barre TV haute — marges compactes.
    val narrowRowDetail = compactPortrait || com.movviz.nx.mobile.ui.home.rememberUnfoldedLandscape()
    Column(
        modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background).padding(
            start = if (narrowRowDetail) 16.dp else 52.dp,
            top = if (narrowRowDetail) 0.dp else 64.dp,
            end = if (narrowRowDetail) 16.dp else 52.dp,
            bottom = if (compactPortrait) 24.dp else 30.dp,
        ),
    ) {
        if (compactPortrait) {
            // Même en-tête standard que le reste de l'app (mark + wordmark +
            // avatar) plutôt qu'un simple retour isolé — signalé en direct :
            // cette page se sentait détachée du reste sans lui.
            val activeProfile by viewModel.activeProfile.collectAsState()
            androidx.compose.foundation.layout.Row(
                modifier = Modifier.fillMaxWidth().statusBarsPadding().padding(top = 10.dp, bottom = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                androidx.compose.foundation.Image(
                    painter = androidx.compose.ui.res.painterResource(com.movviz.nx.mobile.R.drawable.movviz_mark),
                    contentDescription = "Movviz",
                    contentScale = androidx.compose.ui.layout.ContentScale.Fit,
                    modifier = Modifier.size(24.dp),
                )
                androidx.compose.foundation.layout.Spacer(Modifier.width(8.dp))
                Text(
                    text = "Movviz",
                    style = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.Black, color = Color.White),
                )
                androidx.compose.foundation.layout.Spacer(Modifier.weight(1f))
                androidx.tv.material3.Surface(
                    onClick = {},
                    modifier = Modifier.size(30.dp),
                    shape = androidx.tv.material3.ClickableSurfaceDefaults.shape(androidx.compose.foundation.shape.CircleShape),
                    colors = androidx.tv.material3.ClickableSurfaceDefaults.colors(containerColor = com.movviz.nx.mobile.ui.theme.MovvizSurfaceStrong, contentColor = Color.White),
                ) {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text(activeProfile?.name?.take(2)?.uppercase() ?: "MO", color = Color.White, fontSize = 10.sp)
                    }
                }
            }
            androidx.compose.foundation.layout.Row(
                modifier = Modifier.fillMaxWidth().padding(top = 14.dp, bottom = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                androidx.tv.material3.Surface(
                    onClick = onBack,
                    modifier = Modifier.size(36.dp).tvPointerClick(onBack),
                    shape = androidx.tv.material3.ClickableSurfaceDefaults.shape(androidx.compose.foundation.shape.CircleShape),
                    colors = androidx.tv.material3.ClickableSurfaceDefaults.colors(
                        containerColor = Color.White.copy(alpha = 0.08f),
                        contentColor = Color.White,
                    ),
                ) {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        androidx.tv.material3.Icon(MovvizIconBack, "Retour", modifier = Modifier.size(16.dp))
                    }
                }
                androidx.compose.foundation.layout.Spacer(Modifier.width(14.dp))
                Text(
                    text = resolvedLabel,
                    style = TextStyle(fontSize = 19.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onBackground),
                    maxLines = 1,
                    overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                )
            }
        } else {
            Text(
                text = resolvedLabel,
                style = TextStyle(fontSize = 26.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onBackground),
            )
            androidx.compose.foundation.layout.Spacer(modifier = Modifier.height(14.dp))
        }
        if (isProviderPage) {
            androidx.compose.foundation.layout.Row(
                modifier = Modifier.fillMaxWidth().padding(bottom = 14.dp),
                horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(8.dp),
            ) {
                listOf(
                    "personalized" to "Sélection pour vous",
                    "rating" to "Mieux notés",
                    "date" to "Plus récents",
                ).forEach { (value, title) ->
                    androidx.tv.material3.Surface(
                        onClick = { providerSort = value },
                        // Trois segments strictement égaux : le texte est
                        // réellement centré dans la rangée, pas seulement
                        // dans une pilule dont la largeur varie avec son mot.
                        modifier = Modifier.weight(1f).height(40.dp).tvPointerClick { providerSort = value },
                        shape = androidx.tv.material3.ClickableSurfaceDefaults.shape(androidx.compose.foundation.shape.RoundedCornerShape(20.dp)),
                        colors = androidx.tv.material3.ClickableSurfaceDefaults.colors(
                            containerColor = if (providerSort == value) Color.Transparent else MovvizSurfaceStrong,
                            contentColor = Color.White,
                        ),
                        border = androidx.tv.material3.ClickableSurfaceDefaults.border(
                            border = androidx.tv.material3.Border(
                                border = androidx.compose.foundation.BorderStroke(1.5.dp, MovvizElectricBorder),
                                shape = androidx.compose.foundation.shape.RoundedCornerShape(20.dp),
                            ),
                        ),
                    ) {
                        Box(
                            Modifier.fillMaxSize()
                                .then(if (providerSort == value) Modifier.background(Brush.horizontalGradient(listOf(MovvizBrand, MovvizBrand2)), androidx.compose.foundation.shape.RoundedCornerShape(20.dp)) else Modifier)
                                .padding(horizontal = 14.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(title, fontSize = if (compactPortrait) 11.sp else 13.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }
        }
        when {
            loading && cards.isEmpty() -> Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                AnimatedLogo(size = 56.dp)
            }
            cards.isEmpty() -> Box(
                modifier = Modifier.fillMaxWidth().padding(top = 48.dp).focusRequester(entryFocusRequester ?: remember { FocusRequester() }).focusable(),
            ) {
                Text(text = "Aucun titre pour le moment", color = MovvizInkDim, style = TextStyle(fontSize = 15.sp))
            }
            else -> {
                // 4 colonnes fixes en portrait (signalé en direct : les
                // cartes 154dp à 2 par ligne étaient énormes, pas au niveau
                // du reste de l'app) — largeur calculée pour tenir pile,
                // mêmes marges que le catalogue (CatalogScreen.kt). En
                // déplié, 3 colonnes remplissent la colonne centrale.
                val portraitSpacing = 10.dp
                val portraitEdge = 16.dp
                val portraitCardWidth = if (compactPortrait) {
                    val screenWidth = androidx.compose.ui.platform.LocalConfiguration.current.screenWidthDp.dp
                    (screenWidth - portraitEdge * 2 - portraitSpacing * 3) / 4
                } else 154.dp
                TvLazyVerticalGrid(
                    state = rememberTvLazyGridState().withTvPrefetchDisabled(),
                    columns = if (compactPortrait) TvGridCells.Fixed(4) else if (narrowRowDetail) TvGridCells.Fixed(3) else TvGridCells.FixedSize(154.dp),
                    horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(if (narrowRowDetail) portraitSpacing else 16.dp),
                    verticalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(if (narrowRowDetail) 14.dp else 20.dp),
                    modifier = Modifier.fillMaxSize(),
                ) {
                itemsIndexed(cards, key = { _, c -> c.id }, contentType = { _, _ -> "card" }) { index, card ->
                    PosterCard(
                        card = card,
                        onClick = { onOpenTitle(if (card.isMovie) "movie" else "series", card.tmdbId) },
                        focusRequester = if (index == 0) entryFocusRequester else null,
                        width = portraitCardWidth,
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
}

@Composable
private fun LoadMoreSentinel(onAppear: () -> Unit) {
    LaunchedEffect(Unit) { onAppear() }
    Box(modifier = Modifier.size(1.dp))
}
