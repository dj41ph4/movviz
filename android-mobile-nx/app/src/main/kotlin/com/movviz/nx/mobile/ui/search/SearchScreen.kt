package com.movviz.nx.mobile.ui.search

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.*
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
import androidx.tv.material3.Border
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.Icon
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import coil.compose.rememberAsyncImagePainter
import com.movviz.nx.mobile.AppViewModel
import com.movviz.nx.mobile.data.SearchResultDto
import com.movviz.nx.mobile.ui.theme.MovvizBrand
import com.movviz.nx.mobile.ui.theme.MovvizBrand2
import com.movviz.nx.mobile.ui.theme.MovvizIconSearch
import com.movviz.nx.mobile.ui.theme.MovvizInk
import com.movviz.nx.mobile.ui.theme.MovvizInkDim
import com.movviz.nx.mobile.ui.theme.MovvizInkSoft
import com.movviz.nx.mobile.ui.theme.MovvizSurface
import com.movviz.nx.mobile.ui.theme.MovvizSurfaceStrong
import com.movviz.nx.mobile.ui.theme.RatingBadge
import com.movviz.nx.mobile.ui.theme.tvFocusLift
import com.movviz.nx.mobile.ui.theme.tvPointerClick
import kotlinx.coroutines.delay

// w342, PAS w500 : les cartes de résultats font 154dp de large (~310px
// physiques en 1080p) — w342 couvre avec marge pour les TV 4K sans
// télécharger le double de pixels inutilement (leçon Elefin : jamais
// d'image plus grande que le rendu, la moitié du poids réseau/mémoire).
private const val TMDB_POSTER_BASE = "https://image.tmdb.org/t/p/w342"

private enum class SearchTypeFilter(val label: String, val apiType: String?) {
    ALL("Tout", null), MOVIES("Films", "movie"), SERIES("Séries", "series"),
}

/** Recherche TV inspirée du flux Netflix : résultats pendant la saisie,
 * suggestions sous le champ, cartes larges et aperçu du titre ciblé. */
