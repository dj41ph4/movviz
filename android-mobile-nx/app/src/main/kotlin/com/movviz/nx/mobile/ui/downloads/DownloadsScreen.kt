package com.movviz.nx.mobile.ui.downloads

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.foundation.lazy.list.TvLazyColumn
import androidx.tv.foundation.lazy.list.items
import androidx.tv.foundation.lazy.list.rememberTvLazyListState
import androidx.tv.material3.Icon
import androidx.tv.material3.Surface
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.Text
import coil.compose.rememberAsyncImagePainter
import com.movviz.nx.mobile.AppViewModel
import com.movviz.nx.mobile.data.QueueItemDto
import com.movviz.nx.mobile.ui.mobile.MovvizEmptyState
import com.movviz.nx.mobile.ui.mobile.MovvizProgressBar
import com.movviz.nx.mobile.ui.mobile.MovvizSegmentedControl
import com.movviz.nx.mobile.ui.mobile.rememberCompactPortrait
import com.movviz.nx.mobile.ui.theme.MovvizIconCheck
import com.movviz.nx.mobile.ui.theme.MovvizIconDownload
import com.movviz.nx.mobile.ui.theme.MovvizInk
import com.movviz.nx.mobile.ui.theme.MovvizInkDim
import com.movviz.nx.mobile.ui.theme.MovvizInkSoft
import com.movviz.nx.mobile.ui.theme.MovvizOk
import com.movviz.nx.mobile.ui.theme.MovvizSurface
import com.movviz.nx.mobile.ui.theme.MovvizSurfaceStrong
import com.movviz.nx.mobile.ui.theme.tvPointerClick
import com.movviz.nx.mobile.ui.theme.withTvPrefetchDisabled
import kotlin.math.roundToInt

/** File serveur NX : même donnée partagée que la rangée accueil (mise à jour
 *  par le polling déjà démarré côté AppViewModel — pas de bouton "Actualiser"
 *  visible, voir esquisse mobile section 10). Deux onglets réels En cours/
 *  Terminés plutôt qu'une liste fusionnée. */
