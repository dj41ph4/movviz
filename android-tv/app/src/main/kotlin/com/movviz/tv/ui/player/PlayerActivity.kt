package com.movviz.tv.ui.player

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.KeyEvent
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.tv.foundation.lazy.list.TvLazyColumn
import androidx.tv.foundation.lazy.list.items
import androidx.tv.foundation.lazy.list.itemsIndexed
import androidx.tv.material3.Border
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.datasource.HttpDataSource
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.ui.CaptionStyleCompat
import androidx.media3.ui.PlayerView
import com.movviz.tv.data.ApiResult
import com.movviz.tv.data.MovvizRepository
import com.movviz.tv.ui.theme.MovvizBrand
import com.movviz.tv.ui.theme.MovvizBrand2
import com.movviz.tv.ui.theme.MovvizDown
import com.movviz.tv.ui.theme.MovvizInk
import com.movviz.tv.ui.theme.MovvizInkSoft
import com.movviz.tv.ui.theme.MovvizSurface
import com.movviz.tv.ui.theme.MovvizTvTheme
import com.movviz.tv.ui.theme.tvPointerClick
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private const val EXTRA_BASE_URL = "extra_base_url"
private const val EXTRA_TYPE = "extra_type"
private const val EXTRA_TMDB_ID = "extra_tmdb_id"
private const val EXTRA_TITLE = "extra_title"
private const val EXTRA_KEYS = "extra_keys"
private const val EXTRA_LABELS = "extra_labels"
private const val EXTRA_SEASONS = "extra_seasons"
private const val EXTRA_EPISODES = "extra_episodes"
private const val EXTRA_INDEX = "extra_index"

/**
 * Une seule Activity dédiée à la lecture, quel que soit le contenu (film ou
 * épisode de série) — la "file de lecture" (queue) est toujours une liste,
 * même à un seul élément pour un film : ça unifie tout le code
 * suivant/précédent/reprise au lieu de dupliquer une branche film et une
 * branche série. Passer d'un épisode à un autre se fait EN PLACE (même
 * instance d'Activity, juste un nouveau MediaItem sur le même ExoPlayer) —
 * pas de redémarrage d'Activity, donc pas de flash noir entre deux épisodes.
 */
class PlayerActivity : ComponentActivity() {
    // Les vraies télécommandes Android TV envoient des KEYCODE_MEDIA_* dédiés
    // (play/pause/avance/recul/suivant/précédent) en plus du D-pad — ils
    // n'appartiennent à aucun bouton Compose à l'écran donc ne remontent
    // jamais via onPreviewKeyEvent des contrôles ; il faut les intercepter au
    // niveau Activity. Le composable enregistre son gestionnaire ici une fois
    // monté (voir PlayerScreen → onRegisterMediaKeyHandler).
    private var mediaKeyHandler: ((Int) -> Boolean)? = null

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (isMediaKey(keyCode) && mediaKeyHandler?.invoke(keyCode) == true) return true
        return super.onKeyDown(keyCode, event)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val baseUrl = intent.getStringExtra(EXTRA_BASE_URL) ?: run { finish(); return }
        val keys = intent.getStringArrayListExtra(EXTRA_KEYS)?.takeIf { it.isNotEmpty() } ?: run { finish(); return }
        val labels = intent.getStringArrayListExtra(EXTRA_LABELS) ?: arrayListOf()
        val seasons = intent.getIntArrayExtra(EXTRA_SEASONS) ?: IntArray(keys.size) { -1 }
        val episodes = intent.getIntArrayExtra(EXTRA_EPISODES) ?: IntArray(keys.size) { -1 }
        val startIndex = intent.getIntExtra(EXTRA_INDEX, 0).coerceIn(0, keys.size - 1)
        val mainTitle = intent.getStringExtra(EXTRA_TITLE) ?: ""
        val type = intent.getStringExtra(EXTRA_TYPE) ?: "movie"
        val tmdbId = intent.getIntExtra(EXTRA_TMDB_ID, 0)

        val queue = keys.indices.map { i ->
            QueueItem(
                ratingKey = keys[i],
                label = labels.getOrNull(i)?.takeIf { it.isNotBlank() },
                seasonNumber = seasons.getOrElse(i) { -1 },
                episodeNumber = episodes.getOrElse(i) { -1 },
            )
        }

