package com.movviz.tv.ui.home

import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
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
        // Ancre invisible en PERMANENCE attachée à contentFocusRequester —
        // c'est la cible de "flèche bas depuis la NavRail" (focusProperties,
        // voir NavRail.kt), qui doit TOUJOURS pouvoir résoudre vers un noeud
        // réellement composé. Avant ce correctif, cette même référence était
        // repassée directement aux écrans comme cible de LEUR premier élément
        // réel (CTA hero, première carte, premier résultat…) — mais cet
        // élément n'existe QUE si l'écran a déjà des données (pas pendant le
        // chargement, pas sur une bibliothèque/recherche vide). Demander le
        // focus vers une FocusRequester non attachée plante (constaté en
        // direct : télécommande + flèche bas = fermeture de l'appli, plus
        // fréquent sur un boîtier lent où la fenêtre "encore en chargement"
        // dure plus longtemps — ex. Chromecast 4K vs Xiaomi). Chaque écran
        // garde sa PROPRE cible de focus initial (interne, toujours protégée
        // par retry+runCatching) pour le focus automatique à l'ouverture ;
        // seule la cible de la NavRail est désormais découplée et
        // inconditionnellement sûre.
        Box(
            modifier = Modifier
                .size(1.dp)
                .focusRequester(contentFocusRequester)
                .focusable(),
        )
        when {
            searchOpen -> SearchScreen(
                viewModel = viewModel,
                onOpenTitle = onOpenTitle,
                query = searchQuery,
                onQueryChange = onSearchQueryChange,
                showSearchField = false,
            )
            tab == HomeTab.HOME -> HomeScreen(viewModel = viewModel, onOpenTitle = onOpenTitle, onOpenEpisode = onOpenEpisode)
            tab == HomeTab.MOVIES -> CatalogScreen(viewModel = viewModel, type = HomeTab.MOVIES, onOpenTitle = onOpenTitle)
            tab == HomeTab.SERIES -> CatalogScreen(viewModel = viewModel, type = HomeTab.SERIES, onOpenTitle = onOpenTitle)
            tab == HomeTab.SETTINGS -> SettingsScreen(viewModel = viewModel, onLoggedOut = onLoggedOut)
        }
    }
}
