package com.movviz.mobile.playback

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.drawable.BitmapDrawable
import androidx.core.graphics.drawable.toBitmap
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import coil.ImageLoader
import coil.request.ImageRequest
import com.movviz.tv.data.MovvizRepository
import kotlinx.coroutines.*

/**
 * Vrai lecteur système : MediaSession + notification native + lock screen + BT.
 * 2 lignes : title = "John le Rouge · S1:E1" / artist = "Mentalist" (pas de troncature J).
 */
class PlaybackService : MediaSessionService() {

    private var mediaSession: MediaSession? = null
    private lateinit var player: ExoPlayer
    private var repo: MovvizRepository? = null
    private var currentRatingKey: String? = null
    private var sessionId: String? = null
    private var sequence: Long = 0
    private var heartbeatJob: Job? = null
    private var artworkJob: Job? = null
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var currentTmdbId: Int? = null
    private var currentType: String? = null
    private var currentTitle: String? = null

    override fun onCreate() {
        super.onCreate()
        val audioAttributes = AudioAttributes.Builder()
            .setUsage(C.USAGE_MEDIA)
            .setContentType(C.AUDIO_CONTENT_TYPE_MOVIE)
            .build()
        player = ExoPlayer.Builder(this)
            .setAudioAttributes(audioAttributes, true)
            .setHandleAudioBecomingNoisy(true)
            .setWakeMode(C.WAKE_MODE_NONE)
            .build()
        player.addListener(object : Player.Listener {
            override fun onIsPlayingChanged(isPlaying: Boolean) {
                if (isPlaying) startHeartbeat() else stopHeartbeat()
            }
            override fun onPositionDiscontinuity(oldPosition: Player.PositionInfo, newPosition: Player.PositionInfo, reason: Int) {
                if (reason == Player.DISCONTINUITY_REASON_SEEK) {
                    val pos = player.currentPosition
                    sessionId?.let { scope.launch { repo?.playbackSeek(it, pos, "seek") } }
                    currentRatingKey?.let { k -> scope.launch { repo?.reportProgress(k, pos, "seek") } }
                }
            }
            override fun onPlaybackStateChanged(state: Int) {
                if (state == Player.STATE_ENDED) {
                    val pos = player.duration.coerceAtLeast(0)
                    sessionId?.let { scope.launch { repo?.playbackEnded(it); repo?.playbackStop(it, pos) } }
                    currentRatingKey?.let { k -> scope.launch { repo?.reportProgress(k, pos, "ended") } }
                    stopSelf()
                }
            }
        })
        mediaSession = MediaSession.Builder(this, player)
            .setId("movviz_mobile_session")
            .build()
        // Notification native immédiate (évite ForegroundServiceDidNotStartInTime)
        setMediaNotificationProvider(androidx.media3.session.DefaultMediaNotificationProvider(this))
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? = mediaSession

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)
        if (intent == null) {
            // Redémarrage après crash sans intent — on stoppe proprement pour éviter le timeout
            stopSelf()
            return START_NOT_STICKY
        }
        handleIntent(intent)
        return START_STICKY
    }

    private fun handleIntent(intent: Intent) {
        if (intent.action == ACTION_STOP) { stopPlayback(); return }
        val url = intent.getStringExtra(EXTRA_URL) ?: return
        val baseUrl = intent.getStringExtra(EXTRA_BASE_URL) ?: return
        currentRatingKey = intent.getStringExtra(EXTRA_RATING_KEY)
        currentTmdbId = intent.getIntExtra(EXTRA_TMDB_ID, -1).takeIf { it != -1 }
        currentType = intent.getStringExtra(EXTRA_TYPE)
        currentTitle = intent.getStringExtra(EXTRA_TITLE)
        val showTitle = intent.getStringExtra(EXTRA_SHOW_TITLE)
        val season = intent.getIntExtra(EXTRA_SEASON, -1)
        val episode = intent.getIntExtra(EXTRA_EPISODE, -1)
        val durationMs = intent.getLongExtra(EXTRA_DURATION_MS, -1L).takeIf { it > 0 }
        val posterPath = intent.getStringExtra(EXTRA_POSTER)
        val resumeMsExtra = intent.getLongExtra(EXTRA_RESUME_MS, 0L)
        val isSeries = currentType == "series" && season != -1 && episode != -1
        // 2 lignes pour éviter "ohn le Rouge" (J sous artwork) : title = épisode · S1:E1, artist = série
        val titleLine = if (isSeries) "${currentTitle ?: "Titre"} · S${season}:E${episode}" else currentTitle ?: "Lecture"
        val subtitleLine = showTitle ?: currentTitle ?: "Movviz"
        repo = MovvizRepository(baseUrl)
        val metadata = MediaMetadata.Builder()
            .setTitle(titleLine)
            .setArtist(subtitleLine)
            .setDisplayTitle(titleLine)
            .setSubtitle(subtitleLine)
            .build()
        val mediaItem = MediaItem.Builder()
            .setUri(url)
            .setMediaId(currentRatingKey ?: url)
            .setMediaMetadata(metadata)
            .build()
        // Artwork async (ne bloque pas le titre, évite J coupé par largeIcon padding)
        loadArtwork(posterPath, titleLine, subtitleLine)
        player.setMediaItem(mediaItem)
        // Préparer immédiatement pour que MediaSessionService passe en foreground <10s (évite ForegroundServiceDidNotStartInTime)
        player.prepare()
        player.playWhenReady = true
        // Reprise cross-device async (n'interrompt pas le foreground)
        scope.launch {
            var startMs = resumeMsExtra
            if (startMs == 0L && durationMs != null && currentTmdbId != null && currentType != null) {
                startMs = repo?.resumeOffsetMs(currentType!!, currentTmdbId!!, durationMs, if (isSeries) season else null, if (isSeries) episode else null) ?: 0L
                if (startMs > 0) player.seekTo(startMs)
            }
            // Session Movviz pour heartbeat cross-device
            currentRatingKey?.let { rk ->
                val sess = repo?.openPlaybackSession(rk, durationMs ?: player.duration.coerceAtLeast(0), currentTmdbId ?: -1, currentTitle ?: "", currentType ?: "movie")
                sessionId = sess?.sessionId
                val ro = sess?.resumeOffsetMs
                if (ro != null && ro > 0 && startMs == 0L) {
                    player.seekTo(ro)
                }
            }
        }
    }

    private fun loadArtwork(posterPath: String?, title: String, subtitle: String) {
        if (posterPath == null) return
        artworkJob?.cancel()
        artworkJob = scope.launch(Dispatchers.IO) {
            try {
                val loader = ImageLoader(this@PlaybackService)
                val req = ImageRequest.Builder(this@PlaybackService)
                    .data("https://image.tmdb.org/t/p/w500$posterPath")
                    .size(512, 768)
                    .allowHardware(false)
                    .build()
                val result = loader.execute(req)
                val bmp = (result.drawable as? BitmapDrawable)?.bitmap ?: return@launch
                // Artwork avec padding interne (évite collision titre/largeIcon)
                val padded = Bitmap.createScaledBitmap(bmp, 512, 768, true)
                withContext(Dispatchers.Main) {
                    val cur = player.currentMediaItem ?: return@withContext
                    val newMeta = cur.mediaMetadata.buildUpon()
                        .setArtworkData(padded.toByteArray(), MediaMetadata.PICTURE_TYPE_FRONT_COVER)
                        .setTitle(title)
                        .setArtist(subtitle)
                        .build()
                    val updated = cur.buildUpon().setMediaMetadata(newMeta).build()
                    player.replaceMediaItem(player.currentMediaItemIndex, updated)
                }
            } catch (_: Exception) {}
        }
    }

    private fun Bitmap.toByteArray(): ByteArray {
        val out = java.io.ByteArrayOutputStream()
        compress(Bitmap.CompressFormat.JPEG, 85, out)
        return out.toByteArray()
    }

    private fun startHeartbeat() {
        heartbeatJob?.cancel()
        heartbeatJob = scope.launch {
            while (isActive) {
                delay(15000)
                val pos = player.currentPosition
                val playing = player.isPlaying
                sessionId?.let { repo?.playbackHeartbeat(it, sequence++, pos, playing) }
                currentRatingKey?.let { k -> repo?.reportProgress(k, pos, if (playing) "playing" else "paused") }
            }
        }
    }
    private fun stopHeartbeat() { heartbeatJob?.cancel(); heartbeatJob = null }

    private fun stopPlayback() {
        val pos = player.currentPosition
        sessionId?.let { scope.launch { repo?.playbackStop(it, pos); repo?.playbackEnded(it) } }
        currentRatingKey?.let { k -> scope.launch { repo?.reportProgress(k, pos, "stopped") } }
        player.stop()
        stopSelf()
    }

    override fun onDestroy() {
        heartbeatJob?.cancel()
        artworkJob?.cancel()
        sessionId?.let { scope.launch { repo?.playbackStop(it, player.currentPosition) } }
        currentRatingKey?.let { k -> scope.launch { repo?.reportProgress(k, player.currentPosition, "stopped") } }
        mediaSession?.release()
        player.release()
        scope.cancel()
        super.onDestroy()
    }

    companion object {
        const val ACTION_PLAY = "movviz.action.PLAY"
        const val ACTION_STOP = "movviz.action.STOP"
        const val EXTRA_URL = "extra_url"
        const val EXTRA_BASE_URL = "extra_base_url"
        const val EXTRA_RATING_KEY = "extra_rating_key"
        const val EXTRA_TMDB_ID = "extra_tmdb_id"
        const val EXTRA_TYPE = "extra_type"
        const val EXTRA_TITLE = "extra_title"
        const val EXTRA_SHOW_TITLE = "extra_show_title"
        const val EXTRA_SEASON = "extra_season"
        const val EXTRA_EPISODE = "extra_episode"
        const val EXTRA_DURATION_MS = "extra_duration_ms"
        const val EXTRA_POSTER = "extra_poster"
        const val EXTRA_RESUME_MS = "extra_resume_ms"
        fun playIntent(
            context: android.content.Context,
            baseUrl: String,
            streamUrl: String,
            ratingKey: String,
            tmdbId: Int,
            type: String,
            title: String,
            showTitle: String? = null,
            season: Int = -1,
            episode: Int = -1,
            durationMs: Long = -1,
            posterPath: String? = null,
            resumeMs: Long = 0,
        ): Intent = Intent(context, PlaybackService::class.java).apply {
            action = ACTION_PLAY
            putExtra(EXTRA_BASE_URL, baseUrl)
            putExtra(EXTRA_URL, streamUrl)
            putExtra(EXTRA_RATING_KEY, ratingKey)
            putExtra(EXTRA_TMDB_ID, tmdbId)
            putExtra(EXTRA_TYPE, type)
            putExtra(EXTRA_TITLE, title)
            putExtra(EXTRA_SHOW_TITLE, showTitle)
            putExtra(EXTRA_SEASON, season)
            putExtra(EXTRA_EPISODE, episode)
            putExtra(EXTRA_DURATION_MS, durationMs)
            putExtra(EXTRA_POSTER, posterPath)
            putExtra(EXTRA_RESUME_MS, resumeMs)
        }
    }
}
