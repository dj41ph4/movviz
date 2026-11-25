package com.movviz.nx.mobile.ui.player

import android.app.Presentation
import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.hardware.display.DisplayManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Display
import android.view.SurfaceView
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.media3.common.Player
import androidx.media3.common.VideoSize
import androidx.media3.common.text.CueGroup
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.CaptionStyleCompat
import androidx.media3.ui.PlayerView
import androidx.media3.ui.SubtitleView

/**
 * Écran sans fil (Miracast / Smart View) connecté par le système : au lieu de
 * dupliquer le téléphone (barres, commandes, image réduite), la vidéo est rendue
 * en plein écran et en pleine définition sur la TV grâce à l'API Presentation,
 * sous-titres compris, et le téléphone garde les commandes. Renvoie le nom de
 * l'écran utilisé, ou null quand la vidéo est sur le téléphone.
 */
@Composable
fun rememberExternalVideoOutput(player: ExoPlayer, phoneView: PlayerView?, enabled: Boolean): String? {
    val context = LocalContext.current
    val manager = remember { context.getSystemService(Context.DISPLAY_SERVICE) as? DisplayManager }
    fun currentDisplay(): Display? = manager?.getDisplays(DisplayManager.DISPLAY_CATEGORY_PRESENTATION)?.firstOrNull()
    var display by remember { mutableStateOf(currentDisplay()) }
    var activeName by remember { mutableStateOf<String?>(null) }
    DisposableEffect(manager) {
        val listener = object : DisplayManager.DisplayListener {
            override fun onDisplayAdded(displayId: Int) { display = currentDisplay() }
            override fun onDisplayRemoved(displayId: Int) { display = currentDisplay() }
            override fun onDisplayChanged(displayId: Int) {}
        }
        manager?.registerDisplayListener(listener, Handler(Looper.getMainLooper()))
        onDispose { manager?.unregisterDisplayListener(listener) }
    }
    val target = display.takeIf { enabled }
    DisposableEffect(target?.displayId, player, phoneView) {
        if (target == null) {
            activeName = null
            return@DisposableEffect onDispose {}
        }
        val presentation = VideoPresentation(context, target, player)
        val shown = runCatching { presentation.show(); true }.getOrDefault(false)
        // Affichage refusé : la vidéo reste (ou revient) sur le téléphone.
        val backToPhone = {
            presentation.release()
            phoneView?.let { v -> v.player = null; v.player = player }
        }
        if (!shown) backToPhone()
        activeName = if (shown) target.name else null
        onDispose {
            activeName = null
            if (shown) {
                backToPhone()
                runCatching { presentation.dismiss() }
            }
        }
    }
    return activeName
}

private class VideoPresentation(context: Context, display: Display, private val player: ExoPlayer) : Presentation(context, display) {
    private val frame = AspectRatioFrameLayout(context)
    private val surface = SurfaceView(context)
    private val subtitles = SubtitleView(context)
    private var attached = false
    private val listener = object : Player.Listener {
        override fun onVideoSizeChanged(videoSize: VideoSize) = applyRatio(videoSize)
        override fun onCues(cueGroup: CueGroup) { subtitles.setCues(cueGroup.cues) }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val root = FrameLayout(context).apply { setBackgroundColor(Color.BLACK) }
        frame.resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
        frame.addView(surface, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        // Mêmes sous-titres que sur le téléphone (style du lecteur Movviz).
        subtitles.setApplyEmbeddedStyles(false)
        subtitles.setApplyEmbeddedFontSizes(false)
        subtitles.setStyle(
            CaptionStyleCompat(
                Color.WHITE, Color.TRANSPARENT, Color.TRANSPARENT,
                CaptionStyleCompat.EDGE_TYPE_DROP_SHADOW, Color.argb(200, 0, 0, 0), Typeface.DEFAULT_BOLD,
            ),
        )
        subtitles.setFractionalTextSize(0.07f)
        subtitles.setBottomPaddingFraction(0.12f)
        frame.addView(subtitles, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        root.addView(frame, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT, android.view.Gravity.CENTER))
        setContentView(root)
        applyRatio(player.videoSize)
        subtitles.setCues(player.currentCues.cues)
        player.addListener(listener)
        player.setVideoSurfaceView(surface)
        attached = true
    }

    private fun applyRatio(size: VideoSize) {
        if (size.width > 0 && size.height > 0) frame.setAspectRatio(size.width * size.pixelWidthHeightRatio / size.height)
    }

    fun release() {
        if (!attached) return
        attached = false
        player.removeListener(listener)
        player.clearVideoSurfaceView(surface)
    }
}