@Composable
fun SearchScreen(
    viewModel: AppViewModel,
    onOpenTitle: (type: String, tmdbId: Int) -> Unit,
    query: String = "",
    onQueryChange: (String) -> Unit = {},
    showSearchField: Boolean = true,
    // Cible D-pad pour sortir du champ de recherche (NavRail.SearchButton) :
    // première carte de la grille de résultats.
    resultFocusRequester: FocusRequester? = null,
    // "Annuler" — portrait uniquement (voir PortraitSearchScreen). Sans
    // effet en paysage/TV, où il n'existe aucun lien "Annuler" dans la barre.
    onCancel: () -> Unit = {},
) {
    val compactPortrait = androidx.compose.ui.platform.LocalConfiguration.current.let {
        it.screenWidthDp < 600 && it.screenHeightDp > it.screenWidthDp
    }
    if (compactPortrait) {
        PortraitSearchScreen(
            viewModel = viewModel,
            onOpenTitle = onOpenTitle,
            query = query,
            onQueryChange = onQueryChange,
            onCancel = onCancel,
        )
        return
    }
    // Carte "focusée" identifiée par type+tmdbId (2 primitifs) plutôt que par
    // l'objet SearchResultDto entier : la comparaison par égalité structurelle
    // de la data class compare TOUS ses champs (posterPath, overview...) pour
    // chaque cellule visible de la grille à chaque déplacement de focus —
    // deux int/string, c'est instantané et ne retient rien de lourd.
    var focusedTmdbId by remember { mutableStateOf<Int?>(null) }
    var focusedType by remember { mutableStateOf<String?>(null) }
    // Distinct du requester d'entrée depuis la barre : un requester Compose
    // ne s'attache qu'à un seul nœud. Celui-ci est exclusivement la première
    // carte, pour que BAS depuis le champ sorte toujours du clavier vers les
    // résultats réels.
    val firstResultFocusRequester = remember { FocusRequester() }
    val results by viewModel.searchResults.collectAsState()
    val searching by viewModel.searching.collectAsState()
    var typeFilter by remember { mutableStateOf(SearchTypeFilter.ALL) }

    // Le clic sur l'icône de loupe change seulement l'état de navigation ;
    // il ne déplace pas automatiquement le focus Compose. Sans cette reprise
    // explicite, le focus restait sur « Accueil » et l'utilisateur tapait
    // dans le vide. On attend l'attache du BasicTextField avant de demander
    // le focus, avec les mêmes garanties que les autres écrans TV.
    LaunchedEffect(showSearchField) {
        if (!showSearchField || resultFocusRequester == null) return@LaunchedEffect
        repeat(4) { attempt ->
            if (runCatching { resultFocusRequester.requestFocus() }.isSuccess) return@LaunchedEffect
            if (attempt < 3) withFrameNanos { }
        }
    }

    LaunchedEffect(query) {
        if (query.isBlank()) {
            focusedTmdbId = null
            focusedType = null
        } else { delay(350); viewModel.search(query) }
    }

    // Prise UNE fois par changement de résultats : l'ancien code appelait
    // results.take(8) à chaque itération de la boucle (sous-liste recréée à
    // chaque passage) + une fois pour lastIndex.
    val filteredResults = remember(results, typeFilter) {
        typeFilter.apiType?.let { type -> results.filter { it.type == type } } ?: results
    }
    val suggestions = remember(filteredResults) { filteredResults.take(8) }
    var fieldFocused by remember { mutableStateOf(false) }
    // top = 96dp : même marge que Paramètres pour dégager la barre de nav
    // flottante sans bande de fond opaque ajoutée au-dessus (voir MainScreen).
    Column(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background).padding(start = 48.dp, top = 96.dp, end = 48.dp, bottom = 30.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (showSearchField) {
                Text("Recherche", style = TextStyle(fontSize = 30.sp, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.onBackground))
                Spacer(Modifier.width(24.dp))
                SearchField(
                    query,
                    fieldFocused,
                    { fieldFocused = it },
                    onQueryChange,
                    { viewModel.search(query) },
                    Modifier.width(430.dp),
                    resultFocusRequester,
                    if (filteredResults.isNotEmpty()) firstResultFocusRequester else null,
                )
            }
        }
        Spacer(Modifier.height(18.dp))
        if (query.isNotBlank()) {
            SearchTypeFilters(typeFilter) { typeFilter = it }
            Spacer(Modifier.height(14.dp))
        }
        if (query.isNotBlank() && suggestions.isNotEmpty()) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                Text("Autres titres à découvrir", color = MovvizInkDim, fontSize = 13.sp)
                Spacer(Modifier.width(10.dp))
                suggestions.forEachIndexed { index, item ->
                    Surface(onClick = { onQueryChange(item.title) }, modifier = Modifier.tvPointerClick { onQueryChange(item.title) }, colors = ClickableSurfaceDefaults.colors(containerColor = Color.Transparent, focusedContainerColor = MovvizSurfaceStrong), shape = ClickableSurfaceDefaults.shape(RoundedCornerShape(4.dp))) {
                        Text(item.title, color = if (item.tmdbId == focusedTmdbId && item.type == focusedType) MaterialTheme.colorScheme.primary else MovvizInk, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(horizontal = 4.dp, vertical = 3.dp))
                    }
                    if (index < suggestions.lastIndex) Text("  |  ", color = MovvizInkDim, fontSize = 12.sp)
                }
            }
            Spacer(Modifier.height(18.dp))
        }
        when {
            searching -> SearchFocusMessage(
                text = "Recherche…",
                focusRequester = if (showSearchField) null else resultFocusRequester,
            )
            // Les états vides restent une destination D-pad visible. Avant,
            // la NavRail tentait le premier poster inexistant, retombait sur
            // son ancre technique et l'utilisateur avait l'impression que
            // BAS ne quittait jamais le menu.
            query.isBlank() -> SearchFocusMessage(
                text = "Recherchez un film ou une série",
                focusRequester = if (showSearchField) null else resultFocusRequester,
            )
            filteredResults.isEmpty() -> SearchFocusMessage(
                text = if (results.isEmpty()) "Aucun résultat pour « $query »" else "Aucun ${typeFilter.label.lowercase()} pour « $query »",
                focusRequester = if (showSearchField) null else resultFocusRequester,
            )
            else -> TvLazyVerticalGrid(columns = TvGridCells.FixedSize(154.dp), horizontalArrangement = Arrangement.spacedBy(18.dp), verticalArrangement = Arrangement.spacedBy(22.dp), modifier = Modifier.fillMaxSize()) {
                // contentType : indique à la grille que toutes les cellules
                // partagent la même structure — elle peut réutiliser les
                // sous-compositions au scroll sans re-créer les nodes.
                itemsIndexed(filteredResults, key = { _, result -> "${result.type}-${result.tmdbId}" }, contentType = { _, _ -> "search-result" }) { index, result ->
                    SearchResultCard(
                        result,
                        result.tmdbId == focusedTmdbId && result.type == focusedType,
                        { focusedTmdbId = result.tmdbId; focusedType = result.type },
                        // Le même FocusRequester ne peut être attaché qu'à
                        // un seul nœud Compose. Quand le champ est affiché,
                        // c'est lui qui reçoit BAS depuis la barre ; le
                        // premier résultat est ensuite atteint naturellement
                        // par BAS. L'ancienne double attache rendait la
                        // recherche muette au D-pad sur certains appareils.
                        focusRequester = if (index == 0) firstResultFocusRequester else null,
                    ) { onOpenTitle(result.type, result.tmdbId) }
                }
            }
        }
    }
}

