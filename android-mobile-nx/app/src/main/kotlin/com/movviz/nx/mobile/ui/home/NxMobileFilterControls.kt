package com.movviz.nx.mobile.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupProperties
import androidx.tv.material3.Border
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.Icon
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import com.movviz.nx.mobile.ui.theme.MovvizBrand
import com.movviz.nx.mobile.ui.theme.MovvizIconChevronDown
import com.movviz.nx.mobile.ui.theme.MovvizInkSoft
import com.movviz.nx.mobile.ui.theme.MovvizSurface
import com.movviz.nx.mobile.ui.theme.MovvizSurfaceStrong
import com.movviz.nx.mobile.ui.theme.tvPointerClick

/**
 * Pilule segmentée Découverte / Films / Séries — contrôle SECONDAIRE dans la
 * page (esquisse mobile 2026-09), distinct de la barre de navigation basse à
 * 5 entrées qui reste inchangée. L'onglet actif porte le dégradé de marque
 * plein, les deux autres restent plats/translucides.
 */
@Composable
fun MediaHubSegmentedPills(
    active: HomeTab,
    onSelect: (HomeTab) -> Unit,
    modifier: Modifier = Modifier,
) {
    val items = listOf(HomeTab.DISCOVER to "Découverte", HomeTab.MOVIES to "Films", HomeTab.SERIES to "Séries")
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(MovvizSurface.copy(alpha = 0.7f), RoundedCornerShape(30.dp))
            .padding(4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        items.forEach { (tab, label) ->
            val isActive = active == tab
            Surface(
                onClick = { onSelect(tab) },
                modifier = Modifier.weight(1f).height(36.dp).tvPointerClick { onSelect(tab) },
                shape = ClickableSurfaceDefaults.shape(RoundedCornerShape(26.dp)),
                colors = ClickableSurfaceDefaults.colors(
                    containerColor = Color.Transparent,
                    focusedContainerColor = Color.White.copy(alpha = 0.10f),
                    contentColor = if (isActive) Color.White else MovvizInkSoft,
                    focusedContentColor = Color.White,
                ),
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .then(
                            if (isActive) Modifier.background(Brush.linearGradient(listOf(MovvizBrand, com.movviz.nx.mobile.ui.theme.MovvizBrand2)), RoundedCornerShape(26.dp))
                            else Modifier,
                        ),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = label,
                        fontSize = 13.sp,
                        fontWeight = if (isActive) FontWeight.Bold else FontWeight.SemiBold,
                        color = Color.White,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }
    }
}

/**
 * Ligne de pilules-filtre compactes avec chevron ("Genres", "Humeur",
 * "Durée", "Plateformes" dans l'esquisse) — chaque pilule ouvre un petit
 * menu déroulant réel plutôt qu'un simple bouton décoratif.
 */
@Composable
fun FilterChipRow(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) { content() }
}

/**
 * Une pilule de filtre avec menu déroulant. `options` sont des libellés
 * réels (genres TMDb déjà chargés, plateformes déjà chargées, etc.) —
 * jamais une donnée inventée. `selectedLabel` non-null affiche la valeur
 * choisie à la place du libellé générique et teinte la pilule.
 */
@Composable
fun FilterDropdownChip(
    label: String,
    options: List<String>,
    onSelectOption: (String) -> Unit,
    modifier: Modifier = Modifier,
    selectedLabel: String? = null,
    onClear: (() -> Unit)? = null,
) {
    var open by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(18.dp)
    Box(modifier = modifier) {
        Surface(
            onClick = { open = true },
            modifier = Modifier.height(34.dp).tvPointerClick { open = true },
            shape = ClickableSurfaceDefaults.shape(shape),
            colors = ClickableSurfaceDefaults.colors(
                containerColor = if (selectedLabel != null) MovvizBrand.copy(alpha = 0.24f) else Color.White.copy(alpha = 0.07f),
                focusedContainerColor = Color.White.copy(alpha = 0.16f),
                contentColor = Color.White,
                focusedContentColor = Color.White,
            ),
            border = ClickableSurfaceDefaults.border(
                focusedBorder = Border(border = androidx.compose.foundation.BorderStroke(2.dp, Color.White.copy(alpha = 0.75f)), shape = shape),
            ),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(horizontal = 12.dp),
            ) {
                Text(
                    text = selectedLabel ?: label,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.White,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.widthIn(max = 92.dp),
                )
                Spacer(Modifier.width(4.dp))
                Icon(
                    imageVector = MovvizIconChevronDown,
                    contentDescription = null,
                    tint = Color.White.copy(alpha = 0.7f),
                    modifier = Modifier.width(12.dp).height(12.dp),
                )
            }
        }
        if (open) {
            Popup(
                alignment = Alignment.TopStart,
                properties = PopupProperties(focusable = true),
                onDismissRequest = { open = false },
            ) {
                Column(
                    modifier = Modifier
                        .padding(top = 40.dp)
                        .widthIn(min = 170.dp, max = 240.dp)
                        .background(MovvizSurfaceStrong, RoundedCornerShape(14.dp))
                        .padding(6.dp),
                ) {
                    if (selectedLabel != null && onClear != null) {
                        FilterPopupItem(label = "Réinitialiser") { open = false; onClear() }
                    }
                    options.forEach { opt ->
                        FilterPopupItem(label = opt, active = opt == selectedLabel) { open = false; onSelectOption(opt) }
                    }
                }
            }
        }
    }
}

@Composable
private fun FilterPopupItem(label: String, active: Boolean = false, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth().height(42.dp).tvPointerClick(onClick),
        shape = ClickableSurfaceDefaults.shape(RoundedCornerShape(9.dp)),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = if (active) MovvizBrand.copy(alpha = 0.22f) else Color.Transparent,
            focusedContainerColor = Color.White.copy(alpha = 0.12f),
            contentColor = Color.White,
            focusedContentColor = Color.White,
        ),
    ) {
        Text(
            text = label,
            fontSize = 13.sp,
            color = Color.White,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 11.dp),
        )
    }
}
