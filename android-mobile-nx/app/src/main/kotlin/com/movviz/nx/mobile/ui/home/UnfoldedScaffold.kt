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
import com.movviz.nx.mobile.ui.theme.MovvizBackground
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
 *  tablette paysage, téléphone pivoté). En dessous, portrait compact ou
 *  interface TV existante. */
@Composable
fun rememberUnfoldedLandscape(): Boolean {
    val configuration = androidx.compose.ui.platform.LocalConfiguration.current
    return configuration.screenWidthDp >= 700 &&
        configuration.screenWidthDp > configuration.screenHeightDp
}

internal val UnfoldedRailWidth = 184.dp
internal val UnfoldedPanelWidth = 280.dp
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
    modifier: Modifier = Modifier,
) {
    val items = listOf(
        RailItem(HomeTab.HOME, "Accueil", MovvizIconHome),
        RailItem(HomeTab.DISCOVER, "Découvrir", MovvizIconCompass),
        RailItem(HomeTab.LIBRARY, "Bibliothèque", MovvizIconBookmark),
        RailItem(HomeTab.DOWNLOADS, "Téléchargements", MovvizIconDownload),
        RailItem(HomeTab.SETTINGS, "Réglages", MovvizIconSettings),
    )
    Column(
        modifier = modifier
            .fillMaxHeight()
            .background(MovvizBackground)
            .padding(start = 14.dp, end = 14.dp, top = 14.dp, bottom = 12.dp)
            .verticalScroll(rememberScrollState()),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Image(
                painter = painterResource(R.drawable.movviz_mark),
                contentDescription = "Movviz",
                contentScale = ContentScale.Fit,
                modifier = Modifier.size(26.dp),
            )
            Spacer(Modifier.width(8.dp))
            Text(
                text = "MOVVIZ NX",
                style = TextStyle(fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, color = Color.White),
                maxLines = 1,
            )
            Spacer(Modifier.weight(1f))
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
        }
        Spacer(Modifier.height(18.dp))
        items.forEach { item ->
            val active = selected == item.tab
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .then(
                        if (active) {
                            Modifier.background(
                                Brush.linearGradient(listOf(MovvizBrand.copy(alpha = .85f), MovvizBrand2.copy(alpha = .85f))),
                                RoundedCornerShape(14.dp),
                            )
                        } else {
                            Modifier
                        },
                    )
                    .clickable(onClick = { onSelectTab(item.tab) })
                    .padding(horizontal = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                androidx.tv.material3.Icon(
                    imageVector = item.icon,
                    contentDescription = null,
                    tint = if (active) Color.White else UnfoldedInactive,
                    modifier = Modifier.size(22.dp),
                )
                Spacer(Modifier.width(12.dp))
                Text(
                    text = item.label,
                    style = TextStyle(
                        fontSize = 13.sp,
                        fontWeight = if (active) FontWeight.Bold else FontWeight.Medium,
                        color = if (active) Color.White else UnfoldedInactive,
                    ),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Spacer(Modifier.height(4.dp))
        }
        Spacer(Modifier.weight(1f))
        if (updateTag != null) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .border(1.5.dp, MovvizElectricBorder, RoundedCornerShape(14.dp))
                    .clickable(onClick = onUpdateClick)
                    .padding(horizontal = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                androidx.tv.material3.Icon(
                    imageVector = MovvizIconDownload,
                    contentDescription = "Mise à jour ${updateTag.removePrefix("v")} disponible",
                    tint = Color.White,
                    modifier = Modifier.size(20.dp),
                )
                Spacer(Modifier.width(12.dp))
                Text(
                    text = "Mise à jour",
                    style = TextStyle(fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color.White),
                    maxLines = 1,
                )
            }
            Spacer(Modifier.height(8.dp))
        }
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp)
                .clip(RoundedCornerShape(14.dp))
                .clickable(onClick = onAvatarClick)
                .padding(horizontal = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (activeProfile?.avatar?.startsWith("http") == true) {
                AsyncImage(
                    model = activeProfile.avatar,
                    contentDescription = "Mon profil : ${activeProfile.name}",
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.size(36.dp).clip(CircleShape)
                        .border(1.5.dp, MovvizElectricBorder, CircleShape),
                )
            } else {
                Box(
                    modifier = Modifier.size(36.dp).clip(CircleShape)
                        .border(1.5.dp, MovvizElectricBorder, CircleShape)
                        .background(MovvizSurface),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        activeProfile?.name?.take(2)?.uppercase() ?: "MO",
                        color = Color.White,
                        fontSize = 12.sp,
                    )
                }
            }
            Spacer(Modifier.width(10.dp))
            Text(
                text = activeProfile?.name ?: "Mon profil",
                style = TextStyle(fontSize = 13.sp, fontWeight = FontWeight.Medium, color = UnfoldedInactive),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
        }
        Spacer(Modifier.height(10.dp))
        Text(
            text = "MOVVIZ NX — Le cinéma vous suit.",
            style = TextStyle(fontSize = 10.sp, color = Color.White.copy(alpha = 0.35f)),
            maxLines = 2,
            modifier = Modifier.padding(horizontal = 4.dp),
        )
    }
}

