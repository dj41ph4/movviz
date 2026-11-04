package com.movviz.nx.mobile.ui.home

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Text
import com.movviz.nx.mobile.R
import com.movviz.nx.mobile.data.TvProfile
import com.movviz.nx.mobile.ui.theme.MovvizBrand
import com.movviz.nx.mobile.ui.theme.MovvizBrand2
import com.movviz.nx.mobile.ui.theme.MovvizElectricBorder
import com.movviz.nx.mobile.ui.theme.MovvizIconBookmark
import com.movviz.nx.mobile.ui.theme.MovvizIconCompass
import com.movviz.nx.mobile.ui.theme.MovvizIconDownload
import com.movviz.nx.mobile.ui.theme.MovvizIconHome
import com.movviz.nx.mobile.ui.theme.MovvizIconSearch
import com.movviz.nx.mobile.ui.theme.MovvizIconSettings
import com.movviz.nx.mobile.ui.theme.MovvizCyan
import com.movviz.nx.mobile.ui.theme.MovvizPage
import com.movviz.nx.mobile.ui.theme.MovvizRadius
import com.movviz.nx.mobile.ui.theme.MovvizWindowClass
import com.movviz.nx.mobile.ui.theme.isLargeTouch
import com.movviz.nx.mobile.ui.theme.rememberMovvizWindowClass
import com.movviz.nx.mobile.ui.theme.MovvizSurface
import com.movviz.nx.mobile.ui.theme.hapticClickable

/**
 * Mode déplié / paysage large (maquette "MOVVIZ NX / MODE DÉPLIÉ") :
 * rail tactile gauche + contenu central existant.
 *
 * Règles communes au portrait : mêmes contours électriques
 * ([MovvizElectricBorder]), mêmes teintes de fond, hitbox 44-48dp. Le
 * contenu central est STRICTEMENT celui des écrans existants (aucun fork
 * visuel) — seul le châssis change.
 */

/** Châssis tactile à rail : tout écran non compact hors TV — téléphone ou
 *  Fold plié tourné, Fold ouvert tenu droit ou à plat, tablette. Le Fold
 *  ouvert tenu droit (≈ 700 × 830 dp) y entre désormais au lieu de retomber
 *  sur l'interface TV. En dessous, portrait compact. */
@Composable
fun rememberUnfoldedLandscape(): Boolean {
    val windowClass = rememberMovvizWindowClass()
    return windowClass == MovvizWindowClass.LANDSCAPE_SHORT || windowClass.isLargeTouch
}

/** Plus petit côté à partir duquel l'écran est une vraie tablette (Pixel Tablet, Galaxy Tab… : ≥ 800 dp). Le
 *  Fold ouvert fait ≈ 700 dp de plus petit côté et n'en est pas une. */
private const val TABLET_MIN_SMALLEST_WIDTH_DP = 720

/** Vraie tablette : barre latérale agrandie, pas de panneau latéral droit. */
@Composable
fun rememberTablet(): Boolean =
    androidx.compose.ui.platform.LocalConfiguration.current.smallestScreenWidthDp >= TABLET_MIN_SMALLEST_WIDTH_DP

/** Contenu étroit tactile : portrait compact OU colonne centrale dépliée.
 *  Partout où le code distinguait `compactPortrait` vs "TV grand écran"
 *  pour les marges/tailles, le déplié doit prendre la branche compacte
 *  (la barre TV haute n'y existe plus, la colonne est étroite). */
@Composable
fun rememberNarrowContent(): Boolean =
    com.movviz.nx.mobile.ui.mobile.rememberCompactPortrait() || rememberUnfoldedLandscape()

/** Rail en verre de 60 dp posé dans une colonne de 76 dp en paysage bas ;
 *  rail à libellés de 88 dp sur Fold ouvert et tablette. */
internal fun unfoldedRailWidth(windowClass: MovvizWindowClass, tablet: Boolean = false) =
    if (tablet) 128.dp else if (windowClass.isLargeTouch) 100.dp else 76.dp

private val UnfoldedInactive = Color(0xFFB7B5BF)

private data class RailItem(val tab: HomeTab?, val label: String, val icon: ImageVector)

