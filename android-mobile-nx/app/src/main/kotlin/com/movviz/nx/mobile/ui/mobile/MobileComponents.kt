package com.movviz.nx.mobile.ui.mobile

import androidx.compose.animation.core.tween
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.Icon
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import com.movviz.nx.mobile.ui.theme.MovvizBrand
import com.movviz.nx.mobile.ui.theme.MovvizBrand2
import com.movviz.nx.mobile.ui.theme.MovvizIconChevronDown
import com.movviz.nx.mobile.ui.theme.MovvizInk
import com.movviz.nx.mobile.ui.theme.MovvizInkDim
import com.movviz.nx.mobile.ui.theme.MovvizInkSoft
import com.movviz.nx.mobile.ui.theme.tvPointerClick

/**
 * `screenWidthDp < 600 && portrait` — la même condition que MainActivity
 * calcule déjà en plusieurs endroits (dupliquée avant ce fichier dans
 * MainActivity.kt, HomeScreen.kt, DiscoverScreen.kt, TitleDetailScreen.kt).
 * Source unique désormais pour tout nouveau code ; les duplications
 * existantes ne sont retouchées qu'au fil des écrans effectivement modifiés.
 */
@Composable
fun rememberCompactPortrait(): Boolean =
    LocalConfiguration.current.let { it.screenWidthDp < 600 && it.screenHeightDp > it.screenWidthDp }

/**
 * Contrôle segmenté pleine largeur (Films|Séries, Watchlist|Historique|
 * Collections, En cours|Terminés…) — piste sombre arrondie, segment actif en
 * dégradé de marque plein, réplique le principe déjà validé de
 * MediaHubToggleChip (ui/home/MediaHubToggle.kt) mais en piste pleine
 * largeur à segments égaux, conforme à l'esquisse mobile (section 9/11).
 */
@Composable
fun MovvizSegmentedControl(
    options: List<String>,
    selectedIndex: Int,
    onSelect: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(50))
            .background(Color.White.copy(alpha = 0.06f))
            .padding(4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        options.forEachIndexed { index, label ->
            val active = index == selectedIndex
            Box(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(50))
                    .then(
                        if (active) Modifier.background(Brush.horizontalGradient(listOf(MovvizBrand, MovvizBrand2)))
                        else Modifier,
                    )
                    .tvPointerClick { onSelect(index) },
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = label,
                    color = if (active) Color.White else MovvizInkSoft,
                    fontSize = 14.sp,
                    fontWeight = if (active) FontWeight.Bold else FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(vertical = 10.dp),
                )
            }
        }
    }
}

/** En-tête de section standard : titre + "Tout voir" optionnel. */
@Composable
fun MovvizSectionHeader(
    title: String,
    modifier: Modifier = Modifier,
    onSeeAll: (() -> Unit)? = null,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = title,
            style = TextStyle(fontSize = 19.sp, fontWeight = FontWeight.Bold, color = MovvizInk),
            modifier = Modifier.weight(1f),
        )
        if (onSeeAll != null) {
            Text(
                text = "Tout voir",
                color = MovvizInkSoft,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.tvPointerClick(onSeeAll).padding(vertical = 4.dp, horizontal = 4.dp),
            )
        }
    }
}

/** État vide honnête — jamais de fausse affiche/faux compteur (charte
 *  section 18). Utilisé quand une section n'a réellement rien à montrer. */
@Composable
fun MovvizEmptyState(
    title: String,
    subtitle: String? = null,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxWidth().padding(vertical = 28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = title,
            color = MovvizInkSoft,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
        )
        if (subtitle != null) {
            Spacer(Modifier.height(4.dp))
            Text(
                text = subtitle,
                color = MovvizInkDim,
                fontSize = 12.sp,
            )
        }
    }
}

/** Rectangle chargement dimensionné à la carte réelle qu'il remplace —
 *  jamais un spinner générique qui fait sauter la mise en page au chargé. */
