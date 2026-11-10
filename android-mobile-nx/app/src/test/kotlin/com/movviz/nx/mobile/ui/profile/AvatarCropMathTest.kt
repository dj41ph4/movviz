package com.movviz.nx.mobile.ui.profile

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.abs

class AvatarCropMathTest {
    @Test fun limiteDe6Mo() = assertEquals(6 * 1024 * 1024, AvatarCropMath.MAX_BYTES)

    @Test fun imagePaysageRecouvreLeCadreSurSaHauteur() {
        assertEquals(0.3f, AvatarCropMath.coverScale(2000f, 1000f, 300f), 1e-6f)
        assertEquals(0.3f, AvatarCropMath.coverScale(1000f, 2000f, 300f), 1e-6f)
    }

    @Test fun cadreCentreCouvreLeMilieu() {
        val o = AvatarCropMath.centeredOffset(2000f, 1000f, 300f, 1f)
        val r = AvatarCropMath.sourceRect(2000f, 1000f, 300f, 1f, o.x, o.y)
        assertEquals(1000f, r.sw, 1e-3f)
        assertEquals(1000f, r.sh, 1e-3f)
        assertEquals(500f, r.sx, 1e-3f)
        assertEquals(0f, r.sy, 1e-3f)
    }

    @Test fun jamaisDeBordVide() {
        assertEquals(AvatarCropMath.Point(0f, 0f), AvatarCropMath.clampOffset(2000f, 1000f, 300f, 1f, 999f, 999f))
        val far = AvatarCropMath.clampOffset(2000f, 1000f, 300f, 1f, -99999f, -99999f)
        assertEquals(300f - 600f, far.x, 1e-3f)
        assertEquals(0f, far.y, 1e-3f)
    }

    @Test fun zoomEntre1Et4() {
        assertEquals(1f, AvatarCropMath.clampZoom(0.2f), 0f)
        assertEquals(4f, AvatarCropMath.clampZoom(9f), 0f)
    }

    @Test fun zoomerGardeLeCentre() {
        val start = AvatarCropMath.centeredOffset(1600f, 1200f, 300f, 1f)
        val before = AvatarCropMath.sourceRect(1600f, 1200f, 300f, 1f, start.x, start.y)
        val o = AvatarCropMath.zoomAroundCenter(1600f, 1200f, 300f, 1f, 2.5f, start.x, start.y)
        val after = AvatarCropMath.sourceRect(1600f, 1200f, 300f, 2.5f, o.x, o.y)
        assertTrue(abs((before.sx + before.sw / 2) - (after.sx + after.sw / 2)) < 1e-2f)
        assertTrue(abs((before.sy + before.sh / 2) - (after.sy + after.sh / 2)) < 1e-2f)
        assertTrue(after.sw < before.sw)
    }
}