/** Panneau latéral droit de l'accueil déplié : file "En cours" + file
 *  "Terminés" (mêmes données que l'écran Téléchargements, modèle
 *  condensé). Tap → fiche titre quand elle est connue. */
@Composable
fun UnfoldedRightPanel(
    viewModel: AppViewModel,
    onOpenTitle: (type: String, tmdbId: Int) -> Unit,
    onOpenDownloadsTab: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val queue by viewModel.queue.collectAsState()
    val completedQueue by viewModel.completedQueue.collectAsState()
    LazyColumn(
        modifier = modifier
            .fillMaxHeight()
            .background(MovvizSurface.copy(alpha = 0.55f))
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        item {
            UnfoldedPanelSection(
                title = "En cours (${queue.size})",
                onSeeAll = onOpenDownloadsTab,
            ) {
                if (queue.isEmpty()) {
                    Text(
                        "Aucun téléchargement — vos grabs apparaîtront ici.",
                        style = TextStyle(fontSize = 12.sp, color = Color.White.copy(alpha = 0.5f)),
                    )
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        queue.take(5).forEach { item ->
                            UnfoldedQueueRow(
                                item = item,
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
                        style = TextStyle(fontSize = 12.sp, color = Color.White.copy(alpha = 0.5f)),
                    )
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        completedQueue.take(4).forEach { item ->
                            UnfoldedQueueRow(
                                item = item,
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
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(bottom = 10.dp)) {
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
private fun UnfoldedQueueRow(item: QueueItemDto, completed: Boolean, onClick: () -> Unit) {
    val clickable = item.media.tmdbId != null
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White.copy(alpha = 0.05f), RoundedCornerShape(12.dp))
            .border(1.dp, Color.White.copy(alpha = 0.08f), RoundedCornerShape(12.dp))
            .let { if (clickable) it.clickable(onClick = onClick) else it }
            .padding(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        val thumbUrl = item.media.posterPath?.let { "$TMDB_THUMB_BASE$it" }
        if (thumbUrl != null) {
            AsyncImage(
                model = thumbUrl,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.size(width = 44.dp, height = 66.dp).clip(RoundedCornerShape(8.dp)),
            )
        } else {
            Box(
                modifier = Modifier.size(width = 44.dp, height = 66.dp).clip(RoundedCornerShape(8.dp))
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
                style = TextStyle(fontSize = 11.sp, color = Color.White.copy(alpha = 0.55f)),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 2.dp),
            )
            if (!completed) {
                Box(
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp).height(4.dp)
                        .clip(RoundedCornerShape(2.dp))
                        .background(Color.White.copy(alpha = 0.14f)),
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(item.download.progress.toFloat().coerceIn(0f, 1f))
                            .height(4.dp)
                            .background(
                                Brush.horizontalGradient(listOf(MovvizBrand, MovvizBrand2)),
                                RoundedCornerShape(2.dp),
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
            Text(
                text = "${(item.download.progress * 100).toInt()} %",
                style = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.Bold, color = MovvizBrand2),
            )
        }
    }
}