@Composable
fun MovvizLoadingSkeleton(
    width: androidx.compose.ui.unit.Dp,
    height: androidx.compose.ui.unit.Dp,
    modifier: Modifier = Modifier,
    shape: androidx.compose.ui.graphics.Shape = RoundedCornerShape(10.dp),
) {
    val alpha by animateFloatAsState(targetValue = 0.5f, animationSpec = tween(600), label = "skeleton")
    Box(
        modifier = modifier
            .width(width)
            .height(height)
            .clip(shape)
            .background(Color.White.copy(alpha = 0.06f * alpha * 2f)),
    )
}

/** Puce déroulante (Genres/Durée/Filtres…) — extrait des variantes déjà
 *  dupliquées dans DiscoverScreen.kt/CatalogScreen.kt (FilterChipRow). */
@Composable
fun MovvizDropdownChip(
    label: String,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    Surface(
        onClick = onClick,
        modifier = modifier.tvPointerClick(onClick),
        shape = ClickableSurfaceDefaults.shape(RoundedCornerShape(50)),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = Color.White.copy(alpha = 0.07f),
            focusedContainerColor = Color.White.copy(alpha = 0.16f),
            contentColor = MovvizInkSoft,
            focusedContentColor = Color.White,
        ),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 9.dp),
        ) {
            Text(text = label, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.width(4.dp))
            Icon(imageVector = MovvizIconChevronDown, contentDescription = null, modifier = Modifier.size(14.dp))
        }
    }
}

/** Barre de progression fine (téléchargements, reprise de lecture) — un
 *  seul composant réutilisable plutôt qu'un Box(fillMaxWidth(fraction)) par
 *  écran (dupliqué aujourd'hui dans HomeScreen/DownloadsScreen). */
@Composable
fun MovvizProgressBar(
    progress: Float,
    modifier: Modifier = Modifier,
    trackColor: Color = Color.White.copy(alpha = 0.12f),
    brush: Brush = Brush.horizontalGradient(listOf(MovvizBrand, MovvizBrand2)),
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(4.dp)
            .clip(RoundedCornerShape(2.dp))
            .background(trackColor),
    ) {
        Box(
            modifier = Modifier
                .fillMaxHeight()
                .fillMaxWidth(fraction = progress.coerceIn(0f, 1f))
                .clip(RoundedCornerShape(2.dp))
                .background(brush),
        )
    }
}

/** Rail "Plateformes" de l'accueil portrait (esquisse mobile section 8 :
 *  "sous forme de logos carrés") — icônes carrées uniformes, pas les puces
 *  arrondies à largeur variable de DiscoverLogoRow (réservées à Découverte/
 *  TV, esquisse Accueil différente : "logos carrés" explicitement demandé
 *  dans le brief, corrigé après un premier essai qui réutilisait la puce TV
 *  à tort). */
@Composable
fun MovvizPlatformRow(
    tiles: List<com.movviz.nx.mobile.data.LogoTileDto>,
    onSelect: (com.movviz.nx.mobile.data.LogoTileDto) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        tiles.forEach { tile -> MovvizPlatformTile(tile = tile, onClick = { onSelect(tile) }) }
    }
}

@Composable
private fun MovvizPlatformTile(
    tile: com.movviz.nx.mobile.data.LogoTileDto,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(16.dp)
    Box(
        modifier = Modifier
            .size(60.dp)
            .clip(shape)
            .background(Color.White.copy(alpha = 0.97f))
            .tvPointerClick(onClick)
            .padding(10.dp),
        contentAlignment = Alignment.Center,
    ) {
        if (tile.logoPath != null) {
            coil.compose.SubcomposeAsyncImage(
                model = "https://image.tmdb.org/t/p/w200${tile.logoPath}",
                contentDescription = tile.name,
                contentScale = androidx.compose.ui.layout.ContentScale.Fit,
                modifier = Modifier.fillMaxSize(),
                loading = { PlatformTileFallback(tile.name) },
                error = { PlatformTileFallback(tile.name) },
            )
        } else {
            PlatformTileFallback(tile.name)
        }
    }
}

@Composable
private fun PlatformTileFallback(name: String) {
    Text(
        text = name.take(2).uppercase(),
        color = Color(0xFF1A1A1A),
        fontSize = 13.sp,
        fontWeight = FontWeight.Bold,
        maxLines = 1,
    )
}
