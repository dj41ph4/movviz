package com.movviz.tv.ui.home

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.ui.focus.focusRestorer
import androidx.tv.foundation.lazy.list.TvLazyRow
import androidx.tv.foundation.lazy.list.rememberTvLazyListState
import androidx.tv.foundation.lazy.list.itemsIndexed as tvRowItemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.derivedStateOf
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
import androidx.tv.foundation.lazy.grid.rememberTvLazyGridState
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
import com.movviz.tv.ui.theme.withTvPrefetchDisabled

internal enum class CatalogSort(val label: String) {
    RECENT("Récemment ajouté"),
    NAME("Nom"),
    RATING("Note"),
    YEAR("Année"),
}

/** Tri, genre et case « manquants » d'un onglet Films ou Séries de la
 *  Bibliothèque — hoisté jusqu'à MovvizNavHost (MainActivity) pour survivre
 *  à un aller-retour vers une fiche ET à un changement d'onglet de la
 *  sidebar (ex. Bibliothèque → Découverte → Bibliothèque) : sans ça, ces
 *  réglages locaux à CatalogScreen étaient perdus dès que l'écran quittait
 *  la composition. */
internal data class CatalogFilters(
    val sort: CatalogSort = CatalogSort.RECENT,
    val genre: CatalogGenreSelection? = null,
    val showMissing: Boolean = false,
)

/**
 * Catalogue Films/Séries TV : bibliothèque complète en grille, triable
 * (nom/note/année) et filtrable par genre — Découverte (DiscoverScreen)
 * couvre désormais le hero et les rangées éditoriales façon Netflix ; cet
 * écran-ci est le vrai inventaire, demandé en direct comme "une liste
 * complète de la bibliothèque avec tri par genre nom note etc".
 */
