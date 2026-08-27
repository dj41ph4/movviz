package com.movviz.mobile.discover

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import com.movviz.mobile.MobileViewModel
import com.movviz.mobile.ui.theme.MovvizAmber
import com.movviz.mobile.ui.theme.MovvizBrand
import com.movviz.mobile.ui.theme.MovvizBrand2
import com.movviz.mobile.ui.theme.MovvizBrandGlow
import com.movviz.mobile.ui.theme.MovvizCyan
import com.movviz.mobile.ui.theme.MovvizDown
import com.movviz.mobile.ui.theme.MovvizInk
import com.movviz.mobile.ui.theme.MovvizInkDim
import com.movviz.mobile.ui.theme.MovvizInkSoft
import com.movviz.mobile.ui.theme.MovvizSurface
import com.movviz.mobile.ui.theme.MovvizSurfaceStrong
import com.movviz.tv.data.LibraryMovieDto
import com.movviz.tv.data.LibrarySeriesDto
import kotlinx.coroutines.launch

private const val BACKDROP_SM = "https://image.tmdb.org/t/p/w300"
private const val POSTER_SM = "https://image.tmdb.org/t/p/w154"
private val CardShape = RoundedCornerShape(16.dp)

/** Per-card library state — mirrors the exact statuses already handled by
 *  DetailScreen (MainActivity.kt) so a Discover card's button reads exactly
 *  like the rest of the app: movies carry a real server status, series only
 *  ever expose in-library or not (see LibrarySeriesDto's doc comment in
 *  ApiModels.kt — no per-series status field exists server-side). */
private sealed interface CardLibState {
    data object NotInLibrary : CardLibState
    data class Movie(val status: String) : CardLibState
    data object SeriesInLibrary : CardLibState
}

private fun cardLibState(result: DiscoverResultDto, movies: List<LibraryMovieDto>, series: List<LibrarySeriesDto>): CardLibState {
    return if (result.type == "movie") {
        movies.firstOrNull { it.tmdbId == result.tmdbId }?.let { CardLibState.Movie(it.status) } ?: CardLibState.NotInLibrary
    } else {
        if (series.any { it.tmdbId == result.tmdbId }) CardLibState.SeriesInLibrary else CardLibState.NotInLibrary
    }
}

/** "Dans la lignée de {title}" / "Puisque {title} vous a plu" for a
 *  becauseYouWatched:{anchorTmdbId} row, exact wording from fr.ts
 *  (discover.rowBecauseYouWatched / rowBecauseYouLiked) — every other key
 *  mirrors src/app/discover/page.tsx's rowLabel() switch. Both discover
 *  row layouts (movviz/allocine — see loadDiscoverLayout() server-side) are
 *  handled by the same flat switch, generically, same as desktop. */
private fun rowLabel(key: String, meta: DiscoverRowMetaDto?): String {
    if (key.startsWith("becauseYouWatched:") && meta != null) {
        return if (meta.verb == "liked") "Puisque ${meta.anchorTitle} vous a plu" else "Dans la lignée de ${meta.anchorTitle}"
    }
    return when (key) {
        "recommendedTop" -> "Sélection pour vous"
        "trendingPopular" -> "Tendances & populaires"
        "nowPlayingBoxOffice" -> "En salles"
        "upcomingVod" -> "Prochainement & VOD"
        "newSeriesRenewed" -> "Nouvelles & renouvelées"
        "recommended" -> "Suggestions pour vous"
        "trending" -> "Tendances"
        "popular" -> "Populaire"
        "topRated" -> "Mieux notés"
        "upcoming" -> "Prochainement"
        "onAir" -> "En diffusion"
        "newVod" -> "Nouvelles sorties"
        "nowPlaying" -> "Films à l'affiche"
        "boxOffice" -> "Box office"
        "kids" -> "Kids"
        "newSeries" -> "Nouvelles séries"
        "renewed" -> "Séries renouvelées"
        "c411Popular" -> "Populaires sur C411"
        "c411Recent" -> "Uploads récents sur C411"
        "c411Today" -> "Sorties du jour sur C411"
        "acclaimed" -> "Salué par la critique"
        "anime" -> "Univers anime"
        "teen" -> "Romance ado"
        "shortFormat" -> "Format court, grand impact"
        "genreAction" -> "Action"
        "genreComedy" -> "Comédie"
        "genreHorror" -> "Frissons garantis"
        "genreSciFi" -> "Science-fiction"
        else -> key
    }
}

