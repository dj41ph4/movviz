package com.movviz.tv.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import com.movviz.tv.ui.theme.MovvizBrand
import com.movviz.tv.ui.theme.MovvizBrand2
import com.movviz.tv.ui.theme.MovvizInkDim
import com.movviz.tv.ui.theme.AnimatedLogo
import com.movviz.tv.ui.theme.tvPointerClick

enum class HomeTab(val label: String) {
    HOME("Accueil"),
    SEARCH("Recherche"),
    SETTINGS("Paramètres"),
}

/**
 * Barre de navigation horizontale en haut — même composition que le lanceur
 * Netflix : wordmark compact à gauche, libellés texte à plat, et un seul
 * voile très léger qui laisse le hero vivre derrière. L'onglet actif est un
 * aplat neutre discret ; le focus D-pad garde seul une bordure nette.
 */
@Composable
fun NavRail(selected: HomeTab, onSelect: (HomeTab) -> Unit, modifier: Modifier = Modifier) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = modifier
            .fillMaxWidth()
            .height(68.dp)
            .background(
                Brush.verticalGradient(
                    listOf(
                        Color(0xFF090911).copy(alpha = 0.66f),
                        Color(0xFF090911).copy(alpha = 0.08f),
                    ),
                ),
            )
            .drawBehind {
                drawLine(
                    color = Color.White.copy(alpha = 0.055f),
                    start = androidx.compose.ui.geometry.Offset(0f, size.height),
                    end = androidx.compose.ui.geometry.Offset(size.width, size.height),
                    strokeWidth = 1.dp.toPx(),
                )
            }
            .padding(horizontal = 34.dp),
    ) {
        // Même logo animé que l'accueil/login : halo, ondes et particules
        // font partie de l'identité Movviz, ce n'est pas une icône carrée.
        AnimatedLogo(size = 30.dp)
        Spacer(modifier = Modifier.width(4.dp))
        Row {
            Text(text = "Mov", style = TextStyle(fontSize = 20.sp, fontWeight = FontWeight.Black, color = Color.White))
            Text(
                text = "viz",
                style = TextStyle(fontSize = 20.sp, fontWeight = FontWeight.Black, brush = Brush.horizontalGradient(listOf(MovvizBrand, MovvizBrand2))),
            )
        }

        Spacer(modifier = Modifier.width(56.dp))

        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            HomeTab.entries.forEach { tab ->
                TopNavItem(tab = tab, active = tab == selected, onClick = { onSelect(tab) })
            }
        }

        Spacer(modifier = Modifier.weight(1f))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(7.dp)
                    .background(Color(0xFF43E6A0), androidx.compose.foundation.shape.CircleShape),
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = "MOVVIZ TV",
                style = TextStyle(
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = MovvizInkDim,
                    letterSpacing = 1.4.sp,
                ),
            )
        }
    }
}

@Composable
private fun TopNavItem(tab: HomeTab, active: Boolean, onClick: () -> Unit) {
    var focused by remember { mutableStateOf(false) }
    val shape = androidx.compose.foundation.shape.RoundedCornerShape(18.dp)

    Surface(
        onClick = onClick,
        modifier = Modifier
            .onFocusChanged { focused = it.isFocused }
            .tvPointerClick(onClick),
        shape = ClickableSurfaceDefaults.shape(shape = shape),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = if (active) Color.White.copy(alpha = 0.17f) else if (focused) Color.White.copy(alpha = 0.09f) else Color.Transparent,
            contentColor = if (active) Color.White else MovvizInkDim,
        ),
        border = ClickableSurfaceDefaults.border(
            focusedBorder = androidx.tv.material3.Border(
                border = androidx.compose.foundation.BorderStroke(2.dp, Color.White.copy(alpha = 0.6f)),
                shape = shape,
            ),
        ),
    ) {
        Text(
            text = tab.label,
            style = TextStyle(
                fontSize = 15.sp,
                fontWeight = if (active) FontWeight.Bold else FontWeight.SemiBold,
                color = if (active) Color.White else MovvizInkDim,
            ),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(horizontal = 18.dp, vertical = 11.dp),
        )
    }
}
