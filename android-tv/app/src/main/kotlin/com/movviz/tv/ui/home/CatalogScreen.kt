package com.movviz.tv.ui.home

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.focusable
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.sp
import com.movviz.tv.AppViewModel

/** Catalogue Films/Séries TV : même carte et même statut que l'accueil,
 * mais avec une destination dédiée utilisable au D-pad. */
@Composable
fun CatalogScreen(
    viewModel: AppViewModel,
    type: HomeTab,
    onOpenTitle: (String, Int) -> Unit,
    // Cible D-pad « flèche bas depuis la NavRail » — même rôle que dans
    // HomeScreen : attachée au CTA du hero s'il y en a un, sinon à la
    // première carte de la première rangée (voir plus bas), jamais
    // demandée automatiquement ici.
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
    // Cartes et rangées dérivées UNE fois par changement de données (remember),
    // pas à chaque recomposition : la rotation du hero (8s), le focus D-pad ou
    // un refresh de bibliothèque ne doivent pas recréer des centaines de
    // TvTitleCard ni invalider les clés de la TvLazyColumn — sinon toutes les
    // rangées recomposent au moindre changement (même pattern que HomeScreen,
    // qui remember ses listes dérivées). Avant ce correctif, heroItems (et donc
    // la boucle de rotation) était aussi invalidé à chaque recomposition : le
    // carousel revenait à l'index 0 dès qu'un état bougeait.
    val cards = remember(movies, series, type) {
        if (type == HomeTab.MOVIES) {
            movies.map { TvTitleCard(it.id, it.title, it.posterPath, it.backdropPath, it.tmdbId, true, it.year, it.rating, it.genres, it.status, qualityLabel = resolutionLabelForCatalog(it.file?.resolution), hasHdr = !it.file?.hdr.isNullOrBlank()) }
        } else {
            series.map { TvTitleCard(it.id, it.title, it.posterPath, it.backdropPath, it.tmdbId, false, it.year, it.rating, it.genres) }
        }
    }
    val wantedType = if (type == HomeTab.MOVIES) "movie" else "series"
    val editorial = remember(editorialRows, wantedType) {
        // Un onglet Films ne montre que des films et inversement. Les rangées
        // éditoriales sont partagées par l'API desktop, elles peuvent donc
        // ponctuellement contenir un mélange de résultats : le filtrage doit
        // rester côté client TV pour préserver le contrat de chaque onglet.
        // "kids" est explicitement hors produit TV (pas de profil Jeunesse).
        editorialRows.filterNot { it.key == "kids" }.mapNotNull { row ->
            val rowCards = row.results.filter { it.type == wantedType }.map {
                TvTitleCard("${row.key}-${it.type}-${it.tmdbId}", it.title, it.posterPath, it.backdropPath, it.tmdbId,
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
    // Pendant le premier chargement, aucune rangée n'est encore composée.
    // Le message d'attente devient alors la vraie cible visible de la
    // NavRail, plutôt que de tomber dans l'ancre de secours invisible.
    val emptyStateFocus = heroFocus
    // Palier invisible au-dessus du hero — voir le premier item de la
    // LazyColumn plus bas (UP depuis le CTA : scroll retour en haut avant
    // la NavRail).
    val heroTopAnchor = remember { FocusRequester() }
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
        if (rows.isEmpty()) Text(
            "Aucun titre pour le moment",
            color = MaterialTheme.colorScheme.onBackground,
            modifier = Modifier
                .padding(start = 64.dp, top = 96.dp)
                .focusRequester(emptyStateFocus)
                .focusable(),
        )
        else LazyColumn(Modifier.fillMaxSize()) {
            // Palier D-pad invisible TOUT EN HAUT (identique à l'accueil) :
            // UP depuis le CTA y atterrit d'abord, ramène le scroll à
            // l'offset 0 (carrousel entier visible), puis un second UP
            // rejoint la NavRail.
            item(contentType = "topAnchor") {
                androidx.compose.foundation.layout.Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(1.dp)
                        .focusRequester(heroTopAnchor)
                        .focusable(),
                )
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
            // Clé stable par rangée + contentType : sans key, TvLazyColumn
            // re-compose les items au scroll D-pad. La clé est préfixée par
            // l'onglet pour ne jamais entrer en collision avec la rangée
            // "library" ni entre les deux onglets (une clé dupliquée lève
            // une exception en composition).
            val firstRowKey = "${type.name}-${rows.first().first}"
            items(rows, key = { "${type.name}-${it.first}" }, contentType = { "catalog-row" }) { (key, rowCards) ->
                TitleRow(
                    heading = if (key == "library") type.label else catalogRowLabel(key),
                    items = rowCards,
                    onClick = { onOpenTitle(if (it.isMovie) "movie" else "series", it.tmdbId) },
                    // Sans hero, rien n'était câblé jusqu'ici pour la
                    // première carte — la flèche bas depuis la NavRail
                    // n'avait donc littéralement aucune cible stable sur cet
                    // écran.
                    firstItemFocusRequester = if (activeHero == null && key == firstRowKey) heroFocus else null,
                )
            }
        }
    }
}

private fun catalogRowLabel(key: String): String = when (key) {
    "recommendedTop" -> "Sélection pour vous"
    "trendingPopular", "trending" -> "Tendances"
    "upcoming", "upcomingVod" -> "Prochainement"
    "onAir" -> "En ce moment"
    "newSeriesRenewed" -> "Nouvelles séries et renouvellements"
    "nowPlayingBoxOffice" -> "En salles"
    else -> key.replace(Regex("([a-z])([A-Z])"), "$1 $2").replaceFirstChar { it.uppercase() }
}

private fun resolutionLabelForCatalog(resolution: String?): String? = when {
    resolution == null -> null
    resolution.startsWith("2160") -> "4K"
    resolution.startsWith("1080") -> "1080p"
    resolution.startsWith("720") -> "720p"
    else -> resolution
}
