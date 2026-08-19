package com.movviz.tv.ui.home

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import com.movviz.tv.AppViewModel
import com.movviz.tv.data.TvProfile
import com.movviz.tv.ui.search.SearchScreen
import com.movviz.tv.ui.settings.SettingsScreen

/**
 * Coquille principale post-login : barre de navigation horizontale en haut
 * (même composition que le lanceur système Android TV — logo + items texte
 * à plat, aucun rail vertical) + zone de contenu qui bascule entre
 * Accueil/Recherche/Paramètres en dessous. La fiche titre reste, elle,
 * poussée par le NavController (plein écran, hors de la barre) — cohérent
 * avec Netflix qui masque aussi sa nav dès qu'on ouvre une fiche.
 */
@Composable
fun MainScreen(
    viewModel: AppViewModel,
    onOpenTitle: (type: String, tmdbId: Int) -> Unit,
    onLoggedOut: () -> Unit,
    onProfileSelected: (TvProfile) -> Unit = {},
    onAddProfile: () -> Unit = {},
) {
    var tab by remember { mutableStateOf(HomeTab.HOME) }
    var searchOpen by remember { mutableStateOf(false) }
    var searchQuery by remember { mutableStateOf("") }

    Box(modifier = Modifier.fillMaxSize()) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                // Sur l'accueil, le hero passe sous la barre en verre : la
                // transparence révèle réellement le visuel plutôt qu'un
                // simple fond noir translucide. Les écrans utilitaires
                // conservent, eux, une zone de lecture dégagée sous la nav.
                .padding(top = if (tab == HomeTab.HOME && !searchOpen) 0.dp else 80.dp),
        ) {
            when {
                searchOpen -> SearchScreen(
                    viewModel = viewModel,
                    onOpenTitle = onOpenTitle,
                    query = searchQuery,
                    onQueryChange = { searchQuery = it },
                    showSearchField = false,
                )
                tab == HomeTab.HOME -> HomeScreen(viewModel = viewModel, onOpenTitle = onOpenTitle)
                tab == HomeTab.MOVIES -> CatalogScreen(viewModel = viewModel, type = HomeTab.MOVIES, onOpenTitle = onOpenTitle)
                tab == HomeTab.SERIES -> CatalogScreen(viewModel = viewModel, type = HomeTab.SERIES, onOpenTitle = onOpenTitle)
                tab == HomeTab.SEARCH -> SearchScreen(viewModel = viewModel, onOpenTitle = onOpenTitle)
                tab == HomeTab.SETTINGS -> SettingsScreen(viewModel = viewModel, onLoggedOut = onLoggedOut)
            }
        }
        NavRail(
            selected = tab,
            onSelect = { tab = it; searchOpen = false },
            searchOpen = searchOpen,
            searchQuery = searchQuery,
            onSearchToggle = { searchOpen = !searchOpen; if (searchOpen) tab = HomeTab.HOME else searchQuery = "" },
            onSearchQueryChange = { searchQuery = it },
            profiles = viewModel.profiles.collectAsState().value,
            activeProfile = viewModel.activeProfile.collectAsState().value,
            onProfileSelected = onProfileSelected,
            onAddProfile = onAddProfile,
            modifier = Modifier.zIndex(1f),
        )
    }
}
