package com.movviz.nx.mobile.ui.home

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Text
import coil.compose.rememberAsyncImagePainter
import com.movviz.nx.mobile.AppViewModel
import com.movviz.nx.mobile.data.CollectionDto
import com.movviz.nx.mobile.data.ProfileMediaCardDto
import com.movviz.nx.mobile.data.SagaSummaryDto
import com.movviz.nx.mobile.ui.mobile.MovvizEmptyState
import com.movviz.nx.mobile.ui.mobile.MovvizSegmentedControl
import com.movviz.nx.mobile.ui.mobile.rememberCompactPortrait
import com.movviz.nx.mobile.ui.theme.MovvizInk
import com.movviz.nx.mobile.ui.theme.MovvizInkDim
import com.movviz.nx.mobile.ui.theme.MovvizSurfaceStrong
import com.movviz.nx.mobile.ui.theme.tvPointerClick

private const val TMDB_POSTER_BASE = "https://image.tmdb.org/t/p/w342"

/**
 * Vrai point d'entrée Mon espace (esquisse mobile section 11) : Watchlist/
 * Historique/Collections — pas un alias du catalogue Films/Séries
 * (CatalogScreen, toujours accessible depuis Découverte). Watchlist et
 * Historique viennent de `profileMedia` (déjà chargé pour l'onglet Profil,
 * mêmes cartes/mêmes données réelles). Collections combine les collections
 * utilisateur et les sagas TMDb possédées — aucune liste fictive : un état
 * vide honnête tant qu'aucune des deux n'a de contenu.
 */
