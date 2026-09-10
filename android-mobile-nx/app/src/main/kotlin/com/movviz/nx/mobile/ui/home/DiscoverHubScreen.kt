package com.movviz.nx.mobile.ui.home

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.unit.dp
import com.movviz.nx.mobile.AppViewModel
import com.movviz.nx.mobile.ui.discover.DiscoverScreen
import com.movviz.nx.mobile.ui.mobile.MovvizSegmentedControl

/**
 * Shell de découverte NX : un seul contrôle segmenté Films/Séries (esquisse
 * mobile section 9 — "[ FILMS ] [ SÉRIES ]"), pas de 3e option "Découverte"
 * mixte : Découverte EST l'écran, le contrôle ne fait que choisir le type de
 * contenu affiché à l'intérieur, par défaut Films.
 *
 * `mode` bascule entre Suggestions (DiscoverScreen) et Bibliothèque
 * (CatalogScreen, catalogue complet possédé) — существait avant la refonte
 * via MediaHubToggleRow ; disparu par erreur en même temps que l'ancien
 * sélecteur 3 voies. Les deux écrans partagent le même contrôle Films/
 * Séries en tête (contextHeader), pour ne jamais perdre la cohérence
 * visuelle en changeant de mode.
 */
@Composable
fun DiscoverHubScreen(
    viewModel: AppViewModel,
    onOpenTitle: (String, Int) -> Unit,
    onSeeAllRow: (String, String, String) -> Unit,
    onOpenGenre: (String, String, String) -> Unit,
    entryFocusRequester: FocusRequester,
    onScrollChanged: (Boolean) -> Unit,
) {
    var mediaType by rememberSaveable { mutableStateOf(HomeTab.MOVIES) }
    var mode by rememberSaveable(mediaType) { mutableStateOf(MediaHubMode.SUGGESTIONS) }
    val header: @Composable () -> Unit = {
        MovvizSegmentedControl(
            options = listOf("Films", "Séries"),
            selectedIndex = if (mediaType == HomeTab.MOVIES) 0 else 1,
            onSelect = { mediaType = if (it == 0) HomeTab.MOVIES else HomeTab.SERIES },
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
        )
    }
    when (mode) {
        MediaHubMode.SUGGESTIONS -> DiscoverScreen(
            viewModel = viewModel,
            onOpenTitle = onOpenTitle,
            onSeeAllRow = onSeeAllRow,
            onOpenGenre = onOpenGenre,
            entryFocusRequester = entryFocusRequester,
            fixedType = mediaType,
            mode = mode,
            onModeChange = { mode = it },
            contextHeader = header,
            onScrollChanged = onScrollChanged,
        )
        MediaHubMode.LIBRARY -> CatalogScreen(
            viewModel = viewModel,
            type = mediaType,
            onOpenTitle = onOpenTitle,
            entryFocusRequester = entryFocusRequester,
            mode = mode,
            onModeChange = { mode = it },
            onScrollChanged = onScrollChanged,
            contextHeader = header,
        )
    }
}