        setContent {
            MovvizTvTheme {
                Box(modifier = Modifier.fillMaxSize().background(Color.Black)) {
                    PlayerScreen(
                        baseUrl = baseUrl,
                        mainTitle = mainTitle,
                        type = type,
                        tmdbId = tmdbId,
                        queue = queue,
                        startIndex = startIndex,
                        onExit = { finish() },
                        onRegisterMediaKeyHandler = { handler -> mediaKeyHandler = handler },
                    )
                }
            }
        }
    }

    override fun onDestroy() {
        mediaKeyHandler = null
        super.onDestroy()
    }

    companion object {
        /** Construit l'intent de lecture — un seul film = queue à un élément. */
        fun forMovie(context: Context, baseUrl: String, ratingKey: String, tmdbId: Int, title: String): Intent =
            forQueue(context, baseUrl, "movie", tmdbId, title, listOf(QueueItem(ratingKey, null, -1, -1)), 0)

        fun forQueue(
            context: Context,
            baseUrl: String,
            type: String,
            tmdbId: Int,
            title: String,
            queue: List<QueueItem>,
            startIndex: Int,
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
        }
    }
}

data class QueueItem(
    val ratingKey: String,
    val label: String?,
    val seasonNumber: Int,
    val episodeNumber: Int,
)

private fun isMediaKey(keyCode: Int): Boolean = keyCode in intArrayOf(
    KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE,
    KeyEvent.KEYCODE_MEDIA_PLAY,
    KeyEvent.KEYCODE_MEDIA_PAUSE,
    KeyEvent.KEYCODE_MEDIA_STOP,
    KeyEvent.KEYCODE_MEDIA_FAST_FORWARD,
    KeyEvent.KEYCODE_MEDIA_REWIND,
    KeyEvent.KEYCODE_MEDIA_NEXT,
    KeyEvent.KEYCODE_MEDIA_PREVIOUS,
)

private const val SEEK_STEP_MS = 10_000L
private const val CONTROLS_TIMEOUT_MS = 4_500L
private const val PROGRESS_REPORT_INTERVAL_MS = 10_000L
private const val MAX_NETWORK_AUTO_RETRIES = 2
private const val NETWORK_RETRY_DELAY_MS = 2_000L

/** Catégories d'erreur de lecture — déterminent le message et si un retry
 *  automatique/manuel a un sens (ré-essayer un codec non supporté ne
 *  changera jamais rien, contrairement à un pépin réseau transitoire). */
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
    PlayerErrorKind.AUTH -> "Session expirée — reconnecte-toi depuis l'accueil."
    PlayerErrorKind.NOT_FOUND -> "Ce fichier n'est plus disponible sur le serveur."
    PlayerErrorKind.UNSUPPORTED -> "Ce format vidéo n'est pas pris en charge par cet appareil."
    PlayerErrorKind.UNKNOWN -> "Lecture impossible."
}

