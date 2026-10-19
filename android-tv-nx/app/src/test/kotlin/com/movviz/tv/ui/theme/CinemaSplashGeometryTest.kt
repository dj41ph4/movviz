package com.movviz.tv.ui.theme

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CinemaSplashGeometryTest {
    private val eps = 1e-3f
    private val w = CinemaSplashGeometry.PLATE_W
    private val h = CinemaSplashGeometry.PLATE_H

    @Test fun exactUltraWideFitsThePlateWithoutCropping() {
        val c = CinemaSplashGeometry.cover(w * 2f, h * 2f)
        assertEquals(2f, c.scale, eps)
        assertEquals(0f, c.offsetX, eps)
        assertEquals(0f, c.offsetY, eps)
    }

    @Test fun fullHdCropsTheSidesAndKeepsTheLogoCentered() {
        val c = CinemaSplashGeometry.cover(1920f, 1080f)
        assertEquals(1080f / h, c.scale, eps)
        assertEquals(0f, c.offsetY, eps)
        assertTrue(c.offsetX < 0f)
        assertEquals(960f, c.offsetX + w / 2f * c.scale, 0.5f)
    }

    @Test fun widerThanThePlateCropsTopAndBottom() {
        val c = CinemaSplashGeometry.cover(3840f, 1080f)
        assertEquals(3840f / w, c.scale, eps)
        assertEquals(0f, c.offsetX, eps)
        assertTrue(c.offsetY < 0f)
        assertEquals(540f, c.offsetY + h / 2f * c.scale, 0.5f)
    }

    @Test fun veryNarrowAreaKeepsTheWholeWordmarkVisible() {
        val c = CinemaSplashGeometry.cover(600f, 1080f)
        val visibleW = 600f / c.scale
        assertEquals(CinemaSplashGeometry.MIN_VISIBLE_W, visibleW, 0.5f)
        assertEquals(300f, c.offsetX + w / 2f * c.scale, 0.5f)
    }

    @Test fun degenerateSizeNeverThrows() {
        val c = CinemaSplashGeometry.cover(0f, 0f)
        assertEquals(1f, c.scale, eps)
    }

    @Test fun zoomStartsAtOneAndSettlesBelowThreePercent() {
        assertEquals(1f, CinemaSplashGeometry.zoom(0f), eps)
        val late = CinemaSplashGeometry.zoom(60f)
        assertTrue(late > 1.025f && late <= 1.03f + eps)
        assertTrue(CinemaSplashGeometry.zoom(2f) < CinemaSplashGeometry.zoom(4f))
    }

    @Test fun easeInOutIsMonotonicAndBounded() {
        assertEquals(0f, CinemaSplashGeometry.easeInOut(-1f), eps)
        assertEquals(1f, CinemaSplashGeometry.easeInOut(2f), eps)
        assertEquals(0.5f, CinemaSplashGeometry.easeInOut(0.5f), eps)
        assertTrue(CinemaSplashGeometry.easeInOut(0.3f) < CinemaSplashGeometry.easeInOut(0.7f))
    }
}
