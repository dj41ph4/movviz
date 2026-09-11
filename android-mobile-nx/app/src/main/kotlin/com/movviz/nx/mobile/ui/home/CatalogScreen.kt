package com.movviz.nx.mobile.ui.home

import androidx.compose.foundation.Canvas
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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.platform.LocalConfiguration
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
import com.movviz.nx.mobile.AppViewModel
import androidx.compose.foundation.background
import androidx.compose.ui.graphics.Brush
import com.movviz.nx.mobile.data.GenreDto
import com.movviz.nx.mobile.ui.theme.MovvizBrand
import com.movviz.nx.mobile.ui.theme.MovvizBrand2
import com.movviz.nx.mobile.ui.theme.MovvizInk
import com.movviz.nx.mobile.ui.theme.MovvizInkDim
import com.movviz.nx.mobile.ui.theme.MovvizInkSoft
import com.movviz.nx.mobile.ui.theme.tvFocusLift
import com.movviz.nx.mobile.ui.theme.tvPointerClick
import com.movviz.nx.mobile.ui.theme.withTvPrefetchDisabled

private enum class CatalogSort(val label: String) {
    NAME("Nom"),
    RATING("Note"),
    YEAR("Année"),
}

/** Tranches de durée réelles (minutes) — filtre "Durée" de l'esquisse mobile,
 *  Films uniquement (voir TvTitleCard.runtime, jamais renseigné côté série). */
private enum class CatalogDuration(val label: String, val matches: (Int) -> Boolean) {
    SHORT("Court (< 90 min)", { it < 90 }),
    MEDIUM("Moyen (90-120 min)", { it in 90..120 }),
    LONG("Long (> 120 min)", { it > 120 }),
}

/**
 * Catalogue Films/Séries TV : bibliothèque complète en grille, triable
 * (nom/note/année) et filtrable par genre — Découverte (DiscoverScreen)
 * couvre désormais le hero et les rangées éditoriales façon Netflix ; cet
 * écran-ci est le vrai inventaire, demandé en direct comme "une liste
 * complète de la bibliothèque avec tri par genre nom note etc".
 */
