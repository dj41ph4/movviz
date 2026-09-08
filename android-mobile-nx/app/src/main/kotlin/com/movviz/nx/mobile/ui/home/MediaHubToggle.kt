package com.movviz.nx.mobile.ui.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Border
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import com.movviz.nx.mobile.ui.theme.MovvizInkSoft
import com.movviz.nx.mobile.ui.theme.tvPointerClick

/** Les deux vues d'un même univers média. Les suggestions ne sont jamais
 * mélangées au catalogue : Films et Séries gardent chacune leur contexte. */
enum class MediaHubMode { SUGGESTIONS, LIBRARY }

/**
 * Sélecteur unique pour Films et Séries. Il vit dans le flux de la page sous
 * NxTopNav (qui est une surcouche), ce qui évite toute capsule flottante
 * derrière le logo tout en préservant l'ordre D-pad.
 */
@Composable
fun MediaHubToggleRow(
    mode: MediaHubMode,
    onModeChange: (MediaHubMode) -> Unit,
    firstFocusRequester: FocusRequester? = null,
    modifier: Modifier = Modifier,
) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        modifier = modifier,
    ) {
        MediaHubToggleChip(
            label = "Suggestions",
            active = mode == MediaHubMode.SUGGESTIONS,
            onClick = { onModeChange(MediaHubMode.SUGGESTIONS) },
            focusRequester = firstFocusRequester,
        )
        MediaHubToggleChip(
            label = "Bibliothèque",
            active = mode == MediaHubMode.LIBRARY,
            onClick = { onModeChange(MediaHubMode.LIBRARY) },
        )
    }
}

@Composable
private fun MediaHubToggleChip(
    label: String,
    active: Boolean,
    onClick: () -> Unit,
    focusRequester: FocusRequester? = null,
) {
    var focused by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(50)
    Surface(
        onClick = onClick,
        modifier = Modifier
            .then(if (focusRequester != null) Modifier.focusRequester(focusRequester) else Modifier)
            .onFocusChanged { focused = it.isFocused }
            .tvPointerClick(onClick),
        shape = ClickableSurfaceDefaults.shape(shape = shape),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = if (active) Color.White.copy(alpha = 0.20f) else Color.White.copy(alpha = 0.06f),
            focusedContainerColor = Color.White.copy(alpha = 0.26f),
            contentColor = if (active) Color.White else MovvizInkSoft,
            focusedContentColor = Color.White,
        ),
        border = ClickableSurfaceDefaults.border(
            focusedBorder = Border(
                border = androidx.compose.foundation.BorderStroke(2.dp, Color.White.copy(alpha = 0.75f)),
                shape = shape,
            ),
        ),
    ) {
        Text(
            text = label,
            color = if (active || focused) Color.White else MovvizInkSoft,
            fontSize = 15.sp,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 9.dp),
        )
    }
}
