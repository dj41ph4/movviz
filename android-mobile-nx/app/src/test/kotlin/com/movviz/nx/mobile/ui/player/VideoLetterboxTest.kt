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

    @Test fun tabletFitsTheEntireWidescreenImageButFillExplicitlyCropsIt() {
        val fit = videoSurfaceTransform(1600, 900, 1600, 1200, null, false)
        val fill = videoSurfaceTransform(1600, 900, 1600, 1200, null, true)
        assertEquals(1f, fit.scale, 0.001f)
        assertEquals(4f / 3f, fill.scale, 0.001f)
    }

    @Test fun cinemaBarsCannotZoomAwayTheSidesOnATablet() {
        val crop = detectVideoLetterbox(frame(11, 11), 160, 90)!!
        val fit = videoSurfaceTransform(1600, 900, 1600, 1200, crop, false)
        val fill = videoSurfaceTransform(1600, 900, 1600, 1200, crop, true)
        assertEquals(1f, fit.scale, 0.001f)
        assertEquals(1200f / 680f, fill.scale, 0.001f)
    }

    @Test fun cinemaBarsStillEnlargeTheUsefulImageOnAWidePhone() {
        val crop = detectVideoLetterbox(frame(11, 11), 160, 90)!!
        val fit = videoSurfaceTransform(1920, 1080, 2520, 1080, crop, false)
        assertEquals(2520f / 1920f, fit.scale, 0.001f)
        assertTrue(1080 * (1f - crop.top - crop.bottom) * fit.scale <= 1080f)
    }

    @Test fun nativeCinemaAndPortraitViewportsFitWithoutCropping() {
        assertEquals(1f, videoSurfaceTransform(1600, 670, 1600, 1200, null, false).scale, 0.001f)
        assertEquals(1f, videoSurfaceTransform(1080, 608, 1080, 2400, null, false).scale, 0.001f)
    }

    @Test fun resizeUsesTheNewViewportEvenWhenTheBarsHaveNotChanged() {
        val crop = VideoLetterbox(.125f, .125f)
        val phone = videoSurfaceTransform(1600, 900, 2100, 900, crop, false)
        val tablet = videoSurfaceTransform(1600, 900, 1600, 1200, crop, false)
        assertEquals(1.3125f, phone.scale, 0.001f)
        assertEquals(1f, tablet.scale, 0.001f)
    }

    @Test fun slightlyAsymmetricBarsCenterTheUsefulImage() {
        val crop = VideoLetterbox(.12f, .13f)
        val transform = videoSurfaceTransform(1600, 900, 2100, 900, crop, false)
        val usefulCenter = 900f * (crop.top - crop.bottom) / 2f
        assertEquals(0f, usefulCenter * transform.scale + transform.shiftY, 0.001f)
    }

    @Test fun anUnmeasuredViewportDoesNotIntroduceAnInvalidScale() {
        assertEquals(VideoSurfaceTransform(1f, 0f), videoSurfaceTransform(0, 900, 1600, 1200, null, false))
        assertEquals(VideoSurfaceTransform(1f, 0f), videoSurfaceTransform(1600, 900, 0, 0, null, true))
    }

    @Test fun nativeSurfaceExpandsIntoFreeSideSpaceInsteadOfCroppingInsideItsOldBounds() {
        val layout = videoSurfaceLayout(16f / 9f, 2400, 1080, VideoLetterbox(68f / 540f, 68f / 540f), false)!!
        assertEquals(2400, layout.width)
        assertEquals(1350, layout.height)
        assertTrue(layout.height * (1f - 136f / 540f) <= 1080f)
    }

    @Test fun resizedNativeSurfacePreservesAllFourUsefulEdgesOnATablet() {
        val layout = videoSurfaceLayout(16f / 9f, 1600, 1200, VideoLetterbox(.125f, .125f), false)!!
        assertEquals(1600, layout.width)
        assertEquals(900, layout.height)
        assertEquals(0f, layout.shiftY, 0.001f)
    }

    @Test fun nativeLayoutReturnsFromFillToFitWithoutKeepingTheLargerBounds() {
        val bars = VideoLetterbox(.125f, .125f)
        val fill = videoSurfaceLayout(16f / 9f, 1600, 1200, bars, true)!!
        val fit = videoSurfaceLayout(16f / 9f, 1600, 1200, bars, false)!!
        assertTrue(fill.width > fit.width)
        assertEquals(1600, fit.width)
        assertNull(videoSurfaceLayout(0f, 2400, 1080, bars, false))
    }
}