@Composable
private fun PlayerScreen(
    baseUrl: String,
    mainTitle: String,
    type: String,
    tmdbId: Int,
    queue: List<QueueItem>,
    startIndex: Int,
    onExit: () -> Unit,
    onRegisterMediaKeyHandler: (((Int) -> Boolean) -> Unit)? = null,
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val scope = rememberCoroutineScope()
    val repository = remember(baseUrl) { MovvizRepository(baseUrl) }

    var currentIndex by remember { mutableStateOf(startIndex) }
    val current = queue[currentIndex]
    val hasNext = currentIndex < queue.size - 1
    val hasPrev = currentIndex > 0

    var showControls by remember { mutableStateOf(true) }
    var isPlaying by remember { mutableStateOf(true) }
    var positionMs by remember { mutableStateOf(0L) }
    var durationMs by remember { mutableStateOf(0L) }
    var bufferedPercent by remember { mutableStateOf(0) }
    var loading by remember { mutableStateOf(true) }
    // A joué au moins une image pour cet item — distingue le chargement
    // initial (voile plein écran + texte) d'un simple re-buffering réseau en
    // cours de lecture (indicateur discret, la dernière image reste visible
    // au lieu de figer l'écran sans aucun retour visuel).
    var hasRenderedFrame by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var errorKind by remember { mutableStateOf<PlayerErrorKind?>(null) }
    var networkRetryCount by remember { mutableStateOf(0) }
    var showAudioDialog by remember { mutableStateOf(false) }
    var showSubtitleDialog by remember { mutableStateOf(false) }
    var tracksVersion by remember { mutableStateOf(0) } // force la recomposition des dialogues pistes

    val exoPlayer = remember {
        val dataSourceFactory = OkHttpDataSource.Factory(com.movviz.tv.data.ApiClient.httpClient())
        val mediaSourceFactory = DefaultMediaSourceFactory(context).setDataSourceFactory(dataSourceFactory)
        ExoPlayer.Builder(context).setMediaSourceFactory(mediaSourceFactory).build()
    }

    // Charge un item de la queue dans le player existant — appelé au premier
    // rendu, à chaque changement d'épisode (suivant/précédent) ET lors d'un
    // retry après erreur, sans jamais recréer l'ExoPlayer ni relancer
    // l'Activity : garde une lecture fluide.
    fun load(item: QueueItem, resumeMs: Long) {
        loading = true
        hasRenderedFrame = false
        errorMessage = null
        errorKind = null
        val url = repository.streamUrl(item.ratingKey)
        exoPlayer.setMediaItem(MediaItem.fromUri(url))
        exoPlayer.prepare()
        if (resumeMs > 0) exoPlayer.seekTo(resumeMs)
        exoPlayer.playWhenReady = true
    }

    // Reprise de lecture — position exacte (viewOffset Plex brut) exposée
    // par /api/plex/on-deck via OnDeckEntryDto.offsetMs, voir
    // MovvizRepository.resumeOffsetMs pour le détail (durationMs ne sert
    // plus qu'à ignorer un offset aberrant si le fichier a changé entre
    // temps).
    LaunchedEffect(current.ratingKey) {
        networkRetryCount = 0
        val infoResult = repository.streamInfo(current.ratingKey)
        val knownDuration = (infoResult as? ApiResult.Success)?.data?.durationMs
        val resume = repository.resumeOffsetMs(
            type = type,
            tmdbId = tmdbId,
            durationMs = knownDuration,
            seasonNumber = current.seasonNumber.takeIf { it >= 0 },
            episodeNumber = current.episodeNumber.takeIf { it >= 0 },
        ) ?: 0L
        load(current, resume)
    }

    DisposableEffect(exoPlayer) {
        val listener = object : Player.Listener {
            override fun onIsPlayingChanged(playing: Boolean) {
                isPlaying = playing
            }
            override fun onPlaybackStateChanged(state: Int) {
                loading = state == Player.STATE_BUFFERING
                if (state == Player.STATE_READY) {
                    durationMs = exoPlayer.duration.coerceAtLeast(0)
                    hasRenderedFrame = true
                }
                if (state == Player.STATE_ENDED) {
                    // currentIndex (état Compose) est lu ici à chaud plutôt
                    // que de fermer sur `current`/`hasNext` capturés à la
                    // création de cet effet (celui-ci ne se relance jamais,
                    // sa clé `exoPlayer` ne change pas) — sinon la queue
                    // reste bloquée sur l'épisode de départ pour toujours et
                    // dépasse ses bornes (IndexOutOfBounds) une fois le
                    // dernier épisode terminé naturellement (bug confirmé en
                    // lisant le code : `hasNext` figé à true incrémentait
                    // currentIndex au-delà de queue.size - 1).
                    if (currentIndex < queue.size - 1) {
                        currentIndex += 1
                    } else {
                        scope.launch { repository.reportStop(queue[currentIndex].ratingKey) }
                        onExit()
                    }
                }
            }
            override fun onPlayerError(error: PlaybackException) {
                val kind = classifyError(error)
                if (kind == PlayerErrorKind.NETWORK && networkRetryCount < MAX_NETWORK_AUTO_RETRIES) {
                    networkRetryCount += 1
                    val resumePos = exoPlayer.currentPosition.coerceAtLeast(0)
                    loading = true
                    val item = queue[currentIndex]
                    scope.launch {
                        delay(NETWORK_RETRY_DELAY_MS)
                        load(item, resumePos)
                    }
                    return
                }
                errorKind = kind
                errorMessage = messageFor(kind)
            }
            override fun onTracksChanged(tracks: androidx.media3.common.Tracks) {
                tracksVersion++
            }
        }
        exoPlayer.addListener(listener)
        onDispose {
            exoPlayer.removeListener(listener)
            exoPlayer.release()
        }
    }

    // Signale l'arrêt/la position finale au serveur en quittant l'écran —
    // sans ça Plex ne sait jamais que la lecture s'est arrêtée ici (état
    // "en cours" qui resterait figé côté bibliothèque/on-deck). Même piège
    // de fermeture que ci-dessus : lit currentIndex/queue à chaud plutôt que
    // `current` (figé sur le premier épisode de la queue) pour reporter le
    // bon ratingKey si l'utilisateur quitte après avoir avancé dans la file.
    DisposableEffect(Unit) {
        onDispose {
            runCatching {
                kotlinx.coroutines.runBlocking {
                    repository.reportStop(queue[currentIndex].ratingKey)
                }
            }
        }
    }

    // Battement de progression régulier + suivi position/buffer pour la
    // barre — best-effort, jamais fatal (voir MovvizRepository.reportProgress).
    LaunchedEffect(exoPlayer) {
        while (true) {
            delay(500)
            positionMs = exoPlayer.currentPosition.coerceAtLeast(0)
            if (exoPlayer.duration > 0) durationMs = exoPlayer.duration
            bufferedPercent = exoPlayer.bufferedPercentage
        }
    }
    LaunchedEffect(current.ratingKey) {
        while (true) {
            delay(PROGRESS_REPORT_INTERVAL_MS)
            repository.reportProgress(current.ratingKey, exoPlayer.currentPosition, if (isPlaying) "playing" else "paused")
        }
    }

    // Auto-hide des contrôles — toute interaction relance le minuteur.
    var lastInteraction by remember { mutableStateOf(System.currentTimeMillis()) }
    LaunchedEffect(lastInteraction, showAudioDialog, showSubtitleDialog) {
        if (showAudioDialog || showSubtitleDialog) return@LaunchedEffect
        showControls = true
        delay(CONTROLS_TIMEOUT_MS)
        showControls = false
    }
    fun poke() {
        lastInteraction = System.currentTimeMillis()
    }

    // Actions du lecteur — factorisées pour être appelées à la fois par les
    // boutons Compose de l'overlay ET par les touches média dédiées de la
    // télécommande (KEYCODE_MEDIA_*, voir onRegisterMediaKeyHandler
    // ci-dessous), qui ne passent jamais par un bouton à l'écran.
    fun playPauseAction() {
        poke()
        if (exoPlayer.isPlaying) exoPlayer.pause() else exoPlayer.play()
    }
    fun seekBackAction() {
        poke()
        exoPlayer.seekTo((exoPlayer.currentPosition - SEEK_STEP_MS).coerceAtLeast(0))
    }
    fun seekForwardAction() {
        poke()
        exoPlayer.seekTo((exoPlayer.currentPosition + SEEK_STEP_MS).coerceAtMost(exoPlayer.duration.coerceAtLeast(0)))
    }
    fun prevEpisodeAction() {
        poke()
        if (currentIndex > 0) currentIndex -= 1
    }
    fun nextEpisodeAction() {
        poke()
        if (currentIndex < queue.size - 1) currentIndex += 1
    }

    LaunchedEffect(Unit) {
        onRegisterMediaKeyHandler?.invoke { keyCode ->
            when (keyCode) {
                KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE -> { playPauseAction(); true }
                KeyEvent.KEYCODE_MEDIA_PLAY -> { poke(); exoPlayer.play(); true }
                KeyEvent.KEYCODE_MEDIA_PAUSE -> { poke(); exoPlayer.pause(); true }
                KeyEvent.KEYCODE_MEDIA_STOP -> { poke(); exoPlayer.pause(); true }
                KeyEvent.KEYCODE_MEDIA_FAST_FORWARD -> { seekForwardAction(); true }
                KeyEvent.KEYCODE_MEDIA_REWIND -> { seekBackAction(); true }
                KeyEvent.KEYCODE_MEDIA_NEXT -> { nextEpisodeAction(); true }
                KeyEvent.KEYCODE_MEDIA_PREVIOUS -> { prevEpisodeAction(); true }
                else -> false
            }
        }
    }

    val playPauseFocus = remember { FocusRequester() }
    val hiddenCatcherFocus = remember { FocusRequester() }
    LaunchedEffect(showControls) {
        val target = if (showControls) playPauseFocus else hiddenCatcherFocus
        repeat(5) { attempt ->
            val ok = runCatching { target.requestFocus() }.isSuccess
            if (ok) return@LaunchedEffect
            if (attempt < 4) withFrameNanos { }
        }
    }

    // Back : contrôles visibles → les masquer (comportement standard
    // lecteur TV, ne quitte pas au premier appui) ; contrôles déjà masqués →
    // sortie propre vers l'écran précédent (fiche titre).
    BackHandler(enabled = true) {
        when {
            showAudioDialog -> showAudioDialog = false
            showSubtitleDialog -> showSubtitleDialog = false
            showControls -> showControls = false
            else -> onExit()
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        AndroidView(
            factory = { ctx ->
                PlayerView(ctx).apply {
                    player = exoPlayer
                    useController = false
                    // Sans ça, cette View native (focusable par défaut, y
                    // compris ses enfants type SurfaceView) capte le focus
                    // Android réel dès sa création et ne le rend jamais —
                    // les FocusRequester Compose plus haut réussissent leur
                    // premier appel (l'anneau visuel s'affiche une fois) mais
                    // TOUT le D-pad et les taps suivants partent dans le
                    // vide ensuite, silencieusement (confirmé en direct :
                    // DPAD_RIGHT n'a jamais déplacé le focus hors du bouton
                    // pause, un tap direct sur un autre bouton n'a rien fait
                    // non plus). Le rendu vidéo n'a besoin d'aucun focus.
                    isFocusable = false
                    isFocusableInTouchMode = false
                    descendantFocusability = android.view.ViewGroup.FOCUS_BLOCK_DESCENDANTS

                    // Sous-titres lisibles à distance sur un téléviseur : la
                    // taille par défaut de SubtitleView vise un écran tenu en
                    // main, trop petite vue du canapé. Contour noir épais
                    // (fonctionne aussi bien sur fond clair que sombre, pas
                    // besoin d'un fond plein qui masquerait l'image) + police
                    // agrandie. S'applique à tout type de piste texte rendue
                    // par ExoPlayer (SRT/ASS/PGS une fois décodée en bitmap —
                    // PGS est nativement supporté par media3-exoplayer, pas
                    // besoin d'extension séparée).
                    subtitleView?.setApplyEmbeddedStyles(false)
                    subtitleView?.setApplyEmbeddedFontSizes(false)
                    subtitleView?.setStyle(
                        CaptionStyleCompat(
                            android.graphics.Color.WHITE,
                            android.graphics.Color.TRANSPARENT,
                            android.graphics.Color.TRANSPARENT,
                            CaptionStyleCompat.EDGE_TYPE_OUTLINE,
                            android.graphics.Color.BLACK,
                            null,
                        ),
                    )
                    subtitleView?.setFractionalTextSize(0.06f)
                    subtitleView?.setBottomPaddingFraction(0.12f)
                }
            },
            modifier = Modifier.fillMaxSize(),
        )

        // Zone invisible plein écran qui capte tout appui D-pad pour
        // réafficher les contrôles quand ils sont masqués, sans rien faire
        // d'autre (évite qu'une pression perdue dans le vide ne fasse rien).
        if (!showControls) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .focusRequester(hiddenCatcherFocus)
                    .focusable()
                    .onPreviewKeyEvent { event ->
                        if (event.type == KeyEventType.KeyDown) poke()
                        false
                    }
                    .tvPointerClick { poke() },
            )
        }

        if (loading && errorMessage == null) {
            if (hasRenderedFrame) {
                // Re-buffering en cours de lecture : indicateur discret en
                // coin, la dernière image reste affichée — jamais de gel
                // visuel silencieux pendant un ralentissement réseau.
                Box(modifier = Modifier.align(Alignment.TopEnd).padding(28.dp)) {
                    BufferingSpinner(size = 28.dp)
                }
            } else {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        BufferingSpinner(size = 40.dp)
                        Spacer(modifier = Modifier.height(14.dp))
                        Text(text = "Chargement…", style = TextStyle(fontSize = 16.sp, color = MovvizInk))
                    }
                }
            }
        }

        errorMessage?.let { msg ->
            val canRetry = errorKind != PlayerErrorKind.AUTH && errorKind != PlayerErrorKind.NOT_FOUND
            Box(
                modifier = Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.85f)),
                contentAlignment = Alignment.Center,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(text = msg, style = TextStyle(fontSize = 16.sp, color = MovvizDown))
                    Spacer(modifier = Modifier.height(16.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(24.dp)) {
                        if (canRetry) {
                            Text(
                                text = "Réessayer",
                                style = TextStyle(fontSize = 14.sp, color = MovvizBrand, fontWeight = FontWeight.Bold),
                                modifier = Modifier.tvPointerClick {
                                    networkRetryCount = 0
                                    load(current, positionMs)
                                },
                            )
                        }
                        Text(
                            text = "Retour",
                            style = TextStyle(fontSize = 14.sp, color = Color.White.copy(alpha = 0.8f), fontWeight = FontWeight.Bold),
                            modifier = Modifier.tvPointerClick { onExit() },
                        )
                    }
                }
            }
        }

        AnimatedVisibility(
            visible = showControls && errorMessage == null,
            enter = fadeIn() + slideInVertically(initialOffsetY = { it / 3 }),
            exit = fadeOut() + slideOutVertically(targetOffsetY = { it / 3 }),
            modifier = Modifier.align(Alignment.BottomCenter).fillMaxWidth(),
        ) {
            ControlsOverlay(
                title = mainTitle,
                subtitle = current.label,
                isPlaying = isPlaying,
                positionMs = positionMs,
                durationMs = durationMs,
                bufferedPercent = bufferedPercent,
                hasNext = hasNext,
                hasPrev = hasPrev,
                playPauseFocus = playPauseFocus,
                onInteraction = { poke() },
                onPlayPause = { playPauseAction() },
                onSeekBack = { seekBackAction() },
                onSeekForward = { seekForwardAction() },
                onPrevEpisode = { prevEpisodeAction() },
                onNextEpisode = { nextEpisodeAction() },
                onOpenAudio = { poke(); showAudioDialog = true },
                onOpenSubtitles = { poke(); showSubtitleDialog = true },
            )
        }

        if (showAudioDialog) {
            @Suppress("UNUSED_EXPRESSION") tracksVersion // souscrit cette recomposition aux changements de pistes
            TrackDialog(
                title = "Piste audio",
                tracks = audioTrackOptions(exoPlayer),
                onSelect = { groupIndex, trackIndex ->
                    applyTrackOverride(exoPlayer, C.TRACK_TYPE_AUDIO, exoPlayer.currentTracks.groups[groupIndex])
                    showAudioDialog = false
                },
                onDismiss = { showAudioDialog = false },
            )
        }
        if (showSubtitleDialog) {
            @Suppress("UNUSED_EXPRESSION") tracksVersion
            TrackDialog(
                title = "Sous-titres",
                tracks = subtitleTrackOptions(exoPlayer),
                onSelect = { groupIndex, _ ->
                    if (groupIndex < 0) {
                        exoPlayer.trackSelectionParameters = exoPlayer.trackSelectionParameters.buildUpon()
                            .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
                            .clearOverridesOfType(C.TRACK_TYPE_TEXT)
                            .build()
                    } else {
                        applyTrackOverride(exoPlayer, C.TRACK_TYPE_TEXT, exoPlayer.currentTracks.groups[groupIndex])
                    }
                    showSubtitleDialog = false
                },
                onDismiss = { showSubtitleDialog = false },
                includeOffOption = true,
            )
        }
    }
}

