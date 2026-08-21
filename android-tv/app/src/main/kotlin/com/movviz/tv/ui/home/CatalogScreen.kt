package com.movviz.tv.ui.home

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.tv.foundation.lazy.list.TvLazyColumn
import androidx.tv.foundation.lazy.list.items
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.sp
import com.movviz.tv.AppViewModel

/** Catalogue Films/SÃ©ries TV : mÃªme carte et mÃªme statut que l'accueil,
 * mais avec une destination dÃ©diÃ©e utilisable au D-pad. */
@Composable
fun CatalogScreen(
    viewModel: AppViewModel,
    type: HomeTab,
    onOpenTitle: (String, Int) -> Unit,
    // Cible D-pad Â« flÃ¨che bas depuis la NavRail Â» â€” mÃªme rÃ´le que dans
    // HomeScreen : attachÃ©e au CTA du hero s'il y en a un, sinon Ã  la
    // premiÃ¨re carte de la premiÃ¨re rangÃ©e (voir plus bas), jamais
    // demandÃ©e automatiquement ici.
    entryFocusRequester: FocusRequester? = null,
) {
    val movies by viewModel.movies.collectAsState()
    val series by viewModel.series.collectAsState()
    val movieRows by viewModel.movieRows.collectAsState()
    val seriesRows by viewModel.seriesRows.collectAsState()
    val dashboardHero by viewModel.dashboardHero.collectAsState()
    val heroLogos by viewModel.heroLogos.collectAsState()
    val editorialRows = if (type == HomeTab.MOVIES) movieRows else seriesRows
    LaunchedEffect(Unit) {
        viewModel.loadLibrary()
        viewModel.loadDiscovery()
        viewModel.loadDashboardHero()
    }
    // Cartes et rangÃ©es dÃ©rivÃ©es UNE fois par changement de donnÃ©es (remember),
    // pas Ã  chaque recomposition : la rotation du hero (8s), le focus D-pad ou
    // un refresh de bibliothÃ¨que ne doivent pas recrÃ©er des centaines de
    // TvTitleCard ni invalider les clÃ©s de la TvLazyColumn â€” sinon toutes les
    // rangÃ©es recomposent au moindre changement (mÃªme pattern que HomeScreen,
    // qui remember ses listes dÃ©rivÃ©es). Avant ce correctif, heroItems (et donc
    // la boucle de rotation) Ã©tait aussi invalidÃ© Ã  chaque recomposition : le
    // carousel revenait Ã  l'index 0 dÃ¨s qu'un Ã©tat bougeait.
    val cards = remember(movies, series, type) {
        if (type == HomeTab.MOVIES) {
            movies.map { TvTitleCard(it.id, it.title, it.posterPath, it.backdropPath, it.tmdbId, true, it.year, it.rating, it.genres, it.status, qualityLabel = resolutionLabelForCatalog(it.file?.resolution), hasHdr = !it.file?.hdr.isNullOrBlank()) }
        } else {
            series.map { TvTitleCard(it.id, it.title, it.posterPath, it.backdropPath, it.tmdbId, false, it.year, it.rating, it.genres) }
        }
    }
    val editorial = remember(editorialRows) {
        editorialRows.mapNotNull { row ->
            val rowCards = row.results.map {
                TvTitleCard("${row.key}-${it.type}-${it.tmdbId}", it.title, it.posterPath, null, it.tmdbId,
                    isMovie = it.type == "movie", year = it.year, rating = it.rating)
            }
            if (rowCards.isEmpty()) null else row.key to rowCards
        }
    }
    val rows = remember(editorial, cards) {
        buildList {
            addAll(editorial)
            if (cards.isNotEmpty()) add("library" to cards)
        }
    }
    val wantedType = if (type == HomeTab.MOVIES) "movie" else "series"
    val heroItems = remember(dashboardHero, cards) {
        dashboardHero.filter { it.detail.type == wantedType }.map { slide ->
            val d = slide.detail
            TvTitleCard(
                id = "catalog-hero-${d.type}-${d.tmdbId}", title = d.title,
                posterPath = d.posterPath, backdropPath = d.backdropPath,
                tmdbId = d.tmdbId, isMovie = wantedType == "movie", year = d.year,
                rating = d.rating, genres = d.genres, status = slide.libraryStatus,
                overview = d.overview, runtime = d.runtime, trailerKeys = d.trailerKeys,
            )
        }.filter { it.backdropPath != null }.take(5).ifEmpty {
            cards.filter { it.isMovie == (wantedType == "movie") && it.backdropPath != null }.take(5)
        }
    }
    var heroIndex by remember { mutableStateOf(0) }
    val activeHero = heroItems.getOrNull(heroIndex.coerceIn(0, (heroItems.size - 1).coerceAtLeast(0)))
    // Même cible pour le CTA hero et la première carte de la première
    // rangée (mutuellement exclusifs — voir plus bas) : c'est elle que la
    // NavRail vise pour la flèche bas.
    val heroFocus = entryFocusRequester ?: remember { FocusRequester() }
    // Précharge les logos de TOUTES les vedettes du hero — même fix que
    // HomeScreen pour éviter le race condition logo vs timer 3 s fallback.
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

    // Même structure que l'accueil : le hero démarre tout en haut, sans
    // bandeau de titre — le tab actif est déjà indiqué par la NavRail.
    Column(Modifier.fillMaxSize()) {
        if (rows.isEmpty()) Text("Aucun titre pour le moment", color = MaterialTheme.colorScheme.onBackground, modifier = Modifier.padding(start = 64.dp, top = 24.dp))
        else TvLazyColumn(Modifier.fillMaxSize()) {
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
            // ClÃ© stable par rangÃ©e + contentType : sans key, TvLazyColumn
            // re-compose les items au scroll D-pad. La clÃ© est prÃ©fixÃ©e par
            // l'onglet pour ne jamais entrer en collision avec la rangÃ©e
            // "library" ni entre les deux onglets (une clÃ© dupliquÃ©e lÃ¨ve
            // une exception en composition).
            val firstRowKey = "${type.name}-${rows.first().first}"
            items(rows, key = { "${type.name}-${it.first}" }, contentType = { "catalog-row" }) { (key, rowCards) ->
                TitleRow(
                    heading = if (key == "library") type.label else catalogRowLabel(key),
                    items = rowCards,
                    onClick = { onOpenTitle(if (it.isMovie) "movie" else "series", it.tmdbId) },
                    // Sans hero, rien n'Ã©tait cÃ¢blÃ© jusqu'ici pour la
                    // premiÃ¨re carte â€” la flÃ¨che bas depuis la NavRail
                    // n'avait donc littÃ©ralement aucune cible stable sur cet
                    // Ã©cran.
                    firstItemFocusRequester = if (activeHero == null && key == firstRowKey) heroFocus else null,
                )
            }
        }
    }
}

private fun catalogRowLabel(key: String): String = when (key) {
    "recommendedTop" -> "SÃ©lection pour vous"
    "trendingPopular", "trending" -> "Tendances"
    "upcoming", "upcomingVod" -> "Prochainement"
    "onAir" -> "En ce moment"
    "newSeriesRenewed" -> "Nouvelles sÃ©ries et renouvellements"
    "nowPlayingBoxOffice" -> "En salles"
    "kids" -> "Jeunesse"
    else -> key.replace(Regex("([a-z])([A-Z])"), "$1 $2").replaceFirstChar { it.uppercase() }
}

private fun resolutionLabelForCatalog(resolution: String?): String? = when {
    resolution == null -> null
    resolution.startsWith("2160") -> "4K"
    resolution.startsWith("1080") -> "1080p"
    resolution.startsWith("720") -> "720p"
    else -> resolution
}
