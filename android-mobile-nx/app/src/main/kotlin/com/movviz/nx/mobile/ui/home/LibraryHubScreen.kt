package com.movviz.nx.mobile.ui.home

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
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
import androidx.compose.runtime.mutableIntStateOf
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
import com.movviz.nx.mobile.data.SagaSummaryDto
import com.movviz.nx.mobile.ui.mobile.MovvizEmptyState
import com.movviz.nx.mobile.ui.mobile.MovvizSegmentedControl
import com.movviz.nx.mobile.ui.mobile.rememberCompactPortrait
import com.movviz.nx.mobile.ui.profile.profileRail
import com.movviz.nx.mobile.ui.theme.MovvizInk
import com.movviz.nx.mobile.ui.theme.MovvizInkDim
import com.movviz.nx.mobile.ui.theme.MovvizSurfaceStrong
import com.movviz.nx.mobile.ui.theme.tvPointerClick

private const val TMDB_POSTER_BASE = "https://image.tmdb.org/t/p/w342"

/**
 * Vrai point d'entrée Bibliothèque (esquisse mobile section 11) : Watchlist/
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
    val profileData by viewModel.profileMedia.collectAsState()
    val collections by viewModel.collections.collectAsState()
    val sagas by viewModel.sagas.collectAsState()
    LaunchedEffect(Unit) {
        if (viewModel.profileMedia.value == null) viewModel.loadProfileMedia()
        viewModel.loadCollections()
    }
    val compactPortrait = rememberCompactPortrait()
    // Déplié : la barre TV haute n'existe plus et la colonne est étroite —
    // mêmes marges compactes que le portrait (pas de trou 156dp en haut).
    val narrow = compactPortrait || rememberUnfoldedLandscape()
    val listState = rememberLazyListState()
    val hasScrolled by remember {
        derivedStateOf { listState.firstVisibleItemIndex > 0 || listState.firstVisibleItemScrollOffset > 10 }
    }
    LaunchedEffect(hasScrolled) { onScrollChanged(hasScrolled) }

    LazyColumn(
        state = listState,
        modifier = Modifier.fillMaxSize()
            .padding(horizontal = if (narrow) 16.dp else 56.dp),
        contentPadding = PaddingValues(top = if (narrow) 16.dp else 156.dp, bottom = if (compactPortrait) 156.dp else 48.dp),
        verticalArrangement = Arrangement.spacedBy(if (narrow) 22.dp else 30.dp),
    ) {
        item {
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
                    item { MovvizEmptyState("Votre watchlist est vide.", "Ajoutez des films ou séries pour les retrouver ici.") }
                } else {
                    profileRail(
                        title = "Ma watchlist (${watchlist.size})",
                        cards = watchlist,
                        entryFocusRequester = entryFocusRequester,
                        onOpenTitle = onOpenTitle,
                        onOpenEpisode = { tmdbId, _, _ -> onOpenTitle("series", tmdbId) },
                    )
                }
            }
            1 -> {
                val history = profileData?.watchHistory.orEmpty()
                if (history.isEmpty()) {
                    item { MovvizEmptyState("Aucun historique pour le moment.", "Vos films et épisodes vus apparaîtront ici.") }
                } else {
                    profileRail(
                        title = "Historique récent (${history.size})",
                        cards = history,
                        entryFocusRequester = entryFocusRequester,
                        onOpenTitle = onOpenTitle,
                        onOpenEpisode = { tmdbId, _, _ -> onOpenTitle("series", tmdbId) },
                    )
                }
            }
            else -> {
                if (collections.isEmpty() && sagas.isEmpty()) {
                    item { MovvizEmptyState("Aucune collection pour le moment.", "Créez une collection ou complétez une saga de votre bibliothèque.") }
                } else {
                    if (collections.isNotEmpty()) {
                        item {
                            Column(Modifier.fillMaxWidth()) {
                                Text("Mes collections", color = MovvizInk, fontSize = 22.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(bottom = 14.dp))
                                LazyRow(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                                    items(collections, key = { it.id }) { collection -> CollectionTile(collection) }
                                }
                            }
                        }
                    }
                    if (sagas.isNotEmpty()) {
                        item {
                            Column(Modifier.fillMaxWidth()) {
                                Text("Sagas de votre bibliothèque", color = MovvizInk, fontSize = 22.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(bottom = 14.dp))
                                LazyRow(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                                    items(sagas, key = { it.collectionId }) { saga -> SagaTile(saga) }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

private val libraryTileShape = RoundedCornerShape(10.dp)

@Composable
private fun CollectionTile(collection: CollectionDto) {
    Column(Modifier.width(150.dp)) {
        Box(
            Modifier.width(150.dp).height(150.dp).clip(libraryTileShape),
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
private fun SagaTile(saga: SagaSummaryDto) {
    Column(Modifier.width(150.dp)) {
        Box(Modifier.width(150.dp).height(220.dp).clip(libraryTileShape)) {
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