@Composable
private fun SearchTypeFilters(selected: SearchTypeFilter, onSelect: (SearchTypeFilter) -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        SearchTypeFilter.entries.forEach { filter ->
            val active = filter == selected
            Surface(
                onClick = { onSelect(filter) },
                modifier = Modifier.tvPointerClick { onSelect(filter) },
                shape = ClickableSurfaceDefaults.shape(RoundedCornerShape(18.dp)),
                colors = ClickableSurfaceDefaults.colors(
                    containerColor = if (active) MaterialTheme.colorScheme.primary else MovvizSurface,
                    focusedContainerColor = MaterialTheme.colorScheme.primary,
                    contentColor = if (active) Color.White else MovvizInk,
                    focusedContentColor = Color.White,
                ),
            ) {
                Text(filter.label, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(horizontal = 15.dp, vertical = 9.dp))
            }
        }
    }
}

@Composable
private fun SearchFocusMessage(text: String, focusRequester: FocusRequester?) {
    var focused by remember { mutableStateOf(false) }
    Text(
        text = text,
        color = if (focused) MovvizInk else MovvizInkDim,
        fontSize = 15.sp,
        modifier = Modifier
            .let { if (focusRequester != null) it.focusRequester(focusRequester) else it }
            .focusable()
            .onFocusChanged { focused = it.isFocused }
            .padding(vertical = 8.dp),
    )
}

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
) {
    val focusManager = LocalFocusManager.current
    val keyboardController = LocalSoftwareKeyboardController.current
    Box(modifier.height(52.dp).border(2.dp, if (focused) MaterialTheme.colorScheme.primary else MovvizInk.copy(alpha = .25f), RoundedCornerShape(26.dp)).background(MovvizSurface, RoundedCornerShape(26.dp)).onFocusChanged { onFocusChanged(it.isFocused) }.padding(horizontal = 20.dp), contentAlignment = Alignment.CenterStart) {
        if (value.isEmpty()) Text("Rechercher un titre…", color = MovvizInkDim, fontSize = 17.sp)
        BasicTextField(
            value,
            onValueChange,
            singleLine = true,
            textStyle = TextStyle(fontSize = 17.sp, color = MovvizInk),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            keyboardActions = KeyboardActions(onSearch = { onSearch(); focusManager.clearFocus(); keyboardController?.hide() }),
            modifier = Modifier
                .fillMaxWidth()
                .let { if (focusRequester != null) it.focusRequester(focusRequester) else it }
                // BasicTextField retient les flèches pour le curseur : la
                // prévisualisation assure donc le passage au premier poster.
                .onPreviewKeyEvent { event ->
                    if (event.type == KeyEventType.KeyDown && event.key == Key.DirectionDown) {
                        downFocusRequester?.let { runCatching { it.requestFocus() }.isSuccess } == true
                    } else false
                },
        )
}
}

