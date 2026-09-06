package com.movviz.tv.ui.discover

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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
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
import androidx.tv.material3.Border
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import com.movviz.tv.AppViewModel
import com.movviz.tv.data.GenreDto
import com.movviz.tv.data.RowMetaDto
import com.movviz.tv.ui.home.HeroCarousel
import com.movviz.tv.ui.home.HomeTab
import com.movviz.tv.ui.home.TitleRow
import com.movviz.tv.ui.home.TvTitleCard
import com.movviz.tv.ui.theme.MovvizInk
import com.movviz.tv.ui.theme.MovvizInkSoft
import com.movviz.tv.ui.theme.tvFocusLift
import com.movviz.tv.ui.theme.tvPointerClick

/**
 * Découverte TV : hero + rangées éditoriales + sélecteur de genres, le même
 * contenu que l'ancien écran Films/Séries avant qu'il ne devienne le
 * catalogue complet triable (voir CatalogScreen.kt) — Découverte en reprend
 * l'intégralité, avec un bouton Films/Séries en haut pour séparer les deux
 * univers plutôt que de les mélanger dans les mêmes rangées.
 */
@Composable
fun DiscoverScreen(
    viewModel: AppViewModel,
    onOpenTitle: (type: String, tmdbId: Int) -> Unit,
    onSeeAllRow: (mediaType: String, key: String, label: String) -> Unit = { _, _, _ -> },
    onOpenGenre: (mediaType: String, genreId: String, label: String) -> Unit = { _, _, _ -> },
    entryFocusRequester: FocusRequester? = null,
) {
    var selectedType by remember { mutableStateOf(HomeTab.MOVIES) }

    val movies by viewModel.movies.collectAsState()
    val series by viewModel.series.collectAsState()
    val movieRows by viewModel.movieRows.collectAsState()
    val seriesRows by viewModel.seriesRows.collectAsState()
    val movieLibraryRecommendations by viewModel.movieLibraryRecommendations.collectAsState()
    val seriesLibraryRecommendations by viewModel.seriesLibraryRecommendations.collectAsState()
    val dashboardHero by viewModel.dashboardHero.collectAsState()
    val heroLogos by viewModel.heroLogos.collectAsState()
    val movieGenres by viewModel.movieGenres.collectAsState()
    val seriesGenres by viewModel.seriesGenres.collectAsState()
    val editorialRows = if (selectedType == HomeTab.MOVIES) movieRows else seriesRows
    LaunchedEffect(Unit) {
        viewModel.loadLibrary()
        viewModel.loadDiscovery()
        viewModel.loadDashboardHero()
    }
    val wantedType = if (selectedType == HomeTab.MOVIES) "movie" else "series"
    LaunchedEffect(wantedType) {
        viewModel.loadGenres(wantedType)
    }
    val genres = if (selectedType == HomeTab.MOVIES) movieGenres else seriesGenres

    val cards = remember(movies, series, selectedType) {
        if (selectedType == HomeTab.MOVIES) {
            movies.map { TvTitleCard(it.id, it.title, it.posterPath, it.backdropPath, it.tmdbId, true, it.year, it.rating, it.genres, it.status, qualityLabel = resolutionLabelForDiscover(it.file?.resolution), hasHdr = !it.file?.hdr.isNullOrBlank()) }
        } else {
            series.map { TvTitleCard(it.id, it.title, it.posterPath, it.backdropPath, it.tmdbId, false, it.year, it.rating, it.genres) }
        }
    }
    val recommendationIds = if (selectedType == HomeTab.MOVIES) movieLibraryRecommendations else seriesLibraryRecommendations
    val availableCards = remember(cards, selectedType) {
        if (selectedType == HomeTab.MOVIES) cards.filter { it.status == "available" } else cards
    }
    val localRecommendations = remember(availableCards, recommendationIds) {
        val byTmdbId = availableCards.associateBy { it.tmdbId }
        recommendationIds.mapNotNull { byTmdbId[it.tmdbId] }.distinctBy { it.tmdbId }.take(20)
    }
    val bestInLibrary = remember(availableCards) {
        availableCards.sortedByDescending { it.rating }.take(20)
    }
    val favouriteGenres = remember(availableCards) {
        availableCards.flatMap { it.genres }
            .groupingBy { it }
            .eachCount()
            .filterValues { it >= 4 }
            .toList()
            .sortedByDescending { it.second }
            .take(2)
            .map { it.first }
    }
    val librarySuggestionRows = remember(localRecommendations, bestInLibrary, favouriteGenres, availableCards) {
        buildList {
            if (localRecommendations.isNotEmpty()) add(DiscoverRow("for-you", null, localRecommendations, seeAll = false))
            if (bestInLibrary.isNotEmpty()) add(DiscoverRow("best-in-library", null, bestInLibrary, seeAll = false))
            favouriteGenres.forEach { genre ->
                val matching = availableCards.filter { genre in it.genres }.sortedByDescending { it.rating }.take(20)
                if (matching.isNotEmpty()) add(DiscoverRow("library-genre-$genre", null, matching, seeAll = false))
            }
        }
    }
    val editorial = remember(editorialRows, wantedType) {
        editorialRows.filterNot { it.key == "kids" }.mapNotNull { row ->
            val rowCards = row.results.filter { it.type == wantedType }.map {
                TvTitleCard("${row.key}-${it.type}-${it.tmdbId}", it.title, it.posterPath, it.backdropPath, it.tmdbId,
                    isMovie = it.type == "movie", year = it.year, rating = it.rating)
            }
            if (rowCards.isEmpty()) null else DiscoverRow(row.key, row.meta, rowCards, seeAll = true)
        }
    }
    val rows = remember(editorial, librarySuggestionRows, cards) {
        buildList {
            addAll(librarySuggestionRows)
            addAll(editorial)
            if (cards.isNotEmpty()) add(DiscoverRow("library", null, cards, seeAll = false))
        }
    }
    val heroItems = remember(dashboardHero, cards) {
        dashboardHero.filter { it.detail.type == wantedType }.map { slide ->
            val d = slide.detail
            TvTitleCard(
                id = "discover-hero-${d.type}-${d.tmdbId}", title = d.title,
                posterPath = d.posterPath, backdropPath = d.backdropPath,
                tmdbId = d.tmdbId, isMovie = wantedType == "movie", year = d.year,
                rating = d.rating, genres = d.genres, status = slide.libraryStatus,
                overview = d.overview, runtime = d.runtime, trailerKeys = d.ambientVideoKeys,
            )
        }.filter { it.backdropPath != null }.take(5).ifEmpty {
            cards.filter { it.isMovie == (wantedType == "movie") && it.backdropPath != null }.take(5)
        }
    }
    var heroIndex by remember { mutableStateOf(0) }
    val activeHero = heroItems.getOrNull(heroIndex.coerceIn(0, (heroItems.size - 1).coerceAtLeast(0)))
    val heroFocus = entryFocusRequester ?: remember { FocusRequester() }
    val emptyStateFocus = heroFocus
    val heroTopAnchor = remember { FocusRequester() }
    LaunchedEffect(heroItems) {
        if (heroItems.isNotEmpty()) {
            viewModel.loadHeroLogos(wantedType, heroItems.map { it.tmdbId })
        }
    }
    LaunchedEffect(heroItems) {
        heroIndex = 0
        if (heroItems.size > 1) while (true) {
            kotlinx.coroutines.delay(8_000L)
            heroIndex = (heroIndex + 1) % heroItems.size
        }
    }

    Column(Modifier.fillMaxSize()) {
        if (rows.isEmpty()) Text(
            "Aucun titre pour le moment",
            color = MaterialTheme.colorScheme.onBackground,
            modifier = Modifier
                .padding(start = 64.dp, top = 96.dp)
                .focusRequester(emptyStateFocus)
                .focusable(),
        )
        else LazyColumn(Modifier.fillMaxSize()) {
            item(contentType = "topAnchor") {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(1.dp)
                        .focusRequester(heroTopAnchor)
                        .focusable(),
                )
            }
            // Toggle Films/Séries : sépare la découverte des deux univers,
            // demandé en direct plutôt que de les mélanger dans les mêmes
            // rangées (contrairement à l'écran Accueil qui, lui, mélange).
            item(contentType = "type-toggle") {
                TypeToggleRow(selected = selectedType, onSelect = { selectedType = it })
            }
            if (activeHero != null) item {
                HeroCarousel(
                    items = heroItems,
                    currentIndex = heroIndex,
                    logoPath = heroLogos["$wantedType-${activeHero.tmdbId}"],
                    onSelectIndex = { heroIndex = it },
                    ctaFocusRequester = heroFocus,
                    onOpen = { card -> onOpenTitle(wantedType, card.tmdbId) },
                )
            }
            if (genres.isNotEmpty()) {
                item(contentType = "genre-picker") {
                    DiscoverGenrePickerRow(
                        genres = genres,
                        onSelect = { genreId, label -> onOpenGenre(wantedType, genreId, label) },
                    )
                }
            }
            val firstRowKey = rows.first().key
            items(rows, key = { "${selectedType.name}-${it.key}" }, contentType = { "discover-row" }) { row ->
                val label = if (row.key == "library") selectedType.label else discoverRowLabel(row.key, row.meta)
                TitleRow(
                    heading = label,
                    items = row.cards,
                    onClick = { onOpenTitle(if (it.isMovie) "movie" else "series", it.tmdbId) },
                    firstItemFocusRequester = if (activeHero == null && row.key == firstRowKey) heroFocus else null,
                    onSeeAll = if (row.seeAll) { { onSeeAllRow(wantedType, row.key, label) } } else null,
                    titleLogoPaths = heroLogos,
                    onFocusedCard = { viewModel.requestHeroLogo(if (it.isMovie) "movie" else "series", it.tmdbId) },
                )
            }
        }
    }
}

