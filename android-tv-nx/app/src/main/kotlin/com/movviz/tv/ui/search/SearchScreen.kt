package com.movviz.tv.ui.search

import com.movviz.tv.data.BleachPresentation

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.foundation.focusable
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.foundation.lazy.grid.TvGridCells
import androidx.tv.foundation.lazy.grid.TvLazyVerticalGrid
import androidx.tv.foundation.lazy.grid.items
import androidx.tv.foundation.lazy.grid.itemsIndexed
import androidx.tv.foundation.lazy.grid.rememberTvLazyGridState
import androidx.tv.material3.Border
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.Icon
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import coil.compose.rememberAsyncImagePainter
import com.movviz.tv.AppViewModel
import com.movviz.tv.SearchState
import com.movviz.tv.data.SearchResultDto
import com.movviz.tv.ui.theme.MovvizBrand
import com.movviz.tv.ui.theme.MovvizBrand2
import com.movviz.tv.ui.theme.MovvizBrand3
import com.movviz.tv.ui.theme.MovvizIconCheck
import com.movviz.tv.ui.theme.MovvizInk
import com.movviz.tv.ui.theme.MovvizInkDim
import com.movviz.tv.ui.theme.MovvizSurface
import com.movviz.tv.ui.theme.MovvizSurfaceStrong
import com.movviz.tv.ui.theme.RatingBadge
import com.movviz.tv.ui.theme.tvFocusLift
import com.movviz.tv.ui.theme.tvPointerClick
import com.movviz.tv.ui.theme.withTvPrefetchDisabled
import androidx.compose.foundation.BorderStroke
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.focusRestorer
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.SolidColor
import androidx.tv.foundation.lazy.list.TvLazyRow
import androidx.tv.foundation.lazy.list.rememberTvLazyListState
import androidx.tv.foundation.lazy.list.itemsIndexed
import com.movviz.tv.ui.home.rememberTvGridFocusMemory
import com.movviz.tv.ui.home.requestFocusSafely
import com.movviz.tv.ui.theme.LocalMovvizBeta
import com.movviz.tv.ui.theme.MovvizBetaShapes
import com.movviz.tv.ui.theme.MovvizChip
import com.movviz.tv.ui.theme.MovvizFocusTarget
import com.movviz.tv.ui.theme.MovvizTheme
import com.movviz.tv.ui.theme.animateMovvizImageZoom
import com.movviz.tv.ui.theme.betaDp
import com.movviz.tv.ui.theme.movvizBetaSurfaceScale
import com.movviz.tv.ui.theme.movvizCardBorder
import com.movviz.tv.ui.theme.movvizCardShape
import com.movviz.tv.ui.theme.movvizFocusRing
import com.movviz.tv.ui.theme.movvizImageZoom
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.Locale

// w342, PAS w500 : les cartes de résultats font 154dp de large (~310px
// physiques en 1080p) — w342 couvre avec marge pour les TV 4K sans
// télécharger le double de pixels inutilement (leçon Elefin : jamais
// d'image plus grande que le rendu, la moitié du poids réseau/mémoire).
private const val TMDB_POSTER_BASE = "https://image.tmdb.org/t/p/w342"

/** Insensible aux accents/casse — même principe que normalizedGenre côté
 *  Bibliothèque (CatalogScreen.kt) : "drag" doit matcher "Dragon Ball" et
 *  "Élise" doit matcher "elise". */
private val SEARCH_ACCENTS = "\\p{M}+".toRegex()
private fun normalizedSearchText(value: String): String =
    java.text.Normalizer.normalize(value, java.text.Normalizer.Form.NFD)
        .replace(SEARCH_ACCENTS, "")
        .trim()
        .lowercase(Locale.ROOT)

private data class IndexedSearchTitle(val result: SearchResultDto, val normalizedTitle: String)

// Porté depuis android-mobile-nx (même écran de recherche, demandé
// explicitement identique entre TV et mobile) : filtre Tout/Films/Séries
// sous le champ, absent de la version TV jusqu'ici.
private enum class SearchTypeFilter(val label: String, val apiType: String?) {
    ALL("Tout", null), MOVIES("Films", "movie"), SERIES("Séries", "series"),
}

