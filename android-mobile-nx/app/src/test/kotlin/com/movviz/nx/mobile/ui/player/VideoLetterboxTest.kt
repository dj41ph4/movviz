package com.movviz.nx.mobile.ui.player

import org.junit.Assert.*
import org.junit.Test

class VideoLetterboxTest {
    private fun frame(top: Int, bottom: Int) = IntArray(160 * 90) { i ->
        if (i / 160 < top || i / 160 >= 90 - bottom) 0xFF000000.toInt() else 0xFF909090.toInt()
    }

    @Test fun nativeCinemaStreamsAreExcluded() {
        assertFalse(canDetectVideoLetterbox(21f / 9f))
        assertFalse(canDetectVideoLetterbox(2.39f))
        assertTrue(canDetectVideoLetterbox(16f / 9f))
    }

    @Test fun detectsBakedCinemaBarsWithoutDistortingTheAspectRatio() {
        val crop = detectVideoLetterbox(frame(11, 11), 160, 90)!!
        assertEquals(11f / 90f, crop.top, 0.001f)
        assertEquals(1f / (1f - 22f / 90f), crop.scale, 0.001f)
    }

    @Test fun darkScenesAndUnsafeFramingNeverTriggerACrop() {
        assertNull(detectVideoLetterbox(IntArray(160 * 90) { 0xFF000000.toInt() }, 160, 90))
        assertNull(detectVideoLetterbox(frame(12, 2), 160, 90))
        assertNull(detectVideoLetterbox(frame(20, 20), 160, 90))
    }

    @Test fun requiresSeveralBrightFramesAndRetainsCropThroughDarkScenes() {
        val detector = StableVideoLetterbox()
        val crop = VideoLetterbox(.12f, .12f)
        repeat(3) { assertNull(detector.observe(crop)) }
        assertEquals(crop, detector.observe(crop))
        assertEquals(crop, detector.observe(null))
        repeat(3) { assertEquals(crop, detector.observe(VideoLetterbox(0f, 0f))) }
        assertEquals(VideoLetterbox(0f, 0f), detector.observe(VideoLetterbox(0f, 0f)))
    }

    @Test fun isolatedEvidenceSeparatedByDarkFramesIsNotEnough() {
        val detector = StableVideoLetterbox()
        val crop = VideoLetterbox(.12f, .12f)
        repeat(2) { detector.observe(crop) }
        detector.observe(null)
        repeat(2) { assertNull(detector.observe(crop)) }
    }

    @Test fun smallDetectionNoiseDoesNotMakeTheZoomPump() {
        val detector = StableVideoLetterbox()
        val crop = VideoLetterbox(.12f, .12f)
        repeat(4) { detector.observe(crop) }
        repeat(6) { assertEquals(crop, detector.observe(VideoLetterbox(.13f, .13f))) }
    }
}
