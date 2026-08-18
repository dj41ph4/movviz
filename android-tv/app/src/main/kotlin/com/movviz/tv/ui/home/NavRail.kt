package com.movviz.tv.ui.home

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
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
import com.movviz.tv.ui.theme.MovvizBrand
import com.movviz.tv.ui.theme.MovvizBrand2
import com.movviz.tv.ui.theme.MovvizInkDim
import com.movviz.tv.ui.theme.StaticLogo
import com.movviz.tv.ui.theme.tvPointerClick

enum class HomeTab(val label: String, val icon: ImageVector) {
    HOME("Accueil", Icons.Outlined.Home),
    SEARCH("Recherche", Icons.Outlined.Search),
    SETTINGS("Paramètres", Icons.Outlined.Settings),
}

/**
 * Barre de navigation horizontale en haut — même composition que le lanceur
 * système Android TV (mic/Search, Home, Shop, Discover, Apps : items texte
 * à plat, soulignement fin pour l'onglet actif, aucun fond ni pastille) :
 * demandé explicitement après que le rail latéral en pastilles/pilules ait
 * été jugé "moche" à plusieurs reprises. Logo + wordmark à gauche, items à
 * plat ensuite — jamais de rail vertical replié sur lui-même à droite.
 */
@Composable
fun NavRail(selected: HomeTab, onSelect: (HomeTab) -> Unit, modifier: Modifier = Modifier) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = modifier
            .fillMaxWidth()
            .height(80.dp)
            .background(
                Brush.verticalGradient(
                    listOf(
                        Color(0xFF090911).copy(alpha = 0.74f),
                        Color(0xFF090911).copy(alpha = 0.38f),
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
            .padding(horizontal = 36.dp),
    ) {
        StaticLogo(size = 32.dp)
        Spacer(modifier = Modifier.width(11.dp))
        Column {
            Row {
                Text(
                    text = "Mov",
                    style = TextStyle(fontSize = 18.sp, fontWeight = FontWeight.Black, color = Color.White),
                )
                Text(
                    text = "viz",
                    style = TextStyle(
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Black,
                        brush = Brush.horizontalGradient(listOf(MovvizBrand, MovvizBrand2)),
                    ),
                )
            }
            Text(
                text = "MEDIA CORE",
                style = TextStyle(fontSize = 7.5.sp, fontWeight = FontWeight.SemiBold, color = MovvizInkDim, letterSpacing = 1.2.sp),
            )
        }

        Spacer(modifier = Modifier.width(64.dp))

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
    val shape = androidx.compose.foundation.shape.RoundedCornerShape(12.dp)

    Surface(
        onClick = onClick,
        modifier = Modifier
            .onFocusChanged { focused = it.isFocused }
            .tvPointerClick(onClick),
        shape = ClickableSurfaceDefaults.shape(shape = shape),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = if (focused) Color.White.copy(alpha = 0.08f) else Color.Transparent,
            contentColor = if (active) Color.White else MovvizInkDim,
        ),
        border = ClickableSurfaceDefaults.border(
            focusedBorder = androidx.tv.material3.Border(
                border = androidx.compose.foundation.BorderStroke(2.dp, Color.White.copy(alpha = 0.6f)),
                shape = shape,
            ),
        ),
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(horizontal = 15.dp, vertical = 12.dp),
            ) {
                Image(
                    imageVector = tab.icon,
                    contentDescription = null,
                    colorFilter = ColorFilter.tint(if (active) Color.White else MovvizInkDim),
                    modifier = Modifier.size(16.dp),
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = tab.label,
                    style = TextStyle(
                        fontSize = 15.sp,
                        fontWeight = if (active) FontWeight.SemiBold else FontWeight.Normal,
                        color = if (active) Color.White else MovvizInkDim,
                    ),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            // Indicateur court plutôt qu'une ligne qui occupe toute la largeur
            // disponible : le regard reste sur l'onglet actif, comme dans une
            // barre tvOS, sans transformer la navigation en tableau de bord.
            Box(
                modifier = Modifier
                    .width(34.dp)
                    .height(3.dp)
                    .clip(androidx.compose.foundation.shape.RoundedCornerShape(50))
                    .background(
                        if (active) Brush.horizontalGradient(listOf(MovvizBrand, MovvizBrand2))
                        else Brush.horizontalGradient(listOf(Color.Transparent, Color.Transparent)),
                    ),
            )
        }
    }
}