/** Recherche TV inspirée du flux Netflix : résultats pendant la saisie,
 * suggestions sous le champ, cartes larges et aperçu du titre ciblé. */
@Composable
fun SearchScreen(
    viewModel: AppViewModel,
    onOpenTitle: (type: String, tmdbId: Int) -> Unit,
    onOpenPartTitle: (String, Int, String?) -> Unit = { type, id, _ -> onOpenTitle(type, id) },
    query: String = "",
    onQueryChange: (String) -> Unit = {},
    showSearchField: Boolean = true,
    // Cible D-pad pour sortir du champ de recherche (NavRail.SearchButton) :
    // première carte de la grille de résultats.
    resultFocusRequester: FocusRequester? = null,
    // Cible de restauration de l'onglet (MainScreen) : la demander au retour
    // d'une fiche ramène sur le résultat mémorisé. Attachée seulement quand
    // un résultat a déjà été focalisé ; sinon l'entrée reste le champ.
    restoreFocusRequester: FocusRequester? = null,
) {
    val beta = LocalMovvizBeta.current
    val scope = rememberCoroutineScope()
    // Carte "focusée" identifiée par type+tmdbId (2 primitifs) plutôt que par
    // l'objet SearchResultDto entier : la comparaison par égalité structurelle
    // de la data class compare TOUS ses champs (posterPath, overview...) pour
    // chaque cellule visible de la grille à chaque déplacement de focus —
    // deux int/string, c'est instantané et ne retient rien de lourd.
    var focusedTmdbId by remember { mutableStateOf<Int?>(null) }
    var focusedType by remember { mutableStateOf<String?>(null) }
    var focusedPart by remember { mutableStateOf<String?>(null) }
    // Distinct du requester d'entrée depuis la barre : un requester Compose
    // ne s'attache qu'à un seul nœud. Celui-ci est exclusivement la première
    // carte, pour que BAS depuis le champ sorte toujours du clavier vers les
    // résultats réels.
    val firstResultFocusRequester = remember { FocusRequester() }
    // Filtre actif (BAS depuis le champ) et message d'état (vide, erreur,
    // « Réessayer ») : de vraies cibles D-pad visibles.
    val filterFocusRequester = remember { FocusRequester() }
    val statusFocusRequester = remember { FocusRequester() }
    val gridState = rememberTvLazyGridState().withTvPrefetchDisabled()
    val results by viewModel.searchResults.collectAsState()
    val searching by viewModel.searching.collectAsState()
    val searchState by viewModel.searchState.collectAsState()
    // Pastille "vu" (phase 12-13 watch-state) — films uniquement.
    val searchWatchStatus by viewModel.watchStatus.collectAsState()
    val searchWatchedMovieIds = remember(searchWatchStatus) { searchWatchStatus?.movies?.toSet().orEmpty() }
    // La bibliothèque est nécessaire à la correspondance instantanée
    // ci-dessous ; déjà chargée si l'accueil a été visité, mais Recherche
    // peut être le tout premier onglet ouvert (deep link, reprise d'app).
    LaunchedEffect(Unit) { viewModel.loadLibrary() }
    val libraryMovies by viewModel.movies.collectAsState()
    val librarySeries by viewModel.series.collectAsState()

    // Le clic sur l'icône de loupe change seulement l'état de navigation ;
    // il ne déplace pas automatiquement le focus Compose. Sans cette reprise
    // explicite, le focus restait sur « Accueil » et l'utilisateur tapait
    // dans le vide. On attend l'attache du BasicTextField avant de demander
    // le focus, avec les mêmes garanties que les autres écrans TV.
    var typeFilter by rememberSaveable { mutableStateOf(SearchTypeFilter.ALL) }
    LaunchedEffect(query) {
        viewModel.invalidateSearch()
        if (query.isBlank()) {
            focusedTmdbId = null
            focusedType = null
        } else { delay(350); viewModel.search(query) }
    }

    val filteredResults = remember(results, typeFilter) {
        typeFilter.apiType?.let { type -> BleachPresentation.searchViews(results).filter { it.type == type } } ?: BleachPresentation.searchViews(results)
    }
    // Normalize once per library update, never the entire catalogue on the
    // UI thread for every IME character. Keep local matches ahead of TMDb.
    val libraryIndex by produceState<List<IndexedSearchTitle>>(emptyList(), libraryMovies, librarySeries) {
        value = withContext(Dispatchers.Default) {
            libraryMovies.map {
                IndexedSearchTitle(SearchResultDto(it.tmdbId, "movie", it.title, it.year, it.posterPath, it.backdropPath, it.rating), normalizedSearchText(it.title))
            } + BleachPresentation.libraryViews(librarySeries).map {
                IndexedSearchTitle(SearchResultDto(it.tmdbId, "series", it.title, it.year, it.posterPath, it.backdropPath, it.rating, it.seriesPart), normalizedSearchText(it.title))
            }
        }
    }
    val matchedLibrary by produceState(Triple("", SearchTypeFilter.ALL, emptyList<SearchResultDto>()), query, libraryIndex, typeFilter) {
        val q = normalizedSearchText(query)
        val matches = if (q.isBlank()) {
            emptyList()
        } else {
            withContext(Dispatchers.Default) {
                libraryIndex.filter {
                    (typeFilter.apiType == null || it.result.type == typeFilter.apiType) && it.normalizedTitle.contains(q)
                }.sortedWith(compareBy({ !it.normalizedTitle.startsWith(q) }, { it.result.title.length }))
                    .map { it.result }
            }
        }
        value = Triple(query, typeFilter, matches)
    }
    // A cancelled worker must never paint matches for an older query/filter.
    val libraryMatches = if (matchedLibrary.first == query && matchedLibrary.second == typeFilter) matchedLibrary.third else emptyList()
    // La bibliothèque passe devant TMDb, sans doublon (même titre déjà en
    // bibliothèque ET dans les résultats distants).
    val mergedResults = remember(libraryMatches, filteredResults) {
        val seen = HashSet<String>()
        val combined = ArrayList<SearchResultDto>(libraryMatches.size + filteredResults.size)
        for (item in libraryMatches) if (seen.add(BleachPresentation.key(item))) combined.add(item)
        for (item in filteredResults) if (seen.add(BleachPresentation.key(item))) combined.add(item)
        combined
    }
    // Mémoire de la grille par identité (type, id, partie) : la navigation
    // sauvegarde le résultat ouvert, jamais un nœud de focus. Une mémoire par
    // requête + filtre : retaper repart d'une grille vierge.
    val resultKeys = remember(mergedResults) { mergedResults.map { BleachPresentation.key(it) } }
    val isResultVisible: (Int) -> Boolean = { index -> gridState.layoutInfo.visibleItemsInfo.any { it.index == index } }
    val gridMemory = rememberTvGridFocusMemory(
        gridKey = "search:${typeFilter.name}:$query",
        keys = resultKeys,
        isVisible = isResultVisible,
        scrollToItem = { gridState.scrollToItem(it) },
    )
    // Retour de fiche = l'écran est recréé avec un résultat déjà mémorisé.
    var restorePending by remember { mutableStateOf(gridMemory.hasSelection()) }
    val searchSettled = !searching && matchedLibrary.first == query &&
        (searchState is SearchState.Success || searchState is SearchState.Empty || searchState is SearchState.Error || searchState is SearchState.Unauthorized)

    // Le clic sur l'icône de loupe change seulement l'état de navigation ;
    // il ne déplace pas automatiquement le focus Compose. Sans cette reprise
    // explicite, le focus restait sur « Accueil » et l'utilisateur tapait
    // dans le vide. On attend l'attache du BasicTextField avant de demander
    // le focus, avec les mêmes garanties que les autres écrans TV.
    LaunchedEffect(showSearchField) {
        if (!showSearchField || resultFocusRequester == null || restorePending) return@LaunchedEffect
        repeat(4) { attempt ->
            if (resultFocusRequester.requestFocusSafely()) return@LaunchedEffect
            if (attempt < 3) withFrameNanos { }
        }
    }
    // Retour de fiche : défiler jusqu'au résultat mémorisé, attendre qu'il
    // s'attache, puis le focaliser. Résultat disparu une fois la recherche
    // terminée : le plus proche par position, sinon le champ (toujours
    // atteignable et au focus visible).
    LaunchedEffect(resultKeys, searchSettled) {
        if (!restorePending) return@LaunchedEffect
        val rememberedStillThere = gridMemory.rememberedKey() in resultKeys
        if (!rememberedStillThere && !searchSettled) return@LaunchedEffect
        val restored = resultKeys.isNotEmpty() &&
            gridMemory.restoreFocus(resultKeys, isResultVisible) { gridState.scrollToItem(it) }
        if (restored || resultFocusRequester?.requestFocusSafely() == true) restorePending = false
    }

    // OK « Rechercher » du clavier : le clavier se ferme et le focus part
    // vers le premier résultat, sinon le filtre actif, sinon le message
    // d'état — jamais un écran sans focus (l'ancien clearFocus()).
    val moveFocusAfterImeSearch: () -> Unit = {
        scope.launch {
            repeat(10) {
                withFrameNanos { }
                val moved = firstResultFocusRequester.requestFocusSafely() ||
                    filterFocusRequester.requestFocusSafely() ||
                    statusFocusRequester.requestFocusSafely()
                if (moved) return@launch
            }
        }
    }
    // Prise UNE fois par changement de résultats : l'ancien code appelait
    // results.take(8) à chaque itération de la boucle (sous-liste recréée à
    // chaque passage) + une fois pour lastIndex.
    val suggestions = remember(filteredResults) { filteredResults.take(8) }
    var fieldFocused by remember { mutableStateOf(false) }
    // La sidebar ne recouvre plus rien verticalement (refonte nav) : 96dp
    // compensait l'ancienne barre du haut flottante, devenu inutile.
    Column(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background).padding(start = 36.dp, top = 24.dp, end = 36.dp, bottom = 23.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (showSearchField) {
                Text(
                    "Recherche",
                    style = if (beta) MaterialTheme.typography.headlineMedium else TextStyle(fontSize = 23.sp, fontWeight = FontWeight.Black),
                    color = if (beta) MovvizTheme.palette.ink else MaterialTheme.colorScheme.onBackground,
                )
                Spacer(Modifier.width(18.dp))
                SearchField(
                    value = query,
                    focused = fieldFocused,
                    onFocusChanged = { fieldFocused = it },
                    onValueChange = onQueryChange,
                    onSearch = {
                        viewModel.search(query)
                        moveFocusAfterImeSearch()
                    },
                    modifier = Modifier.width(323.dp),
                    focusRequester = resultFocusRequester,
                    // BAS : filtres (dès qu'une requête existe), sinon le
                    // message d'état — l'ordre visuel de l'écran.
                    downFocusRequester = if (query.isNotBlank()) filterFocusRequester else statusFocusRequester,
                    beta = beta,
                )
            }
        }
        Spacer(Modifier.height(14.dp))
        if (query.isNotBlank()) {
            SearchTypeFilters(typeFilter, activeFocusRequester = filterFocusRequester, beta = beta) { typeFilter = it }
            Spacer(Modifier.height(11.dp))
        }
        if (query.isNotBlank() && suggestions.isNotEmpty()) {
            SearchSuggestionsRow(
                suggestions = suggestions,
                isHighlighted = { item -> item.tmdbId == focusedTmdbId && item.type == focusedType },
                onSelect = { onQueryChange(it.title) },
                beta = beta,
            )
            Spacer(Modifier.height(14.dp))
        }
        when {
            // Les états vides restent une destination D-pad visible. Avant,
            // la NavRail tentait le premier poster inexistant, retombait sur
            // son ancre technique et l'utilisateur avait l'impression que
            // BAS ne quittait jamais le menu.
            query.isBlank() -> SearchFocusMessage(
                text = "Recherchez un film ou une série",
                focusRequester = statusTarget(showSearchField, statusFocusRequester, resultFocusRequester),
                beta = beta,
            )
            // Les correspondances de bibliothèque passent AVANT l'état
            // réseau : un titre déjà chez l'utilisateur s'affiche dès la
            // frappe, sans attendre le debounce ni la réponse TMDb — la
            // grille reste ensuite à jour au fil de l'arrivée des résultats
            // distants (mergedResults se recompose).
            mergedResults.isNotEmpty() -> TvLazyVerticalGrid(
                state = gridState,
                columns = TvGridCells.FixedSize(betaDp(116.dp, 112.dp)),
                horizontalArrangement = Arrangement.spacedBy(betaDp(14.dp, 12.dp)),
                verticalArrangement = Arrangement.spacedBy(betaDp(17.dp, 18.dp)),
                // Bêta : marge pour l'anneau extérieur de la première
                // colonne / ligne, compensée pour garder l'alignement.
                contentPadding = if (beta) PaddingValues(8.dp) else PaddingValues(0.dp),
                modifier = Modifier.fillMaxSize()
                    .let { if (beta) it.offset(x = (-8).dp) else it }
                    .then(gridMemory.containerModifier(restoreFocusRequester.takeIf { gridMemory.hasSelection() })),
            ) {
                // contentType : indique à la grille que toutes les cellules
                // partagent la même structure — elle peut réutiliser les
                // sous-compositions au scroll sans re-créer les nodes.
                itemsIndexed(mergedResults, key = { _, result -> BleachPresentation.key(result) }, contentType = { _, _ -> "search-result" }) { index, result ->
                    val resultKey = BleachPresentation.key(result)
                    SearchResultCard(
                        result,
                        onFocus = { focusedTmdbId = result.tmdbId; focusedType = result.type; focusedPart = result.seriesPart },
                        // Le même FocusRequester ne peut être attaché qu'à
                        // un seul nœud Compose. Quand le champ est affiché,
                        // c'est lui qui reçoit BAS depuis la barre ; le
                        // premier résultat est ensuite atteint naturellement
                        // par BAS. L'ancienne double attache rendait la
                        // recherche muette au D-pad sur certains appareils.
                        focusRequester = if (index == 0) firstResultFocusRequester else null,
                        memoryModifier = gridMemory.itemModifier(resultKey, index),
                        watched = result.type == "movie" && result.tmdbId in searchWatchedMovieIds,
                        beta = beta,
                    ) {
                        onOpenPartTitle(result.type, result.tmdbId, result.seriesPart)
                    }
                }
            }
            searchState is SearchState.Loading -> SearchFocusMessage(
                text = "Recherche…",
                focusRequester = statusTarget(showSearchField, statusFocusRequester, resultFocusRequester),
                beta = beta,
            )
            searchState is SearchState.Unauthorized -> SearchRetryMessage(
                text = "Session expirée. Reconnectez-vous.",
                onRetry = { viewModel.search(query) },
                focusRequester = statusTarget(showSearchField, statusFocusRequester, resultFocusRequester),
                beta = beta,
            )
            searchState is SearchState.Error -> SearchRetryMessage(
                text = "Recherche indisponible. Réessayer.",
                onRetry = { viewModel.search(query) },
                focusRequester = statusTarget(showSearchField, statusFocusRequester, resultFocusRequester),
                beta = beta,
            )
            else -> SearchFocusMessage(
                text = if (results.isEmpty()) "Aucun résultat pour « $query »" else "Aucun ${typeFilter.label.lowercase()} pour « $query »",
                focusRequester = statusTarget(showSearchField, statusFocusRequester, resultFocusRequester),
                beta = beta,
            )
        }
    }
}


