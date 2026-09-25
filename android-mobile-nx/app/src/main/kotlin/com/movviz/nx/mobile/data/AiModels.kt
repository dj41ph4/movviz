package com.movviz.nx.mobile.data

import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class AiChatMessageDto(
    val role: String,
    val content: String,
    val actions: List<AiActionOutcomeDto>? = null,
    val recommendations: List<AiRecommendationDto>? = null,
    // Cartes suivantes du classement, non affichées : « Déjà vu » / « Pas
    // pour moi » en fait monter une à la place (côté serveur, voir /api/ai/card).
    val alternates: List<AiRecommendationDto>? = null,
    // Réponses rapides sous le dernier message (un appui envoie le texte).
    val suggestions: List<String>? = null,
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
    val distance: String? = null,
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

@JsonClass(generateAdapter = true)
data class AiCardActionRequestDto(
    val action: String,
    val tmdbId: Int,
    val type: String,
    val title: String,
    val reason: String? = null,
)

@JsonClass(generateAdapter = true)
data class AiCardActionResponseDto(
    val ok: Boolean = false,
    val replacement: AiRecommendationDto? = null,
)

@JsonClass(generateAdapter = true)
data class AiFeedbackRequestDto(
    val tmdbId: Int,
    val type: String,
    val title: String,
    val liked: Boolean,
    val reason: String? = null,
)
