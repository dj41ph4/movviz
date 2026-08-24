package com.movviz.mobile.player

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import coil.compose.AsyncImage
import com.movviz.mobile.ui.theme.AnimatedLogo
import com.movviz.mobile.ui.theme.MovvizBrand
import com.movviz.mobile.ui.theme.MovvizBrandGlow
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.datasource.HttpDataSource
import androidx.media3.datasource.cache.CacheDataSource
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.mediacodec.MediaCodecUtil
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.ui.CaptionStyleCompat
import androidx.media3.ui.PlayerView
import com.movviz.mobile.MovvizMobileApplication
import com.movviz.tv.data.ApiResult
import com.movviz.tv.data.MovvizRepository
import com.movviz.tv.data.PlaybackMarkerDto
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import android.graphics.Typeface

private const val EXTRA_BASE_URL = "extra_base_url"
private const val EXTRA_TYPE = "extra_type"
private const val EXTRA_TMDB_ID = "extra_tmdb_id"
private const val EXTRA_TITLE = "extra_title"
private const val EXTRA_KEYS = "extra_keys"
private const val EXTRA_LABELS = "extra_labels"
private const val EXTRA_SEASONS = "extra_seasons"
private const val EXTRA_EPISODES = "extra_episodes"
private const val EXTRA_INDEX = "extra_index"
private const val EXTRA_POSTER_PATH = "extra_poster_path"
private const val EXTRA_LOCAL_KEYS = "extra_local_keys"
private const val EXTRA_START_FROM_BEGINNING = "extra_start_from_beginning"

data class PlayerQueueItem(
    val ratingKey: String,
    val label: String?,
    val seasonNumber: Int,
    val episodeNumber: Int,
    val localKey: String? = null,
)

private const val TAG = "MovvizMobilePlayer"
private const val SEEK_STEP_MS = 10_000L
private const val CONTROLS_TIMEOUT_MS = 3_500L
private const val PROGRESS_REPORT_INTERVAL_MS = 10_000L
private const val MAX_NETWORK_AUTO_RETRIES = 2
private const val NETWORK_RETRY_DELAY_MS = 2_000L
private const val TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w342"

private enum class PlayerErrorKind { NETWORK, AUTH, NOT_FOUND, UNSUPPORTED, UNKNOWN }

private val NETWORK_ERROR_CODES = intArrayOf(
    PlaybackException.ERROR_CODE_IO_UNSPECIFIED,
    PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_FAILED,
    PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_TIMEOUT,
    PlaybackException.ERROR_CODE_IO_INVALID_HTTP_CONTENT_TYPE,
    PlaybackException.ERROR_CODE_IO_READ_POSITION_OUT_OF_RANGE,
    PlaybackException.ERROR_CODE_TIMEOUT,
)
private val UNSUPPORTED_ERROR_CODES = intArrayOf(
    PlaybackException.ERROR_CODE_DECODER_INIT_FAILED,
    PlaybackException.ERROR_CODE_DECODER_QUERY_FAILED,
    PlaybackException.ERROR_CODE_DECODING_FAILED,
    PlaybackException.ERROR_CODE_DECODING_FORMAT_EXCEEDS_CAPABILITIES,
    PlaybackException.ERROR_CODE_DECODING_FORMAT_UNSUPPORTED,
    PlaybackException.ERROR_CODE_PARSING_CONTAINER_MALFORMED,
    PlaybackException.ERROR_CODE_PARSING_MANIFEST_MALFORMED,
    PlaybackException.ERROR_CODE_PARSING_CONTAINER_UNSUPPORTED,
    PlaybackException.ERROR_CODE_PARSING_MANIFEST_UNSUPPORTED,
)
private fun classifyError(error: PlaybackException): PlayerErrorKind {
    if (error.errorCode == PlaybackException.ERROR_CODE_IO_BAD_HTTP_STATUS) {
        val httpCode = (error.cause as? HttpDataSource.InvalidResponseCodeException)?.responseCode
        return when (httpCode) {
            401, 403 -> PlayerErrorKind.AUTH
            404 -> PlayerErrorKind.NOT_FOUND
            else -> PlayerErrorKind.NETWORK
        }
    }
    if (error.errorCode == PlaybackException.ERROR_CODE_IO_FILE_NOT_FOUND) return PlayerErrorKind.NOT_FOUND
    if (error.errorCode in NETWORK_ERROR_CODES) return PlayerErrorKind.NETWORK
    if (error.errorCode in UNSUPPORTED_ERROR_CODES) return PlayerErrorKind.UNSUPPORTED
    return PlayerErrorKind.UNKNOWN
}
private fun messageFor(kind: PlayerErrorKind): String = when (kind) {
    PlayerErrorKind.NETWORK -> "Connexion au serveur perdue."
    PlayerErrorKind.AUTH -> "Session expirée — reconnecte-toi."
    PlayerErrorKind.NOT_FOUND -> "Fichier plus disponible."
    PlayerErrorKind.UNSUPPORTED -> "Format non pris en charge."
    PlayerErrorKind.UNKNOWN -> "Lecture impossible."
}
private fun videoMimeType(codec: String?): String? = when {
    codec == null -> null
    codec.contains("h264") || codec.contains("avc") -> MimeTypes.VIDEO_H264
    codec.contains("hevc") || codec.contains("h265") || codec.contains("hev1") || codec.contains("hvc1") -> MimeTypes.VIDEO_H265
    codec.contains("av1") || codec.contains("av01") -> MimeTypes.VIDEO_AV1
    codec.contains("vp9") || codec.contains("vp09") -> MimeTypes.VIDEO_VP9
    codec.contains("vp8") -> MimeTypes.VIDEO_VP8
    codec.contains("mpeg4") || codec.contains("mp4v") -> MimeTypes.VIDEO_MP4V
    codec.contains("mpeg2") -> MimeTypes.VIDEO_MPEG2
    else -> null
}
private fun audioMimeType(codec: String?): String? = when {
    codec == null -> null
    codec.contains("aac") || codec.contains("mp4a") -> MimeTypes.AUDIO_AAC
    codec.contains("mp3") || codec.contains("mpga") || codec.contains("mpeg") -> MimeTypes.AUDIO_MPEG
    codec.contains("ac3") || codec.contains("ac-3") -> MimeTypes.AUDIO_AC3
    codec.contains("eac3") || codec.contains("ec-3") || codec.contains("e-ac3") -> MimeTypes.AUDIO_E_AC3
    codec.contains("dts") || codec.contains("dca") -> if (codec.contains("hd")) MimeTypes.AUDIO_DTS_HD else MimeTypes.AUDIO_DTS
    codec.contains("truehd") || codec.contains("mlp") -> MimeTypes.AUDIO_TRUEHD
    codec.contains("opus") -> MimeTypes.AUDIO_OPUS
    codec.contains("flac") -> MimeTypes.AUDIO_FLAC
    codec.contains("vorbis") -> MimeTypes.AUDIO_VORBIS
    else -> null
}
private fun hasPlatformAudioDecoder(mime: String?): Boolean {
    if (mime == null) return true
    return try { MediaCodecUtil.getDecoderInfos(mime, false, false).isNotEmpty() } catch (_: Exception) { true }
}
private fun hasPlatformVideoDecoder(mime: String?): Boolean {
    if (mime == null) return true
    return try { MediaCodecUtil.getDecoderInfos(mime, false, false).isNotEmpty() } catch (_: Exception) { true }
}

class PlayerActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Immersive fullscreen — the status bar (clock, notification icons)
        // was never hidden here, so it sat on top of the video for the whole
        // playback. Swiping from the edge still reveals it temporarily
        // (standard system gesture), and it comes back on its own once the
        // player closes since this is a dedicated, short-lived Activity.
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).let { controller ->
            controller.hide(WindowInsetsCompat.Type.systemBars())
            controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }

        val baseUrl = intent.getStringExtra(EXTRA_BASE_URL) ?: run { finish(); return }
        val keys = intent.getStringArrayListExtra(EXTRA_KEYS)?.takeIf { it.isNotEmpty() } ?: run { finish(); return }
        val localKeys = intent.getStringArrayListExtra(EXTRA_LOCAL_KEYS) ?: arrayListOf()
        val labels = intent.getStringArrayListExtra(EXTRA_LABELS) ?: arrayListOf()
        val seasons = intent.getIntArrayExtra(EXTRA_SEASONS) ?: IntArray(keys.size) { -1 }
        val episodes = intent.getIntArrayExtra(EXTRA_EPISODES) ?: IntArray(keys.size) { -1 }
        val startIndex = intent.getIntExtra(EXTRA_INDEX, 0).coerceIn(0, keys.size - 1)
        val mainTitle = intent.getStringExtra(EXTRA_TITLE) ?: ""
        val type = intent.getStringExtra(EXTRA_TYPE) ?: "movie"
        val tmdbId = intent.getIntExtra(EXTRA_TMDB_ID, 0)
        val startFromBeginning = intent.getBooleanExtra(EXTRA_START_FROM_BEGINNING, false)
        val posterPath = intent.getStringExtra(EXTRA_POSTER_PATH)

        val queue = keys.indices.map { i ->
            PlayerQueueItem(
                ratingKey = keys[i],
                label = labels.getOrNull(i)?.takeIf { it.isNotBlank() },
                seasonNumber = seasons.getOrElse(i) { -1 },
                episodeNumber = episodes.getOrElse(i) { -1 },
                localKey = localKeys.getOrNull(i)?.takeIf { it.isNotBlank() },
            )
        }
        setContent {
            MaterialTheme(colorScheme = darkColorScheme(primary = Color(0xFF7C5CFF), surface = Color.Black, background = Color.Black)) {
                Box(Modifier.fillMaxSize().background(Color.Black)) {
                    PlayerScreen(
                        baseUrl = baseUrl,
                        mainTitle = mainTitle,
                        type = type,
                        tmdbId = tmdbId,
                        queue = queue,
                        startIndex = startIndex,
                        startFromBeginning = startFromBeginning,
                        posterPath = posterPath,
                        onExit = { finish() }
                    )
                }
            }
        }
    }
    companion object {
        fun forMovie(context: Context, baseUrl: String, ratingKey: String, tmdbId: Int, title: String, posterPath: String? = null): Intent =
            forQueue(context, baseUrl, "movie", tmdbId, title, listOf(PlayerQueueItem(ratingKey, null, -1, -1)), 0, posterPath = posterPath)

        fun forQueue(
            context: Context,
            baseUrl: String,
            type: String,
            tmdbId: Int,
            title: String,
            queue: List<PlayerQueueItem>,
            startIndex: Int,
            startFromBeginning: Boolean = false,
            posterPath: String? = null,
        ): Intent = Intent(context, PlayerActivity::class.java).apply {
            putExtra(EXTRA_BASE_URL, baseUrl)
            putExtra(EXTRA_TYPE, type)
            putExtra(EXTRA_TMDB_ID, tmdbId)
            putExtra(EXTRA_TITLE, title)
            putStringArrayListExtra(EXTRA_KEYS, ArrayList(queue.map { it.ratingKey }))
            putStringArrayListExtra(EXTRA_LABELS, ArrayList(queue.map { it.label ?: "" }))
            putExtra(EXTRA_SEASONS, queue.map { it.seasonNumber }.toIntArray())
            putExtra(EXTRA_EPISODES, queue.map { it.episodeNumber }.toIntArray())
            putExtra(EXTRA_INDEX, startIndex)
            putExtra(EXTRA_START_FROM_BEGINNING, startFromBeginning)
            putExtra(EXTRA_POSTER_PATH, posterPath)
            putStringArrayListExtra(EXTRA_LOCAL_KEYS, ArrayList(queue.map { it.localKey ?: "" }))
        }
    }
}