/** Cible du message d'état : avec le champ affiché, un demandeur dédié (le
 *  champ porte déjà `resultFocusRequester`) ; sans champ, l'entrée de l'écran. */
private fun statusTarget(showSearchField: Boolean, status: FocusRequester, entry: FocusRequester?): FocusRequester? =
    if (showSearchField) status else entry

@Composable
private fun SearchTypeFilters(
    selected: SearchTypeFilter,
    activeFocusRequester: FocusRequester?,
    beta: Boolean,
    onSelect: (SearchTypeFilter) -> Unit,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(if (beta) 8.dp else 6.dp)) {
        SearchTypeFilter.entries.forEach { filter ->
            val active = filter == selected
            val requester = if (active) activeFocusRequester else null
            if (beta) {
                MovvizChip(
                    label = filter.label,
                    active = active,
                    onClick = { onSelect(filter) },
                    modifier = Modifier.tvPointerClick { onSelect(filter) },
                    focusRequester = requester,
                )
            } else {
                val shape = RoundedCornerShape(14.dp)
                Surface(
                    onClick = { onSelect(filter) },
                    modifier = Modifier
                        .let { if (requester != null) it.focusRequester(requester) else it }
                        .tvPointerClick { onSelect(filter) },
                    shape = ClickableSurfaceDefaults.shape(shape),
                    scale = ClickableSurfaceDefaults.scale(focusedScale = 1f), colors = ClickableSurfaceDefaults.colors(
                        containerColor = if (active) MaterialTheme.colorScheme.primary else MovvizSurface,
                        focusedContainerColor = MaterialTheme.colorScheme.primary,
                        contentColor = if (active) Color.White else MovvizInk,
                        focusedContentColor = Color.White,
                    ),
                    // Actif et focalisé partageaient la même couleur : sans
                    // bordure blanche, on ne voyait plus où était le focus.
                    border = ClickableSurfaceDefaults.border(
                        focusedBorder = Border(BorderStroke(2.dp, Color.White), shape = shape),
                    ),
                ) {
                    Text(filter.label, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(horizontal = 11.dp, vertical = 7.dp))
                }
            }
        }
    }
}