@Composable
fun LibraryHubScreen(
    viewModel: AppViewModel,
    onOpenTitle: (String, Int) -> Unit,
    entryFocusRequester: FocusRequester,
    onScrollChanged: (Boolean) -> Unit,
) {
    var tabIndex by remember { mutableIntStateOf(0) }
    var selectedCollectionId by remember { mutableStateOf<String?>(null) }
    var selectedSagaId by remember { mutableStateOf<Int?>(null) }
    val profileData by viewModel.profileMedia.collectAsState()
    val collections by viewModel.collections.collectAsState()
    val sagas by viewModel.sagas.collectAsState()
    val movies by viewModel.movies.collectAsState()
    val series by viewModel.series.collectAsState()
    LaunchedEffect(Unit) {
        if (viewModel.profileMedia.value == null) viewModel.loadProfileMedia()
        viewModel.loadCollections()
    }
    val compactPortrait = rememberCompactPortrait()
    // Déplié : la barre TV haute n'existe plus et la colonne est étroite —
    // mêmes marges compactes que le portrait (pas de trou 156dp en haut).
    val narrow = compactPortrait || rememberUnfoldedLandscape()
    val listState = rememberLazyGridState()
    val hasScrolled by remember {
        derivedStateOf { listState.firstVisibleItemIndex > 0 || listState.firstVisibleItemScrollOffset > 10 }
    }
    LaunchedEffect(hasScrolled) { onScrollChanged(hasScrolled) }

    LazyVerticalGrid(
        columns = GridCells.Fixed(3),
        state = listState,
        modifier = Modifier.fillMaxSize()
            .padding(horizontal = if (narrow) 16.dp else 56.dp),
        contentPadding = PaddingValues(top = if (narrow) 16.dp else 156.dp, bottom = if (compactPortrait) 156.dp else 48.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item(span = { GridItemSpan(maxLineSpan) }) {
            MovvizSegmentedControl(
                options = listOf("Watchlist", "Historique", "Collections"),
                selectedIndex = tabIndex,
                onSelect = { tabIndex = it },
            )
        }
        when (tabIndex) {
            0 -> {
                val watchlist = profileData?.watchlist.orEmpty()
                if (watchlist.isEmpty()) {
                    item(span = { GridItemSpan(maxLineSpan) }) { MovvizEmptyState("Votre watchlist est vide.", "Ajoutez des films ou séries pour les retrouver ici.") }
                } else {
                    item(span = { GridItemSpan(maxLineSpan) }) { LibraryGridHeading("Ma watchlist (${watchlist.size})") }
                    items(watchlist, key = { "watchlist-${it.type}-${it.tmdbId}-${it.seasonNumber}-${it.episodeNumber}" }) { card ->
                        LibraryMediaGridCard(card, Modifier.then(if (card == watchlist.first()) Modifier.focusRequester(entryFocusRequester) else Modifier)) {
                            onOpenTitle(if (card.type == "series") "series" else card.type, card.tmdbId)
                        }
                    }
                }
            }
            1 -> {
                val history = profileData?.watchHistory.orEmpty()
                if (history.isEmpty()) {
                    item(span = { GridItemSpan(maxLineSpan) }) { MovvizEmptyState("Aucun historique pour le moment.", "Vos films et épisodes vus apparaîtront ici.") }
                } else {
                    item(span = { GridItemSpan(maxLineSpan) }) { LibraryGridHeading("Historique récent (${history.size})") }
                    items(history, key = { "history-${it.type}-${it.tmdbId}-${it.seasonNumber}-${it.episodeNumber}" }) { card ->
                        LibraryMediaGridCard(card) { onOpenTitle(if (card.type == "series") "series" else card.type, card.tmdbId) }
                    }
                }
            }
            else -> {
                val selectedCollection = collections.firstOrNull { it.id == selectedCollectionId }
                val selectedSaga = sagas.firstOrNull { it.collectionId == selectedSagaId }
                val selectedCards = selectedCollection?.items?.mapNotNull { item ->
                    movies.firstOrNull { it.id == item.libraryRef }?.let { movie ->
                        ProfileMediaCardDto(tmdbId = movie.tmdbId, type = "movie", title = movie.title, posterPath = movie.posterPath)
                    } ?: series.firstOrNull { it.id == item.libraryRef }?.let { show ->
                        ProfileMediaCardDto(tmdbId = show.tmdbId, type = "series", title = show.title, posterPath = show.posterPath)
                    }
                }.orEmpty()
                val selectedSagaCards = selectedSaga?.let { saga ->
                    movies.filter { it.tmdbCollectionId == saga.collectionId }.map { movie ->
                        ProfileMediaCardDto(tmdbId = movie.tmdbId, type = "movie", title = movie.title, posterPath = movie.posterPath)
                    }
                }.orEmpty()
                if (collections.isEmpty() && sagas.isEmpty()) {
                    item(span = { GridItemSpan(maxLineSpan) }) { MovvizEmptyState("Aucune collection pour le moment.", "Créez une collection ou complétez une saga de votre bibliothèque.") }
                } else if (selectedCollection != null) {
                    item(span = { GridItemSpan(maxLineSpan) }) {
                        Text(
                            text = "‹ ${selectedCollection.name}", color = MovvizInk, fontSize = 22.sp, fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.clickable { selectedCollectionId = null }.tvPointerClick { selectedCollectionId = null }.padding(top = 2.dp, bottom = 2.dp),
                        )
                    }
                    if (selectedCards.isEmpty()) {
                        item(span = { GridItemSpan(maxLineSpan) }) { MovvizEmptyState("Cette collection est vide.", "Ses titres apparaîtront ici dès qu'ils seront disponibles sur cet appareil.") }
                    } else {
                        items(selectedCards, key = { "collection-${selectedCollection.id}-${it.type}-${it.tmdbId}" }) { card ->
                            LibraryMediaGridCard(card) { onOpenTitle(card.type, card.tmdbId) }
                        }
                    }
                } else if (selectedSaga != null) {
                    item(span = { GridItemSpan(maxLineSpan) }) {
                        Text(
                            text = "‹ ${selectedSaga.name}", color = MovvizInk, fontSize = 22.sp, fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.clickable { selectedSagaId = null }.tvPointerClick { selectedSagaId = null }.padding(top = 2.dp, bottom = 2.dp),
                        )
                    }
                    if (selectedSagaCards.isEmpty()) {
                        item(span = { GridItemSpan(maxLineSpan) }) { MovvizEmptyState("Aucun film de cette saga n'est disponible.", "Les films possédés de la saga apparaîtront ici.") }
                    } else {
                        items(selectedSagaCards, key = { "saga-${selectedSaga.collectionId}-${it.tmdbId}" }) { card ->
                            LibraryMediaGridCard(card) { onOpenTitle("movie", card.tmdbId) }
                        }
                    }
                } else {
                    if (collections.isNotEmpty()) {
                        item(span = { GridItemSpan(maxLineSpan) }) { LibraryGridHeading("Mes collections") }
                        items(collections, key = { it.id }) { collection -> CollectionTile(collection) { selectedCollectionId = collection.id } }
                    }
                    if (sagas.isNotEmpty()) {
                        item(span = { GridItemSpan(maxLineSpan) }) { LibraryGridHeading("Sagas de votre bibliothèque") }
                        items(sagas, key = { it.collectionId }) { saga -> SagaTile(saga) { selectedSagaId = saga.collectionId } }
                    }
                }
            }
        }
    }
}

@Composable
private fun LibraryGridHeading(title: String) {
    Text(title, color = MovvizInk, fontSize = 22.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 2.dp, bottom = 2.dp))
}