/** Changer de piste audio applique juste un override de sélection sur le
 *  MediaItem déjà chargé — ExoPlayer ne recrée pas la source ni ne relance
 *  la lecture depuis le début, la position courante est conservée (vérifié
 *  en direct : bascule de piste en cours de lecture sans saut de position). */
private fun applyTrackOverride(player: ExoPlayer, trackType: Int, group: androidx.media3.common.Tracks.Group) {
    player.trackSelectionParameters = player.trackSelectionParameters.buildUpon()
        .setTrackTypeDisabled(trackType, false)
        .setOverrideForType(TrackSelectionOverride(group.mediaTrackGroup, 0))
        .build()
}

private data class TrackOption(val groupIndex: Int, val trackIndex: Int, val label: String, val selected: Boolean)

private fun audioTrackOptions(player: ExoPlayer): List<TrackOption> =
    player.currentTracks.groups
        .withIndex()
        .filter { it.value.type == C.TRACK_TYPE_AUDIO }
        .map { (i, g) ->
            val format = g.getTrackFormat(0)
            val lang = format.language?.uppercase() ?: "Inconnue"
            val channels = if (format.channelCount > 0) " · ${format.channelCount}.0" else ""
            TrackOption(i, 0, "$lang$channels", g.isSelected)
        }