@Composable
fun DownloadsScreen(
    viewModel: AppViewModel,
    onBack: () -> Unit,
    onOpenTitle: (String, Int) -> Unit,
    embedded: Boolean = false,
) {
    if (!embedded) BackHandler(onBack = onBack)
    val queue by viewModel.queue.collectAsState()
    val completedQueue by viewModel.completedQueue.collectAsState()
    LaunchedEffect(Unit) { viewModel.loadQueue() }
    val compactPortrait = rememberCompactPortrait()
    var tabIndex by remember { mutableIntStateOf(0) }

    TvLazyColumn(
        state = rememberTvLazyListState().withTvPrefetchDisabled(),
        modifier = Modifier.fillMaxSize().background(com.movviz.nx.mobile.ui.theme.MovvizPage.copy(alpha = if (compactPortrait) 0f else 1f))
            .padding(horizontal = 16.dp),
        // bottom 156dp en portrait embarqué (barre basse flottante, sinon
        // "Terminés" — souvent long — passait dessous, signalé en direct).
        contentPadding = PaddingValues(top = if (embedded) 16.dp else 76.dp, bottom = if (compactPortrait) 156.dp else 28.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        if (!embedded) {
            item {
                Text(
                    "Téléchargements",
                    style = TextStyle(fontSize = 26.sp, fontWeight = FontWeight.Black, color = MovvizInk),
                    modifier = Modifier.padding(bottom = 4.dp),
                )
            }
        }
        item {
            MovvizSegmentedControl(
                options = listOf("En cours (${queue.size})", "Terminés (${completedQueue.size})"),
                selectedIndex = tabIndex,
                onSelect = { tabIndex = it },
                modifier = Modifier.padding(vertical = 4.dp),
            )
        }
        if (tabIndex == 0) {
            if (queue.isEmpty()) {
                item { MovvizEmptyState("Aucun téléchargement en cours", "Les films et séries lancés apparaîtront ici.") }
            }
            items(queue, key = { it.id }) { item ->
                DownloadRow(item, completed = false) { item.media.tmdbId?.let { onOpenTitle(item.media.type, it) } }
            }
        } else {
            if (completedQueue.isEmpty()) {
                item { MovvizEmptyState("Aucun téléchargement terminé", "Les téléchargements achevés restent listés ici.") }
            }
            items(completedQueue, key = { "completed-${it.id}" }) { item ->
                DownloadRow(item, completed = true) { item.media.tmdbId?.let { onOpenTitle(item.media.type, it) } }
            }
        }
    }
}

/** Icône de statut non-interactive : aucune donnée/route pause-reprise
 *  vérifiée côté client pour l'instant (voir plan) — jamais un bouton mort. */
@Composable
private fun DownloadRow(item: QueueItemDto, completed: Boolean, onClick: () -> Unit) {
    val progress = item.download.progress.coerceIn(0.0, 1.0).toFloat()
    Surface(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth().tvPointerClick(onClick),
        shape = ClickableSurfaceDefaults.shape(RoundedCornerShape(12.dp)),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = MovvizSurfaceStrong,
            focusedContainerColor = MovvizSurfaceStrong.copy(alpha = .8f),
            contentColor = MovvizInk,
            focusedContentColor = MovvizInk,
        ),
    ) {
        Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            item.media.posterPath?.let {
                Image(
                    rememberAsyncImagePainter("https://image.tmdb.org/t/p/w342$it"),
                    null,
                    Modifier.width(52.dp).height(76.dp).clip(RoundedCornerShape(6.dp)),
                    contentScale = ContentScale.Crop,
                )
                Spacer(Modifier.width(12.dp))
            }
            Column(Modifier.weight(1f)) {
                Text(item.media.title, fontSize = 15.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(
                    listOfNotNull(item.media.season?.let { "S$it" }, item.media.episode?.let { "E$it" })
                        .joinToString(" · ")
                        .ifBlank { if (item.media.type == "movie") "Film" else "Série" },
                    color = MovvizInkDim,
                    fontSize = 12.sp,
                )
                if (completed) {
                    Spacer(Modifier.height(4.dp))
                } else {
                    Spacer(Modifier.height(10.dp))
                    MovvizProgressBar(progress = progress)
                    Spacer(Modifier.height(6.dp))
                    Text(subtitleFor(item), color = MovvizInkDim, fontSize = 12.sp)
                }
            }
            Spacer(Modifier.width(10.dp))
            if (completed) {
                Icon(MovvizIconCheck, "Terminé", tint = MovvizOk, modifier = Modifier.size(20.dp))
            } else {
                Box(
                    modifier = Modifier.size(30.dp).background(Color.White.copy(alpha = .08f), CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(MovvizIconDownload, statusLabel(item.status), tint = MovvizInkSoft, modifier = Modifier.size(15.dp))
                }
            }
        }
    }
}

private fun subtitleFor(item: QueueItemDto): String {
    val percent = "${(item.download.progress.coerceIn(0.0, 1.0) * 100).roundToInt()} %"
    val eta = etaLabel(item.download.eta)
    val speed = speedLabel(item.download.downloadSpeed)
    return listOfNotNull(percent, statusLabel(item.status), eta, speed).joinToString(" · ")
}

private fun etaLabel(seconds: Long): String? {
    if (seconds <= 0) return null
    val minutes = seconds / 60
    return when {
        minutes < 1 -> "moins d'1 min restante"
        minutes < 60 -> "$minutes min restantes"
        else -> "${minutes / 60} h ${minutes % 60} min restantes"
    }
}

private fun speedLabel(bytesPerSecond: Double): String? {
    if (bytesPerSecond <= 0) return null
    return when {
        bytesPerSecond < 1024 -> "${bytesPerSecond.roundToInt()} o/s"
        bytesPerSecond < 1024 * 1024 -> "${(bytesPerSecond / 1024).roundToInt()} Ko/s"
        else -> String.format("%.1f Mo/s", bytesPerSecond / (1024 * 1024))
    }
}

private fun statusLabel(value: String) = when (value) {
    "downloading" -> "Téléchargement"
    "queued" -> "En attente"
    "searching" -> "Recherche"
    "importing" -> "Import"
    "paused" -> "En pause"
    "stalled" -> "Bloqué"
    else -> value
}