@Composable
private fun LibraryMediaGridCard(card: ProfileMediaCardDto, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Column(modifier = modifier.fillMaxWidth().clickable(onClick = onClick).tvPointerClick(onClick)) {
        Box(Modifier.fillMaxWidth().aspectRatio(2f / 3f).clip(libraryTileShape).background(MovvizSurfaceStrong)) {
            val path = card.posterPath ?: card.stillPath
            if (path != null) Image(
                painter = rememberAsyncImagePainter("$TMDB_POSTER_BASE$path"), contentDescription = card.title,
                contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize(),
            )
        }
        Text(card.title, color = MovvizInk, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, maxLines = 2, modifier = Modifier.padding(top = 6.dp))
        card.progress?.let { Text("${(it.ratio * 100).toInt()} % repris", color = MovvizInkDim, fontSize = 10.sp) }
    }
}

private val libraryTileShape = RoundedCornerShape(10.dp)

@Composable
private fun CollectionTile(collection: CollectionDto, onClick: () -> Unit) {
    Column(Modifier.fillMaxWidth().clickable(onClick = onClick).tvPointerClick(onClick)) {
        Box(
            Modifier.fillMaxWidth().aspectRatio(1f).clip(libraryTileShape),
        ) {
            val path = collection.posterPath ?: collection.backdropPath
            if (path != null) {
                Image(
                    painter = rememberAsyncImagePainter("$TMDB_POSTER_BASE$path"),
                    contentDescription = collection.name,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
            } else {
                Box(Modifier.fillMaxSize().background(MovvizSurfaceStrong))
            }
        }
        Text(
            collection.name,
            color = MovvizInk,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 2,
            modifier = Modifier.padding(top = 6.dp),
        )
        Text("${collection.items.size} titres", color = MovvizInkDim, fontSize = 11.sp)
    }
}

@Composable
private fun SagaTile(saga: SagaSummaryDto, onClick: () -> Unit) {
    Column(Modifier.fillMaxWidth().clickable(onClick = onClick).tvPointerClick(onClick)) {
        Box(Modifier.fillMaxWidth().aspectRatio(2f / 3f).clip(libraryTileShape)) {
            if (saga.posterPath != null) {
                Image(
                    painter = rememberAsyncImagePainter("$TMDB_POSTER_BASE${saga.posterPath}"),
                    contentDescription = saga.name,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
            } else {
                Box(Modifier.fillMaxSize().background(MovvizSurfaceStrong))
            }
        }
        Text(saga.name, color = MovvizInk, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, maxLines = 2, modifier = Modifier.padding(top = 6.dp))
        Text("${saga.ownedCount}/${saga.totalCount} possédés", color = MovvizInkDim, fontSize = 11.sp)
    }
}
