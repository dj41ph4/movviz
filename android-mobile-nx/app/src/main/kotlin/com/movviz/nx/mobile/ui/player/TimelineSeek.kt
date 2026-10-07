package com.movviz.nx.mobile.ui.player

internal fun timelineSeekPosition(x: Float, width: Int, durationMs: Long): Long? {
    if (width <= 0 || durationMs <= 0 || !x.isFinite()) return null
    return (x.toDouble() / width).coerceIn(0.0, 1.0)
        .let { (it * durationMs).toLong().coerceIn(0L, durationMs) }
}
