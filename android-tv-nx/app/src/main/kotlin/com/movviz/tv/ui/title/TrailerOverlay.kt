package com.movviz.tv.ui.title

import android.annotation.SuppressLint
import android.graphics.Color as AndroidColor
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import androidx.tv.material3.Icon
import androidx.tv.material3.Text
import com.movviz.tv.data.TrailerSourceDto
import com.movviz.tv.ui.theme.MovvizBrand
import com.movviz.tv.ui.theme.MovvizBrand2
import com.movviz.tv.ui.theme.MovvizIconPause
import com.movviz.tv.ui.theme.MovvizIconPlay
import kotlinx.coroutines.delay

private val YOUTUBE_KEY = Regex("[A-Za-z0-9_-]{6,}")
private const val HUD_VISIBLE_MS = 3500L
private const val SEEK_SECONDS = 10

// YouTube met parfois plus de 12 s à répondre sur un réseau domestique : une
// source n'est abandonnée qu'après ce délai.
private const val START_TIMEOUT_MS = 25_000L

/** Une source de bande-annonce jouable : YouTube (clés TMDb de la fiche, même
 *  liste que le desktop) ou source directe (Apple/IMDb/Prime, renvoyée par
 *  /api/tv/preview qui partage les candidats du desktop). */
private sealed interface TrailerCandidate {
    data class YouTube(val key: String) : TrailerCandidate
    data class Direct(val url: String) : TrailerCandidate
}

/** Même ordre que TrailerModalPlayer desktop : les clés YouTube d'abord, les
 *  sources directes seulement en dernier recours. */
private fun trailerCandidates(youtubeKeys: List<String>, directSources: List<TrailerSourceDto>): List<TrailerCandidate> =
    youtubeKeys.filter { it.matches(YOUTUBE_KEY) }.map { TrailerCandidate.YouTube(it) } +
        directSources.filter { it.url.startsWith("https://") || it.url.startsWith("http://") }.map { TrailerCandidate.Direct(it.url) }

/** Vrai quand la fiche a au moins une bande-annonce à proposer. */
internal fun hasTrailer(youtubeKeys: List<String>, directSources: List<TrailerSourceDto>): Boolean =
    trailerCandidates(youtubeKeys, directSources).isNotEmpty()

/** Ce que le lecteur (YouTube ou direct) remonte à l'overlay ~2 fois par
 *  seconde : position, durée, lecture en cours. */
private class TrailerClock(
    val onTick: (positionMs: Long, durationMs: Long, playing: Boolean) -> Unit,
    val onControls: (toggle: () -> Unit, seekBy: (Int) -> Unit) -> Unit,
)

/**
 * Bande-annonce plein écran avec le son. Niveau d'écran à part entière posé
 * au-dessus de la fiche : OK ou lecture/pause bascule la lecture, gauche /
 * droite avancent de 10 s (maintenir répète), Retour referme. La barre de
 * progression apparaît à chaque touche puis s'efface seule ; en pause elle
 * reste affichée. Les touches sont gérées ici, dans l'overlay, jamais
 * globalement — la fiche du dessous est verrouillée pendant qu'il est ouvert.
 */
