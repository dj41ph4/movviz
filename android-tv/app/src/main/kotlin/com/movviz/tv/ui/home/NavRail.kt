package com.movviz.tv.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Surface
import androidx.tv.material3.Text

enum class HomeTab(val label: String, val glyph: String) {
    HOME("Accueil", "⌂"),
    SEARCH("Recherche", "🔍"),
    SETTINGS("Paramètres", "⚙"),
}

/**
 * Rail de navigation persistant à gauche — étroite (icône seule) au repos,
 * s'élargit pour montrer le libellé dès qu'un de ses items prend le focus,
 * exactement le comportement du rail Netflix Android TV. Contrairement au
 * bas de l'écran, un rail latéral ne consomme jamais l'espace vertical
 * réservé aux rangées de contenu.
 */
@Composable
fun NavRail(selected: HomeTab, onSelect: (HomeTab) -> Unit) {
    var railFocused by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxHeight()
            .width(if (railFocused) 220.dp else 88.dp)
            .background(Color.Black.copy(alpha = 0.35f))
            .padding(vertical = 24.dp, horizontal = 12.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(
            text = "M",
            style = TextStyle(fontSize = 22.sp, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.primary),
            modifier = Modifier.padding(bottom = 24.dp, start = 8.dp),
        )
        HomeTab.entries.forEach { tab ->
            RailItem(
                tab = tab,
                active = tab == selected,
                expanded = railFocused,
                onFocusChange = { railFocused = it },
                onClick = { onSelect(tab) },
            )
        }
    }
}

@Composable
private fun RailItem(tab: HomeTab, active: Boolean, expanded: Boolean, onFocusChange: (Boolean) -> Unit, onClick: () -> Unit) {
    var focused by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(10.dp)

    Surface(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .onFocusChanged {
                focused = it.isFocused
                onFocusChange(it.isFocused)
            },
        shape = ClickableSurfaceDefaults.shape(shape = shape),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = when {
                focused -> MaterialTheme.colorScheme.primary.copy(alpha = 0.25f)
                active -> Color.White.copy(alpha = 0.12f)
                else -> Color.Transparent
            },
            contentColor = Color.White,
        ),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 12.dp),
        ) {
            Text(text = tab.glyph, style = TextStyle(fontSize = 18.sp))
            if (expanded) {
                Spacer(modifier = Modifier.width(12.dp))
                Text(
                    text = tab.label,
                    style = TextStyle(fontSize = 14.sp, fontWeight = if (active) FontWeight.Bold else FontWeight.Normal),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}