@Composable
private fun PlayerScreen(
    baseUrl: String,
    mainTitle: String,
    type: String,
    tmdbId: Int,
    queue: List<PlayerQueueItem>,
    startIndex: Int,
    startFromBeginning: Boolean,
    posterPath: String?,
    onExit: () -> Unit,
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val scope = rememberCoroutineScope()
    val repository = remember(baseUrl) { MovvizRepository(baseUrl) }

    // Playback is watched fullscreen landscape almost exclusively — the
    // control panel below used the exact same fixed dp sizing regardless of
    // orientation, which is comfortable in portrait's tall column but eats a
    // disproportionate share of a landscape phone's much shorter height
    // (confirmed live in the emulator: progress bar + transport row + title
    // row together covered close to half the screen). Landscape gets a
    // visibly tighter version of the same panel — smaller controls, less
    // padding between rows, sitting closer to the bottom edge — portrait is
    // untouched.
    val isLandscape = androidx.compose.ui.platform.LocalConfiguration.current.orientation ==
        android.content.res.Configuration.ORIENTATION_LANDSCAPE

    val view = androidx.compose.ui.platform.LocalView.current
    DisposableEffect(Unit) {
        view.keepScreenOn = true
        onDispose { view.keepScreenOn = false }
    }

    var currentIndex by remember { mutableStateOf(startIndex) }
    val current = queue[currentIndex]
    val hasNext = currentIndex < queue.size - 1
    val hasPrev = currentIndex > 0

    var showControls by remember { mutableStateOf(true) }
    var isPlaying by remember { mutableStateOf(true) }
    var loading by remember { mutableStateOf(true) }
    var lastError by remember { mutableStateOf<PlaybackException?>(null) }
    var hasRenderedFrame by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var errorKind by remember { mutableStateOf<PlayerErrorKind?>(null) }
    var networkRetryCount by remember { mutableStateOf(0) }
    var tracksVersion by remember { mutableStateOf(0) }
    var seekIndicator by remember { mutableStateOf<String?>(null) }
    var showNextEpisodeTeaser by remember { mutableStateOf(false) }
    var nextEpisodeCountdown by remember { mutableStateOf(0L) }
    var fallbackLevel by remember { mutableStateOf(0) }
    var fallbackNotice by remember { mutableStateOf<String?>(null) }
    var level1FfmpegAvailable by remember { mutableStateOf(false) }
    var level1AudioStreamId by remember { mutableStateOf<String?>(null) }
    var markers by remember(current.ratingKey) { mutableStateOf<List<PlaybackMarkerDto>>(emptyList()) }
    var activeMarker by remember { mutableStateOf<PlaybackMarkerDto?>(null) }
    var playbackSessionId by remember(current.ratingKey) { mutableStateOf<String?>(null) }

    val exoPlayer = remember {
        val upstream = OkHttpDataSource.Factory(com.movviz.tv.data.ApiClient.httpClient())
        val cache = (context.applicationContext as MovvizMobileApplication).videoCache()
        val dataSourceFactory = CacheDataSource.Factory()
            .setCache(cache)
            .setUpstreamDataSourceFactory(upstream)
            .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR)
        val mediaSourceFactory = DefaultMediaSourceFactory(context).setDataSourceFactory(dataSourceFactory)
        // Identique TV : 30s min / 120s max / 2.5s start / 5s resume / 64MB — absorbe pointes Plex/NAS distant
        val loadControl = DefaultLoadControl.Builder()
            .setBufferDurationsMs(30_000, 120_000, 2_500, 5_000)
            .setTargetBufferBytes(64 * 1024 * 1024)
            .build()
        ExoPlayer.Builder(context)
            .setLoadControl(loadControl)
            .setMediaSourceFactory(mediaSourceFactory)
            .build()
    }

    val mediaSession = remember(exoPlayer) {
        val sessionActivity = PendingIntent.getActivity(
            context, 0,
            Intent(context, com.movviz.mobile.MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        androidx.media3.session.MediaSession.Builder(context, exoPlayer)
            .setSessionActivity(sessionActivity)
            .build()
    }
    DisposableEffect(mediaSession) { onDispose { mediaSession.release() } }

    fun mediaMetadata(item: PlayerQueueItem): MediaMetadata {
        val isEpisode = item.seasonNumber > 0 && item.episodeNumber > 0
        return MediaMetadata.Builder()
            .setTitle(if (isEpisode && item.label != null) "$mainTitle — ${item.label}" else mainTitle)
            .setSubtitle(if (isEpisode && item.label != null) mainTitle else null)
            .setArtworkUri(posterPath?.let { Uri.parse("$TMDB_IMAGE_BASE$it") })
            .build()
    }

    fun load(item: PlayerQueueItem, resumeMs: Long, level: Int = 0) {
        loading = true
        hasRenderedFrame = false
        errorMessage = null
        errorKind = null
        lastError = null
        val metadata = mediaMetadata(item)
        val mediaItem = when (level) {
            1 -> if (level1FfmpegAvailable) {
                val url = repository.ffmpegRemuxUrl(item.ratingKey, level1AudioStreamId)
                Log.i(TAG, "remux ffmpeg local: $url resume=$resumeMs")
                MediaItem.Builder().setUri(url).setMediaMetadata(metadata).build()
            } else {
                val url = repository.transcodeUrl(item.ratingKey)
                Log.i(TAG, "transcode audio-seul DASH: $url resume=$resumeMs")
                MediaItem.Builder().setUri(url).setMimeType(MimeTypes.APPLICATION_MPD).setMediaMetadata(metadata).build()
            }
            2 -> {
                val url = repository.transcodeFullUrl(item.ratingKey)
                Log.i(TAG, "transcode complet HLS: $url resume=$resumeMs")
                MediaItem.Builder().setUri(url).setMimeType(MimeTypes.APPLICATION_M3U8).setMediaMetadata(metadata).build()
            }
            else -> MediaItem.Builder()
                .setUri(
                    if (item.localKey != null && item.seasonNumber > 0 && item.episodeNumber > 0)
                        repository.localEpisodeUrl(item.localKey, item.seasonNumber, item.episodeNumber)
                    else if (item.localKey != null) repository.localMovieUrl(item.localKey)
                    else repository.streamUrl(item.ratingKey)
                )
                .setMediaMetadata(metadata)
                .build()
        }
        exoPlayer.setMediaItem(mediaItem)
        exoPlayer.prepare()
        if (resumeMs > 0) exoPlayer.seekTo(resumeMs)
        exoPlayer.playWhenReady = true
    }

    LaunchedEffect(current.ratingKey, current.localKey, current.seasonNumber, current.episodeNumber) {
        networkRetryCount = 0
        fallbackLevel = 0
        fallbackNotice = null
        val localEpisode = current.localKey != null && current.seasonNumber > 0 && current.episodeNumber > 0
        val localInfo = if (localEpisode) {
            (repository.localEpisodeInfo(current.localKey!!, current.seasonNumber, current.episodeNumber) as? ApiResult.Success)?.data
        } else null
        val plexInfo = if (!localEpisode) (repository.streamInfo(current.ratingKey) as? ApiResult.Success)?.data else null
        markers = (localInfo?.markers ?: plexInfo?.markers).orEmpty()
        activeMarker = null
        val info = plexInfo
        val knownDuration = plexInfo?.durationMs
        val playbackSession = knownDuration?.takeIf { it > 0 }?.let {
            repository.openPlaybackSession(current.ratingKey, it, tmdbId, current.label ?: mainTitle, if (type == "series") "episode" else "movie")
        }
        playbackSessionId = playbackSession?.sessionId
        val videoMime = videoMimeType(info?.videoCodec)
        val selectedAudio = info?.audioStreams?.firstOrNull { it.selected } ?: info?.audioStreams?.firstOrNull()
        val audioMime = audioMimeType(selectedAudio?.codec ?: info?.audioCodec)
        val videoDecodable = videoMime == null || hasPlatformVideoDecoder(videoMime)
        val audioDecodable = audioMime == null || hasPlatformAudioDecoder(audioMime)
        level1FfmpegAvailable = info?.ffmpegAvailable == true
        level1AudioStreamId = selectedAudio?.id
        val startLevel = when {
            info != null && !videoDecodable -> 2
            info != null && !audioDecodable -> 1
            else -> 0
        }
        Log.i(TAG, "pré-décision v=${info?.videoCodec ?: "?"} (${videoDecodable}) a=${selectedAudio?.codec ?: info?.audioCodec ?: "?"} (${audioDecodable}) → niveau $startLevel")
        if (startLevel == 2) { fallbackLevel = 2; fallbackNotice = "Transcodage complet…" } else if (startLevel == 1) { fallbackLevel = 1; fallbackNotice = "Compatibilité optimisée…" }
        val resume = if (startFromBeginning && currentIndex == startIndex) 0L else playbackSession?.resumeOffsetMs ?: repository.resumeOffsetMs(
            type = type, tmdbId = tmdbId, durationMs = knownDuration,
            seasonNumber = current.seasonNumber.takeIf { it >= 0 }, episodeNumber = current.episodeNumber.takeIf { it >= 0 }
        ) ?: 0L
        load(current, resume, level = startLevel)
    }

    DisposableEffect(exoPlayer) {
        val listener = object : Player.Listener {
            override fun onIsPlayingChanged(playing: Boolean) { isPlaying = playing }
            override fun onPlaybackStateChanged(state: Int) {
                loading = state == Player.STATE_BUFFERING
                if (state == Player.STATE_READY) hasRenderedFrame = true
                if (state == Player.STATE_ENDED) {
                    if (currentIndex < queue.size - 1) {
                        playbackSessionId?.let { id -> scope.launch { repository.playbackEnded(id) } }
                        currentIndex += 1
                    } else {
                        playbackSessionId?.let { id -> scope.launch { repository.playbackEnded(id) } }
                        onExit()
                    }
                }
            }
            override fun onPlayerError(error: PlaybackException) {
                val kind = classifyError(error)
                lastError = error
                Log.w(TAG, "onPlayerError code=${error.errorCode} kind=$kind level=$fallbackLevel", error)
                if (kind == PlayerErrorKind.NETWORK && networkRetryCount < MAX_NETWORK_AUTO_RETRIES) {
                    networkRetryCount += 1
                    val resumePos = exoPlayer.currentPosition.coerceAtLeast(0)
                    loading = true
                    val item = queue[currentIndex]
                    scope.launch { delay(NETWORK_RETRY_DELAY_MS); load(item, resumePos, level = fallbackLevel) }
                    return
                }
                if (kind == PlayerErrorKind.UNSUPPORTED && fallbackLevel < 2) {
                    fallbackLevel += 1
                    val resumePos = exoPlayer.currentPosition.coerceAtLeast(0)
                    val item = queue[currentIndex]
                    Log.i(TAG, "repli transcodage niveau $fallbackLevel")
                    fallbackNotice = "Compatibilité optimisée…"
                    // Petit délai pour laisser le décodeur libérer (évite IllegalStateException queueInputBuffer Released)
                    scope.launch { delay(400); load(item, resumePos, level = fallbackLevel) }
                    return
                }
                // Dernier recours émulateur : le décodeur AAC goldfish est cassé (mp4a.40.2 Error 0xe) — on désactive l'audio pour laisser la vidéo tourner 30s
                if (kind == PlayerErrorKind.UNSUPPORTED && fallbackLevel >= 2 && error.errorCode == PlaybackException.ERROR_CODE_DECODING_FAILED) {
                    val isAudio = error.message?.contains("AudioRenderer", ignoreCase = true) == true || error.cause?.message?.contains("aac", ignoreCase = true) == true
                    if (isAudio || error.errorCode == PlaybackException.ERROR_CODE_DECODING_FAILED) {
                        Log.w(TAG, "Fallback ultime : désactivation audio (émulateur AAC cassé)")
                        exoPlayer.trackSelectionParameters = exoPlayer.trackSelectionParameters.buildUpon().setTrackTypeDisabled(C.TRACK_TYPE_AUDIO, true).build()
                        fallbackNotice = "Audio désactivé (émulateur)"
                        val resumePos = exoPlayer.currentPosition.coerceAtLeast(0)
                        val item = queue[currentIndex]
                        scope.launch { delay(400); load(item, resumePos, level = fallbackLevel) }
                        // Empêche boucle infinie
                        fallbackLevel = 3
                        return
                    }
                }
                errorKind = kind
                errorMessage = messageFor(kind)
            }
            override fun onTracksChanged(tracks: androidx.media3.common.Tracks) { tracksVersion++ }
        }
        exoPlayer.addListener(listener)
        onDispose { exoPlayer.removeListener(listener); exoPlayer.release() }
    }

    DisposableEffect(Unit) {
        onDispose {
            runCatching {
                kotlinx.coroutines.runBlocking {
                    val id = playbackSessionId
                    if (id != null) repository.playbackStop(id, exoPlayer.currentPosition)
                    repository.reportStop(queue[currentIndex].ratingKey)
                }
            }
        }
    }

    LaunchedEffect(current.ratingKey) {
        var sequence = 0L
        while (true) {
            delay(PROGRESS_REPORT_INTERVAL_MS.toLong())
            val id = playbackSessionId
            if (id != null) repository.playbackHeartbeat(id, ++sequence, exoPlayer.currentPosition, isPlaying)
            repository.reportProgress(current.ratingKey, exoPlayer.currentPosition, if (isPlaying) "playing" else "paused")
        }
    }
    LaunchedEffect(fallbackNotice) {
        if (fallbackNotice == null) return@LaunchedEffect
        delay(2_500L); fallbackNotice = null
    }
    LaunchedEffect(seekIndicator) {
        if (seekIndicator == null) return@LaunchedEffect
        delay(1_000L); seekIndicator = null
    }
    LaunchedEffect(current.ratingKey, hasNext) {
        showNextEpisodeTeaser = false
        while (true) {
            delay(1_000L)
            if (!hasNext) { showNextEpisodeTeaser = false; continue }
            val pos = exoPlayer.currentPosition
            val dur = exoPlayer.duration.coerceAtLeast(0)
            if (dur > 0 && pos > dur - 45_000L) {
                showNextEpisodeTeaser = true
                nextEpisodeCountdown = ((dur - pos) / 1000L).coerceAtLeast(0)
            } else showNextEpisodeTeaser = false
        }
    }
    // Détection intro/credits toutes les 500ms
    LaunchedEffect(current, markers) {
        while (true) {
            delay(500L)
            val pos = exoPlayer.currentPosition
            activeMarker = markers.firstOrNull { pos >= it.startMs && pos < it.endMs }
        }
    }

    var lastInteraction by remember { mutableStateOf(System.currentTimeMillis()) }
    LaunchedEffect(lastInteraction) {
        showControls = true
        delay(CONTROLS_TIMEOUT_MS.toLong())
        if (activeMarker == null) showControls = false
    }
    fun poke() { lastInteraction = System.currentTimeMillis() }

    fun playPauseAction() { poke(); if (exoPlayer.isPlaying) exoPlayer.pause() else exoPlayer.play() }
    fun seekBackAction() { poke(); exoPlayer.seekTo((exoPlayer.currentPosition - SEEK_STEP_MS).coerceAtLeast(0)); seekIndicator = "−10s" }
    fun seekForwardAction() { poke(); exoPlayer.seekTo((exoPlayer.currentPosition + SEEK_STEP_MS).coerceAtMost(exoPlayer.duration.coerceAtLeast(0))); seekIndicator = "+10s" }
    fun prevEpisodeAction() { poke(); if (currentIndex > 0) currentIndex -= 1 }
    fun skipMarkerAction() {
        val m = activeMarker ?: return
        poke()
        playbackSessionId?.let { id -> scope.launch { repository.playbackSeek(id, m.endMs, "skip_marker", m.type) } }
        exoPlayer.seekTo(m.endMs)
    }
    fun nextEpisodeAction() { poke(); if (currentIndex < queue.size - 1) currentIndex += 1 }

    BackHandler(enabled = true) { onExit() }

    Box(
        Modifier.fillMaxSize().background(Color.Black)
            .clickable(interactionSource = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }, indication = null) { poke() }
    ) {
        AndroidView(
            factory = { ctx ->
                PlayerView(ctx).apply {
                    player = exoPlayer
                    useController = false
                    isFocusable = false
                    isFocusableInTouchMode = false
                    descendantFocusability = android.view.ViewGroup.FOCUS_BLOCK_DESCENDANTS
                    subtitleView?.setApplyEmbeddedStyles(false)
                    subtitleView?.setApplyEmbeddedFontSizes(false)
                    subtitleView?.setStyle(
                        CaptionStyleCompat(
                            android.graphics.Color.WHITE,
                            android.graphics.Color.TRANSPARENT,
                            android.graphics.Color.TRANSPARENT,
                            CaptionStyleCompat.EDGE_TYPE_DROP_SHADOW,
                            android.graphics.Color.argb(200, 0, 0, 0),
                            Typeface.DEFAULT_BOLD
                        )
                    )
                    subtitleView?.setFractionalTextSize(0.055f)
                }
            },
            modifier = Modifier.fillMaxSize()
        )

        // Voile "optimisation" — identique desktop (VideoPlayer.tsx ~2553-2559) :
        // fond opaque + logo animé + libellé fixe pendant toute la phase de
        // sélection d'engine/escalation de niveau (load() remet hasRenderedFrame
        // à false à chaque tentative — voir plus haut). Jamais le spinner de
        // buffering mi-lecture, qui reste un overlay séparé (hasRenderedFrame &&
        // loading, plus bas) — même distinction que côté desktop entre
        // `optimizing` et le spinner `buffering` normal.
        if (!hasRenderedFrame && loading) {
            Box(Modifier.fillMaxSize().background(Color.Black), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    AnimatedLogo(size = 64.dp)
                    Text("Optimisation en cours…", color = Color.White.copy(0.6f), fontSize = 12.sp, fontWeight = FontWeight.Medium)
                }
            }
        } else if (!hasRenderedFrame && errorMessage != null) {
            Box(Modifier.fillMaxSize().background(Color.Black), contentAlignment = Alignment.Center) {
                Column(Modifier.padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(errorMessage!!, color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    lastError?.let { Text("Code ${it.errorCode}", color = Color.White.copy(0.5f), fontSize = 12.sp) }
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Button(onClick = { errorMessage = null; load(current, exoPlayer.currentPosition.coerceAtLeast(0), fallbackLevel) }, colors = ButtonDefaults.buttonColors(containerColor = Color.White)) {
                            Text("Réessayer", color = Color.Black)
                        }
                        OutlinedButton(onClick = onExit, colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White)) { Text("Quitter") }
                    }
                }
            }
        }

        // Indicateur seek flottant
        AnimatedVisibility(visible = seekIndicator != null, enter = fadeIn(), exit = fadeOut(), modifier = Modifier.align(Alignment.Center)) {
            Box(Modifier.clip(RoundedCornerShape(12.dp)).background(Color.Black.copy(0.65f)).padding(horizontal = 18.dp, vertical = 10.dp)) {
                Text(seekIndicator ?: "", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
            }
        }

        // Notice fallback furtive
        AnimatedVisibility(visible = fallbackNotice != null && hasRenderedFrame, enter = fadeIn(), exit = fadeOut(), modifier = Modifier.align(Alignment.TopCenter).padding(top = 48.dp)) {
            Box(Modifier.clip(RoundedCornerShape(20.dp)).background(Color.White.copy(0.15f)).padding(horizontal = 14.dp, vertical = 6.dp)) {
                Text(fallbackNotice ?: "", color = Color.White, fontSize = 12.sp)
            }
        }

        // Bouton "Passer le générique / intro" — comme TV mais tactile 44dp mini
        AnimatedVisibility(
            visible = activeMarker != null && errorMessage == null,
            enter = fadeIn(), exit = fadeOut(),
            modifier = Modifier.align(Alignment.BottomEnd).padding(bottom = 98.dp, end = 16.dp)
        ) {
            val label = when (activeMarker?.type) {
                "intro" -> "Passer l'intro"
                "credits" -> "Passer le générique"
                else -> "Passer"
            }
            Button(
                onClick = { skipMarkerAction() },
                modifier = Modifier.heightIn(min = 44.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color.White),
                contentPadding = PaddingValues(horizontal = 18.dp, vertical = 10.dp)
            ) {
                Icon(Icons.Rounded.SkipNext, null, tint = Color.Black, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(6.dp))
                Text(label, color = Color.Black, fontWeight = FontWeight.Bold, fontSize = 13.sp)
            }
        }

        // Teaser épisode suivant — en bas à droite, au-dessus des contrôles
        AnimatedVisibility(
            visible = showNextEpisodeTeaser && hasNext && errorMessage == null,
            enter = fadeIn(), exit = fadeOut(),
            modifier = Modifier.align(Alignment.BottomEnd).padding(bottom = 150.dp, end = 16.dp)
        ) {
            val next = queue.getOrNull(currentIndex + 1)
            Box(
                Modifier.clip(RoundedCornerShape(14.dp)).background(Color(0xFF1A1A1A).copy(0.92f))
                    .clickable { nextEpisodeAction() }.padding(12.dp)
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Épisode suivant", color = Color.White.copy(0.7f), fontSize = 11.sp)
                    Text(next?.label ?: "Suivant", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    Text("Dans ${nextEpisodeCountdown}s — appuyer pour passer", color = Color.White.copy(0.5f), fontSize = 11.sp)
                }
            }
        }

        // Contrôles bottom — auto-hide
        AnimatedVisibility(
            visible = showControls && hasRenderedFrame && errorMessage == null,
            enter = fadeIn(), exit = fadeOut(),
            modifier = Modifier.align(Alignment.BottomCenter)
        ) {
            val edgeBtn = if (isLandscape) 38.dp else 44.dp
            val edgeIcon = if (isLandscape) 19.dp else 22.dp
            val centerBtn = if (isLandscape) 48.dp else 56.dp
            val centerIcon = if (isLandscape) 24.dp else 28.dp
            Column(
                Modifier.fillMaxWidth()
                    .background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(0.85f))))
                    // Hugs the actual screen edge — navigationBarsPadding()
                    // adds real inset room back only where a gesture pill or
                    // 3-button nav bar would otherwise sit on top of it
                    // (system bars are hidden during playback, but the swipe-
                    // to-reveal gesture can still bring them back momentarily).
                    .navigationBarsPadding()
                    .padding(horizontal = 16.dp, vertical = if (isLandscape) 6.dp else 12.dp)
            ) {
                // Barre progression + temps — glass card flottante, piste
                // fine + fill brand-gradient + poignée à halo, aperçu au
                // scrub — même langage visuel que le lecteur desktop
                // (VideoPlayer.tsx ~2680-2735).
                PlayerProgressBar(exoPlayer = exoPlayer, baseUrl = baseUrl, ratingKey = current.ratingKey, onSeek = { poke() })

                Spacer(Modifier.height(if (isLandscape) 4.dp else 8.dp))

                // Transport — pill glass, identique desktop (~2737-2770+) ;
                // bouton central brand-gradient (CTA primaire, cf. charte
                // visuelle Movviz), prev/-10s/+10s/next inchangés en glass.
                Row(
                    Modifier.fillMaxWidth()
                        .clip(RoundedCornerShape(24.dp))
                        .background(Color(0xFF12121E).copy(alpha = 0.92f))
                        .border(1.dp, Color.White.copy(0.07f), RoundedCornerShape(24.dp))
                        .padding(horizontal = 10.dp, vertical = if (isLandscape) 4.dp else 8.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    // Gauche : prev + -10s
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        IconButton(onClick = { prevEpisodeAction() }, enabled = hasPrev, modifier = Modifier.size(edgeBtn).clip(CircleShape).background(Color.White.copy(if (hasPrev) 0.14f else 0.06f))) {
                            Icon(Icons.Rounded.SkipPrevious, null, tint = Color.White.copy(if (hasPrev) 1f else 0.35f), modifier = Modifier.size(edgeIcon))
                        }
                        IconButton(onClick = { seekBackAction() }, modifier = Modifier.size(edgeBtn).clip(CircleShape).background(Color.White.copy(0.14f))) {
                            Icon(Icons.Rounded.Replay10, null, tint = Color.White, modifier = Modifier.size(edgeIcon))
                        }
                    }

                    // Centre : play/pause — brand-gradient (primaire), plus grand que les actions secondaires
                    Box(
                        Modifier.size(centerBtn).clip(CircleShape)
                            .background(Brush.linearGradient(listOf(MovvizBrand, MovvizBrandGlow)))
                            .clickable { playPauseAction() },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            if (isPlaying) Icons.Rounded.Pause else Icons.Rounded.PlayArrow,
                            null, tint = Color.White, modifier = Modifier.size(centerIcon)
                        )
                    }

                    // Droite : +10s + next
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        IconButton(onClick = { seekForwardAction() }, modifier = Modifier.size(edgeBtn).clip(CircleShape).background(Color.White.copy(0.14f))) {
                            Icon(Icons.Rounded.Forward10, null, tint = Color.White, modifier = Modifier.size(edgeIcon))
                        }
                        IconButton(onClick = { nextEpisodeAction() }, enabled = hasNext, modifier = Modifier.size(edgeBtn).clip(CircleShape).background(Color.White.copy(if (hasNext) 0.14f else 0.06f))) {
                            Icon(Icons.Rounded.SkipNext, null, tint = Color.White.copy(if (hasNext) 1f else 0.35f), modifier = Modifier.size(edgeIcon))
                        }
                    }
                }
            }
        }

        // Titre + fermeture — en haut à gauche en permanence (même
        // emplacement qu'Android TV, jamais dupliqué en bas) ; le panneau du
        // bas n'a donc plus qu'à porter progression + transport, au plus
        // près du bord inférieur de l'image.
        if (hasRenderedFrame && errorMessage == null) {
            Row(
                Modifier.fillMaxWidth().align(Alignment.TopCenter)
                    .background(Brush.verticalGradient(listOf(Color.Black.copy(0.55f), Color.Transparent)))
                    .padding(horizontal = 16.dp, vertical = if (isLandscape) 6.dp else 12.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Column(Modifier.weight(1f)) {
                    Text(mainTitle, color = Color.White.copy(0.9f), fontSize = 13.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
                    if (showControls) current.label?.let { Text(it, color = Color.White.copy(0.65f), fontSize = 11.sp, maxLines = 1) }
                }
                if (showControls) {
                    IconButton(onClick = onExit, modifier = Modifier.size(if (isLandscape) 30.dp else 36.dp)) {
                        Icon(Icons.Rounded.Close, null, tint = Color.White.copy(0.7f), modifier = Modifier.size(if (isLandscape) 17.dp else 20.dp))
                    }
                }
            }
        }

        // Buffering discret quand déjà rendu
        if (hasRenderedFrame && loading) {
            Box(Modifier.align(Alignment.Center).clip(RoundedCornerShape(20.dp)).background(Color.Black.copy(0.55f)).padding(horizontal = 14.dp, vertical = 8.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    CircularProgressIndicator(color = Color.White, modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                    Text("Chargement…", color = Color.White, fontSize = 12.sp)
                }
            }
        }
    }
}

/** Desktop-parity progress bar (VideoPlayer.tsx ~2680-2735): floating glass
 *  card, slim track, lighter buffered fill layered under a brand-gradient
 *  played fill, a small white handle with a soft brand-glow halo, tabular
 *  time labels either side, and a scrub-preview popover (real BIF thumbnail
 *  via the same /api/stream/{ratingKey}/scrub-thumb proxy desktop uses,
 *  debounced 150ms — see ScrubPreview below) while dragging. Touch-drag via
 *  an invisible Material Slider layered over the hand-drawn track, same
 *  technique the previous version already used for gesture handling. */
@Composable
private fun PlayerProgressBar(exoPlayer: ExoPlayer, baseUrl: String, ratingKey: String, onSeek: () -> Unit) {
    var duration by remember { mutableStateOf(exoPlayer.duration.coerceAtLeast(0)) }
    var position by remember { mutableStateOf(exoPlayer.currentPosition.coerceAtLeast(0)) }
    var buffered by remember { mutableStateOf(exoPlayer.bufferedPosition.coerceAtLeast(0)) }
    var isDragging by remember { mutableStateOf(false) }
    var dragPosition by remember { mutableStateOf(0L) }
    var thumbMs by remember { mutableStateOf<Long?>(null) }

    LaunchedEffect(exoPlayer) {
        while (true) {
            delay(250L)
            duration = exoPlayer.duration.coerceAtLeast(0)
            if (!isDragging) position = exoPlayer.currentPosition.coerceAtLeast(0)
            buffered = exoPlayer.bufferedPosition.coerceAtLeast(0)
        }
    }

    // Débattu 150ms comme desktop (requestScrubThumb) — sans ça, un glissé
    // rapide sur un film de 2h déclencherait des dizaines de requêtes BIF
    // Plex par seconde. Coil dédoublonne/cache déjà par URL (secondes
    // arrondies ci-dessous), inutile de recoder un cache manuel côté client.
    LaunchedEffect(isDragging, dragPosition) {
        if (!isDragging) { thumbMs = null; return@LaunchedEffect }
        delay(150L)
        thumbMs = (dragPosition / 1000L) * 1000L
    }

    fun fmt(ms: Long): String {
        val s = (ms / 1000).toInt()
        val h = s / 3600
        val m = (s % 3600) / 60
        val sec = s % 60
        return if (h > 0) "%d:%02d:%02d".format(h, m, sec) else "%02d:%02d".format(m, sec)
    }

    val displayPos = if (isDragging) dragPosition else position
    val playedFrac = if (duration > 0) (displayPos.toFloat() / duration).coerceIn(0f, 1f) else 0f
    val bufferedFrac = if (duration > 0) (buffered.toFloat() / duration).coerceIn(0f, 1f) else 0f

    Column(
        Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(Color(0xFF12121E).copy(alpha = 0.88f))
            .border(1.dp, Color.White.copy(0.07f), RoundedCornerShape(20.dp))
            .padding(horizontal = 14.dp, vertical = 10.dp)
    ) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(fmt(displayPos), color = Color.White.copy(0.75f), fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
            Text(fmt(duration), color = Color.White.copy(0.75f), fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
        }
        Spacer(Modifier.height(6.dp))
        BoxWithConstraints(Modifier.fillMaxWidth().height(28.dp)) {
            val maxW = maxWidth
            if (isDragging && duration > 0) {
                val previewW = 108.dp
                val previewX = (maxW * playedFrac - previewW / 2).coerceIn(0.dp, (maxW - previewW).coerceAtLeast(0.dp))
                Box(Modifier.offset(x = previewX, y = (-72).dp)) {
                    ScrubPreview(baseUrl = baseUrl, ratingKey = ratingKey, ms = thumbMs, timeLabel = fmt(dragPosition), width = previewW)
                }
            }
            // piste
            Box(
                Modifier.align(Alignment.CenterStart).fillMaxWidth().height(5.dp)
                    .clip(RoundedCornerShape(2.5.dp)).background(Color.White.copy(0.16f))
            ) {
                if (duration > 0) Box(Modifier.fillMaxWidth(bufferedFrac).fillMaxHeight().background(Color.White.copy(0.26f)))
            }
            if (duration > 0) {
                Box(
                    Modifier.align(Alignment.CenterStart).fillMaxWidth(playedFrac).height(5.dp)
                        .clip(RoundedCornerShape(2.5.dp))
                        .background(Brush.horizontalGradient(listOf(MovvizBrand, MovvizBrandGlow)))
                )
            }
            // poignée — halo doux + disque blanc, identique desktop (scrubber + brand-glow)
            val thumbX = (maxW * playedFrac - 9.dp).coerceIn((-9).dp, maxW - 9.dp)
            Box(Modifier.align(Alignment.CenterStart).offset(x = thumbX), contentAlignment = Alignment.Center) {
                Box(Modifier.size(22.dp).clip(CircleShape).background(MovvizBrandGlow.copy(alpha = 0.32f)))
                Box(Modifier.size(14.dp).clip(CircleShape).background(Color.White).border(2.dp, Color(0xFF13131B), CircleShape))
            }
            Slider(
                value = playedFrac,
                onValueChange = { frac -> isDragging = true; dragPosition = (frac * duration).toLong() },
                onValueChangeFinished = {
                    exoPlayer.seekTo(dragPosition)
                    isDragging = false
                    onSeek()
                },
                modifier = Modifier.fillMaxSize(),
                // Piste/poignée du Slider matériel rendues invisibles — la
                // piste custom dessinée au-dessus assure le rendu visuel,
                // le Slider ne sert plus qu'à la logique de geste/drag.
                colors = SliderDefaults.colors(
                    thumbColor = Color.Transparent, activeTrackColor = Color.Transparent, inactiveTrackColor = Color.Transparent,
                    disabledThumbColor = Color.Transparent, disabledActiveTrackColor = Color.Transparent, disabledInactiveTrackColor = Color.Transparent,
                )
            )
        }
    }
}

/** Vignette d'aperçu au scrub — même route serveur que le desktop
 *  (proxy de l'index BIF Plex, voir scrub-thumb/route.ts) ; se dégrade
 *  silencieusement (pas d'image) si la bibliothèque Plex n'a pas
 *  "Générer les miniatures d'aperçu vidéo" activé, exactement comme
 *  desktop. Nécessite que le client Coil de l'app partage l'OkHttpClient
 *  authentifié (voir MovvizMobileApplication.newImageLoader) — sinon 401. */
@Composable
private fun ScrubPreview(baseUrl: String, ratingKey: String, ms: Long?, timeLabel: String, width: Dp) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            Modifier.width(width).height(width * 9f / 16f)
                .clip(RoundedCornerShape(10.dp))
                .background(Color.Black.copy(0.85f))
                .border(1.dp, Color.White.copy(0.12f), RoundedCornerShape(10.dp)),
            contentAlignment = Alignment.Center,
        ) {
            if (ms != null) {
                AsyncImage(
                    model = "$baseUrl/api/stream/$ratingKey/scrub-thumb?t=$ms",
                    contentDescription = null,
                    modifier = Modifier.fillMaxSize().clip(RoundedCornerShape(10.dp)),
                    contentScale = ContentScale.Crop,
                )
            } else {
                CircularProgressIndicator(color = Color.White.copy(0.5f), modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
            }
        }
        Spacer(Modifier.height(6.dp))
        Box(Modifier.clip(RoundedCornerShape(20.dp)).background(Color.Black.copy(0.7f)).border(1.dp, Color.White.copy(0.1f), RoundedCornerShape(20.dp)).padding(horizontal = 10.dp, vertical = 4.dp)) {
            Text(timeLabel, color = Color.White.copy(0.9f), fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}
