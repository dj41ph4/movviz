package com.movviz.tv.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Border
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import com.movviz.tv.AppViewModel
import com.movviz.tv.ui.theme.MovvizBrand
import com.movviz.tv.ui.theme.MovvizBrand2
import com.movviz.tv.ui.theme.MovvizBrand3
import com.movviz.tv.ui.theme.MovvizBorder
import com.movviz.tv.ui.theme.MovvizInk
import com.movviz.tv.ui.theme.MovvizInkDim
import com.movviz.tv.ui.theme.tvPointerClick
import androidx.compose.ui.graphics.Brush

private enum class LibraryTab(val label: String) { FILMS("Films"), SERIES("Séries"), COLLECTIONS("Collections") }

/**
 * Bibliothèque unifiée (maquette "Movviz Android TV") : Films/Séries/
 * Collections sous un seul onglet de nav, au lieu des deux hubs séparés
 * d'avant. Réutilise CatalogScreen (l'inventaire trié/filtrable existant)
 * pour Films/Séries — `showModeToggle = false` puisque le toggle interne
 * Suggestions/Bibliothèque de CatalogScreen n'a plus lieu d'être ici :
 * Découverte est déjà son propre onglet de la sidebar.
 *
 * Collections : pas encore de source de données côté TV (voir ApiModels.kt —
 * seule la saga TMDb d'un titre existe, pas les collections perso de
 * l'utilisateur comme sur le web) — placeholder en attendant un point
 * d'API dédié.
 */
@Composable
fun LibraryScreen(
    viewModel: AppViewModel,
    onOpenTitle: (String, Int) -> Unit,
    entryFocusRequester: FocusRequester? = null,
    onScrollChanged: (Boolean) -> Unit = {},
) {
    var tab by remember { mutableStateOf(LibraryTab.FILMS) }

    Column(Modifier.fillMaxSize().padding(start = 42.dp, top = 24.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(bottom = 6.dp)) {
            LibraryTab.entries.forEach { t ->
                LibraryToggleChip(
                    label = t.label,
                    active = tab == t,
                    onClick = { tab = t },
                    focusRequester = if (t == LibraryTab.FILMS) entryFocusRequester else null,
                )
            }
        }
        when (tab) {
            LibraryTab.FILMS -> CatalogScreen(
                viewModel = viewModel, type = HomeTab.MOVIES, onOpenTitle = onOpenTitle,
                showModeToggle = false, onScrollChanged = onScrollChanged,
            )
            LibraryTab.SERIES -> CatalogScreen(
                viewModel = viewModel, type = HomeTab.SERIES, onOpenTitle = onOpenTitle,
                showModeToggle = false, onScrollChanged = onScrollChanged,
            )
            LibraryTab.COLLECTIONS -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text(
                    "Collections — bientôt disponible",
                    style = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = MovvizInkDim),
                )
            }
        }
    }
}

@Composable
private fun LibraryToggleChip(label: String, active: Boolean, onClick: () -> Unit, focusRequester: FocusRequester? = null) {
    var focused by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(50)
    Surface(
        onClick = onClick,
        modifier = Modifier
            .let { if (focusRequester != null) it.focusRequester(focusRequester) else it }
            .onFocusChanged { focused = it.isFocused }
            .tvPointerClick(onClick),
        shape = ClickableSurfaceDefaults.shape(shape = shape),
        scale = ClickableSurfaceDefaults.scale(focusedScale = 1f), colors = ClickableSurfaceDefaults.colors(
            containerColor = Color.Transparent,
            focusedContainerColor = Color.White.copy(alpha = 0.12f),
        ),
        border = ClickableSurfaceDefaults.border(
            border = Border(border = androidx.compose.foundation.BorderStroke(1.dp, MovvizBorder), shape = shape),
            focusedBorder = Border(border = androidx.compose.foundation.BorderStroke(2.dp, Color.White.copy(alpha = 0.7f)), shape = shape),
        ),
    ) {
        Box(
            modifier = Modifier
                .let { if (active) it.background(Brush.linearGradient(listOf(MovvizBrand3, MovvizBrand, MovvizBrand2)), shape) else it }
                .padding(horizontal = 17.dp, vertical = 8.dp),
        ) {
            Text(
                label,
                style = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.Bold, color = if (active) Color.White else MovvizInkDim),
            )
        }
    }
}
