package com.movviz.tv.ui.theme

import androidx.compose.ui.graphics.Color
import org.junit.Assert.assertEquals
import org.junit.Test

class MovvizPaletteTest {
    /** Garde-fou « Stable identique au pixel » : chaque rôle lu par un écran
     *  migré doit retomber exactement sur la constante historique. */
    @Test fun stablePaletteEqualsLegacyConstants() {
        val p = MovvizStablePalette
        assertEquals(MovvizInk, p.ink)
        assertEquals(MovvizInkSoft, p.inkSoft)
        assertEquals(MovvizInkDim, p.inkDim)
        assertEquals(MovvizBackground, p.background)
        assertEquals(MovvizSurface, p.surface)
        assertEquals(MovvizSurfaceStrong, p.surfaceRaised)
        assertEquals(MovvizBorder, p.line)
        assertEquals(MovvizBrand2, p.accent)
    }

    @Test fun betaPaletteMatchesSpec() {
        val p = MovvizBetaPalette
        assertEquals(Color(0xFF0B0C10), p.background)
        assertEquals(Color(0xFF13151B), p.surface)
        assertEquals(Color(0xFF1B1E27), p.surfaceRaised)
        assertEquals(Color(0xFF252935), p.surfaceHigh)
        assertEquals(Color(0xFFF5F2EB), p.ink)
        assertEquals(Color(0xFFB7B5BF), p.inkSoft)
        assertEquals(Color(0xFF94919F), p.inkDim)
        assertEquals(Color(0xFFC4B6FF), p.accent)
        assertEquals(Color.White, p.focusRing)
        assertEquals(Color(0xFF101116), p.navBackground)
        assertEquals(Color(0xFFF1EDE5), p.navSelectedContainer)
        assertEquals(Color(0xFF17151E), p.navSelectedContent)
        assertEquals(Color(0xFF514177), p.navSelectedIcon)
        assertEquals(Color(0xFFE4D9FF), p.primaryContainer)
        assertEquals(Color(0xFF211830), p.onPrimaryContainer)
        assertEquals(Color(0xFFD8CEF1), p.eyebrow)
        assertEquals(Color(0xFFE87C7C), p.danger)
        assertEquals(listOf(Color(0xFF7C3AED), Color(0xFFC084FC), Color(0xFF67E8F9)), p.progressFill)
    }

    @Test fun betaLinesAreTranslucentWhite() {
        assertEquals(0.08f, MovvizBetaPalette.line.alpha, 0.01f)
        assertEquals(0.14f, MovvizBetaPalette.lineStrong.alpha, 0.01f)
        assertEquals(1f, MovvizBetaPalette.line.red, 0.001f)
    }
}
