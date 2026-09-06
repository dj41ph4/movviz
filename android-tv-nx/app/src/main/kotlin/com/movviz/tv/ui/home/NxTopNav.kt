package com.movviz.tv.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import com.movviz.tv.data.TvProfile

/** Navigation NX: très peu de chrome, sans réserver une colonne au contenu. */
@Composable
fun NxTopNav(
    selected: HomeTab,
    onSelect: (HomeTab) -> Unit,
    searchOpen: Boolean = false,
    searchQuery: String = "",
    onSearchToggle: () -> Unit = {},
    onSearchQueryChange: (String) -> Unit = {},
    profiles: List<TvProfile> = emptyList(),
    activeProfile: TvProfile? = null,
    onProfileSelected: (TvProfile) -> Unit = {},
    onAddProfile: () -> Unit = {},
    onOpenProfile: () -> Unit = {},
    onSwitchProfile: () -> Unit = {},
    updateAvailableTag: String? = null,
    onUpdateClick: () -> Unit = {},
    contentFocusRequester: FocusRequester? = null,
    fallbackFocusRequester: FocusRequester? = null,
    navRailFocusRequester: FocusRequester? = null,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .padding(top = 22.dp, start = 56.dp, end = 56.dp)
            .background(Color(0xB3111217), RoundedCornerShape(28.dp))
            .padding(horizontal = 20.dp, vertical = 10.dp)
            .wrapContentWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text("MOVVIZ", color = Color.White, fontSize = 17.sp, modifier = Modifier.padding(end = 16.dp, top = 8.dp))
        listOf(HomeTab.HOME, HomeTab.SERIES, HomeTab.MOVIES, HomeTab.PROFILE).forEach { tab ->
            val active = selected == tab
            Surface(
                onClick = { onSelect(tab) },
                modifier = Modifier
                    .let { if (tab == selected && navRailFocusRequester != null) it.focusRequester(navRailFocusRequester) else it }
                    .height(38.dp),
                shape = androidx.tv.material3.ClickableSurfaceDefaults.shape(RoundedCornerShape(19.dp)),
                colors = androidx.tv.material3.ClickableSurfaceDefaults.colors(
                    containerColor = if (active) Color(0xFF2A2B31) else Color.Transparent,
                    focusedContainerColor = Color(0xFF3A3B42),
                ),
            ) {
                Text(tab.label, color = Color.White, fontSize = 15.sp, modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp))
            }
        }
        Surface(onClick = onSearchToggle, modifier = Modifier.height(38.dp), shape = androidx.tv.material3.ClickableSurfaceDefaults.shape(RoundedCornerShape(19.dp))) {
            Text("⌕", color = Color.White, fontSize = 23.sp, modifier = Modifier.padding(horizontal = 13.dp, vertical = 2.dp))
        }
        Surface(onClick = onOpenProfile, modifier = Modifier.height(38.dp), shape = androidx.tv.material3.ClickableSurfaceDefaults.shape(RoundedCornerShape(19.dp))) {
            Text(activeProfile?.name?.take(2)?.uppercase() ?: "MO", color = Color.White, fontSize = 13.sp, modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp))
        }
    }
}