@Composable
fun CatalogScreen(
    viewModel: AppViewModel,
    type: HomeTab,
    onOpenTitle: (String, Int) -> Unit,
    entryFocusRequester: FocusRequester? = null,
    mode: MediaHubMode = MediaHubMode.LIBRARY,
    onModeChange: (MediaHubMode) -> Unit = {},
    onScrollChanged: (Boolean) -> Unit = {},
    // Contrôle segmenté Découverte/Films/Séries (esquisse mobile 2026-09) —
    // secondaire à la barre basse, portrait uniquement. Voir MainScreen.
    activeHubTab: HomeTab = type,
    onSelectHubTab: (HomeTab) -> Unit = {},
    // Injecté par le shell NX Découverte (mode Bibliothèque) : même contrôle
    // Films/Séries plein-largeur que le mode Suggestions, remplace l'ancien
    // MediaHubSegmentedPills/FilterChipRow portrait quand fourni — voir
    // DiscoverHubScreen.kt.
    contextHeader: (@Composable () -> Unit)? = null,
) {
    val compactPortrait = LocalConfiguration.current.let { it.screenWidthDp < 600 && it.screenHeightDp > it.screenWidthDp }
    // Déplié : même métrique compacte que le portrait (barre TV absente,
    // colonne étroite) — voir rememberNarrowContent().
    val narrow = compactPortrait || rememberUnfoldedLandscape()
    val unfoldedOnly = rememberUnfoldedLandscape() && !compactPortrait
    val movies by viewModel.movies.collectAsState()
    val series by viewModel.series.collectAsState()
    val movieGenres by viewModel.movieGenres.collectAsState()
    val seriesGenres by viewModel.seriesGenres.collectAsState()
    val heroLogos by viewModel.heroLogos.collectAsState()
    LaunchedEffect(Unit) { viewModel.loadLibrary() }
    val wantedType = if (type == HomeTab.MOVIES) "movie" else "series"
    LaunchedEffect(wantedType) { viewModel.loadGenres(wantedType) }
    val genres = if (type == HomeTab.MOVIES) movieGenres else seriesGenres

    val cards = remember(movies, series, type) {
        if (type == HomeTab.MOVIES) {
            movies.map { TvTitleCard(it.id, it.title, it.posterPath, it.backdropPath, it.tmdbId, true, it.year, it.rating, it.genres, it.status, qualityLabel = resolutionLabelForCatalog(it.file?.resolution), hasHdr = !it.file?.hdr.isNullOrBlank(), runtime = it.runtime) }
        } else {
            series.map { TvTitleCard(it.id, it.title, it.posterPath, it.backdropPath, it.tmdbId, false, it.year, it.rating, it.genres) }
        }
    }

    var sort by remember(type) { mutableStateOf(CatalogSort.NAME) }
    var selectedGenre by remember(type) { mutableStateOf<CatalogGenreSelection?>(null) }
    // Filtre durée : uniquement réel pour les films — la fiche série n'a pas
    // de durée par titre côté API (voir TvTitleCard.runtime, absent des
    // cartes série ci-dessus). Reste donc null hors films (voir la ligne de
    // filtres plus bas, qui n'affiche la pilule "Durée" que pour Films).
    var selectedDuration by remember(type) { mutableStateOf<CatalogDuration?>(null) }

    val filtered = remember(cards, selectedGenre, selectedDuration) {
        val selection = selectedGenre
        val byGenre = if (selection == null) cards else cards.filter { cardMatchesCatalogGenre(it, selection) }
        val duration = selectedDuration
        if (duration == null) byGenre else byGenre.filter { card -> card.runtime?.let { duration.matches(it) } == true }
    }
    val sorted = remember(filtered, sort) {
        when (sort) {
            CatalogSort.NAME -> filtered.sortedBy { it.title.lowercase() }
            CatalogSort.RATING -> filtered.sortedByDescending { it.rating }
            CatalogSort.YEAR -> filtered.sortedByDescending { it.year ?: 0 }
        }
    }

    val topAnchor = remember { FocusRequester() }
    val gridState = rememberTvLazyGridState().withTvPrefetchDisabled()
    val hasScrolled by remember {
        derivedStateOf {
            gridState.firstVisibleItemIndex > 0 || gridState.firstVisibleItemScrollOffset > 12
        }
    }
    LaunchedEffect(hasScrolled) { onScrollChanged(hasScrolled) }

    // Catalogue 10-foot : un inventaire dense et calme, proche de Plex.
    // Les contrôles restent compacts afin que les premières affiches soient
    // immédiatement visibles en 1080p comme en 4K.
    Column(Modifier.fillMaxSize().padding(
        start = if (narrow) 16.dp else 56.dp,
        top = if (narrow) 12.dp else 78.dp,
        end = if (narrow) 16.dp else 52.dp,
        bottom = if (narrow) 24.dp else 30.dp,
    )) {
        if (narrow) {
            if (contextHeader != null) {
                contextHeader()
            } else {
                MediaHubSegmentedPills(active = activeHubTab, onSelect = onSelectHubTab)
                androidx.compose.foundation.layout.Spacer(modifier = Modifier.height(12.dp))
            }
            val genreLabels = remember(genres) { genres.map { it.name } }
            FilterChipRow(modifier = Modifier.padding(bottom = 4.dp)) {
                if (genreLabels.isNotEmpty()) {
                    FilterDropdownChip(
                        label = "Genres",
                        options = genreLabels,
                        selectedLabel = selectedGenre?.label,
                        onClear = { selectedGenre = null },
                        onSelectOption = { name ->
                            val synthetic = SYNTHETIC_GENRES.firstOrNull { it.second == name }
                            selectedGenre = when {
                                synthetic != null -> CatalogGenreSelection(synthetic.first, synthetic.second)
                                else -> genres.firstOrNull { it.name == name }?.let { CatalogGenreSelection(it.id.toString(), it.name) }
                            }
                        },
                    )
                }
                if (type == HomeTab.MOVIES) {
                    FilterDropdownChip(
                        label = "Durée",
                        options = CatalogDuration.entries.map { it.label },
                        selectedLabel = selectedDuration?.label,
                        onClear = { selectedDuration = null },
                        onSelectOption = { name -> selectedDuration = CatalogDuration.entries.firstOrNull { it.label == name } },
                    )
                }
            }
            androidx.compose.foundation.layout.Spacer(modifier = Modifier.height(14.dp))
        }
        MediaHubToggleRow(
            mode = mode,
            onModeChange = onModeChange,
            firstFocusRequester = entryFocusRequester,
        )
        androidx.compose.foundation.layout.Spacer(modifier = Modifier.height(22.dp))
        Text(
            text = "${type.label} · ${sorted.size}",
            style = TextStyle(fontSize = if (narrow) 23.sp else 26.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onBackground),
        )
        androidx.compose.foundation.layout.Spacer(modifier = Modifier.height(12.dp))
        SortRow(sort = sort, onSelect = { sort = it })
        androidx.compose.foundation.layout.Spacer(modifier = Modifier.height(10.dp))
        if (genres.isNotEmpty()) {
            CatalogGenreRow(genres = genres, selected = selectedGenre, onSelect = { selectedGenre = if (selectedGenre?.key == it.key) null else it })
            androidx.compose.foundation.layout.Spacer(modifier = Modifier.height(14.dp))
        }
        when {
            sorted.isEmpty() -> Box(
                modifier = Modifier.fillMaxWidth().padding(top = 24.dp)
                    .focusRequester(entryFocusRequester ?: topAnchor).focusable(),
            ) {
                Text(text = "Aucun titre pour le moment", color = MovvizInkDim, style = TextStyle(fontSize = 15.sp))
            }
            else -> TvLazyVerticalGrid(
                // 132dp donne 6 à 7 affiches lisibles en 1080p (et davantage
                // en 4K) : assez dense pour une bibliothèque TV, sans devenir
                // une mosaïque illisible à trois mètres. En déplié, 108.dp
                // donne 3 colonnes dans la colonne centrale étroite.
                columns = TvGridCells.FixedSize(if (compactPortrait) 150.dp else if (unfoldedOnly) 108.dp else 132.dp),
                horizontalArrangement = Arrangement.spacedBy(if (narrow) 10.dp else 12.dp),
                verticalArrangement = Arrangement.spacedBy(if (narrow) 14.dp else 18.dp),
                modifier = Modifier.fillMaxSize(),
                state = gridState,
                // Sans ce padding bas, les dernières affiches passaient sous
                // la barre basse flottante portrait (même correctif que
                // DiscoverScreen/DownloadsScreen).
                contentPadding = PaddingValues(bottom = if (compactPortrait) 156.dp else 0.dp),
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
                        width = if (compactPortrait) 150.dp else if (unfoldedOnly) 108.dp else 132.dp,
                        aspectRatio = 2f / 3f,
                        preferPosterArt = true,
                        // La bibliothèque n'est pas une rangée éditoriale :
                        // titre + année restent visibles au repos pour ne pas
                        // obliger l'utilisateur à focaliser chaque affiche.
                        showCaption = true,
                        titleLogoPath = heroLogos["${if (card.isMovie) "movie" else "series"}-${card.tmdbId}"],
                        onFocusedChange = { focused ->
                            if (focused) viewModel.requestHeroLogo(if (card.isMovie) "movie" else "series", card.tmdbId)
                        },
                    )
                }
            }
        }
    }
}