private fun subtitleTrackOptions(player: ExoPlayer): List<TrackOption> =
    player.currentTracks.groups
        .withIndex()
        .filter { it.value.type == C.TRACK_TYPE_TEXT }
        .map { (i, g) ->
            val format = g.getTrackFormat(0)
            val lang = format.language?.uppercase() ?: "Inconnue"
            TrackOption(i, 0, lang, g.isSelected)
        }

/** Petit indicateur de chargement/tampon rotatif aux couleurs de marque —
 *  cohérent avec le pattern "Loader2 spin" utilisé ailleurs dans l'app pour
 *  les actions asynchrones courtes. */
@Composable
private fun BufferingSpinner(size: androidx.compose.ui.unit.Dp) {
    val transition = rememberInfiniteTransition(label = "buffering")
    val angle by transition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(animation = tween(900, easing = LinearEasing), repeatMode = RepeatMode.Restart),
        label = "angle",
    )
    Canvas(modifier = Modifier.size(size).rotate(angle)) {
        drawArc(
            brush = androidx.compose.ui.graphics.Brush.sweepGradient(listOf(Color.Transparent, MovvizBrand, MovvizBrand2)),
            startAngle = 0f,
            sweepAngle = 300f,
            useCenter = false,
            style = Stroke(width = size.toPx() * 0.14f, cap = StrokeCap.Round),
            size = Size(size.toPx(), size.toPx()),
        )
    }
}

