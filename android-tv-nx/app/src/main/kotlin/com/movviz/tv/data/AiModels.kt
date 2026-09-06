package com.movviz.tv.data

import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class AiChatMessageDto(
    val role: String,
    val content: String,
    val actions: List<AiActionOutcomeDto>? = null,
    val recommendations: List<AiRecommendationDto>? = null,
)

@JsonClass(generateAdapter = true)
data class AiActionOutcomeDto(
    val title: String,
    val year: Int? = null,
    val type: String = "movie",
    val status: String = "already",
    val tmdbId: Int? = null,
    val detail: String? = null,
    val libraryId: String? = null,
)

@JsonClass(generateAdapter = true)
data class AiRecommendationDto(
    val title: String,
    val year: Int? = null,
    val type: String = "movie",
    val tmdbId: Int,
    val overview: String = "",
    val posterPath: String? = null,
    val rating: Double = 0.0,
    val inLibrary: Boolean = false,
    val reason: String? = null,
)

@JsonClass(generateAdapter = true)
data class AiSessionResponseDto(
    val messages: List<AiChatMessageDto> = emptyList(),
    val enabled: Boolean = false,
    val proactive: Boolean = false,
)

@JsonClass(generateAdapter = true)
data class AiChatRequestDto(
    val message: String,
    val pageContext: AiPageContextDto? = null,
)

@JsonClass(generateAdapter = true)
data class AiPageContextDto(
    val tmdbId: Int,
    val type: String,
    val title: String,
)

@JsonClass(generateAdapter = true)
data class AiChatResponseDto(
    val message: AiChatMessageDto? = null,
    val provider: String? = null,
    val error: String? = null,
    val detail: String? = null,
)
