package com.movviz.tv.ui.home

import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.unit.dp
import com.movviz.tv.AppViewModel
import com.movviz.tv.ui.search.SearchScreen
import com.movviz.tv.ui.settings.SettingsScreen

/**
 * Contenu de l'onglet courant (Accueil/Films/Séries/Recherche/Paramètres) —
 * la NavRail elle-même vit désormais un niveau au-dessus (MainActivity), en
 * overlay persistant au-dessus de CE contenu ET de la fiche titre, pour
 * qu'elle reste visible partout au lieu de disparaître dès qu'on ouvre une
 * fiche (demandé explicitement après le premier jet "à la Netflix" qui la
 * masquait sur la fiche titre).
 */
@Composable
fun MainScreen(
    viewModel: AppViewModel,
    onOpenTitle: (type: String, tmdbId: Int) -> Unit,
    // Ouverture d'une série depuis "Continuer à regarder" — sur le bon
    // épisode plutôt que la saison 1 par défaut (voir HomeScreen).
    onOpenEpisode: (tmdbId: Int, season: Int, episode: Int) -> Unit = { _, _, _ -> },
    onLoggedOut: () -> Unit,
    tab: HomeTab,
    searchOpen: Boolean,
    searchQuery: String,
    onSearchQueryChange: (String) -> Unit,
    contentFocusRequester: FocusRequester,
    // Ancre de repli, TOUJOURS attachée (voir plus bas) — cible que la
    // NavRail vise quand contentFocusRequester ne pointe encore vers rien
    // de réel (écran en chargement, résultats vides). Distincte de
    // contentFocusRequester : les deux ne peuvent pas être le même objet, un
    // FocusRequester ne peut être attaché qu'à UN seul noeud composé à la
    // fois. Sans repli séparé, la seule option sûre était de ne JAMAIS
    // viser le vrai premier élément (ce qui a été tenté, puis corrigé ici) —
    // la flèche bas semblait alors "ne rien faire", un vrai recul en usage
    // normal pour éliminer un plantage qui n'arrivait qu'en bord de cas.
    fallbackFocusRequester: FocusRequester,
) {
    Box(
        modifier = Modifier.fillMaxSize(),
        // Jamais de padding top ici, sur AUCUN écran : un padding poussait
        // Recherche/Paramètres sous une bande opaque (MaterialTheme.
        // colorScheme.background plein sous la nav transparente) qui
        // tranchait visuellement avec le reste — signalé en direct comme
        // "bandeau noir" après l'avoir déjà fait disparaître d'Accueil/
        // Films/Séries de la même façon. Chaque écran gère désormais
        // lui-même sa marge haute pour dégager la barre de nav flottante.
    ) {
        // Ancre invisible en PERMANENCE attachée — NavRail bascule dessus
        // (onKeyEvent + runCatching, voir NavRail.kt) uniquement si viser
        // contentFocusRequester échoue, jamais en laissant Compose planter
        // sur une cible non attachée.
        Box(
            modifier = Modifier
                .size(1.dp)
                .focusRequester(fallbackFocusRequester)
                .focusable(),
        )
        when {
            searchOpen -> SearchScreen(
                viewModel = viewModel,
                onOpenTitle = onOpenTitle,
                query = searchQuery,
                onQueryChange = onSearchQueryChange,
                showSearchField = false,
                resultFocusRequester = contentFocusRequester,
            )
            tab == HomeTab.HOME -> HomeScreen(viewModel = viewModel, onOpenTitle = onOpenTitle, onOpenEpisode = onOpenEpisode, entryFocusRequester = contentFocusRequester)
            tab == HomeTab.MOVIES -> CatalogScreen(viewModel = viewModel, type = HomeTab.MOVIES, onOpenTitle = onOpenTitle, entryFocusRequester = contentFocusRequester)
            tab == HomeTab.SERIES -> CatalogScreen(viewModel = viewModel, type = HomeTab.SERIES, onOpenTitle = onOpenTitle, entryFocusRequester = contentFocusRequester)
            tab == HomeTab.SETTINGS -> SettingsScreen(viewModel = viewModel, onLoggedOut = onLoggedOut, entryFocusRequester = contentFocusRequester)
        }
    }
}