/**
 * Suggestions sous les filtres. Rangée paresseuse défilante : l'ancienne
 * Row fixe laissait des suggestions focalisables HORS de l'écran, et leur
 * focus n'était qu'un changement de couleur.
 */
@Composable
private fun SearchSuggestionsRow(
    suggestions: List<SearchResultDto>,
    isHighlighted: (SearchResultDto) -> Boolean,
    onSelect: (SearchResultDto) -> Unit,
    beta: Boolean,
) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
        Text(
            "Autres titres à découvrir",
            color = if (beta) MovvizTheme.palette.inkDim else MovvizInkDim,
            style = if (beta) MaterialTheme.typography.labelMedium else TextStyle(fontSize = 10.sp),
        )
        Spacer(Modifier.width(8.dp))
        TvLazyRow(
            state = rememberTvLazyListState().withTvPrefetchDisabled(),
            modifier = Modifier.weight(1f).focusRestorer(),
            // Bêta : place pour l'anneau extérieur des chips.
            contentPadding = if (beta) PaddingValues(8.dp) else PaddingValues(0.dp),
            horizontalArrangement = Arrangement.spacedBy(if (beta) 8.dp else 0.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            itemsIndexed(suggestions, key = { _, item -> BleachPresentation.key(item) }, contentType = { _, _ -> "suggestion" }) { index, item ->
                if (beta) {
                    MovvizChip(label = item.title, active = false, onClick = { onSelect(item) }, modifier = Modifier.tvPointerClick { onSelect(item) })
                } else {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        val shape = RoundedCornerShape(3.dp)
                        Surface(
                            onClick = { onSelect(item) },
                            modifier = Modifier.tvPointerClick { onSelect(item) },
                            scale = ClickableSurfaceDefaults.scale(focusedScale = 1f),
                            colors = ClickableSurfaceDefaults.colors(containerColor = Color.Transparent, focusedContainerColor = MovvizSurfaceStrong),
                            shape = ClickableSurfaceDefaults.shape(shape),
                            border = ClickableSurfaceDefaults.border(
                                focusedBorder = Border(BorderStroke(2.dp, Color.White.copy(alpha = 0.85f)), shape = shape),
                            ),
                        ) {
                            Text(item.title, color = if (isHighlighted(item)) MaterialTheme.colorScheme.primary else MovvizInk, fontSize = 10.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(horizontal = 3.dp, vertical = 2.dp))
                        }
                        if (index < suggestions.lastIndex) Text("  |  ", color = MovvizInkDim, fontSize = 9.sp)
                    }
                }
            }
        }
    }
}