@Composable
internal fun DiscoverScreen(padding: PaddingValues, vm: MobileViewModel, onTitleClick: (String, Int) -> Unit) {
    val discoverVm: DiscoverViewModel = viewModel()
    val baseUrl = vm.getBaseUrlCached()
    LaunchedEffect(baseUrl) { if (baseUrl != null) discoverVm.configure(baseUrl) }

    val moviesState by vm.movies.collectAsState()
    val seriesState by vm.series.collectAsState()

    val mediaType by discoverVm.mediaType.collectAsState()
    val rows by discoverVm.rows.collectAsState()
    val rowsLoading by discoverVm.rowsLoading.collectAsState()
    val libraryRecommendations by discoverVm.libraryRecommendations.collectAsState()
    val genres by discoverVm.genres.collectAsState()
    val selectedGenreId by discoverVm.selectedGenreId.collectAsState()
    val activeRowKey by discoverVm.activeRowKey.collectAsState()
    val searchQueryVm by discoverVm.searchQuery.collectAsState()
    val rowMeta by discoverVm.rowMeta.collectAsState()
    val browseResults by discoverVm.browseResults.collectAsState()
    val browsePage by discoverVm.browsePage.collectAsState()
    val browseTotalPages by discoverVm.browseTotalPages.collectAsState()
    val browseLoading by discoverVm.browseLoading.collectAsState()
    val browseLoadingMore by discoverVm.browseLoadingMore.collectAsState()

    val isBrowsing = selectedGenreId != null || activeRowKey != null || searchQueryVm.isNotBlank()
    // « Suggestions pour vous » est la surface bibliothèque de Movviz : le
    // moteur peut connaître bien plus de titres, mais cette rangée conserve
    // uniquement ceux disponibles pour CE profil, pas un faux bouton Ajouter.
    val localRecommendations = remember(libraryRecommendations, moviesState, seriesState, mediaType) {
        libraryRecommendations.filter { result ->
            if (mediaType == "movie") moviesState.any { it.tmdbId == result.tmdbId && it.status == "available" }
            else seriesState.any { it.tmdbId == result.tmdbId }
        }.distinctBy { it.tmdbId }.take(20)
    }
    val haptic = LocalHapticFeedback.current

    var searchInput by remember { mutableStateOf("") }
    LaunchedEffect(activeRowKey, selectedGenreId) { if (activeRowKey != null || selectedGenreId != null) searchInput = "" }
    LaunchedEffect(searchInput) {
        if (searchInput.trim().length >= 2) { kotlinx.coroutines.delay(280); discoverVm.updateSearchQuery(searchInput) }
        else if (searchInput.isEmpty() && searchQueryVm.isNotEmpty()) discoverVm.updateSearchQuery("")
    }

    var genreSheetOpen by remember { mutableStateOf(false) }

    val activeFilterLabel: String? = when {
        activeRowKey != null -> rowLabel(activeRowKey!!, rowMeta)
        selectedGenreId != null -> genres.firstOrNull { it.id == selectedGenreId }?.name
        else -> null
    }

    Box(Modifier.fillMaxSize().background(Color.Black)) {
        Column(Modifier.fillMaxSize()) {
            // ── Header : titre + onglets Films/Séries + bouton Genres ──
            Column(Modifier.statusBarsPadding().padding(start = 20.dp, end = 20.dp, top = 12.dp, bottom = 10.dp)) {
                Text("Découverte", color = MovvizInk, fontSize = 26.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.4).sp)
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    MediaTypePill("Films", mediaType == "movie") { haptic.performHapticFeedback(HapticFeedbackType.LongPress); discoverVm.setMediaType("movie") }
                    MediaTypePill("Séries", mediaType == "series") { haptic.performHapticFeedback(HapticFeedbackType.LongPress); discoverVm.setMediaType("series") }
                    Box(
                        Modifier.clip(RoundedCornerShape(12.dp))
                            .background(if (selectedGenreId != null) Brush.linearGradient(listOf(MovvizBrand, MovvizBrand2)) else Brush.linearGradient(listOf(MovvizSurfaceStrong, MovvizSurfaceStrong)))
                            .clickable { haptic.performHapticFeedback(HapticFeedbackType.LongPress); genreSheetOpen = true }
                            .padding(horizontal = 12.dp, vertical = 8.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(
                                genres.firstOrNull { it.id == selectedGenreId }?.name ?: "Genres",
                                color = if (selectedGenreId != null) Color.White else MovvizInkSoft,
                                fontSize = 13.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.widthIn(max = 90.dp)
                            )
                            Icon(Icons.Rounded.KeyboardArrowDown, null, tint = if (selectedGenreId != null) Color.White else MovvizInkSoft, modifier = Modifier.size(16.dp))
                        }
                    }
                }
                Spacer(Modifier.height(10.dp))
                OutlinedTextField(
                    value = searchInput, onValueChange = { searchInput = it }, modifier = Modifier.fillMaxWidth(), singleLine = true,
                    leadingIcon = { Icon(Icons.Rounded.Search, null, tint = MovvizInkDim, modifier = Modifier.size(18.dp)) },
                    trailingIcon = { if (searchInput.isNotEmpty()) IconButton({ searchInput = "" }) { Icon(Icons.Rounded.Close, null, tint = MovvizInkDim, modifier = Modifier.size(16.dp)) } },
                    placeholder = { Text("Rechercher un film ou une série…", color = MovvizInkDim, fontSize = 13.sp) },
                    textStyle = androidx.compose.ui.text.TextStyle(fontSize = 14.sp, color = MovvizInk),
                    shape = RoundedCornerShape(14.dp),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = MovvizBrand.copy(0.5f), unfocusedBorderColor = Color.White.copy(0.08f), focusedTextColor = MovvizInk, unfocusedTextColor = MovvizInk, cursorColor = MovvizBrand),
                )
                if (activeFilterLabel != null) {
                    Spacer(Modifier.height(8.dp))
                    Row(
                        Modifier.clip(RoundedCornerShape(10.dp)).background(Brush.linearGradient(listOf(MovvizBrand, MovvizBrand2)))
                            .clickable { discoverVm.clearBrowse(); searchInput = "" }
                            .padding(horizontal = 10.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        Text(activeFilterLabel, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Icon(Icons.Rounded.Close, null, tint = Color.White, modifier = Modifier.size(13.dp))
                    }
                }
            }

            if (!isBrowsing) {
                DiscoverHomeRows(
                    rows = rows, libraryRecommendations = localRecommendations, loading = rowsLoading, moviesState = moviesState, seriesState = seriesState,
                    vm = vm, onTitleClick = onTitleClick, onSeeAll = { key, meta -> discoverVm.seeAllRow(key, meta) },
                    bottomPadding = padding.calculateBottomPadding() + 24.dp,
                )
            } else {
                DiscoverBrowseGrid(
                    results = browseResults, loading = browseLoading, loadingMore = browseLoadingMore,
                    hasMore = browsePage < browseTotalPages, moviesState = moviesState, seriesState = seriesState,
                    vm = vm, onTitleClick = onTitleClick, onLoadMore = { discoverVm.loadMoreBrowse() },
                    bottomPadding = padding.calculateBottomPadding() + 24.dp,
                )
            }
        }

        if (genreSheetOpen) {
            GenreSheet(genres, selectedGenreId, onSelect = { id -> discoverVm.selectGenre(id); searchInput = ""; genreSheetOpen = false }, onDismiss = { genreSheetOpen = false })
        }
    }
}

