package com.movviz.tv.ui.player

import com.movviz.tv.data.PlaybackMarkerDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class MarkerSelectionTest {
    private fun m(type: String, start: Long, end: Long) = PlaybackMarkerDto(id = "$type-$start", type = type, startMs = start, endMs = end)

    @Test fun theMarkerContainingThePositionIsChosen() {
        val markers = listOf(m("recap", 0, 5_000), m("intro", 6_000, 9_000))
        assertEquals("recap", pickActiveMarker(markers, 1_000)?.type)
        assertEquals("intro", pickActiveMarker(markers, 6_000)?.type)
        assertNull(pickActiveMarker(markers, 9_000))
    }

    @Test fun overlappingMarkersFollowTheTypePriority() {
        val markers = listOf(m("preview", 100, 500), m("credits", 50, 600), m("intro", 0, 40))
        assertEquals("credits", pickActiveMarker(markers, 200)?.type)
        assertEquals("intro", pickActiveMarker(markers, 10)?.type)
    }

    @Test fun anUnknownTypeNeverShowsAButton() {
        assertNull(pickActiveMarker(listOf(m("commercial", 0, 1_000)), 500))
    }

    @Test fun creditsBecomeNextEpisodeOnlyWhenThereIsOne() {
        assertEquals("Épisode suivant", markerSkipLabel("credits", hasNext = true))
        assertEquals("Passer le générique", markerSkipLabel("credits", hasNext = false))
        assertEquals("Passer le récap", markerSkipLabel("recap", hasNext = true))
        assertEquals("Passer l'intro", markerSkipLabel("intro", hasNext = true))
        assertEquals("Passer l'aperçu", markerSkipLabel("preview", hasNext = true))
    }
}
