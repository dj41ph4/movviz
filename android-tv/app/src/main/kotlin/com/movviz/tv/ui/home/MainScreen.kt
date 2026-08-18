package com.movviz.tv.ui.home

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.weight
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.movviz.tv.AppViewModel
import com.movviz.tv.ui.search.SearchScreen
import com.movviz.tv.ui.settings.SettingsScreen

/**
 * Coquille principale post-login : rail de navigation persistant à gauche +
 * zone de contenu qui bascule entre Accueil/Recherche/Paramètres — c'est ce
 * rail qui manquait pour vraiment se rapprocher de Plex/Netflix (jusqu'ici
 * l'app n'avait qu'un seul écran plein sans navigation structurelle).
 * La fiche titre reste, elle, poussée par le NavController (plein écran,
 * hors du rail) — cohérent avec Netflix qui masque aussi sa nav latérale
 * dès qu'on ouvre une fiche.
 */
@Composable
fun MainScreen(
    viewModel: AppViewModel,
    onOpenTitle: (type: String, tmdbId: Int) -> Unit,
    onLoggedOut: () -> Unit,
) {
    var tab by remember { mutableStateOf(HomeTab.HOME) }

    Row(modifier = Modifier.fillMaxSize()) {
        NavRail(selected = tab, onSelect = { tab = it })
        Box(modifier = Modifier.weight(1f).fillMaxHeight()) {
            when (tab) {
                HomeTab.HOME -> HomeScreen(viewModel = viewModel, onOpenTitle = onOpenTitle)
                HomeTab.SEARCH -> SearchScreen(viewModel = viewModel, onOpenTitle = onOpenTitle)
                HomeTab.SETTINGS -> SettingsScreen(viewModel = viewModel, onLoggedOut = onLoggedOut)
            }
        }
    }
}