@Composable
private fun MediaTypePill(label: String, active: Boolean, onClick: () -> Unit) {
    Box(
        Modifier.clip(RoundedCornerShape(12.dp))
            .background(if (active) Brush.linearGradient(listOf(MovvizBrand, MovvizBrand2)) else Brush.linearGradient(listOf(MovvizSurfaceStrong, MovvizSurfaceStrong)))
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 8.dp)
    ) {
        Text(label, color = if (active) Color.White else MovvizInkSoft, fontSize = 13.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun GenreSheet(genres: List<DiscoverGenreOption>, selectedId: String?, onSelect: (String?) -> Unit, onDismiss: () -> Unit) {
    Box(Modifier.fillMaxSize().background(Color.Black.copy(0.6f)).clickable { onDismiss() }, contentAlignment = Alignment.BottomCenter) {
        Column(
            Modifier.fillMaxWidth().heightIn(max = 480.dp)
                .clip(RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp))
                .background(MovvizSurfaceStrong)
                .clickable(enabled = false) {}
                .padding(bottom = 20.dp)
        ) {
            Box(Modifier.width(40.dp).height(4.dp).clip(RoundedCornerShape(2.dp)).background(Color.White.copy(0.15f)).align(Alignment.CenterHorizontally).padding(top = 12.dp))
            Text("Genres", color = MovvizInk, fontSize = 17.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(20.dp))
            LazyColumn {
                item {
                    GenreRow("Tous", selectedId == null) { onSelect(null) }
                }
                items(genres, key = { it.id }) { g ->
                    GenreRow(g.name, selectedId == g.id) { onSelect(g.id) }
                }
            }
        }
    }
}

@Composable
private fun GenreRow(name: String, selected: Boolean, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 20.dp, vertical = 13.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(name, color = if (selected) MovvizInk else MovvizInkSoft, fontSize = 14.sp, fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium)
        if (selected) Icon(Icons.Rounded.Check, null, tint = MovvizBrandGlow, modifier = Modifier.size(18.dp))
    }
}

