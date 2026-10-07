package com.movviz.nx.mobile.ui.player

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class TimelineSeekTest {
    @Test fun fingerPositionMapsToTheSelectedTime() {
        assertEquals(900_000L, timelineSeekPosition(125f, 1000, 7_200_000L))
        assertEquals(3_600_000L, timelineSeekPosition(500f, 1000, 7_200_000L))
    }

    @Test fun draggingOutsideTheTrackStaysWithinTheFilm() {
        assertEquals(0L, timelineSeekPosition(-50f, 1000, 7_200_000L))
        assertEquals(7_200_000L, timelineSeekPosition(1100f, 1000, 7_200_000L))
    }

    @Test fun anUnknownDurationOrInvalidCoordinatesNeverSeek() {
        assertNull(timelineSeekPosition(20f, 0, 1000))
        assertNull(timelineSeekPosition(20f, 100, -1))
        assertNull(timelineSeekPosition(Float.NaN, 100, 1000))
    }
}