@Composable
private fun SearchResultCard(result: SearchResultDto, selected: Boolean, onFocus: () -> Unit, focusRequester: FocusRequester? = null, onClick: () -> Unit) {
    val shape = RoundedCornerShape(10.dp)
    Column {
        Surface(onClick = onClick, modifier = Modifier.fillMaxWidth().aspectRatio(2f / 3f).let { if (focusRequester != null) it.focusRequester(focusRequester) else it }.tvFocusLift(selected, shape = shape).onFocusChanged { if (it.isFocused) onFocus() }.tvPointerClick(onClick), shape = ClickableSurfaceDefaults.shape(shape = shape), colors = ClickableSurfaceDefaults.colors(containerColor = MovvizSurfaceStrong), border = ClickableSurfaceDefaults.border(focusedBorder = Border(border = androidx.compose.foundation.BorderStroke(3.dp, MaterialTheme.colorScheme.primary), shape = shape))) {
            Box(Modifier.fillMaxSize()) {
                result.posterPath?.let { Image(painter = rememberAsyncImagePainter("$TMDB_POSTER_BASE$it"), contentDescription = result.title, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize()) }
                if (result.rating > 0) RatingBadge(result.rating, Modifier.align(Alignment.TopStart).padding(7.dp))
            }
        }
        Text(result.title, color = MaterialTheme.colorScheme.onBackground, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 7.dp))
        Text(if (result.type == "series") "Série" else "Film", color = MovvizInkDim, fontSize = 11.sp)
    }
}

// ────────────────────────────────────────────────────────────────
// Recherche portrait — esquisse mobile 2026-09 ("Recherche optimisée" /
// "Résultats + filtres") : barre persistante + "Annuler", pilules de type
// (Tous/Films/Séries — Acteurs/Collections omis, /api/search ne renvoie que
// des films et séries, voir SearchResultDto), puis Suggestions (résultats
// en cours de frappe), Tendances du moment (viewModel.trendingMovies/
// trendingSeries, déjà chargées) et Résultats en liste. Pas de section
// "Recherches récentes" : AUCUNE persistance locale de l'historique de
// recherche n'existe côté client (aucun DataStore, aucun StateFlow) — en
// ajouter une inventerait une fonctionnalité, donc la section est omise
// plutôt que simulée (voir le rapport de fin de tâche).
// ────────────────────────────────────────────────────────────────

private enum class SearchTypeFilter(val label: String, val apiType: String?) {
    ALL("Tous", null),
    MOVIE("Films", "movie"),
    SERIES("Séries", "series"),
}