@Composable
private fun DiscoverHomeRows(
    rows: List<DiscoverRowDto>, libraryRecommendations: List<DiscoverResultDto>,
    loading: Boolean,
    moviesState: List<LibraryMovieDto>,
    seriesState: List<LibrarySeriesDto>,
    vm: MobileViewModel,
    onTitleClick: (String, Int) -> Unit,
    onSeeAll: (String, DiscoverRowMetaDto?) -> Unit,
    bottomPadding: androidx.compose.ui.unit.Dp,
) {
    LazyColumn(Modifier.fillMaxSize(), state = rememberLazyListState(), contentPadding = PaddingValues(bottom = bottomPadding)) {
        if (loading && rows.isEmpty()) {
            items(3) { RowSkeleton() }
        } else if (rows.isEmpty()) {
            item {
                Box(Modifier.fillMaxWidth().padding(top = 48.dp), contentAlignment = Alignment.Center) {
                    Text("Aucun contenu à afficher pour l'instant.", color = MovvizInkDim, fontSize = 13.sp)
                }
            }
        } else {
            if (libraryRecommendations.isNotEmpty()) {
                item(key = "library-recommendations") {
                    PosterRowSection(
                        row = DiscoverRowDto(key = "library-recommendations", results = libraryRecommendations),
                        title = "Suggestions pour vous",
                        moviesState = moviesState, seriesState = seriesState, vm = vm,
                        onTitleClick = onTitleClick, onSeeAll = {}, showSeeAll = false,
                    )
                }
            }
            items(rows, key = { it.key }) { row ->
                if (row.results.isEmpty()) return@items
                if (row.ranked) {
                    RankedRowSection(row, rowLabel(row.key, row.meta), moviesState, seriesState, vm, onTitleClick) { onSeeAll(row.key, row.meta) }
                } else {
                    PosterRowSection(
                        row, rowLabel(row.key, row.meta), moviesState, seriesState, vm,
                        onTitleClick = onTitleClick,
                        onSeeAll = { onSeeAll(row.key, row.meta) },
                    )
                }
            }
        }
    }
}

