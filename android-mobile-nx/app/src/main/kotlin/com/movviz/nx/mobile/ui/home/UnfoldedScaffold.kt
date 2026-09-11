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
import com.movviz.nx.mobile.ui.theme.MovvizSurface

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

/** Seuil déplié : paysage avec au moins 700dp de large (Fold ouvert,
 *  tablette paysage, téléphone pivoté — les deux doivent fonctionner).
 *  TV réelle exclue (UiMode TV) : elle garde son interface 10-foot.
 *  En dessous du seuil, portrait compact ou interface existante. */
@Composable
fun rememberUnfoldedLandscape(): Boolean {
    val configuration = androidx.compose.ui.platform.LocalConfiguration.current
    if (configuration.screenWidthDp < 700 ||
        configuration.screenWidthDp <= configuration.screenHeightDp
    ) {
        return false
    }
    val uiMode = (androidx.compose.ui.platform.LocalContext.current.getSystemService(
        android.content.Context.UI_MODE_SERVICE,
    ) as? android.app.UiModeManager)?.currentModeType
    return uiMode != android.content.res.Configuration.UI_MODE_TYPE_TELEVISION
}

/** Panneau latéral seulement si la colonne centrale garde ≥ 320dp
 *  (paysage smartphone étroit : rail + contenu, sans panneau). */
@Composable
fun rememberUnfoldedWithPanel(): Boolean {
    if (!rememberUnfoldedLandscape()) return false
    return androidx.compose.ui.platform.LocalConfiguration.current.screenWidthDp >= 784
}

/** Contenu étroit tactile : portrait compact OU colonne centrale dépliée.
 *  Partout où le code distinguait `compactPortrait` vs "TV grand écran"
 *  pour les marges/tailles, le déplié doit prendre la branche compacte
 *  (la barre TV haute n'y existe plus, la colonne est étroite). */
@Composable
fun rememberNarrowContent(): Boolean =
    com.movviz.nx.mobile.ui.mobile.rememberCompactPortrait() || rememberUnfoldedLandscape()

// Esquisse dépliée : rail ~13 %, téléchargements ~28 %. Les minimums
// conservent les libellés lisibles ; le centre garde au moins 360 dp.
internal fun unfoldedRailWidth(availableWidth: Float) =
    (availableWidth * 0.133f).coerceIn(144f, 168f).dp

internal fun unfoldedPanelWidth(availableWidth: Float) =
    (availableWidth * 0.284f).coerceIn(224f, 320f).dp
private val UnfoldedInactive = Color(0xFFC3C3CB)
private const val TMDB_THUMB_BASE = "https://image.tmdb.org/t/p/w200"

private data class RailItem(val tab: HomeTab, val label: String, val icon: ImageVector)

