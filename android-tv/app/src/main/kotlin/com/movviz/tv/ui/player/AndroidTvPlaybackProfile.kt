package com.movviz.tv.ui.player

import android.content.Context
import android.media.AudioDeviceInfo
import android.media.AudioFormat
import android.media.AudioManager
import android.os.Build
import android.provider.Settings
import android.view.Display
import android.view.WindowManager
import androidx.media3.common.MimeTypes
import androidx.media3.exoplayer.mediacodec.MediaCodecUtil
import com.movviz.tv.BuildConfig
import com.movviz.tv.data.PlaybackAudioCapabilityDto
import com.movviz.tv.data.PlaybackClientProfileDto
import com.movviz.tv.data.PlaybackSubtitleCapabilityDto
import com.movviz.tv.data.PlaybackVideoCapabilityDto

/**
 * Profil réellement détecté sur le boîtier, envoyé au planner Movviz. Aucune
 * table "Android TV sait forcément lire X" : MediaCodecList décide pour la
 * vidéo/audio et les sorties audio déclarent leur passthrough réel.
 */
internal fun buildAndroidTvPlaybackProfile(context: Context): PlaybackClientProfileDto {
    val hdr = supportedHdrTypes(context)
    val video = listOf(
        "h264" to MimeTypes.VIDEO_H264,
        "hevc" to MimeTypes.VIDEO_H265,
        "av1" to MimeTypes.VIDEO_AV1,
        "vp9" to MimeTypes.VIDEO_VP9,
        "vp8" to MimeTypes.VIDEO_VP8,
        "mpeg4" to MimeTypes.VIDEO_MP4V,
        "mpeg2video" to MimeTypes.VIDEO_MPEG2,
    ).mapNotNull { (codec, mime) ->
        val decoders = runCatching { MediaCodecUtil.getDecoderInfos(mime, false, false) }.getOrDefault(emptyList())
        if (decoders.isEmpty()) null else PlaybackVideoCapabilityDto(
            codec = codec,
            hardwareDecode = decoders.any { info -> !info.softwareOnly },
            hdr = hdr.takeIf { it.isNotEmpty() },
        )
    }

    val passthroughEncodings = outputAudioEncodings(context)
    val audio = listOf(
        Triple("aac", MimeTypes.AUDIO_AAC, null),
        Triple("mp3", MimeTypes.AUDIO_MPEG, null),
        Triple("ac3", MimeTypes.AUDIO_AC3, AudioFormat.ENCODING_AC3),
        Triple("eac3", MimeTypes.AUDIO_E_AC3, AudioFormat.ENCODING_E_AC3),
        Triple("dts", MimeTypes.AUDIO_DTS, encodingDts()),
        Triple("dts_hd", MimeTypes.AUDIO_DTS_HD, encodingDtsHd()),
        Triple("truehd", MimeTypes.AUDIO_TRUEHD, encodingTrueHd()),
        Triple("opus", MimeTypes.AUDIO_OPUS, null),
        Triple("flac", MimeTypes.AUDIO_FLAC, null),
        Triple("vorbis", MimeTypes.AUDIO_VORBIS, null),
    ).mapNotNull { (codec, mime, passEncoding) ->
        val decode = runCatching { MediaCodecUtil.getDecoderInfos(mime, false, false).isNotEmpty() }.getOrDefault(false)
        val passthrough = passEncoding != null && passEncoding in passthroughEncodings
        if (!decode && !passthrough) null else PlaybackAudioCapabilityDto(
            codec = codec,
            maxChannels = if (codec in setOf("ac3", "eac3", "dts", "dts_hd", "truehd")) 8 else null,
            decode = decode,
            passthrough = passthrough,
        )
    }

    val subtitles = listOf(
        PlaybackSubtitleCapabilityDto("subrip", nativeRender = true, externalSupported = true, embeddedSupported = true, convertible = true),
        PlaybackSubtitleCapabilityDto("srt", nativeRender = true, externalSupported = true, embeddedSupported = true, convertible = true),
        PlaybackSubtitleCapabilityDto("webvtt", nativeRender = true, externalSupported = true, embeddedSupported = true, convertible = true),
        PlaybackSubtitleCapabilityDto("ass", nativeRender = true, externalSupported = true, embeddedSupported = true, convertible = true),
        PlaybackSubtitleCapabilityDto("ssa", nativeRender = true, externalSupported = true, embeddedSupported = true, convertible = true),
        PlaybackSubtitleCapabilityDto("mov_text", nativeRender = true, embeddedSupported = true, convertible = true),
        // Media3 contient un décodeur PGS. Le signaler évite un burn-in vidéo
        // inutile ; si un constructeur expose un flux PGS réellement cassé,
        // l'erreur Media3 reste récupérable par un replan explicite.
        PlaybackSubtitleCapabilityDto("hdmv_pgs_subtitle", embeddedSupported = true),
    )

    val deviceId = runCatching {
        Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
    }.getOrNull().orEmpty().ifBlank { "${Build.MANUFACTURER}-${Build.MODEL}" }

    return PlaybackClientProfileDto(
        deviceId = deviceId,
        appVersion = BuildConfig.VERSION_NAME,
        containers = listOf("mkv", "mp4", "webm", "ts"),
        videoCapabilities = video,
        audioCapabilities = audio,
        subtitleCapabilities = subtitles,
    )
}

private fun supportedHdrTypes(context: Context): List<String> {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return emptyList()
    val display = runCatching {
        @Suppress("DEPRECATION")
        (context.getSystemService(Context.WINDOW_SERVICE) as WindowManager).defaultDisplay
    }.getOrNull() ?: return emptyList()
    return runCatching {
        display.hdrCapabilities.supportedHdrTypes.mapNotNull { type ->
            when (type) {
                Display.HdrCapabilities.HDR_TYPE_HDR10 -> "hdr10"
                Display.HdrCapabilities.HDR_TYPE_HLG -> "hlg"
                Display.HdrCapabilities.HDR_TYPE_DOLBY_VISION -> "dolby-vision"
                else -> null
            }
        }.distinct()
    }.getOrDefault(emptyList())
}

private fun outputAudioEncodings(context: Context): Set<Int> {
    val manager = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return emptySet()
    return runCatching {
        manager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)
            .asSequence()
            .filter { it.type != AudioDeviceInfo.TYPE_BUILTIN_SPEAKER || it.encodings.isNotEmpty() }
            .flatMap { it.encodings.asSequence() }
            .toSet()
    }.getOrDefault(emptySet())
}

private fun encodingDts(): Int? = runCatching { AudioFormat.ENCODING_DTS }.getOrNull()
private fun encodingDtsHd(): Int? = runCatching { AudioFormat.ENCODING_DTS_HD }.getOrNull()
private fun encodingTrueHd(): Int? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) AudioFormat.ENCODING_DOLBY_TRUEHD else null