@Composable
private fun RowSkeleton() {
    Column(Modifier.padding(top = 14.dp)) {
        Box(Modifier.padding(horizontal = 20.dp).width(160.dp).height(18.dp).clip(RoundedCornerShape(6.dp)).background(Color.White.copy(0.06f)))
        Spacer(Modifier.height(10.dp))
        Row(Modifier.padding(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            repeat(3) { Box(Modifier.width(200.dp).height(112.dp).clip(CardShape).background(Color.White.copy(0.06f))) }
        }
    }
}

@Composable
private fun RowHeader(title: String, onSeeAll: () -> Unit) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        Text(title, color = MovvizInk, fontSize = 15.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.2).sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
        Row(Modifier.clickable(onClick = onSeeAll).padding(start = 8.dp, top = 4.dp, bottom = 4.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
            Text("Tout voir", color = MovvizBrandGlow, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            Icon(Icons.Rounded.ChevronRight, null, tint = MovvizBrandGlow, modifier = Modifier.size(14.dp))
        }
    }
}

@Composable
private fun PosterRowSection(
    row: DiscoverRowDto, title: String, moviesState: List<LibraryMovieDto>, seriesState: List<LibrarySeriesDto>,
    vm: MobileViewModel, onTitleClick: (String, Int) -> Unit, onSeeAll: () -> Unit, showSeeAll: Boolean = true,
) {
    Column(Modifier.padding(top = 16.dp)) {
        if (showSeeAll) RowHeader(title, onSeeAll)
        else Text(title, color = MovvizInk, fontSize = 15.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.2).sp, modifier = Modifier.padding(horizontal = 20.dp))
        Spacer(Modifier.height(10.dp))
        LazyRow(contentPadding = PaddingValues(start = 20.dp, end = 12.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            items(row.results, key = { "${it.type}:${it.tmdbId}" }) { r ->
                DiscoverPosterCard(
                    result = r, libState = cardLibState(r, moviesState, seriesState), vm = vm,
                    modifier = Modifier.width(200.dp),
                    onClick = { onTitleClick(r.type, r.tmdbId) },
                )
            }
        }
    }
}

@Composable
private fun RankedRowSection(
    row: DiscoverRowDto, title: String, moviesState: List<LibraryMovieDto>, seriesState: List<LibrarySeriesDto>,
    vm: MobileViewModel, onTitleClick: (String, Int) -> Unit, onSeeAll: () -> Unit,
) {
    Column(Modifier.padding(top = 16.dp)) {
        RowHeader(title, onSeeAll)
        Spacer(Modifier.height(10.dp))
        Column(Modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            row.results.take(10).forEachIndexed { i, r ->
                RankedRowItem(rank = i + 1, result = r, libState = cardLibState(r, moviesState, seriesState), vm = vm, onClick = { onTitleClick(r.type, r.tmdbId) })
            }
        }
    }
}

@Composable
private fun RankedRowItem(rank: Int, result: DiscoverResultDto, libState: CardLibState, vm: MobileViewModel, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(MovvizSurface).clickable(onClick = onClick).padding(8.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text("$rank", color = MovvizInkDim, fontSize = 16.sp, fontWeight = FontWeight.Black, modifier = Modifier.width(22.dp))
        Box(Modifier.size(width = 42.dp, height = 60.dp).clip(RoundedCornerShape(8.dp)).background(MovvizSurfaceStrong)) {
            if (result.posterPath != null) AsyncImage(POSTER_SM + result.posterPath, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
        }
        Column(Modifier.weight(1f)) {
            Text(result.title, color = MovvizInk, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (result.rating > 0) Text("★ ${"%.1f".format(result.rating)}", color = MovvizAmber, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
        }
        StatusButton(libState = libState, size = 30.dp, result = result, vm = vm)
    }
}

@Composable
private fun DiscoverBrowseGrid(
    results: List<DiscoverResultDto>, loading: Boolean, loadingMore: Boolean, hasMore: Boolean,
    moviesState: List<LibraryMovieDto>, seriesState: List<LibrarySeriesDto>,
    vm: MobileViewModel, onTitleClick: (String, Int) -> Unit, onLoadMore: () -> Unit,
    bottomPadding: androidx.compose.ui.unit.Dp,
) {
    val gridState = rememberLazyGridState()
    LaunchedEffect(gridState, results.size, hasMore) {
        snapshotFlow { gridState.layoutInfo.visibleItemsInfo.lastOrNull()?.index }
            .collect { lastVisible ->
                if (lastVisible != null && hasMore && lastVisible >= results.size - 4) onLoadMore()
            }
    }

    when {
        loading && results.isEmpty() -> {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = MovvizBrand, modifier = Modifier.size(30.dp)) }
        }
        results.isEmpty() -> {
            Box(Modifier.fillMaxSize().padding(top = 48.dp), contentAlignment = Alignment.TopCenter) {
                Text("Aucun résultat", color = MovvizInkDim, fontSize = 13.sp)
            }
        }
        else -> {
            LazyVerticalGrid(
                columns = GridCells.Fixed(2), state = gridState,
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = bottomPadding),
                horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                items(results, key = { "${it.type}:${it.tmdbId}" }) { r ->
                    DiscoverPosterCard(
                        result = r, libState = cardLibState(r, moviesState, seriesState), vm = vm,
                        modifier = Modifier.fillMaxWidth(),
                        onClick = { onTitleClick(r.type, r.tmdbId) },
                    )
                }
                if (loadingMore) {
                    item(span = { androidx.compose.foundation.lazy.grid.GridItemSpan(2) }) {
                        Box(Modifier.fillMaxWidth().padding(vertical = 16.dp), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator(color = MovvizBrand, modifier = Modifier.size(22.dp), strokeWidth = 2.dp)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun DiscoverPosterCard(result: DiscoverResultDto, libState: CardLibState, vm: MobileViewModel, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val haptic = LocalHapticFeedback.current
    var pressed by remember { mutableStateOf(false) }
    val scale by animateFloatAsState(if (pressed) 0.96f else 1f, spring(dampingRatio = 0.6f, stiffness = 500f), label = "discoverCard")
    Column(
        modifier.scale(scale).clickable {
            haptic.performHapticFeedback(HapticFeedbackType.LongPress); pressed = true; onClick()
            kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Main).launch { kotlinx.coroutines.delay(140); pressed = false }
        }
    ) {
        Box(Modifier.fillMaxWidth().aspectRatio(16f / 9f).clip(CardShape).background(MovvizSurfaceStrong)) {
            val art = result.backdropPath ?: result.posterPath
            if (art != null) {
                AsyncImage(BACKDROP_SM + art, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
            } else {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text("○", color = MovvizInkDim, fontSize = 20.sp) }
            }
            Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to Color.Transparent, 0.4f to Color.Transparent, 1f to Color(0xE6050508))))
            if (result.rating > 0) {
                Row(
                    Modifier.align(Alignment.TopStart).padding(6.dp).clip(RoundedCornerShape(6.dp)).background(Color.Black.copy(0.5f)).padding(horizontal = 5.dp, vertical = 2.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    Text("★", color = MovvizAmber, fontSize = 10.sp)
                    Text("%.1f".format(result.rating), color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                }
            }
            Text(
                result.title, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis,
                modifier = Modifier.align(Alignment.BottomStart).padding(start = 8.dp, end = 40.dp, bottom = 8.dp),
            )
            Box(Modifier.align(Alignment.BottomEnd).padding(6.dp)) { StatusButton(libState, 32.dp, result, vm) }
        }
        Spacer(Modifier.height(4.dp))
        Text(result.year?.toString() ?: "—", color = MovvizInkDim, fontSize = 11.sp, modifier = Modifier.padding(start = 2.dp))
    }
}

/** The one "dynamic button" every Discover card carries — reflects real
 *  library state live (StateFlow-driven from MobileViewModel.movies/series,
 *  same source DetailScreen already uses) and updates itself the instant
 *  vm.addToLibrary()'s own optimistic/polling logic changes that state —
 *  never a static icon. */
@Composable
private fun StatusButton(libState: CardLibState, size: androidx.compose.ui.unit.Dp, result: DiscoverResultDto, vm: MobileViewModel) {
    val scope = rememberCoroutineScope()
    var addingLocal by remember(result.tmdbId, result.type) { mutableStateOf(false) }
    val haptic = LocalHapticFeedback.current

    // Triple's first slot is a Brush in every branch (SolidColor wraps a
    // flat color as one) so a single background(bg) call below covers both
    // the not-in-library brand-gradient and the flat per-status colors —
    // mixing a Color? and a Brush in one expression doesn't type-check.
    val (bg, icon, spin) = when (libState) {
        CardLibState.NotInLibrary -> Triple(Brush.linearGradient(listOf(MovvizBrand, MovvizBrand2)), Icons.Rounded.Add, false)
        is CardLibState.Movie -> when (libState.status) {
            "available" -> Triple(SolidColor(MovvizCyan.copy(alpha = 0.9f)), Icons.Rounded.Check, false)
            "downloading", "searching" -> Triple(SolidColor(MovvizBrandGlow.copy(alpha = 0.9f)), Icons.Rounded.Refresh, true)
            "missing" -> Triple(SolidColor(MovvizDown.copy(alpha = 0.9f)), Icons.Rounded.Schedule, false)
            "upcoming" -> Triple(SolidColor(MovvizAmber.copy(alpha = 0.9f)), Icons.Rounded.EventAvailable, false)
            else -> Triple(SolidColor(MovvizInkDim.copy(alpha = 0.9f)), Icons.Rounded.Check, false)
        }
        CardLibState.SeriesInLibrary -> Triple(SolidColor(MovvizCyan.copy(alpha = 0.9f)), Icons.Rounded.Check, false)
    }
    val clickable = libState is CardLibState.NotInLibrary && !addingLocal

    Box(
        Modifier.size(size).clip(CircleShape)
            .background(bg)
            .clickable(enabled = clickable) {
                haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                addingLocal = true
                scope.launch { vm.addToLibrary(result.type, result.tmdbId); addingLocal = false }
            },
        contentAlignment = Alignment.Center,
    ) {
        if (addingLocal || spin) {
            CircularProgressIndicator(color = Color.White, modifier = Modifier.size(size * 0.5f), strokeWidth = 2.dp)
        } else {
            Icon(icon, null, tint = Color.White, modifier = Modifier.size(size * 0.55f))
        }
    }
}