/** Message d'état focalisable au focus VISIBLE (cible BAS depuis le champ). */
@Composable
private fun SearchFocusMessage(text: String, focusRequester: FocusRequester?, beta: Boolean) {
    MovvizFocusTarget(focusRequester = focusRequester) {
        Text(
            text = text,
            color = if (beta) MovvizTheme.palette.inkDim else MovvizInkDim,
            style = if (beta) MaterialTheme.typography.bodyMedium else TextStyle(fontSize = 11.sp),
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
        )
    }
}

/** Erreur + « Réessayer » : OK/ENTRÉE relance la recherche (l'ancien texte
 *  focalisable ne réagissait qu'au toucher). */
@Composable
private fun SearchRetryMessage(text: String, onRetry: () -> Unit, focusRequester: FocusRequester?, beta: Boolean) {
    MovvizFocusTarget(
        modifier = Modifier.tvPointerClick(onRetry),
        focusRequester = focusRequester,
        onClick = onRetry,
    ) {
        Text(
            text = text,
            color = if (beta) MovvizTheme.palette.inkSoft else MovvizInkDim,
            style = if (beta) MaterialTheme.typography.bodyLarge else TextStyle(fontSize = 15.sp),
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
        )
    }
}

/** Champ Bêta (style du champ web) : fond `chipContainer`, filet 8 %, au
 *  focus filet lavande 60 % + halo 7 %. */
