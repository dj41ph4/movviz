package com.movviz.nx.mobile.ui.home

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
    DiscoverScreen(
        viewModel = viewModel,
        onOpenTitle = onOpenTitle,
        onSeeAllRow = onSeeAllRow,
        onOpenGenre = onOpenGenre,
        entryFocusRequester = entryFocusRequester,
        fixedType = mediaType,
        contextHeader = {
            MovvizSegmentedControl(
                options = listOf("Films", "Séries"),
                selectedIndex = if (mediaType == HomeTab.MOVIES) 0 else 1,
                onSelect = { mediaType = if (it == 0) HomeTab.MOVIES else HomeTab.SERIES },
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
            )
        },
        onScrollChanged = onScrollChanged,
    )
}
