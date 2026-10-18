package com.movviz.tv.ui.home

import com.movviz.tv.data.RecentEpisodeDto
import org.junit.Assert.assertEquals
import org.junit.Test

class BleachRecentEpisodesTest {
    @Test fun tybwRecentEpisodesStaySeparateAndUseLogicalCourNumbers() {
        val episodes = listOf(
            episode(season = 17, number = 27, addedAt = 3),
            episode(season = 17, number = 28, addedAt = 2),
            episode(season = 16, number = 21, addedAt = 1),
            episode(season = 16, number = 22, addedAt = 0),
        )

        val cards = groupRecentEpisodes(episodes, emptySet(), emptyList())

        assertEquals(2, cards.size)
        assertEquals("tybw", cards[0].seriesPart)
        assertEquals("Saison 3", cards[0].seasonLabel)
        assertEquals("original", cards[1].seriesPart)
        assertEquals("Saison 16", cards[1].seasonLabel)
    }

    private fun episode(season: Int, number: Int, addedAt: Long) = RecentEpisodeDto(
        tmdbId = 30984,
        seriesTitle = "Bleach",
        episodeTitle = "Episode $number",
        seasonNumber = season,
        episodeNumber = number,
        posterPath = null,
        backdropPath = null,
        rating = 0.0,
        addedAt = addedAt,
    )
}
