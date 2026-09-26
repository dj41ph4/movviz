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
    // « lance-le » : ce que l'assistant a démarré (ouvert dans le lecteur).
    val play: AiPlayDto? = null,
)

@JsonClass(generateAdapter = true)
data class AiPlayDto(
    val type: String,
    val tmdbId: Int,
    val title: String,
    val posterPath: String? = null,
    val ratingKey: String,
    val movvizId: String,
    val seriesId: String? = null,
    val seasonNumber: Int? = null,
    val episodeNumber: Int? = null,
    val episodeTitle: String? = null,
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
    // Nullables : une vieille carte sans résumé ni note (null côté serveur)
    // ne doit jamais faire échouer la lecture de toute la conversation.
    val overview: String? = null,
    val posterPath: String? = null,
    val rating: Double? = null,
    val inLibrary: Boolean = false,
    val reason: String? = null,
    val distance: String? = null,
)

@JsonClass(generateAdapter = true)
data class AiSessionResponseDto(
    val messages: List<AiChatMessageDto> = emptyList(),
    val enabled: Boolean = false,
    val proactive: Boolean = false,
    // Réglages IA de l'admin (désactivés par défaut) : dictée et lecture à voix haute.
    val voiceInput: Boolean = false,
    val voiceOutput: Boolean = false,
)

@JsonClass(generateAdapter = true)
data class AiChatRequestDto(
    val message: String,
    val pageContext: AiPageContextDto? = null,
    /** Fuseau de l'appareil, pour que l'assistant connaisse l'heure locale. */
    val timeZone: String? = java.util.TimeZone.getDefault().id,
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
