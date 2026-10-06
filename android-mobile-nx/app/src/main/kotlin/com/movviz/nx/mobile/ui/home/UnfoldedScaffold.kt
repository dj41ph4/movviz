package com.movviz.nx.mobile.ui.home

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
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
import coil.compose.AsyncImage
import com.movviz.nx.mobile.AppViewModel
import com.movviz.nx.mobile.R
import com.movviz.nx.mobile.data.QueueItemDto
import com.movviz.nx.mobile.data.TvProfile
import com.movviz.nx.mobile.ui.theme.MovvizBrand
import com.movviz.nx.mobile.ui.theme.MovvizBrand2
import com.movviz.nx.mobile.ui.theme.MovvizElectricBorder
import com.movviz.nx.mobile.ui.theme.MovvizIconBookmark
import com.movviz.nx.mobile.ui.theme.MovvizIconCheck
import com.movviz.nx.mobile.ui.theme.MovvizIconCompass
import com.movviz.nx.mobile.ui.theme.MovvizIconDownload
import com.movviz.nx.mobile.ui.theme.MovvizIconHome
import com.movviz.nx.mobile.ui.theme.MovvizIconSearch
import com.movviz.nx.mobile.ui.theme.MovvizIconSettings
import com.movviz.nx.mobile.ui.theme.MovvizOk
import com.movviz.nx.mobile.ui.theme.MovvizCyan
import com.movviz.nx.mobile.ui.theme.MovvizPage
import com.movviz.nx.mobile.ui.theme.MovvizRadius
import com.movviz.nx.mobile.ui.theme.MovvizWindowClass
import com.movviz.nx.mobile.ui.theme.isLargeTouch
import com.movviz.nx.mobile.ui.theme.rememberMovvizWindowClass
import com.movviz.nx.mobile.ui.theme.MovvizSurface
import com.movviz.nx.mobile.ui.theme.hapticClickable
import com.movviz.nx.mobile.ui.theme.tvPointerClick

/**
 * Mode déplié / paysage large (maquette "MOVVIZ NX / MODE DÉPLIÉ") :
 * rail tactile gauche + contenu central existant + panneau latéral droit
 * ("En cours" / "Terminés").
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

/** Panneau Activité (téléchargements) : Fold ouvert à plat et tablettes
 *  seulement. Sur un téléphone tourné il mangeait 28 % de la largeur. */
@Composable
fun rememberUnfoldedWithPanel(): Boolean =
    rememberMovvizWindowClass() == MovvizWindowClass.FOLD_FLAT

/** Contenu étroit tactile : portrait compact OU colonne centrale dépliée.
 *  Partout où le code distinguait `compactPortrait` vs "TV grand écran"
 *  pour les marges/tailles, le déplié doit prendre la branche compacte
 *  (la barre TV haute n'y existe plus, la colonne est étroite). */
@Composable
fun rememberNarrowContent(): Boolean =
    com.movviz.nx.mobile.ui.mobile.rememberCompactPortrait() || rememberUnfoldedLandscape()

/** Rail en verre de 60 dp posé dans une colonne de 76 dp en paysage bas ;
 *  rail à libellés de 88 dp sur Fold ouvert et tablette. */
internal fun unfoldedRailWidth(windowClass: MovvizWindowClass) =
    if (windowClass.isLargeTouch) 100.dp else 76.dp

internal fun unfoldedPanelWidth(availableWidth: Float) =
    (availableWidth * 0.3f).coerceIn(260f, 320f).dp

