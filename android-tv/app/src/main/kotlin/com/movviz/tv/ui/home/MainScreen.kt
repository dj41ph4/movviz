package com.movviz.tv.ui.home

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
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
    // Ouverture d'une série depuis "Continuer à regarder" — sur le bon
    // épisode plutôt que la saison 1 par défaut (voir HomeScreen).
    onOpenEpisode: (tmdbId: Int, season: Int, episode: Int) -> Unit = { _, _, _ -> },
    onLoggedOut: () -> Unit,
    onProfileSelected: (TvProfile) -> Unit = {},
    onAddProfile: () -> Unit = {},
    onSwitchProfile: () -> Unit = {},
) {
    var tab by remember { mutableStateOf(HomeTab.HOME) }
    var searchOpen by remember { mutableStateOf(false) }
    var searchQuery by remember { mutableStateOf("") }
    // Cible D-pad unique « premier élément du contenu affiché » — la NavRail
    // pose focusProperties{down=...} dessus (voir NavRail.kt) pour que la
    // flèche bas depuis N'IMPORTE quel item de la barre y descende toujours,
    // au lieu de compter sur la recherche spatiale par défaut de Compose qui
    // ne trouve jamais de cible à travers deux frères superposés dans un Box
    // (nav + contenu, zIndex ne joue que sur le dessin) — bug constaté en
    // direct : DPAD bas totalement sans effet depuis la nav, quel que soit
    // l'onglet. Un seul écran de contenu est composé à la fois (when
    // ci-dessous) donc un seul requester suffit ; chaque écran l'attache à
    // son propre premier élément focusable (CTA hero, première carte,
    // premier résultat de recherche, premier réglage…).
    val contentFocusRequester = remember { FocusRequester() }

    Box(modifier = Modifier.fillMaxSize()) {
        Box(
            modifier = Modifier
                .fillMaxSize(),
            // Jamais de padding top ici, sur AUCUN écran : un padding
            // poussait Recherche/Paramètres sous une bande opaque
            // (MaterialTheme.colorScheme.background plein sous la nav
            // transparente) qui tranchait visuellement avec le reste —
            // signalé en direct comme "bandeau noir" après l'avoir déjà fait
            // disparaître d'Accueil/Films/Séries de la même façon. Chaque
            // écran gère désormais lui-même sa marge haute pour dégager la
            // barre de nav flottante (voir SearchScreen/SettingsScreen).
        ) {
            when {
                searchOpen -> SearchScreen(
                    viewModel = viewModel,
                    onOpenTitle = onOpenTitle,
                    query = searchQuery,
                    onQueryChange = { searchQuery = it },
                    showSearchField = false,
                    resultFocusRequester = contentFocusRequester,
                )
                tab == HomeTab.HOME -> HomeScreen(viewModel = viewModel, onOpenTitle = onOpenTitle, onOpenEpisode = onOpenEpisode, entryFocusRequester = contentFocusRequester)
                tab == HomeTab.MOVIES -> CatalogScreen(viewModel = viewModel, type = HomeTab.MOVIES, onOpenTitle = onOpenTitle, entryFocusRequester = contentFocusRequester)
                tab == HomeTab.SERIES -> CatalogScreen(viewModel = viewModel, type = HomeTab.SERIES, onOpenTitle = onOpenTitle, entryFocusRequester = contentFocusRequester)
                tab == HomeTab.SETTINGS -> SettingsScreen(viewModel = viewModel, onLoggedOut = onLoggedOut, entryFocusRequester = contentFocusRequester)
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
            onSwitchProfile = onSwitchProfile,
            contentFocusRequester = contentFocusRequester,
            modifier = Modifier.zIndex(1f),
        )
    }
}
