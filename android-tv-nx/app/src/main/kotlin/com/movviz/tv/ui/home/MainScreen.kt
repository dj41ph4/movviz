package com.movviz.tv.ui.home

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.focusGroup
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.unit.dp
import com.movviz.tv.AppViewModel
import com.movviz.tv.ui.discover.DiscoverScreen
import com.movviz.tv.ui.search.SearchScreen
import com.movviz.tv.ui.settings.SettingsScreen
import com.movviz.tv.ui.profile.ProfileScreen

/**
 * Contenu de l'onglet courant (Accueil/Films/Séries/Recherche/Paramètres) —
 * la NavRail elle-même vit désormais un niveau au-dessus (MainActivity),
 * dans une colonne réservée à gauche. Ce contenu est son frère de droite :
 * il n'est jamais recouvert par la navigation, y compris sur la fiche titre.
 */
@OptIn(androidx.compose.ui.ExperimentalComposeUiApi::class)
@Composable
internal fun MainScreen(
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
    // Cible GAUCHE depuis le contenu → NavRail : onglet sélectionné de la
    // barre reçoit le focus quand l'utilisateur appuie sur HAUT alors que
    // plus rien ne se trouve au-dessus dans le contenu.
    navRailFocusRequester: FocusRequester? = null,
    onHomeScrollChanged: (Boolean) -> Unit = {},
    // Filtre Films/Séries de la Bibliothèque et de Découverte, hoistés
    // jusqu'à MovvizNavHost : ouvrir une fiche depuis Bibliothèque > Séries
    // puis Retour doit rester sur Séries, pas retomber sur Films — voir
    // LibraryScreen.kt et DiscoverScreen.kt.
    libraryTab: LibraryTab = LibraryTab.FILMS,
    onLibraryTabChange: (LibraryTab) -> Unit = {},
    discoverType: HomeTab = HomeTab.MOVIES,
    onDiscoverTypeChange: (HomeTab) -> Unit = {},
    // Tri/genre/« manquants » de la Bibliothèque, un jeu par sous-onglet —
    // même hoisting que libraryTab/discoverType et pour la même raison.
    libraryMovieFilters: CatalogFilters = CatalogFilters(),
    onLibraryMovieFiltersChange: (CatalogFilters) -> Unit = {},
    librarySeriesFilters: CatalogFilters = CatalogFilters(),
    onLibrarySeriesFiltersChange: (CatalogFilters) -> Unit = {},
) {
    Box(
        // La navigation est désormais une sidebar à GAUCHE. Le déplacement
        // vertical reste entièrement natif (TvLazyColumn/TvLazyRow). On ne
        // redirige que la vraie sortie LEFT du groupe vers l'onglet actif,
        // via focusProperties, sans intercepter les touches.
        modifier = Modifier.fillMaxSize()
            .focusProperties {
                exit = { focusDirection ->
                    if (focusDirection == FocusDirection.Left) {
                        navRailFocusRequester ?: FocusRequester.Default
                    } else {
                        FocusRequester.Default
                    }
                }
            }
            .focusGroup(),
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
            )
            tab == HomeTab.HOME -> HomeScreen(viewModel = viewModel, onOpenTitle = onOpenTitle, onOpenEpisode = onOpenEpisode, onSeeAllRow = onSeeAllRow, entryFocusRequester = contentFocusRequester, navRailFocusRequester = navRailFocusRequester, onScrollChanged = onHomeScrollChanged)
            // Découverte redevient un onglet de nav à part entière (refonte
            // sidebar) : DiscoverScreen(fixedType = null) affiche déjà, sans
            // aucun changement de son côté, son propre sélecteur Films/Séries
            // interne à la place du toggle Suggestions/Bibliothèque des
            // anciens hubs (voir le "else" de son item "type-toggle").
            tab == HomeTab.DISCOVER -> DiscoverScreen(
                viewModel = viewModel, onOpenTitle = onOpenTitle, onSeeAllRow = onSeeAllRow,
                onOpenGenre = onOpenGenre, entryFocusRequester = contentFocusRequester,
                fixedType = null, onScrollChanged = onHomeScrollChanged,
                hoistedSelectedType = discoverType, onSelectedTypeChange = onDiscoverTypeChange,
            )
            // Bibliothèque fusionne Films/Séries/Collections (maquette) —
            // voir LibraryScreen.kt.
            tab == HomeTab.LIBRARY -> LibraryScreen(
                viewModel = viewModel, onOpenTitle = onOpenTitle,
                entryFocusRequester = contentFocusRequester, onScrollChanged = onHomeScrollChanged,
                tab = libraryTab, onTabChange = onLibraryTabChange,
                movieFilters = libraryMovieFilters, onMovieFiltersChange = onLibraryMovieFiltersChange,
                seriesFilters = librarySeriesFilters, onSeriesFiltersChange = onLibrarySeriesFiltersChange,
            )
            // MOVIES/SERIES ne sont plus des destinations de nav directes
            // (fusionnées dans LIBRARY) — les branches restent pour usage
            // interne éventuel (HomeTab est aussi le type de filtre de
            // Découverte/Bibliothèque), jamais atteintes depuis la sidebar.
            tab == HomeTab.MOVIES -> MediaHubScreen(
                viewModel = viewModel, type = HomeTab.MOVIES,
                onOpenTitle = onOpenTitle, onSeeAllRow = onSeeAllRow,
                onOpenGenre = onOpenGenre, entryFocusRequester = contentFocusRequester,
                onScrollChanged = onHomeScrollChanged,
            )
            tab == HomeTab.SERIES -> MediaHubScreen(
                viewModel = viewModel, type = HomeTab.SERIES,
                onOpenTitle = onOpenTitle, onSeeAllRow = onSeeAllRow,
                onOpenGenre = onOpenGenre, entryFocusRequester = contentFocusRequester,
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
        )
        MediaHubMode.LIBRARY -> CatalogScreen(
            viewModel = viewModel,
            type = type,
            onOpenTitle = onOpenTitle,
            entryFocusRequester = entryFocusRequester,
            mode = mode,
            onModeChange = { mode = it },
            onScrollChanged = onScrollChanged,
        )
    }
}
