package com.movviz.tv.ui.home

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class TvRowFocusMemoryTest {
    @Test fun remembersFourthCardAfterReordering() {
        val reordered = listOf("four", "one", "two", "three")
        assertEquals(0, rememberedTvItemIndex(reordered, "four", 3))
    }

    @Test fun removedCardUsesNearestRemainingPosition() {
        assertEquals(3, rememberedTvItemIndex(listOf("one", "two", "three", "five"), "four", 3))
        assertEquals(1, rememberedTvItemIndex(listOf("one", "two"), "four", 3))
    }

    @Test fun emptyRowAndFirstEntryHaveSafeFallback() {
        assertEquals(0, rememberedTvItemIndex(emptyList(), "four", 3))
        assertEquals(0, rememberedTvItemIndex(listOf("one", "two"), null, 0))
    }

    @Test fun logicalPartsNeverShareFocusIdentity() {
        val bleach = TvTitleCard("bleach", "Bleach", null, null, 30984, false, seriesPart = "original")
        val tybw = bleach.copy(seriesPart = "tybw")
        assertNotEquals(bleach.focusIdentity(), tybw.focusIdentity())
        assertEquals(1, rememberedTvItemIndex(listOf(bleach.focusIdentity(), tybw.focusIdentity()), tybw.focusIdentity(), 0))
    }

    @Test fun episodeCardsRetainTheirOwnIdentityWithinSeries() {
        val card = TvTitleCard("episode-1", "Bleach", null, null, 30984, false, seriesPart = "tybw")
        assertNotEquals(card.focusIdentity(), card.copy(id = "episode-2").focusIdentity())
    }

    @Test fun duplicateCardsAreRemovedWithoutChangingOrderOrFirstOccurrence() {
        val first = TvTitleCard("anime-movie-1311031", "Film", null, null, 1311031, true)
        val other = first.copy(id = "anime-movie-2", tmdbId = 2)
        assertEquals(listOf(first, other), uniqueTvRowCards(listOf(first, first.copy(title = "duplicate"), other)))
    }
}

class TvGridFocusMemoryTest {
    @Test fun seriesPartsGetDistinctGridIdentity() {
        assertEquals("30984", tvGridItemKey("30984", null))
        assertEquals("30984", tvGridItemKey("30984", ""))
        assertNotEquals(tvGridItemKey("30984", "original"), tvGridItemKey("30984", "tybw"))
        assertEquals("30984-tybw", tvGridItemKey("30984", "tybw"))
    }

    @Test fun reorderedGridKeepsRememberedCard() {
        val keys = listOf("a", "b", "c", "d", "e", "f", "g", "h", "i")
        val reordered = listOf("i") + keys.dropLast(1)
        assertEquals(0, rememberedTvItemIndex(reordered, "i", 8))
    }

    @Test fun removedGridCardFallsBackToNearestPosition() {
        val keys = listOf("a", "b", "c", "d", "e", "f", "g", "h", "i").filterNot { it == "e" }
        assertEquals(4, rememberedTvItemIndex(keys, "e", 4))
        assertEquals("f", keys[rememberedTvItemIndex(keys, "e", 4)])
    }

    @Test fun duplicateHeadingsGetDistinctRowKeys() {
        assertNotEquals(tvRowKey("upcoming", "Prochainement"), tvRowKey("upcomingVod", "Prochainement"))
        assertEquals(tvRowKey("trending", "Tendances"), tvRowKey("trending", "Tendances"))
    }
}