/** Rail tactile : Accueil, Découverte, Mon espace, Téléchargements, Réglages,
 *  puis Recherche, et en bas mise à jour + avatar. Verre teinté plutôt que
 *  colonne opaque ; actif en violet discret plutôt qu'en pavé dégradé.
 *  `downloadProgress` (0..1) dessine l'anneau cyan de la file en cours. */
@Composable
fun SlimRail(
    selected: HomeTab,
    onSelectTab: (HomeTab) -> Unit,
    onOpenSearch: () -> Unit,
    activeProfile: TvProfile?,
    onAvatarClick: () -> Unit,
    updateTag: String?,
    onUpdateClick: () -> Unit,
    // Même repli username que l'en-tête portrait (jamais "MO" anonyme).
    fallbackName: String? = null,
    downloadProgress: Float? = null,
    modifier: Modifier = Modifier,
) {
    val windowClass = rememberMovvizWindowClass()
    val labelled = windowClass.isLargeTouch
    // Tablette : barre latérale agrandie (icônes, libellés, logo, avatar) pour la distance et le doigt.
    val tablet = rememberTablet()
    val railDisplayName = activeProfile?.name?.takeIf { it.isNotBlank() } ?: fallbackName
    val items = listOf(
        RailItem(HomeTab.HOME, "Accueil", MovvizIconHome),
        RailItem(HomeTab.DISCOVER, "Découverte", MovvizIconCompass),
        RailItem(HomeTab.LIBRARY, "Mon espace", MovvizIconBookmark),
        RailItem(HomeTab.DOWNLOADS, "Télécharg.", MovvizIconDownload),
        RailItem(HomeTab.SETTINGS, "Réglages", MovvizIconSettings),
        RailItem(null, "Rechercher", MovvizIconSearch),
    )
    Box(
        modifier = modifier
            .fillMaxHeight()
            .background(MovvizPage)
            .padding(start = 8.dp, end = 8.dp, top = 8.dp, bottom = 8.dp),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .clip(MovvizRadius.large)
                .background(MovvizSurface.copy(alpha = 0.72f), MovvizRadius.large)
                .border(1.dp, Color.White.copy(alpha = 0.07f), MovvizRadius.large)
                .verticalScroll(rememberScrollState())
                .padding(vertical = 10.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(if (tablet) 12.dp else if (labelled) 6.dp else 2.dp),
        ) {
            Image(
                painter = painterResource(R.drawable.movviz_mark),
                contentDescription = "Movviz",
                contentScale = ContentScale.Fit,
                modifier = Modifier.padding(bottom = 8.dp).size(if (tablet) 42.dp else if (labelled) 30.dp else 26.dp),
            )
            items.forEach { item ->
                val active = item.tab != null && selected == item.tab
                RailButton(
                    item = item,
                    active = active,
                    labelled = labelled,
                    tablet = tablet,
                    progress = if (item.tab == HomeTab.DOWNLOADS) downloadProgress else null,
                    onClick = { if (item.tab != null) onSelectTab(item.tab) else onOpenSearch() },
                )
            }
            Spacer(Modifier.weight(1f).height(12.dp))
            if (updateTag != null) {
                Box(
                    modifier = Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .border(1.5.dp, MovvizElectricBorder, CircleShape)
                        .hapticClickable(onClick = onUpdateClick),
                    contentAlignment = Alignment.Center,
                ) {
                    androidx.tv.material3.Icon(
                        imageVector = MovvizIconDownload,
                        contentDescription = "Mise à jour ${updateTag.removePrefix("v")} disponible",
                        tint = Color.White,
                        modifier = Modifier.size(18.dp),
                    )
                    Box(
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .padding(top = 7.dp, end = 7.dp)
                            .size(7.dp)
                            .background(MovvizBrand2, CircleShape),
                    )
                }
                Spacer(Modifier.height(6.dp))
            }
            Box(
                modifier = Modifier
                    .size(if (tablet) 54.dp else if (labelled) 40.dp else 36.dp)
                    .clip(CircleShape)
                    .border(1.5.dp, MovvizElectricBorder, CircleShape)
                    .hapticClickable(onClick = onAvatarClick),
                contentAlignment = Alignment.Center,
            ) {
                if (activeProfile != null) {
                    com.movviz.nx.mobile.ui.profile.AvatarImage(
                        profile = activeProfile,
                        modifier = Modifier.fillMaxSize(),
                        shape = CircleShape,
                        initialsFontSize = 12.sp,
                        contentDescription = "Mon profil : ${railDisplayName ?: "..."}",
                    )
                } else {
                    Text(
                        railDisplayName?.take(2)?.uppercase() ?: "MO",
                        color = Color.White,
                        fontSize = 12.sp,
                    )
                }
            }
        }
    }
}

