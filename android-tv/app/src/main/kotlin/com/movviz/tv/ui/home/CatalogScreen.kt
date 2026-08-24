package com.movviz.tv.ui.home

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.focusable
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
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Border
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.sp
import com.movviz.tv.AppViewModel
import com.movviz.tv.data.GenreDto
import com.movviz.tv.data.RowMetaDto
import com.movviz.tv.ui.theme.MovvizInk
import com.movviz.tv.ui.theme.MovvizInkSoft
import com.movviz.tv.ui.theme.tvFocusLift
import com.movviz.tv.ui.theme.tvPointerClick

/** Catalogue Films/Séries TV : même carte et même statut que l'accueil,
 * mais avec une destination dédiée utilisable au D-pad. */
@Composable
fun CatalogScreen(
    viewModel: AppViewModel,
    type: HomeTab,
    onOpenTitle: (String, Int) -> Unit,
    // "Voir tout" d'une rangée éditoriale — voir HomeScreen.onSeeAllRow,
    // même contrat (GET /api/metadata/row-page).
    onSeeAllRow: (mediaType: String, key: String, label: String) -> Unit = { _, _, _ -> },
    // Sélection d'un genre (réel TMDb ou synthétique Anime/Romance ado) dans
    // le sélecteur Genres ci-dessous — ouvre la grille filtrée (GET
    // /api/metadata/discover?genre=...), même route que le dropdown Genres
    // du Discover desktop.
    onOpenGenre: (mediaType: String, genreId: String, label: String) -> Unit = { _, _, _ -> },
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
    val movieGenres by viewModel.movieGenres.collectAsState()
    val seriesGenres by viewModel.seriesGenres.collectAsState()
    val editorialRows = if (type == HomeTab.MOVIES) movieRows else seriesRows
    LaunchedEffect(Unit) {
        viewModel.loadLibrary()
        viewModel.loadDiscovery()
        viewModel.loadDashboardHero()
    }
    val wantedType = if (type == HomeTab.MOVIES) "movie" else "series"
    // Genres — un seul appel par onglet, comme le dropdown Genres desktop
    // (useSWR keyed by type). Rechargé si l'onglet change, jamais en boucle
    // (liste stable, contrairement à la file de téléchargement).
    LaunchedEffect(wantedType) {
        viewModel.loadGenres(wantedType)
    }
    val genres = if (type == HomeTab.MOVIES) movieGenres else seriesGenres
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
            // "Voir tout" n'a de sens que sur une vraie clé serveur (row.key) —
            // meta n'est utile que pour la clé dynamique becauseYouWatched:*.
            if (rowCards.isEmpty()) null else CatalogRow(row.key, row.meta, rowCards, seeAll = true)
        }
    }
    val rows = remember(editorial, cards) {
        buildList {
            addAll(editorial)
            // La rangée "library" (catalogue local complet) n'est pas une clé
            // serveur paginable via row-page — pas de "Voir tout" dessus.
            if (cards.isNotEmpty()) add(CatalogRow("library", null, cards, seeAll = false))
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
                overview = d.overview, runtime = d.runtime, trailerKeys = d.ambientVideoKeys,
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
            // Sélecteur Genres — même destination que le dropdown Genres du
            // Discover desktop (TMDb réels + les deux synthétiques Anime/
            // Romance ado, genreTaxonomy.ts), rendu en rangée de chips plutôt
            // qu'un menu déroulant : pas de survol souris sur TV, une rangée
            // horizontale se parcourt nativement au D-pad. N'apparaît qu'une
            // fois les genres réels chargés pour ne jamais afficher une
            // rangée qui ne contiendrait que les deux entrées synthétiques.
            if (genres.isNotEmpty()) {
                item(contentType = "genre-picker") {
                    GenrePickerRow(
                        genres = genres,
                        onSelect = { genreId, label -> onOpenGenre(wantedType, genreId, label) },
                    )
                }
            }
            // Clé stable par rangée + contentType : sans key, TvLazyColumn
            // re-compose les items au scroll D-pad. La clé de LISTE (passée à
            // items()) reste préfixée par l'onglet pour ne jamais entrer en
            // collision avec la rangée "library" ni entre les deux onglets —
            // firstRowKey, lui, compare le row.key BRUT (non préfixé) reçu
            // dans le lambda ci-dessous, comme row.key lui-même.
            val firstRowKey = rows.first().key
            items(rows, key = { "${type.name}-${it.key}" }, contentType = { "catalog-row" }) { row ->
                val label = if (row.key == "library") type.label else catalogRowLabel(row.key, row.meta)
                TitleRow(
                    heading = label,
                    items = row.cards,
                    onClick = { onOpenTitle(if (it.isMovie) "movie" else "series", it.tmdbId) },
                    // Sans hero, rien n'était câblé jusqu'ici pour la
                    // première carte — la flèche bas depuis la NavRail
                    // n'avait donc littéralement aucune cible stable sur cet
                    // écran.
                    firstItemFocusRequester = if (activeHero == null && row.key == firstRowKey) heroFocus else null,
                    onSeeAll = if (row.seeAll) { { onSeeAllRow(wantedType, row.key, label) } } else null,
                )
            }
        }
    }
}

