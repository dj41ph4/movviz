package com.movviz.tv.ui.discover

import android.os.SystemClock
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.offset
import androidx.compose.runtime.Stable
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import com.movviz.tv.ui.home.rememberTvGridFocusMemory
import com.movviz.tv.ui.home.requestFocusSafely
import com.movviz.tv.ui.theme.LocalMovvizBeta
import com.movviz.tv.ui.theme.MovvizFocusTarget
import com.movviz.tv.ui.theme.MovvizTheme
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
import androidx.compose.ui.layout.ContentScale
import androidx.tv.foundation.lazy.grid.TvGridCells
import androidx.tv.foundation.lazy.grid.TvLazyVerticalGrid
import androidx.tv.foundation.lazy.grid.itemsIndexed
import androidx.tv.foundation.lazy.grid.rememberTvLazyGridState
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import com.movviz.tv.AppViewModel
import com.movviz.tv.data.ApiResult
import com.movviz.tv.data.MovvizRepository
import com.movviz.tv.data.RowMetaDto
import com.movviz.tv.data.SearchResultDto
import com.movviz.tv.ui.home.PosterCard
import com.movviz.tv.ui.home.TvTitleCard
import com.movviz.tv.ui.home.withWatchedMovies
import com.movviz.tv.ui.theme.AnimatedLogo
import com.movviz.tv.ui.theme.MovvizInkDim
import com.movviz.tv.ui.theme.withTvPrefetchDisabled
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
 * - "provider" : GET /api/metadata/discover?type=&watchProvider=&page=.
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
    val providerTiles by viewModel.watchProviderTiles.collectAsState()
    // Pastille "vu" (phase 12-13 watch-state) — films uniquement.
    val rowDetailWatchStatus by viewModel.watchStatus.collectAsState()
    val watchedMovieIds = remember(rowDetailWatchStatus) { rowDetailWatchStatus?.movies?.toSet().orEmpty() }
    val repository = remember(baseUrl) { baseUrl?.let { MovvizRepository(it) } }
    val scope = rememberCoroutineScope()

    var cards by remember(mode, mediaType, rowKey) { mutableStateOf<List<TvTitleCard>>(emptyList()) }
    var page by androidx.compose.runtime.saveable.rememberSaveable(mode, mediaType, rowKey) { mutableStateOf(0) }
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
            } else if (mode == "provider") {
                val providerId = rowKey.toIntOrNull() ?: return
                repo.discoverByProvider(mediaType, providerId, target).let { r ->
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
                }.withWatchedMovies(watchedMovieIds)
                // Une rangée personnalisée peut renvoyer le même titre sur deux pages
                // (ou la même page deux fois) : la grille plantait alors sur une clé
                // en double (« Key was already used ») au « Voir plus ».
                cards = (if (target == 1) newCards else cards + newCards).distinctBy { it.id }
                page = result.page
                totalPages = result.totalPages
                result.meta?.let { m ->
                    resolvedLabel = when {
                        rowKey.startsWith("becauseYouWatched:") && m.anchorTitle != null ->
                            if (m.verb == "liked") "Puisque ${m.anchorTitle} vous a plu" else "Dans la lignée de ${m.anchorTitle}"
                        rowKey.startsWith("providerNew:") && m.providerName != null ->
                            "Nouveautés ${m.providerName} pour vous"
                        rowKey.startsWith("providerSuggested:") && m.providerName != null ->
                            "Suggestion ${m.providerName} pour vous"
                        else -> resolvedLabel
                    }
                }
            }
        } finally {
            loading = false
            loadingMore = false
        }
    }

    LaunchedEffect(mode, mediaType, rowKey, baseUrl) {
        if (repository != null) {
            if (mode == "provider" && providerTiles.isEmpty()) viewModel.loadDiscoverLogos()
            val restoreThrough = page.coerceAtLeast(1)
            for (target in 1..restoreThrough) {
                loadPage(target)
                if (page < target) break
            }
        }
    }

    val beta = LocalMovvizBeta.current
    val gridState = rememberTvLazyGridState().withTvPrefetchDisabled()
    // Mémoire de grille par identité : retour de fiche → même carte. Les
    // cartes sont rechargées à la recréation de l'écran (page 1) ; si la
    // carte mémorisée vivait sur une page suivante, la plus proche par
    // position survivante est choisie (rememberedTvItemIndex).
    val gridKeys = remember(cards) { cards.map { it.id } }
    val gridMemory = rememberTvGridFocusMemory(
        gridKey = "row:$mode:$mediaType:$rowKey",
        keys = gridKeys,
        isVisible = { index -> gridState.layoutInfo.visibleItemsInfo.any { it.index == index } },
        scrollToItem = { gridState.scrollToItem(it) },
    )
    val gridFocus = remember { FocusRequester() }
    val statusFocus = remember { FocusRequester() }
    val entryFocus = rememberTvScreenEntryFocus()
    // Rien ne demandait jamais le focus ici : après OK sur « Voir tout », il
    // retombait sur la sidebar (ou nulle part). Focus initial unique sur la
    // vraie cible dès qu'elle existe — d'abord le repère de chargement
    // visible, puis la grille (carte mémorisée au retour de fiche, sinon la
    // première) — sauf si l'utilisateur est parti vers la sidebar entre-temps.
    val contentReady = !loading && cards.isNotEmpty()
    val settled = !loading
    LaunchedEffect(contentReady, settled) {
        when {
            contentReady -> entryFocus.requestFinal {
                if (gridMemory.hasSelection()) {
                    gridMemory.restoreFocus(
                        keys = gridKeys,
                        isVisible = { index -> gridState.layoutInfo.visibleItemsInfo.any { it.index == index } },
                        scrollToItem = { gridState.scrollToItem(it) },
                    ) || gridFocus.requestFocusSafely()
                } else {
                    gridFocus.requestFocusSafely()
                }
            }
            settled -> entryFocus.requestFinal { statusFocus.requestFocusSafely() }
            else -> entryFocus.requestPending { statusFocus.requestFocusSafely() }
        }
    }

    Column(
        modifier = Modifier.fillMaxSize()
            .then(entryFocus.observerModifier())
            .padding(start = 39.dp, top = 48.dp, end = 39.dp, bottom = 23.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (mode == "provider") {
                // Logo de marque transparent (même SVG que les tuiles Plateformes)
                // plutôt que le carré TMDb sur fond de couleur ; repli TMDb pour
                // les plateformes sans logo de marque embarqué.
                val providerId = rowKey.toIntOrNull()
                val brandLogo = providerId?.let { com.movviz.tv.ui.theme.providerBrandAsset(it) }
                val logoModel = brandLogo ?: providerTiles.firstOrNull { it.id == providerId }?.logoPath?.let { "https://image.tmdb.org/t/p/w500$it" }
                if (logoModel != null) {
                    coil.compose.AsyncImage(
                        model = logoModel,
                        contentDescription = null,
                        contentScale = ContentScale.Fit,
                        modifier = Modifier.padding(end = 18.dp).size(width = if (brandLogo != null) 120.dp else 92.dp, height = 42.dp),
                    )
                }
            }
            Text(
                text = resolvedLabel,
                style = if (beta) MaterialTheme.typography.headlineMedium else TextStyle(fontSize = 20.sp, fontWeight = FontWeight.Bold),
                color = if (beta) MovvizTheme.palette.ink else MaterialTheme.colorScheme.onBackground,
            )
        }
        androidx.compose.foundation.layout.Spacer(modifier = Modifier.height(11.dp))
        when {
            // Chargement : repère visible et focalisable (GAUCHE → sidebar
            // via DetailFocusToNavHandler), jamais un spinner sans cible.
            loading && cards.isEmpty() -> Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                MovvizFocusTarget(
                    modifier = Modifier.then(if (entryFocusRequester != null) Modifier.focusRequester(entryFocusRequester) else Modifier),
                    focusRequester = statusFocus,
                ) {
                    Box(Modifier.padding(12.dp)) { AnimatedLogo(size = 42.dp) }
                }
            }
            cards.isEmpty() -> MovvizFocusTarget(
                modifier = Modifier.padding(top = 36.dp)
                    .then(if (entryFocusRequester != null) Modifier.focusRequester(entryFocusRequester) else Modifier),
                focusRequester = statusFocus,
            ) {
                Text(
                    text = "Aucun titre pour le moment",
                    color = if (beta) MovvizTheme.palette.inkDim else MovvizInkDim,
                    style = if (beta) MaterialTheme.typography.bodyMedium else TextStyle(fontSize = 11.sp),
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
                )
            }
            else -> TvLazyVerticalGrid(
                state = gridState,
                columns = TvGridCells.FixedSize(com.movviz.tv.ui.theme.betaDp(116.dp, 112.dp)),
                horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(12.dp),
                verticalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(com.movviz.tv.ui.theme.betaDp(15.dp, 18.dp)),
                // Bêta : marge pour l'anneau extérieur (6 dp) de la première
                // colonne / ligne, compensée pour garder l'alignement du titre.
                contentPadding = if (beta) PaddingValues(8.dp) else PaddingValues(0.dp),
                modifier = Modifier.fillMaxSize()
                    .let { if (beta) it.offset(x = (-8).dp) else it }
                    // Entrée unique de la grille (sidebar DROITE, focus
                    // initial) : la carte mémorisée, sinon la première.
                    .then(if (entryFocusRequester != null) Modifier.focusRequester(entryFocusRequester) else Modifier)
                    .then(gridMemory.containerModifier(gridFocus)),
            ) {
                itemsIndexed(cards, key = { _, c -> c.id }, contentType = { _, _ -> "card" }) { index, card ->
                    PosterCard(
                        card = card,
                        modifier = gridMemory.itemModifier(card.id, index),
                        onClick = { onOpenTitle(if (card.isMovie) "movie" else "series", card.tmdbId) },
                        width = com.movviz.tv.ui.theme.betaDp(116.dp, 112.dp),
                        // Même principe portrait sans logo / logo posé au
                        // focus que le catalogue — voir CatalogScreen.kt.
                        aspectRatio = 2f / 3f,
                        preferPosterArt = true,
                        showCaption = false,
                        titleLogoPath = heroLogos["${if (card.isMovie) "movie" else "series"}-${card.tmdbId}"],
                        onFocusedChange = { focused ->
                            val cardType = if (card.isMovie) "movie" else "series"
                            if (focused) {
                                viewModel.requestHeroLogo(cardType, card.tmdbId)
                                viewModel.scheduleDetailPrefetch(cardType, card.tmdbId)
                            }
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

/** Une perte de focus moins de 600 ms après une touche vient de l'utilisateur
 *  (GAUCHE vers la sidebar, RETOUR…) ; au-delà, c'est l'élément focalisé qui
 *  a disparu (chargement remplacé par la grille). */
internal fun isUserFocusMove(lastKeyAtMs: Long, nowMs: Long): Boolean =
    lastKeyAtMs > 0L && nowMs - lastKeyAtMs in 0 until USER_FOCUS_MOVE_WINDOW_MS

private const val USER_FOCUS_MOVE_WINDOW_MS = 600L

/**
 * Focus initial d'un écran hors MainScreen (« Voir tout », fiche acteur) :
 * une cible provisoire visible pendant le chargement, puis UNE demande
 * finale sur le vrai contenu, réessayée sur quelques images jusqu'à ce que
 * la cible soit attachée. Un départ volontaire de l'utilisateur (touche
 * suivie d'une perte de focus) l'emporte toujours sur une réponse réseau
 * tardive : on ne lui reprend jamais le focus.
 *
 * Usage : `Modifier.then(entry.observerModifier())` sur la racine de
 * l'écran, puis `entry.requestPending { … }` / `entry.requestFinal { … }`
 * dans un LaunchedEffect piloté par l'état de chargement. Une instance par
 * composition : recréé au retour d'une fiche, il restaure à nouveau.
 */
@Stable
internal class TvScreenEntryFocus {
    private var finished = false
    private var hadFocus = false
    private var lastKeyAtMs = 0L
    private var userLeft = false

    fun observerModifier(): Modifier = Modifier
        .onPreviewKeyEvent { event ->
            if (event.type == KeyEventType.KeyDown) lastKeyAtMs = SystemClock.uptimeMillis()
            false
        }
        .onFocusChanged { state ->
            if (state.hasFocus) {
                hadFocus = true
            } else if (hadFocus) {
                hadFocus = false
                if (isUserFocusMove(lastKeyAtMs, SystemClock.uptimeMillis())) userLeft = true
            }
        }

    /** Cible provisoire (chargement) : ne clôt pas le focus initial. */
    suspend fun requestPending(request: suspend () -> Boolean) = attempt(request, final = false)

    /** Cible définitive (contenu, vide ou erreur) : une seule fois. */
    suspend fun requestFinal(request: suspend () -> Boolean) = attempt(request, final = true)

    private suspend fun attempt(request: suspend () -> Boolean, final: Boolean) {
        repeat(ENTRY_FRAME_ATTEMPTS) {
            if (finished || userLeft) return
            if (request()) {
                if (final) finished = true
                return
            }
            withFrameNanos { }
        }
    }

    private companion object {
        const val ENTRY_FRAME_ATTEMPTS = 30
    }
}

@Composable
internal fun rememberTvScreenEntryFocus(): TvScreenEntryFocus = remember { TvScreenEntryFocus() }

@Composable
private fun LoadMoreSentinel(onAppear: () -> Unit) {
    LaunchedEffect(Unit) { onAppear() }
    Box(modifier = Modifier.size(1.dp))
}