@Composable
private fun PortraitSearchScreen(
    viewModel: AppViewModel,
    onOpenTitle: (type: String, tmdbId: Int) -> Unit,
    query: String,
    onQueryChange: (String) -> Unit,
    onCancel: () -> Unit,
) {
    val results by viewModel.searchResults.collectAsState()
    val searching by viewModel.searching.collectAsState()
    val trendingMovies by viewModel.trendingMovies.collectAsState()
    val trendingSeries by viewModel.trendingSeries.collectAsState()
    var typeFilter by remember { mutableStateOf(SearchTypeFilter.ALL) }

    LaunchedEffect(Unit) { viewModel.loadDiscovery() }
    LaunchedEffect(query) {
        if (query.isBlank()) return@LaunchedEffect
        delay(350)
        viewModel.search(query)
    }

    val filteredResults = remember(results, typeFilter) {
        val type = typeFilter.apiType
        if (type == null) results else results.filter { it.type == type }
    }
    val suggestions = remember(filteredResults) { filteredResults.take(6) }
    val trending = remember(trendingMovies, trendingSeries, typeFilter) {
        when (typeFilter) {
            SearchTypeFilter.MOVIE -> trendingMovies
            SearchTypeFilter.SERIES -> trendingSeries
            SearchTypeFilter.ALL -> (trendingMovies.take(3) + trendingSeries.take(3))
        }.take(5)
    }

    Column(Modifier.fillMaxSize().background(com.movviz.nx.mobile.ui.theme.MovvizBackground)) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth().statusBarsPadding().padding(start = 18.dp, end = 18.dp, top = 10.dp, bottom = 10.dp),
        ) {
            Surface(
                modifier = Modifier.weight(1f).height(46.dp),
                shape = ClickableSurfaceDefaults.shape(RoundedCornerShape(23.dp)),
                onClick = {},
                colors = ClickableSurfaceDefaults.colors(containerColor = MovvizSurface, contentColor = Color.White),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp)) {
                    Icon(imageVector = MovvizIconSearch, contentDescription = null, tint = MovvizInkSoft, modifier = Modifier.size(17.dp))
                    Spacer(Modifier.width(10.dp))
                    Box(Modifier.weight(1f)) {
                        if (query.isEmpty()) {
                            Text("Rechercher un film, une série, un acteur…", color = MovvizInkSoft, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                        BasicTextField(
                            value = query,
                            onValueChange = onQueryChange,
                            singleLine = true,
                            textStyle = TextStyle(fontSize = 14.sp, color = Color.White),
                            cursorBrush = androidx.compose.ui.graphics.SolidColor(Color.White),
                            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                            keyboardActions = KeyboardActions(onSearch = { viewModel.search(query) }),
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                    if (query.isNotEmpty()) {
                        Surface(
                            onClick = { onQueryChange("") },
                            modifier = Modifier.size(20.dp).tvPointerClick { onQueryChange("") },
                            shape = ClickableSurfaceDefaults.shape(CircleShape),
                            colors = ClickableSurfaceDefaults.colors(containerColor = Color.White.copy(alpha = 0.14f), contentColor = Color.White),
                        ) {
                            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                Text("×", fontSize = 13.sp, color = Color.White)
                            }
                        }
                    }
                }
            }
            Spacer(Modifier.width(12.dp))
            Text(
                "Annuler",
                color = Color.White,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.tvPointerClick(onCancel).padding(vertical = 8.dp),
            )
        }

        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            SearchTypeFilter.entries.forEach { option ->
                SearchTypePill(label = option.label, active = typeFilter == option, onClick = { typeFilter = option })
            }
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(horizontal = 18.dp, vertical = 8.dp),
        ) {
            if (query.isBlank()) {
                if (trending.isNotEmpty()) {
                    item { SearchSectionHeading("Tendances du moment") }
                    itemsIndexed(trending, key = { _, r -> "trend-${r.type}-${r.tmdbId}" }) { index, item ->
                        TrendingResultRow(index = index + 1, result = item, onClick = { onOpenTitle(item.type, item.tmdbId) })
                    }
                } else {
                    item {
                        Text(
                            "Recherchez un film, une série, un acteur",
                            color = MovvizInkDim,
                            fontSize = 14.sp,
                            modifier = Modifier.padding(top = 32.dp),
                        )
                    }
                }
            } else {
                if (suggestions.isNotEmpty()) {
                    item { SearchSectionHeading("Suggestions") }
                    items(suggestions, key = { "sugg-${it.type}-${it.tmdbId}" }) { item ->
                        SuggestionRow(title = item.title, onClick = { onQueryChange(item.title) })
                    }
                    item { Spacer(Modifier.height(10.dp)) }
                }
                item {
                    Text(
                        text = when {
                            searching -> "Recherche…"
                            filteredResults.isEmpty() -> "Aucun résultat pour « $query »"
                            else -> "${filteredResults.size} résultat${if (filteredResults.size > 1) "s" else ""} pour « $query »"
                        },
                        color = MovvizInkSoft,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(bottom = 8.dp),
                    )
                }
                items(filteredResults, key = { "res-${it.type}-${it.tmdbId}" }) { result ->
                    SearchResultListRow(result = result, onClick = { onOpenTitle(result.type, result.tmdbId) })
                }
            }
        }
    }
}