/** Une rangée Découverte — éditoriale (server-driven, "Voir tout" valide) ou
 *  "library" (aperçu local complet, pas de pagination serveur). */
private data class DiscoverRow(
    val key: String,
    val meta: RowMetaDto?,
    val cards: List<TvTitleCard>,
    val seeAll: Boolean,
)

private fun discoverRowLabel(key: String, meta: RowMetaDto?): String {
    if (key.startsWith("becauseYouWatched:") && meta != null) {
        return if (meta.verb == "liked") "Puisque ${meta.anchorTitle} vous a plu" else "Dans la lignée de ${meta.anchorTitle}"
    }
    return when (key) {
        "for-you" -> "Suggestions pour vous"
        "best-in-library" -> "Les mieux notés de votre bibliothèque"
        "recommendedTop" -> "Sélection pour vous"
        "trendingPopular", "trending" -> "Tendances"
        "upcoming", "upcomingVod" -> "Prochainement"
        "onAir" -> "En ce moment"
        "newSeriesRenewed" -> "Nouvelles séries et renouvellements"
        "nowPlayingBoxOffice" -> "En salles"
        "acclaimed" -> "Salué par la critique"
        "anime" -> "Univers anime"
        "teen" -> "Romance ado"
        "shortFormat" -> "Format court, grand impact"
        "genreAction" -> "Action"
        "genreComedy" -> "Comédie"
        "genreHorror" -> "Frissons garantis"
        "genreSciFi" -> "Science-fiction"
        else -> if (key.startsWith("library-genre-")) "Encore plus de ${key.removePrefix("library-genre-")}" else key.replace(Regex("([a-z])([A-Z])"), "$1 $2").replaceFirstChar { it.uppercase() }
    }
}