@Composable
private fun RailButton(
    item: RailItem,
    active: Boolean,
    labelled: Boolean,
    tablet: Boolean,
    progress: Float?,
    onClick: () -> Unit,
) {
    val tint = if (active) Color(0xFFE2C9FF) else UnfoldedInactive
    Column(
        modifier = Modifier
            .clip(MovvizRadius.medium)
            .hapticClickable(onClick = onClick)
            .padding(horizontal = 4.dp, vertical = if (labelled) 2.dp else 1.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier
                .size(width = if (tablet) 80.dp else if (labelled) 56.dp else 44.dp, height = if (tablet) 46.dp else if (labelled) 32.dp else 36.dp)
                .clip(RoundedCornerShape(if (tablet) 23.dp else if (labelled) 16.dp else 13.dp))
                .background(if (active) MovvizBrand.copy(alpha = 0.30f) else Color.Transparent),
            contentAlignment = Alignment.Center,
        ) {
            androidx.tv.material3.Icon(
                imageVector = item.icon,
                contentDescription = if (labelled) null else item.label,
                tint = tint,
                modifier = Modifier.size(if (tablet) 30.dp else 20.dp),
            )
            if (progress != null) {
                androidx.compose.foundation.Canvas(modifier = Modifier.size(if (tablet) 42.dp else 30.dp)) {
                    val stroke = 2.dp.toPx()
                    drawArc(
                        color = Color.White.copy(alpha = 0.12f),
                        startAngle = 0f, sweepAngle = 360f, useCenter = false,
                        style = androidx.compose.ui.graphics.drawscope.Stroke(width = stroke),
                    )
                    drawArc(
                        color = MovvizCyan,
                        startAngle = -90f, sweepAngle = 360f * progress.coerceIn(0f, 1f), useCenter = false,
                        style = androidx.compose.ui.graphics.drawscope.Stroke(width = stroke, cap = androidx.compose.ui.graphics.StrokeCap.Round),
                    )
                }
            }
        }
        if (labelled) {
            Spacer(Modifier.height(4.dp))
            Text(
                text = item.label,
                style = TextStyle(
                    fontSize = if (tablet) 15.sp else 11.sp,
                    fontWeight = if (active) FontWeight.Bold else FontWeight.Medium,
                    color = if (active) Color.White else UnfoldedInactive,
                ),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

/** Panneau latéral droit de l'accueil déplié : file "En cours" + file
 *  "Terminés" (mêmes données que l'écran Téléchargements, modèle
 *  condensé). Tap → fiche titre quand elle est connue. */
/** Châssis déplié pour les routes hors onglets (fiche titre/acteur, grille
 *  "Tout voir") : même rail tactile que l'accueil + contenu pleine largeur.
 *  Évite l'incohérence barre-TV-haute sur ces écrans en Fold/paysage. */
@Composable
fun UnfoldedRouteScaffold(
    selected: HomeTab,
    onSelectTab: (HomeTab) -> Unit,
    onOpenSearch: () -> Unit,
    activeProfile: TvProfile?,
    onAvatarClick: () -> Unit,
    updateTag: String?,
    onUpdateClick: () -> Unit,
    fallbackName: String?,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    val railWidth = unfoldedRailWidth(rememberMovvizWindowClass(), rememberTablet())
    Box(modifier = modifier.fillMaxSize()) {
    Row(modifier = Modifier.fillMaxSize()) {
        SlimRail(
            selected = selected,
            onSelectTab = onSelectTab,
            onOpenSearch = onOpenSearch,
            activeProfile = activeProfile,
            onAvatarClick = onAvatarClick,
            updateTag = updateTag,
            onUpdateClick = onUpdateClick,
            fallbackName = fallbackName,
            modifier = Modifier.width(railWidth),
        )
        Box(modifier = Modifier.weight(1f).fillMaxHeight()) {
            content()
        }
    }
    }
}
