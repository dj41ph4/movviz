package com.movviz.tv.data

import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class PlaybackProtocolsDto(
    val progressive: Boolean = true,
    val hls: Boolean = true,
    val dash: Boolean = true,
    val mse: Boolean = false,
)

@JsonClass(generateAdapter = true)
data class PlaybackVideoCapabilityDto(
    val codec: String,
    val profiles: List<String>? = null,
    val levels: List<String>? = null,
    val bitDepths: List<Int>? = null,
    val maxWidth: Int? = null,
    val maxHeight: Int? = null,
    val maxFps: Double? = null,
    val hardwareDecode: Boolean? = null,
    val hdr: List<String>? = null,
)

@JsonClass(generateAdapter = true)
data class PlaybackAudioCapabilityDto(
    val codec: String,
    val maxChannels: Int? = null,
    val decode: Boolean = false,
    val passthrough: Boolean = false,
)

@JsonClass(generateAdapter = true)
data class PlaybackSubtitleCapabilityDto(
    val codec: String,
    val nativeRender: Boolean = false,
    val externalSupported: Boolean = false,
    val embeddedSupported: Boolean = false,
    val convertible: Boolean = false,
)

@JsonClass(generateAdapter = true)
data class PlaybackClientProfileDto(
    val clientType: String = "android-tv",
    val deviceId: String,
    val appVersion: String,
    val protocols: PlaybackProtocolsDto = PlaybackProtocolsDto(),
    val containers: List<String>,
    val videoCapabilities: List<PlaybackVideoCapabilityDto>,
    val audioCapabilities: List<PlaybackAudioCapabilityDto>,
    val subtitleCapabilities: List<PlaybackSubtitleCapabilityDto>,
    val maxWidth: Int? = null,
    val maxHeight: Int? = null,
    val maxBitrate: Int? = null,
)

@JsonClass(generateAdapter = true)
data class PlaybackPrepareRequestDto(
    val mediaId: String,
    val ratingKey: String? = null,
    val clientProfile: PlaybackClientProfileDto,
    val audioTrack: Int? = null,
    val audioLanguage: String? = null,
    val subtitleTrack: Int? = null,
    val quality: String = "original",
)

@JsonClass(generateAdapter = true)
data class PlaybackPreparedAudioTrackDto(
    val index: Int,
    val codec: String,
    val language: String? = null,
    val title: String? = null,
    val channels: Int? = null,
    val default: Boolean? = null,
    val forced: Boolean? = null,
)

@JsonClass(generateAdapter = true)
data class PlaybackPreparedSubtitleTrackDto(
    val index: Int,
    val codec: String,
    val language: String? = null,
    val title: String? = null,
    val default: Boolean? = null,
    val forced: Boolean? = null,
    val type: String = "text",
)

@JsonClass(generateAdapter = true)
data class PlaybackPreparedTracksDto(
    val audio: List<PlaybackPreparedAudioTrackDto> = emptyList(),
    val subtitle: List<PlaybackPreparedSubtitleTrackDto> = emptyList(),
)

@JsonClass(generateAdapter = true)
data class PlaybackPlanSummaryDto(
    val mode: String = "DIRECT_PLAY",
    val videoAction: String = "COPY",
    val audioAction: String = "COPY",
    val subtitleAction: String = "NONE",
    val protocol: String? = null,
    val reasons: List<String> = emptyList(),
)

@JsonClass(generateAdapter = true)
data class PlaybackPreparedStreamDto(
    val url: String,
    val protocol: String = "progressive",
)

@JsonClass(generateAdapter = true)
data class PlaybackPrepareResponseDto(
    val sessionId: String,
    val plan: PlaybackPlanSummaryDto = PlaybackPlanSummaryDto(),
    val tracks: PlaybackPreparedTracksDto = PlaybackPreparedTracksDto(),
    val stream: PlaybackPreparedStreamDto,
)