@Composable
private fun SearchTypePill(label: String, active: Boolean, onClick: () -> Unit) {
    val shape = RoundedCornerShape(50)
    Surface(
        onClick = onClick,
        modifier = Modifier.height(32.dp).tvPointerClick(onClick),
        shape = ClickableSurfaceDefaults.shape(shape),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = Color.Transparent,
            contentColor = if (active) Color.White else MovvizInkSoft,
        ),
    ) {
        Box(
            modifier = Modifier.then(
                if (active) Modifier.background(Brush.linearGradient(listOf(MovvizBrand, MovvizBrand2)), shape)
                else Modifier.background(Color.White.copy(alpha = 0.07f), shape),
            ),
        ) {
            Text(
                text = label,
                fontSize = 13.sp,
                fontWeight = if (active) FontWeight.Bold else FontWeight.SemiBold,
                color = Color.White,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp),
            )
        }
    }
}

@Composable
private fun SearchSectionHeading(text: String) {
    Text(
        text = text,
        color = Color.White,
        fontSize = 15.sp,
        fontWeight = FontWeight.Bold,
        modifier = Modifier.padding(top = 10.dp, bottom = 8.dp),
    )
}

/** Ligne "Suggestions" — icône loupe + texte, tape pour compléter la barre
 *  (même comportement que la puce horizontale du layout TV, en liste). */
@Composable
private fun SuggestionRow(title: String, onClick: () -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.fillMaxWidth().tvPointerClick(onClick).padding(vertical = 10.dp),
    ) {
        Icon(imageVector = MovvizIconSearch, contentDescription = null, tint = MovvizInkSoft, modifier = Modifier.size(15.dp))
        Spacer(Modifier.width(12.dp))
        Text(title, color = Color.White, fontSize = 14.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

/** Ligne "Tendances du moment" — numérotée, texte seul (même contenu que
 *  viewModel.trendingMovies/trendingSeries, déjà utilisées ailleurs dans
 *  l'app — aucune donnée inventée). */
@Composable
private fun TrendingResultRow(index: Int, result: SearchResultDto, onClick: () -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.fillMaxWidth().tvPointerClick(onClick).padding(vertical = 10.dp),
    ) {
        Text(
            text = "$index",
            color = MovvizInkSoft,
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.width(24.dp),
        )
        Text(result.title, color = Color.White, fontSize = 14.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

/** Carte résultat en liste (portrait) — poster + pastille note + titre +
 *  année/type. Le genre/synopsis du mockup ne sont pas repris : /api/search
 *  ne renvoie ni genres ni overview (voir SearchResultDto) — les ajouter
 *  aurait exigé d'inventer une donnée absente de l'API. */
@Composable
private fun SearchResultListRow(result: SearchResultDto, onClick: () -> Unit) {
    val shape = RoundedCornerShape(10.dp)
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.fillMaxWidth().tvPointerClick(onClick).padding(vertical = 8.dp),
    ) {
        Box(modifier = Modifier.width(64.dp).height(96.dp).clip(shape).background(MovvizSurfaceStrong)) {
            result.posterPath?.let {
                Image(
                    painter = rememberAsyncImagePainter("$TMDB_POSTER_BASE$it"),
                    contentDescription = result.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
            }
            if (result.rating > 0) RatingBadge(result.rating, Modifier.align(Alignment.TopStart).padding(5.dp))
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(result.title, color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Spacer(Modifier.height(4.dp))
            val meta = listOfNotNull(result.year?.toString(), if (result.type == "series") "Série" else "Film").joinToString("  ·  ")
            Text(meta, color = MovvizInkDim, fontSize = 12.sp)
        }
    }
}
