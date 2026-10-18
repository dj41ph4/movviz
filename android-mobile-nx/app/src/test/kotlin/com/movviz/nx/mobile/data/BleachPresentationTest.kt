package com.movviz.nx.mobile.data

import org.junit.Assert.*
import org.junit.Test

class BleachPresentationTest {
    private fun episode(season: Int, number: Int) = SeriesEpisodeDto(season, number, "Episode $number", "missing", null)
    @Test fun twoSearchResultsKeepCanonicalIdAndDistinctKeys() {
        val raw = SearchResultDto(30984, "series", "Bleach", 2004, null)
        val results = BleachPresentation.searchViews(listOf(raw))
        assertEquals(listOf("original", "tybw"), results.map { it.seriesPart })
        assertEquals(listOf(30984, 30984), results.map { it.tmdbId })
        assertEquals(2, results.map { BleachPresentation.key(it) }.distinct().size)
        assertEquals(results, BleachPresentation.searchViews(results))
        assertEquals("tybw", BleachPresentation.part(30984, "series", season = 17))
    }
    @Test fun courTwoUsesCanonical17Episode14WithoutChangingOriginalSeasonTwo() {
        val original = SeriesSeasonDto(2, "Saison 2", listOf(episode(2, 1)))
        val raw = listOf(original, SeriesSeasonDto(17, "TYBW", (1..53).map { episode(17, it) }))
        val courses = BleachPresentation.seasons(raw, "tybw")
        val second = courses[1]
        assertEquals(17, second.seasonNumber)
        assertEquals((14..26).toList(), second.episodes.map { it.episodeNumber })
        assertEquals(1, second.episodes.first().displayEpisodeNumber)
        assertEquals(2, second.episodes.first().displaySeasonNumber)
        assertEquals(4, courses.map { BleachPresentation.seasonKey(it) }.distinct().size)
        assertEquals(50, courses.sumOf { it.episodes.size })
        assertEquals(53, raw.last().episodes.size)
        assertEquals(original, BleachPresentation.seasons(raw, "original").single())
        assertEquals(mapOf("seriesPart" to "tybw", "bleachPart" to 2), BleachPresentation.scope("tybw", second.bleachPart))
        assertFalse(BleachPresentation.contains("original", 17, 14))
        assertFalse(BleachPresentation.contains("tybw", 2, 1))
        assertEquals("S2 · Ép 1", BleachPresentation.episodeLabel(17, 14))
    }
    @Test fun absentPartAndArtworkStaySeparateOnSameLibraryRecord() {
        val original = SeriesSeasonDto(2, "Saison 2", listOf(episode(2, 1)))
        val raw = LibrarySeriesDto("same-id", 30984, "Bleach", 2004, posterPath = null, backdropPath = null, rating = 0.0,
            customBackdropPath = "/original.jpg", customLogoPath = "/original.png", seasons = listOf(original))
        val views = BleachPresentation.libraryViews(listOf(raw))
        assertEquals(listOf("original"), views.map { it.seriesPart })
        assertEquals("same-id", views.single().id)
        val both = raw.copy(seasons = raw.seasons + SeriesSeasonDto(17, "TYBW", listOf(episode(17,14))))
        val tybw = BleachPresentation.libraryViews(listOf(both)).last()
        assertEquals("same-id", tybw.id)
        assertNull(tybw.customBackdropPath)
        assertNull(tybw.customLogoPath)
        assertEquals(listOf(17), BleachPresentation.canonicalSeasons("tybw"))
        assertEquals((1..16).toList(), BleachPresentation.canonicalSeasons("original"))
    }
    @Test fun navigationAndApiPreservePartOnCanonicalIdentity() {
        assertEquals("detail/series/30984?seriesPart=tybw", com.movviz.nx.mobile.detailRoute("series", 30984, seriesPart = "tybw"))
        assertEquals("detail/series/30984?season=17&episode=14&seriesPart=tybw", com.movviz.nx.mobile.detailRoute("series", 30984, 17, 14))
        assertEquals("detail/series/30984?season=2&episode=1&seriesPart=original", com.movviz.nx.mobile.detailRoute("series", 30984, 2, 1))
        val search = MovvizApiService::class.java.methods.first { it.name == "search" }
        assertTrue(search.parameterAnnotations.flatten().filterIsInstance<retrofit2.http.Query>().any { it.value == "partViews" })
        val detail = MovvizApiService::class.java.methods.first { it.name == "metadataDetail" }
        assertTrue(detail.parameterAnnotations.flatten().filterIsInstance<retrofit2.http.Query>().any { it.value == "seriesPart" })
    }

}
