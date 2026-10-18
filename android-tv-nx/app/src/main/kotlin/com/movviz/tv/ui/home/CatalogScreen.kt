package com.movviz.tv.ui.home

import com.movviz.tv.data.BleachPresentation

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
import androidx.compose.foundation.layout.offset
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
import androidx.compose.runtime.saveable.rememberSaveable
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
import com.movviz.tv.ui.theme.LocalMovvizBeta
import com.movviz.tv.ui.theme.MovvizChip
import com.movviz.tv.ui.theme.MovvizFocusTarget
import com.movviz.tv.ui.theme.MovvizIconCheck
import com.movviz.tv.ui.theme.MovvizTheme
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
/** Signature sauvegardable (Bundle) des réglages appliqués à la grille. */
internal fun catalogFilterSignature(sort: CatalogSort, genreKey: String?, showMissing: Boolean): String =
    "${sort.name}|${genreKey.orEmpty()}|$showMissing"

/**
 * Remonter la grille en tête uniquement quand les réglages ont VRAIMENT
 * changé depuis le dernier passage. `applied == null` = toute première
 * composition (la grille est déjà en tête) ; une signature identique =
 * simple retour sur l'écran (fiche, changement d'onglet), où la position
 * doit être conservée.
 */
internal fun shouldResetCatalogScroll(applied: String?, current: String): Boolean =
    applied != null && applied != current

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
    onOpenPartTitle: (String, Int, String?) -> Unit = { type, id, _ -> onOpenTitle(type, id) },
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
    // Cible de restauration de l'onglet (MainScreen) : la demander au retour
    // d'une fiche ramène sur la carte mémorisée de la grille. Attachée
    // seulement quand la grille a une carte mémorisée, sinon l'entrée
    // normale (chip actif) reste prioritaire.
    restoreFocusRequester: FocusRequester? = null,
) {
    val beta = LocalMovvizBeta.current
    val movies by viewModel.movies.collectAsState()
    val rawSeries by viewModel.series.collectAsState()
    val series = remember(rawSeries) { BleachPresentation.libraryViews(rawSeries) }
    LaunchedEffect(rawSeries) { viewModel.hydrateBleachLibrary() }
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
            series.map { TvTitleCard("${it.id}-${it.seriesPart.orEmpty()}", it.title, it.posterPath, it.backdropPath, it.tmdbId, false, it.year, it.rating, it.genres, seriesPart = it.seriesPart) }
        }
    }

    // Date d'ajout à la bibliothèque, par carte, pour le tri « Récemment ajouté ».
    val addedAtById = remember(movies, series, type) {
        if (type == HomeTab.MOVIES) movies.associate { it.id to it.addedAt } else series.associate { "${it.id}-${it.seriesPart.orEmpty()}" to it.addedAt }
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
    val missingSeriesIds = remember(series) { series.filterNot { it.hasAvailableEpisode }.map { "${it.id}-${it.seriesPart.orEmpty()}" }.toSet() }

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
    // voir avec ce qui était affiché. Mais un simple retour sur l'écran
    // (fiche, onglet) relançait aussi cet effet et remontait la grille : la
    // signature des réglages déjà appliqués est donc sauvegardée, et seul
    // un vrai changement remonte la grille.
    val filterSignature = catalogFilterSignature(sort, selectedGenre?.key, showMissing)
    var appliedFilterSignature by rememberSaveable(type) { mutableStateOf<String?>(null) }
    LaunchedEffect(filterSignature) {
        if (shouldResetCatalogScroll(appliedFilterSignature, filterSignature)) gridState.scrollToItem(0)
        appliedFilterSignature = filterSignature
    }
    // Mémoire de la grille par identité de carte (id, déjà suffixé de la
    // partie pour une série découpée) : retour de fiche → même carte. Une
    // clé par jeu de réglages : changer de tri repart d'une mémoire vierge
    // au lieu de défiler vers une carte qui n'a plus de sens à cet endroit.
    val gridKeys = remember(sorted) { sorted.map { it.id } }
    val gridMemory = rememberTvGridFocusMemory(
        gridKey = "catalog:${type.name}:$filterSignature",
        keys = gridKeys,
        isVisible = { index -> gridState.layoutInfo.visibleItemsInfo.any { it.index == index } },
        scrollToItem = { gridState.scrollToItem(it) },
    )
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
        CatalogTitle(label = type.label, count = sorted.size, beta = beta)
        androidx.compose.foundation.layout.Spacer(modifier = Modifier.height(9.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            // Le toggle masqué (showModeToggle=false) portait la cible D-pad
            // "flèche bas depuis la nav" : reportée sur le chip de tri actif
            // (un vrai contrôle au focus visible), jamais sur un texte
            // focalisable sans indicateur.
            SortRow(
                sort = sort,
                onSelect = { sort = it },
                activeFocusRequester = if (!showModeToggle) entryFocusRequester else null,
                beta = beta,
            )
            androidx.compose.foundation.layout.Spacer(modifier = Modifier.width(4.dp))
            MissingFilterChip(checked = showMissing, onToggle = { showMissing = !showMissing }, beta = beta)
        }
        androidx.compose.foundation.layout.Spacer(modifier = Modifier.height(8.dp))
        if (genres.isNotEmpty()) {
            CatalogGenreRow(genres = genres, selected = selectedGenre, onSelect = { selectedGenre = if (selectedGenre?.key == it.key) null else it }, beta = beta)
            androidx.compose.foundation.layout.Spacer(modifier = Modifier.height(11.dp))
        }
        when {
            // État vide : une vraie cible D-pad au focus visible (jamais une
            // boîte focalisable invisible). GAUCHE rejoint la sidebar via la
            // sortie du groupe MainScreen.
            sorted.isEmpty() -> MovvizFocusTarget(
                modifier = Modifier.padding(top = 18.dp),
                // entryFocusRequester est déjà porté par le toggle ou le chip
                // de tri actif : un demandeur ne s'attache qu'à un seul nœud.
                focusRequester = topAnchor,
            ) {
                Text(
                    text = "Aucun titre pour le moment",
                    color = if (beta) MovvizTheme.palette.inkDim else MovvizInkDim,
                    style = if (beta) MaterialTheme.typography.bodyMedium else TextStyle(fontSize = 11.sp),
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
                )
            }
            else -> TvLazyVerticalGrid(
                // 132dp donne 6 à 7 affiches lisibles en 1080p (et davantage
                // en 4K) : assez dense pour une bibliothèque TV, sans devenir
                // une mosaïque illisible à trois mètres.
                columns = TvGridCells.FixedSize(com.movviz.tv.ui.theme.betaDp(99.dp, 112.dp)),
                horizontalArrangement = Arrangement.spacedBy(com.movviz.tv.ui.theme.betaDp(9.dp, 12.dp)),
                verticalArrangement = Arrangement.spacedBy(com.movviz.tv.ui.theme.betaDp(14.dp, 18.dp)),
                // Bêta : l'anneau de focus est dessiné 6 dp autour de la
                // carte ; 8 dp de marge interne évitent qu'il soit rogné sur
                // la première colonne / ligne, et le décalage garde les
                // affiches alignées sur les chips au-dessus.
                contentPadding = if (beta) PaddingValues(8.dp) else PaddingValues(0.dp),
                modifier = Modifier.fillMaxSize()
                    .let { if (beta) it.offset(x = (-8).dp) else it }
                    .then(gridMemory.containerModifier(restoreFocusRequester.takeIf { gridMemory.hasSelection() })),
                state = gridState,
            ) {
                itemsIndexed(sorted, key = { _, c -> c.id }, contentType = { _, _ -> "card" }) { index, card ->
                    PosterCard(
                        card = card,
                        modifier = gridMemory.itemModifier(card.id, index),
                        onClick = { onOpenPartTitle(if (card.isMovie) "movie" else "series", card.tmdbId, card.seriesPart) },
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
                        width = com.movviz.tv.ui.theme.betaDp(99.dp, 112.dp),
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

/** Titre de page : Stable « Films · 123 » d'un bloc ; Bêta titre éditorial
 *  + compteur en chiffres mono, sur une seule ligne. */
@Composable
private fun CatalogTitle(label: String, count: Int, beta: Boolean) {
    if (beta) {
        Row(verticalAlignment = Alignment.Bottom) {
            Text(text = label, style = MaterialTheme.typography.headlineMedium, color = MovvizTheme.palette.ink, maxLines = 1)
            androidx.compose.foundation.layout.Spacer(modifier = Modifier.width(12.dp))
            Text(
                text = count.toString(),
                style = MovvizTheme.textStyles.count,
                color = MovvizTheme.palette.inkDim,
                maxLines = 1,
                modifier = Modifier.padding(bottom = 3.dp),
            )
        }
    } else {
        Text(
            text = "$label · $count",
            style = TextStyle(fontSize = 20.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onBackground),
        )
    }
}

@Composable
private fun SortRow(sort: CatalogSort, onSelect: (CatalogSort) -> Unit, activeFocusRequester: FocusRequester?, beta: Boolean) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        CatalogSort.entries.forEach { option ->
            val active = sort == option
            val requester = if (active) activeFocusRequester else null
            if (beta) {
                MovvizChip(label = option.label, active = active, onClick = { onSelect(option) }, modifier = Modifier.tvPointerClick { onSelect(option) }, focusRequester = requester)
            } else {
                SortChip(label = option.label, active = active, onClick = { onSelect(option) }, focusRequester = requester)
            }
        }
    }
}

@Composable
private fun SortChip(label: String, active: Boolean, onClick: () -> Unit, focusRequester: FocusRequester? = null) {
    var focused by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(50)
    Surface(
        onClick = onClick,
        modifier = Modifier
            .let { if (focusRequester != null) it.focusRequester(focusRequester) else it }
            .onFocusChanged { focused = it.isFocused }.tvPointerClick(onClick),
        shape = ClickableSurfaceDefaults.shape(shape = shape),
        scale = ClickableSurfaceDefaults.scale(focusedScale = 1f), colors = ClickableSurfaceDefaults.colors(
            containerColor = if (active) Color.White.copy(alpha = 0.20f) else Color.White.copy(alpha = 0.06f),
            focusedContainerColor = Color.White.copy(alpha = 0.26f),
            contentColor = if (active) Color.White else MovvizInkSoft,
            focusedContentColor = Color.White,
        ),
        border = ClickableSurfaceDefaults.border(
            focusedBorder = Border(border = com.movviz.tv.ui.theme.movvizFocusBorder(shape, androidx.compose.foundation.BorderStroke(2.dp, Color.White.copy(alpha = 0.75f))), shape = shape),
        ),
    ) {
        Text(
            text = label,
            style = TextStyle(fontSize = com.movviz.tv.ui.theme.betaSp(10f, 13f), fontWeight = if (active) FontWeight.Bold else FontWeight.SemiBold),
            modifier = Modifier.padding(horizontal = 14.dp, vertical = com.movviz.tv.ui.theme.betaDp(6.dp, 9.dp)),
        )
    }
}

/** Case à cocher « Afficher les manquants », décochée par défaut : masque
 *  les titres pas encore téléchargés (film sans fichier, série sans aucun
 *  épisode disponible) pour ne pas mélanger derniers ajouts et vraie
 *  bibliothèque prête à regarder. */
@Composable
private fun MissingFilterChip(checked: Boolean, onToggle: () -> Unit, beta: Boolean) {
    if (beta) {
        MovvizChip(
            label = "Afficher les manquants",
            active = checked,
            onClick = onToggle,
            modifier = Modifier.tvPointerClick(onToggle),
            leadingIcon = if (checked) MovvizIconCheck else null,
        )
        return
    }
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
            focusedBorder = Border(border = com.movviz.tv.ui.theme.movvizFocusBorder(shape, androidx.compose.foundation.BorderStroke(2.dp, Color.White.copy(alpha = 0.75f))), shape = shape),
        ),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 14.dp, vertical = com.movviz.tv.ui.theme.betaDp(6.dp, 9.dp)),
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
                style = TextStyle(fontSize = com.movviz.tv.ui.theme.betaSp(10f, 13f), fontWeight = if (checked) FontWeight.Bold else FontWeight.SemiBold),
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
private fun CatalogGenreRow(genres: List<GenreDto>, selected: CatalogGenreSelection?, onSelect: (CatalogGenreSelection) -> Unit, beta: Boolean) {
    TvLazyRow(
        state = rememberTvLazyListState().withTvPrefetchDisabled(),
        modifier = Modifier.focusRestorer(),
        contentPadding = PaddingValues(end = 18.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        tvRowItemsIndexed(SYNTHETIC_GENRES, key = { _, item -> "synth-${item.first}" }) { _, item ->
            val value = CatalogGenreSelection(item.first, item.second)
            CatalogGenreChip(label = item.second, active = selected?.key == item.first, onClick = { onSelect(value) }, beta = beta)
        }
        tvRowItemsIndexed(genres, key = { _, g -> "tmdb-${g.id}" }) { _, g ->
            val value = CatalogGenreSelection(g.id.toString(), g.name)
            CatalogGenreChip(label = g.name, active = selected?.key == value.key, onClick = { onSelect(value) }, beta = beta)
        }
    }
}

@Composable
private fun CatalogGenreChip(label: String, active: Boolean, onClick: () -> Unit, beta: Boolean) {
    // Bêta : chip partagé (actif ivoire, focus = anneau extérieur) — remplace
    // l'ancien chip actif violet dont le focus se confondait avec la sélection.
    if (beta) {
        MovvizChip(label = label, active = active, onClick = onClick, modifier = Modifier.tvPointerClick(onClick))
        return
    }
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
            focusedBorder = Border(border = com.movviz.tv.ui.theme.movvizFocusBorder(shape, androidx.compose.foundation.BorderStroke(2.dp, Color.White.copy(alpha = 0.85f))), shape = shape),
        ),
    ) {
        Text(
            text = label,
            style = TextStyle(fontSize = com.movviz.tv.ui.theme.betaSp(10f, 13f), fontWeight = FontWeight.SemiBold, color = if (focused || active) Color.White else MovvizInkSoft),
            modifier = Modifier.padding(horizontal = 12.dp, vertical = com.movviz.tv.ui.theme.betaDp(6.dp, 9.dp)),
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
