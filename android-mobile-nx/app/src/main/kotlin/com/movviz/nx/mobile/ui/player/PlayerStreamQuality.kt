package com.movviz.nx.mobile.ui.player

/** Only decoded stream values belong here; never library/source estimates. */
internal data class PlayerStreamQuality(val video: List<String>, val audio: List<String>)

internal fun detectedStreamQuality(
    width: Int = -1,
    height: Int = -1,
    videoMime: String? = null,
    hdr: String? = null,
    audioMime: String? = null,
    channels: Int = -1,
): PlayerStreamQuality {
    val resolution = when {
        width <= 0 || height <= 0 -> null
        maxOf(width, height) >= 7680 -> "8K"
        maxOf(width, height) >= 3840 -> "4K"
        maxOf(width, height) >= 1920 -> "1080p"
        maxOf(width, height) >= 1280 -> "720p"
        else -> "${minOf(width, height)}p"
    }
    val videoCodec = when (videoMime) {
        "video/hevc" -> "HEVC"
        "video/avc" -> "AVC"
        "video/av01" -> "AV1"
        "video/x-vnd.on2.vp9" -> "VP9"
        "video/x-vnd.on2.vp8" -> "VP8"
        else -> null
    }
    val audioCodec = when (audioMime) {
        "audio/eac3", "audio/eac3-joc" -> "EAC3"
        "audio/ac3" -> "AC3"
        "audio/true-hd" -> "TrueHD"
        "audio/vnd.dts" -> "DTS"
        "audio/vnd.dts.hd" -> "DTS-HD"
        "audio/mp4a-latm" -> "AAC"
        "audio/mpeg" -> "MP3"
        "audio/opus" -> "Opus"
        "audio/flac" -> "FLAC"
        else -> null
    }
    val channelLabel = when (channels) {
        1 -> "1.0"
        2 -> "2.0"
        6 -> "5.1"
        8 -> "7.1"
        in 3..Int.MAX_VALUE -> "$channels ch"
        else -> null
    }
    // TrueHD or 7.1 alone does not prove that the track contains Atmos.
    val atmos = if (audioMime == "audio/eac3-joc") "Atmos" else null
    return PlayerStreamQuality(
        video = listOfNotNull(resolution, hdr, videoCodec),
        audio = listOfNotNull(audioCodec, channelLabel, atmos),
    )
}