@Composable
private fun ControlsOverlay(
    title: String,
    subtitle: String?,
    isPlaying: Boolean,
    positionMs: Long,
    durationMs: Long,
    bufferedPercent: Int,
    hasNext: Boolean,
    hasPrev: Boolean,
    playPauseFocus: FocusRequester,
    onInteraction: () -> Unit,
    onPlayPause: () -> Unit,
    onSeekBack: () -> Unit,
    onSeekForward: () -> Unit,
    onPrevEpisode: () -> Unit,
    onNextEpisode: () -> Unit,
    onOpenAudio: () -> Unit,
    onOpenSubtitles: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                androidx.compose.ui.graphics.Brush.verticalGradient(
                    colors = listOf(Color.Transparent, Color.Black.copy(alpha = 0.9f)),
                ),
            )
            .padding(horizontal = 56.dp, vertical = 28.dp),
    ) {
        Text(
            text = title,
            style = TextStyle(fontSize = 20.sp, fontWeight = FontWeight.Black, color = MovvizInk),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        if (!subtitle.isNullOrBlank()) {
            Text(
                text = subtitle,
                style = TextStyle(fontSize = 14.sp, color = MovvizInkSoft),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }

        Spacer(modifier = Modifier.height(18.dp))

        // Timeline — visuelle uniquement, la navigation se fait via les
        // boutons -10s/+10s explicites ci-dessous (déterministe au D-pad,
        // pas de curseur à faire glisser à la précision souris).
        val progress = if (durationMs > 0) (positionMs.toFloat() / durationMs.toFloat()).coerceIn(0f, 1f) else 0f
        val buffered = (bufferedPercent / 100f).coerceIn(0f, 1f)
        Box(modifier = Modifier.fillMaxWidth().height(4.dp).background(Color.White.copy(alpha = 0.15f), RoundedCornerShape(2.dp))) {
            Box(modifier = Modifier.fillMaxWidth(buffered).height(4.dp).background(Color.White.copy(alpha = 0.3f), RoundedCornerShape(2.dp)))
            Box(
                modifier = Modifier
                    .fillMaxWidth(progress)
                    .height(4.dp)
                    .background(androidx.compose.ui.graphics.Brush.horizontalGradient(listOf(MovvizBrand, MovvizBrand2)), RoundedCornerShape(2.dp)),
            )
        }
        Spacer(modifier = Modifier.height(6.dp))
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(text = formatTime(positionMs), style = TextStyle(fontSize = 12.sp, color = MovvizInkSoft))
            Text(text = formatTime(durationMs), style = TextStyle(fontSize = 12.sp, color = MovvizInkSoft))
        }

        Spacer(modifier = Modifier.height(20.dp))

        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            if (hasPrev) {
                ControlButton(glyph = "⏮", contentDescription = "Épisode précédent", onClick = onPrevEpisode)
            }
            ControlButton(glyph = "◀◀", contentDescription = "Reculer de 10 secondes", onClick = onSeekBack)
            ControlButton(
                glyph = if (isPlaying) "❚❚" else "▶",
                contentDescription = if (isPlaying) "Pause" else "Lecture",
                onClick = onPlayPause,
                primary = true,
                focusRequester = playPauseFocus,
            )
            ControlButton(glyph = "▶▶", contentDescription = "Avancer de 10 secondes", onClick = onSeekForward)
            if (hasNext) {
                ControlButton(glyph = "⏭", contentDescription = "Épisode suivant", onClick = onNextEpisode)
            }

            Spacer(modifier = Modifier.weight(1f))

            ControlButton(glyph = "♪", contentDescription = "Piste audio", onClick = onOpenAudio, small = true)
            ControlButton(glyph = "CC", contentDescription = "Sous-titres", onClick = onOpenSubtitles, small = true)
        }
    }
}

