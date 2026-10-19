package com.movviz.tv.ui.theme

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CinemaSplashGeometryTest {
    private val eps = 1e-3f

    @Test fun fullHdTvFillsThePlateWithoutCropping() {
        val c = CinemaSplashGeometry.cover(1920f, 1080f)
        assertEquals(1920f / CinemaSplashGeometry.PLATE_W, c.scale, eps)
        assertEquals(0f, c.offsetX, eps)
        assertEquals(0f, c.offsetY, 1f) // 941 × 1.148 = 1080.5 px : moins d'un pixel de rognage
    }

    @Test fun ultraWideScreenCropsTopAndBottomAndKeepsTheLogoCentered() {
        val c = CinemaSplashGeometry.cover(2560f, 1080f)
        assertEquals(2560f / CinemaSplashGeometry.PLATE_W, c.scale, eps)
        assertEquals(0f, c.offsetX, eps)
        assertTrue(c.offsetY < 0f)
        // le centre de la plaque reste au centre de la zone
        val plateCenterY = c.offsetY + CinemaSplashGeometry.PLATE_H / 2f * c.scale
        assertEquals(540f, plateCenterY, 0.5f)
    }

    @Test fun narrowAreaCropsSidesWhenTheRailTakesWidth() {
        val c = CinemaSplashGeometry.cover(1500f, 1080f)
        assertEquals(1080f / CinemaSplashGeometry.PLATE_H, c.scale, eps)
        assertTrue(c.offsetX < 0f)
        val plateCenterX = c.offsetX + CinemaSplashGeometry.PLATE_W / 2f * c.scale
        assertEquals(750f, plateCenterX, 0.5f)
    }

    @Test fun degenerateSizeNeverThrows() {
        val c = CinemaSplashGeometry.cover(0f, 0f)
        assertEquals(1f, c.scale, eps)
    }

    @Test fun zoomStartsAtOneAndSettlesBelowThreePointFivePercent() {
        assertEquals(1f, CinemaSplashGeometry.zoom(0f), eps)
        val late = CinemaSplashGeometry.zoom(60f)
        assertTrue(late > 1.03f && late <= 1.035f + eps)
        assertTrue(CinemaSplashGeometry.zoom(2f) < CinemaSplashGeometry.zoom(4f))
    }

    @Test fun easeInOutIsMonotonicAndBounded() {
        assertEquals(0f, CinemaSplashGeometry.easeInOut(-1f), eps)
        assertEquals(1f, CinemaSplashGeometry.easeInOut(2f), eps)
        assertEquals(0.5f, CinemaSplashGeometry.easeInOut(0.5f), eps)
        assertTrue(CinemaSplashGeometry.easeInOut(0.3f) < CinemaSplashGeometry.easeInOut(0.7f))
    }
}