private fun resolutionLabelForDiscover(resolution: String?): String? = when {
    resolution == null -> null
    resolution.startsWith("2160") -> "4K"
    resolution.startsWith("1080") -> "1080p"
    resolution.startsWith("720") -> "720p"
    else -> resolution
}

@Composable
private fun TypeToggleRow(selected: HomeTab, onSelect: (HomeTab) -> Unit) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        modifier = Modifier.padding(start = 52.dp, top = 4.dp, bottom = 20.dp),
    ) {
        ToggleChip(label = "Films", active = selected == HomeTab.MOVIES, onClick = { onSelect(HomeTab.MOVIES) })
        ToggleChip(label = "Séries", active = selected == HomeTab.SERIES, onClick = { onSelect(HomeTab.SERIES) })
    }
}

@Composable
private fun ToggleChip(label: String, active: Boolean, onClick: () -> Unit) {
    var focused by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(50)
    Surface(
        onClick = onClick,
        modifier = Modifier
            .onFocusChanged { focused = it.isFocused }
            .tvPointerClick(onClick),
        shape = ClickableSurfaceDefaults.shape(shape = shape),
        colors = ClickableSurfaceDefaults.colors(
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
            style = TextStyle(fontSize = 14.sp, fontWeight = if (active) FontWeight.Bold else FontWeight.SemiBold),
            modifier = Modifier.padding(horizontal = 20.dp, vertical = 10.dp),
        )
    }
}

private val SYNTHETIC_GENRES = listOf("anime" to "Anime", "teen" to "Romance ado")

@Composable
private fun DiscoverGenrePickerRow(genres: List<GenreDto>, onSelect: (genreId: String, label: String) -> Unit) {
    Column(modifier = Modifier.padding(bottom = 32.dp)) {
        Text(
            text = "Genres",
            style = MaterialTheme.typography.titleLarge,
            color = MaterialTheme.colorScheme.onBackground,
            modifier = Modifier.padding(start = 52.dp, bottom = 12.dp),
        )
        LazyRow(
            contentPadding = PaddingValues(start = 52.dp, end = 52.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            items(SYNTHETIC_GENRES, key = { "synth-${it.first}" }) { (id, label) ->
                DiscoverGenreChip(label = label, onClick = { onSelect(id, label) })
            }
            items(genres, key = { "tmdb-${it.id}" }) { g ->
                DiscoverGenreChip(label = g.name, onClick = { onSelect(g.id.toString(), g.name) })
            }
        }
    }
}

@Composable
private fun DiscoverGenreChip(label: String, onClick: () -> Unit) {
    var focused by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(50)
    Surface(
        onClick = onClick,
        modifier = Modifier
            .tvFocusLift(focused, shape = shape, maxScale = 1.04f)
            .onFocusChanged { focused = it.isFocused }
            .tvPointerClick(onClick),
        shape = ClickableSurfaceDefaults.shape(shape = shape),
        colors = ClickableSurfaceDefaults.colors(containerColor = MovvizInk.copy(alpha = 0.08f), contentColor = MovvizInk),
        border = ClickableSurfaceDefaults.border(
            focusedBorder = Border(border = androidx.compose.foundation.BorderStroke(2.dp, Color.White.copy(alpha = 0.85f)), shape = shape),
        ),
    ) {
        Text(
            text = label,
            style = TextStyle(fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = if (focused) MovvizInk else MovvizInkSoft),
            modifier = Modifier.padding(horizontal = 18.dp, vertical = 10.dp),
        )
    }
}