@Composable
internal fun TrailerOverlay(
    title: String,
    youtubeKeys: List<String>,
    directSources: List<TrailerSourceDto>,
    originUrl: String?,
    onClose: () -> Unit,
) {
    val candidates = remember(youtubeKeys, directSources) { trailerCandidates(youtubeKeys, directSources) }
    var index by remember(candidates) { mutableIntStateOf(0) }
    val current = candidates.getOrNull(index)
    var toggle by remember { mutableStateOf<(() -> Unit)?>(null) }
    var seekBy by remember { mutableStateOf<((Int) -> Unit)?>(null) }

    var position by remember(index) { mutableLongStateOf(0L) }
    var duration by remember(index) { mutableLongStateOf(0L) }
    var playing by remember(index) { mutableStateOf(false) }
    var started by remember(index) { mutableStateOf(false) }
    var lastError by remember { mutableStateOf<String?>(null) }
    // Une source qui ne démarre pas en 12 s est abandonnée pour la suivante :
    // jamais de chargement infini.
    LaunchedEffect(index) {
        if (candidates.getOrNull(index) == null) return@LaunchedEffect
        delay(START_TIMEOUT_MS)
        if (!started) { lastError = "délai dépassé"; index += 1 }
    }

    // Barre de progression : affichée 3,5 s après chaque touche, en
    // permanence en pause.
    var hudPoke by remember { mutableIntStateOf(0) }
    var hudRecent by remember { mutableStateOf(true) }
    LaunchedEffect(hudPoke) {
        hudRecent = true
        delay(HUD_VISIBLE_MS)
        hudRecent = false
    }
    // Retour visuel de la dernière action (pause, lecture, ±10 s).
    var flash by remember { mutableStateOf<String?>(null) }
    var flashPoke by remember { mutableIntStateOf(0) }
    LaunchedEffect(flashPoke) {
        if (flashPoke == 0) return@LaunchedEffect
        delay(750)
        flash = null
    }
    fun feedback(text: String) { flash = text; flashPoke += 1 }

    val clock = remember(index) {
        TrailerClock(
            onTick = { pos, dur, isPlaying ->
                position = pos
                if (dur > 0L) duration = dur
                playing = isPlaying
                if (isPlaying) started = true
            },
            onControls = { t, s -> toggle = t; seekBy = s },
        )
    }

    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) {
        repeat(20) { attempt ->
            if (runCatching { focus.requestFocus() }.getOrDefault(false)) return@LaunchedEffect
            if (attempt < 19) withFrameNanos { }
        }
    }

    // Fenêtre à part (Dialog) : la bande-annonce couvre VRAIMENT tout l'écran,
    // barre latérale comprise. Retour est géré par la fenêtre elle-même.
    androidx.compose.ui.window.Dialog(
        onDismissRequest = onClose,
        properties = androidx.compose.ui.window.DialogProperties(
            usePlatformDefaultWidth = false,
            dismissOnBackPress = true,
            dismissOnClickOutside = false,
        ),
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black)
                .focusRequester(focus)
                .focusable()
                .onKeyEvent { event ->
                    if (event.type != KeyEventType.KeyDown) return@onKeyEvent false
                    when (event.key) {
                        Key.DirectionCenter, Key.Enter, Key.NumPadEnter, Key.MediaPlayPause, Key.MediaPlay, Key.MediaPause -> {
                            // Le retour visuel annonce l'état À VENIR : le lecteur
                            // ne confirme qu'au tick suivant.
                            feedback(if (event.key == Key.MediaPlay || (event.key != Key.MediaPause && !playing)) "play" else "pause")
                            hudPoke += 1
                            toggle?.invoke(); true
                        }
                        Key.DirectionLeft, Key.MediaRewind -> {
                            feedback("−$SEEK_SECONDS s"); hudPoke += 1
                            seekBy?.invoke(-SEEK_SECONDS); true
                        }
                        Key.DirectionRight, Key.MediaFastForward -> {
                            feedback("+$SEEK_SECONDS s"); hudPoke += 1
                            seekBy?.invoke(SEEK_SECONDS); true
                        }
                        // Haut / bas réveillent la barre mais ne sortent jamais
                        // de l'overlay.
                        Key.DirectionUp, Key.DirectionDown -> { hudPoke += 1; true }
                        else -> false
                    }
                },
        ) {
            when (current) {
                is TrailerCandidate.YouTube -> YouTubeTrailer(
                    key = current.key,
                    originUrl = originUrl,
                    onError = { code -> lastError = "YouTube $code"; index += 1 },
                    onEnded = onClose,
                    clock = clock,
                    modifier = Modifier.fillMaxSize(),
                )
                is TrailerCandidate.Direct -> DirectTrailer(
                    url = current.url,
                    onError = { lastError = "source directe"; index += 1 },
                    onEnded = onClose,
                    clock = clock,
                    modifier = Modifier.fillMaxSize(),
                )
                null -> Text(
                    text = "Bande-annonce indisponible" + (lastError?.let { " ($it)" } ?: ""),
                    style = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = Color.White),
                    modifier = Modifier.align(Alignment.Center),
                )
            }

            if (current != null && !started) {
                Text(
                    text = "Chargement de la bande-annonce…",
                    style = TextStyle(fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = Color.White.copy(alpha = 0.75f)),
                    modifier = Modifier.align(Alignment.Center),
                )
            }

            // Retour visuel central : icône lecture / pause ou « ±10 s ».
            AnimatedVisibility(
                visible = flash != null,
                enter = fadeIn(tween(80)),
                exit = fadeOut(tween(260)),
                modifier = Modifier.align(Alignment.Center),
            ) {
                Box(
                    modifier = Modifier
                        .size(92.dp)
                        .background(Color.Black.copy(alpha = 0.55f), CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    when (flash) {
                        "play" -> Icon(imageVector = MovvizIconPlay, contentDescription = "Lecture", tint = Color.White, modifier = Modifier.size(38.dp))
                        "pause" -> Icon(imageVector = MovvizIconPause, contentDescription = "Pause", tint = Color.White, modifier = Modifier.size(38.dp))
                        else -> Text(
                            text = flash.orEmpty(),
                            style = TextStyle(fontSize = 18.sp, fontWeight = FontWeight.Black, color = Color.White),
                        )
                    }
                }
            }

            val hudVisible = started && (hudRecent || !playing)
            AnimatedVisibility(
                visible = hudVisible,
                enter = fadeIn(tween(160)),
                exit = fadeOut(tween(320)),
                modifier = Modifier.align(Alignment.TopStart),
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Brush.verticalGradient(listOf(Color.Black.copy(alpha = 0.7f), Color.Transparent)))
                        .padding(start = 42.dp, end = 42.dp, top = 30.dp, bottom = 36.dp),
                ) {
                    Text(
                        text = title,
                        style = TextStyle(fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Color.White),
                        maxLines = 1,
                    )
                }
            }
            AnimatedVisibility(
                visible = hudVisible,
                enter = fadeIn(tween(160)),
                exit = fadeOut(tween(320)),
                modifier = Modifier.align(Alignment.BottomStart),
            ) {
                TrailerControls(position = position, duration = duration, playing = playing)
            }
        }
    }
}