@Composable
internal fun CatalogScreen(
    viewModel: AppViewModel,
    type: HomeTab,
    onOpenTitle: (String, Int) -> Unit,
    entryFocusRequester: FocusRequester? = null,
    mode: MediaHubMode = MediaHubMode.LIBRARY,
    onModeChange: (MediaHubMode) -> Unit = {},
    onScrollChanged: (Boolean) -> Unit = {},
    // false depuis le nouvel onglet Bibliothèque de la sidebar (LibraryScreen) :
    // le toggle Suggestions/Bibliothèque n'a plus de sens quand Bibliothèque
    // est déjà elle-même un onglet de nav à part entière — Découverte est
    // à une flèche gauche de là, pas un mode à re-basculer dans l'écran.
    // Toujours true pour les appelants historiques (les anciens hubs
    // Films/Séries, s'ils redeviennent atteignables un jour).
    showModeToggle: Boolean = true,
    hoistedFilters: CatalogFilters? = null,
    onFiltersChange: (CatalogFilters) -> Unit = {},
) {
    val movies by viewModel.movies.collectAsState()
    val series by viewModel.series.collectAsState()
    val movieGenres by viewModel.movieGenres.collectAsState()
    val seriesGenres by viewModel.seriesGenres.collectAsState()
    val heroLogos by viewModel.heroLogos.collectAsState()
    // Pastille "vu" (phase 12-13 watch-state) — films uniquement.
    val catalogWatchStatus by viewModel.watchStatus.collectAsState()
    val watchedMovieIds = remember(catalogWatchStatus) { catalogWatchStatus?.movies?.toSet().orEmpty() }
    LaunchedEffect(Unit) { viewModel.loadLibrary() }
    val wantedType = if (type == HomeTab.MOVIES) "movie" else "series"
    LaunchedEffect(wantedType) { viewModel.loadGenres(wantedType) }
    val genres = if (type == HomeTab.MOVIES) movieGenres else seriesGenres

    val cards = remember(movies, series, type, watchedMovieIds) {
        if (type == HomeTab.MOVIES) {
            movies.map { TvTitleCard(it.id, it.title, it.posterPath, it.backdropPath, it.tmdbId, true, it.year, it.rating, it.genres, it.status, qualityLabel = resolutionLabelForCatalog(it.file?.resolution), hasHdr = !it.file?.hdr.isNullOrBlank()) }
                .withWatchedMovies(watchedMovieIds)
        } else {
            series.map { TvTitleCard(it.id, it.title, it.posterPath, it.backdropPath, it.tmdbId, false, it.year, it.rating, it.genres) }
        }
    }

    // Date d'ajout à la bibliothèque, par carte, pour le tri « Récemment ajouté ».
    val addedAtById = remember(movies, series, type) {
        if (type == HomeTab.MOVIES) movies.associate { it.id to it.addedAt } else series.associate { it.id to it.addedAt }
    }
    var sort by remember(type) { mutableStateOf(hoistedFilters?.sort ?: CatalogSort.RECENT) }
    var selectedGenre by remember(type) { mutableStateOf(hoistedFilters?.genre) }
    // Décoché par défaut : les derniers ajouts pas encore téléchargés
    // n'encombrent plus la bibliothèque tant qu'on ne demande pas
    // explicitement à les voir.
    var showMissing by remember(type) { mutableStateOf(hoistedFilters?.showMissing ?: false) }
    LaunchedEffect(sort, selectedGenre, showMissing) { onFiltersChange(CatalogFilters(sort, selectedGenre, showMissing)) }
    // Une série ne compte comme "manquante" que si AUCUN de ses épisodes
    // n'est disponible — une série avec ne serait-ce qu'un épisode reste
    // visible, contrairement à un film qui n'a qu'un seul fichier possible.
    val missingSeriesIds = remember(series) { series.filterNot { it.hasAvailableEpisode }.map { it.id }.toSet() }

    val filtered = remember(cards, selectedGenre, showMissing, missingSeriesIds) {
        val selection = selectedGenre
        cards.filter { card ->
            val matchesGenre = selection == null || cardMatchesCatalogGenre(card, selection)
            val isMissing = if (card.isMovie) card.status != null && card.status != "available" else card.id in missingSeriesIds
            matchesGenre && (showMissing || !isMissing)
        }
    }
    val sorted = remember(filtered, sort, addedAtById) {
        when (sort) {
            CatalogSort.RECENT -> filtered.sortedByDescending { addedAtById[it.id] ?: 0L }
            CatalogSort.NAME -> filtered.sortedBy { it.title.lowercase() }
            CatalogSort.RATING -> filtered.sortedByDescending { it.rating }
            CatalogSort.YEAR -> filtered.sortedByDescending { it.year ?: 0 }
        }
    }

    val topAnchor = remember { FocusRequester() }
    val gridState = rememberTvLazyGridState().withTvPrefetchDisabled()
    // Changer de tri ou de genre doit toujours ramener sur le premier
    // titre de la liste : sans ça, la grille restait scrollée là où
    // l'utilisateur l'avait laissée, sur un tri qui n'avait plus rien à
    // voir avec ce qui était affiché.
    LaunchedEffect(sort, selectedGenre, showMissing) { gridState.scrollToItem(0) }
    val hasScrolled by remember {
        derivedStateOf {
            gridState.firstVisibleItemIndex > 0 || gridState.firstVisibleItemScrollOffset > 12
        }
    }
    LaunchedEffect(hasScrolled) { onScrollChanged(hasScrolled) }

    // Catalogue 10-foot : un inventaire dense et calme, proche de Plex.
    // Les contrôles restent compacts afin que les premières affiches soient
    // immédiatement visibles en 1080p comme en 4K.
    Column(Modifier.fillMaxSize().padding(start = 42.dp, top = 24.dp, end = 39.dp, bottom = 23.dp)) {
        if (showModeToggle) {
            MediaHubToggleRow(
                mode = mode,
                onModeChange = onModeChange,
                firstFocusRequester = entryFocusRequester,
            )
            androidx.compose.foundation.layout.Spacer(modifier = Modifier.height(17.dp))
        }
        Text(
            text = "${type.label} · ${sorted.size}",
            style = TextStyle(fontSize = 20.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onBackground),
            // Le toggle masqué (showModeToggle=false) portait la cible D-pad
            // "flèche bas depuis la nav" — reportée ici pour ne jamais perdre
            // ce repère quand LibraryScreen appelle cet écran.
            modifier = Modifier.let {
                if (!showModeToggle && entryFocusRequester != null) it.focusRequester(entryFocusRequester).focusable() else it
            },
        )
        androidx.compose.foundation.layout.Spacer(modifier = Modifier.height(9.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            SortRow(sort = sort, onSelect = { sort = it })
            androidx.compose.foundation.layout.Spacer(modifier = Modifier.width(4.dp))
            MissingFilterChip(checked = showMissing, onToggle = { showMissing = !showMissing })
        }
        androidx.compose.foundation.layout.Spacer(modifier = Modifier.height(8.dp))
        if (genres.isNotEmpty()) {
            CatalogGenreRow(genres = genres, selected = selectedGenre, onSelect = { selectedGenre = if (selectedGenre?.key == it.key) null else it })
            androidx.compose.foundation.layout.Spacer(modifier = Modifier.height(11.dp))
        }
        when {
            sorted.isEmpty() -> Box(
                modifier = Modifier.fillMaxWidth().padding(top = 18.dp)
                    .focusRequester(entryFocusRequester ?: topAnchor).focusable(),
            ) {
                Text(text = "Aucun titre pour le moment", color = MovvizInkDim, style = TextStyle(fontSize = 11.sp))
            }
            else -> TvLazyVerticalGrid(
                // 132dp donne 6 à 7 affiches lisibles en 1080p (et davantage
                // en 4K) : assez dense pour une bibliothèque TV, sans devenir
                // une mosaïque illisible à trois mètres.
                columns = TvGridCells.FixedSize(99.dp),
                horizontalArrangement = Arrangement.spacedBy(9.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
                modifier = Modifier.fillMaxSize(),
                state = gridState,
            ) {
                itemsIndexed(sorted, key = { _, c -> c.id }, contentType = { _, _ -> "card" }) { index, card ->
                    PosterCard(
                        card = card,
                        onClick = { onOpenTitle(if (card.isMovie) "movie" else "series", card.tmdbId) },
                        // entryFocusRequester appartient exclusivement au
                        // couple Suggestions/Bibliothèque. Le réutiliser sur
                        // la première affiche rendait la cible ambiguë et
                        // pouvait faire sauter le focus directement dans la
                        // grille après une bascule de mode.
                        focusRequester = null,
                        // Même principe que les rangées Netflix : affiche
                        // portrait sans logo au repos, logo officiel posé
                        // dessus au focus — mais la carte NE grandit PAS en
                        // paysage ici (grille verticale, pas de rangée : un
                        // agrandissement décalerait les cartes voisines).
                        width = 99.dp,
                        aspectRatio = 2f / 3f,
                        preferPosterArt = true,
                        // La bibliothèque n'est pas une rangée éditoriale :
                        // titre + année restent visibles au repos pour ne pas
                        // obliger l'utilisateur à focaliser chaque affiche.
                        showCaption = true,
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
            }
        }
    }
}

@Composable
private fun SortRow(sort: CatalogSort, onSelect: (CatalogSort) -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
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
        scale = ClickableSurfaceDefaults.scale(focusedScale = 1f), colors = ClickableSurfaceDefaults.colors(
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
            style = TextStyle(fontSize = 10.sp, fontWeight = if (active) FontWeight.Bold else FontWeight.SemiBold),
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp),
        )
    }
}

/** Case à cocher « Afficher les manquants », décochée par défaut : masque
 *  les titres pas encore téléchargés (film sans fichier, série sans aucun
 *  épisode disponible) pour ne pas mélanger derniers ajouts et vraie
 *  bibliothèque prête à regarder. */
@Composable
private fun MissingFilterChip(checked: Boolean, onToggle: () -> Unit) {
    var focused by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(50)
    Surface(
        onClick = onToggle,
        modifier = Modifier.onFocusChanged { focused = it.isFocused }.tvPointerClick(onToggle),
        shape = ClickableSurfaceDefaults.shape(shape = shape),
        scale = ClickableSurfaceDefaults.scale(focusedScale = 1f), colors = ClickableSurfaceDefaults.colors(
            containerColor = if (checked) Color.White.copy(alpha = 0.20f) else Color.White.copy(alpha = 0.06f),
            focusedContainerColor = Color.White.copy(alpha = 0.26f),
            contentColor = if (checked) Color.White else MovvizInkSoft,
            focusedContentColor = Color.White,
        ),
        border = ClickableSurfaceDefaults.border(
            focusedBorder = Border(border = androidx.compose.foundation.BorderStroke(2.dp, Color.White.copy(alpha = 0.75f)), shape = shape),
        ),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp),
        ) {
            Box(
                modifier = Modifier
                    .size(12.dp)
                    .background(if (checked) Color.White else Color.Transparent, RoundedCornerShape(3.dp))
                    .border(androidx.compose.foundation.BorderStroke(1.5.dp, if (checked) Color.White else Color.White.copy(alpha = 0.6f)), RoundedCornerShape(3.dp)),
                contentAlignment = Alignment.Center,
            ) {
                if (checked) {
                    Text(
                        text = "✓",
                        style = TextStyle(fontSize = 9.sp, fontWeight = FontWeight.Black, color = Color.Black),
                    )
                }
            }
            androidx.compose.foundation.layout.Spacer(modifier = Modifier.width(7.dp))
            Text(
                text = "Afficher les manquants",
                style = TextStyle(fontSize = 10.sp, fontWeight = if (checked) FontWeight.Bold else FontWeight.SemiBold),
            )
        }
    }
}

