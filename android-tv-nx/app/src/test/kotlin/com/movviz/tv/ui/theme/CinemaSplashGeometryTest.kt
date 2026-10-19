package com.movviz.tv.ui.theme

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CinemaSplashGeometryTest {
    private val eps = 1e-3f

    @Test fun markWidthFollowsTheScreenWithinBounds() {
        assertEquals(960f * 0.19f, CinemaSplashGeometry.markWidth(960f), eps) // TV 1080p (960 dp)
        assertEquals(150f, CinemaSplashGeometry.markWidth(375f), eps) // never smaller than 150 dp
        assertEquals(290f, CinemaSplashGeometry.markWidth(3000f), eps) // never larger than 290 dp
    }

    @Test fun markSitsAboveTheMiddleSoTheWordAndBarFitBelow() {
        assertTrue(CinemaSplashGeometry.MARK_CENTER_Y in 0.35f..0.45f)
        assertTrue(CinemaSplashGeometry.MARK_ASPECT > 1f)
    }

    @Test fun easeInOutIsMonotonicAndBounded() {
        assertEquals(0f, CinemaSplashGeometry.easeInOut(-1f), eps)
        assertEquals(1f, CinemaSplashGeometry.easeInOut(2f), eps)
        assertEquals(0.5f, CinemaSplashGeometry.easeInOut(0.5f), eps)
        assertTrue(CinemaSplashGeometry.easeInOut(0.3f) < CinemaSplashGeometry.easeInOut(0.7f))
    }
}