private val BetaFieldRest = Color(0x13FFFFFF)
private val BetaFieldFocused = Color(0x99C4B6FF)
private val BetaFieldHalo = Color(0x12C4B6FF)

@Composable
private fun SearchField(
    value: String,
    focused: Boolean,
    onFocusChanged: (Boolean) -> Unit,
    onValueChange: (String) -> Unit,
    onSearch: () -> Unit,
    modifier: Modifier,
    focusRequester: FocusRequester? = null,
    downFocusRequester: FocusRequester? = null,
    beta: Boolean = false,
) {
    val keyboardController = LocalSoftwareKeyboardController.current
    val palette = MovvizTheme.palette
    val fieldShape = if (beta) MovvizBetaShapes.Field else RoundedCornerShape(20.dp)
    val frame = if (beta) {
        Modifier
            .height(48.dp)
            .drawBehind {
                if (focused) {
                    // Halo 3 dp autour du champ (lecture en phase de dessin).
                    val halo = 3.dp.toPx()
                    drawRoundRect(
                        color = BetaFieldHalo,
                        topLeft = Offset(-halo, -halo),
                        size = Size(size.width + 2 * halo, size.height + 2 * halo),
                        cornerRadius = CornerRadius(12.dp.toPx() + halo),
                    )
                }
            }
            .background(palette.chipContainer, fieldShape)
            .border(if (focused) 2.dp else 1.dp, if (focused) BetaFieldFocused else BetaFieldRest, fieldShape)
    } else {
        Modifier
            .height(39.dp)
            .border(2.dp, if (focused) MaterialTheme.colorScheme.primary else MovvizInk.copy(alpha = .25f), fieldShape)
            .background(MovvizSurface, fieldShape)
    }
    val textSize = if (beta) 15.sp else 13.sp
    Box(modifier.then(frame).onFocusChanged { onFocusChanged(it.isFocused) }.padding(horizontal = 15.dp), contentAlignment = Alignment.CenterStart) {
        if (value.isEmpty()) Text("Rechercher un titre…", color = if (beta) palette.inkDim else MovvizInkDim, fontSize = textSize)
        BasicTextField(
            value,
            onValueChange,
            singleLine = true,
            textStyle = if (beta) MaterialTheme.typography.bodyLarge.copy(color = palette.ink, fontSize = textSize) else TextStyle(fontSize = textSize, color = MovvizInk),
            cursorBrush = SolidColor(if (beta) palette.accent else Color.Black),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            // Le focus ne disparaît plus (ancien clearFocus) : l'écran le
            // déplace vers le premier résultat / le filtre / le message.
            keyboardActions = KeyboardActions(onSearch = { keyboardController?.hide(); onSearch() }),
            modifier = Modifier
                .fillMaxWidth()
                .let { if (focusRequester != null) it.focusRequester(focusRequester) else it }
                // BasicTextField retient les flèches pour le curseur : la
                // prévisualisation assure donc le passage aux filtres / au
                // message sous le champ. RETOUR n'est plus consommé : le
                // clavier système se ferme de lui-même au premier appui, le
                // focus RESTE sur le champ (focus visible), et un nouvel
                // appui remonte au gestionnaire RETOUR de l'app (fermeture de
                // la Recherche, retour à l'accueil).
                .onPreviewKeyEvent { event ->
                    when {
                        event.type == KeyEventType.KeyDown && event.key == Key.DirectionDown ->
                            downFocusRequester?.requestFocusSafely() == true
                        event.key == Key.Escape && event.type == KeyEventType.KeyUp -> {
                            keyboardController?.hide()
                            false
                        }
                        else -> false
                    }
                },
        )
    }
}