/** Barre du bas : temps écoulé, progression, temps restant, rappel des touches. */
@Composable
private fun TrailerControls(position: Long, duration: Long, playing: Boolean) {
    val fraction = if (duration > 0L) (position.toFloat() / duration.toFloat()).coerceIn(0f, 1f) else 0f
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(alpha = 0.85f))))
            .padding(start = 42.dp, end = 42.dp, top = 60.dp, bottom = 30.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                imageVector = if (playing) MovvizIconPause else MovvizIconPlay,
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier.size(16.dp),
            )
            Spacer(modifier = Modifier.size(12.dp))
            Text(
                text = formatClock(position),
                style = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = Color.White),
            )
            Spacer(modifier = Modifier.size(12.dp))
            Box(
                modifier = Modifier
                    .weight(1f)
                    .height(5.dp)
                    .background(Color.White.copy(alpha = 0.25f), RoundedCornerShape(3.dp)),
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth(fraction)
                        .fillMaxHeight()
                        .background(Brush.horizontalGradient(listOf(MovvizBrand, MovvizBrand2)), RoundedCornerShape(3.dp)),
                )
            }
            Spacer(modifier = Modifier.size(12.dp))
            Text(
                text = if (duration > 0L) formatClock(duration) else "--:--",
                style = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = Color.White.copy(alpha = 0.75f)),
            )
        }
        Spacer(modifier = Modifier.height(10.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(22.dp)) {
            TrailerHint("OK", "Pause / lecture")
            TrailerHint("◀ ▶", "Reculer / avancer de $SEEK_SECONDS s")
            TrailerHint("Retour", "Fermer")
        }
    }
}

