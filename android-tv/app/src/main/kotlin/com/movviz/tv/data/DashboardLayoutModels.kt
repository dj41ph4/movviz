package com.movviz.tv.data

import com.squareup.moshi.JsonClass

/**
 * Miroir volontairement compact de src/lib/dashboard/types.ts. La TV lit le
 * même layout que le desktop : ordre/visibilité des rails, activation du hero,
 * vitesse du slideshow, autoplay trailer et année minimale. Aucun réglage TV
 * parallèle ne peut donc dériver du dashboard web.
 */
@JsonClass(generateAdapter = true)
data class DashboardLayoutResponseDto(
    val layout: DashboardLayoutDto = DashboardLayoutDto(),
)

@JsonClass(generateAdapter = true)
data class DashboardLayoutDto(
    val version: Int = 2,
    val mode: String = "cinema",
    val hero: DashboardHeroSettingsDto = DashboardHeroSettingsDto(),
    val sections: List<DashboardSectionDto> = defaultDashboardSections(),
)

@JsonClass(generateAdapter = true)
data class DashboardHeroSettingsDto(
    val enabled: Boolean = true,
    val slideshowSpeedSec: Int = 10,
    val trailerAutoplay: Boolean = false,
    val includeOwned: Boolean = true,
    val includeUnowned: Boolean = true,
    val minYear: Int? = null,
)

@JsonClass(generateAdapter = true)
data class DashboardSectionDto(
    val id: String,
    val visible: Boolean = true,
)

fun defaultDashboardSections(): List<DashboardSectionDto> = listOf(
    "continueWatching",
    "becauseYouLike",
    "shortSessions",
    "availableNow",
    "comingSoon",
    "upgradesAvailable",
    "discover",
).map { DashboardSectionDto(it, true) }
