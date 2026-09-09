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
import com.movviz.nx.mobile.ui.discover.DiscoverScreen
import com.movviz.nx.mobile.ui.theme.MovvizBrand2
import com.movviz.nx.mobile.ui.theme.MovvizInkSoft
import com.movviz.nx.mobile.ui.theme.tvPointerClick

private enum class DiscoverContext(val label: String) {
    DISCOVER("Découverte"), MOVIES("Films"), SERIES("Séries"),
}

/** Shell de découverte NX : les trois contextes de l'esquisse #4 sont un
 * choix interne à Découvrir, pas une seconde barre de navigation. */
@Composable
fun DiscoverHubScreen(
    viewModel: AppViewModel,
    onOpenTitle: (String, Int) -> Unit,
    onSeeAllRow: (String, String, String) -> Unit,
    onOpenGenre: (String, String, String) -> Unit,
    entryFocusRequester: FocusRequester,
    onScrollChanged: (Boolean) -> Unit,
) {
    var context by rememberSaveable { mutableStateOf(DiscoverContext.DISCOVER) }
    val fixedType = when (context) {
        DiscoverContext.DISCOVER -> null
        DiscoverContext.MOVIES -> HomeTab.MOVIES
        DiscoverContext.SERIES -> HomeTab.SERIES
    }
    DiscoverScreen(
        viewModel = viewModel,
        onOpenTitle = onOpenTitle,
        onSeeAllRow = onSeeAllRow,
        onOpenGenre = onOpenGenre,
        entryFocusRequester = entryFocusRequester,
        fixedType = fixedType,
        contextHeader = {
            DiscoverContextTabs(
                selected = context,
                onSelect = { context = it },
                firstFocusRequester = entryFocusRequester,
            )
        },
        onScrollChanged = onScrollChanged,
    )
}

@Composable
private fun DiscoverContextTabs(
    selected: DiscoverContext,
    onSelect: (DiscoverContext) -> Unit,
    firstFocusRequester: FocusRequester,
) {
    Row(
        modifier = Modifier.padding(start = 16.dp, top = 74.dp, bottom = 18.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        DiscoverContext.entries.forEachIndexed { index, context ->
            val active = selected == context
            var focused by androidx.compose.runtime.remember { mutableStateOf(false) }
            val shape = androidx.compose.foundation.shape.RoundedCornerShape(18.dp)
            Surface(
                onClick = { onSelect(context) },
                modifier = Modifier
                    .let { if (index == 0) it.focusRequester(firstFocusRequester) else it }
                    .onFocusChanged { focused = it.isFocused }
                    .tvPointerClick { onSelect(context) },
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
                    text = context.label,
                    style = TextStyle(fontSize = 13.sp, fontWeight = if (active) FontWeight.Bold else FontWeight.SemiBold),
                    modifier = Modifier.padding(horizontal = 15.dp, vertical = 9.dp),
                )
            }
        }
    }
}