/** Une rangée du catalogue — éditoriale (server-driven, "Voir tout" valide)
 *  ou "library" (catalogue local complet, pas de pagination serveur). */
private data class CatalogRow(
    val key: String,
    val meta: RowMetaDto?,
    val cards: List<TvTitleCard>,
    val seeAll: Boolean,
)

/** `meta` n'est renseigné que pour "becauseYouWatched:{id}" — même logique
 *  que homeRowLabel() dans HomeScreen.kt, libellés propres à cet écran. */
private fun catalogRowLabel(key: String, meta: RowMetaDto?): String {
    if (key.startsWith("becauseYouWatched:") && meta != null) {
        return if (meta.verb == "liked") "Puisque ${meta.anchorTitle} vous a plu" else "Dans la lignée de ${meta.anchorTitle}"
    }
    return when (key) {
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
        else -> key.replace(Regex("([a-z])([A-Z])"), "$1 $2").replaceFirstChar { it.uppercase() }
    }
}

private fun resolutionLabelForCatalog(resolution: String?): String? = when {
    resolution == null -> null
    resolution.startsWith("2160") -> "4K"
    resolution.startsWith("1080") -> "1080p"
    resolution.startsWith("720") -> "720p"
    else -> resolution
}

// Deux genres sans id TMDb numérique (genreTaxonomy.ts, ANIME_GENRE_ID/
// TEEN_GENRE_ID côté serveur) — mêmes libellés courts que discover.genreAnime
// /genreTeen en fr.ts (distincts des libellés de RANGÉE "Univers anime"/
// "Romance ado" ci-dessus : ici c'est une entrée de sélecteur, pas un titre
// de rangée).
private val SYNTHETIC_GENRES = listOf("anime" to "Anime", "teen" to "Romance ado")

/** Rangée de chips Genres — TMDb réels + les deux synthétiques, même contenu
 *  que le dropdown Genres du Discover desktop mais en chips horizontales
 *  (pas de survol souris sur TV). Chaque sélection ouvre la grille filtrée
 *  correspondante (RowDetailScreen en mode genre, GET /api/metadata/discover). */
@Composable
private fun GenrePickerRow(genres: List<GenreDto>, onSelect: (genreId: String, label: String) -> Unit) {
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
                GenreChip(label = label, onClick = { onSelect(id, label) })
            }
            items(genres, key = { "tmdb-${it.id}" }) { g ->
                GenreChip(label = g.name, onClick = { onSelect(g.id.toString(), g.name) })
            }
        }
    }
}

@Composable
private fun GenreChip(label: String, onClick: () -> Unit) {
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