@Composable
private fun TrailerHint(key: String, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(
            text = key,
            style = TextStyle(fontSize = 10.sp, fontWeight = FontWeight.Black, color = Color.White),
            modifier = Modifier
                .background(Color.White.copy(alpha = 0.18f), RoundedCornerShape(4.dp))
                .padding(horizontal = 6.dp, vertical = 2.dp),
        )
        Spacer(modifier = Modifier.size(7.dp))
        Text(text = label, style = TextStyle(fontSize = 10.sp, color = Color.White.copy(alpha = 0.7f)))
    }
}

private fun formatClock(ms: Long): String {
    val total = (ms / 1000L).coerceAtLeast(0L)
    val h = total / 3600
    val m = (total % 3600) / 60
    val s = total % 60
    return if (h > 0) "%d:%02d:%02d".format(h, m, s) else "%d:%02d".format(m, s)
}

private class TrailerBridge(
    private val onEnded: () -> Unit,
    private val onError: (Int) -> Unit,
    private val onTick: (Long, Long, Boolean) -> Unit,
) {
    private val main = Handler(Looper.getMainLooper())
    private var lastState = Int.MIN_VALUE
    @JavascriptInterface fun ended() { main.post(onEnded) }
    @JavascriptInterface fun error(code: Int) {
        android.util.Log.w("MovvizTrailer", "erreur YouTube code=$code")
        main.post { onError(code) }
    }
    @JavascriptInterface fun tick(positionSeconds: Double, durationSeconds: Double, state: Int) {
        if (state != lastState) { lastState = state; android.util.Log.i("MovvizTrailer", "état YouTube=$state pos=$positionSeconds dur=$durationSeconds") }
        main.post { onTick((positionSeconds * 1000).toLong(), (durationSeconds * 1000).toLong(), state == 1) }
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
private fun YouTubeTrailer(
    key: String,
    originUrl: String?,
    onError: (Int) -> Unit,
    onEnded: () -> Unit,
    clock: TrailerClock,
    modifier: Modifier = Modifier,
) {
    val bridge = remember(key) { TrailerBridge(onEnded = onEnded, onError = onError, onTick = clock.onTick) }
    var webView by remember { mutableStateOf<WebView?>(null) }
    DisposableEffect(webView) {
        val view = webView
        if (view != null) {
            clock.onControls(
                { view.evaluateJavascript("toggle()", null) },
                { seconds -> view.evaluateJavascript("seekBy($seconds)", null) },
            )
        }
        onDispose { }
    }
    AndroidView(
        factory = { ctx ->
            WebView(ctx).apply {
                setBackgroundColor(AndroidColor.BLACK)
                // Le focus reste sur l'overlay Compose : la WebView ne le
                // capte jamais, les touches sont traduites en JS.
                isFocusable = false
                isFocusableInTouchMode = false
                settings.javaScriptEnabled = true
                settings.mediaPlaybackRequiresUserGesture = false
                webChromeClient = object : WebChromeClient() {
                    override fun onConsoleMessage(message: android.webkit.ConsoleMessage): Boolean {
                        android.util.Log.i("MovvizTrailer", "console: ${message.message()}")
                        return true
                    }
                }
                webViewClient = object : WebViewClient() {
                    override fun onReceivedError(view: WebView, request: android.webkit.WebResourceRequest, error: android.webkit.WebResourceError) {
                        android.util.Log.w("MovvizTrailer", "réseau: ${request.url} → ${error.description}")
                    }
                }
                webView = this
            }
        },
        update = { view ->
            if (view.tag != key) {
                view.tag = key
                view.removeJavascriptInterface("MovvizTrailer")
                view.addJavascriptInterface(bridge, "MovvizTrailer")
                // Même principe que le desktop : la page qui embarque le lecteur
                // YouTube est servie depuis l'adresse de Movviz (jamais depuis
                // youtube.com lui-même), donc YouTube voit une origine d'intégration
                // normale au lieu d'un lecteur qui s'embarque lui-même.
                val base = originUrl?.takeIf { it.startsWith("http") } ?: "https://www.youtube.com"
                view.loadDataWithBaseURL(base, youtubeTrailerHtml(key, base), "text/html", "utf-8", null)
            }
        },
        onRelease = { view ->
            view.stopLoading()
            view.loadUrl("about:blank")
            view.removeJavascriptInterface("MovvizTrailer")
            view.destroy()
        },
        modifier = modifier,
    )
}

private fun youtubeTrailerHtml(key: String, origin: String): String = """
    <!doctype html><html><body style="margin:0;background:#000;overflow:hidden">
    <style>html,body{height:100%}#player,#player iframe{position:absolute;top:0;left:0;width:100%;height:100%}</style>
    <div id="player"></div><script src="https://www.youtube.com/iframe_api"></script>
    <script>
      var p; var unmuted=false;
      function onYouTubeIframeAPIReady(){
        p=new YT.Player('player',{
          width:'100%',height:'100%',videoId:'$key',
          playerVars:{autoplay:1,mute:1,controls:0,playsinline:1,rel:0,modestbranding:1,fs:0,iv_load_policy:3,disablekb:1,origin:'$origin'},
          events:{
            onReady:function(e){e.target.mute();e.target.playVideo();},
            onStateChange:function(e){
              if(e.data===YT.PlayerState.PLAYING&&!unmuted){
                unmuted=true;
                try{p.unMute();p.setVolume(100);}catch(x){}
              }
              if(e.data===YT.PlayerState.ENDED){MovvizTrailer.ended();}
            },
            onError:function(e){MovvizTrailer.error(e.data);}
          }
        });
        setInterval(function(){
          if(!p||!p.getCurrentTime)return;
          MovvizTrailer.tick(p.getCurrentTime()||0,p.getDuration()||0,p.getPlayerState());
        },400);
      }
      function toggle(){if(!p)return;if(p.getPlayerState()===1){p.pauseVideo();}else{p.playVideo();}}
      function seekBy(s){
        if(!p)return;
        var d=p.getDuration()||0;
        var t=Math.max(0,p.getCurrentTime()+s);
        if(d>0){t=Math.min(t,Math.max(0,d-1));}
        p.seekTo(t,true);
      }
    </script></body></html>
""".trimIndent()

@Composable
private fun DirectTrailer(
    url: String,
    onError: () -> Unit,
    onEnded: () -> Unit,
    clock: TrailerClock,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current.applicationContext
    val player = remember(url) { ExoPlayer.Builder(context).build() }
    val main = remember { Handler(Looper.getMainLooper()) }
    DisposableEffect(player) {
        val listener = object : Player.Listener {
            override fun onPlayerError(error: androidx.media3.common.PlaybackException) { main.post(onError) }
            override fun onPlaybackStateChanged(state: Int) { if (state == Player.STATE_ENDED) main.post(onEnded) }
        }
        player.addListener(listener)
        player.setMediaItem(MediaItem.fromUri(url))
        player.prepare()
        player.playWhenReady = true
        clock.onControls(
            { player.playWhenReady = !player.playWhenReady },
            { seconds ->
                val target = player.currentPosition + seconds * 1000L
                val limit = if (player.duration != C.TIME_UNSET) (player.duration - 1000L).coerceAtLeast(0L) else Long.MAX_VALUE
                player.seekTo(target.coerceIn(0L, limit))
            },
        )
        onDispose {
            player.removeListener(listener)
            player.release()
        }
    }
    LaunchedEffect(player) {
        while (true) {
            val duration = if (player.duration != C.TIME_UNSET) player.duration else 0L
            clock.onTick(player.currentPosition, duration, player.isPlaying)
            delay(400)
        }
    }
    AndroidView(
        factory = { ctx ->
            PlayerView(ctx).apply {
                useController = false
                isFocusable = false
                isFocusableInTouchMode = false
                this.player = player
            }
        },
        update = { it.player = player },
        modifier = modifier,
    )
}
