package com.movviz.nx.mobile.ui.player

import android.animation.ValueAnimator
import android.graphics.Bitmap
import android.os.Handler
import android.os.Looper
import android.view.PixelCopy
import android.view.SurfaceView
import android.view.View
import android.view.ViewGroup
import android.view.Gravity
import android.widget.FrameLayout
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.common.Player
import androidx.media3.common.VideoSize
import androidx.media3.ui.PlayerView
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.withContext
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine

/** Small frame samples, never file transcoding. Only the video surface is
 * transformed: subtitles, controls and branding retain their normal geometry. */
@Composable
internal fun PlayerImmersion(player: ExoPlayer, view: PlayerView?, mediaKey: String, hasFrame: Boolean, fillScreen: Boolean) {
    var crop by remember(player, view, mediaKey) { mutableStateOf<VideoLetterbox?>(null) }
    // Observe during composition: reading crop only in a SideEffect/callback
    // does not recompose when the detector confirms new bars.
    val currentCrop = crop
    val surfaces = remember(view, mediaKey) { mutableMapOf<View, ViewGroup.LayoutParams>() }
    val layouts = remember(view, mediaKey) { mutableMapOf<View, VideoSurfaceLayout>() }
    val animations = remember(view, mediaKey) { mutableMapOf<View, ValueAnimator>() }

    fun applyTransform(animate: Boolean) {
        if (view == null) return
        val surface = view.videoSurfaceView ?: return
        if (surface.width <= 0 || surface.height <= 0 || view.width <= 0 || view.height <= 0) return
        val size = player.videoSize
        val aspect = if (size.height > 0) size.width * size.pixelWidthHeightRatio / size.height else 0f
        val target = videoSurfaceLayout(aspect, view.width, view.height, currentCrop, fillScreen) ?: return
        if (layouts[surface] == target) return
        surfaces.putIfAbsent(surface, surface.layoutParams)
        surface.animate().cancel()
        animations.remove(surface)?.cancel()
        surface.scaleX = 1f
        surface.scaleY = 1f
        fun resize(width: Int, height: Int, shift: Float) {
            val previous = surface.layoutParams as? FrameLayout.LayoutParams ?: return
            if (previous.width != width || previous.height != height || previous.gravity != Gravity.CENTER) {
                surface.layoutParams = FrameLayout.LayoutParams(previous).apply {
                    this.width = width
                    this.height = height
                    gravity = Gravity.CENTER
                }
            }
            surface.translationY = shift
        }
        layouts[surface] = target
        if (animate) {
            val fromWidth = surface.width
            val fromHeight = surface.height
            val fromShift = surface.translationY
            animations[surface] = ValueAnimator.ofFloat(0f, 1f).apply {
                duration = 350
                addUpdateListener {
                    val fraction = it.animatedValue as Float
                    resize(
                        (fromWidth + (target.width - fromWidth) * fraction).toInt(),
                        (fromHeight + (target.height - fromHeight) * fraction).toInt(),
                        fromShift + (target.shiftY - fromShift) * fraction,
                    )
                }
                start()
            }
        } else {
            resize(target.width, target.height, target.shiftY)
        }
    }

    // Layout changes and display toggles also work while paused. Sampling is
    // independent: a tablet resize must not discard confirmed black bars.
    val currentApply by rememberUpdatedState<(Boolean) -> Unit> { applyTransform(it) }
    DisposableEffect(player, view, mediaKey) {
        val surface = view?.videoSurfaceView
        val listener = View.OnLayoutChangeListener { _, _, _, _, _, _, _, _, _ -> currentApply(false) }
        view?.addOnLayoutChangeListener(listener)
        surface?.addOnLayoutChangeListener(listener)
        val videoListener = object : Player.Listener {
            override fun onVideoSizeChanged(videoSize: VideoSize) { currentApply(false) }
        }
        player.addListener(videoListener)
        onDispose {
            player.removeListener(videoListener)
            view?.removeOnLayoutChangeListener(listener)
            surface?.removeOnLayoutChangeListener(listener)
            animations.values.forEach { it.cancel() }
            surfaces.forEach { (surface, originalParams) ->
                surface.animate().cancel()
                surface.scaleX = 1f
                surface.scaleY = 1f
                surface.translationY = 0f
                surface.layoutParams = originalParams
            }
        }
    }
    SideEffect { applyTransform(true) }

    LaunchedEffect(player, view, mediaKey, hasFrame) {
        if (view == null || !hasFrame) return@LaunchedEffect
        var detector = StableVideoLetterbox()
        var sampledAspect = 0f
        crop = null
        while (isActive) {
            delay(700)
            if (!player.isPlaying) continue
            val size = player.videoSize
            val aspect = if (size.height > 0) size.width * size.pixelWidthHeightRatio / size.height else 0f
            val surface = view.videoSurfaceView as? SurfaceView ?: continue
            if (kotlin.math.abs(aspect - sampledAspect) > 0.01f) {
                crop = null
                detector = StableVideoLetterbox()
                sampledAspect = aspect
            }
            if (!canDetectVideoLetterbox(aspect)) {
                crop = null
                detector = StableVideoLetterbox()
                continue
            }
            val sample = captureVideoSample(surface, aspect) ?: continue
            val observation = try {
                withContext(Dispatchers.Default) {
                    val pixels = IntArray(sample.width * sample.height)
                    sample.getPixels(pixels, 0, sample.width, 0, 0, sample.width, sample.height)
                    detectVideoLetterbox(pixels, sample.width, sample.height)
                }
            } finally { sample.recycle() }
            val confirmed = detector.observe(observation)
            if (confirmed != null) crop = confirmed
        }
    }
}

// Wait for PixelCopy to finish even on cancellation before recycling its bitmap.
// A protected/unsupported surface simply keeps the original rendering.
private suspend fun captureVideoSample(surface: SurfaceView, aspect: Float): Bitmap? = suspendCoroutine { continuation ->
    if (!surface.holder.surface.isValid || surface.width <= 0 || surface.height <= 0) {
        continuation.resume(null)
        return@suspendCoroutine
    }
    val bitmap = Bitmap.createBitmap(160, (160 / aspect).toInt().coerceIn(32, 128), Bitmap.Config.ARGB_8888)
    try {
        PixelCopy.request(surface, bitmap, { result ->
            if (result == PixelCopy.SUCCESS) continuation.resume(bitmap)
            else { bitmap.recycle(); continuation.resume(null) }
        }, Handler(Looper.getMainLooper()))
    } catch (_: RuntimeException) {
        bitmap.recycle()
        continuation.resume(null)
    }
}
