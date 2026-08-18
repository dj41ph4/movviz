package com.movviz.tv.ui.home

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import com.movviz.tv.ui.theme.AnimatedLogo
import com.movviz.tv.ui.theme.MovvizBrand
import com.movviz.tv.ui.theme.MovvizBrand2
import com.movviz.tv.ui.theme.MovvizInkDim
import com.movviz.tv.ui.theme.MovvizWordmark
import com.movviz.tv.ui.theme.tvPointerClick

enum class HomeTab(val label: String, val icon: ImageVector) {
    HOME("Accueil", Icons.Filled.Home),
    SEARCH("Recherche", Icons.Filled.Search),
    SETTINGS("Paramètres", Icons.Filled.Settings),
}

/**
 * Rail de navigation persistant à gauche — toujours déplié avec les
 * libellés visibles (comme la sidebar desktop, jamais un rail réduit aux
 * icônes seules) : sur un remote, il n'y a pas de survol souris pour
 * "révéler" un libellé caché, donc le collapse-to-icon du desktop (pensé
 * pour gagner de la place sur un clic) n'a pas de sens ici.
 */
@Composable
fun NavRail(selected: HomeTab, onSelect: (HomeTab) -> Unit) {
    // Glass léger avec bordure droite subtile — même trio surface/bordure que
    // les panneaux desktop (voir "glass" dans CLAUDE.md), pas un aplat noir.
    Column(
        modifier = Modifier
            .fillMaxHeight()
            .width(240.dp)
            .background(Color(0xFF0E0E18).copy(alpha = 0.72f))
            .drawBehind {
                drawLine(
                    color = Color.White.copy(alpha = 0.08f),
                    start = androidx.compose.ui.geometry.Offset(size.width, 0f),
                    end = androidx.compose.ui.geometry.Offset(size.width, size.height),
                    strokeWidth = 1.dp.toPx(),
                )
            }
            .padding(vertical = 28.dp, horizontal = 16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(bottom = 32.dp, start = 4.dp)) {
            AnimatedLogo(size = 30.dp)
            Spacer(modifier = Modifier.width(10.dp))
            MovvizWordmark(fontSize = 20.sp)
        }
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            HomeTab.entries.forEach { tab ->
                RailItem(
                    tab = tab,
                    active = tab == selected,
                    onClick = { onSelect(tab) },
                )
            }
        }
        Spacer(modifier = Modifier.weight(1f))
        Text(
            text = "Movviz TV",
            style = TextStyle(fontSize = 11.sp, color = MovvizInkDim),
            modifier = Modifier.padding(start = 4.dp),
        )
    }
}

@Composable
private fun RailItem(tab: HomeTab, active: Boolean, onClick: () -> Unit) {
    var focused by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(50)
    val brandGradient = Brush.horizontalGradient(listOf(MovvizBrand, MovvizBrand2))

    Surface(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .onFocusChanged { focused = it.isFocused }
            .tvPointerClick(onClick),
        shape = ClickableSurfaceDefaults.shape(shape = shape),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = Color.Transparent,
            contentColor = if (active) Color.White else MovvizInkDim,
        ),
        border = ClickableSurfaceDefaults.border(
            focusedBorder = androidx.tv.material3.Border(
                border = androidx.compose.foundation.BorderStroke(2.dp, Color.White.copy(alpha = 0.6f)),
                shape = shape,
            ),
        ),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                // Pastille pleine en dégradé de marque pour l'onglet actif —
                // même traitement que le point violet de la sidebar desktop,
                // pas juste un léger changement d'opacité.
                .let { if (active) it.background(brandGradient, shape) else it }
                .padding(horizontal = 16.dp, vertical = 13.dp),
        ) {
            Image(
                imageVector = tab.icon,
                contentDescription = tab.label,
                colorFilter = ColorFilter.tint(if (active) Color.White else MovvizInkDim),
                modifier = Modifier.size(20.dp),
            )
            Spacer(modifier = Modifier.width(14.dp))
            Text(
                text = tab.label,
                style = TextStyle(
                    fontSize = 15.sp,
                    fontWeight = if (active) FontWeight.Bold else FontWeight.Medium,
                    color = if (active) Color.White else MovvizInkDim,
                ),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}
