package com.movviz.nx.mobile.ui.player

import android.graphics.Bitmap
import android.os.Handler
import android.os.Looper
import android.view.PixelCopy
import android.view.SurfaceView
import android.view.View
import android.view.ViewGroup
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
    val surfaces = remember(view, mediaKey) { mutableSetOf<View>() }
    val parents = remember(view, mediaKey) { mutableMapOf<ViewGroup, Pair<Boolean, Boolean>>() }
    val transforms = remember(view, mediaKey) { mutableMapOf<View, VideoSurfaceTransform>() }

    fun applyTransform(animate: Boolean) {
        if (view == null) return
        val surface = view.videoSurfaceView ?: return
        if (surface.width <= 0 || surface.height <= 0 || view.width <= 0 || view.height <= 0) return
        val transform = videoSurfaceTransform(surface.width, surface.height, view.width, view.height, crop, fillScreen)
        if (transforms[surface] == transform) return
        surfaces += surface
        val parent = surface.parent as? ViewGroup
        if (parent != null && !parents.containsKey(parent)) {
            parents[parent] = parent.clipChildren to parent.clipToPadding
            parent.clipChildren = false
            parent.clipToPadding = false
        }
        surface.animate().cancel()
        if (animate) {
            surface.animate().scaleX(transform.scale).scaleY(transform.scale)
                .translationY(transform.shiftY).setDuration(350).start()
        } else {
            surface.scaleX = transform.scale
            surface.scaleY = transform.scale
            surface.translationY = transform.shiftY
        }
        transforms[surface] = transform
    }

    // Layout changes and display toggles also work while paused. Sampling is
    // independent: a tablet resize must not discard confirmed black bars.
    val currentApply by rememberUpdatedState<(Boolean) -> Unit> { applyTransform(it) }
    DisposableEffect(view, mediaKey) {
        val surface = view?.videoSurfaceView
        val listener = View.OnLayoutChangeListener { _, _, _, _, _, _, _, _, _ -> currentApply(false) }
        view?.addOnLayoutChangeListener(listener)
        surface?.addOnLayoutChangeListener(listener)
        onDispose {
            view?.removeOnLayoutChangeListener(listener)
            surface?.removeOnLayoutChangeListener(listener)
            surfaces.forEach {
                it.animate().cancel()
                it.scaleX = 1f
                it.scaleY = 1f
                it.translationY = 0f
            }
            parents.forEach { (parent, previous) ->
                parent.clipChildren = previous.first
                parent.clipToPadding = previous.second
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