private val UnfoldedInactive = Color(0xFFB7BCDC)
private const val TMDB_THUMB_BASE = "https://image.tmdb.org/t/p/w200"

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
            verticalArrangement = Arrangement.spacedBy(if (labelled) 6.dp else 2.dp),
        ) {
            Image(
                painter = painterResource(R.drawable.movviz_mark),
                contentDescription = "Movviz",
                contentScale = ContentScale.Fit,
                modifier = Modifier.padding(bottom = 8.dp).size(if (labelled) 30.dp else 26.dp),
            )
            items.forEach { item ->
                val active = item.tab != null && selected == item.tab
                RailButton(
                    item = item,
                    active = active,
                    labelled = labelled,
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
                    .size(if (labelled) 40.dp else 36.dp)
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
                .size(width = if (labelled) 56.dp else 44.dp, height = if (labelled) 32.dp else 36.dp)
                .clip(RoundedCornerShape(if (labelled) 16.dp else 13.dp))
                .background(if (active) MovvizBrand.copy(alpha = 0.30f) else Color.Transparent),
            contentAlignment = Alignment.Center,
        ) {
            androidx.tv.material3.Icon(
                imageVector = item.icon,
                contentDescription = if (labelled) null else item.label,
                tint = tint,
                modifier = Modifier.size(20.dp),
            )
            if (progress != null) {
                androidx.compose.foundation.Canvas(modifier = Modifier.size(30.dp)) {
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
                    fontSize = 11.sp,
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
    val railWidth = unfoldedRailWidth(rememberMovvizWindowClass())
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

@Composable
fun UnfoldedRightPanel(
    viewModel: AppViewModel,
    onOpenTitle: (type: String, tmdbId: Int) -> Unit,
    onOpenDownloadsTab: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val queue by viewModel.queue.collectAsState()
    val completedQueue by viewModel.completedQueue.collectAsState()
    // Repli jaquettes : les items terminés n'ont pas toujours leur poster —
    // on le retrouve via la bibliothèque (tmdbId), même source que l'accueil.
    val movies by viewModel.movies.collectAsState()
    val series by viewModel.series.collectAsState()
    val posterFor: (QueueItemDto) -> String? = { item ->
        item.media.posterPath
            ?: movies.firstOrNull { it.tmdbId == item.media.tmdbId }?.posterPath
            ?: series.firstOrNull { it.tmdbId == item.media.tmdbId }?.posterPath
    }
    LazyColumn(
        modifier = modifier
            .fillMaxHeight()
            .background(com.movviz.nx.mobile.ui.theme.MovvizPage)
            .padding(top = 8.dp, end = 8.dp, bottom = 8.dp)
            .clip(MovvizRadius.large)
            .background(MovvizSurface.copy(alpha = 0.72f), MovvizRadius.large)
            .padding(horizontal = 14.dp, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item {
            UnfoldedPanelSection(
                title = "En cours (${queue.size})",
                onSeeAll = onOpenDownloadsTab,
            ) {
                if (queue.isEmpty()) {
                    Text(
                        "Aucun téléchargement pour l'instant.",
                        style = TextStyle(fontSize = 12.sp, color = Color.White.copy(alpha = 0.68f)),
                    )
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        queue.take(5).forEach { item ->
                            UnfoldedQueueRow(
                                item = item,
                                posterPath = posterFor(item),
                                completed = false,
                                onClick = {
                                    item.media.tmdbId?.let { onOpenTitle(item.media.type, it) }
                                },
                            )
                        }
                    }
                }
            }
        }
        item {
            UnfoldedPanelSection(
                title = "Terminés (${completedQueue.size})",
                onSeeAll = onOpenDownloadsTab,
            ) {
                if (completedQueue.isEmpty()) {
                    Text(
                        "Rien de terminé pour l'instant.",
                        style = TextStyle(fontSize = 12.sp, color = Color.White.copy(alpha = 0.68f)),
                    )
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        completedQueue.take(4).forEach { item ->
                            UnfoldedQueueRow(
                                item = item,
                                posterPath = posterFor(item),
                                completed = true,
                                onClick = {
                                    item.media.tmdbId?.let { onOpenTitle(item.media.type, it) }
                                },
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun UnfoldedPanelSection(
    title: String,
    onSeeAll: () -> Unit,
    content: @Composable () -> Unit,
) {
    Column {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(bottom = 12.dp)) {
            Text(
                text = title,
                style = TextStyle(fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Color.White),
                modifier = Modifier.weight(1f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = "Tout voir  >",
                style = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = MovvizBrand2),
                modifier = Modifier.hapticClickable(onClick = onSeeAll).padding(start = 8.dp),
            )
        }
        content()
    }
}

@Composable
private fun UnfoldedQueueRow(
    item: QueueItemDto,
    posterPath: String?,
    completed: Boolean,
    onClick: () -> Unit,
) {
    val clickable = item.media.tmdbId != null
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White.copy(alpha = 0.05f), RoundedCornerShape(14.dp))
            .let { if (clickable) it.hapticClickable(onClick = onClick) else it }
            .padding(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        val thumbUrl = posterPath?.let { "$TMDB_THUMB_BASE$it" }
        if (thumbUrl != null) {
            AsyncImage(
                model = thumbUrl,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.size(width = 48.dp, height = 72.dp).clip(RoundedCornerShape(10.dp)),
            )
        } else {
            Box(
                modifier = Modifier.size(width = 48.dp, height = 72.dp).clip(RoundedCornerShape(10.dp))
                    .background(MovvizSurface),
            )
        }
        Spacer(Modifier.width(10.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = item.media.title,
                style = TextStyle(fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = Color.White),
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            val episodeSuffix = if (item.media.season != null && item.media.episode != null) {
                "S${item.media.season} · E${item.media.episode} · "
            } else {
                ""
            }
            Text(
                text = if (completed) "${episodeSuffix}Terminé"
                else "$episodeSuffix${(item.download.progress * 100).toInt()} %",
                style = TextStyle(fontSize = 12.sp, color = Color.White.copy(alpha = 0.68f)),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 4.dp),
            )
            if (!completed) {
                Box(
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp).height(6.dp)
                        .clip(RoundedCornerShape(3.dp))
                        .background(Color.White.copy(alpha = 0.14f)),
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(item.download.progress.toFloat().coerceIn(0f, 1f))
                            .height(6.dp)
                            .background(
                                Brush.horizontalGradient(listOf(MovvizBrand, MovvizBrand2)),
                                RoundedCornerShape(3.dp),
                            ),
                    )
                }
            }
        }
        Spacer(Modifier.width(8.dp))
        if (completed) {
            Box(
                modifier = Modifier.size(28.dp).clip(CircleShape)
                    .background(MovvizOk.copy(alpha = 0.18f)),
                contentAlignment = Alignment.Center,
            ) {
                androidx.tv.material3.Icon(
                    imageVector = MovvizIconCheck,
                    contentDescription = "Terminé",
                    tint = MovvizOk,
                    modifier = Modifier.size(15.dp),
                )
            }
        } else {
            // Le % vit déjà dans le sous-titre + la barre : pastille
            // électrique compacte à la place du doublon.
            Box(
                modifier = Modifier.size(28.dp).clip(CircleShape)
                    .border(1.dp, MovvizElectricBorder, CircleShape)
                    .background(MovvizBrand2.copy(alpha = 0.12f)),
                contentAlignment = Alignment.Center,
            ) {
                androidx.tv.material3.Icon(
                    imageVector = MovvizIconDownload,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(14.dp),
                )
            }
        }
    }
}