internal data class CatalogGenreSelection(val key: String, val label: String)
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
    TvLazyRow(
        state = rememberTvLazyListState().withTvPrefetchDisabled(),
        modifier = Modifier.focusRestorer(),
        contentPadding = PaddingValues(end = 18.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        tvRowItemsIndexed(SYNTHETIC_GENRES, key = { _, item -> "synth-${item.first}" }) { _, item ->
            val value = CatalogGenreSelection(item.first, item.second)
            CatalogGenreChip(label = item.second, active = selected?.key == item.first, onClick = { onSelect(value) })
        }
        tvRowItemsIndexed(genres, key = { _, g -> "tmdb-${g.id}" }) { _, g ->
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
            .tvFocusLift(focused, shape = shape)
            .onFocusChanged { focused = it.isFocused }
            .tvPointerClick(onClick),
        shape = ClickableSurfaceDefaults.shape(shape = shape),
        scale = ClickableSurfaceDefaults.scale(focusedScale = 1f), colors = ClickableSurfaceDefaults.colors(
            containerColor = if (active) MovvizInk.copy(alpha = 0.9f) else MovvizInk.copy(alpha = 0.08f),
            contentColor = if (active) Color.White else MovvizInk,
        ),
        border = ClickableSurfaceDefaults.border(
            focusedBorder = Border(border = androidx.compose.foundation.BorderStroke(2.dp, Color.White.copy(alpha = 0.85f)), shape = shape),
        ),
    ) {
        Text(
            text = label,
            style = TextStyle(fontSize = 10.sp, fontWeight = FontWeight.SemiBold, color = if (focused || active) Color.White else MovvizInkSoft),
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
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
