package com.movviz.nx.mobile.ui.home

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.unit.dp
import com.movviz.nx.mobile.AppViewModel
import com.movviz.nx.mobile.ui.discover.DiscoverScreen
import com.movviz.nx.mobile.ui.search.SearchScreen
import com.movviz.nx.mobile.ui.settings.SettingsScreen
import com.movviz.nx.mobile.ui.profile.ProfileScreen

/**
 * Contenu de l'onglet courant (Accueil/Films/Séries/Recherche/Paramètres) —
 * la NavRail elle-même vit désormais un niveau au-dessus (MainActivity),
 * dans une colonne réservée à gauche. Ce contenu est son frère de droite :
 * il n'est jamais recouvert par la navigation, y compris sur la fiche titre.
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
    // Bascule du contrôle secondaire "Découverte/Films/Séries" affiché dans
    // Discover/CatalogScreen en portrait (esquisse mobile 2026-09) — distinct
    // de la barre de navigation basse à 5 entrées, qui reste inchangée.
    onSelectTab: (HomeTab) -> Unit = {},
    searchOpen: Boolean,
    searchQuery: String,
    onSearchQueryChange: (String) -> Unit,
    // "Annuler" de la barre de recherche persistante portrait — ferme la
    // recherche et revient au dernier onglet. Sans effet en paysage/TV (pas
    // de lien "Annuler" dans ce layout, la barre reste un simple champ).
    onSearchCancel: () -> Unit = {},
    contentFocusRequester: FocusRequester,
    // Cible HAUT depuis le contenu → NavRail : onglet sélectionné de la
    // barre reçoit le focus quand l'utilisateur appuie sur HAUT alors que
    // plus rien ne se trouve au-dessus dans le contenu.
    navRailFocusRequester: FocusRequester? = null,
    onHomeScrollChanged: (Boolean) -> Unit = {},
) {
    val focusManager = LocalFocusManager.current
    Box(
        // L'accueil possède sa propre arborescence TV : son TvLazyColumn doit
        // recevoir UP directement pour remonter de rangée en rangée. Les
        // écrans historiques conservent leur repli global vers la NavRail,
        // afin que cette correction ne change pas leurs parcours existants.
        modifier = Modifier.fillMaxSize().onKeyEvent { event ->
            if (tab == HomeTab.HOME && !searchOpen) return@onKeyEvent false
            if (event.type != KeyEventType.KeyDown || event.key != Key.DirectionUp) return@onKeyEvent false
            if (focusManager.moveFocus(FocusDirection.Up)) true
            else navRailFocusRequester?.let { runCatching { it.requestFocus() }.isSuccess } == true
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
                showSearchField = true,
                resultFocusRequester = contentFocusRequester,
                onCancel = onSearchCancel,
            )
            tab == HomeTab.HOME -> HomeScreen(viewModel = viewModel, onOpenTitle = onOpenTitle, onOpenEpisode = onOpenEpisode, onSeeAllRow = onSeeAllRow, entryFocusRequester = contentFocusRequester, navRailFocusRequester = navRailFocusRequester, onScrollChanged = onHomeScrollChanged)
            // Films et Séries sont désormais chacun un véritable hub : les
            // suggestions de leur type, ou l'inventaire de leur type. Il n'y
            // a plus de découverte séparée qui mélangeait l'intention.
            tab == HomeTab.MOVIES -> MediaHubScreen(
                viewModel = viewModel, type = HomeTab.MOVIES, activeHubTab = tab,
                onOpenTitle = onOpenTitle, onSeeAllRow = onSeeAllRow,
                onOpenGenre = onOpenGenre, entryFocusRequester = contentFocusRequester,
                onSelectTab = onSelectTab,
                onScrollChanged = onHomeScrollChanged,
            )
            tab == HomeTab.SERIES -> MediaHubScreen(
                viewModel = viewModel, type = HomeTab.SERIES, activeHubTab = tab,
                onOpenTitle = onOpenTitle, onSeeAllRow = onSeeAllRow,
                onOpenGenre = onOpenGenre, entryFocusRequester = contentFocusRequester,
                onSelectTab = onSelectTab,
                onScrollChanged = onHomeScrollChanged,
            )
            tab == HomeTab.DISCOVER -> DiscoverHubScreen(
                viewModel = viewModel,
                onOpenTitle = onOpenTitle,
                onSeeAllRow = onSeeAllRow,
                onOpenGenre = onOpenGenre,
                entryFocusRequester = contentFocusRequester,
                onScrollChanged = onHomeScrollChanged,
            )
            tab == HomeTab.LIBRARY -> LibraryHubScreen(
                viewModel = viewModel,
                onOpenTitle = onOpenTitle,
                entryFocusRequester = contentFocusRequester,
                onScrollChanged = onHomeScrollChanged,
            )
            // "Ma liste" (bottom nav portrait maquette) : réutilise la grille
            // d'inventaire plutôt qu'un nouvel écran — le rail watchlist
            // dédié reste visible dans l'onglet Profil.
            tab == HomeTab.MY_LIST -> LibraryHubScreen(
                viewModel = viewModel,
                onOpenTitle = onOpenTitle,
                entryFocusRequester = contentFocusRequester,
                onScrollChanged = onHomeScrollChanged,
            )
            tab == HomeTab.PROFILE -> ProfileScreen(
                viewModel = viewModel,
                entryFocusRequester = contentFocusRequester,
                onOpenTitle = onOpenTitle,
                onOpenEpisode = onOpenEpisode,
                onScrollChanged = onHomeScrollChanged,
            )
            tab == HomeTab.SETTINGS -> SettingsScreen(viewModel = viewModel, onLoggedOut = onLoggedOut, entryFocusRequester = contentFocusRequester)
        }
    }
}

@Composable
private fun MediaHubScreen(
    viewModel: AppViewModel,
    type: HomeTab,
    onOpenTitle: (String, Int) -> Unit,
    onSeeAllRow: (mediaType: String, key: String, label: String) -> Unit,
    onOpenGenre: (mediaType: String, genreId: String, label: String) -> Unit,
    entryFocusRequester: FocusRequester,
    onScrollChanged: (Boolean) -> Unit,
    // Onglet réel de la barre basse (HOME/DISCOVER/MOVIES/SERIES/PROFILE) —
    // distinct de `type`, qui vaut toujours MOVIES ou SERIES même quand la
    // barre basse est sur Découverte (voir le commentaire "État résiduel"
    // dans MainScreen). Sert uniquement à l'affichage actif du contrôle
    // segmenté Découverte/Films/Séries.
    activeHubTab: HomeTab = type,
    onSelectTab: (HomeTab) -> Unit = {},
) {
    var mode by rememberSaveable(type) { mutableStateOf(MediaHubMode.SUGGESTIONS) }
    // Une bascule remplace entièrement la branche Compose (Suggestions ↔
    // Bibliothèque). Sans restitution explicite, Android cherche une cible
    // spatiale dans la barre supérieure et peut envoyer le focus sur Accueil
    // alors que Films/Séries est toujours actif. Le premier chip du nouveau
    // hub est la cible stable, donc on le reprend après sa composition.
    LaunchedEffect(type, mode) {
        kotlinx.coroutines.delay(80)
        runCatching { entryFocusRequester.requestFocus() }
    }
    when (mode) {
        MediaHubMode.SUGGESTIONS -> DiscoverScreen(
            viewModel = viewModel,
            onOpenTitle = onOpenTitle,
            onSeeAllRow = onSeeAllRow,
            onOpenGenre = onOpenGenre,
            entryFocusRequester = entryFocusRequester,
            fixedType = type,
            mode = mode,
            onModeChange = { mode = it },
            onScrollChanged = onScrollChanged,
            activeHubTab = activeHubTab,
            onSelectHubTab = onSelectTab,
        )
        MediaHubMode.LIBRARY -> CatalogScreen(
            viewModel = viewModel,
            type = type,
            onOpenTitle = onOpenTitle,
            entryFocusRequester = entryFocusRequester,
            mode = mode,
            onModeChange = { mode = it },
            onScrollChanged = onScrollChanged,
            activeHubTab = activeHubTab,
            onSelectHubTab = onSelectTab,
        )
    }
}
