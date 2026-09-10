package com.movviz.nx.mobile.ui.discover

import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Border
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import com.movviz.nx.mobile.AppViewModel
import com.movviz.nx.mobile.data.GenreDto
import com.movviz.nx.mobile.data.RowMetaDto
import com.movviz.nx.mobile.ui.home.HeroCarousel
import com.movviz.nx.mobile.ui.home.HomeTab
import com.movviz.nx.mobile.ui.home.MediaHubMode
import com.movviz.nx.mobile.ui.home.MediaHubSegmentedPills
import com.movviz.nx.mobile.ui.home.FilterChipRow
import com.movviz.nx.mobile.ui.home.FilterDropdownChip
import com.movviz.nx.mobile.ui.home.MediaHubToggleRow
import com.movviz.nx.mobile.ui.home.TitleRow
import com.movviz.nx.mobile.ui.home.TvTitleCard
import androidx.compose.ui.graphics.Brush
import com.movviz.nx.mobile.ui.theme.MovvizAmber
import com.movviz.nx.mobile.ui.theme.MovvizBrand
import com.movviz.nx.mobile.ui.theme.MovvizBrand2
import com.movviz.nx.mobile.ui.theme.MovvizCyan
import com.movviz.nx.mobile.ui.theme.MovvizDown
import com.movviz.nx.mobile.ui.theme.MovvizFlowMagenta
import com.movviz.nx.mobile.ui.theme.MovvizInk
import com.movviz.nx.mobile.ui.theme.MovvizInkSoft
import com.movviz.nx.mobile.ui.theme.tvFocusLift
import com.movviz.nx.mobile.ui.theme.tvPointerClick

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
    // Null conserve l'ancien sélecteur Films/Séries pour les éventuels
    // appelants internes ; les hubs NX passent leur type et ne mélangent
    // donc jamais les deux catalogues dans leurs suggestions.
    fixedType: HomeTab? = null,
    mode: MediaHubMode = MediaHubMode.SUGGESTIONS,
    onModeChange: (MediaHubMode) -> Unit = {},
    /** Injecté par le shell NX pour ses trois contextes Découverte / Films /
     * Séries. L'écran garde ses rangées et ses vraies données ; seul le
     * sélecteur de contexte appartient au shell. */
    contextHeader: (@Composable () -> Unit)? = null,
    // Même contrat que l'accueil : le parent rend la surcouche NX opaque dès
    // que le contenu défile derrière elle, puis transparente au sommet.
    onScrollChanged: (Boolean) -> Unit = {},
    // Contrôle segmenté Découverte/Films/Séries (esquisse mobile 2026-09) —
    // secondaire à la barre basse, portrait uniquement. Voir MainScreen.
    activeHubTab: HomeTab = fixedType ?: HomeTab.MOVIES,
    onSelectHubTab: (HomeTab) -> Unit = {},
) {
    val compactPortrait = androidx.compose.ui.platform.LocalConfiguration.current.let {
        it.screenWidthDp < 600 && it.screenHeightDp > it.screenWidthDp
    }
    var selectedType by remember(fixedType) { mutableStateOf(fixedType ?: HomeTab.MOVIES) }
    LaunchedEffect(fixedType) { fixedType?.let { selectedType = it } }
    // Le contexte « Découverte » du shell NX doit réellement mélanger les
    // deux univers. Sans cette branche, il héritait simplement de Films.
    val mixedDiscovery = fixedType == null && contextHeader != null

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
    // Une même clé de rangée peut exister côté films et séries. On les fusionne
    // pour éviter des clés LazyColumn dupliquées et obtenir une découverte
    // réellement mixte, pas deux copies de la même rangée.
    val editorialRows = if (mixedDiscovery) {
        (movieRows + seriesRows)
            .groupBy { it.key }
            .map { (key, grouped) ->
                grouped.first().copy(results = grouped.flatMap { it.results }.distinctBy { "${it.type}-${it.tmdbId}" })
            }
    } else if (selectedType == HomeTab.MOVIES) movieRows else seriesRows
    val watchProviderTiles by viewModel.watchProviderTiles.collectAsState()
    val companyTiles by viewModel.companyTiles.collectAsState()
    LaunchedEffect(Unit) {
        viewModel.loadLibrary()
        viewModel.loadDiscovery()
        viewModel.loadDashboardHero()
        viewModel.loadDiscoverLogos()
    }
    val wantedType = if (mixedDiscovery) "mixed" else if (selectedType == HomeTab.MOVIES) "movie" else "series"
    LaunchedEffect(wantedType) {
        if (!mixedDiscovery) viewModel.loadGenres(wantedType)
    }
    val genres = if (mixedDiscovery) emptyList() else if (selectedType == HomeTab.MOVIES) movieGenres else seriesGenres

    val cards = remember(movies, series, selectedType, mixedDiscovery) {
        if (mixedDiscovery) {
            movies.map { TvTitleCard(it.id, it.title, it.posterPath, it.backdropPath, it.tmdbId, true, it.year, it.rating, it.genres, it.status) } +
                series.map { TvTitleCard(it.id, it.title, it.posterPath, it.backdropPath, it.tmdbId, false, it.year, it.rating, it.genres) }
        } else if (selectedType == HomeTab.MOVIES) {
            movies.map { TvTitleCard(it.id, it.title, it.posterPath, it.backdropPath, it.tmdbId, true, it.year, it.rating, it.genres, it.status, qualityLabel = resolutionLabelForDiscover(it.file?.resolution), hasHdr = !it.file?.hdr.isNullOrBlank()) }
        } else {
            series.map { TvTitleCard(it.id, it.title, it.posterPath, it.backdropPath, it.tmdbId, false, it.year, it.rating, it.genres) }
        }
    }
    val recommendationIds = if (mixedDiscovery) movieLibraryRecommendations + seriesLibraryRecommendations else if (selectedType == HomeTab.MOVIES) movieLibraryRecommendations else seriesLibraryRecommendations
    val availableCards = remember(cards, selectedType, mixedDiscovery) {
        if (!mixedDiscovery && selectedType == HomeTab.MOVIES) cards.filter { it.status == "available" } else cards
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
    val editorial = remember(editorialRows, wantedType, mixedDiscovery) {
        editorialRows.filterNot { it.key == "kids" }.mapNotNull { row ->
            val rowCards = row.results.filter { mixedDiscovery || it.type == wantedType }.map {
                TvTitleCard("${row.key}-${it.type}-${it.tmdbId}", it.title, it.posterPath, it.backdropPath, it.tmdbId,
                    isMovie = it.type == "movie", year = it.year, rating = it.rating)
            }
            if (rowCards.isEmpty()) null else DiscoverRow(row.key, row.meta, rowCards, seeAll = !mixedDiscovery)
        }
    }
    // Ordre imposé par l'esquisse mobile section 9 : Tendances/Nouveautés
    // (éditorial serveur) avant Recommandé pour vous/mieux notés (suggestions
    // locales), catalogue complet toujours en dernier.
    val rows = remember(editorial, librarySuggestionRows, cards) {
        buildList {
            addAll(editorial)
            addAll(librarySuggestionRows)
            if (cards.isNotEmpty()) add(DiscoverRow("library", null, cards, seeAll = false))
        }
    }
    // "Reprendre un film"/"Reprendre une série" (esquisse section 9) — filtre
    // client de la même source que l'accueil (continueWatching), pas de
    // nouvel appel réseau.
    val continueWatching by viewModel.continueWatching.collectAsState()
    val resumeCards = remember(continueWatching, wantedType) {
        continueWatching.filter { it.type == wantedType }.map { resume ->
            TvTitleCard(
                id = "discover-resume-${resume.type}-${resume.tmdbId}",
                title = resume.title ?: "—",
                posterPath = resume.posterPath,
                backdropPath = null,
                tmdbId = resume.tmdbId,
                isMovie = resume.type == "movie",
                rating = resume.rating,
                progressPercent = resume.progressPercent,
                isResumeCard = true,
                resumeSeasonNumber = resume.seasonNumber,
                resumeEpisodeNumber = resume.episodeNumber,
            )
        }
    }
    val heroItems = remember(dashboardHero, cards, wantedType, mixedDiscovery) {
        dashboardHero.filter { mixedDiscovery || it.detail.type == wantedType }.map { slide ->
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
    // Quand l'écran est intégré au hub Films/Séries, DOWN depuis la barre
    // doit arriver sur Suggestions/Bibliothèque, pas sauter ce choix et
    // l'abandonner derrière le héros.
    val hubFocus = entryFocusRequester ?: remember { FocusRequester() }
    val heroFocus = remember { FocusRequester() }
    val emptyStateFocus = heroFocus
    val heroTopAnchor = remember { FocusRequester() }
    val listState = rememberLazyListState()
    val hasScrolled by remember {
        derivedStateOf {
            listState.firstVisibleItemIndex > 0 || listState.firstVisibleItemScrollOffset > 12
        }
    }
    LaunchedEffect(hasScrolled) { onScrollChanged(hasScrolled) }
    LaunchedEffect(heroItems, mixedDiscovery) {
        if (heroItems.isNotEmpty() && !mixedDiscovery) viewModel.loadHeroLogos(wantedType, heroItems.map { it.tmdbId })
        if (heroItems.isNotEmpty() && mixedDiscovery) {
            heroItems.filter { it.isMovie }.takeIf { it.isNotEmpty() }?.let { viewModel.loadHeroLogos("movie", it.map { card -> card.tmdbId }) }
            heroItems.filterNot { it.isMovie }.takeIf { it.isNotEmpty() }?.let { viewModel.loadHeroLogos("series", it.map { card -> card.tmdbId }) }
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
        // Même vide, Découvrir conserve ses contextes : l'utilisateur doit
        // pouvoir basculer vers Films ou Séries au lieu d'être bloqué sur un
        // message sans navigation.
        LazyColumn(
            Modifier.fillMaxSize(),
            state = listState,
            // Sans ce padding bas, le dernier rail passait sous la barre
            // basse flottante portrait (signalé en direct : contenu caché
            // derrière le menu du bas) — même valeur que les autres écrans
            // portrait (Accueil/Bibliothèque).
            contentPadding = PaddingValues(bottom = if (compactPortrait) 156.dp else 0.dp),
        ) {
            item(contentType = "topAnchor") {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(1.dp)
                        .focusRequester(heroTopAnchor)
                        .focusable(),
                )
            }
            // L'ancien double filtre "hub-pills"/"Genres·Humeur·Plateformes"
            // (portrait) est retiré ici : redondant avec `contextHeader`
            // (Films|Séries plein-largeur, injecté par DiscoverHubScreen) et
            // absent de l'esquisse mobile section 9, qui ne prévoit qu'un
            // sélecteur de genres en chips (DiscoverGenrePickerRow, plus bas).
            item(contentType = "type-toggle") {
                if (contextHeader != null) {
                    contextHeader()
                } else if (fixedType != null) {
                    MediaHubToggleRow(
                        mode = mode,
                        onModeChange = onModeChange,
                        firstFocusRequester = hubFocus,
                        modifier = Modifier.padding(
                            start = if (compactPortrait) 16.dp else 56.dp,
                            top = if (compactPortrait) 8.dp else 78.dp,
                            bottom = 20.dp,
                        ),
                    )
                } else {
                    // Ancien point d'entrée, maintenu proprement : le
                    // sélecteur commence sous la barre flottante.
                    TypeToggleRow(selected = selectedType, onSelect = { selectedType = it })
                }
            }
            if (rows.isEmpty()) item(contentType = "empty") {
                Text(
                    "Aucun titre pour le moment",
                    color = MaterialTheme.colorScheme.onBackground,
                    modifier = Modifier
                        .padding(start = 16.dp, top = 28.dp)
                        .focusRequester(emptyStateFocus)
                        .focusable(),
                )
            }
            if (activeHero != null) item {
                HeroCarousel(
                    items = heroItems,
                    currentIndex = heroIndex,
                    logoPath = heroLogos["${if (activeHero.isMovie) "movie" else "series"}-${activeHero.tmdbId}"],
                    onSelectIndex = { heroIndex = it },
                    ctaFocusRequester = heroFocus,
                    onOpen = { card -> onOpenTitle(if (card.isMovie) "movie" else "series", card.tmdbId) },
                )
            }
            if (resumeCards.isNotEmpty()) {
                item(contentType = "resume-row") {
                    TitleRow(
                        heading = if (wantedType == "movie") "Reprendre un film" else "Reprendre une série",
                        items = resumeCards,
                        onClick = { card ->
                            val season = card.resumeSeasonNumber
                            val episode = card.resumeEpisodeNumber
                            if (!card.isMovie && season != null && episode != null) onOpenTitle("series", card.tmdbId)
                            else onOpenTitle(if (card.isMovie) "movie" else "series", card.tmdbId)
                        },
                        firstItemFocusRequester = if (activeHero == null) heroFocus else null,
                        titleLogoPaths = heroLogos,
                    )
                }
            }
            if (genres.isNotEmpty()) {
                item(contentType = "genre-picker") {
                    DiscoverGenrePickerRow(
                        genres = genres,
                        onSelect = { genreId, label -> onOpenGenre(wantedType, genreId, label) },
                    )
                }
                // "Par humeur" remonté en haut, juste sous les genres —
                // signalé en direct comme devant être en haut de page, pas
                // tout en bas après le catalogue complet.
                item(contentType = "mood-row") {
                    DiscoverMoodRow(
                        genres = genres,
                        onSelect = { genreId, label -> onOpenGenre(wantedType, genreId, label) },
                    )
                }
            }
            val firstRowKey = rows.firstOrNull()?.key
            items(rows, key = { "${wantedType}-${it.key}" }, contentType = { "discover-row" }) { row ->
                val label = if (row.key == "library") {
                    if (mixedDiscovery) "Dans votre bibliothèque" else selectedType.label
                } else discoverRowLabel(row.key, row.meta)
                TitleRow(
                    heading = label,
                    items = row.cards,
                    onClick = { onOpenTitle(if (it.isMovie) "movie" else "series", it.tmdbId) },
                    firstItemFocusRequester = if (activeHero == null && resumeCards.isEmpty() && row.key == firstRowKey) heroFocus else null,
                    onSeeAll = if (row.seeAll) { { onSeeAllRow(wantedType, row.key, label) } } else null,
                    titleLogoPaths = heroLogos,
                    onFocusedCard = { viewModel.requestHeroLogo(if (it.isMovie) "movie" else "series", it.tmdbId) },
                )
            }
            // Rangées "Plateformes de streaming"/"Studios" : retirées du
            // shell NX Découverte (`contextHeader != null`, esquisse mobile
            // section 9 — le rail Plateformes vit désormais à l'Accueil) mais
            // conservées pour le hub Films/Séries TV/paysage
            // (`contextHeader == null`, MediaHubScreen), inchangé.
            if (contextHeader == null) {
                if (watchProviderTiles.isNotEmpty()) {
                    item(contentType = "logo-row") {
                        DiscoverLogoRow(
                            title = "Plateformes de streaming",
                            tiles = watchProviderTiles,
                            onSelect = { tile -> onSeeAllRow(wantedType, "providerSuggested:${tile.id}", "Suggestion ${tile.name} pour vous") },
                        )
                    }
                }
                if (companyTiles.isNotEmpty()) {
                    item(contentType = "logo-row") {
                        DiscoverLogoRow(title = "Studios", tiles = companyTiles, onSelect = null)
                    }
                }
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
    if (key.startsWith("providerNew:") && meta?.providerName != null) {
        return "Nouveautés ${meta.providerName} pour vous"
    }
    if (key.startsWith("providerSuggested:") && meta?.providerName != null) {
        return "Suggestion ${meta.providerName} pour vous"
    }
    return when (key) {
        "for-you" -> "Recommandé pour vous"
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
        // NxTopNav est une surcouche (volontairement transparente lorsque la
        // page est en haut). Le sélecteur doit donc commencer *sous* ses
        // 62 dp : sinon les capsules Films/Séries se retrouvent derrière le
        // logo et les liens de navigation, comme une seconde barre cassée.
        // Le conserver dans le flux garantit aussi un ordre D-pad naturel :
        // barre principale → choix Films/Séries → héro → genres → rangées.
        modifier = Modifier.padding(start = 56.dp, top = 78.dp, bottom = 20.dp),
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
        // Dégradé de marque plein sur l'onglet actif — même traitement que
        // MediaHubToggleChip, cohérent avec les pilules de la charte mobile.
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
                style = TextStyle(fontSize = 14.sp, fontWeight = if (active) FontWeight.Bold else FontWeight.SemiBold),
                modifier = Modifier.padding(horizontal = 20.dp, vertical = 10.dp),
            )
        }
    }
}

private val SYNTHETIC_GENRES = listOf("anime" to "Anime", "teen" to "Romance ado")

@Composable
private fun DiscoverGenrePickerRow(genres: List<GenreDto>, onSelect: (genreId: String, label: String) -> Unit) {
    // Même marge que le reste du contenu portrait (16.dp) — 52.dp fixe est
    // la marge TV, gardée pour le paysage/TV (voir le même correctif sur
    // CastRow dans TitleDetailScreen.kt).
    val compactPortrait = androidx.compose.ui.platform.LocalConfiguration.current.let {
        it.screenWidthDp < 600 && it.screenHeightDp > it.screenWidthDp
    }
    val edge = if (compactPortrait) 16.dp else 52.dp
    Column(modifier = Modifier.padding(bottom = 32.dp)) {
        Text(
            text = "Genres",
            style = MaterialTheme.typography.titleLarge,
            color = MaterialTheme.colorScheme.onBackground,
            modifier = Modifier.padding(start = edge, bottom = 12.dp),
        )
        LazyRow(
            contentPadding = PaddingValues(start = edge, end = edge),
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

/** Même base que la constante homonyme de HomeScreen.kt/TitleDetailScreen.kt
 *  (w500) — dupliquée ici plutôt qu'exportée car chaque écran TV la déclare
 *  déjà en `private const val` localement (convention existante du module). */
private const val TMDB_LOGO_BASE = "https://image.tmdb.org/t/p/w500"

// internal (pas private) : réutilisé par HomeScreen.kt pour le rail
// "Plateformes" de l'accueil portrait (esquisse mobile section 8).
@Composable
internal fun DiscoverLogoRow(
    title: String,
    tiles: List<com.movviz.nx.mobile.data.LogoTileDto>,
    onSelect: ((com.movviz.nx.mobile.data.LogoTileDto) -> Unit)?,
) {
    val compactPortrait = androidx.compose.ui.platform.LocalConfiguration.current.let {
        it.screenWidthDp < 600 && it.screenHeightDp > it.screenWidthDp
    }
    val edge = if (compactPortrait) 16.dp else 52.dp
    Column(modifier = Modifier.padding(bottom = 32.dp)) {
        Text(
            text = title,
            style = MaterialTheme.typography.titleLarge,
            color = MaterialTheme.colorScheme.onBackground,
            modifier = Modifier.padding(start = edge, bottom = 12.dp),
        )
        LazyRow(
            contentPadding = PaddingValues(start = edge, end = edge),
            horizontalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            items(tiles, key = { "$title-${it.id}" }) { tile ->
                DiscoverLogoTile(tile = tile, onClick = onSelect?.let { { it(tile) } })
            }
        }
    }
}

@Composable
private fun DiscoverLogoTile(tile: com.movviz.nx.mobile.data.LogoTileDto, onClick: (() -> Unit)?) {
    var focused by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(50)
    val handleClick = onClick ?: {}
    Surface(
        onClick = handleClick,
        modifier = Modifier
            .tvFocusLift(focused, shape = shape, maxScale = 1.06f)
            .onFocusChanged { focused = it.isFocused }
            .tvPointerClick(handleClick),
        shape = ClickableSurfaceDefaults.shape(shape = shape),
        colors = ClickableSurfaceDefaults.colors(containerColor = Color.White.copy(alpha = 0.06f), contentColor = Color.White),
        border = ClickableSurfaceDefaults.border(
            focusedBorder = Border(border = androidx.compose.foundation.BorderStroke(2.dp, Color.White.copy(alpha = 0.85f)), shape = shape),
        ),
    ) {
        Box(
            modifier = Modifier
                // Largeur au contenu (min 90dp pour éviter un rond vide
                // pendant le chargement Coil) plutôt qu'une largeur fixe
                // uniforme — l'esquisse mobile montre des puces dont la
                // largeur suit le logo (Netflix plus étroit que Prime Video),
                // pas une rangée de cartes toutes identiques.
                .defaultMinSize(minWidth = 90.dp)
                .height(56.dp)
                .padding(horizontal = 16.dp, vertical = 8.dp),
            contentAlignment = Alignment.Center,
        ) {
            if (tile.logoPath != null) {
                // Fond quasi-blanc derrière le logo — même traitement que la
                // LogoRow desktop ("bg-white/95"). Sans lui, un logo sombre
                // (Disney+, Canal+…) devenait invisible sur le fond noir de
                // la puce : la plupart des logos TMDb sont des icônes carrées
                // avec leur propre couleur de fond, pas des wordmarks
                // transparents qui s'accommoderaient du noir.
                Box(
                    modifier = Modifier
                        .wrapContentWidth()
                        .height(40.dp)
                        .background(Color.White.copy(alpha = 0.95f), RoundedCornerShape(8.dp))
                        .padding(horizontal = 14.dp, vertical = 6.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    // SubcomposeAsyncImage plutôt que rememberAsyncImagePainter
                    // + vérification manuelle de l'état : cette dernière
                    // laissait les tuiles bloquées sur le nom en texte en
                    // permanence (état jamais observé Success — connexion
                    // OkHttp vue "leaked" dans les logs), un souci connu de
                    // cette combinaison quand le composable est recomposé
                    // pendant que l'image charge. SubcomposeAsyncImage gère
                    // loading/success/error nativement, sans dépendre de
                    // l'observation externe d'un State.
                    // Hauteur seule contrainte (28dp) : la largeur suit le
                    // ratio naturel du logo au lieu d'être écrasée dans un
                    // carré 40x40 uniforme.
                    coil.compose.SubcomposeAsyncImage(
                        model = "$TMDB_LOGO_BASE${tile.logoPath}",
                        contentDescription = tile.name,
                        contentScale = androidx.compose.ui.layout.ContentScale.Fit,
                        modifier = Modifier.height(28.dp),
                        loading = { DiscoverLogoTileFallback(tile.name, dark = true) },
                        error = { DiscoverLogoTileFallback(tile.name, dark = true) },
                    )
                }
            } else {
                DiscoverLogoTileFallback(tile.name, dark = false, focused = focused)
            }
        }
    }
}

/** Repli texte immédiat — TMDb lent, indisponible, ou logo absent pour cette
 *  entrée. `dark` = affiché sur le fond blanc du badge logo (texte sombre),
 *  sinon sur le fond noir de la puce (texte clair, éclairci au focus). */
@Composable
private fun DiscoverLogoTileFallback(name: String, dark: Boolean, focused: Boolean = false) {
    Text(
        text = name,
        style = TextStyle(
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            color = if (dark) Color(0xFF1A1A1A) else if (focused) MovvizInk else MovvizInkSoft,
        ),
        maxLines = 2,
    )
}

/** "Selon votre humeur" — port direct de MOOD_TILES (src/app/discover/page.tsx) :
 *  chaque humeur pointe vers un genre TMDb RÉEL, résolu par nom dans la liste
 *  de genres déjà chargée pour le type de média actif (movie/series n'ont pas
 *  toujours les mêmes genres — ex. pas de "Horreur" côté séries — d'où la
 *  résolution par nom avec repli plutôt que des ids figés). Faute de vraie
 *  photo par humeur (charte : jamais d'image inventée/volée), chaque tuile
 *  affiche un dégradé construit à partir d'une couleur DÉJÀ définie dans
 *  Color.kt — pas de nouvelle couleur one-off, pas de nouvelle donnée.
 *  Une humeur sans genre résolu pour le type courant est simplement omise. */
private data class MoodTile(val key: String, val label: String, val names: List<String>, val color: Color)

private val MOOD_TILES = listOf(
    MoodTile("adventure", "Aventure", listOf("Aventure"), MovvizBrand2),
    MoodTile("relax", "Détente", listOf("Familial", "Comédie"), MovvizCyan),
    MoodTile("thrill", "Frissons", listOf("Horreur", "Mystère"), MovvizDown),
    MoodTile("emotion", "Émotion", listOf("Drame", "Romance"), MovvizFlowMagenta),
    MoodTile("laugh", "Rire", listOf("Comédie"), MovvizAmber),
    MoodTile("inspire", "Inspiration", listOf("Documentaire"), MovvizBrand),
)

@Composable
private fun DiscoverMoodRow(genres: List<GenreDto>, onSelect: (genreId: String, label: String) -> Unit) {
    val resolved = remember(genres) {
        MOOD_TILES.mapNotNull { mood ->
            val match = genres.firstOrNull { g -> mood.names.any { it.equals(g.name, ignoreCase = true) } }
            match?.let { Triple(mood, it.id.toString(), it.name) }
        }
    }
    if (resolved.isEmpty()) return
    val compactPortrait = androidx.compose.ui.platform.LocalConfiguration.current.let {
        it.screenWidthDp < 600 && it.screenHeightDp > it.screenWidthDp
    }
    val edge = if (compactPortrait) 16.dp else 52.dp
    Column(modifier = Modifier.padding(bottom = 32.dp)) {
        Text(
            text = "Selon votre humeur",
            style = MaterialTheme.typography.titleLarge,
            color = MaterialTheme.colorScheme.onBackground,
            modifier = Modifier.padding(start = edge, bottom = 12.dp),
        )
        LazyRow(
            contentPadding = PaddingValues(start = edge, end = edge),
            horizontalArrangement = Arrangement.spacedBy(if (compactPortrait) 10.dp else 12.dp),
        ) {
            items(resolved, key = { (mood, _, _) -> "mood-${mood.key}" }) { (mood, genreId, genreLabel) ->
                DiscoverMoodTile(label = mood.label, color = mood.color, onClick = { onSelect(genreId, genreLabel) })
            }
        }
    }
}

/** Pilule plate — fond translucide + fine bordure teintée, PAS un aplat
 *  dégradé plein (esquisse mobile 2026-09 : "Selon votre humeur" est une
 *  rangée de petites pilules discrètes, pas de blocs colorés géants). La
 *  couleur de la tuile reste le seul signal (teinte de bordure/texte au
 *  focus), toujours une des couleurs déjà déclarées dans Color.kt. */
@Composable
private fun DiscoverMoodTile(label: String, color: Color, onClick: () -> Unit) {
    var focused by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(50)
    Surface(
        onClick = onClick,
        // 44.dp minimum — repéré trop petit au doigt en test réel (texte
        // 14sp + 10dp de padding ne totalisait qu'environ 40dp, sous la
        // cible tactile Android recommandée de 48dp).
        modifier = Modifier
            .heightIn(min = 44.dp)
            .tvFocusLift(focused, shape = shape, maxScale = 1.05f)
            .onFocusChanged { focused = it.isFocused }
            .tvPointerClick(onClick),
        shape = ClickableSurfaceDefaults.shape(shape = shape),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = color.copy(alpha = 0.14f),
            focusedContainerColor = color.copy(alpha = 0.26f),
            contentColor = Color.White,
            focusedContentColor = Color.White,
        ),
        border = ClickableSurfaceDefaults.border(
            border = Border(border = androidx.compose.foundation.BorderStroke(1.dp, color.copy(alpha = 0.45f)), shape = shape),
            focusedBorder = Border(border = androidx.compose.foundation.BorderStroke(2.dp, color.copy(alpha = 0.9f)), shape = shape),
        ),
    ) {
        Text(
            text = label,
            style = TextStyle(fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = Color.White),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp),
        )
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