/** Bouton rond de contrôle du lecteur — glyphe texte plutôt qu'une police
 *  d'icônes (le projet n'embarque pas material-icons-extended, voir les
 *  autres écrans qui utilisent déjà des glyphes texte comme "▶"/"★"). */
@Composable
private fun ControlButton(
    glyph: String,
    contentDescription: String,
    onClick: () -> Unit,
    primary: Boolean = false,
    small: Boolean = false,
    focusRequester: FocusRequester? = null,
) {
    var focused by remember { mutableStateOf(false) }
    val size = if (small) 44.dp else if (primary) 68.dp else 56.dp
    Surface(
        onClick = onClick,
        modifier = Modifier
            .size(size)
            .let { if (focusRequester != null) it.focusRequester(focusRequester) else it }
            .scale(if (focused) 1.12f else 1f)
            .onFocusChanged { focused = it.isFocused }
            .tvPointerClick(onClick),
        shape = ClickableSurfaceDefaults.shape(shape = CircleShape),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = if (primary) Color.White else Color.White.copy(alpha = 0.12f),
            contentColor = if (primary) Color.Black else Color.White,
        ),
        border = ClickableSurfaceDefaults.border(
            focusedBorder = Border(
                border = androidx.compose.foundation.BorderStroke(2.dp, if (primary) MovvizBrand else Color.White),
                shape = CircleShape,
            ),
        ),
    ) {
        Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
            Text(
                text = glyph,
                style = TextStyle(
                    fontSize = if (small) 13.sp else if (primary) 22.sp else 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (primary) Color.Black else Color.White,
                ),
            )
        }
    }
}

