package com.movviz.mobile.downloads

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ArrowBack
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Download
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.movviz.mobile.MobileViewModel
import com.movviz.tv.data.ApiClient
import com.movviz.tv.data.QueueItemDto
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import kotlinx.coroutines.delay
import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import retrofit2.http.GET
import retrofit2.http.Query
import kotlin.math.roundToInt

private const val POSTER = "https://image.tmdb.org/t/p/w342"
private val Ink = Color(0xFFF5F5F5)
private val InkDim = Color(0xFF9A9A9A)
private val Surface = Color(0xFF181818)
private val Surface2 = Color(0xFF252525)
private val Accent = Color(0xFFE50914)

private data class DownloadHistoryMediaDto(
    val title: String = "",
    val type: String = "movie",
    val posterPath: String? = null,
    val tmdbId: Int? = null,
    val season: Int? = null,
    val episode: Int? = null,
)

private data class DownloadHistoryImportDto(
    val qualityDetected: String = "",
    val fileName: String = "",
)

private data class DownloadHistoryEntryDto(
    val id: String,
    val kind: String,
    val media: DownloadHistoryMediaDto,
    val timestamp: Long = 0L,
    val import: DownloadHistoryImportDto? = null,
)

private data class DownloadHistoryResponseDto(
    val items: List<DownloadHistoryEntryDto> = emptyList(),
    val total: Int = 0,
)

private interface DownloadsApiService {
    @GET("api/activity/v2")
    suspend fun queue(@Query("tab") tab: String = "queue"): Response<com.movviz.tv.data.QueueResponseDto>

    @GET("api/activity/v2")
    suspend fun history(@Query("tab") tab: String = "history"): Response<DownloadHistoryResponseDto>
}

private object DownloadsApiClient {
    private val moshi = Moshi.Builder().add(KotlinJsonAdapterFactory()).build()
    private var base: String? = null
    private var cached: DownloadsApiService? = null

    fun service(baseUrl: String): DownloadsApiService {
        val normalized = baseUrl.trim().trimEnd('/')
        cached?.let { if (base == normalized) return it }
        return Retrofit.Builder()
            .baseUrl("$normalized/")
            .client(ApiClient.httpClient())
            .addConverterFactory(MoshiConverterFactory.create(moshi))
            .build()
            .create(DownloadsApiService::class.java)
            .also { base = normalized; cached = it }
    }
}

@Composable
internal fun DownloadsScreen(
    vm: MobileViewModel,
    onClose: () -> Unit,
    onTitleClick: (String, Int) -> Unit,
) {
    BackHandler(onBack = onClose)
    val baseUrl = vm.getBaseUrlCached()
    var queue by remember { mutableStateOf<List<QueueItemDto>>(emptyList()) }
    var history by remember { mutableStateOf<List<DownloadHistoryEntryDto>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var refreshKey by remember { mutableIntStateOf(0) }

    LaunchedEffect(baseUrl, refreshKey) {
        if (baseUrl.isNullOrBlank()) {
            loading = false
            error = "Serveur Movviz indisponible"
            return@LaunchedEffect
        }
        val service = DownloadsApiClient.service(baseUrl)
        loading = true
        error = null
        while (true) {
            try {
                val q = service.queue()
                if (q.isSuccessful) queue = q.body()?.items.orEmpty()
                val h = service.history()
                if (h.isSuccessful) history = h.body()?.items.orEmpty()
                if (!q.isSuccessful && !h.isSuccessful) error = "Impossible de charger l'activité"
                else error = null
            } catch (_: Exception) {
                error = "Connexion au serveur impossible"
            }
            loading = false
            delay(3000)
        }
    }

    val active = remember(queue) {
        queue.filter { it.status !in setOf("completed", "seeding") }
            .sortedByDescending { it.download.progress }
    }
    val finished = remember(history) {
        history.asSequence()
            .filter { it.kind == "imported" || it.kind == "upgraded" }
            .sortedByDescending { it.timestamp }
            .distinctBy { "${it.media.type}:${it.media.tmdbId}:${it.media.season}:${it.media.episode}" }
            .take(10)
            .toList()
    }

    Box(Modifier.fillMaxSize().background(Color.Black)) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 32.dp),
        ) {
            item {
                Row(
                    Modifier.statusBarsPadding().fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    IconButton(onClick = onClose) {
                        Icon(Icons.Rounded.ArrowBack, "Retour", tint = Ink)
                    }
                    Text("Téléchargements", color = Ink, fontSize = 25.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                    IconButton(onClick = { refreshKey++ }) {
                        Icon(Icons.Rounded.Refresh, "Actualiser", tint = Ink)
                    }
                }
            }

            if (loading && queue.isEmpty() && history.isEmpty()) {
                item {
                    Box(Modifier.fillParentMaxWidth().height(180.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = Accent, strokeWidth = 2.5.dp)
                    }
                }
            }

            error?.let { message ->
                item {
                    Text(
                        message,
                        color = Color(0xFFFF8A8A),
                        fontSize = 13.sp,
                        modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp),
                    )
                }
            }

            item {
                SectionTitle("En cours", active.size)
            }
            if (!loading && active.isEmpty()) {
                item {
                    EmptyDownloadState()
                }
            } else {
                items(active, key = { it.id }) { item ->
                    ActiveDownloadRow(item) {
                        item.media.tmdbId?.let { id -> onTitleClick(item.media.type, id) }
                    }
                }
            }

            item {
                Spacer(Modifier.height(18.dp))
                SectionTitle("Terminés récemment", finished.size)
            }
            if (!loading && finished.isEmpty()) {
                item {
                    Text("Aucun téléchargement terminé récemment.", color = InkDim, fontSize = 13.sp, modifier = Modifier.padding(horizontal = 20.dp, vertical = 14.dp))
                }
            } else {
                items(finished, key = { it.id }) { item ->
                    FinishedDownloadRow(item) {
                        item.media.tmdbId?.let { id -> onTitleClick(item.media.type, id) }
                    }
                }
            }
        }
    }
}

