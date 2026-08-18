package com.movviz.tv.ui.home

import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
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
import com.movviz.tv.ui.theme.MovvizInk
import com.movviz.tv.ui.theme.MovvizInkDim
import com.movviz.tv.ui.theme.tvPointerClick

enum class HomeTab(val label: String, val icon: ImageVector) {
    HOME("Accueil", Icons.Filled.Home),
    SEARCH("Recherche", Icons.Filled.Search),
    SETTINGS("Paramètres", Icons.Filled.Settings),
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
    val width by animateDpAsState(
        targetValue = if (railFocused) 224.dp else 96.dp,
        animationSpec = tween(220),
        label = "navRailWidth",
    )

    // Glass léger avec bordure droite subtile — même trio surface/bordure que
    // les panneaux desktop (voir "glass" dans CLAUDE.md), pas un aplat noir.
    Column(
        modifier = Modifier
            .fillMaxHeight()
            .width(width)
            .background(Color(0xFF0E0E18).copy(alpha = 0.72f))
            .drawBehind {
                drawLine(
                    color = Color.White.copy(alpha = 0.08f),
                    start = androidx.compose.ui.geometry.Offset(size.width, 0f),
                    end = androidx.compose.ui.geometry.Offset(size.width, size.height),
                    strokeWidth = 1.dp.toPx(),
                )
            }
            .padding(vertical = 28.dp, horizontal = 14.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Box(modifier = Modifier.padding(bottom = 28.dp, start = 6.dp)) {
            AnimatedLogo(size = 30.dp)
        }
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
    val shape = RoundedCornerShape(14.dp)
    val brandGradient = Brush.horizontalGradient(listOf(MovvizBrand, MovvizBrand2))

    Surface(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .onFocusChanged {
                focused = it.isFocused
                onFocusChange(it.isFocused)
            }
            .tvPointerClick(onClick),
        shape = ClickableSurfaceDefaults.shape(shape = shape),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = when {
                focused -> Color.Transparent
                active -> Color.White.copy(alpha = 0.08f)
                else -> Color.Transparent
            },
            contentColor = if (active) MovvizInk else MovvizInkDim,
        ),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .let { if (focused) it.background(brandGradient, shape) else it }
                .padding(horizontal = 14.dp, vertical = 13.dp),
        ) {
            Image(
                imageVector = tab.icon,
                contentDescription = tab.label,
                colorFilter = ColorFilter.tint(if (focused) Color.White else if (active) MovvizInk else MovvizInkDim),
                modifier = Modifier.size(20.dp),
            )
            if (expanded) {
                Spacer(modifier = Modifier.width(14.dp))
                Text(
                    text = tab.label,
                    style = TextStyle(
                        fontSize = 14.sp,
                        fontWeight = if (active || focused) FontWeight.Bold else FontWeight.Medium,
                        color = if (focused) Color.White else if (active) MovvizInk else MovvizInkDim,
                    ),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}
