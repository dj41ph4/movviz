package com.movviz.tv.ui.theme

import androidx.compose.ui.graphics.Color
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
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
        assertEquals(Color(0xFFDAB563), p.accent) // or foncé de la marque (plus de violet)
        assertEquals(Color.White, p.focusRing)
        assertEquals(p.background, p.navBackground) // un seul aplat : le rail a le fond de la scène
        assertEquals(Color(0xFFF1EDE5), p.navSelectedContainer)
        assertEquals(Color(0xFF17151E), p.navSelectedContent)
        assertEquals(Color(0xFF876722), p.navSelectedIcon)
        assertEquals(Color(0xFFC4902C), p.primaryContainer)
        assertEquals(Color(0xFF1A1406), p.onPrimaryContainer)
        assertEquals(Color(0xFFD9BC7A), p.eyebrow)
        assertEquals(Color(0xFFE87C7C), p.danger)
        assertEquals(listOf(Color(0xFF8A6418), Color(0xFFB8892B), Color(0xFFE4C88D)), p.progressFill)
    }

    @Test fun stableBrandRolesAreTheHistoricalConstants() {
        val p = MovvizStablePalette
        assertEquals(MovvizBrand, p.brand)
        assertEquals(MovvizBrand2, p.brand2)
        assertEquals(MovvizBrandGlow, p.brandGlow)
    }

    @Test fun betaBrandRolesAreGold() {
        val p = MovvizBetaPalette
        for (c in listOf(p.brand, p.brand2, p.brandGlow)) assertTrue("$c n'est pas dans la gamme dorée", c.red > c.green && c.green > c.blue)
    }

    @Test fun betaPaletteHasNoVioletLeft() {
        val p = MovvizBetaPalette
        val accents = listOf(p.accent, p.primaryContainer, p.eyebrow, p.navSelectedIcon) + p.progressFill
        for (c in accents) {
            // teinte comprise entre 20° et 60° (or) : le rouge domine, le bleu est le canal le plus faible
            assertTrue("$c n'est pas dans la gamme dorée", c.red > c.green && c.green > c.blue)
        }
    }

    @Test fun betaLinesAreTranslucentWhite() {
        assertEquals(0.08f, MovvizBetaPalette.line.alpha, 0.01f)
        assertEquals(0.14f, MovvizBetaPalette.lineStrong.alpha, 0.01f)
        assertEquals(1f, MovvizBetaPalette.line.red, 0.001f)
    }
}