/** Rail tactile gauche — Accueil/Découvrir/Bibliothèque/Téléchargements/
 *  Réglages + recherche + avatar, comme la colonne de la maquette. Tactile
 *  d'abord (clickable simple), pas de chorégraphie D-pad TV. */
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
    modifier: Modifier = Modifier,
) {
    val railDisplayName = activeProfile?.name?.takeIf { it.isNotBlank() } ?: fallbackName
    val items = listOf(
        RailItem(HomeTab.HOME, "Accueil", MovvizIconHome),
        RailItem(HomeTab.DISCOVER, "Découvrir", MovvizIconCompass),
        RailItem(HomeTab.LIBRARY, "Bibliothèque", MovvizIconBookmark),
        RailItem(HomeTab.DOWNLOADS, "Téléchargements", MovvizIconDownload),
        RailItem(HomeTab.SETTINGS, "Réglages", MovvizIconSettings),
    )
    // Menu compact qui tient sans scroll sur les hauteurs paysage (~390dp+) :
    // items 44dp, labels 12sp lisibles en entier ("Téléchargements" compris).
    Column(
        modifier = modifier
            .fillMaxHeight()
            .background(com.movviz.nx.mobile.ui.theme.MovvizPage)
            .padding(start = 6.dp, end = 6.dp, top = 10.dp, bottom = 8.dp)
            .verticalScroll(rememberScrollState()),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Image(
                painter = painterResource(R.drawable.movviz_mark),
                contentDescription = "Movviz",
                contentScale = ContentScale.Fit,
                modifier = Modifier.size(24.dp),
            )
            Spacer(Modifier.width(8.dp))
            Text(
                text = "MOVVIZ NX",
                style = TextStyle(
                    fontSize = 10.5.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = Color.White.copy(alpha = 0.90f),
                    letterSpacing = 1.0.sp,
                ),
                maxLines = 1,
                modifier = Modifier.weight(1f),
            )
        }
        Spacer(Modifier.height(12.dp))
        items.forEach { item ->
            val active = selected == item.tab
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(44.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .then(
                        if (active) {
                            Modifier.background(
                                Brush.linearGradient(listOf(MovvizBrand.copy(alpha = .85f), MovvizBrand2.copy(alpha = .85f))),
                                RoundedCornerShape(12.dp),
                            )
                        } else {
                            Modifier
                        },
                    )
                    .clickable(onClick = { onSelectTab(item.tab) })
                    .padding(horizontal = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                androidx.tv.material3.Icon(
                    imageVector = item.icon,
                    contentDescription = null,
                    tint = if (active) Color.White else UnfoldedInactive,
                    modifier = Modifier.size(20.dp),
                )
                Spacer(Modifier.width(6.dp))
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
            Spacer(Modifier.height(2.dp))
        }
        Box(
            modifier = Modifier.size(44.dp).clickable(onClick = onOpenSearch),
            contentAlignment = Alignment.Center,
        ) {
            androidx.tv.material3.Icon(
                imageVector = MovvizIconSearch,
                contentDescription = "Rechercher",
                tint = UnfoldedInactive,
                modifier = Modifier.size(20.dp),
            )
        }
        Spacer(Modifier.weight(1f))
        if (updateTag != null) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .border(1.dp, MovvizElectricBorder, RoundedCornerShape(12.dp))
                    .clickable(onClick = onUpdateClick)
                    .padding(horizontal = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(contentAlignment = Alignment.Center) {
                    androidx.tv.material3.Icon(
                        imageVector = MovvizIconDownload,
                        contentDescription = "Mise à jour ${updateTag.removePrefix("v")} disponible",
                        tint = Color.White,
                        modifier = Modifier.size(18.dp),
                    )
                    Box(
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .size(7.dp)
                            .background(MovvizBrand2, CircleShape),
                    )
                }
                Spacer(Modifier.width(10.dp))
                Text(
                    text = "Mise à jour",
                    style = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.White),
                    maxLines = 1,
                )
            }
            Spacer(Modifier.height(8.dp))
        }
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp)
                .clip(RoundedCornerShape(12.dp))
                .clickable(onClick = onAvatarClick)
                .padding(horizontal = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier.size(36.dp).clip(CircleShape)
                    .border(1.5.dp, MovvizElectricBorder, CircleShape),
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
            Spacer(Modifier.width(10.dp))
            Text(
                text = railDisplayName ?: "Mon profil",
                style = TextStyle(fontSize = 13.sp, fontWeight = FontWeight.Medium, color = UnfoldedInactive),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
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
    androidx.compose.foundation.layout.BoxWithConstraints(modifier = modifier.fillMaxSize()) {
    val railWidth = unfoldedRailWidth(maxWidth.value)
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
            .border(width = 1.dp, color = Color.White.copy(alpha = 0.07f))
            .padding(horizontal = 14.dp, vertical = 12.dp),
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
                modifier = Modifier.clickable(onClick = onSeeAll).padding(start = 8.dp),
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
            .background(com.movviz.nx.mobile.ui.theme.MovvizSurfaceStrong, RoundedCornerShape(12.dp))
            .border(1.5.dp, MovvizElectricBorder, RoundedCornerShape(12.dp))
            .let { if (clickable) it.clickable(onClick = onClick) else it }
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