@Composable
private fun SearchResultCard(
    result: SearchResultDto,
    onFocus: () -> Unit,
    focusRequester: FocusRequester? = null,
    memoryModifier: Modifier = Modifier,
    watched: Boolean = false,
    beta: Boolean = false,
    onClick: () -> Unit,
) {
    val shape = if (beta) movvizCardShape() else RoundedCornerShape(8.dp)
    var focused by remember { mutableStateOf(false) }
    // Bêta : seule l'image zoome (la carte ne grandit pas) ; 1 en Stable.
    val imageZoom = animateMovvizImageZoom(focused)
    val palette = MovvizTheme.palette
    Column {
        Surface(
            onClick = onClick,
            modifier = memoryModifier
                .fillMaxWidth()
                .aspectRatio(2f / 3f)
                .let { if (focusRequester != null) it.focusRequester(focusRequester) else it }
                .movvizFocusRing(shape, enabled = beta)
                .onFocusChanged {
                    focused = it.isFocused
                    if (it.isFocused) onFocus()
                }
                .tvPointerClick(onClick),
            shape = ClickableSurfaceDefaults.shape(shape = shape),
            scale = if (beta) movvizBetaSurfaceScale() else ClickableSurfaceDefaults.scale(focusedScale = 1f),
            colors = ClickableSurfaceDefaults.colors(containerColor = if (beta) palette.surface else MovvizSurfaceStrong),
            border = if (beta) movvizCardBorder(shape, BorderStroke(2.dp, MaterialTheme.colorScheme.primary))
            else ClickableSurfaceDefaults.border(focusedBorder = Border(border = BorderStroke(2.dp, MaterialTheme.colorScheme.primary), shape = shape)),
        ) {
            Box(Modifier.fillMaxSize()) {
                result.posterPath?.let {
                    Image(
                        painter = rememberAsyncImagePainter("$TMDB_POSTER_BASE$it", contentScale = ContentScale.Crop),
                        contentDescription = result.title,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize().let { m -> if (beta) m.movvizImageZoom(imageZoom) else m },
                    )
                }
                if (result.rating > 0) RatingBadge(result.rating, Modifier.align(Alignment.TopStart).padding(5.dp))
                // Pastille "vu" — même langage visuel que partout ailleurs
                // (saison vue, épisode vu, PosterCard) : pastille noire à
                // coin arrondi en haut à droite.
                if (watched) {
                    Box(
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .background(Color.Black.copy(alpha = 0.88f), RoundedCornerShape(bottomStart = 6.dp))
                            .padding(horizontal = 7.dp, vertical = 5.dp),
                    ) {
                        Icon(imageVector = MovvizIconCheck, contentDescription = "Vu", tint = Color.White, modifier = Modifier.size(10.dp))
                    }
                }
            }
        }
        if (beta) {
            Text(result.title, style = MaterialTheme.typography.titleMedium, color = palette.ink, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 8.dp))
            Text(if (result.type == "series") "Série" else "Film", style = MaterialTheme.typography.labelSmall, color = palette.inkDim)
        } else {
            Text(result.title, color = MaterialTheme.colorScheme.onBackground, fontSize = 10.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 5.dp))
            Text(if (result.type == "series") "Série" else "Film", color = MovvizInkDim, fontSize = 8.sp)
        }
    }
}
