package com.movviz.nx.mobile.ui.player

internal data class VideoLetterbox(val top: Float, val bottom: Float) {
    val scale: Float get() = 1f / (1f - top - bottom)
}

// Native cinematic streams (including 21:9) are never auto-zoomed.
internal fun canDetectVideoLetterbox(aspect: Float): Boolean = aspect.isFinite() && aspect in 1.25f..2.19f

/** Null means inconclusive (dark scene, unsafe/asymmetric framing).
 * A zero crop means a bright full-height scene, allowing a confirmed reset. */
internal fun detectVideoLetterbox(pixels: IntArray, width: Int, height: Int): VideoLetterbox? {
    if (width < 32 || height < 32 || pixels.size != width * height) return null
    fun nearBlack(pixel: Int): Boolean = ((pixel shr 16) and 255) <= 16 &&
        ((pixel shr 8) and 255) <= 16 && (pixel and 255) <= 16
    var bright = 0
    var sampled = 0
    for (y in height / 4 until height * 3 / 4) for (x in width / 10 until width * 9 / 10) {
        val p = pixels[y * width + x]
        if (maxOf((p shr 16) and 255, (p shr 8) and 255, p and 255) > 48) bright++
        sampled++
    }
    if (sampled == 0 || bright.toFloat() / sampled < 0.15f) return null
    fun blackRow(y: Int): Boolean {
        val start = width / 20
        val end = width * 19 / 20
        return (start until end).count { nearBlack(pixels[y * width + it]) }.toFloat() / (end - start) >= 0.99f
    }
    val limit = (height * 0.24f).toInt()
    var top = 0
    var bottom = 0
    while (top < limit && blackRow(top)) top++
    while (bottom < limit && blackRow(height - 1 - bottom)) bottom++
    if (top == limit || bottom == limit || kotlin.math.abs(top - bottom) > 2) return null
    val fraction = (top + bottom).toFloat() / height
    if (fraction < 0.05f) return VideoLetterbox(0f, 0f)
    if (top < 2 || bottom < 2 || fraction > 0.33f) return null
    return VideoLetterbox(top.toFloat() / height, bottom.toFloat() / height)
}

/** Four matching bright frames are required both to crop and to reset.
 * Inconclusive frames preserve the accepted crop but cancel pending evidence. */
internal class StableVideoLetterbox {
    private var pending: VideoLetterbox? = null
    private var count = 0
    var accepted: VideoLetterbox? = null
        private set

    fun observe(candidate: VideoLetterbox?): VideoLetterbox? {
        if (candidate == null) { pending = null; count = 0; return accepted }
        val previous = pending
        if (previous != null && kotlin.math.abs(previous.top - candidate.top) < 0.02f &&
            kotlin.math.abs(previous.bottom - candidate.bottom) < 0.02f) count++
        else { pending = candidate; count = 1 }
        val current = accepted
        val alreadyMatches = current != null && kotlin.math.abs(current.top - candidate.top) < 0.02f &&
            kotlin.math.abs(current.bottom - candidate.bottom) < 0.02f
        if (count >= 4 && !alreadyMatches) accepted = candidate
        return accepted
    }
}
