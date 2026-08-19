package com.movviz.tv.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
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
import com.movviz.tv.ui.theme.MovvizWordmark
import com.movviz.tv.ui.theme.tvPointerClick

enum class HomeTab(val label: String) {
    HOME("Accueil"),
    MOVIES("Films"),
    SERIES("Séries"),
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
fun NavRail(
    selected: HomeTab,
    onSelect: (HomeTab) -> Unit,
    searchOpen: Boolean = false,
    searchQuery: String = "",
    onSearchToggle: () -> Unit = {},
    onSearchQueryChange: (String) -> Unit = {},
    modifier: Modifier = Modifier,
) {
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
        // Preset `sm` du Sidebar desktop : outer 40, mark 40, wordmark animé.
        AnimatedLogo(size = 40.dp)
        Spacer(modifier = Modifier.width(10.dp))
        MovvizWordmark(fontSize = 18.sp)

        Spacer(modifier = Modifier.width(56.dp))

        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            HomeTab.entries.forEach { tab ->
                TopNavItem(tab = tab, active = tab == selected, onClick = { onSelect(tab) })
            }
        }

        Spacer(modifier = Modifier.weight(1f))
        SearchButton(
            open = searchOpen,
            query = searchQuery,
            onToggle = onSearchToggle,
            onQueryChange = onSearchQueryChange,
        )
        Spacer(modifier = Modifier.width(22.dp))
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
                maxLines = 1,
            )
        }
    }
}

@Composable
private fun SearchButton(open: Boolean, query: String, onToggle: () -> Unit, onQueryChange: (String) -> Unit) {
    var focused by remember { mutableStateOf(false) }
    val inputRequester = remember { FocusRequester() }
    LaunchedEffect(open) { if (open) inputRequester.requestFocus() }
    val shape = androidx.compose.foundation.shape.RoundedCornerShape(22.dp)
    Surface(
        onClick = onToggle,
        modifier = Modifier.onFocusChanged { focused = it.isFocused }.tvPointerClick(onToggle),
        shape = ClickableSurfaceDefaults.shape(shape),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = if (open) Color.White.copy(alpha = .14f) else Color.Transparent,
            focusedContainerColor = Color.White.copy(alpha = .10f),
        ),
        border = ClickableSurfaceDefaults.border(
            focusedBorder = androidx.tv.material3.Border(
                border = androidx.compose.foundation.BorderStroke(2.dp, Color.White.copy(alpha = .65f)),
                shape = shape,
            ),
        ),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp)) {
            Canvas(Modifier.size(24.dp)) {
                drawCircle(Color.White, radius = 7.dp.toPx(), center = androidx.compose.ui.geometry.Offset(9.dp.toPx(), 9.dp.toPx()), style = androidx.compose.ui.graphics.drawscope.Stroke(width = 2.dp.toPx()))
                drawLine(Color.White, androidx.compose.ui.geometry.Offset(14.dp.toPx(), 14.dp.toPx()), androidx.compose.ui.geometry.Offset(21.dp.toPx(), 21.dp.toPx()), strokeWidth = 2.dp.toPx())
            }
            if (open) {
                Spacer(Modifier.width(8.dp))
                BasicTextField(
                    value = query,
                    onValueChange = onQueryChange,
                    singleLine = true,
                    textStyle = TextStyle(fontSize = 16.sp, color = Color.White),
                    modifier = Modifier.width(180.dp).focusRequester(inputRequester),
                )
            }
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
        // focusedContainerColor explicite : sans ça, androidx.tv.material3
        // retombe sur son gris/blanc quasi opaque par défaut dès que l'item
        // garde le focus D-pad, écrasant notre teinte discrète et rendant le
        // libellé illisible ("gros bouton blanc" constaté en direct — le
        // focus initial reste sur "Accueil" tant que rien n'a bougé).
        colors = ClickableSurfaceDefaults.colors(
            containerColor = if (active) Color.White.copy(alpha = 0.17f) else Color.Transparent,
            focusedContainerColor = if (active) Color.White.copy(alpha = 0.22f) else Color.White.copy(alpha = 0.09f),
            pressedContainerColor = Color.White.copy(alpha = 0.22f),
            contentColor = if (active) Color.White else MovvizInkDim,
            focusedContentColor = Color.White,
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