@Composable
private fun SortRow(sort: CatalogSort, onSelect: (CatalogSort) -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
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
        // Pilule active en dégradé de marque, comme les autres bascules de
        // la charte mobile (toggle Suggestions/Bibliothèque, Films/Séries).
        colors = ClickableSurfaceDefaults.colors(
            containerColor = if (active) Color.Transparent else Color.White.copy(alpha = 0.06f),
            focusedContainerColor = if (active) Color.Transparent else Color.White.copy(alpha = 0.14f),
            contentColor = if (active) Color.White else MovvizInkSoft,
            focusedContentColor = Color.White,
        ),
        border = ClickableSurfaceDefaults.border(
            focusedBorder = Border(border = androidx.compose.foundation.BorderStroke(2.dp, Color.White.copy(alpha = 0.75f)), shape = shape),
        ),
    ) {
        Box(
            modifier = Modifier.then(
                if (active) Modifier.background(Brush.linearGradient(listOf(MovvizBrand, MovvizBrand2)), shape)
                else Modifier,
            ),
        ) {
            Text(
                text = label,
                style = TextStyle(fontSize = 13.sp, fontWeight = if (active) FontWeight.Bold else FontWeight.SemiBold),
                modifier = Modifier.padding(horizontal = 18.dp, vertical = 8.dp),
            )
        }
    }
}

private data class CatalogGenreSelection(val key: String, val label: String)
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
    LazyRow(
        contentPadding = PaddingValues(end = 24.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        items(SYNTHETIC_GENRES, key = { "synth-${it.first}" }) { (id, label) ->
            val value = CatalogGenreSelection(id, label)
            CatalogGenreChip(label = label, active = selected?.key == id, onClick = { onSelect(value) })
        }
        items(genres, key = { "tmdb-${it.id}" }) { g ->
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
            .tvFocusLift(focused, shape = shape, maxScale = 1.04f)
            .onFocusChanged { focused = it.isFocused }
            .tvPointerClick(onClick),
        shape = ClickableSurfaceDefaults.shape(shape = shape),
        // Pilule de genre sélectionnée : dégradé de marque plutôt qu'un
        // aplat blanc neutre — même langage que les autres bascules.
        colors = ClickableSurfaceDefaults.colors(
            containerColor = if (active) Color.Transparent else MovvizInk.copy(alpha = 0.08f),
            contentColor = if (active) Color.White else MovvizInk,
        ),
        border = ClickableSurfaceDefaults.border(
            focusedBorder = Border(border = androidx.compose.foundation.BorderStroke(2.dp, Color.White.copy(alpha = 0.85f)), shape = shape),
        ),
    ) {
        Box(
            modifier = Modifier.then(
                if (active) Modifier.background(Brush.linearGradient(listOf(MovvizBrand, MovvizBrand2)), shape)
                else Modifier,
            ),
        ) {
            Text(
                text = label,
                style = TextStyle(fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = if (focused || active) Color.White else MovvizInkSoft),
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
            )
        }
    }
}

private fun resolutionLabelForCatalog(resolution: String?): String? = when {
    resolution == null -> null
    resolution.startsWith("2160") -> "4K"
    resolution.startsWith("1080") -> "1080p"
    resolution.startsWith("720") -> "720p"
    else -> resolution
}
