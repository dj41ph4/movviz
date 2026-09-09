package com.movviz.nx.mobile.ui.downloads

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.foundation.lazy.list.TvLazyColumn
import androidx.tv.foundation.lazy.list.items
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import coil.compose.rememberAsyncImagePainter
import com.movviz.nx.mobile.AppViewModel
import com.movviz.nx.mobile.data.QueueItemDto
import com.movviz.nx.mobile.ui.theme.MovvizBrand
import com.movviz.nx.mobile.ui.theme.MovvizInk
import com.movviz.nx.mobile.ui.theme.MovvizInkDim
import com.movviz.nx.mobile.ui.theme.tvPointerClick
import kotlin.math.roundToInt

/** File serveur NX : même donnée partagée que la rangée accueil, sous forme
 * de page dédiée afin de suivre tous les téléchargements en cours. */
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
    TvLazyColumn(
        modifier = Modifier.fillMaxSize().background(Color(0xFF09090C)).padding(horizontal = 16.dp),
        contentPadding = PaddingValues(top = if (embedded) 26.dp else 76.dp, bottom = 28.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text("Téléchargements", style = TextStyle(fontSize = 26.sp, fontWeight = FontWeight.Black, color = MovvizInk), modifier = Modifier.weight(1f))
                Surface(onClick = { viewModel.loadQueue() }, modifier = Modifier.height(44.dp).tvPointerClick { viewModel.loadQueue() }, shape = ClickableSurfaceDefaults.shape(RoundedCornerShape(22.dp)), colors = ClickableSurfaceDefaults.colors(containerColor = Color(0xFF292930), focusedContainerColor = Color(0xFF41414B), contentColor = Color.White, focusedContentColor = Color.White)) { Text("Actualiser", modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)) }
            }
        }
        item { Text("En cours · ${queue.size}", color = MovvizInkDim, fontSize = 14.sp, modifier = Modifier.padding(top = 4.dp, bottom = 6.dp)) }
        if (queue.isEmpty()) item { Box(Modifier.fillMaxWidth().padding(vertical = 30.dp), contentAlignment = Alignment.Center) { Text("Aucun téléchargement en cours", color = MovvizInkDim, fontSize = 16.sp) } }
        items(queue, key = { it.id }) { item -> DownloadRow(item) { item.media.tmdbId?.let { onOpenTitle(item.media.type, it) } } }
        item {
            Text(
                "Terminés · ${completedQueue.size}",
                color = MovvizInkDim,
                fontSize = 14.sp,
                modifier = Modifier.padding(top = 22.dp, bottom = 6.dp),
            )
        }
        if (completedQueue.isEmpty()) item {
            Text("Aucun téléchargement terminé", color = MovvizInkDim, fontSize = 14.sp, modifier = Modifier.padding(bottom = 22.dp))
        }
        items(completedQueue, key = { "completed-${it.id}" }) { item ->
            DownloadRow(item) { item.media.tmdbId?.let { onOpenTitle(item.media.type, it) } }
        }
    }
}

@Composable private fun DownloadRow(item: QueueItemDto, onClick: () -> Unit) {
    val progress = item.download.progress.coerceIn(0.0, 1.0).toFloat()
    Surface(onClick = onClick, modifier = Modifier.fillMaxWidth().tvPointerClick(onClick), shape = ClickableSurfaceDefaults.shape(RoundedCornerShape(12.dp)), colors = ClickableSurfaceDefaults.colors(containerColor = Color(0xFF17171C), focusedContainerColor = Color(0xFF292932), contentColor = MovvizInk, focusedContentColor = MovvizInk)) {
        Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            item.media.posterPath?.let { Image(rememberAsyncImagePainter("https://image.tmdb.org/t/p/w342$it"), null, Modifier.width(52.dp).height(76.dp), contentScale = ContentScale.Crop) }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(item.media.title, fontSize = 16.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(listOfNotNull(item.media.season?.let { "S$it" }, item.media.episode?.let { "E$it" }).joinToString(" · ").ifBlank { if (item.media.type == "movie") "Film" else "Série" }, color = MovvizInkDim, fontSize = 12.sp)
                Spacer(Modifier.height(10.dp))
                Box(Modifier.fillMaxWidth().height(6.dp).background(Color.White.copy(alpha = .14f), RoundedCornerShape(3.dp))) { Box(Modifier.fillMaxWidth(progress).fillMaxHeight().background(MovvizBrand, RoundedCornerShape(3.dp))) }
                Spacer(Modifier.height(6.dp))
                Text("${(progress * 100).roundToInt()} % · ${statusLabel(item.status)}", color = MovvizInkDim, fontSize = 12.sp)
            }
        }
    }
}
private fun statusLabel(value: String) = when (value) { "downloading" -> "Téléchargement"; "queued" -> "En attente"; "searching" -> "Recherche"; "importing" -> "Import"; else -> value }