@Composable
private fun SectionTitle(label: String, count: Int) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(label, color = Ink, fontSize = 20.sp, fontWeight = FontWeight.Bold)
        if (count > 0) Text(count.toString(), color = InkDim, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun ActiveDownloadRow(item: QueueItemDto, onClick: () -> Unit) {
    val progress = item.download.progress.coerceIn(0.0, 1.0)
    val subtitle = buildString {
        if (item.media.season != null) append("S${item.media.season}")
        if (item.media.episode != null) append(" · E${item.media.episode}")
    }.trim()
    Row(
        Modifier.fillMaxWidth().clickable(enabled = item.media.tmdbId != null, onClick = onClick).padding(horizontal = 20.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Poster(item.media.posterPath, item.media.title)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(item.media.title, color = Ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (subtitle.isNotEmpty()) Text(subtitle, color = InkDim, fontSize = 12.sp)
            Spacer(Modifier.height(8.dp))
            LinearProgressIndicator(
                progress = { progress.toFloat() },
                modifier = Modifier.fillMaxWidth().height(4.dp).clip(CircleShape),
                color = Accent,
                trackColor = Color.White.copy(alpha = 0.16f),
            )
            Spacer(Modifier.height(6.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("${(progress * 100).roundToInt()} % · ${statusLabel(item.status)}", color = InkDim, fontSize = 11.sp)
                Text(downloadMeta(item), color = InkDim, fontSize = 11.sp)
            }
        }
    }
}

@Composable
private fun FinishedDownloadRow(item: DownloadHistoryEntryDto, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clickable(enabled = item.media.tmdbId != null, onClick = onClick).padding(horizontal = 20.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Poster(item.media.posterPath, item.media.title)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(item.media.title, color = Ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            val episode = when {
                item.media.season != null && item.media.episode != null -> "S${item.media.season} · E${item.media.episode}"
                item.media.season != null -> "Saison ${item.media.season}"
                else -> if (item.media.type == "series") "Série" else "Film"
            }
            Text(episode, color = InkDim, fontSize = 12.sp)
            item.import?.qualityDetected?.takeIf { it.isNotBlank() }?.let {
                Text(it, color = InkDim, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
        Box(Modifier.size(34.dp).clip(CircleShape).background(Surface2), contentAlignment = Alignment.Center) {
            Icon(Icons.Rounded.CheckCircle, "Terminé", tint = Color(0xFF58D68D), modifier = Modifier.size(20.dp))
        }
    }
}

@Composable
private fun Poster(path: String?, title: String) {
    Box(Modifier.width(58.dp).height(84.dp).clip(RoundedCornerShape(8.dp)).background(Surface), contentAlignment = Alignment.Center) {
        if (!path.isNullOrBlank()) {
            AsyncImage(POSTER + path, title, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
        } else {
            Icon(Icons.Rounded.Download, null, tint = InkDim, modifier = Modifier.size(24.dp))
        }
    }
}

@Composable
private fun EmptyDownloadState() {
    Column(
        Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 18.dp).clip(RoundedCornerShape(16.dp)).background(Surface).padding(22.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(Icons.Rounded.Download, null, tint = InkDim, modifier = Modifier.size(32.dp))
        Spacer(Modifier.height(8.dp))
        Text("Aucun téléchargement en cours", color = Ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
        Text("Les recherches et téléchargements Movviz apparaîtront ici.", color = InkDim, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
    }
}

private fun statusLabel(status: String): String = when (status) {
    "downloading" -> "Téléchargement"
    "queued" -> "En attente"
    "paused" -> "En pause"
    "stalled" -> "Bloqué"
    "verifying" -> "Vérification"
    "importing" -> "Import"
    else -> status
}

private fun downloadMeta(item: QueueItemDto): String {
    val speed = item.download.downloadSpeed
    val eta = item.download.eta
    val speedText = when {
        speed >= 1024.0 * 1024.0 -> "%.1f Mo/s".format(speed / 1024.0 / 1024.0)
        speed >= 1024.0 -> "%.0f Ko/s".format(speed / 1024.0)
        speed > 0 -> "%.0f o/s".format(speed)
        else -> ""
    }
    val etaText = when {
        eta <= 0 -> ""
        eta < 60 -> "${eta}s"
        eta < 3600 -> "${eta / 60} min"
        else -> "${eta / 3600} h ${((eta % 3600) / 60)} min"
    }
    return listOf(speedText, etaText).filter { it.isNotBlank() }.joinToString(" · ")
}
