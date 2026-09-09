package com.movviz.nx.mobile.ui.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
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
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import com.movviz.nx.mobile.AppViewModel
import com.movviz.nx.mobile.ui.theme.MovvizBrand2
import com.movviz.nx.mobile.ui.theme.MovvizInkSoft
import com.movviz.nx.mobile.ui.theme.tvPointerClick

/**
 * Vrai point d'entrée Bibliothèque NX. Il n'est ni un alias de Films ni une
 * copie du catalogue : une même grille réutilisée expose l'inventaire Films
 * et Séries avec un sélecteur explicite, comme le rôle « Bibliothèque » de la
 * navigation Android de référence.
 */
@Composable
fun LibraryHubScreen(
    viewModel: AppViewModel,
    onOpenTitle: (String, Int) -> Unit,
    entryFocusRequester: FocusRequester,
    onScrollChanged: (Boolean) -> Unit,
) {
    var mediaType by rememberSaveable { mutableStateOf(HomeTab.MOVIES) }
    CatalogScreen(
        viewModel = viewModel,
        type = mediaType,
        onOpenTitle = onOpenTitle,
        entryFocusRequester = entryFocusRequester,
        activeHubTab = mediaType,
        onSelectHubTab = { mediaType = it },
        onScrollChanged = onScrollChanged,
    )
}

@Composable
private fun LibraryTypeTabs(
    selected: HomeTab,
    onSelect: (HomeTab) -> Unit,
    firstFocusRequester: FocusRequester,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        listOf(HomeTab.MOVIES, HomeTab.SERIES).forEachIndexed { index, type ->
            val active = selected == type
            var focused by androidx.compose.runtime.remember { mutableStateOf(false) }
            val shape = androidx.compose.foundation.shape.RoundedCornerShape(18.dp)
            Surface(
                onClick = { onSelect(type) },
                modifier = Modifier
                    .let { if (index == 0) it.focusRequester(firstFocusRequester) else it }
                    .onFocusChanged { focused = it.isFocused }
                    .tvPointerClick { onSelect(type) },
                shape = ClickableSurfaceDefaults.shape(shape),
                colors = ClickableSurfaceDefaults.colors(
                    containerColor = if (active) MovvizBrand2.copy(alpha = .88f) else Color.White.copy(alpha = .07f),
                    focusedContainerColor = if (active) MovvizBrand2 else Color.White.copy(alpha = .16f),
                    contentColor = if (active) Color.White else MovvizInkSoft,
                    focusedContentColor = Color.White,
                ),
                border = ClickableSurfaceDefaults.border(
                    focusedBorder = Border(border = androidx.compose.foundation.BorderStroke(2.dp, Color.White.copy(alpha = .8f)), shape = shape),
                ),
            ) {
                Text(
                    text = type.label,
                    style = TextStyle(fontSize = 14.sp, fontWeight = if (active) FontWeight.Bold else FontWeight.SemiBold),
                    modifier = Modifier.padding(horizontal = 18.dp, vertical = 9.dp),
                )
            }
        }
    }
}