@Composable
private fun TrackDialog(
    title: String,
    tracks: List<TrackOption>,
    onSelect: (groupIndex: Int, trackIndex: Int) -> Unit,
    onDismiss: () -> Unit,
    includeOffOption: Boolean = false,
) {
    val firstFocus = remember { FocusRequester() }
    LaunchedEffect(Unit) {
        repeat(5) { attempt ->
            val ok = runCatching { firstFocus.requestFocus() }.isSuccess
            if (ok) return@LaunchedEffect
            if (attempt < 4) withFrameNanos { }
        }
    }
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.75f))
            .tvPointerClick { onDismiss() },
        contentAlignment = Alignment.Center,
    ) {
        Surface(
            onClick = {},
            modifier = Modifier.widthIn(min = 320.dp, max = 420.dp),
            shape = ClickableSurfaceDefaults.shape(shape = RoundedCornerShape(16.dp)),
            colors = ClickableSurfaceDefaults.colors(containerColor = MovvizSurface),
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text(text = title, style = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.Bold, color = MovvizInk))
                Spacer(modifier = Modifier.height(12.dp))
                TvLazyColumn(modifier = Modifier.heightIn(max = 320.dp)) {
                    if (includeOffOption) {
                        item {
                            TrackRow(
                                label = "Désactivés",
                                selected = tracks.none { it.selected },
                                focusRequester = firstFocus,
                                onClick = { onSelect(-1, -1) },
                            )
                        }
                    }
                    itemsIndexed(tracks) { index, t ->
                        TrackRow(
                            label = t.label,
                            selected = t.selected,
                            focusRequester = if (!includeOffOption && index == 0) firstFocus else null,
                            onClick = { onSelect(t.groupIndex, t.trackIndex) },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun TrackRow(label: String, selected: Boolean, focusRequester: FocusRequester?, onClick: () -> Unit) {
    var focused by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(10.dp)
    Surface(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .let { if (focusRequester != null) it.focusRequester(focusRequester) else it }
            .onFocusChanged { focused = it.isFocused }
            .tvPointerClick(onClick),
        shape = ClickableSurfaceDefaults.shape(shape = shape),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = if (focused) MovvizInk.copy(alpha = 0.14f) else Color.Transparent,
            contentColor = MovvizInk,
        ),
        // Avant : seul le fond changeait légèrement au focus, contrairement
        // à toutes les autres rangées/cartes focusables de l'app qui ont
        // toutes une bordure nette (voir EpisodeChip, PosterCard) — un
        // simple changement d'opacité est trop discret au D-pad.
        border = ClickableSurfaceDefaults.border(
            focusedBorder = Border(
                border = androidx.compose.foundation.BorderStroke(2.dp, MovvizBrand),
                shape = shape,
            ),
        ),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(text = label, style = TextStyle(fontSize = 14.sp, color = MovvizInk))
            if (selected) {
                Text(text = "✓", style = TextStyle(fontSize = 15.sp, fontWeight = FontWeight.Bold, color = MovvizBrand))
            }
        }
    }
}

private fun formatTime(ms: Long): String {
    if (ms <= 0) return "0:00"
    val totalSeconds = ms / 1000
    val h = totalSeconds / 3600
    val m = (totalSeconds % 3600) / 60
    val s = totalSeconds % 60
    return if (h > 0) "%d:%02d:%02d".format(h, m, s) else "%d:%02d".format(m, s)
}
