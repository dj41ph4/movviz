package com.movviz.tv.ui.downloads

import androidx.activity.compose.BackHandler
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
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.foundation.lazy.list.TvLazyColumn
import androidx.tv.foundation.lazy.list.items
import androidx.tv.foundation.lazy.list.rememberTvLazyListState
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import com.movviz.tv.AppViewModel
import com.movviz.tv.data.QueueItemDto
import com.movviz.tv.ui.theme.MovvizBrand
import com.movviz.tv.ui.theme.MovvizInk
import com.movviz.tv.ui.theme.MovvizInkDim
import com.movviz.tv.ui.theme.withTvPrefetchDisabled
import kotlin.math.roundToInt

/** Vue complète de la file, complément dynamique des états visibles en fiche. */
@Composable fun DownloadsScreen(viewModel: AppViewModel, onBack: () -> Unit) {
    BackHandler(onBack = onBack)
    val queue by viewModel.queue.collectAsState()
    LaunchedEffect(Unit) { viewModel.loadQueue() }
    TvLazyColumn(Modifier.fillMaxSize().background(Color(0xFF09090C)).padding(horizontal = 42.dp), state = rememberTvLazyListState().withTvPrefetchDisabled(), contentPadding = PaddingValues(top = 84.dp, bottom = 36.dp), verticalArrangement = Arrangement.spacedBy(11.dp)) {
        item { Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) { Text("Téléchargements", style = TextStyle(fontSize = 24.sp, fontWeight = FontWeight.Black, color = MovvizInk), modifier = Modifier.weight(1f)); Surface(onClick = { viewModel.loadQueue() }, shape = ClickableSurfaceDefaults.shape(RoundedCornerShape(18.dp)), colors = ClickableSurfaceDefaults.colors(containerColor = Color(0xFF292930), focusedContainerColor = Color(0xFF41414B), contentColor = Color.White, focusedContentColor = Color.White)) { Text("Actualiser", modifier = Modifier.padding(horizontal = 15.dp, vertical = 10.dp)) } } }
        item { Text("En cours · ${queue.size}", color = MovvizInkDim, fontSize = 12.sp) }
        if (queue.isEmpty()) item { Box(Modifier.fillMaxWidth().padding(vertical = 60.dp), contentAlignment = Alignment.Center) { Text("Aucun téléchargement en cours", color = MovvizInkDim, fontSize = 14.sp) } }
        items(queue, key = { it.id }) { DownloadRow(it) }
    }
}
@Composable private fun DownloadRow(item: QueueItemDto) { val progress = item.download.progress.coerceIn(0.0, 1.0).toFloat(); Surface(onClick = {}, modifier = Modifier.fillMaxWidth(), shape = ClickableSurfaceDefaults.shape(RoundedCornerShape(11.dp)), colors = ClickableSurfaceDefaults.colors(containerColor = Color(0xFF18181D), focusedContainerColor = Color(0xFF2B2B34), contentColor = MovvizInk, focusedContentColor = MovvizInk)) { Column(Modifier.padding(horizontal = 17.dp, vertical = 12.dp)) { Text(item.media.title, fontSize = 15.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis); Text("${(progress * 100).roundToInt()} % · ${item.status}", color = MovvizInkDim, fontSize = 11.sp, modifier = Modifier.padding(top = 3.dp)); Spacer(Modifier.height(8.dp)); Box(Modifier.fillMaxWidth().height(6.dp).background(Color.White.copy(.14f), RoundedCornerShape(3.dp))) { Box(Modifier.fillMaxWidth(progress).fillMaxHeight().background(MovvizBrand, RoundedCornerShape(3.dp))) } } } }
