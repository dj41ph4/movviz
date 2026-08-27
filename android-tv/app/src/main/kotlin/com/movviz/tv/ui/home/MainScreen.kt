package com.movviz.tv.ui.home

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusGroup
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalFocusManager
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
    // "Voir tout" d'une rangée éditoriale (accueil ou catalogue) — voir
    // HomeScreen.onSeeAllRow/CatalogScreen.onSeeAllRow.
    onSeeAllRow: (mediaType: String, key: String, label: String) -> Unit = { _, _, _ -> },
    // Sélection d'un genre dans le sélecteur Genres du catalogue — voir
    // CatalogScreen.onOpenGenre.
    onOpenGenre: (mediaType: String, genreId: String, label: String) -> Unit = { _, _, _ -> },
    onLoggedOut: () -> Unit,
    tab: HomeTab,
    searchOpen: Boolean,
    searchQuery: String,
    onSearchQueryChange: (String) -> Unit,
    contentFocusRequester: FocusRequester,
    // Ancre de repli TOUJOURS attachée (désormais au niveau de
    // MovvizNavHost pour exister aussi sous fiche titre/acteur) — cible que
    // la NavRail vise quand contentFocusRequester ne pointe encore vers rien
    // de réel (écran en chargement, résultats vides). Distincte de
    // contentFocusRequester : les deux ne peuvent pas être le même objet, un
    // FocusRequester ne peut être attaché qu'à UN seul noeud composé à la
    // fois.
    fallbackFocusRequester: FocusRequester,
    // Cible HAUT depuis le contenu → NavRail : onglet sélectionné de la
    // barre reçoit le focus quand l'utilisateur appuie sur HAUT alors que
    // plus rien ne se trouve au-dessus dans le contenu.
    navRailFocusRequester: FocusRequester? = null,
) {
    val focusManager = LocalFocusManager.current
    Box(
        modifier = Modifier.fillMaxSize().focusGroup()
            .onKeyEvent { event ->
                if (event.type == KeyEventType.KeyDown && event.key == Key.DirectionUp) {
                    // SYMÉTRIE D-PAD OBLIGATOIRE (bug constaté en direct :
                    // « UP remonte dans le menu et ne redescend plus »).
                    // Ancien code : consommait TOUS les UP → impossible de
                    // monter d'une rangée de posters à l'autre, chaque HAUT
                    // sautait directement dans la barre de nav.
                    //
                    // 1) Laisser d'abord le focus monter À L'INTÉRIEUR du
                    //    contenu (rangée N-1, saison au-dessus…) —
                    //    moveFocus parcourt toute la hiérarchie composée.
                    val movedInside = focusManager.moveFocus(FocusDirection.Up)
                    if (movedInside) true
                    // 2) Rien au-dessus dans le contenu (première rangée /
                    //    hero) → onglet actif de la NavRail.
                    else navRailFocusRequester?.let {
                        runCatching { it.requestFocus() }.isSuccess
                    } == true
                } else false
            },
        // Jamais de padding top ici, sur AUCUN écran : un padding poussait
        // Recherche/Paramètres sous une bande opaque (MaterialTheme.
        // colorScheme.background plein sous la nav transparente) qui
        // tranchait visuellement avec le reste — signalé en direct comme
        // "bandeau noir" après l'avoir déjà fait disparaître d'Accueil/
        // Films/Séries de la même façon. Chaque écran gère désormais
        // lui-même sa marge haute pour dégager la barre de nav flottante.
    ) {
        when {
            searchOpen -> SearchScreen(
                viewModel = viewModel,
                onOpenTitle = onOpenTitle,
                query = searchQuery,
                onQueryChange = onSearchQueryChange,
                showSearchField = false,
                resultFocusRequester = contentFocusRequester,
            )
            tab == HomeTab.HOME -> HomeScreen(viewModel = viewModel, onOpenTitle = onOpenTitle, onOpenEpisode = onOpenEpisode, onSeeAllRow = onSeeAllRow, entryFocusRequester = contentFocusRequester)
            tab == HomeTab.MOVIES -> CatalogScreen(viewModel = viewModel, type = HomeTab.MOVIES, onOpenTitle = onOpenTitle, onSeeAllRow = onSeeAllRow, onOpenGenre = onOpenGenre, entryFocusRequester = contentFocusRequester)
            tab == HomeTab.SERIES -> CatalogScreen(viewModel = viewModel, type = HomeTab.SERIES, onOpenTitle = onOpenTitle, onSeeAllRow = onSeeAllRow, onOpenGenre = onOpenGenre, entryFocusRequester = contentFocusRequester)
            tab == HomeTab.SETTINGS -> SettingsScreen(viewModel = viewModel, onLoggedOut = onLoggedOut, entryFocusRequester = contentFocusRequester)
        }
    }
}
