package com.movviz.nx.mobile.ui.player

import android.graphics.Bitmap
import android.os.Handler
import android.os.Looper
import android.view.PixelCopy
import android.view.SurfaceView
import android.view.View
import android.view.ViewGroup
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
internal fun PlayerImmersion(player: ExoPlayer, view: PlayerView?, mediaKey: String, hasFrame: Boolean) {
    LaunchedEffect(player, view, mediaKey, hasFrame) {
        if (view == null || !hasFrame) return@LaunchedEffect
        var detector = StableVideoLetterbox()
        var applied: VideoLetterbox? = null
        val surfaces = mutableSetOf<View>()
        val parents = mutableMapOf<ViewGroup, Pair<Boolean, Boolean>>()
        fun apply(surface: View, crop: VideoLetterbox?) {
            if (applied == crop && surface in surfaces) return
            if (surface !in surfaces && (crop == null || crop.scale == 1f)) {
                applied = crop
                return
            }
            surfaces += surface
            val parent = surface.parent as? ViewGroup
            if (parent != null && !parents.containsKey(parent)) {
                parents[parent] = parent.clipChildren to parent.clipToPadding
                parent.clipChildren = false
                parent.clipToPadding = false
            }
            val scale = crop?.scale ?: 1f
            val shift = if (crop == null) 0f else -surface.height * scale * (crop.top - crop.bottom) / 2f
            surface.animate().cancel()
            surface.animate().scaleX(scale).scaleY(scale).translationY(shift).setDuration(350).start()
            applied = crop
        }
        try {
            while (isActive) {
                delay(700)
                if (!player.isPlaying) continue
                val size = player.videoSize
                val aspect = if (size.height > 0) size.width * size.pixelWidthHeightRatio / size.height else 0f
                val surface = view.videoSurfaceView as? SurfaceView ?: continue
                if (!canDetectVideoLetterbox(aspect)) {
                    if (surface in surfaces) apply(surface, null)
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
                if (confirmed != null) apply(surface, confirmed)
            }
        } finally {
            surfaces.forEach { surface ->
                surface.animate().cancel()
                surface.scaleX = 1f
                surface.scaleY = 1f
                surface.translationY = 0f
            }
            parents.forEach { (parent, previous) ->
                parent.clipChildren = previous.first
                parent.clipToPadding = previous.second
            }
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
